# Environment variable review (findings)

Review date: 2026-08-01. No secrets are recorded in this document.

## How variables are loaded

This is a **Vite + TanStack Start** app (`@lovable.dev/vite-tanstack-config`).

| Context | Mechanism |
| --- | --- |
| Browser / client bundle | `import.meta.env.VITE_*` (Vite build-time inlining) |
| SSR / server functions | `process.env.*` (Node/Nitro runtime) |
| Shared client module | `src/integrations/supabase/client.ts` prefers `import.meta.env.VITE_*`, falls back to `process.env.SUPABASE_*` for SSR |

Vite automatically loads env files from the project root (standard Vite cascade): `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`. Local overrides win over `.env`.

There is no custom `dotenv` setup in app code. The Lovable Vite config comment notes that it handles `VITE_*` env injection.

## Variables actually used in code

| Variable | Where | Build-time (`VITE_`) | Runtime server | Required for |
| --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `client.ts` | Yes | Fallback via non-VITE | Local client + browser bundle |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `client.ts` | Yes | Fallback via non-VITE | Local client + browser bundle |
| `VITE_SUPABASE_PROJECT_ID` | Present in committed `.env` only | Yes (if used by tooling) | — | Optional; not referenced in `src/` app code |
| `SUPABASE_URL` | `client.ts`, `client.server.ts`, `auth-middleware.ts` | No | Yes | SSR + server fns |
| `SUPABASE_PUBLISHABLE_KEY` | `client.ts`, `auth-middleware.ts` | No | Yes | SSR + authenticated server fns |
| `SUPABASE_PROJECT_ID` | Present in committed `.env` only | No | — | Optional; not referenced in `src/` app code |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts` | No | Yes | Admin server fns (create/delete user, lock, sessions) |

`VITE_*` values are **public by design** (embedded in the client bundle). Security relies on Supabase RLS, not on hiding the publishable key.

`SUPABASE_SERVICE_ROLE_KEY` is a **true secret**. It must never use a `VITE_` prefix and must never be committed.

## What was committed before this cleanup

- `.env` **was tracked in git** and is **not** listed in `.gitignore`.
- Committed keys (by name): `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and matching `VITE_*` twins.
- `SUPABASE_SERVICE_ROLE_KEY` was **not** present in the tracked `.env` (good).
- Publishable keys are JWT-shaped anon/publishable credentials (not `sb_secret_` / service-role style). They are still credentials that belong in env config, not necessarily in git history forever — rotate if your threat model requires it after untracking.

## Required for local development

Minimum to run the UI and normal RLS-backed CRUD:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL` (same URL; used on server)
- `SUPABASE_PUBLISHABLE_KEY` (same publishable key; used on server)

Also required to exercise admin server functions (`src/lib/users.functions.ts`, `sessions.functions.ts`):

- `SUPABASE_SERVICE_ROLE_KEY`

Optional convenience (not read by current `src/` code):

- `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID`

## Lovable compatibility (important)

Per [Lovable Secrets docs](https://docs.lovable.dev/features/secrets):

1. **Backend `SUPABASE_*` (including service role)** — Reserved / auto-populated when Lovable Cloud or a connected Supabase project is enabled. These are injected for server-side use and are **not** meant to be managed via committed git secrets. Ignoring local `.env` does **not** remove Lovable’s ability to inject these platform secrets.
2. **`VITE_*` build-time vars** — Lovable documents that these belong in the project’s **`.env` file** (not Cloud Secrets), and states that **gitignoring `.env` can break Lovable preview builds** because previews need those values at build time.
3. Therefore: ignoring `.env` for a clean Git workflow is the right security practice for `main` / local clones, but **`lovable_bot` / Lovable may still create or rely on a `.env` inside the Lovable editor** for `VITE_*`. That file may reappear in sync commits from Lovable even if `.gitignore` lists `.env` (ignore rules do not remove files Lovable force-adds in its commits). When merging `lovable_bot` → `main`, drop or avoid promoting any `.env` that Lovable reintroduced; keep only `.env.example` on `main`.

**Assumption (stated, not guessed):** Staging preview remains healthy as long as Lovable’s project still has `VITE_*` available in its editor `.env` and/or Cloud-connected Supabase wiring. Developers must not assume Cloud Secrets can store `VITE_*` — Lovable rejects `VITE_`-prefixed names in Secrets.

## Recommended dual-workflow model

| Surface | What to use |
| --- | --- |
| Git (`main`) | `.env.example` only; no real `.env` |
| Local Cursor | Copy `.env.example` → `.env` (gitignored). Add service role locally for admin fns |
| Lovable / `lovable_bot` | Platform `SUPABASE_*` + Lovable-managed `.env` for `VITE_*` as Lovable requires |
| True secrets | Service role and any third-party keys: local `.env` / Lovable Secrets (non-`VITE_`) / host env — never git |
