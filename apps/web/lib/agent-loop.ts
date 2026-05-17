import { anthropic, MODEL, SYSTEM_PROMPT } from "./anthropic";
import { listToolsForAnthropic, callTool } from "./mcp-client";
import { publishStage } from "./event-bus";
import type Anthropic from "@anthropic-ai/sdk";

const MAX_STEPS = 12;
const MAX_RATE_RETRIES = 4;
const HISTORY_KEEP_TURNS = 8; // last N user/assistant turns sent to the model

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AgentEvent =
  | { kind: "text"; delta: string }
  | { kind: "tool_call_start"; id: string; name: string; input: unknown }
  | { kind: "tool_call_end"; id: string; name: string; output: unknown; durationMs: number; error?: string }
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

  // Truncate history: keep the last N turns to bound input tokens.
  const trimmed = history.slice(-HISTORY_KEEP_TURNS);
  const messages: Anthropic.Messages.MessageParam[] = trimmed.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    let assistantBlocks: Anthropic.Messages.ContentBlock[] | null = null;
    let attempt = 0;
    let yieldedAny = false;

    while (assistantBlocks === null) {
      try {
        const stream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          system: systemBlocks,
          tools,
          messages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const delta = event.delta.text;
            yieldedAny = true;
            yield { kind: "text", delta };
            await publishStage(sessionId, { kind: "text", delta, at: Date.now() });
          }
        }
        const final = await stream.finalMessage();
        assistantBlocks = final.content;
      } catch (err: unknown) {
        const status = (err as { status?: number } | null)?.status;
        const message = err instanceof Error ? err.message : String(err);
        const isRateLimit =
          status === 429 || /rate.?limit|429|overloaded|529/i.test(message);
        const canRetry = isRateLimit && !yieldedAny && attempt < MAX_RATE_RETRIES;

        if (canRetry) {
          attempt += 1;
          const waitMs = Math.min(2000 * 2 ** (attempt - 1), 16000);
          const note = `\n_[rate-limit, retry în ${Math.round(waitMs / 1000)}s — attempt ${attempt}/${MAX_RATE_RETRIES}]_\n`;
          yield { kind: "text", delta: note };
          await publishStage(sessionId, { kind: "text", delta: note, at: Date.now() });
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        yield { kind: "error", message };
        await publishStage(sessionId, { kind: "error", message, at: Date.now() });
        return;
      }
    }

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

      yield { kind: "tool_call_start", id, name, input };
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
