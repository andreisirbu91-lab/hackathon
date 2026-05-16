# hackaton-stack

> Agentic AI demo platform for **Hack A Ton 2026**. Chat with an Anthropic-powered agent on the left, watch it act in real time on the right: a real headed Chromium that the audience sees navigate live, generative UI artifacts (charts, tables, kanban, maps), and a tool-call timeline that shows the reasoning.

**Live:** [https://hack.rzs-it.ro](https://hack.rzs-it.ro) · **Browser pane:** [https://browser.hack.rzs-it.ro/vnc.html](https://browser.hack.rzs-it.ro/vnc.html)

---

## TL;DR — Why this wins

In a 5-minute demo against 30 other chat UIs, judges remember **agents that visibly do things**.
This stack ships with a 2-pane UI where:

- **Left** is the chat with the model (Claude Sonnet 4.6 via the Anthropic API).
- **Right** is the agent's *stage* — automatically switches between **a real browser**, **generative React artifacts**, **a raw code view**, and **a live tool-call timeline** depending on what the agent is doing at that moment.

The whole thing is wired around the **Model Context Protocol (MCP)** — every tool the agent uses (web search, browser actions, artifact rendering, SQL queries) is a real MCP tool served from a dedicated MCP server. So during the hackathon we only have to add 3-5 challenge-specific MCP tools and update the system prompt.

---

## Architecture (live)

```
┌─────────────────────────────┬─────────────────────────────────┐
│  ChatPane (chat)            │  StagePane (live agent view)    │
│  - Anthropic SSE streaming  │  Auto-switches between:         │
│  - Tool-call bubbles inline │  • Browser   (noVNC iframe)     │
│  - Markdown rendering       │  • Artifact  (React renderers)  │
│                             │  • Code      (raw tool output)  │
│                             │  • Timeline  (all tool calls)   │
└──────────┬──────────────────┴────────────────┬────────────────┘
           │ POST /api/chat (SSE)               │ GET /api/events (SSE)
           ▼                                    ▼
       ┌─────────────────────────────────────────────┐
       │ Next.js 15 (apps/web)                       │
       │ - lib/agent-loop.ts: Anthropic tool-use     │
       │ - lib/mcp-client.ts: HTTP streamable MCP    │
       │ - lib/event-bus.ts: Redis pub/sub fan-out   │
       └────────┬──────────────────────┬─────────────┘
                │ MCP HTTP              │ WS (Playwright CDP)
                ▼                       ▼
        ┌──────────────────┐    ┌──────────────────────┐
        │ MCP server       │───▶│ Browser worker       │
        │ (apps/mcp-server)│    │ Playwright + Xvfb    │
        │ 7 tools          │    │ + x11vnc + noVNC     │
        └──────────────────┘    └──────────────────────┘
                │
                ▼
        ┌──────────────────┐    ┌──────────────────┐
        │ Postgres         │    │ Redis            │
        │ (db_query tool)  │    │ (event bus)      │
        └──────────────────┘    └──────────────────┘
```

All four services run on the same VPS in a single `docker-compose.prod.yml`, attached to the existing **Coolify** docker network. Coolify's bundled **Traefik** handles TLS via Let's Encrypt for both `hack.rzs-it.ro` (web) and `browser.hack.rzs-it.ro` (noVNC viewer). The MCP server and Postgres stay internal — only reachable from inside the docker network.

---

## What's in each service

### `apps/web` — Next.js 15 App Router (TypeScript)

| File | Purpose |
|---|---|
| `app/api/chat/route.ts` | POST endpoint. Streams the agent loop as SSE: text deltas, tool_call_start/end, errors, done. |
| `app/api/events/route.ts` | GET endpoint. Subscribes to Redis `stage:<sessionId>` channel and forwards to the client. Drives the right pane. |
| `app/api/health/route.ts` | Reports Anthropic key presence, MCP tool count, Redis ping, browser configuration. Used by the deploy health check. |
| `lib/anthropic.ts` | Anthropic SDK client + system prompt with inline tool schemas. |
| `lib/agent-loop.ts` | The tool-use loop: stream → collect tool_use blocks → call MCP → feed tool_result back → repeat (max 12 steps). |
| `lib/mcp-client.ts` | One persistent `@modelcontextprotocol/sdk` client per process, talks streamable HTTP to the MCP server. |
| `lib/event-bus.ts` | ioredis wrappers around the `stage:<sessionId>` pub/sub channel. |
| `lib/artifact-schema.ts` | Zod schemas for the 6 artifact types (chart, table, kanban, map, markdown, iframe). |
| `components/chat/*` | ChatPane, MessageList, Composer, ToolCallBubble (collapsible). |
| `components/stage/*` | StagePane (tabs), BrowserView (noVNC iframe), ArtifactView (recharts/markdown/etc), CodeView, Timeline. |

### `apps/mcp-server` — Express + `@modelcontextprotocol/sdk` (TypeScript)

Streamable HTTP transport with proper session tracking (`Mcp-Session-Id` header). 7 tools shipped:

| Tool | Description |
|---|---|
| `web_search(query, count?)` | Brave Search API. Returns title/url/snippet. |
| `browser_navigate(url)` | Drive the headed Chromium to a URL. Audience sees it. |
| `browser_click(selector)` | Click a CSS or text= selector. |
| `browser_type(selector, text, submit?)` | Type into an input, optionally press Enter. |
| `browser_screenshot(fullPage?)` | PNG screenshot as a data URL. |
| `render_artifact(type, props)` | Push a typed React artifact onto the stage (chart/table/kanban/map/markdown/iframe). |
| `db_query(sql, limit?)` | Read-only Postgres (SELECT/WITH only, regex guard). |

### `apps/browser-worker` — Playwright + Xvfb + x11vnc + noVNC

Custom `tsx` entrypoint (`src/server.ts`) calls `chromium.launchServer({ host: "::", port: 3002 })` so the WebSocket endpoint accepts both IPv4 and IPv6 (Docker's coolify network returns IPv6 ULA from DNS, the default Playwright CLI binds to `localhost` only — gotcha that took an hour to find). Xvfb on `:99`, x11vnc on `:5900`, websockify (which both serves noVNC HTML and proxies WS to VNC) on `:6080`. Traefik exposes `:6080` at `browser.hack.rzs-it.ro` so the iframe in the right pane shows the live browser.

### Postgres + Redis

Dedicated containers (`hackaton-postgres`, `hackaton-redis`) on a named volume + the coolify network. Postgres password is stored in `/opt/hackaton-stack/.env`; the MCP server reads `SUPABASE_DB_URL` constructed in compose from that password.

---

## CI/CD

`.github/workflows/deploy.yml`:

1. **Build matrix** (parallel): all 3 images → `ghcr.io/andreisirbu91-lab/hackathon-{web,mcp,browser}:latest`. GHA cache scoped per service. Pushes built artifacts as a side-effect.
2. **Deploy job** (after build): SSH into the VPS using `webfactory/ssh-agent`, SCP the production compose file to `/opt/hackaton-stack/`, then `docker compose pull && docker compose up -d --force-recreate`.
3. **Health check**: poll `https://hack.rzs-it.ro/api/health` until 200.

Secrets used: `VPS_HOST`, `VPS_USER`, `VPS_KNOWN_HOSTS`, `VPS_SSH_KEY` (ed25519 deploy key), `CR_PAT` (PAT with `read:packages` for the VPS to pull from GHCR).

Workflow strips whitespace from `VPS_USER`/`VPS_HOST` before use (paste-from-browser ate a newline more than once).

---

## Local dev

```bash
cp .env.example .env
# fill ANTHROPIC_API_KEY and (optional) BRAVE_SEARCH_API_KEY
docker compose up --build
open http://localhost:3000
# noVNC viewer for local dev:
open http://localhost:6080/vnc.html?autoconnect=1
```

---

## Customizing for a sponsor challenge during the hackathon

| Goal | File | What to change |
|---|---|---|
| Change agent persona / objective | `apps/web/lib/anthropic.ts` | `SYSTEM_PROMPT` |
| Add new tool the agent can call | `apps/mcp-server/src/tools/*.ts` + register in `index.ts` | Define schema + handler |
| Add a new artifact type | `apps/web/lib/artifact-schema.ts` + `components/stage/ArtifactView.tsx` | Add Zod variant + renderer |
| Restrict / replace data source | `apps/mcp-server/src/tools/db_query.ts` | Already read-only; swap connection string |
| Re-skin | `apps/web/app/globals.css` + `tailwind.config.ts` colors block + `app/page.tsx` brand | Logo, copy, palette |

---

## Live Q&A — what to tell the judges

**Întrebare:** *Ce face mai exact?*
> E un *agentic AI workstation* generic. Pe stânga vorbești cu Claude. Pe dreapta vezi în timp real cât face agentul — browser real care navighează, chart-uri și tabele generate de el, timeline cu fiecare tool call. Demo-ul de astăzi îți arată challenge-ul X, dar template-ul merge pentru oricare din cele 15 challenges ale sponsorilor.

**Întrebare:** *De ce e diferit de alt chat?*
> Pentru că nu e doar chat. Tools-urile sunt servite printr-un **MCP server** propriu, cu transport HTTP streamable — același protocol pe care Anthropic l-a deschis luna trecută pentru integrare cu Claude Desktop. Înseamnă că pot să adaug 5 tools noi în 30 de minute și agentul le folosește imediat. Plus, browser-ul nu e screenshot poll — e un container Playwright cu Xvfb + noVNC, audiența vede cursorul real cum se mișcă.

**Întrebare:** *Cât a durat să construiți template-ul?*
> Vreo 4 ore de pre-work la rece — Next.js 15, MCP server, Playwright + Xvfb, docker-compose, Coolify deploy, GitHub Actions cu build matrix pe GHCR. În timpul hackathon-ului am scris doar logic-ul specific challenge-ului ales (3-5 tools custom + system prompt + skin).

**Întrebare:** *Cum scalează / cum o duci în producție?*
> 4 containere stateless (web, MCP, browser, Postgres + Redis) într-un singur compose. Traefik face TLS, Coolify orchestrează. Pentru multi-tenant adăugăm un browser worker per sesiune (Playwright server poate spawna multiple contexts). Postgres + Redis sunt rolă jucate de Supabase deja existent sau Neon dacă vrem cloud-managed. Pentru cost: tot demo-ul rulează pe un VPS Hetzner de €30/lună plus Anthropic API care e pay-per-token.

**Întrebare:** *Cât v-a costat un demo run?*
> Vreo $0.02 pe interacțiune medie (Sonnet 4.6 input + output + ~3 tool calls). Brave Search are 1000 căutări/lună free. Hosting-ul pe VPS-ul propriu e cost fix.

**Întrebare:** *Ce nu am avut timp să facem și aș face dacă mai aveam o zi?*
- Generative UI streaming progresivă (artifact-ul să apară pe măsură ce agentul îl construiește, nu doar la final).
- Multi-session: în prezent un browser worker e shared per VPS — pentru producție un container per user session via Kubernetes/Docker Swarm.
- Voice in cu Realtime API (toggle pe care îl pornesc dacă judecătorii vor să încerce ei).

**Întrebare:** *Open source?*
> Da, repo-ul e [github.com/andreisirbu91-lab/hackathon](https://github.com/andreisirbu91-lab/hackathon). Plus, e gândit ca **template** — alți participanți de la hackathoanele viitoare pot lua repo-ul, schimbă prompt-ul și tools-urile, e ready-to-deploy în Coolify în 15 minute.

---

## Notable engineering decisions

- **Anthropic SDK directly, not Vercel AI SDK.** We need precise control over the SSE event stream so the right pane can react to specific tool events (`tool_call_start`, `artifact`, `browser`). Vercel AI SDK adds an abstraction we didn't need.
- **MCP via HTTP streamable, not stdio.** Each service is its own container. HTTP lets us scale the MCP server independently and reuse the same protocol both internally and (potentially) externally for Claude Desktop / Cursor clients to plug into.
- **Redis pub/sub for stage events.** Tool calls in the MCP server (e.g., `render_artifact`, `browser_navigate`) publish events directly to a per-session channel. The Next.js `/api/events` SSE endpoint subscribes. Decouples the agent loop from the UI completely — we could fan out to multiple viewers later.
- **noVNC iframe instead of screenshot polling.** A real Chromium with x11vnc gets us cursor movement, animations, scroll, video — anything that runs in the browser. Polling screenshots would feel choppy and miss the human-grade "magic" judges look for.
- **Mirror flowdeskone's GHCR + SSH deploy.** Skipped Coolify "Application" creation: the same VPS already runs flowdeskone with a `docker-compose.prod.yml` that has Traefik labels but isn't registered with Coolify. We do the same pattern for faster iteration and zero coupling to Coolify's app lifecycle.

---

## Files modified most during the hackathon (priority)

1. `apps/web/lib/anthropic.ts` — system prompt + persona.
2. `apps/mcp-server/src/tools/*.ts` — challenge-specific tools.
3. `apps/web/components/stage/ArtifactView.tsx` — challenge-specific artifact types.
4. `apps/web/app/page.tsx` — branding, hero copy.
