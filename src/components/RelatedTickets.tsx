import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketDialog } from "@/components/TicketDialog";
import { fetchServiceDeskData, priorityClass, priorityLabel, statusClass, statusLabel } from "@/lib/tickets";

/** Shows every internal ticket linked to a deal / client / policy number. */
export function RelatedTickets({ dealId, clientId, policyNumber }: { dealId?: string; clientId?: string; policyNumber?: string | null }) {
  const { data } = useQuery({ queryKey: ["service-desk"], queryFn: fetchServiceDeskData });
  const { data: linked } = useQuery({
    queryKey: ["related-tickets", dealId, clientId, policyNumber],
    queryFn: async () => {
      let q = supabase.from("tickets" as any).select("*").order("created_at", { ascending: false });
      const filters: string[] = [];
      if (dealId) filters.push(`deal_id.eq.${dealId}`);
      if (clientId) filters.push(`client_id.eq.${clientId}`);
      if (policyNumber) filters.push(`policy_number.eq.${policyNumber}`);
      if (filters.length === 0) return [];
      q = q.or(filters.join(",")) as any;
      const { data: rows } = await q;
      return (rows ?? []) as any[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Related Tickets</CardTitle>
        <TicketDialog
          data={data}
          defaults={{ deal_id: dealId ?? "", client_id: clientId ?? "", policy_number: policyNumber ?? "" }}
          trigger={<button className="text-sm text-primary hover:underline">+ Raise ticket</button>}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        {(linked ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tickets linked to this record.</p>}
        {(linked ?? []).map((t) => (
          <Link key={t.id} to="/tickets/$id" params={{ id: t.id }}
            className="flex flex-wrap items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
            <span className="font-mono text-xs text-primary">{t.ticket_number}</span>
            <span className="flex-1 min-w-[160px] truncate text-sm">{t.subject}</span>
            <Badge variant="secondary" className={priorityClass(t.priority)}>{priorityLabel(t.priority)}</Badge>
            <Badge variant="secondary" className={statusClass(t.status)}>{statusLabel(t.status)}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
