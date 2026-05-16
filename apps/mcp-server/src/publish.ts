import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
let _pub: Redis | null = null;

function pub() {
  if (!_pub) _pub = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return _pub;
}

const CHANNEL = "stage";

export async function publishStage(sessionId: string, event: Record<string, unknown>) {
  if (!sessionId) return;
  try {
    await pub().publish(`${CHANNEL}:${sessionId}`, JSON.stringify(event));
  } catch (e) {
    console.error("[publish] failed:", (e as Error).message);
  }
}
