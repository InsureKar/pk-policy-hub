import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";
import { PipelineFunnel } from "@/components/PipelineFunnel";

export const Route = createFileRoute("/_app/income")({
  component: IncomePage,
});

function IncomePage() {
  const { data } = useQuery({
    queryKey: ["income"],
    queryFn: async () => {
      const [deals, stages] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, total_income, stage_id"),
        supabase.from("deal_stages").select("id, is_lost"),
      ]);
      const lostIds = new Set((stages.data ?? []).filter(s => s.is_lost).map(s => s.id));
      return {
        activeDeals: (deals.data ?? []).filter(d => !d.stage_id || !lostIds.has(d.stage_id)),
      };
    },
  });

  const activeDeals = data?.activeDeals ?? [];
  const totalPremium = activeDeals.reduce((a, d) => a + Number(d.gross_premium), 0);
  const totalIncome = activeDeals.reduce((a, d) => a + Number(d.total_income ?? 0), 0);
  const pending = totalIncome * 0.35;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Income" subtitle="Premium received, commission earned, pending balances. Lost deals are excluded." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Premium" value={fmtPKR(totalPremium)} />
        <KPI label="Commission Earned" value={fmtPKR(totalIncome)} />
        <KPI label="Pending Commission (est.)" value={fmtPKR(pending)} />
        <KPI label="Active Deals (excl. Lost)" value={String(activeDeals.length)} />
      </div>
      <PipelineFunnel title="Pipeline funnel by month" />
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </CardContent></Card>
  );
}
