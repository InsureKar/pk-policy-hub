import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deptLabel, fetchServiceDeskData, priorityLabel, statusLabel } from "@/lib/tickets";

export const Route = createFileRoute("/_app/tickets/reports")({
  component: TicketReports,
  head: () => ({
    meta: [
      { title: "Ticket Reports | Internal Service Desk" },
      { name: "description", content: "Ticket analytics by department, employee, category, priority, status and monthly volume." },
      { property: "og:title", content: "Ticket Reports | Internal Service Desk" },
      { property: "og:description", content: "Ticket analytics by department, employee, category, priority, status and monthly volume." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const COLORS = ["hsl(var(--primary))", "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#06b6d4", "#a855f7", "#84cc16"];

function group<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  rows.forEach((r) => { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function TicketReports() {
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  const tickets = data?.tickets ?? [];
  const people = useMemo(() => new Map((data?.profiles ?? []).map((p: any) => [p.id, p.full_name])), [data]);
  const cats = useMemo(() => new Map((data?.categories ?? []).map((c: any) => [c.id, c.name])), [data]);

  const byDept = group(tickets, (t) => deptLabel(t.department));
  const byEmployee = group(tickets, (t) => (t.assigned_to ? ((people.get(t.assigned_to) as string) ?? "Unknown") : "Unassigned")).slice(0, 10);
  const byCategory = group(tickets, (t) => (cats.get(t.category_id ?? "") as string) ?? "Uncategorised").slice(0, 10);
  const byPriority = group(tickets, (t) => priorityLabel(t.priority));
  const byStatus = group(tickets, (t) => statusLabel(t.status));
  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach((t) => {
      const k = t.created_at.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Tickets by Department"><Bars rows={byDept} /></ChartCard>
      <ChartCard title="Tickets by Employee"><Bars rows={byEmployee} /></ChartCard>
      <ChartCard title="Tickets by Category"><Bars rows={byCategory} /></ChartCard>
      <ChartCard title="Tickets by Priority"><Donut rows={byPriority} /></ChartCard>
      <ChartCard title="Tickets by Status"><Donut rows={byStatus} /></ChartCard>
      <ChartCard title="Monthly Ticket Volume">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Bars({ rows }: { rows: { name: string; value: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Donut({ rows }: { rows: { name: string; value: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
          {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip /><Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
