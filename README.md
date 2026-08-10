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
| Hosting / build | **Staging:** Lovable Cloud preview (Nitro / Cloudflare). **Production:** Vercel from `main` (Nitro `vercel` preset when `VERCEL` is set). See [`docs/HOSTING_VERCEL.md`](./docs/HOSTING_VERCEL.md). |

There is **no separate Express API**. Most CRUD goes browser → Supabase under RLS. Server functions are reserved for operations that need the service role (create/delete users, password reset, lock, session admin).

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

The repo ships a tracked **`.env`** with the shared staging project’s **public** values (URL, anon/publishable key, project id). Lovable needs that file in Git so previews can inline `VITE_*` at build time — [do not gitignore `.env`](https://docs.lovable.dev/features/secrets).

For secrets and personal overrides, create a local file (gitignored; **wins over `.env`** for the same key):

```sh
cp .env.example .env.local
```

Edit `.env.local` and set at least the service role (from Supabase → **Project Settings → API**):

```env
# Required for /users admin APIs (create user, lock, reset password, sessions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

If you use your **own** Supabase project instead of shared staging, put the full set of `VITE_*` / `SUPABASE_*` values in `.env.local` (they override the tracked `.env`). Do not commit those overrides.

| File | In Git? | Purpose |
| --- | --- | --- |
| `.env.example` | Yes | Template with placeholders only |
| `.env` | **Yes** (tracked) | Shared public keys for Lovable + default local/staging |
| `.env.local` | **No** (gitignored) | Secrets + personal overrides (takes precedence) |

Rules:

- Never commit the service role key (or any true secret). Keep it in `.env.local` only.
- Never put the service role in a `VITE_*` variable.
- `VITE_*` values are public by design (embedded in the browser bundle); RLS protects data.
- Host dashboards (Vercel, etc.) override file values when those env vars are set there.

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

After this first Super Admin exists, you can create more users from the app at **`/users`** (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`).

### 7. Run the app and sign in

```sh
npm run dev
```

Open the printed local URL (often `http://localhost:5173`), go to **`/auth`**, and sign in with the email/password from step 6.

You should land on the dashboard with sidebar role **Super Admin**.

### 8. Checklist (fresh machine)

- [ ] Supabase project created (or using shared staging `.env`)  
- [ ] `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` (and any personal overrides)  
- [ ] `npx supabase db push` (or all migrations run in order) — skip if joining shared DB  
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

1. Use the tracked `.env` (public keys) as-is — do not invent a second schema.
2. Put `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` only if you need admin APIs (ask a teammate or copy from the dashboard).
3. **Do not** re-run migrations against a shared DB unless the team asks you to.
4. Ask an existing Super Admin to create your login in **`/users`**, or use credentials they provide.

### Lovable / staging configuration

Staging (`lovable_bot` preview) depends on the **committed `.env`** for build-time `VITE_*`:

1. Keep `.env` tracked with public URL + publishable/anon key + project id. Do **not** gitignore it.
2. Lovable Cloud Secrets can inject backend `SUPABASE_*` (including service role) when Supabase/Cloud is connected — but **not** `VITE_*` (Lovable rejects `VITE_` names in Secrets).
3. When merging into `main`, keep the public `.env`; never add the service role to it. Production hosts (e.g. Vercel) should set their own env vars in the dashboard (those override the file).
4. See [Lovable Secrets docs](https://docs.lovable.dev/features/secrets).

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

| Environment | Branch | Host | URL |
| --- | --- | --- | --- |
| Staging | `lovable_bot` | Lovable preview | https://pk-policy-hub.lovable.app/ |
| Production | `main` | Vercel + custom domain (Hostinger DNS) | Set after first deploy — see hosting guide |

### Staging (Lovable)

1. Merge feature work into `lovable_bot`.
2. Lovable syncs and rebuilds the staging preview.
3. Staging uses the tracked public `.env` for `VITE_*` (and Lovable Cloud for server secrets when connected).

### Production (Vercel)

1. Merge to `main` only after staging validation when the change is user-facing.
2. Vercel auto-deploys from **`main`** (do not connect Vercel to `lovable_bot`).
3. Set **production** Supabase env vars in the Vercel dashboard (they override the tracked staging `.env`).
4. Apply production Supabase migrations separately with the CLI when the release includes schema changes — Vercel does **not** run migrations.

Full checklist (production Supabase, env vars, Hostinger DNS, Auth URLs): **[`docs/HOSTING_VERCEL.md`](./docs/HOSTING_VERCEL.md)**.

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

After staging looks good on Lovable preview (when applicable):

1. Open a **pull request into `main`** on GitHub (from your feature/fix branch, or from `lovable_bot` after staging validation). Use the GitHub web UI — see **[Release Process](#release-process)**.
2. Review for production readiness (migrations, RLS, role behavior, secrets).
3. Prefer **Squash and merge** into `main`.
4. If there are new migrations, apply them to the **production** Supabase project before/with the deploy that needs them.
5. Create the Git tag and GitHub Release on `main` as described in **[Release Process](#release-process)**.

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

## Release Process

This section covers how we ship to production using **standard Git commands** and the **GitHub website only**. You do not need the GitHub CLI (`gh`).

### Important: tags are not branches

Version numbers such as `v1.0.0`, `v1.0.1`, or `v1.1.0` are **Git tags** (and later **GitHub Releases**). They are **not**:

- Branch names (do **not** create a branch called `v1.0.0`)
- PR titles (a PR can mention the version in its description, but the version itself is the tag)

Everyday work stays on normal branches like `feature/…` or `fix/…`.

### Concepts (quick glossary)

| Concept | What it is |
| --- | --- |
| **Feature / fix branch** | A short-lived branch where you commit work (`feature/add-invoices`, `fix/login-redirect`). |
| **Pull Request (PR)** | A GitHub review request to merge your branch into `main`. Created and merged in the browser. |
| **Git tag** | A named pointer to an exact commit on `main` (e.g. `v1.0.0`). Created with `git tag`, then pushed. |
| **GitHub Release** | A GitHub UI page attached to a tag, with title and release notes for humans. Optional but recommended. |

### Semantic Versioning (how to pick the next tag)

Use [Semantic Versioning](https://semver.org/): `vMAJOR.MINOR.PATCH`

| Bump | When | Example |
| --- | --- | --- |
| **PATCH** | Bug fixes, docs, small safe tweaks | `v1.0.0` → `v1.0.1` |
| **MINOR** | New backwards-compatible features | `v1.0.1` → `v1.1.0` |
| **MAJOR** | Breaking changes (API, schema, behavior users must adapt to) | `v1.1.0` → `v2.0.0` |

Start production at `v1.0.0`. Do not move or reuse an existing tag.

### Step-by-step release workflow

#### 1. Develop on a feature or fix branch

```sh
git checkout main
git pull origin main
git checkout -b feature/your-change
# …commit your work…
git push -u origin feature/your-change
```

(Optional for this project: also merge into `lovable_bot` first and verify on the Lovable staging preview — see [Git Workflow](#git-workflow).)

#### 2. Open a Pull Request targeting `main` (GitHub web UI)

1. Open the repository on GitHub.
2. You should see a banner to open a PR for your recently pushed branch, or go to **Pull requests → New pull request**.
3. Set **base** = `main` and **compare** = your feature/fix branch (or `lovable_bot` if releasing from staging).
4. Add a clear title and description (what changed, how to test, migrations if any).
5. Create the pull request.

#### 3. Review and test

- Get review as required by the team.
- Confirm staging/manual testing is done.
- Call out DB migrations and any env var needs in the PR.

#### 4. Squash and merge into `main`

On the PR page in GitHub:

1. Prefer **Squash and merge** so `main` stays a clean, linear history (one commit per PR), unless there is a strong reason to use **Create a merge commit** or **Rebase and merge**.
2. Confirm the squash commit message is readable.
3. Merge, then delete the feature branch if prompted.

#### 5. Tag the release on `main` (Git)

After the PR is merged, tag the commit that is now on `main`:

```sh
git checkout main
git pull
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

Replace `v1.0.0` with the correct next SemVer. Run these from a clean checkout of the latest `main` so the tag points at the intended release commit.

#### 6. Create the GitHub Release (GitHub web UI)

1. On GitHub: **Repository → Releases → Draft a new release** (or **Releases → New release**).
2. **Choose an existing tag** → select `v1.0.0` (the tag you just pushed). Do not create a new branch.
3. Set a **Release title** (often the same as the tag, e.g. `v1.0.0`).
4. Write **Release notes** (what shipped, migrations, breaking changes).
5. Click **Publish release**.

#### 7. Deploy

Whatever hosts production (e.g. Vercel on `main`) should pick up the merged commit. Apply any **production** Supabase migrations separately if this release includes schema changes — git tags do not run migrations.

### Example (end-to-end)

1. `git checkout -b feature/renewals-filter` → commit → `git push -u origin feature/renewals-filter`
2. (Optional) Merge to `lovable_bot`, test on https://pk-policy-hub.lovable.app/
3. GitHub: New PR → base `main` ← compare `feature/renewals-filter`
4. Review + testing
5. GitHub: **Squash and merge** into `main`
6. Locally: `git checkout main` → `git pull` → `git tag -a v1.1.0 -m "v1.1.0"` → `git push origin v1.1.0`
7. GitHub: **Releases → Draft a new release** → choose tag `v1.1.0` → notes → **Publish release**
8. Confirm production deploy; run production `db push` if migrations were included

### Rules of thumb

- PRs target **`main`**.
- Prefer **Squash and merge**.
- Versions live on **tags**, not release branches.
- Tag **after** merge, on the latest intended `main` commit.
- Use the GitHub **website** for PRs and Releases; use **git** only for tagging/pushing the tag.
- One production ship → one new tag (do not retag).

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
- PRs into `main` should call out migrations, RLS impact, and role-sensitive UI. Prefer **Squash and merge** (see [Release Process](#release-process)).
- Validate on staging (`lovable_bot` preview) before production merge when the change is user-facing.
- Keep the public `.env` tracked (required for Lovable). Never commit `.env.local`, the service-role key, or other secrets.

---

## Related docs

| Doc | Contents |
| --- | --- |
| [`docs/ENV_REVIEW.md`](./docs/ENV_REVIEW.md) | Env loading review, secrets findings, Lovable notes |
| [`docs/HOSTING_VERCEL.md`](./docs/HOSTING_VERCEL.md) | Production: Vercel + Hostinger + Supabase |
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
