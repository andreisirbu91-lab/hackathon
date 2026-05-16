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
  return {
    url: page.url(),
    data_url: `data:image/png;base64,${buf.toString("base64")}`,
  };
}
