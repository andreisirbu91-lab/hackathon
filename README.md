# hackaton-stack

Agentic AI template for Hack A Ton 2026 — Anthropic chat (left) + live agent stage (right: real browser, generative artifacts, tool-call timeline).

## Quick start

```bash
cp .env.example .env       # fill ANTHROPIC_API_KEY and BRAVE_SEARCH_API_KEY
docker compose up --build
open http://localhost:3000
```

## Layout

```
apps/
  web/             Next.js 15 (chat + stage, Anthropic SDK, MCP client)
  mcp-server/      MCP server (HTTP streamable transport, 4 skeleton tools)
  browser-worker/  Playwright + Xvfb + noVNC (port 6080) + CDP (port 9222)
```

## What's wired

- Streaming chat via `/api/chat` (SSE) with Anthropic tool use loop.
- MCP server exposes: `web_search`, `browser_navigate/click/type/screenshot`, `render_artifact`, `db_query`.
- Browser worker runs a headed Chromium, visible via noVNC iframe in the right pane.
- Redis pub/sub event bus (`stage:tools`, `stage:artifact`, `stage:browser`) drives the StagePane updates.

## Customize per challenge

| File | What to change |
|---|---|
| `apps/web/lib/anthropic.ts` | System prompt + agent persona |
| `apps/mcp-server/src/tools/` | Add 3–5 challenge-specific tools |
| `apps/web/components/stage/ArtifactView.tsx` | Add custom artifact renderers |
| `apps/web/app/page.tsx` | Branding, hero copy |

## Deploy (Coolify on VPS)

Push to `main` → GitHub Actions runs CI → on success, posts to Coolify deploy webhook → Coolify pulls + builds + serves at `hack.rzs-it.ro` (web) and `browser.hack.rzs-it.ro` (noVNC).
