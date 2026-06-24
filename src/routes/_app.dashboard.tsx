import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";
import { computeDeal } from "@/lib/calc";
import { Briefcase, TrendingUp, CheckCircle2, XCircle, Activity, Wallet, BadgePercent, Coins } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [{ data: deals }, { data: stages }, { data: companies }, { data: settings }] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, net_premium, commission_percentage, marketing_budget_percentage, loading, b2b_commission, total_income, stage_id, insurance_company_id, created_at, policy_end_date"),
        supabase.from("deal_stages").select("id, name, is_won, is_lost"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("app_settings").select("key, value").eq("key", "tagged_premium_base_percentage").maybeSingle(),
      ]);
      return { deals: deals ?? [], stages: stages ?? [], companies: companies ?? [], basePct: Number(settings?.value ?? 13) };
    },
  });

  if (isLoading || !data) {
    return <div className="p-6"><PageHeader title="Dashboard" /><div className="text-muted-foreground">Loading…</div></div>;
  }

  const stageMap = new Map(data.stages.map((s) => [s.id, s]));
  const wonStageIds = new Set(data.stages.filter((s) => s.is_won).map((s) => s.id));
  const lostStageIds = new Set(data.stages.filter((s) => s.is_lost).map((s) => s.id));

  const gross = data.deals.reduce((a, d) => a + Number(d.gross_premium || 0), 0);
  const net = data.deals.reduce((a, d) => a + Number(d.net_premium || 0), 0);
  const income = data.deals.reduce((a, d) => a + Number(d.total_income || 0), 0);
  const tagged = data.deals.reduce((a, d) => a + computeDeal({
    gross_premium: Number(d.gross_premium), commission_percentage: Number(d.commission_percentage),
    marketing_budget_percentage: Number(d.marketing_budget_percentage),
    loading: Number(d.loading), b2b_commission: Number(d.b2b_commission),
  }, data.basePct).tagged_premium, 0);

  const total = data.deals.length;
  const won = data.deals.filter((d) => d.stage_id && wonStageIds.has(d.stage_id)).length;
  const lost = data.deals.filter((d) => d.stage_id && lostStageIds.has(d.stage_id)).length;
  const active = total - won - lost;

  const now = new Date();
  const renewals = data.deals.filter((d) => {
    if (!d.policy_end_date) return false;
    const end = new Date(d.policy_end_date);
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 60;
  }).length;

  // monthly trend (last 6 months)
  const months: { key: string; label: string; gross: number; income: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleString("en-US", { month: "short" }), gross: 0, income: 0 });
  }
  data.deals.forEach((d) => {
    const dt = new Date(d.created_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === key);
    if (m) { m.gross += Number(d.gross_premium || 0); m.income += Number(d.total_income || 0); }
  });

  // by company
  const byCompany = data.companies.map((c) => ({
    name: c.name,
    value: data.deals.filter((d) => d.insurance_company_id === c.id).reduce((a, d) => a + Number(d.gross_premium || 0), 0),
  })).filter((x) => x.value > 0).slice(0, 6);

  const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "oklch(0.6 0.15 30)"];

  const kpis = [
    { label: "Gross Premium", value: fmtPKR(gross), icon: Wallet, tone: "primary" },
    { label: "Net Premium", value: fmtPKR(net), icon: Coins, tone: "accent" },
    { label: "Tagged Premium", value: fmtPKR(tagged), icon: BadgePercent, tone: "accent" },
    { label: "Total Income", value: fmtPKR(income), icon: TrendingUp, tone: "success" },
    { label: "Total Deals", value: total.toString(), icon: Briefcase, tone: "muted" },
    { label: "Won", value: won.toString(), icon: CheckCircle2, tone: "success" },
    { label: "Lost", value: lost.toString(), icon: XCircle, tone: "destructive" },
    { label: "Active", value: active.toString(), icon: Activity, tone: "primary" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Dashboard" subtitle={`Renewal pipeline (next 60 days): ${renewals} ${renewals === 1 ? "policy" : "policies"}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</div>
                    <div className="text-xl font-semibold mt-1">{k.value}</div>
                  </div>
                  <div className="w-9 h-9 rounded-md bg-accent grid place-items-center text-accent-foreground">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Monthly Premium & Income</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="label" fontSize={12}/>
                <YAxis fontSize={12} tickFormatter={(v)=> v>=1e6?`${(v/1e6).toFixed(1)}M`: v>=1e3?`${(v/1e3).toFixed(0)}k`:String(v)}/>
                <Tooltip formatter={(v: number) => fmtPKR(v)} />
                <Bar dataKey="gross" fill="oklch(0.55 0.18 252)" name="Gross Premium" radius={[4,4,0,0]}/>
                <Bar dataKey="income" fill="oklch(0.62 0.16 155)" name="Income" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Premium by Insurance Company</CardTitle></CardHeader>
          <CardContent className="h-72">
            {byCompany.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No deals yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCompany} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {byCompany.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtPKR(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Pipeline by Stage</CardTitle>
          <Link to="/deals" className="text-sm text-primary hover:underline">View all deals →</Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {data.stages.map((s) => {
              const count = data.deals.filter((d) => d.stage_id === s.id).length;
              const value = data.deals.filter((d) => d.stage_id === s.id).reduce((a, d) => a + Number(d.gross_premium || 0), 0);
              return (
                <div key={s.id} className="rounded-md border p-3 bg-card">
                  <div className="text-xs text-muted-foreground">{s.name}</div>
                  <div className="text-lg font-semibold mt-1">{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmtPKR(value)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
