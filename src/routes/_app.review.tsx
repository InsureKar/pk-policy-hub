import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPKR } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { hasRole, loading } = useAuth();
  const [userId, setUserId] = useState<string>("");

  const { data } = useQuery({
    queryKey: ["review-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, team_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return { profiles: profiles.data ?? [], roles: roles.data ?? [] };
    },
    enabled: hasRole("admin") || hasRole("management"),
  });

  const { data: userData } = useQuery({
    queryKey: ["review-user", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [deals, stages, types] = await Promise.all([
        supabase.from("deals").select("*").or(`assigned_do_id.eq.${userId},team_lead_id.eq.${userId}`),
        supabase.from("deal_stages").select("id, name, is_won, is_lost"),
        supabase.from("insurance_types").select("id, name"),
      ]);
      return {
        deals: (deals.data ?? []) as any[],
        stages: stages.data ?? [],
        typeMap: new Map((types.data ?? []).map(t => [t.id, t.name])),
      };
    },
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!hasRole("admin") && !hasRole("management")) return <Navigate to="/dashboard" replace />;

  const reviewableIds = new Set((data?.roles ?? []).filter(r => r.role === "do" || r.role === "team_lead").map(r => r.user_id));
  const users = (data?.profiles ?? []).filter(p => reviewableIds.has(p.id));

  const wonIds = useMemo(() => new Set((userData?.stages ?? []).filter(s => s.is_won).map(s => s.id)), [userData?.stages]);
  const lostIds = useMemo(() => new Set((userData?.stages ?? []).filter(s => s.is_lost).map(s => s.id)), [userData?.stages]);

  const deals = userData?.deals ?? [];
  const pipeline = deals.filter(d => !wonIds.has(d.stage_id) && !lostIds.has(d.stage_id));
  const won = deals.filter(d => wonIds.has(d.stage_id));
  const lost = deals.filter(d => lostIds.has(d.stage_id));

  const sumG = (arr: any[]) => arr.reduce((a, d) => a + Number(d.gross_premium || 0), 0);

  // Product-wise (excl. lost)
  const productAgg: Record<string, number> = {};
  for (const d of deals.filter(x => !lostIds.has(x.stage_id))) {
    const key = d.insurance_type_id ? (userData!.typeMap.get(d.insurance_type_id) ?? "—") : "—";
    productAgg[key] = (productAgg[key] ?? 0) + Number(d.gross_premium || 0);
  }
  const productData = Object.entries(productAgg).map(([name, value]) => ({ name, value }));

  // Month-wise gross premium (12 months)
  const now = new Date();
  const months: { key: string; label: string; total: number; won: number; lost: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-US", { month: "short" }), total: 0, won: 0, lost: 0 });
  }
  deals.forEach(d => {
    const dt = new Date(d.created_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find(x => x.key === key);
    if (!m) return;
    const g = Number(d.gross_premium || 0);
    if (lostIds.has(d.stage_id)) m.lost += g;
    else { m.total += g; if (wonIds.has(d.stage_id)) m.won += g; }
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Review User" subtitle="Drill into any Team Lead or DO's pipeline, business, product mix and month-wise trend." />
      <Card className="mb-4">
        <CardContent className="p-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">User:</span>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-[300px]"><SelectValue placeholder="Select user"/></SelectTrigger>
            <SelectContent>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!userId && <div className="text-muted-foreground text-sm">Pick a user to see their metrics.</div>}

      {userId && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KPI label="Pipeline" value={fmtPKR(sumG(pipeline))} sub={`${pipeline.length} deals`}/>
            <KPI label="Total Business" value={fmtPKR(sumG(deals.filter(d => !lostIds.has(d.stage_id))))} sub={`${deals.filter(d => !lostIds.has(d.stage_id)).length} deals (excl. Lost)`}/>
            <KPI label="Won" value={fmtPKR(sumG(won))} sub={`${won.length} deals`}/>
            <KPI label="Lost" value={fmtPKR(sumG(lost))} sub={`${lost.length} deals`}/>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Business — Product wise (excl. Lost)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={productData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                    <XAxis type="number" tick={{ fontSize: 11 }}/>
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }}/>
                    <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[0,4,4,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Month-wise Business</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={months}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }}/>
                    <YAxis tick={{ fontSize: 11 }}/>
                    <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                    <Bar dataKey="total" name="Active" fill="var(--chart-1)" radius={[4,4,0,0]}/>
                    <Bar dataKey="won" name="Won" fill="var(--chart-3)" radius={[4,4,0,0]}/>
                    <Bar dataKey="lost" name="Lost" fill="var(--chart-5)" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            <Link to="/deals" className="text-primary hover:underline">→ Open Deals list to filter this user's deals</Link>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent></Card>
  );
}
