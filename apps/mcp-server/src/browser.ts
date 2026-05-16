import { chromium, type Browser, type Page } from "playwright";

const WS_ENDPOINT = process.env.BROWSER_PLAYWRIGHT_WS ?? "ws://localhost:3002";

let _browser: Browser | null = null;
let _page: Page | null = null;

export async function getPage(): Promise<Page> {
  if (_page && !_page.isClosed()) return _page;
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.connect(WS_ENDPOINT, { timeout: 10000 });
  }
  const contexts = _browser.contexts();
  const context = contexts[0] ?? (await _browser.newContext({ viewport: { width: 1280, height: 800 } }));
  const pages = context.pages();
  _page = pages[0] ?? (await context.newPage());
  return _page;
}
