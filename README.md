# hackaton-stack

> Platformă demo de agenți AI pentru **Hack A Ton 2026**. În stânga vorbești cu un agent Anthropic. În dreapta vezi în timp real ce face: un Chromium real care navighează live (audiența îl vede), artefacte UI generate de agent (charturi, tabele, kanban, hărți) și un timeline de tool calls care arată raționamentul.

**Live:** [https://hack.rzs-it.ro](https://hack.rzs-it.ro) · **Browser pane:** [https://browser.hack.rzs-it.ro/vnc.html](https://browser.hack.rzs-it.ro/vnc.html)

---

## TL;DR — De ce câștigăm

Într-un demo de 5 minute împotriva a 30 de chat UI-uri, jurații își amintesc **agenții care fac lucruri vizibile**.

Stack-ul are 2 panouri:
- **Stânga** — chat cu Claude Sonnet 4.6 (Anthropic API).
- **Dreapta** — *scena* agentului, comută automat între **un browser real**, **artefacte React generate live**, **view de cod brut** și **timeline de tool calls** în funcție de ce face agentul în acel moment.

Tot e construit pe **Model Context Protocol (MCP)** — fiecare tool (web search, browser, render artifact, SQL) e expus ca tool MCP. În timpul hackathon-ului adăugăm 3-5 tool-uri specifice challenge-ului ales și schimbăm system prompt-ul.

---

## Arhitectură

```
┌─────────────────────────────┬─────────────────────────────────┐
│  ChatPane (chat)            │  StagePane (live agent view)    │
│  - SSE streaming Anthropic  │  Auto-switch între:             │
│  - Tool-call bubbles inline │  • Browser   (noVNC iframe)     │
│  - Markdown rendering       │  • Artifact  (React renderers)  │
│                             │  • Code      (raw tool output)  │
│                             │  • Timeline  (toate tool calls) │
└──────────┬──────────────────┴────────────────┬────────────────┘
           │ POST /api/chat (SSE)               │ GET /api/events (SSE)
           ▼                                    ▼
       ┌─────────────────────────────────────────────┐
       │ Next.js 15 (apps/web)                       │
       │ - lib/agent-loop.ts: bucla Anthropic tool   │
       │ - lib/mcp-client.ts: HTTP streamable MCP    │
       │ - lib/event-bus.ts: Redis pub/sub fan-out   │
       └────────┬──────────────────────┬─────────────┘
                │ MCP HTTP              │ WS (Playwright)
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
        │ (tool db_query)  │    │ (event bus)      │
        └──────────────────┘    └──────────────────┘
```

Toate cele 4 servicii rulează pe VPS într-un singur `docker-compose.prod.yml`, atașate la rețeaua docker `coolify` existentă. **Traefik** (deja pornit de Coolify) face TLS-ul via Let's Encrypt pentru `hack.rzs-it.ro` (web) și `browser.hack.rzs-it.ro` (viewer noVNC). MCP server și Postgres rămân interne — accesibile doar din rețeaua docker.

---

## Ce e în fiecare serviciu

### `apps/web` — Next.js 15 App Router (TypeScript)

| Fișier | Rol |
|---|---|
| `app/api/chat/route.ts` | Endpoint POST. Streameză bucla agentului ca SSE: text deltas, tool_call_start/end, erori, done. |
| `app/api/events/route.ts` | Endpoint GET. Se abonează la Redis `stage:<sessionId>` și forwardează la client. Drive-uiește panoul drept. |
| `app/api/health/route.ts` | Raportează prezența cheii Anthropic, numărul de tool-uri MCP, ping Redis, browser config. Health check de deploy. |
| `lib/anthropic.ts` | Client Anthropic SDK + system prompt cu reguli anti-halucinație și scheme inline pentru tools. |
| `lib/agent-loop.ts` | Bucla de tool use: stream → adună tool_use blocks → cheamă MCP → trimite înapoi tool_result → repetă (max 12 pași). |
| `lib/mcp-client.ts` | Un client `@modelcontextprotocol/sdk` persistent per proces, vorbește streamable HTTP cu MCP server-ul. |
| `lib/event-bus.ts` | Wrappere ioredis peste canalul pub/sub `stage:<sessionId>`. |
| `lib/artifact-schema.ts` | Scheme Zod pentru cele 6 tipuri de artefacte (chart, table, kanban, map, markdown, iframe). |
| `lib/stage-store.ts` | Reducer client-side care primește event-uri SSE, ține istoricul de tool calls + artefacte și decide tab-ul activ. |
| `components/chat/*` | ChatPane, MessageList, Composer, ToolCallBubble (collapsible). |
| `components/stage/*` | StagePane (tabs), BrowserView (noVNC iframe), ArtifactView (recharts/markdown/etc), CodeView, Timeline. |

### `apps/mcp-server` — Express + `@modelcontextprotocol/sdk`

Transport streamable HTTP cu session tracking proper (header `Mcp-Session-Id`). 7 tools livrate:

| Tool | Descriere |
|---|---|
| `web_search(query, count?)` | Brave Search API. Returnează title/url/snippet. |
| `browser_navigate(url)` | Conduce Chromium headed la un URL. Audiența vede live. |
| `browser_click(selector)` | Click pe selector CSS sau `text=`. |
| `browser_type(selector, text, submit?)` | Tastează în input, opțional apasă Enter. |
| `browser_screenshot(fullPage?)` | PNG screenshot ca data URL. |
| `render_artifact(type, props)` | Push un artefact React tipat pe scenă (chart/table/kanban/map/markdown/iframe). |
| `db_query(sql, limit?)` | Postgres read-only (doar SELECT/WITH, regex guard). |

### `apps/browser-worker` — Playwright + Xvfb + x11vnc + noVNC

Entrypoint custom `tsx` (`src/server.ts`) care apelează `chromium.launchServer({ host: "::", port: 3002, wsPath: "/" })` ca:
- WebSocket-ul să răspundă atât pe IPv4 cât și pe IPv6 (rețeaua docker `coolify` returnează IPv6 ULA din DNS — CLI-ul implicit Playwright bindează doar pe `localhost`, gotcha care ne-a luat o oră).
- Path-ul WS să fie fix `/` (default-ul Playwright generează un GUID random ca security default).

Xvfb pe `:99`, x11vnc pe `:5900`, websockify (servește noVNC HTML + proxy WS la VNC) pe `:6080`. Traefik expune `:6080` la `browser.hack.rzs-it.ro` ca iframe-ul din panoul drept să arate browser-ul live.

### Postgres + Redis

Containere dedicate (`hackaton-postgres`, `hackaton-redis`) pe volum nume + rețeaua coolify. Parola Postgres e în `/opt/hackaton-stack/.env`; MCP server citește `SUPABASE_DB_URL` construit în compose din acea parolă.

---

## CI/CD

`.github/workflows/deploy.yml`:

1. **Build matrix** (paralel): 3 imagini → `ghcr.io/andreisirbu91-lab/hackathon-{web,mcp,browser}:latest`. Cache GHA per serviciu.
2. **Deploy job** (după build): SSH în VPS via `webfactory/ssh-agent`, SCP compose-ul de prod la `/opt/hackaton-stack/`, apoi `docker compose pull && docker compose up -d --force-recreate`.
3. **Health check**: poll la `https://hack.rzs-it.ro/api/health` până la 200.

`.github/workflows/ci.yml` (parallel cu deploy): typecheck + build pentru web și mcp-server, ca să primim feedback rapid pe PR-uri.

Secrets folosite: `VPS_HOST`, `VPS_USER`, `VPS_KNOWN_HOSTS`, `VPS_SSH_KEY` (cheie ed25519), `CR_PAT` (PAT cu `read:packages` ca VPS-ul să pull din GHCR).

Workflow-ul face strip la whitespace din `VPS_USER`/`VPS_HOST` înainte de folosire (paste-ul din browser a mâncat o linie nouă mai des de o dată).

---

## Dev local

```bash
cp .env.example .env
# completează ANTHROPIC_API_KEY și (opțional) BRAVE_SEARCH_API_KEY
docker compose up --build
open http://localhost:3000
# Viewer noVNC pentru dev local:
open http://localhost:6080/vnc.html?autoconnect=1
```

---

## Customizare pentru un sponsor challenge în timpul hackathon-ului

| Scop | Fișier | Ce schimbi |
|---|---|---|
| Personă/obiectiv agent | `apps/web/lib/anthropic.ts` | `SYSTEM_PROMPT` |
| Tool nou disponibil agentului | `apps/mcp-server/src/tools/*.ts` + înregistrare în `index.ts` | Schema + handler |
| Tip nou de artefact | `apps/web/lib/artifact-schema.ts` + `components/stage/ArtifactView.tsx` | Variantă Zod + renderer |
| Restricționează/înlocuiește sursa de date | `apps/mcp-server/src/tools/db_query.ts` | Deja read-only; schimbi connection string |
| Re-skin | `apps/web/app/globals.css` + culori `tailwind.config.ts` + brand `app/page.tsx` | Logo, copy, paletă |

---

## Live Q&A — ce le spui jurătorilor

**Q:** *Ce face mai exact?*

> E un *agentic AI workstation* generic. În stânga vorbești cu Claude. În dreapta vezi în timp real cât face agentul — browser real care navighează, chart-uri și tabele generate de el, timeline cu fiecare tool call. Demo-ul de astăzi îți arată challenge-ul X, dar template-ul merge pentru oricare din cele 15 challenges ale sponsorilor.

**Q:** *Cu ce e diferit față de un alt chat?*

> Nu e doar chat. Tool-urile sunt servite printr-un **MCP server** propriu, cu transport HTTP streamable — același protocol pe care Anthropic l-a deschis pentru integrare cu Claude Desktop. Pot să adaug 5 tools noi în 30 de minute și agentul le folosește imediat. Plus, browser-ul nu e screenshot poll — e un container Playwright cu Xvfb + noVNC, audiența vede cursorul real cum se mișcă în timp real.

**Q:** *Cât a durat construirea template-ului?*

> Vreo 4 ore de pre-work la rece — Next.js 15, MCP server, Playwright + Xvfb, docker-compose, deploy via Coolify Traefik, GitHub Actions cu build matrix pe GHCR. În timpul hackathon-ului scriem doar logic-ul specific challenge-ului ales (3-5 tools custom + system prompt + skin).

**Q:** *Cum scalează / cum o duci în producție?*

> 4 containere stateless (web, MCP, browser, Postgres + Redis) într-un singur compose. Traefik face TLS, Coolify orchestrează. Pentru multi-tenant adăugăm un browser worker per sesiune. Postgres + Redis sunt jucat de Supabase deja existent sau Neon dacă vrem cloud-managed. Cost: tot demo-ul rulează pe un VPS Hetzner de €30/lună plus Anthropic API care e pay-per-token.

**Q:** *Cât costă un demo run?*

> Vreo $0.02 pe interacțiune medie (Sonnet 4.6 input + output + ~3 tool calls). Brave Search are 1000 căutări/lună free. Hosting-ul pe VPS-ul nostru e cost fix.

**Q:** *Cum ne asigurăm că agentul nu inventează?*

> Sistem prompt cu reguli stricte: training data e tratată ca *unreliable* pentru entități real-world. Pentru orice recomandare (restaurante, ore, prețuri) e obligat să facă `web_search` întâi și să citeze sursa. Dacă search-ul nu returnează nimic, e instruit să spună "n-am găsit" în loc să inventeze. Plus, putem face `browser_navigate` ca să verifice site-ul real al unei afaceri înainte să recomandăm.

**Q:** *Ce n-ai avut timp să faci și ai face cu încă o zi?*

- Generative UI streaming progresivă (artefactul să apară pe măsură ce agentul îl construiește).
- Multi-session: în prezent browser worker e shared per VPS — pentru prod, un container per user session via Kubernetes/Swarm.
- Voice in cu Realtime API (toggle pe care îl pornesc dacă judecătorii vor să încerce ei).
- Persistență sesiune (refresh-ul pierde state-ul; ar fi trebuit Supabase + auth pentru chat history).

**Q:** *Open source?*

> Da, repo-ul e [github.com/andreisirbu91-lab/hackathon](https://github.com/andreisirbu91-lab/hackathon). Plus, e gândit ca **template** — alți participanți la hackathoane viitoare pot lua repo-ul, schimbă prompt-ul și tools-urile, e ready-to-deploy pe Coolify în 15 minute.

---

## Decizii inginerești notabile

- **Anthropic SDK direct, nu Vercel AI SDK.** Avem nevoie de control precis pe stream-ul SSE ca panoul drept să reacționeze la eventuri specifice (`tool_call_start`, `artifact`, `browser`). Vercel AI SDK adaugă o abstracție de care n-avem nevoie.
- **MCP via HTTP streamable, nu stdio.** Fiecare serviciu e container separat. HTTP ne lasă să scalăm MCP server-ul independent și să refolosim același protocol intern și (eventual) extern pentru clienți Claude Desktop / Cursor.
- **Redis pub/sub pentru stage events.** Tool calls în MCP server (ex: `render_artifact`, `browser_navigate`) publică direct pe canalul session-ului. Endpoint-ul SSE `/api/events` din Next.js se abonează. Decuplează complet bucla agentului de UI — putem fan-out la mai mulți viewers ulterior.
- **noVNC iframe în loc de screenshot polling.** Chromium real cu x11vnc ne dă mișcarea cursorului, animații, scroll, video — orice rulează în browser. Polling de screenshots ar fi sacadat și ar rata acel "magic" pe care îl caută jurătorii.
- **Mirror la patternul flowdeskone GHCR + SSH deploy.** Sărim peste crearea unei Coolify "Application": același VPS rulează deja flowdeskone cu un `docker-compose.prod.yml` care are label-uri Traefik dar nu e înregistrat în Coolify. Facem același pattern pentru iterație mai rapidă și cuplaj zero cu Coolify app lifecycle.

---

## Bug-uri găsite și fixate în timpul setup-ului (pentru memoria viitoare)

1. **npm workspaces hoist** — `workspaces: ["apps/*"]` în root `package.json` făcea ca `cd apps/web && npm install` să hoist-uiască la root, lăsând `apps/web/node_modules` gol → CI typecheck a eșuat cu "Cannot find module 'react'". Fix: fiecare app e standalone, lockfile per-app.
2. **Empty `public/` directory** — git nu trackuiește directoare goale, deci docker build n-avea `/app/public` pentru `COPY` în multi-stage. Fix: `.gitkeep`.
3. **SSH line continuation** — `ssh user@host \` + `'mkdir...'` pe linia următoare era rupt de whitespace YAML invizibil → bash trata ssh fără argumente și apoi încerca să execute string-ul `'mkdir...'` ca o comandă. Fix: heredoc `bash -s <<'REMOTE'`.
4. **Secrets cu newline** — `VPS_HOST` paste din browser includea `\n` → `ssh "$VPS_USER@$VPS_HOST"` zicea "hostname contains invalid characters". Fix: `tr -d '[:space:]'` înainte de folosire.
5. **MCP sesiune neinițializată** — fiecare POST /mcp crea un server + transport nou, deci `initialize` ajungea pe transport A, `listTools` pe transport B → "Server not initialized". Fix: tracking de sesiuni prin `Mcp-Session-Id` header.
6. **Playwright bindează doar IPv6 localhost** — `npx playwright run-server` default leagă pe `::1` ; rețeaua docker coolify rezolvă `hackaton-browser` la IPv6 ULA care nu e localhost → ECONNREFUSED. Fix: script custom `chromium.launchServer({host: "::"})`.
7. **Playwright version mismatch** — `npm install` a rezolvat `^1.50.0` la 1.60.0 dar Dockerfile încă pe `mcr.microsoft.com/playwright:v1.50.0-noble` (binar chromium incompatibil). Fix: bump base image la `v1.60.0-noble`.
8. **WS path GUID** — `chromium.launchServer` generează un path random ca security default, dar clientul MCP se conecta la `ws://hackaton-browser:3002` fără path. Fix: `wsPath: "/"` (sigur pentru că port-ul nu e expus în afara rețelei docker).
9. **Hallucination** — agent a recomandat "restaurant Bouzuki" care e închis de ani de zile (training data stale). Fix: reguli stricte anti-hallucination în system prompt — `web_search` obligatoriu pentru orice recomandare real-world.

---

## Fișiere modificate cel mai des în timpul hackathon-ului (prioritate)

1. `apps/web/lib/anthropic.ts` — system prompt + persona.
2. `apps/mcp-server/src/tools/*.ts` — tools specifice challenge-ului.
3. `apps/web/components/stage/ArtifactView.tsx` — tipuri custom de artifact.
4. `apps/web/app/page.tsx` — branding, hero copy.
