import express from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

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

  server.tool(
    "web_search",
    "Search the web using Brave Search. Returns title/url/snippet for each result.",
    webSearchSchema,
    async (args) => {
      const out = await webSearch(args);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    }
  );

  server.tool(
    "browser_navigate",
    "Navigate the visible Chromium browser to a URL. Audience sees this happen live on the right pane.",
    navigateSchema,
    async (args) => {
      const out = await browserNavigate(args);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    }
  );

  server.tool(
    "browser_click",
    "Click an element in the visible browser. Selector may be CSS or text=.",
    clickSchema,
    async (args) => {
      const out = await browserClick(args);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    }
  );

  server.tool(
    "browser_type",
    "Type text into a focused input in the visible browser. Set submit=true to press Enter after.",
    typeSchema,
    async (args) => {
      const out = await browserType(args);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    }
  );

  server.tool(
    "browser_screenshot",
    "Take a PNG screenshot of the current page. Returns a data URL.",
    screenshotSchema,
    async (args) => {
      const out = await browserScreenshot(args);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    }
  );

  server.tool(
    "render_artifact",
    "Render a rich UI artifact on the right pane (chart, table, kanban, map, markdown, iframe). Prefer this over long text responses when the result has structure.",
    renderArtifactSchema,
    async (args) => {
      const out = await renderArtifact(args);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    }
  );

  server.tool(
    "db_query",
    "Run a read-only SQL query against the configured Postgres database. SELECT/WITH only.",
    dbQuerySchema,
    async (args) => {
      const out = await dbQuery(args);
      return { content: [{ type: "text", text: JSON.stringify(out) }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", (_req, res) => res.status(405).json({ error: "Use POST /mcp" }));
app.delete("/mcp", (_req, res) => res.status(405).json({ error: "Use POST /mcp" }));

app.listen(PORT, () => {
  console.log(`[mcp] listening on :${PORT} (POST /mcp)`);
});
