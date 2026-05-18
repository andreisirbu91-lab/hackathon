import { z } from "zod";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export const browserFetchSchema = {
  url: z.string().url().describe("Absolute URL to fetch"),
  maxChars: z.number().int().min(500).max(50000).default(10000),
};

type Link = { url: string; text: string };

function htmlToMarkdown(html: string): string {
  // Lightweight HTML -> Markdown. Readability already gives us cleaned-up
  // article HTML; convert the common tags to markdown so the agent reads less
  // tag noise.
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*h([1-6])[^>]*>([\s\S]*?)<\s*\/h[1-6]\s*>/gi, (_m, l, t) => "\n" + "#".repeat(Number(l)) + " " + t.replace(/<[^>]+>/g, "") + "\n")
    .replace(/<\s*(strong|b)[^>]*>([\s\S]*?)<\s*\/\s*(strong|b)\s*>/gi, "**$2**")
    .replace(/<\s*(em|i)[^>]*>([\s\S]*?)<\s*\/\s*(em|i)\s*>/gi, "*$2*")
    .replace(/<\s*li[^>]*>([\s\S]*?)<\s*\/li\s*>/gi, "- $1\n")
    .replace(/<\s*a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\s*\/a\s*>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLinks(doc: Document, baseUrl: string, limit = 30): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    let absolute: string;
    try { absolute = new URL(href, baseUrl).toString(); } catch { continue; }
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    const text = (a.textContent ?? "").trim().slice(0, 80);
    if (!text) continue;
    links.push({ url: absolute, text });
    if (links.length >= limit) break;
  }
  return links;
}

export async function browserFetch(args: { url: string; maxChars?: number }) {
  const max = args.maxChars ?? 10000;
  try {
    const res = await fetch(args.url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { url: args.url, ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const dom = new JSDOM(html, { url: args.url });
    const doc = dom.window.document;

    // Readability for the main article
    const article = new Readability(doc).parse();
    const title = article?.title ?? doc.title ?? args.url;
    const byline = article?.byline ?? undefined;
    const cleanHtml = article?.content ?? doc.body?.innerHTML ?? "";
    let markdown = htmlToMarkdown(cleanHtml);

    // Extract links from the FULL doc so we always get nav + outbound links
    const links = extractLinks(doc, args.url, 30);

    const fullChars = markdown.length;
    if (markdown.length > max) markdown = markdown.slice(0, max);

    return {
      url: res.url,
      title,
      byline,
      markdown,
      links,
      chars: fullChars,
      truncated: fullChars > max,
      ok: true,
    };
  } catch (e) {
    return { url: args.url, ok: false, error: (e as Error).message };
  }
}
