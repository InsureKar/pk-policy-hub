import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@tanstack/react-router";
import {
  TICKET_PRIORITIES, fetchServiceDeskData, isOpen, priorityClass, priorityLabel,
  slaText, statusClass, statusLabel,
} from "@/lib/tickets";

export const Route = createFileRoute("/_app/tickets/sla")({
  component: SlaPage,
  head: () => ({
    meta: [
      { title: "SLA Settings | Internal Service Desk" },
      { name: "description", content: "Define internal SLA hours per priority and monitor breached tickets in real time." },
      { property: "og:title", content: "SLA Settings | Internal Service Desk" },
      { property: "og:description", content: "Define internal SLA hours per priority and monitor breached tickets in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SlaPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasRole(["admin", "management"]);
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  const [draft, setDraft] = useState<Record<string, string>>({});

  const save = async (row: any) => {
    const hours = Number(draft[row.id] ?? row.hours);
    if (!Number.isFinite(hours) || hours <= 0) return toast.error("Enter a valid number of hours");
    const { error } = await supabase.from("ticket_sla_settings" as any).update({ hours, updated_at: new Date().toISOString() } as any).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("SLA updated");
    qc.invalidateQueries({ queryKey: ["service-desk"] });
  };

  const breached = (data?.tickets ?? []).filter((t) => isOpen(t.status) && slaText(t).breached);
  const slaRows = [...(data?.sla ?? [])].sort(
    (a, b) => TICKET_PRIORITIES.findIndex((p) => p.value === a.priority) - TICKET_PRIORITIES.findIndex((p) => p.value === b.priority),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLA targets by priority</CardTitle>
        </CardHeader>
        <CardContent>
          {!canEdit && <p className="text-sm text-muted-foreground mb-3">Only Admin and Management can change SLA targets.</p>}
          <Table>
            <TableHeader>
              <TableRow><TableHead>Priority</TableHead><TableHead>Target (hours)</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {slaRows.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><Badge variant="secondary" className={priorityClass(s.priority)}>{priorityLabel(s.priority)}</Badge></TableCell>
                  <TableCell>
                    <Input type="number" min={1} className="w-32" disabled={!canEdit}
                      value={draft[s.id] ?? String(s.hours)}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))} />
                  </TableCell>
                  <TableCell>{canEdit && <Button size="sm" variant="secondary" onClick={() => save(s)}>Save</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">SLA breached — escalate to Team Lead / Management</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead><TableHead>Subject</TableHead><TableHead>Priority</TableHead>
                <TableHead>Status</TableHead><TableHead>Breach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breached.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No SLA breaches. </TableCell></TableRow>
              )}
              {breached.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    <Link to="/tickets/$id" params={{ id: t.id }} className="text-primary hover:underline">{t.ticket_number}</Link>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate">{t.subject}</TableCell>
                  <TableCell><Badge variant="secondary" className={priorityClass(t.priority)}>{priorityLabel(t.priority)}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className={statusClass(t.status)}>{statusLabel(t.status)}</Badge></TableCell>
                  <TableCell className="text-destructive font-medium">{slaText(t).text}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
