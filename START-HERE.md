# ⚠️ READ THIS FIRST — ReplyFlow handoff

You are resuming work on **ReplyFlow**, a complete omnichannel customer-support CRM.
Everything is built, tested, and committed. **One step remains: pushing to GitHub.**

Repo: <https://github.com/ajmalshareen-maker/CRM-> — public, branch `main`, empty.

---

## 1. Restore the project (do this first)

This archive is a self-extracting bundle of the **entire project including full git
history** (2 commits, branch `main`). Extract it:

```bash
mkdir -p /home/user && cd /home/user
tail -c +<OFFSET> REPLYFLOW-PROJECT.sh | tar xzf -      # see §1b for offset
# or simply:
bash REPLYFLOW-PROJECT.sh
```

`bash REPLYFLOW-PROJECT.sh` extracts everything into the current directory,
including `.git/`, so no `git init` is needed.

Then verify:

```bash
cd /home/user && git log --oneline && git ls-files | wc -l    # expect 2 commits, 55 files
```

## 2. Reinstall dependencies (they are NOT in the archive)

`node_modules` is excluded on purpose. After extracting:

```bash
cd /home/user
npm install                     # ~2 min, 242 packages
npx tsc --noEmit                # expect clean
npm run build                   # builds dist/
npm start                       # serves on :4000
```

Confirm it runs before pushing:

```bash
curl -s localhost:4000/api/health        # {"ok":true,"ai":"local",...}
```

## 3. Push to GitHub — the only remaining task

The GitHub connector **was unavailable** in the previous session
(`list_connector_tools('github')` → `unsupported`). If it is now connected, use it.
Otherwise use a token:

```bash
cd /home/user
./push-to-github.sh <github-token>
```

The script verifies the token, pushes `main`, then strips the token from
`.git/config`. Token needs classic **`repo`** scope (or fine-grained
*Contents: Read and write*). Create one at <https://github.com/settings/tokens/new>.

**Do not re-create the commit.** The history already exists; just push it.

---

## What the project is

**ReplyFlow — "Every Conversation. One Workspace."**
Express 5 + better-sqlite3 API, React 19 + TypeScript + Vite + Tailwind v4 SPA.

- **Auth**: bcrypt, httpOnly cookie sessions **plus a Bearer-token fallback** for
  cookie-blocked environments (sandboxed iframes). `Secure` flag is derived from the
  real request protocol, not `NODE_ENV` — this fixed a "login does nothing" bug.
- **Tenancy**: every query scoped by `org_id`. 5 roles enforced server-side.
- **15 routes**: dashboard, inbox, conversations, tickets, customers, companies, AI,
  automations, reports, knowledge, integrations, team, settings, widget, public help.
- **Integrations**: 22, with honest states `connected / demo / needs_config /
  awaiting_approval / available`. Never fabricates a connection.
- **AI**: local deterministic engine, labelled as such. Never auto-sends.
- **Widget**: embeddable, creates real inbox conversations.

**Demo login**: `amina@northwind.io` / `replyflow` (admin).
Also `daniel@northwind.io` (agent), `sam@northwind.io` (read-only).

## Files worth knowing

```
server/index.js        REST API (~1000 lines), auth, RBAC, all endpoints
server/db/schema.sql   SQLite schema
server/seed.js         demo data generator (45 conversations, 20 tickets, 24 customers)
server/ai.js           local intent playbooks + LLM passthrough
server/widget.js       embeddable widget bundle
src/lib/api.ts         fetch wrapper + session/token handling
src/lib/store.tsx      auth + realtime providers
src/pages/             16 page components
tests/                 Playwright suites — see below
data/replyflow.db      pre-seeded SQLite database (committed)
```

## Verification status at handoff

- `npx tsc --noEmit` → clean
- `npx vite build` → succeeds (~1.5s)
- `tests/login-check.mjs` → 10/10 pass, incl. **login with cookies blocked**
- `tests/e2e.mjs` → 13/13 pass, zero page errors
- Dashboard renders real KPIs, charts, and period-over-period trends

Run tests with:
```bash
npx playwright install chromium
LD_LIBRARY_PATH=/tmp/rflibs node tests/e2e.mjs
```
(If `/tmp/rflibs` is gone, the Playwright launch may fail on missing system libs —
`apt-get download <pkg> && dpkg-deb -x <deb> /tmp/rflibs` for libnspr4, libnss3,
libatk1.0-0t64, libgbm1, libasound2t64, libatspi2.0-0t64. Or skip browser tests.)

## Known constraints

- **Background processes do not persist between sessions.** If port 4000 is dead,
  just `npm start`. `node_modules` and `dist` are also stripped between sessions —
  `npm install && npm run build` restores them (~2 min).
- **Not deployable to GitHub Pages** — this is a Node server + SQLite, not a static
  site. It needs Render / Railway / Fly.io / a VPS. Deployment contract is
  `npm run build && npm start`.
- Marketplace integrations (Amazon, eBay, TikTok Shop, Walmart, AliExpress) are
  `awaiting_approval` by design. Do not fake these or scrape around them.
- AI runs locally; it is template-driven, not model-driven, unless an LLM key is set.

## User's standing requirements

- Real working app with real DB integration — never a static prototype.
- Never simulate a successful integration.
- No unauthorized scraping to bypass platform restrictions.
- AI must never auto-send without configured approval.
- Never merge customers on name similarity alone — verified identifiers only.
- No dead buttons.
