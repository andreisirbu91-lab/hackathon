import { z } from "zod";

export const dbQuerySchema = {
  sql: z.string().describe("Read-only SQL query"),
  limit: z.number().int().min(1).max(500).default(50),
};

export async function dbQuery(args: { sql: string; limit?: number }) {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) return { error: "SUPABASE_DB_URL is not configured" };

  const sql = args.sql.trim();
  const forbidden = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create)\b/i;
  if (forbidden.test(sql)) {
    return { error: "Only read-only queries are allowed (SELECT/WITH)" };
  }

  const pg = await import("pg").catch(() => null);
  if (!pg) return { error: "Postgres driver not installed. Add `pg` to dependencies to enable db_query." };

  const { Client } = pg.default;
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const limited = /limit\s+\d+\s*$/i.test(sql) ? sql : `${sql.replace(/;$/, "")} LIMIT ${args.limit ?? 50}`;
    const res = await client.query(limited);
    return { rows: res.rows, rowCount: res.rowCount, fields: res.fields.map((f) => f.name) };
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    await client.end().catch(() => {});
  }
}
