import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtPKR } from "@/lib/format";

export const Route = createFileRoute("/_app/operations/commissions")({
  component: CommissionsPage,
});

const COMMISSION_TAX = 0.17;

function CommissionsPage() {
  const { hasRole } = useAuth();
  if (!hasRole(["admin", "management"])) return <Navigate to="/operations/reimbursements" replace />;

  const { data } = useQuery({
    queryKey: ["ops-commissions"],
    queryFn: async () => {
      const sb = supabase as any;
      const [payables, profs] = await Promise.all([
        sb.from("commission_payables").select("*"),
        sb.from("profiles").select("id, full_name, email, designation"),
      ]);
      const byEmp = new Map<string, any>();
      for (const p of profs.data ?? []) byEmp.set(p.id, { ...p, gross: 0, paid: 0, pending: 0 });
      for (const c of payables.data ?? []) {
        const e = byEmp.get(c.beneficiary_id);
        if (!e) continue;
        const amt = Number(c.commission_amount || 0);
        e.gross += amt;
        if (c.status === "paid") e.paid += amt; else e.pending += amt;
      }
      return Array.from(byEmp.values()).filter(e => e.gross > 0).sort((a, b) => b.gross - a.gross);
    },
  });

  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Designation</TableHead>
          <TableHead className="text-right">Gross Commission</TableHead>
          <TableHead className="text-right">Tax (17%)</TableHead>
          <TableHead className="text-right">Net Commission</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead className="text-right">Pending</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map(e => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.full_name || e.email}</TableCell>
              <TableCell>{e.designation || "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtPKR(e.gross)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPKR(e.gross * COMMISSION_TAX)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{fmtPKR(e.gross * (1 - COMMISSION_TAX))}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-600">{fmtPKR(e.paid)}</TableCell>
              <TableCell className="text-right tabular-nums text-amber-600">{fmtPKR(e.pending)}</TableCell>
            </TableRow>
          ))}
          {(!data || data.length === 0) && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No commissions yet</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
