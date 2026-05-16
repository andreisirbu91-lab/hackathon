import { anthropic, MODEL, SYSTEM_PROMPT } from "./anthropic";
import { listToolsForAnthropic, callTool } from "./mcp-client";
import { publishStage } from "./event-bus";
import type Anthropic from "@anthropic-ai/sdk";

const MAX_STEPS = 12;

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
  const tools = await listToolsForAnthropic();
  const messages: Anthropic.Messages.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    let assistantBlocks: Anthropic.Messages.ContentBlock[] = [];

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const delta = event.delta.text;
          yield { kind: "text", delta };
          await publishStage(sessionId, { kind: "text", delta, at: Date.now() });
        }
      }
      const final = await stream.finalMessage();
      assistantBlocks = final.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { kind: "error", message };
      await publishStage(sessionId, { kind: "error", message, at: Date.now() });
      return;
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
