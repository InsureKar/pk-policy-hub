import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import {
  TICKET_DEPARTMENTS, TICKET_PRIORITIES, TICKET_STATUSES, deptLabel, priorityClass,
  priorityLabel, slaText, statusClass, statusLabel, type TicketRow,
} from "@/lib/tickets";

export function TicketTable({ tickets, data, empty = "No tickets found." }: { tickets: TicketRow[]; data: any; empty?: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dept, setDept] = useState("all");

  const people = useMemo(() => new Map((data?.profiles ?? []).map((p: any) => [p.id, p.full_name])), [data]);
  const cats = useMemo(() => new Map((data?.categories ?? []).map((c: any) => [c.id, c.name])), [data]);
  const teams = useMemo(() => new Map((data?.teams ?? []).map((t: any) => [t.id, t.name])), [data]);

  const rows = useMemo(
    () => tickets.filter((t) =>
      (status === "all" || t.status === status) &&
      (priority === "all" || t.priority === priority) &&
      (dept === "all" || t.department === dept) &&
      (!q.trim() || `${t.ticket_number} ${t.subject} ${t.policy_number ?? ""}`.toLowerCase().includes(q.toLowerCase()))),
    [tickets, status, priority, dept, q],
  );

  const assignee = (t: TicketRow) =>
    t.assigned_to ? (people.get(t.assigned_to) as string) ?? "—"
    : t.assigned_team_id ? `${teams.get(t.assigned_team_id) ?? "Team"} (team)`
    : t.assigned_department ? `${deptLabel(t.assigned_department)} (dept)`
    : "Unassigned";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Input className="w-64" placeholder="Search ticket, subject, policy…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {TICKET_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {TICKET_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {TICKET_DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">{rows.length} ticket(s)</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{empty}</TableCell></TableRow>
              )}
              {rows.map((t) => {
                const sla = slaText(t);
                return (
                  <TableRow key={t.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      <Link to="/tickets/$id" params={{ id: t.id }} className="text-primary hover:underline">{t.ticket_number}</Link>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      <Link to="/tickets/$id" params={{ id: t.id }} className="hover:underline">{t.subject}</Link>
                    </TableCell>
                    <TableCell>{deptLabel(t.department)}</TableCell>
                    <TableCell>{(cats.get(t.category_id ?? "") as string) ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className={priorityClass(t.priority)}>{priorityLabel(t.priority)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className={statusClass(t.status)}>{statusLabel(t.status)}</Badge></TableCell>
                    <TableCell>{assignee(t)}</TableCell>
                    <TableCell>{t.due_date ? fmtDate(t.due_date) : "—"}</TableCell>
                    <TableCell className={cn("text-sm", sla.breached && "text-destructive font-medium")}>{sla.text}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
