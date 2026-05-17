import { z } from "zod";

export const webSearchSchema = {
  query: z.string().describe("Search query"),
  count: z.number().int().min(1).max(10).default(5).describe("Number of results"),
};

// In-memory cache: same (query, count) within TTL returns the cached result.
// Cheap defense against the agent calling web_search 3× with identical args
// in the same turn.
type CacheEntry = { at: number; payload: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > TTL_MS) cache.delete(k);
}

export async function webSearch(args: { query: string; count?: number }) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return { error: "BRAVE_SEARCH_API_KEY is not configured" };
  }
  pruneCache();
  const cacheKey = `${args.query}::${args.count ?? 5}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ...(hit.payload as object), cached: true, age_ms: Date.now() - hit.at };
  }
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", args.query);
  url.searchParams.set("count", String(args.count ?? 5));

  const res = await fetch(url, {
    headers: { "X-Subscription-Token": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    return { error: `Brave Search HTTP ${res.status}` };
  }
  const data = (await res.json()) as {
    web?: { results?: Array<{ title: string; url: string; description: string }> };
  };
  const results = (data.web?.results ?? []).slice(0, args.count ?? 5).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
  const payload = { results };
  cache.set(cacheKey, { at: Date.now(), payload });
  return payload;
}
