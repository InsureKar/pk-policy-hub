import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const [profs, roles, teams, deals] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("teams").select("id, name"),
        supabase.from("deals").select("assigned_do_id, gross_premium, total_income"),
      ]);
      const doIds = new Set((roles.data ?? []).filter(r => r.role === "do").map(r => r.user_id));
      const dos = (profs.data ?? []).filter(p => doIds.has(p.id));
      const perfMap = new Map<string, { deals: number; premium: number; income: number }>();
      for (const d of deals.data ?? []) {
        if (!d.assigned_do_id) continue;
        const cur = perfMap.get(d.assigned_do_id) ?? { deals: 0, premium: 0, income: 0 };
        cur.deals++; cur.premium += Number(d.gross_premium); cur.income += Number(d.total_income ?? 0);
        perfMap.set(d.assigned_do_id, cur);
      }
      return { dos, teams: teams.data ?? [], perfMap };
    },
  });

  if (!hasRole(["admin", "management"])) return <Navigate to="/dashboard" replace/>;

  const setTeam = async (uid: string, teamId: string) => {
    const { error } = await supabase.from("profiles").update({ team_id: teamId || null }).eq("id", uid);
    if (error) toast.error(error.message); else { toast.success("Team assigned"); qc.invalidateQueries({ queryKey: ["agents"] }); }
  };

  const toggleLock = async (uid: string, locked: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_locked: !locked }).eq("id", uid);
    if (error) toast.error(error.message); else { toast.success(locked ? "Unlocked" : "Locked"); qc.invalidateQueries({ queryKey: ["agents"] }); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Agents (Development Officers)" subtitle="Assign DOs to teams, view performance and control account status."/>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Team</th>
                <th className="text-right px-4 py-2.5">Deals</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.dos ?? []).map(d => {
                const perf = data?.perfMap.get(d.id) ?? { deals: 0, premium: 0, income: 0 };
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{d.full_name || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.email}</td>
                    <td className="px-4 py-2.5">
                      <Select value={d.team_id ?? ""} onValueChange={(v)=>setTeam(d.id, v)}>
                        <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Assign team…"/></SelectTrigger>
                        <SelectContent>{data?.teams.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{perf.deals}</td>
                    <td className="px-4 py-2.5">{d.is_locked ? <Badge variant="destructive">Locked</Badge> : <Badge variant="secondary">Active</Badge>}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="ghost" onClick={()=>toggleLock(d.id, d.is_locked)}>
                        {d.is_locked ? "Unlock" : "Lock"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(data?.dos ?? []).length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No development officers yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
