import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtPKR } from "@/lib/format";

export const Route = createFileRoute("/_app/operations/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const { hasRole, profile, user } = useAuth();
  const isPrivileged = hasRole(["admin", "management"]);
  const isLead = hasRole("team_lead");
  if (!isPrivileged && !isLead) return <Navigate to="/operations/reimbursements" replace />;

  const myId = profile?.id ?? user?.id ?? "";
  const myTeam = profile?.team_id ?? null;

  const { data } = useQuery({
    queryKey: ["ops-performance", isPrivileged, myId, myTeam],
    queryFn: async () => {
      const sb = supabase as any;
      const [profs, deals, payables, payroll, stages] = await Promise.all([
        sb.from("profiles").select("id, full_name, email, designation, monthly_salary, team_id"),
        sb.from("deals").select("assigned_do_id, stage_id, gross_premium, net_premium, total_income"),
        sb.from("commission_payables").select("beneficiary_id, commission_amount"),
        sb.from("payroll_runs").select("profile_id, net_salary, status"),
        sb.from("deal_stages").select("id, is_won, is_lost"),
      ]);
      const stageMap = new Map<string, any>((stages.data ?? []).map((s: any) => [s.id, s]));
      // Team leads only ever see themselves and their own team members.
      const visibleProfiles = (profs.data ?? []).filter((p: any) =>
        isPrivileged || p.id === myId || (!!myTeam && p.team_id === myTeam));
      const rows = visibleProfiles.map((p: any) => {
        const myDeals = (deals.data ?? []).filter((d: any) => d.assigned_do_id === p.id);
        const won = myDeals.filter((d: any) => stageMap.get(d.stage_id)?.is_won);
        const lost = myDeals.filter((d: any) => stageMap.get(d.stage_id)?.is_lost);
        const pipeline = myDeals.filter((d: any) => !stageMap.get(d.stage_id)?.is_won && !stageMap.get(d.stage_id)?.is_lost);
        const gross = won.reduce((s: number, d: any) => s + Number(d.gross_premium || 0), 0);
        const net = won.reduce((s: number, d: any) => s + Number(d.net_premium || 0), 0);
        const revenue = won.reduce((s: number, d: any) => s + Number(d.total_income || 0), 0);
        const commission = (payables.data ?? []).filter((c: any) => c.beneficiary_id === p.id).reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
        const salary = (payroll.data ?? []).filter((r: any) => r.profile_id === p.id).reduce((s: number, r: any) => s + Number(r.net_salary || 0), 0);
        return {
          ...p,
          totalDeals: myDeals.length, won: won.length, lost: lost.length,
          pipelineValue: pipeline.reduce((s: number, d: any) => s + Number(d.gross_premium || 0), 0),
          gross, net, revenue, commission, salary,
          compensation: commission + salary,
        };
      }).filter((r: any) => r.totalDeals > 0 || Number(r.monthly_salary) > 0)
        .sort((a: any, b: any) => b.revenue - a.revenue);
      return rows;
    },
  });

  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Employee</TableHead>
          <TableHead className="text-right">Deals</TableHead>
          <TableHead className="text-right">Won</TableHead>
          <TableHead className="text-right">Lost</TableHead>
          <TableHead className="text-right">Pipeline</TableHead>
          <TableHead className="text-right">Gross Premium</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Salary Paid</TableHead>
          <TableHead className="text-right">Commission</TableHead>
          <TableHead className="text-right">Compensation</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.full_name || r.email}<div className="text-xs text-muted-foreground">{r.designation || ""}</div></TableCell>
              <TableCell className="text-right">{r.totalDeals}</TableCell>
              <TableCell className="text-right text-emerald-600">{r.won}</TableCell>
              <TableCell className="text-right text-red-600">{r.lost}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtPKR(r.pipelineValue)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtPKR(r.gross)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{fmtPKR(r.revenue)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtPKR(r.salary)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtPKR(r.commission)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtPKR(r.compensation)}</TableCell>
            </TableRow>
          ))}
          {(!data || data.length === 0) && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
