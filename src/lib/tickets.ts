import { supabase } from "@/integrations/supabase/client";

export const TICKET_DEPARTMENTS = [
  { value: "operations", label: "Operations" },
  { value: "accounts", label: "Accounts" },
  { value: "technology", label: "Technology / Portal" },
  { value: "sales", label: "Sales" },
] as const;
export type TicketDepartment = (typeof TICKET_DEPARTMENTS)[number]["value"];

export const TICKET_STATUSES = [
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number]["value"];

export const TICKET_PRIORITIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]["value"];

export const SERVICE_MODULES = [
  "Dashboard", "Leads", "Clients", "Deals", "Renewals", "Accounts",
  "Operations", "Reports", "Admin", "Settings", "Portal", "Other",
];

export const OPEN_STATUSES: TicketStatus[] = ["new", "assigned", "in_progress", "on_hold", "reopened"];

export const statusLabel = (s: string) => TICKET_STATUSES.find((x) => x.value === s)?.label ?? s;
export const priorityLabel = (p: string) => TICKET_PRIORITIES.find((x) => x.value === p)?.label ?? p;
export const deptLabel = (d: string) => TICKET_DEPARTMENTS.find((x) => x.value === d)?.label ?? d;

export const statusClass = (s: string) =>
  s === "closed" ? "bg-muted text-muted-foreground"
  : s === "resolved" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
  : s === "on_hold" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
  : s === "in_progress" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
  : s === "reopened" ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
  : "bg-primary/10 text-primary";

export const priorityClass = (p: string) =>
  p === "critical" ? "bg-destructive/15 text-destructive"
  : p === "high" ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
  : p === "medium" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
  : "bg-muted text-muted-foreground";

export const isOpen = (s: string) => OPEN_STATUSES.includes(s as TicketStatus);

/** Human readable "SLA remaining" / "Breached by" text for a ticket row. */
export function slaText(t: { sla_due_at: string | null; status: string; resolved_at: string | null }) {
  if (!t.sla_due_at) return { text: "—", breached: false };
  const end = new Date(t.resolved_at ?? Date.now()).getTime();
  const diffMin = Math.round((new Date(t.sla_due_at).getTime() - end) / 60000);
  const fmt = (m: number) => {
    const a = Math.abs(m);
    const h = Math.floor(a / 60);
    const mm = a % 60;
    return h > 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };
  return diffMin >= 0
    ? { text: `${fmt(diffMin)} left`, breached: false }
    : { text: `Breached by ${fmt(diffMin)}`, breached: true };
}

export function resolutionText(mins: number | null) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export type TicketRow = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string | null;
  department: TicketDepartment;
  service_module: string | null;
  category_id: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_kind: string | null;
  assigned_to: string | null;
  assigned_team_id: string | null;
  assigned_department: string | null;
  due_date: string | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_minutes: number | null;
  client_id: string | null;
  deal_id: string | null;
  policy_number: string | null;
  insurance_company_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** Loads tickets plus every lookup the Service Desk screens need. */
export async function fetchServiceDeskData() {
  const [tickets, categories, profiles, teams, clients, deals, companies, sla] = await Promise.all([
    supabase.from("tickets" as any).select("*").order("created_at", { ascending: false }),
    supabase.from("ticket_categories" as any).select("*").eq("active", true).order("sort_order"),
    supabase.from("profiles").select("id, full_name, email, team_id, department").order("full_name"),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("clients").select("id, company_name, full_name, client_type").order("company_name"),
    supabase.from("deals").select("id, deal_number, policy_number, client_id").order("created_at", { ascending: false }).limit(500),
    supabase.from("insurance_companies").select("id, name").eq("active", true).order("name"),
    supabase.from("ticket_sla_settings" as any).select("*"),
  ]);
  return {
    tickets: (tickets.data ?? []) as unknown as TicketRow[],
    categories: (categories.data ?? []) as any[],
    profiles: (profiles.data ?? []) as any[],
    teams: teams.data ?? [],
    clients: clients.data ?? [],
    deals: (deals.data ?? []) as any[],
    companies: companies.data ?? [],
    sla: (sla.data ?? []) as any[],
  };
}

export const clientLabel = (c: any) =>
  !c ? "—" : c.client_type === "individual" ? c.full_name || c.company_name : c.company_name;
