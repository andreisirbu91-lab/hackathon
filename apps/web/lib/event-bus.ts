import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let _publisher: Redis | null = null;
export function publisher() {
  if (!_publisher) _publisher = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: null });
  return _publisher;
}

export function subscriber() {
  return new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: null });
}

export type StageEvent =
  | { kind: "tool_call_start"; id: string; name: string; input: unknown; at: number }
  | { kind: "tool_call_end"; id: string; name: string; output: unknown; durationMs: number; error?: string; at: number }
  | { kind: "artifact"; id: string; type: string; props: unknown; at: number }
  | { kind: "browser"; action: string; url?: string; at: number }
  | { kind: "text"; delta: string; at: number }
  | { kind: "done"; at: number }
  | { kind: "error"; message: string; at: number };

export const CHANNEL = "stage";

export async function publishStage(sessionId: string, event: StageEvent) {
  await publisher().publish(`${CHANNEL}:${sessionId}`, JSON.stringify(event));
}
