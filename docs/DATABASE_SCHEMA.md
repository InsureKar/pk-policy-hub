# Database Schema — InsureBroker CRM

Per-table reference derived from migrations + generated `types.ts`.  
**No schema or application code was modified.**

Conventions in this doc:

- **N** = NOT NULL, **Y** = nullable  
- RLS summarized at policy intent level (not every historical DROP/CREATE)  
- “Used by” = application routes/libs found in `src/`  

---

## Enums

| Enum | Values |
| --- | --- |
| `app_role` | `admin`, `management`, `team_lead`, `do` |
| `line_of_business` | `group_health`, `motor`, `marine`, `travel`, `fire`, `misc` |
| `deal_type` | `fresh`, `renewal` |
| `policy_type_kind` | `single`, `bulk` |
| `payment_schedule_type` | `annual`, `half_yearly`, `quarterly`, `monthly` |
| `receivable_status` | `open`, `partial`, `paid`, `overdue`, `cancelled` |
| `installment_status` | `pending`, `partial`, `paid`, `overdue` |
| `payable_status` | `pending`, `paid`, `cancelled` |
| `payment_method_type` | `cash`, `cheque`, `ibft`, `bank_transfer`, `online`, `other` |
| `invoice_status` | `draft`, `pending_approval`, `approved`, `rejected`, `sent` |

---

## View: `v_renewals`

| | |
| --- | --- |
| **Purpose** | `policies` rows + computed `renewal_status` (`expired` / `due` / `upcoming` / `completed`) |
| **Security** | `security_invoker = true` (uses caller RLS on underlying `policies`) |
| **Used by** | Not queried by app today (renewals page hits `policies` + `deals`) |

---

## `teams`

**Purpose:** Sales teams (location + lead).

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | N | `gen_random_uuid()` |
| name | text | N | — (UNIQUE) |
| location | text | N | `''` |
| lead_id | uuid | Y | — → `auth.users` ON DELETE SET NULL |
| created_at / updated_at | timestamptz | N | `now()` |

- **PK:** `id`  
- **Indexes:** none beyond PK/UNIQUE name  
- **Triggers:** `teams_updated` → `tg_set_updated_at`  
- **RLS:** SELECT all authenticated; ALL for admin  
- **Used by:** `/teams`, user admin, deal detail, leads, analytics, reports  

---

## `profiles`

**Purpose:** App user profile (1:1 with `auth.users`).

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | N | = `auth.users.id` CASCADE |
| full_name | text | N | `''` |
| email | text | N | — |
| phone / designation | text | Y | — |
| team_id | uuid | Y | → teams SET NULL |
| must_reset_password | bool | N | false |
| is_locked | bool | N | false |
| commission_share_percentage | numeric(6,3) | N | 0 |
| department | text | Y | — |
| monthly_salary / salary_tax_percentage / default_allowances / default_deductions | numeric | Y/various | — |
| joining_date | date | Y | — |
| employment_status | text | Y | `'active'` |
| created_at / updated_at | timestamptz | N | `now()` |

- **PK:** `id`  
- **Triggers:** `profiles_updated`; created by `handle_new_user`  
- **RLS:** SELECT all authenticated; UPDATE self; ALL admin  
- **Used by:** Auth context, users, teams, payroll, nearly all assignment UIs  

---

## `user_roles`

**Purpose:** Role assignments (junction user↔role).

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | N | `gen_random_uuid()` |
| user_id | uuid | N | → auth.users CASCADE |
| role | app_role | N | — |
| created_at | timestamptz | N | `now()` |

- **UNIQUE:** `(user_id, role)`  
- **RLS:** SELECT own or admin; ALL admin  
- **Used by:** Auth context, `/users`, leads/review/targets filters, server `has_role`  

---

## `insurance_companies`

**Purpose:** Insurer master list.

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | N | `gen_random_uuid()` |
| name | text | N | UNIQUE |
| active | bool | N | true |
| created_at | timestamptz | N | `now()` |

- **RLS:** SELECT authenticated; ALL admin  
- **Used by:** Master, deals, dashboard, renewals, analytics, accounts reports  
- **Seed:** EFU, Jubilee, Adamjee, … + United Insurance; later merge of short names  

---

## `insurance_types`

**Purpose:** Product / line labels (Motor, Health, Travel, …).

Same shape as companies (`name` UNIQUE, `active`, `created_at`).  
**Used by:** Master, deals, review, invoices, reports.

---

## `deal_stages`

**Purpose:** Pipeline stages.

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | N | `gen_random_uuid()` |
| name | text | N | UNIQUE |
| sort_order | int | N | 0 |
| is_won / is_lost | bool | N | false |
| created_at | timestamptz | N | `now()` |

- **Seed:** New Lead → … → Won/Lost; later **Invoice Issued** (sort 35)  
- **Used by:** Pipeline, deals, dashboard, triggers (`is_won`, name checks)  

---

## `lead_sources`

**Purpose:** Deal source master (Referral, Website, …).  
Shape like companies. **Used by:** Master, deal forms.

---

## `app_settings`

**Purpose:** Key/value JSON settings.

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| key | text | N | PK |
| value | jsonb | N | — |
| updated_at | timestamptz | N | `now()` |

- **Seed keys:** `tagged_premium_base_percentage` (13), `commission_tax_percentage` (17), `marketing_tax_percentage` (9)  
- **RLS:** SELECT all auth; ALL admin  
- **Used by:** Dashboard, deals calc, master, settings  

---

## `clients`

**Purpose:** Individual/corporate clients.

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | N | `gen_random_uuid()` |
| client_code | text | Y | UNIQUE; auto `CLI-YYYY-######` |
| client_type | text | N | `'corporate'` CHECK individual\|corporate |
| company_name | text | N | — |
| full_name, phone, email, address, city, cnic, date_of_birth | various | Y | — |
| poc_* , industry, ntn, existing_insurance_company, notes | text | Y | — |
| created_by | uuid | N | → auth.users **RESTRICT** |
| team_id | uuid | Y | → teams SET NULL |
| do_id / team_lead_id | uuid | Y | → profiles SET NULL |
| created_at / updated_at | timestamptz | N | `now()` |

- **Indexes:** `created_by`, `team_id`, `client_type`, `do_id`, `team_lead_id`, `phone`, `cnic`  
- **Triggers:** `clients_updated`, `clients_autofill` (ownership), `clients_set_code`  
- **RLS:** Scoped select/update by admin/mgmt/TL/do ownership; insert `created_by=uid`; delete admin  
- **Used by:** `/clients`, deal forms, renewals, invoices, receivables  

---

## `deals`

**Purpose:** Central sales/finance entity (premium + pipeline).

### Input / ownership columns

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | N | PK |
| deal_number | text | N | UNIQUE `DEAL-######` via sequence |
| client_id | uuid | Y | → clients SET NULL |
| cover_note_number / policy_number / notes | text | Y | — |
| source_id / insurance_company_id / insurance_type_id / stage_id | uuid | Y | → masters SET NULL |
| insurance_company_id_payment | uuid | Y | → insurance_companies |
| assigned_do_id | uuid | Y | → auth.users SET NULL |
| team_id | uuid | Y | → teams SET NULL |
| team_lead_id / received_by | uuid | Y | → profiles SET NULL |
| deal_type | deal_type | N | `'fresh'` |
| policy_type | policy_type_kind | N | `'single'` |
| posting_status | text | N | `'not_required'` |
| base_premium | numeric(14,2) | Y | — |
| gross_premium / net_premium | numeric(14,2) | N | 0 |
| commission_percentage / marketing_budget_percentage | numeric(6,3) | N | 0 |
| loading / b2b_commission | numeric(14,2) | N | 0 |
| policy_start_date / policy_end_date | date | Y | — |
| payment_* fields | date/text | Y | schedule, mode, refs, remarks |
| created_by | uuid | N | → auth.users **RESTRICT** |
| created_at / updated_at | timestamptz | N | `now()` |

### Generated columns (STORED)

| Column | Formula (summary) |
| --- | --- |
| commission_before_tax | `ROUND(commission% * gross / 100, 2)` |
| commission_after_tax | before × **0.83** (17% tax) |
| marketing_before_tax | `ROUND(marketing% * gross / 100, 2)` |
| marketing_after_tax | before × **0.91** (9% tax) |
| total_income | comm_after + mkt_after + loading + b2b |
| income_percentage | total_income / gross × 100 (0 if gross ≤ 0) |

`net_premium` is trigger-maintained: `GREATEST(0, gross - commission%×gross/100)`.

- **Indexes:** assigned, team, stage, created_at, team_lead_id, policy_number, stage_id  
- **Triggers:** `deals_updated`, `tg_deals_autofill`, `tg_deal_won_to_receivable`, `tg_deal_invoice_issued`, `tg_deal_travel_posting_guard`  
- **RLS:** admin/mgmt/TL (team or team_lead_id)/assigned_do/created_by; insert created_by=uid; delete admin  
- **Used by:** Dashboard, pipeline, deals list/new/detail, leads, review, renewals, income, analytics, accounts, ops  

---

## `deal_policies`

**Purpose:** Bulk policy line items under a deal.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| deal_id | uuid | → deals CASCADE |
| row_number | int | |
| cover_note_number / policy_number / remarks | text | |
| gross_premium / net_premium | numeric | |
| created_at / updated_at | timestamptz | |

- **RLS:** read/write if parent deal row EXISTS (weaker than deals ownership)  
- **Used by:** `/deals/new` (write)  

---

## `deal_documents`

**Purpose:** Legacy deal/client file metadata.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| deal_id / client_id | uuid | CASCADE to parents |
| file_name / storage_path | text N | |
| doc_type | text Y | |
| uploaded_by | uuid N | → auth.users |
| created_at | timestamptz | |

- **RLS:** admin/mgmt/uploader or via deal/client ownership  
- **Used by:** **None in app (schema only)**  

---

## `company_commission_rates`

**Purpose:** Commission % by company × line of business.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| company_id | uuid | → insurance_companies CASCADE |
| line_of_business | enum | |
| percentage | numeric(6,3) | DEFAULT 0 |
| created_at / updated_at | timestamptz | |
| UNIQUE | (company_id, line_of_business) | |

- **RLS:** SELECT all; ALL admin  
- **Used by:** `/master` commissions tab  
- **Seed:** all companies × all LOB at 0%  

---

## `policies`

**Purpose:** Standalone policy records for renewals/tracking.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| policy_number | text N | |
| client_id | uuid | → clients CASCADE |
| deal_id | uuid | → deals SET NULL |
| company_id | uuid | → insurance_companies SET NULL |
| line_of_business | enum Y | |
| premium | numeric(14,2) N | DEFAULT 0 |
| start_date / end_date | date N | |
| status | text N | DEFAULT `'active'` |
| owner_id | uuid | → profiles SET NULL |
| team_id | uuid | → teams SET NULL |
| created_at / updated_at | timestamptz | |

- **Indexes:** end_date, owner_id, team_id  
- **RLS:** admin/mgmt/TL-team/owner  
- **Used by:** `/renewals`, `/analytics`  

---

## `documents` / `document_versions`

**Purpose:** Enterprise document library + version history.

**`documents`:** name, document_type, client_id, policy_id, company_id, tags[], storage_path, mime_type, size_bytes, version, uploaded_by, team_id, timestamps.

**`document_versions`:** document_id CASCADE, version, storage_path, size_bytes, uploaded_by, created_at.

- **RLS:** scoped by admin/mgmt/TL/uploader; versions via parent existence  
- **Used by:** **None in app (schema only)**  

---

## `activity_log`

**Purpose:** Generic activity feed.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| actor_id | uuid | → profiles SET NULL |
| action / entity_type | text N | |
| entity_id | uuid Y | |
| metadata | jsonb N | DEFAULT `{}` |
| created_at | timestamptz | indexed DESC |

- **RLS:** SELECT admin/mgmt/actor; INSERT actor=uid  
- **Used by:** **None in app (schema only)**  

---

## `user_targets`

**Purpose:** Monthly sales targets per user.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid N | → profiles CASCADE |
| period_month | date N | |
| target_amount | numeric(14,2) N | DEFAULT 0 |
| created_by | uuid Y | → auth.users SET NULL |
| created_at / updated_at | timestamptz | |
| UNIQUE | (user_id, period_month) | |

- **RLS:** admin/mgmt ALL; self SELECT; TL can read team  
- **Used by:** `/dashboard`, `/targets`  

---

## `receivables`

**Purpose:** Premium receivable per won deal (1:1 with deal).

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| receivable_number | text N | UNIQUE `RCV-######` |
| deal_id | uuid N | UNIQUE → deals **RESTRICT** |
| client_id / team_id | uuid Y | |
| assigned_do_id | uuid Y | → auth.users |
| team_lead_id | uuid Y | → profiles |
| premium / total / paid / outstanding amounts | numeric | |
| payment_schedule | enum | DEFAULT annual |
| installment_count | int | DEFAULT 1 |
| status | receivable_status | DEFAULT open |
| dates / notes / created_by | various | |
| created_at / updated_at | timestamptz | |

- **Indexes:** deal, do, team, status (from accounts migration)  
- **Created by:** `tg_deal_won_to_receivable`  
- **RLS:** admin ALL; mgmt SELECT; TL/DO scoped SELECT  
- **Used by:** Accounts dashboard, receivables, payments, installments, invoices, reports  

---

## `invoices`

**Purpose:** Customer invoices (auto from won, issued-stage, or manual).

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| invoice_number | text N | UNIQUE |
| receivable_id | uuid Y | → receivables CASCADE (nullable) |
| deal_id | uuid Y | → deals CASCADE (nullable) |
| client_id | uuid Y | |
| insurance_type_id | uuid Y | |
| issue_date / due_date | date | |
| total_amount | numeric | |
| status | invoice_status | DEFAULT draft |
| approval fields | approved_*/rejected_*/reason | |
| invoice_kind | text | e.g. auto / issued_stage |
| parent_invoice_id | uuid Y | → invoices CASCADE (installment invoices) |
| installment_index / installment_total | int Y | |
| payment_schedule | enum Y | |
| description / notes | text Y | |
| created_by / sent_at / timestamps | various | |

- **RLS:** admin|management ALL; scoped SELECT for creators / via receivable TL/DO  
- **Used by:** `/accounts/invoices`, `/accounts/approvals`, deal detail  

---

## `installments`

**Purpose:** Scheduled receivable slices.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| receivable_id | uuid | → receivables CASCADE |
| installment_number | int | UNIQUE per receivable |
| due_date | date | |
| amount / paid / remaining | numeric | |
| status | installment_status | DEFAULT pending |
| paid_at | timestamptz Y | |
| created_at / updated_at | timestamptz | |

- **Updated by:** `tg_payment_apply` (FIFO)  
- **Used by:** `/accounts/installments`, receivables UI  

---

## `payments`

**Purpose:** Cash applied to receivables.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| receivable_id | uuid | → receivables **RESTRICT** |
| installment_id | uuid Y | → installments SET NULL |
| amount | numeric | CHECK > 0 |
| payment_date | date | |
| payment_method | enum | DEFAULT bank_transfer |
| refs / attachment_url / notes | text | |
| received_by / recorded_by | uuid Y | |
| created_at | timestamptz | |

- **Trigger:** `tg_payment_apply` → installments + receivable status + commission_payables on full pay  
- **Used by:** Receivables (write), payments list, reports  

---

## `commission_payables`

**Purpose:** Commission owed to DO/TL after receivable paid.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| payable_number | text | `PAY-######` |
| receivable_id / deal_id | uuid | CASCADE |
| beneficiary_id | uuid | → profiles **RESTRICT** |
| beneficiary_role | text | e.g. do / team_lead |
| commission_amount | numeric | |
| dates / method / refs / proof_url / status / remarks | various | |
| UNIQUE | (receivable_id, beneficiary_id, beneficiary_role) | |

- **Created by:** payment trigger using `profiles.commission_share_percentage` × deal `commission_after_tax`  
- **Used by:** Payables, ops commissions/performance/reports  

---

## `accounts_audit_log`

**Purpose:** Immutable-ish accounts audit trail.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| entity_type / entity_id / action | text/uuid | |
| actor_id | uuid Y | |
| previous_value / new_value | jsonb Y | |
| ip_address | text Y | |
| created_at | timestamptz | |

- **RLS:** SELECT admin|mgmt; INSERT if `auth.uid() IS NOT NULL`; no UPDATE/DELETE policies  
- **Used by:** Payables (write); created by won-deal trigger  

---

## `travel_postings` / `travel_posting_rows`

**Purpose:** Travel deal posting reconciliation.

**Header (`travel_postings`):** deal_id UNIQUE CASCADE; total_policy_amount; total_posting_amount; posting_from/to; status; CHECK to ≥ from.

**Rows (`travel_posting_rows`):** posting_id CASCADE; sr_no; agent fields; policy_number; premium; commission_percentage; company_id; remarks.

- **Triggers:** recalc status → sync `deals.posting_status`; guard blocks Won unless `balanced` for Travel  
- **RLS:** ALL if parent deal/posting EXISTS  
- **Used by:** Deal detail (`/deals/$id`)  

---

## `email_history`

**Purpose:** Log of emails sent from deal/invoice flows.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| deal_id / invoice_id / client_id | uuid Y | SET NULL |
| recipient / subject | text N | |
| body | text Y | |
| sent_by | uuid | |
| status | text | DEFAULT sent |
| attachments | jsonb | DEFAULT `[]` |
| created_at | timestamptz | |

- **RLS:** SELECT **true** (all authenticated); INSERT `sent_by=uid`  
- **Used by:** Deal detail (write)  
- **Security note:** Broad read exposure  

---

## `payroll_runs`

**Purpose:** Monthly payroll lines per employee.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| profile_id | uuid | → profiles CASCADE |
| period_year / period_month | int | month CHECK 1–12 |
| gross/tax/deductions/bonuses/allowances/net | numeric | |
| status / paid_at / payment_method / reference / remarks | various | |
| created_by | uuid Y | |
| UNIQUE | (profile_id, year, month) | |

- **Trigger:** `tg_payroll_calc` sets net_salary  
- **RLS:** ALL admin|management  
- **Used by:** `/operations/payroll`, ops dashboards/reports  

---

## `salary_revisions`

**Purpose:** Salary change history.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| profile_id | uuid | CASCADE |
| effective_date | date | |
| previous_salary / new_salary | numeric | |
| reason | text Y | |
| created_by / created_at | | |

- **RLS:** ALL admin|management  
- **Used by:** Ops reports (read only in app)  

---

## `expense_categories`

**Purpose:** Hierarchical expense/reimbursement categories.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| parent_id | uuid Y | → self CASCADE |
| name / slug | text | slug UNIQUE |
| is_system | bool | DEFAULT false |
| created_at | timestamptz | |

- **RLS:** SELECT admin|mgmt; ALL admin  
- **Used by:** Expenses, reimbursements, ops reports  
- **Seed:** Admin/HR/Tech/… + Reimbursement subtree  

---

## `expenses`

**Purpose:** Company expenses.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| expense_code | text UNIQUE | `EXP-YYYY-######` |
| category_id / subcategory_id | uuid | → expense_categories |
| amounts / vendor / invoice_number / payment_* / expense_date | various | |
| attachment_url | text Y | Storage path/URL |
| approval_status / approved_by | | DEFAULT approved |
| created_by | uuid N | → auth.users |
| created_at / updated_at | timestamptz | |

- **RLS:** ALL admin|management  
- **Used by:** `/operations/expenses` (+ `crm-documents` upload)  

---

## `reimbursements`

**Purpose:** Employee reimbursement requests.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| request_code | text UNIQUE | `RMB-YYYY-######` |
| employee_id | uuid | → profiles CASCADE |
| category_id | uuid | |
| description / amount / expense_date / attachment / remarks | | |
| status | text | DEFAULT submitted |
| review / pay fields | reviewed_*, paid_*, rejection_reason | |
| created_by | uuid N | |
| created_at / updated_at | timestamptz | |

- **RLS:** SELECT own|admin|mgmt; INSERT own; UPDATE admin|mgmt or own if draft/submitted; DELETE admin  
- **Used by:** `/operations/reimbursements` (+ storage)  

---

## Storage: `crm-documents`

| Policy | Command | Rule |
| --- | --- | --- |
| docs_bucket_read | SELECT | bucket + (admin OR owner = uid) |
| docs_bucket_insert | INSERT | bucket + owner = uid |
| docs_bucket_update | UPDATE | admin OR owner |
| docs_bucket_delete | DELETE | admin OR owner |

Bucket creation is **not** in migration SQL (must exist in Supabase project).  
**App uploads:** expenses, reimbursements.

---

## Functions & triggers (catalog)

| Function | Kind | Purpose |
| --- | --- | --- |
| `has_role` | SECURITY DEFINER | RLS role check |
| `current_user_team` | SECURITY DEFINER | RLS team id |
| `handle_new_user` | SECURITY DEFINER | Profile + default `do` role |
| `tg_set_updated_at` | trigger fn | Touch `updated_at` |
| `tg_clients_autofill` | SECURITY DEFINER | Ownership snapshot on client insert |
| `tg_deals_autofill` | SECURITY DEFINER | Ownership + net_premium |
| `tg_clients_set_code` | SECURITY DEFINER | Client codes |
| `tg_deal_won_to_receivable` | SECURITY DEFINER | Won → receivable/invoice/installments |
| `tg_payment_apply` | SECURITY DEFINER | Payment allocation + payables |
| `tg_deal_invoice_issued` | SECURITY DEFINER | Invoice Issued stage → invoice |
| `tg_deal_travel_posting_guard` | SECURITY DEFINER | Block Won unless travel balanced |
| `tg_travel_posting_recalc` / `_amt_change` | SECURITY DEFINER | Travel status sync |
| `tg_payroll_calc` | trigger fn | Net salary |
| `tg_expense_code` / `tg_reimb_code` | trigger fn | Human codes |

---

## Feature → tables quick matrix

| Feature | Tables |
| --- | --- |
| Auth | profiles, user_roles |
| Dashboard / Analytics / Income | deals, deal_stages, insurance_*, policies, user_targets, app_settings |
| Clients | clients |
| Deals / Pipeline / Leads | deals, deal_policies, clients, masters, profiles, teams |
| Renewals | policies, deals, clients, insurance_companies |
| Master / Settings | masters, company_commission_rates, app_settings, profiles |
| Users / Teams / Targets | profiles, user_roles, teams, user_targets, deals |
| Accounts | receivables, invoices, installments, payments, commission_payables, accounts_audit_log, deals, clients |
| Travel / Email on deal | travel_postings, travel_posting_rows, email_history, invoices |
| Ops | payroll_runs, salary_revisions, expenses, expense_categories, reimbursements, commission_payables, deals |
| Unused in UI | deal_documents, documents, document_versions, activity_log, v_renewals |

---

*See also [`DATABASE_OVERVIEW.md`](./DATABASE_OVERVIEW.md) and [`DATABASE_RELATIONSHIPS.md`](./DATABASE_RELATIONSHIPS.md).*
