import { anthropic, MODEL, FALLBACK_MODEL, SYSTEM_PROMPT } from "./anthropic";
import { listToolsForAnthropic, callTool } from "./mcp-client";
import { publishStage } from "./event-bus";
import { costOf } from "./pricing";
import type Anthropic from "@anthropic-ai/sdk";

const MAX_STEPS = 20;
const MAX_RATE_RETRIES = 4;
const HISTORY_KEEP_TURNS = 4; // last N user/assistant turns sent to the model verbatim
const MAX_TOKENS = 4096;
const THINKING_BUDGET = Number(process.env.ANTHROPIC_THINKING_BUDGET ?? "2048");

// When estimated input tokens of the trimmed history exceed this, run a
// summarization pass on the dropped tail and prepend the summary as context.
const COMPACTION_THRESHOLD_TOKENS = 4000;
const COMPACTION_MODEL = process.env.ANTHROPIC_COMPACTION_MODEL ?? "claude-haiku-4-5";

// Per-turn budget. If a single turn's tool-use loop exceeds this many USD,
// stop early to protect the user. Default 0.25 USD per turn (very generous
// for Sonnet 4.6 with 4 cached tools and a handful of tool calls).
const PER_TURN_BUDGET_USD = Number(process.env.AGENT_PER_TURN_BUDGET_USD ?? "0.25");

function estimateTokens(messages: ChatMessage[]): number {
  // Rough: ~3.5 chars per token. Good enough for thresholding.
  return Math.ceil(messages.reduce((s, m) => s + (m.content?.length ?? 0), 0) / 3.5);
}

async function compactIfNeeded(history: ChatMessage[]): Promise<{
  messages: ChatMessage[];
  compactedCount: number;
}> {
  if (history.length <= HISTORY_KEEP_TURNS) {
    return { messages: history, compactedCount: 0 };
  }
  const tail = history.slice(-HISTORY_KEEP_TURNS);
  const older = history.slice(0, -HISTORY_KEEP_TURNS);
  if (estimateTokens(older) < COMPACTION_THRESHOLD_TOKENS) {
    return { messages: tail, compactedCount: older.length };
  }
  // Worth summarizing
  try {
    const transcript = older.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const res = await anthropic.messages.create({
      model: COMPACTION_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content:
            "Summarize this prior conversation in <=150 tokens. Preserve: stable user facts, decisions made, constraints, tools tried. Output a single dense paragraph, no preamble.\n\n" +
            transcript,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    const summary = block?.text ?? "(no summary)";
    return {
      messages: [
        { role: "user", content: `[Previous conversation digest]\n${summary}` },
        { role: "assistant", content: "Got it, continuing from there." },
        ...tail,
      ],
      compactedCount: older.length,
    };
  } catch {
    // Compaction failed (rate limit etc) — fall back to hard trim
    return { messages: tail, compactedCount: older.length };
  }
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AgentEvent =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; delta: string }
  | { kind: "tool_call_start"; id: string; name: string; input: unknown }
  | { kind: "tool_input_delta"; id: string; partial: string }
  | { kind: "tool_call_end"; id: string; name: string; output: unknown; durationMs: number; error?: string }
  | { kind: "usage"; model: string; input: number; output: number; cacheCreate: number; cacheRead: number; costUsd: number }
  | { kind: "done" }
  | { kind: "error"; message: string };

export async function* runAgent(
  sessionId: string,
  history: ChatMessage[]
): AsyncGenerator<AgentEvent> {
  const rawTools = await listToolsForAnthropic();
  // Mark the LAST tool with cache_control so the whole tools block + system prompt
  // before it gets cached on Anthropic side (5-min TTL, ~90% cost off after first hit).
  const tools: Anthropic.Messages.Tool[] = rawTools.map((t, i) =>
    i === rawTools.length - 1
      ? ({ ...t, cache_control: { type: "ephemeral" } } as Anthropic.Messages.Tool)
      : t
  );
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  // Compact history if the older portion is heavy; otherwise just trim.
  const compacted = await compactIfNeeded(history);
  if (compacted.compactedCount > 0) {
    await publishStage(sessionId, {
      kind: "text",
      delta: `_[compacted ${compacted.compactedCount} earlier turn${compacted.compactedCount === 1 ? "" : "s"} into a digest]_\n`,
      at: Date.now(),
    });
  }
  const messages: Anthropic.Messages.MessageParam[] = compacted.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Per-turn model selection: try MODEL first; on 429 fall back to FALLBACK_MODEL
  // for this turn only. Next turn starts back with MODEL so we recover automatically
  // when the rate-limit sliding window opens up.
  let currentModel = MODEL;
  let turnCostUsd = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (turnCostUsd >= PER_TURN_BUDGET_USD) {
      const msg = `Stopped: per-turn budget of $${PER_TURN_BUDGET_USD.toFixed(2)} reached ($${turnCostUsd.toFixed(4)} spent).`;
      yield { kind: "error", message: msg };
      await publishStage(sessionId, { kind: "error", message: msg, at: Date.now() });
      return;
    }
    let assistantBlocks: Anthropic.Messages.ContentBlock[] | null = null;
    let fellBackThisStep = false;
    let yieldedAny = false;

    while (assistantBlocks === null) {
      try {
        const stream = anthropic.messages.stream({
          model: currentModel,
          max_tokens: MAX_TOKENS,
          ...(THINKING_BUDGET > 0
            ? { thinking: { type: "enabled" as const, budget_tokens: THINKING_BUDGET } }
            : {}),
          system: systemBlocks,
          tools,
          messages,
        });
        // Track in-flight tool_use blocks by index so we can attach their id
        // to streaming JSON deltas.
        const toolBlockById = new Map<number, { id: string; name: string }>();

        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
            toolBlockById.set(event.index, {
              id: event.content_block.id,
              name: event.content_block.name,
            });
            // Emit a placeholder start so the UI shows the call immediately;
            // input will fill in via subsequent input_json_deltas.
            await publishStage(sessionId, {
              kind: "tool_call_start",
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
              at: Date.now(),
            });
            yield {
              kind: "tool_call_start",
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            };
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              const delta = event.delta.text;
              yieldedAny = true;
              yield { kind: "text", delta };
              await publishStage(sessionId, { kind: "text", delta, at: Date.now() });
            } else if (event.delta.type === "thinking_delta") {
              const delta = (event.delta as { thinking?: string }).thinking ?? "";
              if (delta) yield { kind: "thinking", delta };
            } else if (event.delta.type === "input_json_delta") {
              const partial = (event.delta as { partial_json?: string }).partial_json ?? "";
              const block = toolBlockById.get(event.index);
              if (block && partial) {
                yield { kind: "tool_input_delta", id: block.id, partial };
                // Don't republish to Redis stream for every delta — too chatty.
              }
            }
          }
        }
        const final = await stream.finalMessage();
        assistantBlocks = final.content;
        const u = final.usage as Anthropic.Messages.Usage | undefined;
        if (u) {
          const usage = {
            input_tokens: u.input_tokens ?? 0,
            output_tokens: u.output_tokens ?? 0,
            cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
          };
          const costUsd = costOf(currentModel, usage);
          turnCostUsd += costUsd;
          const ev = {
            kind: "usage" as const,
            model: currentModel,
            input: usage.input_tokens,
            output: usage.output_tokens,
            cacheCreate: usage.cache_creation_input_tokens,
            cacheRead: usage.cache_read_input_tokens,
            costUsd,
          };
          yield ev;
          await publishStage(sessionId, { ...ev, at: Date.now() });
        }
      } catch (err: unknown) {
        const status = (err as { status?: number } | null)?.status;
        const message = err instanceof Error ? err.message : String(err);
        const isRateLimit =
          status === 429 || /rate.?limit|429|overloaded|529/i.test(message);

        // Step 1: on rate-limit, try the fallback model IMMEDIATELY (no wait, no retry)
        if (isRateLimit && !yieldedAny && !fellBackThisStep && currentModel !== FALLBACK_MODEL) {
          fellBackThisStep = true;
          currentModel = FALLBACK_MODEL;
          const note = `\n_[${MODEL} rate-limited, switching to ${FALLBACK_MODEL} for this turn]_\n`;
          yield { kind: "text", delta: note };
          await publishStage(sessionId, { kind: "text", delta: note, at: Date.now() });
          continue;
        }

        yield { kind: "error", message };
        await publishStage(sessionId, { kind: "error", message, at: Date.now() });
        return;
      }
    }

    // Reset for next step: try the primary model again first
    currentModel = MODEL;

    const toolUses = assistantBlocks.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: assistantBlocks });

    if (toolUses.length === 0) {
      yield { kind: "done" };
      await publishStage(sessionId, { kind: "done", at: Date.now() });
      return;
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      const id = tu.id;
      const name = tu.name;
      const input = tu.input;
      const startedAt = Date.now();

      // Stage-store reducer is idempotent on id — re-emitting tool_call_start
      // with the final parsed input updates the entry's input field.
      await publishStage(sessionId, { kind: "tool_call_start", id, name, input, at: startedAt });

      try {
        const output = await callTool(name, input);
        const durationMs = Date.now() - startedAt;
        yield { kind: "tool_call_end", id, name, output, durationMs };
        await publishStage(sessionId, { kind: "tool_call_end", id, name, output, durationMs, at: Date.now() });

        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: typeof output === "string" ? output : JSON.stringify(output),
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const durationMs = Date.now() - startedAt;
        yield { kind: "tool_call_end", id, name, output: null, durationMs, error: errorMsg };
        await publishStage(sessionId, { kind: "tool_call_end", id, name, output: null, durationMs, error: errorMsg, at: Date.now() });
        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: `Error: ${errorMsg}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  yield { kind: "error", message: `Hit MAX_STEPS=${MAX_STEPS} without completion.` };
}
