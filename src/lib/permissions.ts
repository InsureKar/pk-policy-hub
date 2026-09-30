import type { AppModule } from "@/lib/auth";

/** Granular access levels assignable per screen. */
export type AccessLevel = "none" | "view" | "add" | "edit" | "full";

export const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "No Access" },
  { value: "view", label: "View Only" },
  { value: "add", label: "Add" },
  { value: "edit", label: "Edit" },
  { value: "full", label: "Full Access" },
];

export type PermAction = "view" | "add" | "edit" | "delete";

/** What a given level allows. */
export function levelAllows(level: AccessLevel, action: PermAction = "view"): boolean {
  switch (action) {
    case "view":
      return level !== "none";
    case "add":
      return level === "add" || level === "full";
    case "edit":
      return level === "edit" || level === "full";
    case "delete":
      return level === "full";
  }
}

export interface PermDef {
  key: string;
  label: string;
  /** Existing coarse module used as the fallback when no granular row exists. */
  module: AppModule;
}

export interface PermGroup {
  label: string;
  items: PermDef[];
}

export const PERMISSION_GROUPS: PermGroup[] = [
  {
    label: "Dashboard",
    items: [{ key: "dashboard.access", label: "Dashboard Access", module: "dashboard" }],
  },
  {
    label: "Accounts",
    items: [
      { key: "accounts.dashboard", label: "Accounts Dashboard", module: "accounts" },
      { key: "accounts.receivables", label: "Receivables", module: "accounts" },
      { key: "accounts.payables", label: "Payables", module: "accounts" },
      { key: "accounts.sales", label: "Sales", module: "accounts" },
      { key: "accounts.taxes", label: "Taxes", module: "accounts" },
      { key: "accounts.b2b", label: "B2B Commissions", module: "accounts" },
      { key: "accounts.installments", label: "Installments", module: "accounts" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "operations.dashboard", label: "Operations Dashboard", module: "operations" },
      { key: "operations.deals", label: "Deals", module: "operations" },
      { key: "operations.payments", label: "Payments", module: "operations" },
      { key: "operations.invoice_issue", label: "Invoice Issue", module: "operations" },
      { key: "operations.travel_posting", label: "Travel Posting", module: "operations" },
      { key: "operations.dispatch", label: "Dispatch Record", module: "operations" },
      { key: "operations.tickets", label: "Internal Service Desk / Tickets", module: "operations" },
      { key: "operations.expenses", label: "Expenses", module: "operations" },
    ],
  },
  {
    label: "Admin",
    items: [
      { key: "admin.dashboard", label: "Admin Dashboard", module: "admin" },
      { key: "admin.users_roles", label: "Users & Roles", module: "admin" },
      { key: "admin.assets", label: "Assets", module: "admin" },
      { key: "admin.payroll", label: "Payroll", module: "admin" },
      { key: "admin.expenses", label: "Expenses", module: "admin" },
      { key: "admin.settings", label: "Settings", module: "settings" },
    ],
  },
  {
    label: "Clients",
    items: [
      { key: "clients.list", label: "Client List", module: "clients" },
      { key: "clients.add", label: "Add Client", module: "clients" },
      { key: "clients.edit", label: "Edit Client", module: "clients" },
      { key: "clients.details", label: "Client Details", module: "clients" },
    ],
  },
  {
    label: "Deals",
    items: [
      { key: "deals.view", label: "View Deals", module: "deals" },
      { key: "deals.add", label: "Add Deals", module: "deals" },
      { key: "deals.edit", label: "Edit Deals", module: "deals" },
      { key: "deals.financials", label: "Deal Financial Information", module: "deals" },
      { key: "deals.documents", label: "Deal Documents", module: "deals" },
      { key: "deals.payments", label: "Deal Payments", module: "deals" },
      { key: "deals.pipeline", label: "Pipeline", module: "deals" },
      { key: "deals.tasks", label: "Tasks", module: "deals" },
      { key: "deals.renewals", label: "Renewals", module: "renewals" },
      { key: "leads.unassigned", label: "Unassigned Leads", module: "leads" },
    ],
  },
  {
    label: "Reports & Analytics",
    items: [
      { key: "reports.analytics", label: "Analytics", module: "reports" },
      { key: "reports.income", label: "Income", module: "reports" },
      { key: "reports.finance", label: "Finance Reports", module: "reports" },
      { key: "reports.operations", label: "Ops Reports", module: "reports" },
    ],
  },
  {
    label: "Operations (More)",
    items: [
      { key: "operations.underwriting", label: "Underwriting", module: "operations" },
      { key: "operations.commissions", label: "Commissions", module: "operations" },
      { key: "operations.performance", label: "Employee Performance", module: "operations" },
      { key: "operations.reimbursements", label: "Reimbursements", module: "operations" },
    ],
  },
  {
    label: "Admin (More)",
    items: [
      { key: "admin.teams", label: "Teams", module: "admin" },
      { key: "admin.permissions", label: "Access & Permissions", module: "admin" },
      { key: "admin.review", label: "Review User", module: "admin" },
      { key: "admin.targets", label: "Monthly Targets", module: "admin" },
      { key: "admin.activity", label: "Activity Log", module: "admin" },
      { key: "admin.master", label: "Master Data (Companies, Commissions, Products)", module: "admin" },
    ],
  },
];

export const PERM_DEFS: Record<string, PermDef> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items).map((i) => [i.key, i]),
);
