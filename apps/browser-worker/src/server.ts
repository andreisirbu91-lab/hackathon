import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 3002);
const HOST = process.env.HOST ?? "::";

(async () => {
  const server = await chromium.launchServer({
    headless: false,
    host: HOST,
    port: PORT,
    wsPath: "/",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  console.log(`[browser-worker] Playwright Chromium server listening on ${server.wsEndpoint()}`);
})().catch((err) => {
  console.error("[browser-worker] fatal:", err);
  process.exit(1);
});
