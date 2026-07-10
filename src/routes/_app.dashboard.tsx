import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";
import { computeDeal } from "@/lib/calc";
import { Briefcase, TrendingUp, CheckCircle2, XCircle, Activity, Wallet, BadgePercent, Coins, Target as TargetIcon, RefreshCw, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";
import { PipelineFunnel } from "@/components/PipelineFunnel";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { hasRole, user } = useAuth();
  const canSeeFinancials = hasRole(["admin", "management", "team_lead"]);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const [{ data: deals }, { data: stages }, { data: companies }, { data: settings }, { data: targets }] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, net_premium, commission_percentage, marketing_budget_percentage, loading, b2b_commission, total_income, stage_id, insurance_company_id, created_at, policy_end_date, deal_type, assigned_do_id, team_lead_id" as any),
        supabase.from("deal_stages").select("id, name, is_won, is_lost"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("app_settings").select("key, value").eq("key", "tagged_premium_base_percentage").maybeSingle(),
        supabase.from("user_targets" as any).select("*"),
      ]);
      return { deals: (deals ?? []) as any[], stages: stages ?? [], companies: companies ?? [], basePct: Number(settings?.value ?? 13), targets: (targets ?? []) as any[] };
    },
  });

  if (isLoading || !data) {
    return <div className="p-6"><PageHeader title="Dashboard" /><div className="text-muted-foreground">Loading…</div></div>;
  }

  const wonStageIds = new Set(data.stages.filter((s) => s.is_won).map((s) => s.id));
  const lostStageIds = new Set(data.stages.filter((s) => s.is_lost).map((s) => s.id));

  const isLost = (d: any) => d.stage_id && lostStageIds.has(d.stage_id);
  const isWon = (d: any) => d.stage_id && wonStageIds.has(d.stage_id);

  // Business segregation
  const freshDeals = data.deals.filter(d => d.deal_type === "fresh" && !isLost(d));
  const renewalDeals = data.deals.filter(d => d.deal_type === "renewal" && !isLost(d));
  const lostDeals = data.deals.filter(isLost);
  const activeDeals = data.deals.filter(d => !isLost(d)); // Total = Fresh + Renewal + Pipeline (all non-lost)

  const sumGross = (arr: any[]) => arr.reduce((a, d) => a + Number(d.gross_premium || 0), 0);
  const sumIncome = (arr: any[]) => arr.reduce((a, d) => a + Number(d.total_income || 0), 0);
  const sumNet = (arr: any[]) => arr.reduce((a, d) => a + Number(d.net_premium || 0), 0);

  const totalGross = sumGross(activeDeals);
  const totalNet = sumNet(activeDeals);
  const totalIncome = sumIncome(activeDeals);
  const tagged = activeDeals.reduce((a, d) => a + computeDeal({
    gross_premium: Number(d.gross_premium), commission_percentage: Number(d.commission_percentage),
    marketing_budget_percentage: Number(d.marketing_budget_percentage),
    loading: Number(d.loading), b2b_commission: Number(d.b2b_commission),
  }, data.basePct).tagged_premium, 0);

  const total = data.deals.length;
  const won = data.deals.filter(isWon).length;
  const lost = lostDeals.length;
  const active = total - won - lost;

  const now = new Date();
  const renewalPipeline = data.deals.filter((d) => {
    if (!d.policy_end_date) return false;
    const end = new Date(d.policy_end_date);
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 60;
  }).length;

  const months: { key: string; label: string; gross: number; income: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleString("en-US", { month: "short" }), gross: 0, income: 0 });
  }
  activeDeals.forEach((d) => {
    const dt = new Date(d.created_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === key);
    if (m) { m.gross += Number(d.gross_premium || 0); m.income += Number(d.total_income || 0); }
  });

  const byCompany = data.companies.map((c) => ({
    name: c.name,
    value: activeDeals.filter((d) => d.insurance_company_id === c.id).reduce((a, d) => a + Number(d.gross_premium || 0), 0),
  })).filter((x) => x.value > 0).slice(0, 6);

  const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "oklch(0.6 0.15 30)"];

  // Business Overview: Total / Fresh / Renewal / Lost
  const overview = [
    { label: "Total Business", icon: Briefcase, value: fmtPKR(totalGross), sub: `${activeDeals.length} deals (Fresh + Renewal + Pipeline)`, tone: "primary" },
    { label: "Fresh", icon: Sparkles, value: fmtPKR(sumGross(freshDeals)), sub: `${freshDeals.length} deals`, tone: "success" },
    { label: "Renewal", icon: RefreshCw, value: fmtPKR(sumGross(renewalDeals)), sub: `${renewalDeals.length} deals`, tone: "accent" },
    { label: "Lost", icon: XCircle, value: fmtPKR(sumGross(lostDeals)), sub: `${lostDeals.length} deals`, tone: "destructive" },
  ];

  // Targets (for DO/TL and admin viewing self)
  const monthKey = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthKey = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const myTargets = data.targets.filter(t => t.user_id === user?.id);
  const myTargetThisMonth = Number(myTargets.find(t => t.period_month === monthKey)?.target_amount ?? 0);
  const myTargetLastMonth = Number(myTargets.find(t => t.period_month === lastMonthKey)?.target_amount ?? 0);
  const myYtdTarget = myTargets
    .filter(t => new Date(t.period_month) >= yearStart && new Date(t.period_month) <= now)
    .reduce((a, t) => a + Number(t.target_amount), 0);

  const myWonDeals = activeDeals.filter(d => isWon(d) && (d.assigned_do_id === user?.id || d.team_lead_id === user?.id));
  const myWonThisMonth = myWonDeals.filter(d => {
    const dt = new Date(d.created_at);
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  }).reduce((a, d) => a + Number(d.gross_premium || 0), 0);
  const myWonLastMonth = myWonDeals.filter(d => {
    const dt = new Date(d.created_at);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dt.getFullYear() === lm.getFullYear() && dt.getMonth() === lm.getMonth();
  }).reduce((a, d) => a + Number(d.gross_premium || 0), 0);
  const myWonYtd = myWonDeals.filter(d => new Date(d.created_at) >= yearStart).reduce((a, d) => a + Number(d.gross_premium || 0), 0);

  const monthPct = myTargetThisMonth > 0 ? Math.round((myWonThisMonth / myTargetThisMonth) * 100) : 0;
  const lastMonthPct = myTargetLastMonth > 0 ? Math.round((myWonLastMonth / myTargetLastMonth) * 100) : 0;
  const ytdPct = myYtdTarget > 0 ? Math.round((myWonYtd / myYtdTarget) * 100) : 0;
  const monthOverMonth = monthPct - lastMonthPct;

  const financialKpis = [
    { label: "Gross Premium", value: fmtPKR(totalGross), icon: Wallet },
    { label: "Net Premium", value: fmtPKR(totalNet), icon: Coins },
    { label: "Tagged Premium", value: fmtPKR(tagged), icon: BadgePercent },
    { label: "Total Income", value: fmtPKR(totalIncome), icon: TrendingUp },
  ];
  const activityKpis = [
    { label: "Total Deals", value: total.toString(), icon: Briefcase },
    { label: "Won", value: won.toString(), icon: CheckCircle2 },
    { label: "Lost", value: lost.toString(), icon: XCircle },
    { label: "Active", value: active.toString(), icon: Activity },
  ];
  const kpis = canSeeFinancials ? [...financialKpis, ...activityKpis.slice(0, 3)] : activityKpis;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Dashboard" subtitle={`Renewal pipeline (next 60 days): ${renewalPipeline} ${renewalPipeline === 1 ? "policy" : "policies"} · Lost deals excluded from financial totals`} />

      {/* Business Overview */}
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Business Overview</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {overview.map((o) => {
            const Icon = o.icon;
            return (
              <Card key={o.label} className={o.tone === "destructive" ? "border-destructive/40" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">{o.label}</div>
                      <div className="text-xl font-semibold mt-1 tabular-nums">{o.value}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{o.sub}</div>
                    </div>
                    <div className="w-9 h-9 rounded-md bg-accent grid place-items-center text-accent-foreground">
                      <Icon className="w-4 h-4"/>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Target Achievement widget (DO/TL only, but Admin also sees if they have targets set) */}
      {(myTargetThisMonth > 0 || myYtdTarget > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TargetIcon className="w-4 h-4"/> Target Achievement</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground">This Month</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">{monthPct}%</div>
              <div className="text-xs text-muted-foreground">{fmtPKR(myWonThisMonth)} / {fmtPKR(myTargetThisMonth)}</div>
              <Progress value={Math.min(100, monthPct)} className="h-1.5 mt-2"/>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">YTD Achievement</div>
              <div className="text-2xl font-semibold mt-1 tabular-nums">{ytdPct}%</div>
              <div className="text-xs text-muted-foreground">{fmtPKR(myWonYtd)} / {fmtPKR(myYtdTarget)}</div>
              <Progress value={Math.min(100, ytdPct)} className="h-1.5 mt-2"/>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">vs Last Month</div>
              <div className={`text-2xl font-semibold mt-1 tabular-nums ${monthOverMonth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {monthOverMonth >= 0 ? "+" : ""}{monthOverMonth}%
              </div>
              <div className="text-xs text-muted-foreground">Last month: {lastMonthPct}%</div>
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="mt-6">
        <PipelineFunnel title="Pipeline funnel by month" />
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
