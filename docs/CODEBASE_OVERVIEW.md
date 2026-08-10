# Codebase Overview — InsureBroker CRM (pk-policy-hub)

Staff-level onboarding notes from a first-pass review of the repository.  
**No application code was modified for this document.**

| | |
| --- | --- |
| **Product** | Insurance brokerage CRM/ERP for Pakistan (“InsureBroker”) |
| **Staging (Lovable preview)** | https://pk-policy-hub.lovable.app/ |
| **Platform** | Lovable-connected TanStack Start app + Supabase (Postgres, Auth, Storage, RLS) |
| **Package name** | `tanstack_start_ts` |

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React 19)                                             │
│  TanStack Router (file routes) + React Query + AuthProvider     │
│  Most CRUD → Supabase JS client (anon/publishable key + JWT)    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ TanStack Start  │  │ Supabase Auth    │  │ Supabase PostgREST │
│ (Vite + Nitro)  │  │ + GoTrue Admin   │  │ + RLS + Storage    │
│ Server fns RPC  │  │ (user/session    │  │ Postgres           │
│ SSR / Cloudflare│  │  admin ops)      │  │                    │
└────────┬────────┘  └────────▲─────────┘  └─────────▲──────────┘
         │                    │                      │
         │  Bearer JWT via    │                      │
         │  functionMiddleware│   service_role       │
         └────────────────────┴──────────────────────┘
              (admin-only: createUser, lock, sessions, …)
```

**Mental model:** This is a **BaaS-first SPA-style app** with a thin SSR/server-function layer.

- **~95% of data access** happens in route components via the browser Supabase client. Row-Level Security (RLS) is the primary authorization boundary.
- **Server functions** (`createServerFn`) are used only where the **service role** is required (Auth Admin API): create/delete users, reset passwords, lock accounts, list/revoke sessions.
- There is **no Express API**, no separate Node backend, and no custom REST controllers despite older README claims.

---

## 2. How data flows through the application

### 2.1 Auth session flow

1. User signs in at `/auth` with `supabase.auth.signInWithPassword`.
2. Session is persisted in `localStorage` (client Supabase config).
3. `AuthProvider` (`src/lib/auth.tsx`) listens via `onAuthStateChange`, then loads:
   - `user_roles` → `AppRole[]`
   - `profiles` → display name, team, etc.
4. Layout route `/_app` redirects unauthenticated users to `/auth`.
5. For server functions, `attachSupabaseAuth` (client middleware in `src/start.ts`) attaches `Authorization: Bearer <access_token>`; `requireSupabaseAuth` validates claims and injects a user-scoped Supabase client + `userId`.

### 2.2 Typical read path (dashboard, deals, accounts, …)

```
Route component
  → useQuery({ queryKey, queryFn })
  → supabase.from("<table>").select(...)
  → RLS filters rows for current JWT
  → component aggregates / charts in memory (often client-side)
```

### 2.3 Typical write path

```
Form handlers in route (local useState)
  → supabase.from(...).insert/update/delete
  → toast (sonner) + queryClient.invalidateQueries(...)
```

DB triggers handle a lot of business automation (deal autofill, won → receivable, invoice on stage change, payroll calc, travel posting balance, generated commission columns).

### 2.4 Admin privileged path

```
UI (users/settings)
  → createUser / deleteUser / resetUserPassword / setUserLocked / listAllSessions
  → requireSupabaseAuth + has_role(..., 'admin')
  → dynamic import of supabaseAdmin (service role)
  → Auth Admin API / privileged table writes
```

### 2.5 File uploads

Expenses/reimbursements upload into Storage bucket `crm-documents` via the client SDK. A fuller document-management UI (search, versioning, deal/client browser) is largely missing even though `documents` / `document_versions` / `deal_documents` exist in the schema.

---

## 3. Important directories

```
pk-policy-hub/
├── .lovable/                 # Lovable project metadata + upgrade plan
├── src/
│   ├── routes/               # File-based routes (= pages + layouts). Primary UI surface.
│   ├── components/           # AppShell, PageHeader, PipelineFunnel + shadcn ui/*
│   ├── lib/                  # auth, theme, calc, format, server fns, error helpers
│   ├── integrations/
│   │   ├── supabase/         # client, client.server, auth middleware, generated types
│   │   └── lovable/          # OAuth helper (Lovable cloud auth)
│   ├── hooks/                # use-mobile (sidebar helper; limited app usage)
│   ├── router.tsx            # createRouter + QueryClient
│   ├── start.ts              # TanStack Start middleware registration
│   ├── server.ts             # SSR entry wrapper (friendly 500 HTML)
│   ├── routeTree.gen.ts      # AUTO-GENERATED — do not edit
│   └── styles.css            # Tailwind v4 + design tokens
├── supabase/
│   ├── config.toml           # project_id
│   └── migrations/           # Source of truth for schema/RLS/triggers (16 files)
├── vite.config.ts            # @lovable.dev/vite-tanstack-config
├── components.json           # shadcn (new-york / slate)
├── AGENTS.md                 # Lovable git-history warning for agents
└── README.md                 # Product brief (tech stack section is outdated)
```

---

## 4. Frameworks and libraries

| Layer | Choice |
| --- | --- |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, sonner |
| Routing / SSR | TanStack Router + TanStack Start (Vite 8, Nitro, Cloudflare-oriented build) |
| Server data mutations (privileged) | TanStack `createServerFn` + Zod validators |
| Client cache / async UI | TanStack React Query v5 |
| Backend | Supabase (Postgres 14.x PostgREST types, Auth, Storage) |
| Charts | Recharts |
| Forms | Mostly local `useState`; `react-hook-form` + zod resolvers are dependencies and shadcn `Form` exists but are **barely used** in app routes |
| Theme | Custom `ThemeProvider` (light/dark, `localStorage` key `ib-theme`) |
| Tooling | TypeScript 5.8, ESLint, Prettier, Bun lockfile + npm lockfile both present |

**Notable absences:** no test runner/config, no `@tanstack/react-table` despite plan, no framer-motion, no dedicated state library (Zustand/Redux).

---

## 5. Routing

TanStack **file-based routing** under `src/routes/` (see `src/routes/README.md`).

| Route file | URL | Notes |
| --- | --- | --- |
| `__root.tsx` | (shell) | HTML shell, QueryClient, Theme, Auth, Toaster |
| `index.tsx` | `/` | Redirect → `/dashboard` or `/auth` |
| `auth.tsx` | `/auth` | Sign-in + forgot password (no public signup) |
| `reset-password.tsx` | `/reset-password` | Password recovery landing |
| `_app.tsx` | layout | Auth gate + `AppShell` |
| `_app.dashboard.tsx` | `/dashboard` | KPIs, charts, targets |
| `_app.analytics.tsx` | `/analytics` | Analytics charts |
| `_app.deals.index.tsx` | `/deals` | Deal list |
| `_app.deals.new.tsx` | `/deals/new` | Create deal (+ bulk policies) |
| `_app.deals.$id.tsx` | `/deals/:id` | Deal detail, stages, invoices, travel posting |
| `_app.pipeline.tsx` | `/pipeline` | Funnel (not Kanban) |
| `_app.clients.tsx` | `/clients` | Clients CRUD |
| `_app.leads.unassigned.tsx` | `/leads/unassigned` | Admin lead assignment |
| `_app.renewals.tsx` | `/renewals` | Policies + deal end dates |
| `_app.income.tsx` | `/income` | Income aggregates |
| `_app.teams.tsx` / `_app.users.tsx` / `_app.review.tsx` / `_app.targets.tsx` | Admin | Teams, users, review, monthly targets |
| `_app.master.tsx` | `/master` | Companies, commissions, products/types/sources/stages |
| `_app.settings.tsx` | `/settings` | Profile, password, sessions |
| `_app.accounts*.tsx` | `/accounts/*` | Receivables, payables, invoices, installments, payments, reports, approvals |
| `_app.operations*.tsx` | `/operations/*` | Payroll, commissions, expenses, reimbursements, performance, reports |

Pathless layout `_app` does not appear in the URL; child paths are absolute (`/dashboard`, not `/_app/dashboard`).

---

## 6. State management

| Concern | Mechanism |
| --- | --- |
| Auth session / roles / profile | React Context (`AuthProvider`) |
| Theme | React Context (`ThemeProvider`) |
| Server/cache state | React Query (`useQuery` / occasional `useMutation`) |
| Form UI state | Local `useState` inside large route files |
| Global client store | None |

Query keys are ad hoc strings (`"dashboard"`, `"deals-list"`, `"accounts-invoices"`, …). There is no shared query-key module or typed API layer.

---

## 7. API layer

There is **no traditional API folder**. Patterns in use:

1. **Direct Supabase from the client** (dominant).
2. **Server functions** in `src/lib/users.functions.ts` and `src/lib/sessions.functions.ts`.
3. **Postgres RPCs / triggers** for role checks and domain automation (`has_role`, `current_user_team`, deal/receivable/invoice/travel/payroll triggers).

Shared pure logic worth knowing:

- `src/lib/calc.ts` — client-side mirror of commission/tagged-premium formulas (must stay aligned with generated columns in `deals`).
- `src/lib/format.ts` — PKR / date / percent helpers.

---

## 8. Authentication and authorization

### Auth

- Supabase email/password; admin-provisioned users only (UI copy + `createUser` server fn).
- Password reset email → `/reset-password`.
- Profile flags: `must_reset_password`, `is_locked`.
- Lovable OAuth helper exists (`src/integrations/lovable`) but the primary `/auth` UI is password-based.

### Roles (`app_role` enum)

| Role | UI label | Typical scope |
| --- | --- | --- |
| `admin` | Super Admin | Everything; user admin; master data |
| `management` | Management | Broad read; many admin nav items |
| `team_lead` | Team Lead | Team-scoped data via RLS |
| `do` | Development Officer | Own clients/deals |

UI gating: `hasRole()` in `AppShell` nav and some pages.  
**Enforcement that matters:** Postgres RLS policies + `has_role` / ownership snapshots (`do_id`, `team_lead_id` on clients/deals).

### Gaps vs `.lovable/plan.md`

- Planned fine-grained `permissions` / `role_permissions` / `has_permission` / `usePermission()` — **not implemented**.
- Authorization remains coarse role checks + RLS, not module-action RBAC.

---

## 9. Database / backend integrations

### Schema domains (from `src/integrations/supabase/types.ts` + migrations)

| Domain | Tables / views |
| --- | --- |
| Identity | `profiles`, `user_roles`, `teams` |
| Master data | `insurance_companies`, `insurance_types`, `deal_stages`, `lead_sources`, `company_commission_rates`, `app_settings`, `expense_categories` |
| Sales | `clients`, `deals`, `deal_policies`, `deal_documents`, `user_targets` |
| Policies / renewals | `policies`, view `v_renewals` |
| Documents | `documents`, `document_versions` (+ Storage `crm-documents`) |
| Activity | `activity_log`, `email_history`, `accounts_audit_log` |
| Accounts | `receivables`, `invoices`, `installments`, `payments`, `commission_payables` |
| Ops / HR | `payroll_runs`, `salary_revisions`, `expenses`, `reimbursements` |
| Travel specialty | `travel_postings`, `travel_posting_rows` |

### Business logic in the database

Deal financial fields are largely **generated stored columns** (commission tax 17%, marketing tax 9%, total income, income %). Tagged premium base % lives in `app_settings.tagged_premium_base_percentage` (default 13) and is recomputed in the UI via `computeDeal`.

Important automations (migrations):

- Client/deal ownership autofill on insert/update
- Won deal → receivable
- Stage “Invoice Issued” → draft invoice
- Travel posting balance guard before Won
- Payroll calculation trigger
- Client code sequence

### Migrations

16 SQL files under `supabase/migrations/` (June–July 2026 timestamps). Treat these as the evolution history of the product (CRM core → enterprise upgrade → accounts → ops/payroll).

---

## 10. Environment variables

Present in `.env` (names only):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_PROJECT_ID` | Project id |
| `SUPABASE_URL` | Supabase API URL (server) |
| `SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key (server) |
| `VITE_SUPABASE_PROJECT_ID` | Client-exposed project id |
| `VITE_SUPABASE_URL` | Client-exposed URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client-exposed key |

Used in code but **not** listed in the checked-in `.env` sample surface:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client (`client.server.ts`) — required for user/session server fns in deployment |

**Security note:** `.env` is **tracked by git** and is **not** in `.gitignore`. Publishable keys are less sensitive than the service role, but committing env files is still a process smell; ensure the service role never lands in the repo or `VITE_*` vars.

---

## 11. Build configuration

- **Config entry:** `vite.config.ts` → `@lovable.dev/vite-tanstack-config` (bundles TanStack Start, React, Tailwind, tsconfig paths, Nitro/Cloudflare target, Lovable plugins). Do not re-add those plugins manually.
- **Custom Start server entry:** `src/server.ts` wraps SSR to replace h3’s opaque JSON 500s with an HTML error page.
- **Scripts:** `dev` / `build` / `build:dev` / `preview` / `lint` / `format`.
- **Path alias:** `@/` → `src/`.
- **Dual lockfiles:** `package-lock.json` and `bun.lock` (+ `bunfig.toml` with supply-chain `minimumReleaseAge`). Prefer one package manager as a team convention.

---

## 12. Major components

| Component / module | Role |
| --- | --- |
| `AppShell` | Sidebar nav, role-filtered groups, theme toggle, sign-out |
| `PageHeader` | Consistent page title/subtitle |
| `PipelineFunnel` | Stage funnel visualization (Fresh / Renewal / Pipeline) |
| Route modules under `src/routes/_app.*` | **Where most product logic lives** (large files: deal detail ~467 LOC, invoices ~357, new deal ~317, dashboard ~269) |
| `src/components/ui/*` | shadcn primitives (many unused by feature pages) |

There is no `features/` or `domain/` package split; the app is **route-centric**.

---

## 13. Current strengths

1. **Clear product focus** — insurance premiums, commissions, tagged premium, team hierarchy, renewals — not a generic CRM clone.
2. **Strong DB-centric domain model** — generated financial columns, triggers for receivables/invoices/travel, RLS with ownership snapshots.
3. **Modern stack fit for Lovable** — TanStack Start + Supabase + shadcn is coherent and productive for UI iteration.
4. **Auth basics done right for an internal tool** — no public signup, admin user provisioning, lock + forced password reset flags, session admin tools.
5. **Role-aware navigation** — sidebar filters by role without a separate permissions service.
6. **SSR error UX** — dedicated server wrapper for catastrophic SSR failures.
7. **Typed DB surface** — large generated `Database` types keep PostgREST usage discoverable.
8. **Upgrade plan exists** — `.lovable/plan.md` documents intended enterprise direction.

---

## 14. Technical debt

1. **README tech stack is wrong** (Express, JWT, Vercel/Render). New developers will be misled.
2. **`.env` committed**; `.gitignore` does not exclude it.
3. **God-route files** — business logic, queries, and UI mixed; hard to test or reuse.
4. **Heavy `as any` / loosely typed selects** — especially when schema evolves faster than call sites.
5. **Client-side aggregation of full tables** for dashboards/analytics/income — will not scale; no pagination strategy on large lists.
6. **Duplicate “Operations” nav groups** in `AppShell` (Sales ops vs Finance/HR ops) — confusing IA.
7. **No automated tests.**
8. **Planned RBAC not built** — UI role checks can drift from RLS.
9. **Documents module incomplete** — schema + storage exist; no first-class Documents route/UI.
10. **Pipeline is a funnel, not the planned Kanban** with drag-and-drop stage changes.
11. **Income “pending” is a hardcoded heuristic** (`totalIncome * 0.35`) — not backed by `income_entries` (which was planned and never added).
12. **Unused / underused dependencies** — react-hook-form tooling, large unused shadcn surface area.
13. **Vague git history** — many commits titled “Changes”; hard to bisect product intent.
14. **Mobile shell gap** — desktop sidebar is `hidden md:flex`; no obvious mobile nav drawer in `AppShell`.
15. **Dual package managers** — npm + bun lockfiles.

---

## 15. Areas needing refactoring

Priority order suggested for maintainability (not a commitment to implement now):

1. **Extract data access** — `src/lib/queries/*` or `src/features/<domain>/api.ts` with typed selects and shared query keys.
2. **Split large routes** — especially `deals.$id`, `accounts.invoices`, `deals.new`, `dashboard`.
3. **Align product IA** — rename/merge the two Operations groups; add missing Documents; clarify Accounts vs Operations.
4. **Server-side aggregates or RPC views** for dashboard/analytics instead of downloading all deals.
5. **Implement or explicitly defer** fine-grained permissions from the Lovable plan.
6. **Form stack consistency** — either adopt react-hook-form + zod everywhere or drop the unused path.
7. **Harden secrets hygiene** — untrack `.env`, document required vars in README / `.env.example`.
8. **Add a minimal test harness** — calc formula parity tests + a few RLS/policy SQL tests would pay off quickly.
9. **Refresh README** to match TanStack Start + Supabase reality.

---

## 16. Missing documentation

| Gap | Why it matters |
| --- | --- |
| Accurate architecture / stack docs | README contradicts the code |
| Env var catalog + `.env.example` | Onboarding and safe local setup |
| Domain glossary | Tagged premium, DO, cover note, travel posting balance, invoice approval |
| RLS matrix (role × table × action) | Security reviews without reading every migration |
| Trigger / automation map | Side effects when changing deal stage are non-obvious |
| Server-function security rules | When to use anon client vs `supabaseAdmin` |
| Query-key / caching conventions | Avoid stale UI after mutations |
| Contribution / Lovable sync workflow | `AGENTS.md` covers history; day-to-day branch flow less clear |
| Test / release checklist | No CI docs visible in-repo |

Useful existing docs: `README.md` (product requirements), `.lovable/plan.md` (upgrade roadmap), `src/routes/README.md` (routing conventions), `AGENTS.md` (Lovable git rules).

---

## 17. Questions a new developer should know

1. **Where does authorization really live?**  
   Prefer RLS + DB functions. UI `hasRole` is UX only.

2. **When do I use a server function vs the browser Supabase client?**  
   Browser for normal CRUD under RLS. Server + `supabaseAdmin` only for Auth Admin / bypass-RLS admin ops — and never import `client.server` into client-bundled modules at top level.

3. **Why do deal money fields look “read-only” after insert?**  
   Many are `GENERATED ALWAYS` columns. Change inputs (gross, %), not the derived outputs. Keep `src/lib/calc.ts` in sync for live previews.

4. **What happens when a deal is marked Won or “Invoice Issued”?**  
   Triggers may create receivables/invoices; travel deals may be blocked until posting balances.

5. **How is team scoping supposed to work?**  
   Profiles have `team_id`; teams have `lead_id`; clients/deals snapshot `do_id` / `team_lead_id` / `team_id` for RLS. Moving a user between teams does not automatically rewrite historical ownership.

6. **Is Pipeline a Kanban board?**  
   Not today — it renders `PipelineFunnel`. Stage changes happen on the deal detail page (and related flows).

7. **Where is the Documents product surface?**  
   Schema/storage exist; reimbursements/expenses upload files. There is no dedicated Documents app route yet.

8. **What is “tagged premium”?**  
   Income % relative to a configurable base (default 13%). If below 100% of base, tagged premium is scaled gross; otherwise full gross. See README formulas + `computeDeal`.

9. **Who can create users?**  
   Super Admin only, via server function. Public signup is intentionally disabled in the UI.

10. **What must I not do because of Lovable?**  
    Do not force-push or rewrite published history on the connected branch (`AGENTS.md`).

11. **Why are there two Operations sections in the sidebar?**  
    Historical IA: one for renewals/income-style ops, one for payroll/expenses. Treat as known debt until renamed.

12. **Is `management` still a first-class role?**  
    Yes in the enum, RLS, and nav. The upgrade plan discusses collapsing/aliasing it to Super Admin — that has not fully happened.

13. **How do I regenerate Supabase types?**  
    Types file is marked auto-generated; in Lovable/Supabase workflows they are typically regenerated after migrations. Confirm the project’s current regen path before hand-editing `types.ts`.

14. **What is the default admin seed mentioned in the plan?**  
    Plan references `admin@insurebroker.local` — verify against the live project; do not assume it exists in every environment.

---

## 18. Suggested mental map for your first week

1. Run the app, sign in as each role, click every sidebar item.
2. Create a client → deal → move stages → observe receivable/invoice side effects.
3. Read foundation migration `20260624165528_*.sql` then the accounts/ops migrations.
4. Trace one server fn (`createUser`) end-to-end through middleware.
5. Skim `.lovable/plan.md` to separate **shipped** vs **still planned**.

---

*Generated as Phase 1 understanding only. Application source was not changed.*
