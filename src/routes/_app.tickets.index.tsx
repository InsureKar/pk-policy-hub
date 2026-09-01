import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, Clock, CheckCircle2, Timer, Inbox, Users } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchServiceDeskData, isOpen, priorityClass, priorityLabel, resolutionText,
  slaText, statusClass, statusLabel,
} from "@/lib/tickets";

export const Route = createFileRoute("/_app/tickets/")({
  component: TicketDashboard,
  head: () => ({
    meta: [
      { title: "Internal Service Desk | Insurance CRM" },
      { name: "description", content: "Internal ticket dashboard with open, critical, overdue and SLA-breached ticket metrics." },
      { property: "og:title", content: "Internal Service Desk | Insurance CRM" },
      { property: "og:description", content: "Internal ticket dashboard with open, critical, overdue and SLA-breached ticket metrics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TicketDashboard() {
  const { user, profile } = useAuth();
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  const tickets = data?.tickets ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const teamMembers = useMemo(
    () => new Set((data?.profiles ?? []).filter((p: any) => p.team_id && p.team_id === profile?.team_id).map((p: any) => p.id)),
    [data, profile],
  );

  const open = tickets.filter((t) => isOpen(t.status));
  const kpis = [
    { label: "Total Open", value: open.length, icon: Inbox },
    { label: "My Open", value: open.filter((t) => t.assigned_to === user?.id).length, icon: Users },
    { label: "Team Open", value: open.filter((t) => (t.assigned_to && teamMembers.has(t.assigned_to)) || (t.assigned_team_id && t.assigned_team_id === profile?.team_id)).length, icon: Users },
    { label: "Critical", value: open.filter((t) => t.priority === "critical").length, icon: AlertTriangle },
    { label: "Overdue", value: open.filter((t) => t.due_date && t.due_date < today).length, icon: Clock },
    { label: "SLA Breached", value: open.filter((t) => slaText(t).breached).length, icon: AlertTriangle },
    { label: "Due Today", value: open.filter((t) => t.due_date === today).length, icon: Timer },
    { label: "Resolved Today", value: tickets.filter((t) => t.resolved_at?.slice(0, 10) === today).length, icon: CheckCircle2 },
  ];

  const resolved = tickets.filter((t) => t.resolution_minutes != null);
  const avgRes = resolved.length ? Math.round(resolved.reduce((s, t) => s + (t.resolution_minutes ?? 0), 0) / resolved.length) : null;

  const urgent = open
    .filter((t) => t.priority === "critical" || t.priority === "high")
    .sort((a, b) => (a.sla_due_at ?? "").localeCompare(b.sla_due_at ?? ""))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</span>
                <k.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold mt-2">{k.value}</div>
            </CardContent>
          </Card>
        ))}
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Average Resolution Time</span>
            <span className="text-xl font-semibold">{resolutionText(avgRes)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Critical &amp; High priority — needs attention now</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {urgent.length === 0 && <p className="text-sm text-muted-foreground">No critical or high priority tickets open.</p>}
          {urgent.map((t) => {
            const sla = slaText(t);
            return (
              <Link key={t.id} to="/tickets/$id" params={{ id: t.id }}
                className="flex flex-wrap items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <span className="font-mono text-xs text-primary">{t.ticket_number}</span>
                <span className="flex-1 min-w-[180px] truncate text-sm">{t.subject}</span>
                <Badge variant="secondary" className={priorityClass(t.priority)}>{priorityLabel(t.priority)}</Badge>
                <Badge variant="secondary" className={statusClass(t.status)}>{statusLabel(t.status)}</Badge>
                <span className={sla.breached ? "text-destructive text-sm font-medium" : "text-sm text-muted-foreground"}>{sla.text}</span>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
