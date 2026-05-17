import { z } from "zod";
import { getPage } from "../browser.js";
import { publishStage } from "../publish.js";

export const navigateSchema = {
  sessionId: z.string().describe("Caller session id (for stage events)").optional(),
  url: z.string().url().describe("URL to navigate to"),
};
export async function browserNavigate(args: { sessionId?: string; url: string }) {
  const page = await getPage();
  await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  const title = await page.title();
  const finalUrl = page.url();
  await publishStage(args.sessionId ?? "", { kind: "browser", action: "navigate", url: finalUrl, at: Date.now() });
  return { url: finalUrl, title };
}

export const clickSchema = {
  sessionId: z.string().optional(),
  selector: z.string().describe("CSS or text= selector"),
};
export async function browserClick(args: { sessionId?: string; selector: string }) {
  const page = await getPage();
  await page.click(args.selector, { timeout: 10000 });
  await publishStage(args.sessionId ?? "", { kind: "browser", action: "click", at: Date.now() });
  return { ok: true, url: page.url() };
}

export const typeSchema = {
  sessionId: z.string().optional(),
  selector: z.string(),
  text: z.string(),
  submit: z.boolean().default(false),
};
export async function browserType(args: { sessionId?: string; selector: string; text: string; submit?: boolean }) {
  const page = await getPage();
  await page.fill(args.selector, args.text);
  if (args.submit) await page.press(args.selector, "Enter");
  await publishStage(args.sessionId ?? "", { kind: "browser", action: "type", at: Date.now() });
  return { ok: true, url: page.url() };
}

export const screenshotSchema = {
  sessionId: z.string().optional(),
  fullPage: z.boolean().default(false),
};
export async function browserScreenshot(args: { sessionId?: string; fullPage?: boolean }) {
  const page = await getPage();
  const buf = await page.screenshot({ fullPage: args.fullPage ?? false, type: "png" });
  const url = page.url();
  // CRITICAL: never return the base64 to the model — a single 300KB PNG explodes
  // the context to ~400k tokens. Instead, publish the screenshot as a markdown
  // artifact on the right pane so the audience sees it, and return only metadata
  // to the model.
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  await publishStage(args.sessionId ?? "", {
    kind: "artifact",
    id: `shot-${Date.now()}`,
    type: "markdown",
    props: {
      title: `Screenshot: ${url}`,
      content: `![screenshot](${dataUrl})`,
    },
    at: Date.now(),
  });
  return {
    url,
    bytes: buf.byteLength,
    rendered_to_stage: true,
    note: "The screenshot is now visible to the user on the right pane. The image is NOT included in this tool result to keep your context manageable. Continue based on what you can infer from the page URL and prior tool calls.",
  };
}
