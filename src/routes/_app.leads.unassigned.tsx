import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fmtPKR, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads/unassigned")({
  component: UnassignedLeadsPage,
});

function UnassignedLeadsPage() {
  const { hasRole, loading } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["unassigned-leads"],
    queryFn: async () => {
      const [deals, profiles, teams, roles] = await Promise.all([
        supabase.from("deals").select("*").is("assigned_do_id", null).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, team_id"),
        supabase.from("teams").select("id, name, lead_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return {
        deals: deals.data ?? [],
        profiles: profiles.data ?? [],
        teams: teams.data ?? [],
        roles: roles.data ?? [],
      };
    },
    enabled: hasRole("admin"),
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!hasRole("admin")) return <Navigate to="/dashboard" replace />;

  const tls = (data?.profiles ?? []).filter(p => (data?.roles ?? []).some(r => r.user_id === p.id && r.role === "team_lead"));
  const dos = (data?.profiles ?? []).filter(p => (data?.roles ?? []).some(r => r.user_id === p.id && r.role === "do"));

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Unassigned Leads" subtitle="Deals with no Development Officer assigned. Tag them to a Team Lead or DO." />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Deal #</th>
                <th className="text-left px-4 py-2.5">Deal Type</th>
                <th className="text-right px-4 py-2.5">Gross Premium</th>
                <th className="text-left px-4 py-2.5">Created</th>
                <th className="text-left px-4 py-2.5">Assign DO</th>
                <th className="text-left px-4 py-2.5">Assign Team Lead</th>
              </tr>
            </thead>
            <tbody>
              {(data?.deals ?? []).map((d: any) => (
                <AssignRow key={d.id} deal={d} tls={tls} dos={dos} teams={data?.teams ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["unassigned-leads"] })}/>
              ))}
              {(data?.deals ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">All leads have been assigned. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function AssignRow({ deal, tls, dos, teams, onDone }: { deal: any; tls: any[]; dos: any[]; teams: any[]; onDone: () => void }) {
  const [doId, setDoId] = useState<string>("");
  const [tlId, setTlId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const save = async (which: "do" | "tl") => {
    setSaving(true);
    const patch: any = {};
    if (which === "do" && doId) {
      patch.assigned_do_id = doId;
      const prof = dos.find(p => p.id === doId);
      if (prof?.team_id) {
        patch.team_id = prof.team_id;
        const team = teams.find(t => t.id === prof.team_id);
        if (team?.lead_id) patch.team_lead_id = team.lead_id;
      }
    } else if (which === "tl" && tlId) {
      patch.team_lead_id = tlId;
      const prof = tls.find(p => p.id === tlId);
      if (prof?.team_id) patch.team_id = prof.team_id;
    }
    const { error } = await supabase.from("deals").update(patch).eq("id", deal.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lead assigned");
    onDone();
  };

  return (
    <tr className="border-t">
      <td className="px-4 py-2.5 font-medium">{deal.deal_number}</td>
      <td className="px-4 py-2.5"><Badge variant="outline">{deal.deal_type === "renewal" ? "Renewal" : "Fresh"}</Badge></td>
      <td className="px-4 py-2.5 text-right tabular-nums">{fmtPKR(Number(deal.gross_premium))}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(deal.created_at)}</td>
      <td className="px-4 py-2.5">
        <div className="flex gap-2">
          <Select value={doId} onValueChange={setDoId}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Select DO"/></SelectTrigger>
            <SelectContent>{dos.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" disabled={!doId || saving} onClick={() => save("do")}>Assign</Button>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-2">
          <Select value={tlId} onValueChange={setTlId}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Select Team Lead"/></SelectTrigger>
            <SelectContent>{tls.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!tlId || saving} onClick={() => save("tl")}>Assign</Button>
        </div>
      </td>
    </tr>
  );
}
