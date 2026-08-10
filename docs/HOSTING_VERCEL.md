# Hosting on Vercel + Hostinger domain

Production hosting for InsureBroker CRM: deploy **`main`** to **Vercel**, use a **dedicated production Supabase** project, and point a **Hostinger** domain at Vercel.

Staging stays on Lovable (`lovable_bot` → https://pk-policy-hub.lovable.app/). Do not point Lovable preview at production Supabase.

## Architecture

| Piece | Choice |
| --- | --- |
| Staging app | Lovable preview (`lovable_bot`) → staging Supabase |
| Production app | Vercel auto-deploy from GitHub **`main`** |
| Production DB | New Supabase project (not local, not staging) |
| Custom domain | Hostinger DNS → Vercel |

Migrations **do not** run automatically on Vercel deploy. Apply them with the Supabase CLI (`db push`) or dashboard SQL when a release includes schema changes.

## Repo prerequisites (already in this project)

- [`vite.config.ts`](../vite.config.ts) — Nitro `preset: "vercel"` when `process.env.VERCEL` is set (Lovable still forces Cloudflare in its sandbox).
- [`vercel.json`](../vercel.json) — framework `tanstack-start`, `npm run build`.
- [`package.json`](../package.json) — `engines.node >= 20` (set Node **20.x** in Vercel → Project Settings → General).

Tracked [`.env`](../.env) holds shared **staging/public** keys for Lovable. Vercel dashboard env vars **override** those at build/runtime for production — always set production values in Vercel; do not rely on the committed file alone.

---

## Step 1 — Create production Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** (e.g. `insurebroker-prod`).
2. Save DB password and region.
3. From a machine with the Supabase CLI:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROD_REF
npx supabase db push
```

4. **Storage** → create private bucket **`crm-documents`** (exact name).
5. **Authentication → URL configuration**
   - Site URL: temporary `https://YOUR_PROJECT.vercel.app` (switch to the custom domain later)
   - Redirect URLs: include `https://YOUR_PROJECT.vercel.app/**`, your custom domain later, and paths needed for auth (e.g. `/reset-password`)
6. Bootstrap a Super Admin (Auth → Add user → SQL promote to `admin`) — same as [README Local Development §6](../README.md).
7. Copy from **Settings → API**: Project URL, anon/publishable key, **service_role** key, project ref.

---

## Step 2 — Push Vercel-ready code to `main`

1. Merge the Vercel-ready commit (`vite.config.ts`, `vercel.json`, this doc) onto `main` via your normal release path (staging first when possible).
2. Connect Vercel only to **`main`**. Do not connect Vercel to `lovable_bot`.

---

## Step 3 — Create the Vercel project

1. [vercel.com](https://vercel.com) → sign in with GitHub.
2. **Add New → Project** → import `InsureKar/pk-policy-hub` (or your fork).
3. Settings:
   - **Framework Preset:** TanStack Start (or rely on `vercel.json`)
   - **Root Directory:** `.`
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
   - **Node.js Version:** **20.x**
4. Prefer setting env vars (next step) **before** the first successful production deploy.

---

## Step 4 — Production environment variables

**Project → Settings → Environment Variables.** Scope: **Production**.

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_PROD_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | prod anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | prod project ref |
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | same as publishable key |
| `SUPABASE_PROJECT_ID` | prod project ref |
| `SUPABASE_SERVICE_ROLE_KEY` | prod **service_role** (never `VITE_*`) |

Notes:

- `VITE_*` are baked in at **build** time — change them → **Redeploy**.
- Never paste staging/local keys into Production.
- If a `VITE_*` var is missing on Vercel, the build may silently use the tracked staging `.env` values — always verify the live app talks to the **production** project ref.

Then deploy (or **Redeploy** from Deployments).

---

## Step 5 — Verify the Vercel URL

1. Open `https://YOUR_PROJECT.vercel.app`.
2. Sign in at `/auth` with the **production** Super Admin.
3. Confirm dashboard loads; optionally create a test client.
4. Confirm `/users` works (needs service role).
5. If the build fails with Cloudflare/worker errors, confirm `VERCEL` is set during the build and `nitro.preset` is `vercel`, then redeploy.

---

## Step 6 — Connect Hostinger custom domain

Keep DNS at Hostinger (recommended if you use Hostinger email). Use **A + CNAME**, not nameserver transfer, unless you want Vercel to own all DNS.

### 6a. Add domain in Vercel

1. Vercel project → **Settings → Domains** → add `yourdomain.com` and `www.yourdomain.com`.
2. Choose apex or `www` as primary; redirect the other.
3. Use the exact records Vercel shows. Typical values ([Vercel docs](https://vercel.com/kb/guide/a-record-and-caa-with-vercel)):
   - Apex `A` → `76.76.21.21` (confirm on your domain card)
   - `www` `CNAME` → value shown by Vercel (e.g. `cname.vercel-dns.com`)

### 6b. Edit DNS in Hostinger

1. Hostinger **hPanel** → **Domains** → your domain → **DNS / DNS Zone**.
2. Remove conflicting apex `A` / `AAAA` / old hosting records for `@` and `www`.
3. Add/edit:
   - **Type A**, Name `@`, Points to Vercel’s IP
   - **Type CNAME**, Name `www`, Points to Vercel’s CNAME target
4. Keep existing **MX** / email TXT (SPF/DKIM) if you use Hostinger mail.
5. If you use CAA, allow Let’s Encrypt (`0 issue "letsencrypt.org"`).
6. Save. Propagation is often minutes, up to 24–48h.

### 6c. SSL and Auth URLs

1. Wait until Vercel Domains status is **Valid** and SSL is issued.
2. Update Supabase Auth **Site URL** to `https://yourdomain.com` (or `www` if primary).
3. Add redirect allow-list entries for the custom domain + auth paths.

---

## Ongoing production flow

1. Develop / verify on Lovable staging + staging Supabase.
2. PR → `main` (prefer after staging validation).
3. If there is a new migration: `npx supabase db push` against **production** before or with the deploy that needs it.
4. Vercel rebuilds `main` automatically.
5. Smoke-test the custom domain.

Release tags and GitHub Releases are documented in the [README Release Process](../README.md#release-process).

---

## Checklist

- [ ] Production Supabase created, migrated, `crm-documents` bucket, Super Admin
- [ ] Vercel-ready config on `main` (`vite.config.ts`, `vercel.json`)
- [ ] Vercel project linked to `main`, Node 20.x
- [ ] Production env vars set (including service role)
- [ ] `*.vercel.app` smoke test passed
- [ ] Hostinger DNS A/CNAME updated
- [ ] Vercel domain Valid + SSL
- [ ] Supabase Auth URLs updated to custom domain

## Out of scope

- Auto-migrating the DB on Vercel deploy
- Pointing Lovable preview at production Supabase
- Moving domain registration off Hostinger (not required)
