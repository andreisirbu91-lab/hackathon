import { z } from "zod";
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;

let initialized = false;
async function getClient(): Promise<pg.Client | null> {
  if (!dbUrl) return null;
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  if (!initialized) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id BIGSERIAL PRIMARY KEY,
        scope TEXT NOT NULL DEFAULT 'global',
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (scope, key)
      );
      CREATE INDEX IF NOT EXISTS agent_memory_scope_idx ON agent_memory (scope);
    `);
    initialized = true;
  }
  return client;
}

export const memorySaveSchema = {
  key: z.string().min(1).max(120).describe(
    "Stable short identifier — kebab-case or snake_case (e.g. 'user-name', 'preferred-city', 'project-deadline')."
  ),
  value: z.string().min(1).max(2000).describe("The fact to remember. Be concise but complete."),
  scope: z.string().optional().default("global").describe("Optional namespace (defaults to 'global')."),
};
export async function memorySave(args: { key: string; value: string; scope?: string }) {
  const client = await getClient();
  if (!client) return { error: "Memory unavailable: SUPABASE_DB_URL not configured" };
  try {
    await client.query(
      `INSERT INTO agent_memory (scope, key, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (scope, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [args.scope ?? "global", args.key, args.value]
    );
    return { saved: true, key: args.key };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    await client.end().catch(() => {});
  }
}

export const memoryRecallSchema = {
  query: z.string().optional().describe("Optional substring to filter keys/values by. Omit to list everything."),
  scope: z.string().optional().default("global"),
  limit: z.number().int().min(1).max(50).default(20),
};
export async function memoryRecall(args: { query?: string; scope?: string; limit?: number }) {
  const client = await getClient();
  if (!client) return { error: "Memory unavailable: SUPABASE_DB_URL not configured" };
  try {
    const scope = args.scope ?? "global";
    const limit = args.limit ?? 20;
    const params: unknown[] = [scope];
    let where = "scope = $1";
    if (args.query) {
      params.push(`%${args.query}%`);
      where += ` AND (key ILIKE $${params.length} OR value ILIKE $${params.length})`;
    }
    const res = await client.query(
      `SELECT key, value, updated_at FROM agent_memory
       WHERE ${where}
       ORDER BY updated_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    return {
      count: res.rowCount,
      memories: res.rows.map((r) => ({ key: r.key, value: r.value, updated_at: r.updated_at })),
    };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    await client.end().catch(() => {});
  }
}

export const memoryForgetSchema = {
  key: z.string().describe("Key to remove"),
  scope: z.string().optional().default("global"),
};
export async function memoryForget(args: { key: string; scope?: string }) {
  const client = await getClient();
  if (!client) return { error: "Memory unavailable: SUPABASE_DB_URL not configured" };
  try {
    const res = await client.query(
      `DELETE FROM agent_memory WHERE scope = $1 AND key = $2`,
      [args.scope ?? "global", args.key]
    );
    return { forgotten: (res.rowCount ?? 0) > 0, key: args.key };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    await client.end().catch(() => {});
  }
}
