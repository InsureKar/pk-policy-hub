import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";

export const Route = createFileRoute("/_app/operations/")({
  component: OpsDashboard,
});

function OpsDashboard() {
  const { hasRole } = useAuth();
  if (!hasRole(["admin", "management"])) return <Navigate to="/operations/reimbursements" replace />;

  const { data } = useQuery({
    queryKey: ["ops-dashboard"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1).toISOString().slice(0, 10);

      const sb = supabase as any;
      const [profiles, payroll, expenses, exCats, commissions, deals] = await Promise.all([
        sb.from("profiles").select("id, monthly_salary, employment_status"),
        sb.from("payroll_runs").select("net_salary, status, period_year, period_month, gross_salary"),
        sb.from("expenses").select("amount, tax_amount, expense_date, category_id"),
        sb.from("expense_categories").select("id, slug, parent_id"),
        sb.from("commission_payables").select("commission_amount, status"),
        sb.from("deals").select("gross_premium, net_premium, total_income, stage_id, deal_stages!inner(is_won)"),
      ]);

      const totalEmp = (profiles.data ?? []).length;
      const activeEmp = (profiles.data ?? []).filter((p: any) => (p.employment_status ?? "active") === "active").length;
      const monthlyPayroll = (profiles.data ?? []).reduce((s: number, p: any) => s + Number(p.monthly_salary || 0), 0);
      const paidSalary = (payroll.data ?? []).filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.net_salary || 0), 0);
      const pendingSalary = (payroll.data ?? []).filter((p: any) => p.status !== "paid").reduce((s: number, p: any) => s + Number(p.net_salary || 0), 0);
      const totalCommission = (commissions.data ?? []).reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
      const paidCommission = (commissions.data ?? []).filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
      const pendingCommission = totalCommission - paidCommission;

      const wonDeals = (deals.data ?? []).filter((d: any) => d.deal_stages?.is_won);
      const totalRevenue = wonDeals.reduce((s: number, d: any) => s + Number(d.total_income || 0), 0);
      const totalGross = wonDeals.reduce((s: number, d: any) => s + Number(d.gross_premium || 0), 0);
      const totalNet = wonDeals.reduce((s: number, d: any) => s + Number(d.net_premium || 0), 0);
      const avgRevPerEmp = activeEmp > 0 ? totalRevenue / activeEmp : 0;

      const catBySlug = new Map((exCats.data ?? []).map((c: any) => [c.slug, c.id]));
      const catBySlugSet = (slugs: string[]) => new Set(slugs.map(s => catBySlug.get(s)).filter(Boolean));
      const sumEx = (rows: any[]) => rows.reduce((s, r) => s + Number(r.amount || 0) + Number(r.tax_amount || 0), 0);
      const exAll = expenses.data ?? [];

      const filterCat = (rootSlug: string) => {
        const rootId = catBySlug.get(rootSlug);
        const childIds = new Set((exCats.data ?? []).filter((c: any) => c.parent_id === rootId).map((c: any) => c.id));
        return exAll.filter((e: any) => e.category_id === rootId || childIds.has(e.category_id));
      };

      const totalExpenses = sumEx(exAll);
      const thisMonthEx = sumEx(exAll.filter((e: any) => e.expense_date >= monthStart));
      const lastMonthEx = sumEx(exAll.filter((e: any) => e.expense_date >= lastMonthStart && e.expense_date < monthStart));
      const ytdEx = sumEx(exAll.filter((e: any) => e.expense_date >= yearStart));
      const prevYearEx = sumEx(exAll.filter((e: any) => e.expense_date >= lastYearStart && e.expense_date < yearStart));
      const momGrowth = lastMonthEx > 0 ? ((thisMonthEx - lastMonthEx) / lastMonthEx) * 100 : 0;

      const netProfit = totalRevenue - totalExpenses - paidCommission - paidSalary;

      return {
        totalEmp, activeEmp, monthlyPayroll, paidSalary, pendingSalary,
        totalCommission, paidCommission, pendingCommission,
        totalRevenue, avgRevPerEmp, totalGross, totalNet,
        payrollRatio: totalRevenue > 0 ? (monthlyPayroll * 12 / totalRevenue) * 100 : 0,
        commissionRatio: totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0,
        totalExpenses, thisMonthEx, lastMonthEx, ytdEx, prevYearEx, momGrowth,
        admin: sumEx(filterCat("admin")),
        hr: sumEx(filterCat("hr")),
        tech: sumEx(filterCat("tech")),
        marketing: sumEx(filterCat("marketing")),
        entertainment: sumEx(filterCat("entertainment")),
        travel: sumEx(filterCat("travel")),
        insurance: sumEx(filterCat("insurance")),
        misc: sumEx(filterCat("misc")),
        netProfit,
      };
    },
  });

  const d = data;

  return (
    <div className="space-y-6">
      <Section title="Employee Summary">
        <Kpi label="Total Employees" value={d?.totalEmp ?? 0} raw />
        <Kpi label="Active Employees" value={d?.activeEmp ?? 0} raw />
        <Kpi label="Monthly Payroll" value={d?.monthlyPayroll} />
        <Kpi label="Total Salary Paid" value={d?.paidSalary} />
        <Kpi label="Pending Salary" value={d?.pendingSalary} />
        <Kpi label="Commission Earned" value={d?.totalCommission} />
        <Kpi label="Commission Paid" value={d?.paidCommission} />
        <Kpi label="Pending Commission" value={d?.pendingCommission} />
        <Kpi label="Revenue by Employees" value={d?.totalRevenue} />
        <Kpi label="Avg Revenue / Employee" value={d?.avgRevPerEmp} />
        <Kpi label="Payroll / Revenue" value={`${(d?.payrollRatio ?? 0).toFixed(1)}%`} raw />
        <Kpi label="Commission / Revenue" value={`${(d?.commissionRatio ?? 0).toFixed(1)}%`} raw />
      </Section>

      <Section title="Business Expense Summary">
        <Kpi label="Total Operational Expenses" value={d?.totalExpenses} />
        <Kpi label="Administrative" value={d?.admin} />
        <Kpi label="HR / Operations Salaries" value={d?.hr} />
        <Kpi label="Technology" value={d?.tech} />
        <Kpi label="Marketing" value={d?.marketing} />
        <Kpi label="Entertainment" value={d?.entertainment} />
        <Kpi label="Official Travel" value={d?.travel} />
        <Kpi label="Insurance" value={d?.insurance} />
        <Kpi label="Miscellaneous" value={d?.misc} />
        <Kpi label="This Month" value={d?.thisMonthEx} />
        <Kpi label="Last Month" value={d?.lastMonthEx} />
        <Kpi label="MoM Growth" value={`${(d?.momGrowth ?? 0).toFixed(1)}%`} raw />
        <Kpi label="Year-to-Date" value={d?.ytdEx} />
        <Kpi label="Previous Year" value={d?.prevYearEx} />
      </Section>

      <Section title="Business Performance">
        <Kpi label="Total Revenue" value={d?.totalRevenue} />
        <Kpi label="Total Gross Premium" value={d?.totalGross} />
        <Kpi label="Total Net Premium" value={d?.totalNet} />
        <Kpi label="Operational Cost" value={d?.totalExpenses} />
        <Kpi label="Commission Expense" value={d?.totalCommission} />
        <Kpi label="Net Business Profit" value={d?.netProfit} highlight />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function Kpi({ label, value, raw, highlight }: { label: string; value: any; raw?: boolean; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold tabular-nums mt-1 ${highlight ? "text-primary" : ""}`}>
          {raw ? value : fmtPKR(Number(value ?? 0))}
        </div>
      </CardContent>
    </Card>
  );
}
