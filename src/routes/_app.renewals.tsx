import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtPKR } from "@/lib/format";

export const Route = createFileRoute("/_app/renewals")({
  component: RenewalsPage,
});

function RenewalsPage() {
  const { data } = useQuery({
    queryKey: ["renewals"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date(); horizon.setDate(horizon.getDate() + 90);
      const [deals, clients] = await Promise.all([
        supabase.from("deals").select("id, deal_number, policy_number, policy_end_date, gross_premium, client_id")
          .gte("policy_end_date", today).lte("policy_end_date", horizon.toISOString().slice(0,10))
          .order("policy_end_date"),
        supabase.from("clients").select("id, company_name"),
      ]);
      return { deals: deals.data ?? [], clientMap: new Map((clients.data ?? []).map(c=>[c.id, c.company_name])) };
    },
  });

  const bucket = (days: number) => days <= 7 ? "critical" : days <= 15 ? "warning" : days <= 30 ? "soon" : "later";

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Renewals" subtitle="Policies expiring within 90 days. Alerts at 30, 15 and 7 days." />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Deal #</th>
                <th className="text-left px-4 py-2.5">Client</th>
                <th className="text-left px-4 py-2.5">Policy #</th>
                <th className="text-right px-4 py-2.5">Gross Premium</th>
                <th className="text-left px-4 py-2.5">Expires</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.deals ?? []).map(d => {
                const days = Math.ceil((new Date(d.policy_end_date!).getTime() - Date.now()) / 86400000);
                const b = bucket(days);
                const variant = b === "critical" ? "destructive" : b === "warning" ? "default" : "secondary";
                return (
                  <tr key={d.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{d.deal_number}</td>
                    <td className="px-4 py-2.5">{d.client_id ? data?.clientMap.get(d.client_id) ?? "—" : "—"}</td>
                    <td className="px-4 py-2.5">{d.policy_number || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtPKR(Number(d.gross_premium))}</td>
                    <td className="px-4 py-2.5">{fmtDate(d.policy_end_date)}</td>
                    <td className="px-4 py-2.5"><Badge variant={variant}>{days} days</Badge></td>
                  </tr>
                );
              })}
              {(data?.deals ?? []).length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No upcoming renewals.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
