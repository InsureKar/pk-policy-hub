# Environment variable review (findings)

Review date: 2026-08-01 (updated 2026-08-07 for Lovable `.env` policy). No secret *values* are recorded in this document.

## How variables are loaded

This is a **Vite + TanStack Start** app (`@lovable.dev/vite-tanstack-config`).

| Context | Mechanism |
| --- | --- |
| Browser / client bundle | `import.meta.env.VITE_*` (Vite build-time inlining) |
| SSR / server functions | `process.env.*` (Node/Nitro runtime) |
| Shared client module | `src/integrations/supabase/client.ts` prefers `import.meta.env.VITE_*`, falls back to `process.env.SUPABASE_*` for SSR |

Vite automatically loads env files from the project root (standard Vite cascade): `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`. **`.env.local` wins over `.env`** for the same key. Real process/host env vars override both for `VITE_*`.

There is no custom `dotenv` setup in app code. The Lovable Vite config loads `VITE_*` via `loadEnv` from the working tree (hence a tracked `.env` is required for previews).

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

`SUPABASE_SERVICE_ROLE_KEY` is a **true secret**. It must never use a `VITE_` prefix and must never be committed. Keep it in `.env.local` (local) or host/Lovable Secrets (deployed).

## Tracked vs local files

| File | In Git? | Contents |
| --- | --- | --- |
| `.env` | **Yes** | Shared public URL + publishable/anon key + project id (`VITE_*` + matching `SUPABASE_*`) |
| `.env.local` | **No** | Service role + optional personal overrides (takes precedence) |
| `.env.example` | **Yes** | Placeholders only |

## Lovable compatibility (important)

Per [Lovable Secrets docs](https://docs.lovable.dev/features/secrets):

1. **Do not gitignore `.env`** in a Lovable project. Previews and published builds need `VITE_*` from the committed file.
2. **`VITE_*` cannot go in Cloud Secrets** — Lovable rejects `VITE_`-prefixed names there. They belong in `.env`.
3. **Backend `SUPABASE_*` (including service role)** — May be auto-populated when Lovable Cloud or a connected Supabase project is enabled. Still never commit the service role to `.env`.
4. When shipping to production hosts (e.g. Vercel), set env vars in the host dashboard; they override the tracked `.env`. Confirm the production project ref is what the live app actually calls.

## Recommended dual-workflow model

| Surface | What to use |
| --- | --- |
| Git (`lovable_bot`, `main`, feature branches) | Tracked public `.env` + `.env.example` |
| Local Cursor | Tracked `.env` + gitignored `.env.local` (service role / overrides) |
| Lovable preview | Committed `.env` for `VITE_*`; optional Cloud Secrets for service role |
| Production host | Dashboard env vars override file values; never rely on staging `.env` alone |
| True secrets | Service role and third-party keys: `.env.local` / Lovable Secrets / host env — never git |
