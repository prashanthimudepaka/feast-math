# Deploying Feast Math to Vercel

One codebase, two deployment models: Vercel builds Next.js natively from
GitHub (this doc); Docker packages the same app as a container (Phase 6).

## 0. Accounts

- Vercel account (free Hobby) — sign in with the GitHub account that owns this repo.
- Database: create the Postgres from **inside Vercel** (Storage → Create Database
  → Neon Postgres). One login, and `DATABASE_URL` is injected automatically.

## 1. Import the project

1. vercel.com → **Add New… → Project** → Import `feast-math`.
2. Framework preset: **Next.js** (auto-detected). Leave build settings alone.
3. Confirm the **production branch is `main`**.

## 2. Database

1. In the project: **Storage → Create Database → Neon (Postgres)** → accept defaults.
2. This injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` into the project env.
   The app code already uses `prepare: false`, required for the pooled endpoint.

## 3. Environment variables (Project → Settings → Environment Variables)

| Name | Value | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | fresh random value | generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — do NOT reuse the dev one |
| `BETTER_AUTH_URL` | `https://<your-app>.vercel.app` | set after the first deploy shows the URL, then redeploy |
| `GEMINI_API_KEY` | your key | free from aistudio.google.com → Get API key (no card); ~250 requests/day on the free tier |
| `GEMINI_MODEL` | optional | defaults to `gemini-3.6-flash` (2.5-era models are closed to new accounts) |
| `FEAST_MOCK_PLAN` | `1` | offline demo plans with zero API calls; remove (and redeploy) once `GEMINI_API_KEY` is set to go real |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | enables Google sign-in; add the Vercel URL to the OAuth client's redirect URIs: `https://<app>.vercel.app/api/auth/callback/google` |

## 4. Migrations (run locally, once per schema change)

Vercel does not run migrations. From this repo, using the **UNPOOLED** URL
(Storage → your database → `.env.local` tab shows both):

```bash
DATABASE_URL="<paste DATABASE_URL_UNPOOLED>" npm run db:migrate
```

PowerShell equivalent:

```powershell
$env:DATABASE_URL="<paste DATABASE_URL_UNPOOLED>"; npm run db:migrate
```

## 5. Deploy & verify

1. **Deploy** (first import triggers it; later, every push to `main` deploys).
2. Set `BETTER_AUTH_URL` to the real URL → **Redeploy**.
3. Verify: sign up → create event → generate (mock) → share link opens in an
   incognito window → print view.

## Troubleshooting

- **500s on auth routes**: `DATABASE_URL` missing/unpooled mismatch, or
  migrations not run (step 4).
- **`prepared statement … already exists`**: something re-enabled prepared
  statements against the pooled endpoint — keep `prepare: false` in `lib/db/index.ts`.
- **Google login redirect error**: production URL not in the OAuth client's
  authorized redirect URIs.
- **Branch confusion**: production branch must be `main` (Settings → Git).
