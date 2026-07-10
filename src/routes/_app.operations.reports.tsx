import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtPKR } from "@/lib/format";

export const Route = createFileRoute("/_app/operations/reports")({
  component: ReportsPage,
});

const REPORTS = [
  { id: "payroll", label: "Payroll Summary" },
  { id: "salary_history", label: "Salary History" },
  { id: "commissions", label: "Commissions by Employee" },
  { id: "reimbursements", label: "Reimbursements" },
  { id: "expenses", label: "Operational Expenses" },
  { id: "expense_by_category", label: "Expenses by Category" },
  { id: "performance", label: "Employee Performance" },
  { id: "revenue_vs_expense", label: "Revenue vs Expenses" },
  { id: "profitability", label: "Profitability Analysis" },
];

function ReportsPage() {
  const { hasRole } = useAuth();
  if (!hasRole(["admin", "management"])) return <Navigate to="/operations/reimbursements" replace />;

  const { data } = useQuery({
    queryKey: ["ops-reports"],
    queryFn: async () => {
      const sb = supabase as any;
      const [payroll, salRev, comm, rmb, ex, cats, profs, deals, stages] = await Promise.all([
        sb.from("payroll_runs").select("*"),
        sb.from("salary_revisions").select("*"),
        sb.from("commission_payables").select("*"),
        sb.from("reimbursements").select("*"),
        sb.from("expenses").select("*"),
        sb.from("expense_categories").select("*"),
        sb.from("profiles").select("id, full_name, email"),
        sb.from("deals").select("assigned_do_id, stage_id, total_income, gross_premium"),
        sb.from("deal_stages").select("id, is_won"),
      ]);
      return {
        payroll: payroll.data ?? [], salRev: salRev.data ?? [],
        comm: comm.data ?? [], rmb: rmb.data ?? [], ex: ex.data ?? [],
        cats: cats.data ?? [], profs: profs.data ?? [],
        deals: deals.data ?? [], stages: stages.data ?? [],
      };
    },
  });

  const download = (id: string) => {
    if (!data) return;
    const profMap = new Map<string, any>(data.profs.map((p: any) => [p.id, p]));
    const catMap = new Map<string, any>(data.cats.map((c: any) => [c.id, c]));
    const stageMap = new Map<string, any>(data.stages.map((s: any) => [s.id, s]));
    let rows: any[][] = [];
    switch (id) {
      case "payroll":
        rows = [["Employee","Period","Gross","Tax","Deductions","Bonuses","Allowances","Net","Status"]];
        for (const r of data.payroll) {
          const p = profMap.get(r.profile_id);
          rows.push([p?.full_name || "—", `${r.period_year}-${String(r.period_month).padStart(2,"0")}`, r.gross_salary, r.tax_amount, r.deductions, r.bonuses, r.allowances, r.net_salary, r.status]);
        }
        break;
      case "salary_history":
        rows = [["Employee","Effective Date","Previous","New","Reason"]];
        for (const r of data.salRev) rows.push([profMap.get(r.profile_id)?.full_name || "—", r.effective_date, r.previous_salary, r.new_salary, r.reason ?? ""]);
        break;
      case "commissions":
        rows = [["Employee","Role","Amount","Status","Payable Date"]];
        for (const r of data.comm) rows.push([profMap.get(r.beneficiary_id)?.full_name || "—", r.beneficiary_role, r.commission_amount, r.status, r.payable_date]);
        break;
      case "reimbursements":
        rows = [["Code","Employee","Date","Amount","Status"]];
        for (const r of data.rmb) rows.push([r.request_code, profMap.get(r.employee_id)?.full_name || "—", r.expense_date, r.amount, r.status]);
        break;
      case "expenses":
        rows = [["Code","Date","Category","Vendor","Amount","Tax"]];
        for (const r of data.ex) rows.push([r.expense_code, r.expense_date, catMap.get(r.category_id)?.name ?? "", r.vendor ?? "", r.amount, r.tax_amount]);
        break;
      case "expense_by_category": {
        const totals = new Map<string, number>();
        for (const r of data.ex) {
          const cat = catMap.get(r.category_id);
          const rootId = cat?.parent_id ?? r.category_id;
          const rootName = catMap.get(rootId)?.name ?? "—";
          totals.set(rootName, (totals.get(rootName) ?? 0) + Number(r.amount || 0) + Number(r.tax_amount || 0));
        }
        rows = [["Category","Total"]];
        for (const [k, v] of totals) rows.push([k, v]);
        break;
      }
      case "performance": {
        rows = [["Employee","Won Deals","Revenue","Gross Premium"]];
        for (const p of data.profs) {
          const myWon = data.deals.filter((d: any) => d.assigned_do_id === p.id && stageMap.get(d.stage_id)?.is_won);
          if (myWon.length === 0) continue;
          const rev = myWon.reduce((s: number, d: any) => s + Number(d.total_income || 0), 0);
          const gp = myWon.reduce((s: number, d: any) => s + Number(d.gross_premium || 0), 0);
          rows.push([p.full_name || p.email, myWon.length, rev, gp]);
        }
        break;
      }
      case "revenue_vs_expense": {
        const rev = data.deals.filter((d: any) => stageMap.get(d.stage_id)?.is_won).reduce((s: number, d: any) => s + Number(d.total_income || 0), 0);
        const totalEx = data.ex.reduce((s: number, r: any) => s + Number(r.amount || 0) + Number(r.tax_amount || 0), 0);
        rows = [["Metric","Amount"], ["Total Revenue", rev], ["Total Expenses", totalEx], ["Net", rev - totalEx]];
        break;
      }
      case "profitability": {
        const rev = data.deals.filter((d: any) => stageMap.get(d.stage_id)?.is_won).reduce((s: number, d: any) => s + Number(d.total_income || 0), 0);
        const totalEx = data.ex.reduce((s: number, r: any) => s + Number(r.amount || 0) + Number(r.tax_amount || 0), 0);
        const salary = data.payroll.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.net_salary || 0), 0);
        const commissionPaid = data.comm.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
        rows = [["Metric","Amount"],
          ["Revenue", rev], ["Operational Expenses", totalEx],
          ["Salaries Paid", salary], ["Commissions Paid", commissionPaid],
          ["Net Profit", rev - totalEx - salary - commissionPaid]];
        break;
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${id}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {REPORTS.map(r => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="font-medium">{r.label}</div>
            <Button size="sm" variant="outline" onClick={() => download(r.id)}>Export CSV</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
