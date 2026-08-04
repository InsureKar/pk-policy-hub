# InsureBroker CRM

Role-based CRM/ERP for insurance brokerage operations in Pakistan. The product focuses on clients, deals, pipeline, premiums/commissions, renewals, accounts, and team performance — with workflows tailored to brokerage finance rather than a generic sales CRM.

| | |
| --- | --- |
| **Staging (Lovable preview)** | [pk-policy-hub.lovable.app](https://pk-policy-hub.lovable.app/) |
| **Lovable project** | [Open in Lovable](https://lovable.dev/projects/17ca6d6b-12e3-4d07-900a-ba318d3d6b27) |

---

## Project Overview

InsureBroker helps an insurance aggregator/brokerage firm manage the full sales-to-finance loop:

- **Sales** — clients (individual/corporate), deals, pipeline stages, lead assignment, documents on deals
- **Pricing & income** — gross/net premium, commission and marketing-budget math, tagged premium, company commission rates by line of business
- **Operations** — renewals, income views, travel posting reconciliation for travel policies
- **Accounts** — receivables, invoices (approval workflow), installments, payments, payables, finance reports
- **People & admin** — teams, users, monthly targets, payroll, expenses, reimbursements, performance
- **Master data** — insurance companies, products/types, stages, sources, commission settings

### Roles

| Role | UI label | Access summary |
| --- | --- | --- |
| `admin` | Super Admin | Full access; user provisioning; master data |
| `management` | Management | Broad visibility across deals, reports, and admin views |
| `team_lead` | Team Lead | Team-scoped clients, deals, and performance |
| `do` | Development Officer | Own clients and deals |

Accounts are **admin-provisioned** (no public self-signup). Authorization is enforced primarily by **Supabase Row Level Security (RLS)**; UI role checks gate navigation and actions.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Recharts, Sonner |
| App framework | [TanStack Start](https://tanstack.com/start) + TanStack Router (file-based routes) |
| Client data | TanStack React Query + Supabase JS client |
| Privileged admin ops | TanStack `createServerFn` (Auth Admin / service role) |
| Backend | Supabase — Postgres, Auth, Storage, RLS |
| Validation | Zod (server functions) |
| Tooling | TypeScript, Vite 8, ESLint, Prettier |
| Hosting / build (staging) | Lovable Cloud preview only — Nitro / Cloudflare-oriented via `@lovable.dev/vite-tanstack-config`. Production hosting is not set up yet. |

There is **no separate Express API**. Most CRUD goes browser → Supabase under RLS. Server functions are reserved for operations that need the service role (create/delete users, password reset, lock, session admin).

---

## Project Structure

```
.
├── src/
│   ├── routes/                 # File-based routes (pages + layouts)
│   │   ├── __root.tsx          # HTML shell, providers, error/404
│   │   ├── auth.tsx            # Sign-in / forgot password
│   │   ├── reset-password.tsx
│   │   ├── _app.tsx            # Authenticated layout + AppShell
│   │   └── _app.*.tsx          # Feature pages (dashboard, deals, accounts, …)
│   ├── components/             # AppShell, shared UI, shadcn under ui/
│   ├── lib/                    # auth, theme, calc, format, server functions
│   ├── integrations/
│   │   ├── supabase/           # clients, auth middleware, generated types
│   │   └── lovable/            # Lovable cloud auth helper
│   ├── hooks/
│   ├── router.tsx              # Router + QueryClient
│   ├── start.ts                # Start middleware (attach Supabase JWT)
│   ├── server.ts               # SSR entry / error page wrapper
│   ├── routeTree.gen.ts        # Generated — do not edit by hand
│   └── styles.css              # Tailwind + design tokens
├── supabase/
│   ├── config.toml
│   └── migrations/             # Schema, RLS, triggers (source of truth)
├── .lovable/                   # Lovable metadata / plans
├── docs/ENV_REVIEW.md          # Env-var strategy findings (local + Lovable)
├── .env.example                # Env template (placeholders only; commit this)
├── AGENTS.md                   # Agent rules for Lovable-connected repos
├── CODEBASE_OVERVIEW.md        # Deep architecture onboarding
├── components.json             # shadcn config
├── vite.config.ts              # Lovable TanStack Start Vite config
└── package.json
```

Routing conventions are documented in [`src/routes/README.md`](./src/routes/README.md).

---

## Local Development

This guide gets a **new developer** from zero to first Super Admin login against their **own** Supabase project.

Important facts before you start:

- There is **no** `users` table. Login lives in Supabase Auth (`auth.users`). App profile data is in `public.profiles`. Roles are in `public.user_roles`.
- Migrations seed **master data only** (teams, insurers, stages, sources, settings, expense categories, etc.). They do **not** create any login user or password.
- Mentions of `admin@insurebroker.local` in old plans are **not** created by this repo. You bootstrap Super Admin yourself (steps below).
- “Super Admin” in the UI = role `admin` in `user_roles`.

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm (or Bun — both lockfiles exist; pick one team-wide)
- A free [Supabase](https://supabase.com) account
- [Supabase CLI](https://supabase.com/docs/guides/cli) (recommended for applying migrations). Install via npm: `npm i -g supabase`, or use `npx supabase …`

### 1. Clone and install the app

```sh
git clone https://github.com/InsureKar/pk-policy-hub.git
cd pk-policy-hub
npm install
```

### 2. Create a new Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in (or create an account).
2. **New project** → choose org, name, database password (save it), region.
3. Wait until the project is ready.
4. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **Project API keys → `anon` `public`** (or publishable) → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Project API keys → `service_role` `secret`** → `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose to the browser)
   - **Reference ID** (also in the URL / General settings) → `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID`

Optional: set `project_id` in `supabase/config.toml` to your new reference ID so CLI commands match your project (the committed value may point at another environment).

### 3. Configure local environment variables

```sh
cp .env.example .env
```

Edit `.env` with your new project values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key
SUPABASE_PROJECT_ID=YOUR_PROJECT_REF

# Required for /users admin APIs (create user, lock, reset password, sessions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

| File | In Git? | Purpose |
| --- | --- | --- |
| `.env.example` | Yes | Template with placeholders only |
| `.env` | **No** (gitignored) | Your real local keys |
| `.env.local` | **No** (gitignored) | Optional overrides (Vite loads these too) |

Rules:

- Never commit `.env` or the service role key.
- Never put the service role in a `VITE_*` variable.
- `VITE_*` values are public by design (embedded in the browser bundle); RLS protects data.

Full env notes: [`docs/ENV_REVIEW.md`](./docs/ENV_REVIEW.md).

### 4. Apply database migrations

Migrations live in `supabase/migrations/` and must run **in filename / timestamp order**. Prefer the CLI.

#### Recommended: Supabase CLI (`db push`)

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This applies every pending SQL file in `supabase/migrations/` to your linked remote project.

Verify in the Supabase dashboard: **Table Editor** should show tables such as `profiles`, `user_roles`, `teams`, `clients`, `deals`, plus accounts/ops tables. **Database → Migrations** (or the migration history) should list the applied files.

#### Fallback: SQL Editor (manual)

If CLI linking fails, open **SQL Editor** in the dashboard and run each file under `supabase/migrations/` **one by one, oldest timestamp first** (sort by filename). Do not skip files and do not reorder them.

### 5. Create the Storage bucket

Migrations add **policies** for bucket `crm-documents` but do **not** create the bucket itself.

1. Dashboard → **Storage** → **New bucket**
2. Name: `crm-documents` (exact)
3. Prefer **Private** (not public)
4. Save

Expense/reimbursement uploads use this bucket. Skipping it will break those features later; the rest of the CRM can still run.

### 6. Create your first Super Admin (login user)

Migrations do **not** insert any Auth user. Bootstrap once:

#### 6a. Create the Auth user

1. Dashboard → **Authentication → Users → Add user**
2. Choose **Create new user**
3. Enter email + password (min 8 characters; you will use these on `/auth`)
4. Enable **Auto Confirm User** (so you can sign in immediately)
5. Create user and copy the user’s **UUID**

Creating the Auth user fires `handle_new_user`, which automatically inserts:

- `public.profiles` (same UUID, email, name if present)
- `public.user_roles` with role **`do`** (Development Officer) — **not** admin yet

#### 6b. Promote to Super Admin (`admin`)

Dashboard → **SQL Editor** → run (replace the UUID):

```sql
-- Promote first user to Super Admin
DELETE FROM public.user_roles WHERE user_id = 'PASTE_USER_UUID_HERE';
INSERT INTO public.user_roles (user_id, role)
VALUES ('PASTE_USER_UUID_HERE', 'admin');

-- Optional: set a display name
UPDATE public.profiles
SET full_name = 'Local Super Admin'
WHERE id = 'PASTE_USER_UUID_HERE';
```

Confirm:

```sql
SELECT p.email, p.full_name, ur.role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = 'PASTE_USER_UUID_HERE';
```

You should see `role = admin`.

After this first Super Admin exists, you can create more users from the app at **`/users`** (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env`).

### 7. Run the app and sign in

```sh
npm run dev
```

Open the printed local URL (often `http://localhost:5173`), go to **`/auth`**, and sign in with the email/password from step 6.

You should land on the dashboard with sidebar role **Super Admin**.

### 8. Checklist (fresh machine)

- [ ] Supabase project created  
- [ ] `.env` filled (including service role)  
- [ ] `npx supabase db push` (or all migrations run in order)  
- [ ] Storage bucket `crm-documents` created  
- [ ] Auth user created + confirmed  
- [ ] `user_roles.role = 'admin'` for that user  
- [ ] `npm run dev` → sign in at `/auth`  

### Environment variables reference

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes (client) | Project URL (build-time, browser) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes (client) | Anon/publishable key (build-time, public) |
| `VITE_SUPABASE_PROJECT_ID` | Optional | Project ref |
| `SUPABASE_URL` | Yes (server) | Same URL for SSR / server functions |
| `SUPABASE_PUBLISHABLE_KEY` | Yes (server) | Publishable key for authenticated server fns |
| `SUPABASE_PROJECT_ID` | Optional | Project ref |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (admin UI) | Service role for `/users` and session admin — **never** `VITE_*` |

### Alternative: join an existing shared Supabase project

If your team already has a shared staging project and invites you:

1. Get URL + anon key (+ service role only if you need admin APIs) from a teammate — do not invent a second schema.
2. Put those values in `.env`.
3. **Do not** re-run migrations against a shared DB unless the team asks you to.
4. Ask an existing Super Admin to create your login in **`/users`**, or use credentials they provide.

### Lovable / staging configuration

Staging (`lovable_bot` preview) uses Lovable’s connected backend, not your personal `.env`:

1. Keep Supabase / Lovable Cloud connected in the Lovable UI so platform `SUPABASE_*` values are injected.
2. Build-time `VITE_*` values live in Lovable’s project env / editor `.env` (not in Cloud Secrets — Lovable rejects `VITE_` names there).
3. When merging `lovable_bot` → `main`, **do not promote a real `.env`**. Keep `.env.example` only.
4. See [Lovable Secrets docs](https://docs.lovable.dev/features/secrets).

> Lovable’s docs warn that gitignoring `.env` can break previews if `VITE_*` are missing from Lovable’s own config. Keep `main` clean; fix staging env inside Lovable, not by committing secrets.

### Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| Dev server | `npm run dev` | Local development with HMR |
| Production build | `npm run build` | Production bundle |
| Dev-mode build | `npm run build:dev` | Build with development mode |
| Preview build | `npm run preview` | Serve the production build locally |
| Lint | `npm run lint` | ESLint across the repo |
| Format | `npm run format` | Prettier write |

### Linting

```sh
npm run lint
```

ESLint is configured via `eslint.config.js` (TypeScript + React Hooks + Prettier integration). Format with:

```sh
npm run format
```

### Testing

There is **no automated test suite or CI test script in this repository yet**. Until tests are added:

- Verify role-scoped behavior manually (admin / management / team lead / DO).
- After deal/stage changes, confirm trigger side effects (receivables, invoices, travel posting guards).
- Keep `src/lib/calc.ts` consistent with deal generated columns when changing commission formulas.

### Build

```sh
npm run build
npm run preview   # optional local smoke-check of the build
```

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`. Do **not** manually re-add TanStack Start, React, Tailwind, or Nitro plugins — duplicates will break the build. Custom SSR entry is `src/server.ts`.

---

## Deployment

| Environment | Branch | URL |
| --- | --- | --- |
| Staging | `lovable_bot` (Lovable preview) | https://pk-policy-hub.lovable.app/ |
| Production | `main` | Not published yet |

Deployment is managed through the **Lovable-connected** workflow:

1. Changes that land on `lovable_bot` sync into Lovable and power the **staging** preview.
2. Production releases are intentional merges into `main` (via pull request). A production URL will be added here once it is published.
3. Supabase (schema, Auth, Storage, RLS) is the backend; apply migrations carefully and keep staging/production data expectations clear.

Database changes belong in `supabase/migrations/`. Prefer additive, reviewable migrations over ad-hoc production SQL.

---

## Git Workflow

This repository has **two-way sync enabled with Lovable** on the `lovable_bot` branch.

**Preferred release path:** feature branch → **`lovable_bot` (staging)** → test on Lovable preview → PR **`lovable_bot` → `main`** (production release) → tag the release on `main`.

### Branches

#### `lovable_bot`

- Reserved exclusively for Lovable.
- Continuously synced with the Lovable editor.
- **Do not develop directly on this branch.**
- The Lovable preview environment is **staging**:  
  https://pk-policy-hub.lovable.app/

#### `main`

- Production branch — keep it clean and release-ready.
- Production app (e.g. Vercel) should track intentional merges here.
- Changes that originated in Lovable should be **merged or cherry-picked intentionally**, not assumed to be production-ready by default.

### Syncing local work into Lovable (staging)

1. Create a feature branch from an up-to-date base (`main` preferred, or `lovable_bot` if you must match staging).
2. Commit your work on that feature branch.
3. Merge (or open a PR into) **`lovable_bot`**.
4. Lovable syncs `lovable_bot`; verify on the staging URL.
5. If you added a migration, apply it to the **staging** Supabase project (`npx supabase db push` linked to staging) before relying on new schema in preview.

```sh
git checkout -b feature/your-change
# …commit work…
git checkout lovable_bot
git pull origin lovable_bot
git merge feature/your-change
git push origin lovable_bot
```

### Releasing to production

After staging looks good on Lovable preview:

1. Open a **pull request into `main` from `lovable_bot`** (recommended path).
2. Review for production readiness (migrations, RLS, role behavior, secrets).
3. Merge the PR to `main` when approved.
4. If there are new migrations, apply them to the **production** Supabase project before/with the deploy that needs them.
5. Tag the release on `main` (see below).

```sh
# Recommended: release from staging after validation
gh pr create --base main --head lovable_bot \
  --title "Release: <short summary>" \
  --body "## Summary
- …
## Staging
- Verified on https://pk-policy-hub.lovable.app/
## Migrations
- [ ] None / [ ] Applied to production Supabase
"
```

### Release tags (convention)

Tag **only on `main`**, after the release PR is merged. Use [Semantic Versioning](https://semver.org/):

| Change type | Version bump | Example tag |
| --- | --- | --- |
| Bug fix / docs / small safe tweak | Patch | `v1.0.1` |
| New feature, backward compatible | Minor | `v1.1.0` |
| Breaking schema/API/behavior | Major | `v2.0.0` |

Annotated tag + push:

```sh
git checkout main
git pull origin main

# Pick the next version intentionally (do not retag)
git tag -a v1.0.0 -m "Release v1.0.0

- Summary of what shipped
- Staging verified on Lovable preview
"

git push origin main
git push origin v1.0.0
```

Optional GitHub Release UI from that tag:

```sh
gh release create v1.0.0 --title "v1.0.0" --notes "- …"
```

Rules:

- Tags are **immutable pointers** to a production commit — do not move/delete published tags.
- One tag per production ship (not on every staging merge to `lovable_bot`).
- Start at `v1.0.0` for the first production cut; bump from there.
- Include migration notes in the tag/release body when schema changed.

### Generated files: `src/routeTree.gen.ts`

- **Tracked in Git** — do **not** add it to `.gitignore`.
- **Auto-generated** by TanStack Router when routes change — never hand-edit.
- **Do push it** when `npm run dev` / build regenerates it as part of real route or Start tooling updates (include it in the same commit as the route change).
- If it changed accidentally with no route work, you can `git restore src/routeTree.gen.ts` — but if the new `Register` / SSR types block appears after upgrading tooling, **commit it** so CI and teammates match your local tree.

### Lovable history rules

See [`AGENTS.md`](./AGENTS.md). In short:

- **Do not force-push**, rebase, amend, or squash **already-pushed** history on the Lovable-connected branch.
- Rewriting published history breaks Lovable’s sync and can erase editor history.
- Keep `lovable_bot` in a working state — every push syncs into the Lovable editor.

---

## Conventions

### Routing

- All pages live under `src/routes/` (TanStack file routing). Do not invent `src/pages/` or Next.js-style `app/` layouts.
- Authenticated app routes use the `_app` pathless layout (`src/routes/_app.tsx`).
- `src/routeTree.gen.ts` is generated — never hand-edit. It **is** committed and pushed when routes/tooling regenerate it (see Git Workflow).

### Data access

- **Default:** query/mutate with the browser Supabase client; rely on RLS.
- **Admin Auth / service role:** use server functions in `src/lib/*.functions.ts` with `requireSupabaseAuth`, and dynamically import `@/integrations/supabase/client.server` inside the handler only.
- Prefer React Query `queryKey`s + `invalidateQueries` after mutations.
- Do not import `supabaseAdmin` into modules that ship to the client bundle.

### UI

- Use existing shadcn components under `src/components/ui/`.
- Shared chrome: `AppShell`, `PageHeader`.
- Theme tokens live in `src/styles.css` (light/dark via `ThemeProvider`).

### Domain / money

- Treat deal generated columns as read-only outputs.
- Mirror formula changes in both SQL migrations and `src/lib/calc.ts`.
- Currency helpers: `src/lib/format.ts` (`fmtPKR`, etc.).

### Database

- Schema changes → new files in `supabase/migrations/`.
- Regenerate or refresh `src/integrations/supabase/types.ts` after material schema changes (file is auto-generated; avoid manual drift).
- Migrations seed master data (teams, companies, stages, settings, categories) — **not** Auth users. Bootstrap Super Admin per Local Development §6.

### Tooling / config

- Path alias: `@/` → `src/`.
- shadcn config: `components.json` (style: `new-york`, base: `slate`).
- Prefer one package manager team-wide (`package-lock.json` and `bun.lock` both exist today).

### Commits & PRs

- Use clear, intentional commit messages (avoid opaque “Changes” dumps on shared branches).
- PRs into `main` should call out migrations, RLS impact, and role-sensitive UI.
- Validate on staging (`lovable_bot` preview) before production merge when the change is user-facing.
- Never commit `.env`, service-role keys, or other secrets. Only `.env.example` belongs in Git.

---

## Related docs

| Doc | Contents |
| --- | --- |
| [`docs/ENV_REVIEW.md`](./docs/ENV_REVIEW.md) | Env loading review, secrets findings, Lovable notes |
| [`docs/DATABASE_OVERVIEW.md`](./docs/DATABASE_OVERVIEW.md) | DB architecture, security, migrations |
| [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | Per-table schema reference |
| [`docs/DATABASE_RELATIONSHIPS.md`](./docs/DATABASE_RELATIONSHIPS.md) | Relationships + Mermaid ER diagrams |
| [`docs/CODEBASE_OVERVIEW.md`](./docs/CODEBASE_OVERVIEW.md) | Architecture and onboarding deep-dive |
| [`src/routes/README.md`](./src/routes/README.md) | File-based routing conventions |
| [`.lovable/plan.md`](./.lovable/plan.md) | Enterprise upgrade plan (shipped vs planned) |
| [`AGENTS.md`](./AGENTS.md) | Lovable git-history constraints for agents |

---

## License / ownership

Private project for InsureKar. Code in this repository syncs with Lovable; treat production credentials and the Supabase service role as confidential.
