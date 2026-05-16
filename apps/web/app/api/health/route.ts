import { mcpClient } from "@/lib/mcp-client";
import { publisher } from "@/lib/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, string> = {};

  result.anthropic = process.env.ANTHROPIC_API_KEY ? "ok" : "missing-key";

  try {
    await publisher().ping();
    result.redis = "ok";
  } catch (e) {
    result.redis = `error: ${(e as Error).message}`;
  }

  try {
    const client = await mcpClient();
    const { tools } = await client.listTools();
    result.mcp = `ok (${tools.length} tools)`;
  } catch (e) {
    result.mcp = `error: ${(e as Error).message}`;
  }

  const browserVnc = process.env.NEXT_PUBLIC_BROWSER_VNC_URL;
  result.browser = browserVnc ? `configured: ${browserVnc}` : "not-configured";

  return Response.json(result);
}
