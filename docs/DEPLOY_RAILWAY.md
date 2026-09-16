# Deploying the HI5 Portal backend on Railway

**Date:** 2026-09-16 · **Status:** runbook (deployment in progress)
Frontend is already live on Vercel (`hi5-six.vercel.app`). This runs the API.

## How the pieces fit

- Repo: `github.com/coffeescripttech-maker/hi5` → backend lives in `server/`.
- `server/railway.json` (committed) tells Railway to build `server/Dockerfile`
  — Node 22 + **Chromium** (for puppeteer-core PDFs) + **mysqldump** (for the
  backup cron) are baked into the image.
- Railway injects `PORT` at runtime; `src/index.ts:47` reads
  `process.env.PORT || "3001"`, so the Dockerfile `ENV PORT=3001` is just a fallback.
- Healthcheck: `GET /api/health` (unauthenticated) — `src/index.ts:149`.
  `railway.json` points the healthcheck there.

## 1 · Create the service

1. Railway dashboard → **New Project → Deploy from GitHub repo** → pick `coffeescripttech-maker/hi5`.
2. On the service, set **Root Directory** to **`server`** (so Railway reads
   `server/railway.json` and the Dockerfile).
3. Railway deploys `main` automatically on push.

> Railpack note: if the deploy log says `load build definition from ./railpack-plan.json`
> instead of a Dockerfile build, the `railway.json` wasn't picked up (usually an
> old app created by "Deploy from repo" before Root Directory was set). Fix the
> Root Directory, or redeploy from a fresh project — the Docker builder is required
> because railpack's Node plan has no Chromium.

## 2 · Environment variables

Service → **Variables** (values from `server/deploy.env.example` — never commit real values):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://hi5-six.vercel.app` |
| `JWT_SECRET` | output of `openssl rand -base64 48` |
| `DB_HOST` / `DB_PORT` | Railway MySQL **Data** tab: host / `3306` |
| `DB_USER` / `DB_PASSWORD` | Railway MySQL credentials (`root` + generated password) |
| `DB_NAME` | `railway` (plugin's default database) |
| `DB_SSL` | `require` |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail account + App Password (2-Step Verification must be on) |
| `PDF_CHROME_PATH` | `/usr/bin/chromium` |
| `UPLOAD_DIR` / `BACKUP_DIR` | `/data/uploads` / `/data/backups` |

Do **not** set `PORT` — Railway manages it.

## 3 · Database (Railway MySQL)

- Add the **MySQL** plugin to the same project. It creates a database, a user, and
  a host like `xxx.proxy.rlwy.net`; copy those into the variables above.
  A volume is attached to the plugin automatically, so SQL persists.
- **First deploy:** the schema is not applied automatically. Run migrations once —
  from your machine via the Railway proxy connection, or as a one-off command in
  the service (Referrals → Run command): `npm run migrate`, then optionally
  `npm run seed` for demo data.
- **Reusing an older `…proxy.rlwy.net` instance?** Rotate its DB password first —
  the old one sat in the public repo's `.env` and must be treated as burned.

## 4 · Storage Volume

- Service → **Volumes → Add Volume**: mount point **`/data`**, `UPLOAD_DIR`/
  `BACKUP_DIR` point beneath it, so uploads and backups survive restarts.
- Railway rejects a `VOLUME` instruction in the Dockerfile — the dashboard is the
  only way to attach storage.

## 5 · After deploy

- **Frontend:** set `VITE_API_URL=https://<railway-service-domain>/api` on Vercel
  (Project → Settings → Environment Variables), then redeploy the frontend. Without
  this the UI is static — `src/app/services/api.ts:11` falls back to `localhost:3001`.
- **Smoke checklist** (all against the live domain):
  - Login (admin + a teacher account); role-based nav renders.
  - SF9/SF10 generation → PDF downloads (exercises `/usr/bin/chromium`).
  - Forgot-password → a real email arrives (check spam); no code in the API response.
  - Document upload → file lands under `/data/uploads`.
  - Manual backup → `.sql` lands under `/data/backups`.
  - `GET /api/health` → `200`.

## 6 · Backups

The in-process cron (`backupCron.ts`) runs inside the container on its schedule
(from the settings table) and writes to `/data/backups`. Keep a **single replica** —
multiple replicas would each run the backup cron.