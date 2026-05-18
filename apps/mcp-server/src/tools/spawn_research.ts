import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { publishStage } from "../publish.js";
import { webSearch } from "./web_search.js";
import { browserFetch } from "./browser_fetch.js";

const SUBAGENT_MODEL = process.env.ANTHROPIC_SUBAGENT_MODEL ?? "claude-sonnet-4-6";
const SUBAGENT_MAX_STEPS = 6;

export const spawnResearchSchema = {
  sessionId: z.string(),
  queries: z.array(z.string()).min(1).max(3).describe(
    "1-3 distinct research questions. Each spawns a parallel sub-agent that web_searches, browser_fetches multiple sources, and synthesizes a cross-source answer with cited URLs."
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
      description: "Search the web with Brave; returns title/url/snippet. Use this FIRST to discover sources.",
      input_schema: {
        type: "object" as const,
        properties: {
          query: { type: "string" },
          count: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        },
        required: ["query"],
      },
    },
    {
      name: "browser_fetch",
      description: "Fetch and extract clean markdown text from a specific URL (no visible browser, fast HTTP fetch + readability). Use this AFTER web_search to read the actual content of top results — never trust snippets alone.",
      input_schema: {
        type: "object" as const,
        properties: {
          url: { type: "string", format: "uri" },
          maxChars: { type: "integer", minimum: 500, maximum: 50000, default: 10000 },
        },
        required: ["url"],
      },
    },
  ];
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content:
        (context ? `Context: ${context}\n\n` : "") +
        `Research question: ${question}\n\n` +
        "Process: (1) web_search with the best query. (2) Pick 2-3 distinct authoritative URLs from different domains. (3) browser_fetch each. (4) Synthesize cross-source answer.\n" +
        "Constraints: ≤300 words. ALWAYS cite at least 2 source URLs inline (markdown links). If sources disagree, note the disagreement. If you cannot find solid info after 2 search refinements, say 'No reliable info found' — never fabricate.",
    },
  ];

  for (let step = 0; step < SUBAGENT_MAX_STEPS; step++) {
    const res = await anthropic.messages.create({
      model: SUBAGENT_MODEL,
      max_tokens: 2048,
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
      try {
        let out: unknown;
        if (tu.name === "web_search") {
          out = await webSearch(tu.input as { query: string; count?: number });
        } else if (tu.name === "browser_fetch") {
          out = await browserFetch(tu.input as { url: string; maxChars?: number });
        } else {
          out = { error: `unknown tool ${tu.name}` };
        }
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
