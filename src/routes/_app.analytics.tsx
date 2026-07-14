import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtPKR } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

const COLORS = ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"];

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [deals, cos, profs, teams, stages, policies] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, total_income, insurance_company_id, assigned_do_id, team_id, stage_id, created_at"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("teams").select("id, name"),
        supabase.from("deal_stages").select("id, name, is_lost"),
        supabase.from("policies").select("id, end_date, premium"),
      ]);
      const lostIds = new Set((stages.data ?? []).filter((s: any) => s.is_lost).map(s => s.id));
      return {
        deals: deals.data ?? [],
        activeDeals: (deals.data ?? []).filter(d => !d.stage_id || !lostIds.has(d.stage_id)),
        coMap: new Map((cos.data ?? []).map(c=>[c.id, c.name])),
        profMap: new Map((profs.data ?? []).map(p=>[p.id, p.full_name])),
        teamMap: new Map((teams.data ?? []).map(t=>[t.id, t.name])),
        stageMap: new Map((stages.data ?? []).map(s=>[s.id, s.name])),
        policies: policies.data ?? [],
      };
    },
  });

  const bySales = agg(data?.activeDeals ?? [], d => d.assigned_do_id ? (data?.profMap.get(d.assigned_do_id) ?? "—") : "Unassigned", d => Number(d.gross_premium));
  const byRev = agg(data?.activeDeals ?? [], d => d.insurance_company_id ? (data?.coMap.get(d.insurance_company_id) ?? "—") : "—", d => Number(d.total_income ?? 0));
  const byTeam = agg(data?.activeDeals ?? [], d => d.team_id ? (data?.teamMap.get(d.team_id) ?? "—") : "Unassigned", d => Number(d.total_income ?? 0));
  const byStage = agg(data?.deals ?? [], d => d.stage_id ? (data?.stageMap.get(d.stage_id) ?? "—") : "—", d => 1);

  const renewalBuckets = { upcoming: 0, due: 0, expired: 0, completed: 0 };
  const today = new Date();
  for (const p of data?.policies ?? []) {
    const days = Math.ceil((new Date(p.end_date).getTime() - today.getTime()) / 86400000);
    if (days < 0) renewalBuckets.expired++;
    else if (days <= 7) renewalBuckets.due++;
    else if (days <= 60) renewalBuckets.upcoming++;
    else renewalBuckets.completed++;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Analytics" subtitle="Sales, revenue, team, company and renewal analytics."/>
      <Tabs defaultValue="sales">
        <TabsList className="mb-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="company">Company Performance</TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <ChartCard title="Sales by DO (Gross Premium)"><BarChartH data={bySales}/></ChartCard>
          <div className="h-4"/>
          <ChartCard title="Deals per stage"><PieChartS data={byStage}/></ChartCard>
        </TabsContent>
        <TabsContent value="revenue">
          <ChartCard title="Revenue by insurance company"><BarChartH data={byRev}/></ChartCard>
        </TabsContent>
        <TabsContent value="team">
          <ChartCard title="Team commission earned"><BarChartH data={byTeam}/></ChartCard>
        </TabsContent>
        <TabsContent value="company">
          <ChartCard title="Company income share"><PieChartS data={byRev}/></ChartCard>
        </TabsContent>
        <TabsContent value="renewals">
          <ChartCard title="Renewal status"><PieChartS data={Object.entries(renewalBuckets).map(([label,value])=>({label, value}))}/></ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function agg<T>(arr: T[], key: (x: T) => string, val: (x: T) => number) {
  const m: Record<string, number> = {};
  for (const x of arr) { const k = key(x); m[k] = (m[k] ?? 0) + val(x); }
  return Object.entries(m).map(([label, value]) => ({ label, value }));
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="h-80">{children}</CardContent></Card>;
}

function BarChartH({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
        <XAxis type="number" tick={{ fontSize: 11 }}/>
        <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 11 }}/>
        <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
        <Bar dataKey="value" fill="var(--chart-1)" radius={[0,4,4,0]}/>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartS({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
        </Pie>
        <Tooltip/>
        <Legend/>
      </PieChart>
    </ResponsiveContainer>
  );
}
