# Database Overview — InsureBroker CRM

Read-only discovery from `supabase/migrations/` (16 files), `supabase/config.toml`, and `src/integrations/supabase/types.ts`.  
**No database or application code was modified for this document.**

| | |
| --- | --- |
| **Engine** | PostgreSQL via Supabase (PostgREST 14.x types) |
| **Project id** | `boystbdsqubnwsatsxal` (`supabase/config.toml`) |
| **Public tables** | 32 |
| **Views** | 1 (`v_renewals`) |
| **Enums** | 10 |
| **Edge Functions** | None in this repo |
| **Schema source of truth** | `supabase/migrations/*.sql` |

Companion docs:

- [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) — per-table reference  
- [`DATABASE_RELATIONSHIPS.md`](./DATABASE_RELATIONSHIPS.md) — relationships + Mermaid ER  
- [`ENV_REVIEW.md`](./ENV_REVIEW.md) — how the app connects to Supabase  

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React / TanStack Start                                     │
│  Browser Supabase client (publishable key + user JWT)       │
│  Server fns → service role only for Auth Admin ops          │
└───────────────────────────┬─────────────────────────────────┘
                            │ PostgREST / Auth / Storage
┌───────────────────────────▼─────────────────────────────────┐
│  Supabase                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ auth.users  │  │ public.*     │  │ storage.objects    │ │
│  │ (GoTrue)    │──│ CRM / Accts  │  │ bucket:            │ │
│  └─────────────┘  │ Ops schema   │  │ crm-documents      │ │
│                   │ + RLS        │  └────────────────────┘ │
│                   │ + triggers   │                         │
│                   └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

**Domains inside `public`:**

| Domain | Tables |
| --- | --- |
| Identity & org | `profiles`, `user_roles`, `teams` |
| Master data | `insurance_companies`, `insurance_types`, `deal_stages`, `lead_sources`, `company_commission_rates`, `app_settings`, `expense_categories` |
| Sales CRM | `clients`, `deals`, `deal_policies`, `deal_documents`, `user_targets` |
| Policies / docs | `policies`, `documents`, `document_versions`, `activity_log` |
| Accounts | `receivables`, `invoices`, `installments`, `payments`, `commission_payables`, `accounts_audit_log` |
| Travel specialty | `travel_postings`, `travel_posting_rows`, `email_history` |
| HR / ops | `payroll_runs`, `salary_revisions`, `expenses`, `reimbursements` |

---

## 2. Database philosophy

1. **BaaS-first authorization** — RLS on every business table; UI role checks are secondary.
2. **Money math in the database** — deal commission/income fields are mostly `GENERATED ALWAYS … STORED` columns; tax rates (17% commission, 9% marketing) are baked into formulas.
3. **Ownership snapshots** — `do_id`, `team_lead_id`, `team_id` copied onto clients/deals at insert so historical access survives team moves.
4. **Automation via triggers** — won deals → receivables; Invoice Issued stage → invoice; payments allocate installments; travel posting balance gates Won.
5. **Hard deletes only** — no `deleted_at` / soft-delete strategy.
6. **Coarse RBAC** — `app_role` enum (`admin`, `management`, `team_lead`, `do`) via `user_roles` + `has_role()`. No fine-grained permissions table.
7. **Single-tenant org** — one brokerage; “tenancy” is team/DO scoping, not multi-org SaaS.

---

## 3. Entity relationships (summary)

See [`DATABASE_RELATIONSHIPS.md`](./DATABASE_RELATIONSHIPS.md) for full Mermaid diagrams.

Core chain:

```
auth.users 1—1 profiles
profiles N—1 teams
user_roles N—1 auth.users (M:N roles via junction)

clients N—1 teams / profiles (do, team_lead)
deals N—1 clients, stages, companies, types, sources, teams
deals 1—0..1 receivables (unique deal_id)
receivables 1—N installments, payments
receivables 1—N commission_payables
deals 1—N invoices (also receivable-linked or stage-issued)
deals 1—0..1 travel_postings 1—N travel_posting_rows
deals 1—N deal_policies (bulk)
```

---

## 4. Authentication model

| Piece | Behavior |
| --- | --- |
| Identity store | Supabase Auth (`auth.users`) |
| App profile | `public.profiles` PK = `auth.users.id`, **ON DELETE CASCADE** |
| Roles | `public.user_roles` (`user_id`, `role` UNIQUE); default role on signup = `do` |
| Signup trigger | `handle_new_user()` AFTER INSERT on `auth.users` |
| Lock / force reset | `profiles.is_locked`, `profiles.must_reset_password` |
| Provisioning | Admin UI → server fn + **service role** Auth Admin API (no public signup in product UI) |
| Session | JWT in browser; RLS uses `auth.uid()` |

Helpers (SECURITY DEFINER):

- `has_role(_user_id, _role)` — EXISTS in `user_roles`  
- `current_user_team()` — `profiles.team_id` for current user  

Execute on these helpers is revoked from `anon` / inappropriate roles (see early migrations).

---

## 5. Security model

### Enforcement layers

1. **Postgres RLS** — primary data boundary for authenticated clients  
2. **SECURITY DEFINER functions** — role/team helpers + triggers that run with elevated rights for automation  
3. **Service role** — only in server functions for Auth Admin / privileged writes that must bypass RLS  
4. **UI `hasRole()`** — navigation/UX only; not a security boundary  

### Role visibility (typical)

| Role | Clients / deals (pattern) |
| --- | --- |
| `admin` | All |
| `management` | Broad read (and some write via specific policies) |
| `team_lead` | Team via `team_id` / `team_lead_id` snapshot |
| `do` | Own via `created_by` / `assigned_do_id` / `do_id` |

### Storage

Bucket **`crm-documents`** (referenced in policies; bucket creation not in migration SQL).  
Policies: authenticated users may read if admin or object owner; insert as owner; update/delete admin or owner.

### Exposure risks (highlights)

| Risk | Detail |
| --- | --- |
| Publishable key in client | Expected; relies on RLS |
| `profiles` SELECT = `true` for authenticated | All users can read all profiles (emails/names) |
| `teams` SELECT = `true` | Org-wide team list |
| Master data SELECT = `true` | Intentional for dropdowns |
| `email_history` SELECT = `true` | Any authenticated user can read all sent emails |
| `deal_policies` / travel RLS | Policies only check parent row **exists**, not deal ownership predicates — weaker than `deals` RLS |
| Accounts write paths | Many account tables: admin ALL; DO/TL often read-only |
| Service role misuse | Would bypass all RLS — keep off `VITE_*` and out of git |
| No soft delete | Accidental hard delete is permanent (admin-gated on many tables) |
| Document tables unused in app | Schema/RLS exist; little product surface — drift risk |

Full policy inventory: [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md).

---

## 6. Naming conventions

| Pattern | Convention |
| --- | --- |
| Tables | `snake_case`, plural nouns |
| PKs | `id UUID DEFAULT gen_random_uuid()` |
| FKs | `<entity>_id` |
| Timestamps | `created_at`, `updated_at` (`timestamptz`, default `now()`) |
| Booleans | `is_*`, `active`, `must_*` |
| Human numbers | Prefix + sequence: `DEAL-`, `RCV-`, `INV-`, `PAY-`, `CLI-`, `EXP-`, `RMB-` |
| Enums | `snake_case` type names |
| RLS policies | Short snake names (`deals_select`, `pol_sel`, …) — style varies by migration era |
| Triggers | `tg_*` functions; `trg_*` / `*_updated` trigger names |
| Views | `v_*` prefix (`v_renewals`) |

---

## 7. Migration strategy

- Folder: `supabase/migrations/`  
- Filenames: `YYYYMMDDHHMMSS_<uuid>.sql` (Lovable/Supabase style)  
- Apply in timestamp order; several migrations are tiny follow-ups (REVOKE, DROP NOT NULL, view security_invoker)  
- Regenerated TypeScript types: `src/integrations/supabase/types.ts`  
- Prefer additive migrations; avoid rewriting applied history on shared environments  
- Seed data lives inside migrations (teams, companies, stages, expense categories, commission rate matrix)

**Evolution arc:**

1. Core CRM (teams, profiles, clients, deals, masters)  
2. Policies/documents/renewals + storage policies  
3. Ownership snapshots + targets + deal_type  
4. Accounts module (receivables → payments → payables)  
5. Invoice workflow, travel posting, email log  
6. Payroll / expenses / reimbursements  

---

## 8. Summary of schemas

| Schema | Contents |
| --- | --- |
| `public` | All CRM/ERP tables, views, enums, helpers |
| `auth` | Supabase-managed users (referenced by FKs; not migrated in-repo) |
| `storage` | Policies on `storage.objects` for `crm-documents` |

**Extensions:** none explicitly created in these migrations (uses built-ins: `gen_random_uuid()`, etc.).

**Materialized views:** none.

**Sequences:** `deal_number_seq`, `invoice_number_seq`, `receivable_number_seq`, `payable_number_seq`, `invoice_issued_seq`, `client_code_seq`, `expense_seq`, `reimbursement_seq`.

---

## 9. Unused / duplicated / legacy notes

| Object | Status |
| --- | --- |
| `deal_documents` | Schema + RLS; **no app queries found** |
| `documents` / `document_versions` | Schema + RLS; **no app queries found** (uploads go to Storage from expenses/reimbursements) |
| `activity_log` | Schema + RLS; **no app queries found** |
| `v_renewals` | View exists; renewals UI queries `policies` + `deals` directly |
| `salary_revisions` | Read in ops reports only; no dedicated write UI found |
| Dual document models | `deal_documents` (legacy) vs `documents`/`document_versions` (enterprise plan) — overlapping intent |
| Dual invoice paths | Won→receivable invoice vs “Invoice Issued” stage invoice (nullable `receivable_id`) |
| `teams.lead_id` | FK to `auth.users` from foundation; later migration’s `REFERENCES profiles` is effectively a no-op if column already exists |

---

## 10. Performance posture (summary)

Recommendations only — no changes made. Details in §Performance of this overview’s companion thinking; key points:

- Dashboards often `select` large deal sets and aggregate in the browser.  
- FK columns generally indexed on hot paths (`deals.stage_id`, `team_id`, `assigned_do_id`, etc.); some newer FKs may lack indexes.  
- RLS policies with `has_role` / subqueries run per row — fine at small scale; watch as volume grows.  
- Generated columns avoid recompute on read but increase write cost slightly.  
- N+1 risk in UI: multiple parallel `from()` calls per page (mitigated somewhat by `Promise.all`, not by joins).

---

## 11. Application usage (Phase 5 summary)

| Feature area | Primary tables | Flow |
| --- | --- | --- |
| Auth session | `profiles`, `user_roles` | JWT → load roles/profile → RLS uses `auth.uid()` |
| Dashboard / analytics / income | `deals`, `deal_stages`, companies, `policies`, targets | Read + client aggregate |
| Clients / deals / pipeline | `clients`, `deals`, masters, `deal_policies` | CRUD under RLS; autofill triggers |
| Deal detail | `deals`, invoices, travel_*, `email_history` | Stage changes fire invoice/travel guards |
| Renewals | `policies`, `deals` | Read; classify by end dates in UI |
| Accounts | receivables → installments/payments/invoices/payables | Won trigger creates receivable; payment trigger allocates |
| Ops HR | payroll, expenses, reimbursements | Admin/mgmt write; storage for attachments |
| Admin users | Auth Admin API + `profiles`/`user_roles` | Service role server fns |
| Master data | companies, types, stages, sources, CCR, settings | Admin write |

Full feature→table matrix: see [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) “Used by” per table, and relationships doc for ER.

---

*Phase 1–6 discovery complete. Schema changes should start from new migrations only after product approval.*
