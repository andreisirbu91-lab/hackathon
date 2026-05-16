import { z } from "zod";

export const webSearchSchema = {
  query: z.string().describe("Search query"),
  count: z.number().int().min(1).max(10).default(5).describe("Number of results"),
};

export async function webSearch(args: { query: string; count?: number }) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return { error: "BRAVE_SEARCH_API_KEY is not configured" };
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
  return { results };
}
