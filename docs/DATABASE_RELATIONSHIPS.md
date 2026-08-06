# Database Relationships — InsureBroker CRM

Relationship catalog and ER diagrams from migrations.  
**No schema or application code was modified.**

Legend:

| Notation | Meaning |
| --- | --- |
| **1—1** | One-to-one |
| **1—N** | One-to-many |
| **N—M** | Many-to-many (via junction) |
| **0..1** | Optional |
| **CASCADE / SET NULL / RESTRICT** | ON DELETE behavior |

---

## 1. Relationship inventory

### Identity & organization

| From | To | Cardinality | FK / notes | ON DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | `auth.users` | **1—1** | `profiles.id` | CASCADE |
| `profiles` | `teams` | N—0..1 | `profiles.team_id` | SET NULL |
| `teams` | `auth.users` | N—0..1 | `teams.lead_id` | SET NULL |
| `user_roles` | `auth.users` | N—1 | junction for roles | CASCADE |
| `user_roles` | role enum | N—1 | `role` (`app_role`) | — |

Roles are **N—M** between users and role values via `user_roles` (UNIQUE user_id+role).

### Sales CRM

| From | To | Cardinality | FK | ON DELETE |
| --- | --- | --- | --- | --- |
| `clients` | `auth.users` | N—1 | `created_by` | **RESTRICT** |
| `clients` | `teams` | N—0..1 | `team_id` | SET NULL |
| `clients` | `profiles` | N—0..1 | `do_id`, `team_lead_id` | SET NULL |
| `deals` | `clients` | N—0..1 | `client_id` | SET NULL |
| `deals` | `lead_sources` | N—0..1 | `source_id` | SET NULL |
| `deals` | `insurance_companies` | N—0..1 | `insurance_company_id`, `insurance_company_id_payment` | SET NULL / default |
| `deals` | `insurance_types` | N—0..1 | `insurance_type_id` | SET NULL |
| `deals` | `deal_stages` | N—0..1 | `stage_id` | SET NULL |
| `deals` | `auth.users` | N—0..1 / N—1 | `assigned_do_id` / `created_by` | SET NULL / **RESTRICT** |
| `deals` | `teams` | N—0..1 | `team_id` | SET NULL |
| `deals` | `profiles` | N—0..1 | `team_lead_id`, `received_by` | SET NULL |
| `deal_policies` | `deals` | N—1 | `deal_id` | CASCADE |
| `deal_documents` | `deals` / `clients` | N—0..1 | optional parents | CASCADE |
| `user_targets` | `profiles` | N—1 | `user_id` | CASCADE |
| `company_commission_rates` | `insurance_companies` | N—1 | `company_id` | CASCADE |

### Policies & documents

| From | To | Cardinality | FK | ON DELETE |
| --- | --- | --- | --- | --- |
| `policies` | `clients` | N—0..1 | `client_id` | CASCADE |
| `policies` | `deals` | N—0..1 | `deal_id` | SET NULL |
| `policies` | `insurance_companies` | N—0..1 | `company_id` | SET NULL |
| `policies` | `profiles` / `teams` | N—0..1 | owner/team | SET NULL |
| `documents` | `clients` / `policies` / `companies` | N—0..1 | optional | SET NULL |
| `document_versions` | `documents` | N—1 | `document_id` | CASCADE |
| `activity_log` | `profiles` | N—0..1 | `actor_id` | SET NULL |

### Accounts

| From | To | Cardinality | FK | ON DELETE |
| --- | --- | --- | --- | --- |
| `receivables` | `deals` | **1—0..1** (unique `deal_id`) | `deal_id` | **RESTRICT** |
| `receivables` | `clients` / `teams` / DO / TL | N—0..1 | ownership | SET NULL |
| `invoices` | `receivables` | N—0..1 | `receivable_id` | CASCADE |
| `invoices` | `deals` | N—0..1 | `deal_id` | CASCADE |
| `invoices` | `invoices` | N—0..1 parent | `parent_invoice_id` | CASCADE |
| `installments` | `receivables` | N—1 | | CASCADE |
| `payments` | `receivables` | N—1 | | **RESTRICT** |
| `payments` | `installments` | N—0..1 | | SET NULL |
| `commission_payables` | `receivables` / `deals` | N—1 | | CASCADE |
| `commission_payables` | `profiles` | N—1 | `beneficiary_id` | **RESTRICT** |

### Travel & email

| From | To | Cardinality | FK | ON DELETE |
| --- | --- | --- | --- | --- |
| `travel_postings` | `deals` | **1—0..1** (unique) | `deal_id` | CASCADE |
| `travel_posting_rows` | `travel_postings` | N—1 | | CASCADE |
| `travel_posting_rows` | `insurance_companies` | N—0..1 | `company_id` | — |
| `email_history` | deals / invoices / clients | N—0..1 | | SET NULL |

### Ops / HR

| From | To | Cardinality | FK | ON DELETE |
| --- | --- | --- | --- | --- |
| `payroll_runs` | `profiles` | N—1 | | CASCADE |
| `salary_revisions` | `profiles` | N—1 | | CASCADE |
| `expense_categories` | `expense_categories` | tree | `parent_id` | CASCADE |
| `expenses` | `expense_categories` | N—0..1 | cat/subcat | — |
| `expenses` | `auth.users` | N—1 | `created_by` | — |
| `reimbursements` | `profiles` | N—1 | `employee_id` | CASCADE |
| `reimbursements` | `expense_categories` | N—0..1 | | — |

### Junction / M:N summary

| Pattern | Implementation |
| --- | --- |
| User ↔ Role | `user_roles` |
| Company ↔ LOB rates | `company_commission_rates` (not pure M:N of entities—rate matrix) |
| No classic M:N clients↔companies | Relationship is via `deals` / `policies` |

---

## 2. Ownership & multi-tenant model

Not multi-org SaaS. Scoping model:

```
Organization (implicit single tenant)
  └── teams
        └── profiles (DOs, Team Leads)
              └── ownership snapshots on clients / deals
                    (do_id, team_lead_id, team_id, assigned_do_id, created_by)
```

RLS uses snapshots + `has_role` + `current_user_team()` so historical rows remain visible to the TL/DO captured at write time.

---

## 3. Soft delete & cascades

- **Soft delete:** none (`deleted_at` absent).  
- **RESTRICT:** protects finance integrity (`clients.created_by`, `deals.created_by`, `receivables.deal_id`, `payments.receivable_id`, payable beneficiaries).  
- **CASCADE:** cleans children (installments, deal_policies, travel rows, document versions, payroll rows).  
- **SET NULL:** optional FKs when parent removed (many deal/client optional refs).

---

## 4. ER diagrams (Mermaid)

### 4.1 Identity & org

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "id 1:1"
    TEAMS ||--o{ PROFILES : "team_id"
    AUTH_USERS ||--o{ TEAMS : "lead_id"
    AUTH_USERS ||--o{ USER_ROLES : "user_id"
    USER_ROLES }o--|| APP_ROLE : "role enum"

    AUTH_USERS {
        uuid id PK
        text email
    }
    PROFILES {
        uuid id PK
        text full_name
        text email
        uuid team_id FK
        bool is_locked
        numeric commission_share_percentage
    }
    TEAMS {
        uuid id PK
        text name UK
        uuid lead_id FK
    }
    USER_ROLES {
        uuid id PK
        uuid user_id FK
        app_role role
    }
```

### 4.2 Core CRM (clients & deals)

```mermaid
erDiagram
    TEAMS ||--o{ CLIENTS : "team_id"
    PROFILES ||--o{ CLIENTS : "do_id"
    PROFILES ||--o{ CLIENTS : "team_lead_id"
    AUTH_USERS ||--o{ CLIENTS : "created_by"

    CLIENTS ||--o{ DEALS : "client_id"
    DEAL_STAGES ||--o{ DEALS : "stage_id"
    INSURANCE_COMPANIES ||--o{ DEALS : "insurance_company_id"
    INSURANCE_TYPES ||--o{ DEALS : "insurance_type_id"
    LEAD_SOURCES ||--o{ DEALS : "source_id"
    TEAMS ||--o{ DEALS : "team_id"
    AUTH_USERS ||--o{ DEALS : "assigned_do_id"
    AUTH_USERS ||--o{ DEALS : "created_by"
    PROFILES ||--o{ DEALS : "team_lead_id"

    DEALS ||--o{ DEAL_POLICIES : "bulk rows"
    DEALS ||--o{ DEAL_DOCUMENTS : "legacy files"
    CLIENTS ||--o{ DEAL_DOCUMENTS : "optional"

    CLIENTS {
        uuid id PK
        text client_code UK
        text client_type
        text company_name
        uuid do_id FK
        uuid team_lead_id FK
    }
    DEALS {
        uuid id PK
        text deal_number UK
        deal_type deal_type
        numeric gross_premium
        numeric total_income "GENERATED"
        uuid stage_id FK
        uuid client_id FK
    }
    DEAL_POLICIES {
        uuid id PK
        uuid deal_id FK
        numeric gross_premium
    }
```

### 4.3 Master data & rates

```mermaid
erDiagram
    INSURANCE_COMPANIES ||--o{ COMPANY_COMMISSION_RATES : "company_id"
    COMPANY_COMMISSION_RATES }o--|| LINE_OF_BUSINESS : "enum"
    INSURANCE_COMPANIES ||--o{ DEALS : "used by"
    INSURANCE_TYPES ||--o{ DEALS : "used by"
    DEAL_STAGES ||--o{ DEALS : "used by"
    LEAD_SOURCES ||--o{ DEALS : "used by"
    APP_SETTINGS ||--o| APP_SETTINGS : "key value"

    INSURANCE_COMPANIES {
        uuid id PK
        text name UK
        bool active
    }
    COMPANY_COMMISSION_RATES {
        uuid id PK
        uuid company_id FK
        line_of_business line_of_business
        numeric percentage
    }
```

### 4.4 Policies & documents

```mermaid
erDiagram
    CLIENTS ||--o{ POLICIES : "client_id"
    DEALS ||--o{ POLICIES : "deal_id"
    INSURANCE_COMPANIES ||--o{ POLICIES : "company_id"
    PROFILES ||--o{ POLICIES : "owner_id"
    POLICIES ||--o| V_RENEWALS : "view"

    CLIENTS ||--o{ DOCUMENTS : "client_id"
    POLICIES ||--o{ DOCUMENTS : "policy_id"
    DOCUMENTS ||--o{ DOCUMENT_VERSIONS : "document_id"
    PROFILES ||--o{ ACTIVITY_LOG : "actor_id"

    POLICIES {
        uuid id PK
        text policy_number
        date end_date
        numeric premium
    }
    DOCUMENTS {
        uuid id PK
        text storage_path
        text document_type
        int version
    }
```

### 4.5 Accounts (receivables → money)

```mermaid
erDiagram
    DEALS ||--o| RECEIVABLES : "unique deal_id"
    RECEIVABLES ||--o{ INSTALLMENTS : "contains"
    RECEIVABLES ||--o{ PAYMENTS : "receives"
    PAYMENTS }o--o| INSTALLMENTS : "optional link"
    RECEIVABLES ||--o{ INVOICES : "optional"
    DEALS ||--o{ INVOICES : "optional"
    INVOICES ||--o{ INVOICES : "parent_invoice_id"
    RECEIVABLES ||--o{ COMMISSION_PAYABLES : "on paid"
    DEALS ||--o{ COMMISSION_PAYABLES : "deal_id"
    PROFILES ||--o{ COMMISSION_PAYABLES : "beneficiary_id"

    RECEIVABLES {
        uuid id PK
        text receivable_number UK
        uuid deal_id UK
        receivable_status status
        numeric outstanding_amount
    }
    INSTALLMENTS {
        uuid id PK
        uuid receivable_id FK
        int installment_number
        installment_status status
    }
    PAYMENTS {
        uuid id PK
        uuid receivable_id FK
        numeric amount
    }
    INVOICES {
        uuid id PK
        text invoice_number UK
        invoice_status status
        uuid receivable_id FK
        uuid deal_id FK
    }
    COMMISSION_PAYABLES {
        uuid id PK
        text payable_number
        uuid beneficiary_id FK
        payable_status status
    }
```

### 4.6 Travel specialty

```mermaid
erDiagram
    DEALS ||--o| TRAVEL_POSTINGS : "unique deal_id"
    TRAVEL_POSTINGS ||--o{ TRAVEL_POSTING_ROWS : "rows"
    INSURANCE_COMPANIES ||--o{ TRAVEL_POSTING_ROWS : "company_id"
    DEALS ||--o{ EMAIL_HISTORY : "optional"
    INVOICES ||--o{ EMAIL_HISTORY : "optional"
    CLIENTS ||--o{ EMAIL_HISTORY : "optional"

    TRAVEL_POSTINGS {
        uuid id PK
        uuid deal_id UK
        numeric total_policy_amount
        numeric total_posting_amount
        text status
    }
    TRAVEL_POSTING_ROWS {
        uuid id PK
        uuid posting_id FK
        numeric premium
    }
```

### 4.7 Ops / HR

```mermaid
erDiagram
    PROFILES ||--o{ PAYROLL_RUNS : "profile_id"
    PROFILES ||--o{ SALARY_REVISIONS : "profile_id"
    PROFILES ||--o{ REIMBURSEMENTS : "employee_id"
    EXPENSE_CATEGORIES ||--o{ EXPENSE_CATEGORIES : "parent_id"
    EXPENSE_CATEGORIES ||--o{ EXPENSES : "category"
    EXPENSE_CATEGORIES ||--o{ REIMBURSEMENTS : "category"
    AUTH_USERS ||--o{ EXPENSES : "created_by"
    AUTH_USERS ||--o{ REIMBURSEMENTS : "created_by"

    PAYROLL_RUNS {
        uuid id PK
        uuid profile_id FK
        int period_year
        int period_month
        numeric net_salary
    }
    EXPENSES {
        uuid id PK
        text expense_code UK
        numeric amount
    }
    REIMBURSEMENTS {
        uuid id PK
        text request_code UK
        text status
    }
```

### 4.8 End-to-end deal money flow

```mermaid
flowchart LR
    A[Create Deal] --> B[Stage changes]
    B -->|Invoice Issued| C[invoices draft/pending]
    B -->|Won + travel balanced| D[tg_deal_won_to_receivable]
    D --> E[receivables]
    D --> F[installments]
    D --> G[invoice auto]
    E --> H[payments insert]
    H --> I[tg_payment_apply]
    I --> F
    I -->|fully paid| J[commission_payables]
    J --> K[Payables UI mark paid]
```

---

## 5. Application flow examples

### Create client → create deal

```
UI /clients insert → clients (RLS: created_by = uid)
  → tg_clients_autofill sets team_id / do_id / team_lead_id
  → tg_clients_set_code sets client_code

UI /deals/new insert → deals (+ optional deal_policies)
  → tg_deals_autofill sets ownership + net_premium
  → generated columns compute commission/income
```

### Win a deal → collect money

```
UI updates deals.stage_id → won stage
  → tg_deal_travel_posting_guard may BLOCK (Travel)
  → tg_deal_won_to_receivable creates receivables + installments + invoice + audit

UI records payments
  → tg_payment_apply updates installments/receivable
  → on full pay inserts commission_payables for DO/TL shares
```

### Admin creates user

```
UI /users → createServerFn createUser
  → requireSupabaseAuth + has_role(admin)
  → supabaseAdmin.auth.admin.createUser
  → handle_new_user creates profiles + default do role
  → admin updates profiles / user_roles via service role
```

---

## 6. Orphan / weak relationship notes

1. **`deal_documents` vs `documents`** — parallel models; app uses Storage paths on expenses/reimbursements instead.  
2. **`policies` vs `deals.policy_*`** — renewals combine both; not always synchronized by trigger.  
3. **Invoice dual parents** — may link receivable, deal, both, or (with later migration) neither for manual docs.  
4. **Travel/deal_policies RLS** — existence checks ≠ ownership checks.  
5. **`teams.lead_id` → auth.users** while ownership snapshots use `profiles` — same UUID space, two FK targets conceptually.

---

*See [`DATABASE_OVERVIEW.md`](./DATABASE_OVERVIEW.md) and [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md).*
