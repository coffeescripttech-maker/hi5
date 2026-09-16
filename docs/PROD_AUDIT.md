# Backend Production-Readiness Audit — HI5 Portal API

**Date:** 2026-09-16 · **Frontend:** deployed on Vercel (`hi5-six.vercel.app`) ✓
**Backend:** not yet deployed — audit findings below.

---

## TL;DR

The backend is **functionally complete and well-architected** (auth, RBAC, forms, reports, LIS, PDF, notifications all work). It is **not production-ready as-is** — there are **2 hard blockers**, **6 must-fix security/config items**, and **4 deployment decisions** that need your input. Nothing here is a deep refactor; every fix is a config change or a small code swap.

**Hard blockers (the app will misbehave or leak if deployed today):**

| # | Blocker | Where | Impact |
|---|---------|-------|--------|
| B1 | Forgot-password returns the reset code in the **API response** (dev-mode). No email is ever sent. | `server/src/controllers/auth.controller.ts:316-375` | Anyone can reset any account's password by calling the endpoint directly — **complete account takeover** on a public server. |
| B2 | Uploaded files + generated PDFs are **committed to git** and can't survive an ephemeral host (Railway/Render restarts wipe local disk). | tracked: `server/uploads/*.xlsx`, `server/downloads/*.pdf`, `*.pdf` at repo root | Real student documents sit in the public repo; files will vanish on every redeploy. |

**Quick security/config fixes (must do before go-live):**

| # | Item | Where | Fix |
|---|------|-------|-----|
| S1 | JWT secret is a **static dev string** | `server/.env:16` + `middleware/auth.ts:8` fallback | Inject `JWT_SECRET` (48+ random chars) at deploy; remove the fallback or make it boot-fail in prod |
| S2 | Hardcoded **public Railway MySQL password** sitting in `.env` (commented) | `server/.env:9-13,33` | Move to deploy-time secrets only; never keep real creds in repo files |
| S3 | **No rate limiting** on login/forgot-password | `server/src/index.ts` | Add `express-rate-limit` (~15 lines) |
| S4 | **No security headers** | `server/src/index.ts` | Add `helmet` (1 line) |
| S5 | **CORS** is locked to one origin | `server/src/index.ts:57-67` | Set `FRONTEND_URL` (the Vercel URL) in deploy env |
| S6 | `downloads/` (certificates/SF PDFs) written as **committed artifacts** | `server/src/controllers/certificates.controller.ts`, `forms.controller.ts` | Route through the uploads/RAM pattern; tmp dir in prod |
| S7 | Demo accounts all use **`password123`** | seed data | Force password reset at first login in prod, or rotate before launch |
| S8 | **No DB SSL / connect timeout** config for a managed MySQL | `server/src/config/database.ts:8-17` | Enable `ssl` + timeouts when pointing at a cloud DB |

**Deployment decisions I need from you** (these change what I build):

1. **Where will the backend run?** — Railway (I see your old `altaria.proxy.rlwy.net` MySQL in the .env), Render, Fly, or a VPS? This decides storage + backups + cron strategy.
2. **Email provider for the reset code?** — Resend (easiest, generous free tier), Gmail SMTP, SendGrid, or SMTP2GO. The frontend's forgot-password screen currently *expects* `reset_code` in the response, so switching to email also needs a small frontend change + redeploy.
3. **Database:** move to a managed MySQL (Railway/Render/Aiven) — yes/no? The current `root`/no-password local config won't work remotely.
4. **File storage:** persistent disk (works on Railway/VPS) vs object storage (S3/Cloudflare R2) — for the 10MB-uploaded documents + generated PDFs.

---

## Detailed findings

### 1 · Email sending (flagged) — NOT production-safe
- `forgotPassword()` generates a 6-digit code, stores it, and **returns it in the response body** — `auth.controller.ts:364-370`. There is **zero real email code** anywhere in the repo (grep for nodemailer/transporter/smtp/resend → nothing).
- The **entire point of the lockout/`locked_until` logic on login is undermined** by this: an attacker can loop `forgot-password` on any email and reset the password without ever touching their inbox.
- Fix path: add an SMTP/Resend call in that one handler; return a generic message; show the code on the frontend only in a `NODE_ENV !== 'production'` guard (or keep a separate admin-only reveal). Requires redeploying the frontend screen that consumes `reset_code`.

### 2 · Storage & static files (flagged) — local disk + git leak
- Uploads: `multer.diskStorage` → `server/uploads/` (`documents.routes.ts:10-20`). Three real uploaded `.xlsx` are **committed to the repo** (`git ls-files server/uploads`).
- Generated PDFs/certificates/SF10/SF5 write to `server/downloads/` and repo root — **also committed** (`git ls-files | grep downloads` → 9 files).
- These have no `.gitignore` entry, no static serving (so the files can't even be fetched— only streamed through an authenticated controller), and **local disk won't survive an ephemeral host**. On Railway/Render, every deploy wipes them.
- Fix: gitignore the dirs + `git rm --cached` the committed files (they don't belong in the repo); on the host use either a persistent volume (Railway Volume/Render Disk) or move to object storage.

### 3 · Secrets
- `server/.env` contains a **live-looking Railway MySQL password** (`TLyMCTHrQAtkMKvVzarMlZvXroXkhGdf`) — commented out but sitting in a repo-tracked-adjacent file. `.env` is gitignored, so it's local-only, but **do not push this file anywhere** and **rotate that password** (assume it's burned if it ever left this machine).
- `JWT_SECRET=hi5_portal_dev_secret_key_2026` is a guessable static string; middleware falls back to `"fallback_dev_secret_do_not_use_in_prod"` — meaning even a deploy that forgets to set it will *still run* with a known secret. **Must be env-supplied in prod.**
- DB creds default to `root`/empty — fine locally, impossible remotely.

### 4 · CORS
- `index.ts:57-67`: allows no-origin, localhost webviews, `FRONTEND_URL || "http://localhost:5173"`. On Vercel, requests come from `https://hi5-six.vercel.app` — so you must set `FRONTEND_URL` env on the backend, or all browser API calls will be blocked. (Also note the `origin===FRONTEND_URL` is an exact-match compare — include `https://` exactly, no trailing slash.)
- Add the Vercel preview domain (`hi5-six-git-*.vercel.app`) to the allowed list so preview deploys work too.

### 5 · Hardening (missing)
- **No rate limiting.** Login brute-force is partially mitigated by the 5-attempt lockout, but a distributed attack bypasses it; `forgot-password` has none at all. Add `express-rate-limit` on `/api/auth/*`.
- **No `helmet`.** Without it, no `X-Content-Type-Options`, `frameguard`, `Referrer-Policy`, etc. 1 line to add.
- **No `compression`.** 4+ MB bundled responses (LIS exports, big JSON) will be much slower without gzip.

### 6 · Background crons & platform assumptions
- `backupCron.ts` shells out to `mysqldump`/`mysql.exe` with **Windows XAMPP paths** (`MYSQLDUMP_PATH=C:/xampp/...`). On a Linux host this fails unless overridden. Backup output goes to `server/backups/` (also not gitignored, also ephemeral).
- `userStatusCron` + `activityLogCron` are pure-DB — fine anywhere.
- **Decision needed:** run crons via the platform's scheduler (Railway cron, Render cron, `node-cron`) vs keep the in-process interval. In-process interval works on any long-running host; it duplicates under multiple replicas.

### 7 · PDF rendering
- `pdf.controller.ts` uses `puppeteer-core` and searches for a Chrome/Edge binary (`PDF_CHROME_PATH` fallbacks include `/usr/bin/chromium-browser`, `/usr/bin/chromium`, `C:\Program Files...`). On a Linux host you must **install Chromium** and/or set `PDF_CHROME_PATH`. This is a common deployment failure point.
- Memory: the lazy singleton browser is good; make sure the host has enough RAM for headless Chrome bursts.

### 8 · Frontend ↔ backend contract
- Frontend `API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api"` (`src/app/services/api.ts:11`) — the deployed Vercel app needs `VITE_API_URL=https://your-backend-domain/api` set at build time on Vercel. **Confirm this is set** — if not, the "working" frontend is only rendering static pages with no live data.
- Forgot-password frontend screen reads `reset_code` from the response (dev flow). Switching to email delivery **requires a frontend change + redeploy**.

### 9 · Misc
- `express.json({ limit: "10mb" })` fine. `cookie-parser` unused-but-harmless.
- No `healthz` service-account (only `/api/health` — fine).
- `dist/` and `node_modules/` are gitignored — good.
- No `engines` field / `.nvmrc` — pin Node 20/22 for the host.

---

## Recommended go-live path (once you answer the 4 questions)

**Phase 0 — stop the leaks (independent of host choice):**
1. `.gitignore` + `git rm --cached` for `server/uploads/`, `server/backups/`, `server/downloads/`, stray root PDFs.
2. Add `helmet`, `compression`, `express-rate-limit` on auth routes.
3. JWT secret: read from env, fail fast in prod if missing.
4. CORS: allow exact `FRONTEND_URL` + Vercel preview pattern.

**Phase 1 — email + storage (host + provider decisions):**
5. Wire the reset-code email (Resend/SMTP) and adjust the frontend forgot-password screen.
6. Move file writes to persistent volume (or object storage); flip `mysqldump`/`BACKUP_DIR` to the host's paths.

**Phase 2 — deploy:**
7. Managed MySQL (or your Railway DB), SSL on, secrets injected, `PDF_CHROME_PATH` + Chromium installed, Node pinned.
8. Deploy, then run the full smoke checklist (login, SF10/SF9, forgot-password, LIS, backups).

---

*Questions above are the ones that materially change implementation. Answer them however you like — a quick chat reply is fine.*