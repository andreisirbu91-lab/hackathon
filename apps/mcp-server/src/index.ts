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
  browserScreenshot, screenshotSchema,
} from "./tools/browser.js";
import { renderArtifact, renderArtifactSchema } from "./tools/render_artifact.js";
import { dbQuery, dbQuerySchema } from "./tools/db_query.js";

const PORT = Number(process.env.PORT ?? 3001);

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "hackaton-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.tool("web_search",
    "Search the web using Brave Search. Returns title/url/snippet for each result.",
    webSearchSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await webSearch(args)) }] })
  );

  server.tool("browser_navigate",
    "Navigate the visible Chromium browser to a URL. Audience sees this happen live on the right pane.",
    navigateSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await browserNavigate(args)) }] })
  );

  server.tool("browser_click",
    "Click an element in the visible browser. Selector may be CSS or text=.",
    clickSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await browserClick(args)) }] })
  );

  server.tool("browser_type",
    "Type text into a focused input in the visible browser. Set submit=true to press Enter after.",
    typeSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await browserType(args)) }] })
  );

  server.tool("browser_screenshot",
    "Take a PNG screenshot of the current page. Returns a data URL.",
    screenshotSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await browserScreenshot(args)) }] })
  );

  server.tool("render_artifact",
    "Render a rich UI artifact on the right pane (chart, table, kanban, map, markdown, iframe). Prefer this over long text responses when the result has structure.",
    renderArtifactSchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await renderArtifact(args)) }] })
  );

  server.tool("db_query",
    "Run a read-only SQL query against the configured Postgres database. SELECT/WITH only.",
    dbQuerySchema,
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await dbQuery(args)) }] })
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
