import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/income")({
  component: IncomePage,
});

function IncomePage() {
  const { data } = useQuery({
    queryKey: ["income"],
    queryFn: async () => {
      const [deals, cos, stages] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, total_income, insurance_company_id, created_at, stage_id"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("deal_stages").select("id, is_lost"),
      ]);
      return {
        deals: deals.data ?? [],
        coMap: new Map((cos.data ?? []).map(c=>[c.id, c.name])),
        lostIds: new Set((stages.data ?? []).filter(s => s.is_lost).map(s => s.id)),
      };
    },
  });

  // Exclude Lost deals from all financial aggregates
  const activeDeals = (data?.deals ?? []).filter(d => !d.stage_id || !data?.lostIds.has(d.stage_id));

  const totalPremium = activeDeals.reduce((a, d) => a + Number(d.gross_premium), 0);
  const totalIncome = activeDeals.reduce((a, d) => a + Number(d.total_income ?? 0), 0);
  const pending = totalIncome * 0.35;

  const byCompany = Object.entries(
    activeDeals.reduce<Record<string, number>>((acc, d) => {
      const name = d.insurance_company_id ? (data?.coMap.get(d.insurance_company_id) ?? "—") : "—";
      acc[name] = (acc[name] ?? 0) + Number(d.total_income ?? 0);
      return acc;
    }, {})
  ).map(([name, income]) => ({ name, income }));

  const byMonth = Object.entries(
    activeDeals.reduce<Record<string, number>>((acc, d) => {
      const key = new Date(d.created_at).toISOString().slice(0, 7);
      acc[key] = (acc[key] ?? 0) + Number(d.total_income ?? 0);
      return acc;
    }, {})
  ).sort().slice(-12).map(([month, income]) => ({ month, income }));

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Income" subtitle="Premium received, commission earned, pending balances and company-wise revenue. Lost deals are excluded."/>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Premium" value={fmtPKR(totalPremium)}/>
        <KPI label="Commission Earned" value={fmtPKR(totalIncome)}/>
        <KPI label="Pending Commission (est.)" value={fmtPKR(pending)}/>
        <KPI label="Active Deals (excl. Lost)" value={String(activeDeals.length)}/>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly revenue (last 12 months)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="month" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                <Bar dataKey="income" fill="var(--chart-1)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Company-wise income</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byCompany} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis type="number" tick={{ fontSize: 11 }}/>
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                <Bar dataKey="income" fill="var(--chart-2)" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
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
