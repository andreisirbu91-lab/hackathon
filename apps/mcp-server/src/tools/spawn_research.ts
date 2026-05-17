import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { publishStage } from "../publish.js";
import { webSearch } from "./web_search.js";

const SUBAGENT_MODEL = process.env.ANTHROPIC_SUBAGENT_MODEL ?? "claude-haiku-4-5";
const SUBAGENT_MAX_STEPS = 4;

export const spawnResearchSchema = {
  sessionId: z.string(),
  queries: z.array(z.string()).min(1).max(4).describe(
    "1-4 distinct research questions. Each spawns a parallel sub-agent that web_searches and synthesizes a short answer."
  ),
  context: z.string().optional().describe("Optional shared context the sub-agents get as background"),
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// A minimal sub-agent loop: web_search + reason + reply. Cheaper than the
// main agent because it skips browser/db/render tools.
async function runSubagent(question: string, context: string | undefined): Promise<string> {
  const tools: Anthropic.Messages.Tool[] = [
    {
      name: "web_search",
      description: "Search the web with Brave; returns title/url/snippet.",
      input_schema: {
        type: "object" as const,
        properties: {
          query: { type: "string" },
          count: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        },
        required: ["query"],
      },
    },
  ];
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content:
        (context ? `Context: ${context}\n\n` : "") +
        `Research question: ${question}\n\n` +
        "Answer in <=120 words. Cite the source URLs you used inline. If you cannot find solid info, say so explicitly.",
    },
  ];

  for (let step = 0; step < SUBAGENT_MAX_STEPS; step++) {
    const res = await anthropic.messages.create({
      model: SUBAGENT_MODEL,
      max_tokens: 1024,
      tools,
      messages,
    });
    const toolUses = res.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    messages.push({ role: "assistant", content: res.content });
    if (toolUses.length === 0) {
      const textBlock = res.content.find((b) => b.type === "text") as
        | { type: "text"; text: string }
        | undefined;
      return textBlock?.text ?? "(no answer)";
    }
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = tu.input as { query: string; count?: number };
      try {
        const out = await webSearch(input);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
      } catch (e) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: ${(e as Error).message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }
  return "(sub-agent hit step cap without converging)";
}

export async function spawnResearch(args: {
  sessionId: string;
  queries: string[];
  context?: string;
}) {
  const startedAt = Date.now();
  await publishStage(args.sessionId, {
    kind: "artifact",
    id: `subagents-${startedAt}`,
    type: "markdown",
    props: {
      title: `Spawned ${args.queries.length} parallel sub-agents`,
      content: args.queries.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    },
    at: startedAt,
  });

  const results = await Promise.all(
    args.queries.map(async (q) => {
      try {
        const answer = await runSubagent(q, args.context);
        return { question: q, answer };
      } catch (e) {
        return { question: q, error: (e as Error).message };
      }
    })
  );

  return {
    spawned: results.length,
    durationMs: Date.now() - startedAt,
    results,
  };
}
