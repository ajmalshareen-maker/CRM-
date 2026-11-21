# Deploying ReplyFlow to GitHub

Repository: <https://github.com/ajmalshareen-maker/CRM-> (public, branch `main`, currently empty)

Everything is already committed locally — 53 files in a single clean commit (`3714da5`).
The only remaining step is authentication: this sandbox has no GitHub credentials, so the
push cannot complete on its own.

Choose **one** of the three options below.

---

## Option A — hand me a token (fastest, I do the rest)

Create a token, paste it in chat, and I will push immediately.

1. Go to <https://github.com/settings/tokens/new>
2. Note: `replyflow-deploy`
3. Expiration: `7 days` (or 1 day — shortest you're comfortable with)
4. Scope: tick **`repo`** (classic token) — that's the only permission needed
5. Generate, copy the `ghp_…` value, paste it to me

Then I run:

```bash
./push-to-github.sh <token>
```

The script verifies the token, pushes `main`, and then **removes the token from
`.git/config`** so it isn't left on disk. Revoke it afterwards at
<https://github.com/settings/tokens> — the commit stays pushed either way.

> Fine-grained tokens also work: grant **Repository permissions → Contents: Read and write**
> on `CRM-`. Classic `repo` is simpler.

---

## Option B — you push, no token shared (most secure)

The full history is saved as a portable bundle: `replyflow-repo.bundle` (281 KB).

**On your own machine:**

```bash
git clone replyflow-repo.bundle replyflow
cd replyflow
git remote set-url origin https://github.com/ajmalshareen-maker/CRM-.git
git push -u origin main
```

Or, if this workspace is mounted on your machine, from inside it:

```bash
cd /home/user
git remote set-url origin https://github.com/ajmalshareen-maker/CRM-.git
git push -u origin main        # GitHub prompts for username + token
```

The bundle is verified: *"The bundle records a complete history."*

---

## Option C — upload without git

Download `replyflow-repo.bundle` or a zip of the workspace, then use GitHub's
**Add file → Upload files** at <https://github.com/ajmalshareen-maker/CRM-/upload/main>.
This loses the commit history, so prefer A or B.

---

## What gets committed

```
.gitignore                     data/replyflow.db (seeded, 45 conversations)
README.md                      index.html
package.json                   package-lock.json
tsconfig.json                  vite.config.ts
public/widget-preview.html
server/   db/index.js, db/schema.sql, index.js, seed.js, ai.js, widget.js
src/      11 lib/components + 16 pages
tests/    Playwright suites (e2e, auth, actions, settings, sweep)
```

Excluded by `.gitignore`: `node_modules`, `dist`, `.cache`, `.arena`, `uploads`,
SQLite WAL/SHM sidecars, and any `.env` files. No secrets are staged — verified
before committing.

## After the push

The repo will contain a project that runs with:

```bash
npm install
npm start          # http://localhost:4000  (dist/ is pre-built on first run via npm run build)
```

Sign in with `amina@northwind.io` / `replyflow`.

Note: this is a **self-hosted Node + SQLite** app, not a static site. It will not
run on GitHub Pages — it needs a Node host (Render, Railway, Fly.io, a VPS, etc.).
`npm run build && npm start` is the whole deployment contract.
