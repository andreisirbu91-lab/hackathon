// Lightweight structured logging — every tool call gets a one-line JSON
// emitted to stdout that downstream collectors (Promtail, Vector, Filebeat,
// even `docker logs ... | jq`) can scrape.

export type ToolTrace = {
  ts: string;
  level: "info" | "warn" | "error";
  span: "mcp.tool";
  tool: string;
  sessionId?: string;
  durationMs?: number;
  ok: boolean;
  error?: string;
  outputBytes?: number;
};

export function logTool(trace: Omit<ToolTrace, "ts" | "level" | "span">) {
  const entry: ToolTrace = {
    ts: new Date().toISOString(),
    level: trace.ok ? "info" : "error",
    span: "mcp.tool",
    ...trace,
  };
  // single-line JSON for easy ingestion
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export async function timedTool<T>(
  tool: string,
  sessionId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  try {
    const out = await fn();
    const durationMs = Date.now() - started;
    let outputBytes: number | undefined;
    try { outputBytes = JSON.stringify(out).length; } catch {}
    logTool({ tool, sessionId, durationMs, ok: true, outputBytes });
    return out;
  } catch (e) {
    const durationMs = Date.now() - started;
    logTool({ tool, sessionId, durationMs, ok: false, error: (e as Error).message });
    throw e;
  }
}
