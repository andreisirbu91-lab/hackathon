import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_SERVER_URL ?? "http://localhost:3001/mcp";

let _client: Client | null = null;
let _connecting: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const client = new Client({ name: "hackaton-web", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  return client;
}

export async function mcpClient(): Promise<Client> {
  if (_client) return _client;
  if (!_connecting) {
    _connecting = connect()
      .then((c) => { _client = c; return c; })
      .catch((e) => { _connecting = null; throw e; });
  }
  return _connecting;
}

import type Anthropic from "@anthropic-ai/sdk";

export async function listToolsForAnthropic(): Promise<Anthropic.Messages.Tool[]> {
  const client = await mcpClient();
  const { tools } = await client.listTools();
  return tools.map((t) => {
    // Strip sessionId from the schema the model sees — we inject it server-side.
    const raw = (t.inputSchema as Anthropic.Messages.Tool["input_schema"]) ?? {
      type: "object" as const,
      properties: {},
    };
    const props = { ...(raw.properties ?? {}) } as Record<string, unknown>;
    delete props.sessionId;
    const rawRequired = (raw as unknown as { required?: string[] }).required;
    const required = Array.isArray(rawRequired)
      ? rawRequired.filter((r) => r !== "sessionId")
      : undefined;
    return {
      name: t.name,
      description: t.description ?? "",
      input_schema: {
        ...raw,
        properties: props,
        ...(required ? { required } : {}),
      } as Anthropic.Messages.Tool["input_schema"],
    };
  });
}

export async function callTool(name: string, args: unknown): Promise<unknown> {
  const client = await mcpClient();
  const res = await client.callTool({ name, arguments: (args as Record<string, unknown>) ?? {} });
  return res.content;
}
