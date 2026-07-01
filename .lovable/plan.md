
# CRM Enterprise Upgrade Plan

This is a large, multi-area upgrade. I'll ship it in **4 sequential phases** so each phase is testable and reviewable before moving on. You approve this plan once, then I execute phase by phase.

## Phase 1 — Auth, Roles, Permissions, DB Foundation

**Auth changes**
- Remove Sign Up tab from `/auth` — only Sign In + Forgot Password.
- Add `/reset-password` route for password recovery.
- Disable public signups in backend (only Admin creates users).
- Force-password-reset flag on user profile.

**Role hierarchy enforcement**
- Existing roles: `admin`, `management`, `team_lead`, `do`. Rename `admin` semantics → **Super Admin**. Drop `management` from UI (or keep as alias for Super Admin).
- Every DO must belong to exactly one team; every team has one Team Lead (`teams.lead_id`).
- Add DB constraint + RLS: DO sees only own records; Team Lead sees own team; Super Admin sees all.

**RBAC**
- New `permissions` table + `role_permissions` mapping (view/create/edit/delete/export/approve/assign/reset_password per module).
- `has_permission(user, module, action)` security-definer function used in RLS and UI gating.
- `usePermission()` hook to conditionally render buttons/links.

**DB additions**
- `insurance_companies.active` flag (already has `is_active`) + seed **United Insurance**.
- `company_commission_rates` (company_id, line_of_business, percentage) — 6 lines: Group Health, Motor, Marine, Travel, Fire, Misc.
- `policies` table (client_id, deal_id, company_id, policy_number, start/end date, premium).
- `renewals` derived from `policies` (upcoming/due/completed/expired).
- `documents` table (client_id, policy_id, type, company_id, tags[], file_path, version, uploaded_by).
- `document_versions` for version history.
- `income_entries` (deal_id, company_id, premium_received, commission_earned, pending, status, month).
- `activity_log` for recent activities feed.
- Storage bucket `crm-documents` (private, RLS by owner/team).

## Phase 2 — Navigation, Master Data, Settings Restructure

**Sidebar rebuild** (collapsible groups, shadcn sidebar):
- Dashboard (Overview, KPIs)
- Analytics (Sales, Revenue, Team, Company, Renewal)
- Sales → Deals (New/List/Won/Lost), Pipeline (Kanban), Clients (Individual/Corporate)
- Operations → Renewals (Upcoming/Due/Completed/Expired), Documents, Income
- Admin → Teams, Agents, User Management
- Master Data (expandable +): Insurance Companies, Commission Settings, Categories, Products, Policy Types
- Settings: Profile, Password, Notifications, Security, Sessions

**Move Premium Tag %** out of Settings → Master Data → Commission Settings (global config).

## Phase 3 — Core Modules

- **Pipeline Kanban** with drag-drop across the 6 stages.
- **Clients** split Individual vs Corporate (tabs + type field).
- **Renewals** tabs (Upcoming/Due/Completed/Expired) with policy dates.
- **Documents** — upload to storage, filter/search/tags, preview, version history.
- **Income** — dashboard + tables + charts (Recharts) for premium/commission/pending.
- **Admin → Teams / Agents / Users** with create/edit/delete/lock/reset-password/assign flows.
- Commission rates auto-applied when creating a deal (line-of-business × company % → commission).

## Phase 4 — Dashboard, Analytics, UI Polish

- Dashboard KPI cards: Total Premium, Clients, Active Policies, Renewals Due, Monthly Revenue, Top DOs, Top Companies, Recent Activity, Upcoming Renewals.
- Analytics pages with Recharts (line/bar/donut).
- **Light/Dark mode toggle** (already has tokens; add ThemeProvider + toggle).
- Tables: sorting, search, filter, pagination via TanStack Table.
- Consistent typography, spacing, animations (framer-motion for page transitions optional).

## Notes / Trade-offs
- This is roughly 40–60 files of new/edited code + several migrations. Doing it in one shot risks compile errors and hard-to-review diffs. Sequential phases with your approval between each is safer.
- Existing seeded admin account (`admin@insurebroker.local`) is preserved.
- Existing deals/clients data is preserved; new columns are nullable/defaulted.

**Reply "approve" to start Phase 1, or tell me what to change.** If you'd rather I compress phases (e.g., ship Phase 1+2 together), say so.
