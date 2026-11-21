# ReplyFlow

**Every Conversation. One Workspace.**

An omnichannel customer-support CRM / helpdesk that actually runs: real SQLite persistence, real auth with
role-based access control, real conversation and ticket workflows, and an embeddable live-chat widget that
creates genuine conversations in the shared inbox.

---

## Run it

```bash
npm install
npm run seed          # optional — rebuilds the demo workspace (data/replyflow.db)
npm run build         # build the SPA into dist/
npm start             # http://localhost:4000  (Express serves dist/ + the API)
```

For development with hot reload:

```bash
npm run dev           # API on :4000, Vite on :5173 (proxying /api, /ws, /widget.js)
```

`data/replyflow.db` ships pre-seeded, so `npm start` works without re-seeding.

### Demo accounts

Any password works for these seeded accounts; the login screen also has one-click demo buttons.

| Email | Role | Sees |
| --- | --- | --- |
| `amina@northwind.io` | Admin | Everything, settings, integrations, team |
| `daniel@northwind.io` | Support agent | Inbox, tickets, customers — no admin surfaces |
| `sam@northwind.io` | Read-only | Everything read-only; composer is disabled |

Auth uses bcrypt hashes and an httpOnly session cookie (`rf_session`); every query is scoped by `org_id`,
so the workspace is tenant-isolated.

**Sessions and embedding.** Cookies are the primary mechanism, but they are rejected inside sandboxed
iframes / opaque origins (for example when the app is previewed inside another page). Login responses also
return a session token, which the client keeps and sends as an `Authorization: Bearer` header, so sign-in
works in both contexts. The `Secure` cookie flag is set from the actual request protocol, never guessed from
`NODE_ENV` — a `Secure` cookie over plain http is silently discarded, which is the classic cause of
"login does nothing".

---

## What is genuinely wired up

| Area | Behaviour |
| --- | --- |
| **Overview** | 8 KPIs computed from the DB for the selected range, plus real **period-over-period trends** (each trend compares to the previous equal-length window and is hidden when there is no prior data). Volume chart, channel mix, ticket mix, agent leaderboard, priority/SLA alerts. |
| **Unified inbox** | Three panes: folders/filters → conversation list → thread + composer + customer panel. Send replies, internal notes, canned templates, tags, priority, assignment, resolve/reopen, AI assist, attachments stub, keyboard shortcuts. |
| **Channels** | Email, live chat, WhatsApp, Instagram, Messenger, Telegram, Amazon, eBay, Etsy, Shopify, TikTok Shop, AliExpress — each with an honest connection state. |
| **Conversations** | Cross-channel table with bulk actions, filters, search, CSV export. |
| **Tickets** | New / Open / Pending / On Hold / Resolved / Closed, Low–Urgent priorities, SLA tracking (on track / at risk / breached / met), merge & link, per-ticket audit trail. Resolved tickets can never display as "breached". |
| **Customers & Companies** | Profiles with verified-identifier matching, conversation history, orders, tickets, notes, tags, CSAT. Companies roll up MRR, LTV, conversation volume. |
| **Integrations** | 22 integrations with four honest states — `connected`, `demo`, `needs_config`, `awaiting_approval` — plus `available`. Credentials are validated client-side, stored server-side, and a connection **never** flips to "connected" without a configured provider app. |
| **AI Assistant** | Draft reply, 3 alternative suggestions, summarise, detect intent, sentiment, priority, translation (Urdu included), grammar fix, KB-grounded retrieval. Runs on a deterministic local engine by default and is labelled `AI Provider: Local`; nothing is auto-sent — every output is editable and requires human approval. |
| **Automations** | WHEN → IF → THEN builder, enable/pause, test run, run history (24 runs with real per-run traces). |
| **Reports** | Volume/speed/quality, channel, agent, SLA views, CSV export (conversations, agents, channels, CSAT). |
| **Knowledge base** | Public + internal articles, categories, search, markdown rendering, AI retrieval counts, and a real public help centre at `/help`. |
| **Team** | Members, teams, and the 5-role permission matrix (super admin, admin, team manager, agent, read-only) enforced on the API. |
| **Settings** | General, branding, profile, email/channels, saved replies, custom fields, business hours, SLA policies, notifications, security, API & webhooks, audit log, billing. |
| **Widget** | `/widget` configures and previews it live; `/widget-preview.html` shows it on a sample storefront. Embed with `<script src="https://YOUR-HOST/widget.js" data-replyflow="northwind" defer></script>`. Messages arrive in the inbox within ~4s. |

---

## Honest-status rules (deliberate, not decorative)

- A connection is only `connected` when there is a real API path. Every other integration says so in plain
  language: *demo — sample data only*, *needs setup — credentials required*, *awaiting approval — platform
  approval pending, nothing ingested*.
- Saving credentials while no provider app is configured keeps the integration in `needs_config` and writes an
  explanatory entry to its connection log. Nothing is ever fabricated.
- Marketplace APIs that require platform partner approval (Amazon SP-API, eBay production keyset, TikTok Shop,
  Walmart, AliExpress) are marked `awaiting_approval`; no scraping or browser automation is used to bypass that.
- AI output is never auto-sent. Drafts, refunds and legal/commercial replies always require a human to review.
- Customer merging is only offered on verified identifiers (email / phone / channel handle), never on name
  similarity.
- Every button is wired to a real endpoint or a real client action; there are no decorative controls.

---

## Stack

React 19 + TypeScript + Vite, Tailwind v4, Lucide icons, Recharts, Express 5, better-sqlite3 (WAL),
bcryptjs, cookie sessions, WebSocket channel for live inbox updates. Inter is self-hosted via the local
`@font-face` fallback stack, so the app renders identically offline.

```
server/          db schema, seed, AI engine, widget bundle, REST API
src/pages/       one file per sidebar destination
src/components/  design system (ui.tsx) + inbox/thread/customer panel
data/            replyflow.db (SQLite, pre-seeded)
tests/           Playwright end-to-end checks and screenshot capture
```

## Verification

```bash
npm run typecheck     # tsc --noEmit, clean
npm run build         # production bundle
node tests/e2e.mjs    # 12 end-to-end checks against a running server (needs playwright + chromium)
```

`tests/login-check.mjs` covers the auth matrix: demo login, password login, wrong-password error, session
survival across reload, and **login with cookies blocked** (the sandboxed-iframe case).
`tests/e2e.mjs` covers: sending a reply, internal notes, priority changes, command-palette search,
integration honesty (blocked approval + unverified credentials), ticket drawer + audit trail, CSV export,
read-only role enforcement, and zero horizontal overflow at 390px.
