import express, { type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { webSearch, webSearchSchema } from "./tools/web_search.js";
import {
  browserNavigate, navigateSchema,
  browserClick, clickSchema,
  browserType, typeSchema,
  browserText, textSchema,
  browserScreenshot, screenshotSchema,
  browserEval, evalSchema,
  browserClickAt, clickAtSchema,
} from "./tools/browser.js";
import { renderArtifact, renderArtifactSchema } from "./tools/render_artifact.js";
import { dbQuery, dbQuerySchema } from "./tools/db_query.js";
import { submitPlan, submitPlanSchema } from "./tools/submit_plan.js";
import {
  memorySave, memorySaveSchema,
  memoryRecall, memoryRecallSchema,
  memoryForget, memoryForgetSchema,
} from "./tools/memory.js";
import { spawnResearch, spawnResearchSchema } from "./tools/spawn_research.js";
import { browserFetch, browserFetchSchema } from "./tools/browser_fetch.js";
import { timedTool } from "./observability.js";

function wrap<A>(name: string, fn: (a: A) => Promise<unknown>) {
  return async (a: A) => {
    const sessionId = (a as { sessionId?: string } | undefined)?.sessionId;
    const out = await timedTool(name, sessionId, () => fn(a));
    return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
  };
}

const PORT = Number(process.env.PORT ?? 3001);

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "hackaton-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.tool("submit_plan",
    "Declare your plan as a list of 1-8 steps BEFORE doing any other tool calls. The user sees this plan on the right pane and watches it complete as you execute. Call this exactly once at the START of every non-trivial turn (skip for one-word answers).",
    submitPlanSchema,
    wrap("submitPlan", submitPlan)
  );

  server.tool("web_search",
    "Search the web using Brave Search. Returns title/url/snippet for each result.",
    webSearchSchema,
    wrap("webSearch", webSearch)
  );

  server.tool("browser_navigate",
    "Navigate the visible Chromium browser to a URL. Audience sees this happen live on the right pane.",
    navigateSchema,
    wrap("browserNavigate", browserNavigate)
  );

  server.tool("browser_click",
    "Click an element in the visible browser. Selector may be CSS or text=.",
    clickSchema,
    wrap("browserClick", browserClick)
  );

  server.tool("browser_type",
    "Type text into a focused input in the visible browser. Set submit=true to press Enter after.",
    typeSchema,
    wrap("browserType", browserType)
  );

  server.tool("browser_text",
    "Read the visible text content of the current page (optionally scoped to a CSS selector). Use this to EXTRACT structured data from a page instead of repeatedly taking screenshots. Returns the page text (truncated to maxChars).",
    textSchema,
    wrap("browserText", browserText)
  );

  server.tool("browser_screenshot",
    "Take a PNG screenshot of the current page and show it to the user on the right pane. The image is NOT included in your context — use browser_text to actually read page content.",
    screenshotSchema,
    wrap("browserScreenshot", browserScreenshot)
  );

  server.tool("browser_fetch",
    "Fetch and extract clean readable markdown from a URL using HTTP + Readability — does NOT touch the visible browser. Faster than browser_navigate for reading sources in parallel. Returns {title, byline, markdown, links[]}. Use this to read sources discovered via web_search.",
    browserFetchSchema,
    wrap("browserFetch", browserFetch)
  );

  server.tool("browser_eval",
    "Run arbitrary JS inside the page and get the JSON-serialized return value. Use when selectors are unreliable: 'document.querySelectorAll(\"article h2\").length', 'document.querySelector(\".price\").innerText', etc. Result is bounded by JSON serialization.",
    evalSchema,
    wrap("browserEval", browserEval)
  );

  server.tool("browser_click_at",
    "Click at pixel coordinates inside the viewport (escape hatch when CSS selectors fail). Default button is left.",
    clickAtSchema,
    wrap("browserClickAt", browserClickAt)
  );

  server.tool("render_artifact",
    "Render a rich UI artifact on the right pane (chart, table, kanban, map, markdown, iframe). Prefer this over long text responses when the result has structure.",
    renderArtifactSchema,
    wrap("renderArtifact", renderArtifact)
  );

  server.tool("db_query",
    "Run a read-only SQL query against the configured Postgres database. SELECT/WITH only.",
    dbQuerySchema,
    wrap("dbQuery", dbQuery)
  );

  server.tool("memory_save",
    "Persist a short note that survives across sessions. Use for user preferences, learned constraints, recurring facts (e.g. 'preferred-city: Mamaia', 'agent-tone: terse'). Idempotent — same key overwrites.",
    memorySaveSchema,
    wrap("memorySave", memorySave)
  );

  server.tool("memory_recall",
    "Read back persisted memory. Call this early in a session to load relevant context. Pass `query` to filter by substring; omit for everything (capped at 20).",
    memoryRecallSchema,
    wrap("memoryRecall", memoryRecall)
  );

  server.tool("spawn_research",
    "Spawn 1-4 parallel sub-agents (Haiku) to research independent questions. Each runs its own web_search + reason loop and returns a <120-word answer. Use this when the user asks 'compare X vs Y' or 'what are the options for Z' — you delegate the legwork in parallel.",
    spawnResearchSchema,
    wrap("spawnResearch", spawnResearch)
  );

  server.tool("memory_forget",
    "Delete a memory by key (e.g. when the user says 'forget that').",
    memoryForgetSchema,
    wrap("memoryForget", memoryForget)
  );

  return server;
}

const transports = new Map<string, StreamableHTTPServerTransport>();

async function handleMcp(req: Request, res: Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport | undefined;

  if (sessionId && transports.has(sessionId)) {
    transport = transports.get(sessionId)!;
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport!);
      },
    });
    transport.onclose = () => {
      if (transport && transport.sessionId) transports.delete(transport.sessionId);
    };
    const server = buildServer();
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID or initialize call" },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, sessions: transports.size });
});

app.post("/mcp", handleMcp);
app.get("/mcp", handleMcp);
app.delete("/mcp", handleMcp);

app.listen(PORT, () => {
  console.log(`[mcp] listening on :${PORT} (POST /mcp)`);
});
