import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtPKR } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/targets")({
  component: TargetsPage,
});

function monthOptions() {
  const now = new Date();
  const arr: { key: string; label: string }[] = [];
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    arr.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
    });
  }
  return arr;
}

function TargetsPage() {
  const { hasRole, loading } = useAuth();
  const qc = useQueryClient();
  const months = useMemo(() => monthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(months.find(m => m.key === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))?.key || months[0].key);

  const { data } = useQuery({
    queryKey: ["targets", selectedMonth],
    queryFn: async () => {
      const [profiles, roles, targets, deals, stages] = await Promise.all([
        supabase.from("profiles").select("id, full_name, team_id"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_targets" as any).select("*").eq("period_month", selectedMonth),
        supabase.from("deals").select("id, gross_premium, assigned_do_id, team_lead_id, stage_id, created_at"),
        supabase.from("deal_stages").select("id, is_won"),
      ]);
      return {
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        targets: (targets.data ?? []) as any[],
        deals: deals.data ?? [],
        wonIds: new Set((stages.data ?? []).filter(s => s.is_won).map(s => s.id)),
      };
    },
    enabled: hasRole("admin") || hasRole("management"),
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!hasRole("admin") && !hasRole("management")) return <Navigate to="/dashboard" replace />;

  const tlIds = new Set((data?.roles ?? []).filter(r => r.role === "team_lead").map(r => r.user_id));
  const doIds = new Set((data?.roles ?? []).filter(r => r.role === "do").map(r => r.user_id));
  const eligibleUsers = (data?.profiles ?? []).filter(p => tlIds.has(p.id) || doIds.has(p.id));

  const [y, m] = selectedMonth.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);
  const wonInMonth = (userId: string) => (data?.deals ?? [])
    .filter(d => data?.wonIds.has(d.stage_id ?? "") && (d.assigned_do_id === userId || d.team_lead_id === userId))
    .filter(d => { const dt = new Date(d.created_at); return dt >= monthStart && dt < monthEnd; })
    .reduce((a, d) => a + Number(d.gross_premium || 0), 0);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Monthly Targets" subtitle="Set monthly gross-premium targets for Team Leads and Development Officers." />
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Select month</CardTitle></CardHeader>
        <CardContent>
          <select className="border rounded-md px-3 py-2 text-sm bg-background" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {months.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">User</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-right px-4 py-2.5">Target (PKR)</th>
                <th className="text-right px-4 py-2.5">Achieved this month</th>
                <th className="text-right px-4 py-2.5">Achievement %</th>
                <th className="text-left px-4 py-2.5">Save</th>
              </tr>
            </thead>
            <tbody>
              {eligibleUsers.map(u => {
                const existing = data?.targets.find(t => t.user_id === u.id);
                const achieved = wonInMonth(u.id);
                return (
                  <TargetRow
                    key={u.id}
                    user={u}
                    role={tlIds.has(u.id) ? "Team Lead" : "DO"}
                    existing={existing}
                    achieved={achieved}
                    periodMonth={selectedMonth}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["targets", selectedMonth] })}
                  />
                );
              })}
              {eligibleUsers.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No Team Leads or DOs found.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function TargetRow({ user, role, existing, achieved, periodMonth, onSaved }: any) {
  const [amount, setAmount] = useState<string>(String(existing?.target_amount ?? ""));
  const [saving, setSaving] = useState(false);
  const pct = Number(amount) > 0 ? Math.round((achieved / Number(amount)) * 100) : 0;

  const save = async () => {
    const val = Number(amount) || 0;
    setSaving(true);
    const { error } = await supabase.from("user_targets" as any).upsert({
      user_id: user.id,
      period_month: periodMonth,
      target_amount: val,
    }, { onConflict: "user_id,period_month" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Target saved");
    onSaved();
  };

  return (
    <tr className="border-t">
      <td className="px-4 py-2.5 font-medium">{user.full_name}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{role}</td>
      <td className="px-4 py-2.5 text-right">
        <Input type="number" className="w-40 ml-auto text-right" value={amount} onChange={e => setAmount(e.target.value)}/>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{fmtPKR(achieved)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${pct >= 100 ? "text-emerald-500" : pct >= 50 ? "" : "text-destructive"}`}>{pct}%</td>
      <td className="px-4 py-2.5"><Button size="sm" disabled={saving} onClick={save}>Save</Button></td>
    </tr>
  );
}
