import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/accounts/chart")({
  component: ChartOfAccountsPage,
});

const sb = supabase as any;

type Line = { code: string; label: string; value: number; children?: { label: string; value: number }[] };

function ChartOfAccountsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin", "management"]);

  const { data } = useQuery({
    queryKey: ["accounts-chart-of-accounts"],
    enabled: isAdmin,
    queryFn: async () => {
      const [deals, recv, ledger, taxes] = await Promise.all([
        sb.from("deals").select("id,loading,commission_before_tax,commission_after_tax,commission_tax,marketing_before_tax,marketing_after_tax,marketing_tax,b2b_commission,b2b_net_amount"),
        sb.from("receivables").select("id,total_amount,paid_amount,outstanding_amount,excluded_from_receivable"),
        sb.from("payables").select("id,category,original_amount,paid_amount,outstanding_amount,status"),
        sb.from("tax_records").select("id,tax_type,amount,paid_amount"),
      ]);
      return {
        deals: (deals.data ?? []) as any[],
        recv: (recv.data ?? []) as any[],
        ledger: (ledger.data ?? []) as any[],
        taxes: (taxes.data ?? []) as any[],
      };
    },
  });

  if (!isAdmin) return <Navigate to="/accounts" replace />;

  const deals = data?.deals ?? [];
  const recv = (data?.recv ?? []).filter(r => !r.excluded_from_receivable);
  const ledger = data?.ledger ?? [];
  const taxes = data?.taxes ?? [];

  const sumD = (k: string) => deals.reduce((a, d) => a + Number(d[k] || 0), 0);
  const sumCat = (c: string) => ledger.filter(p => p.category === c).reduce((a, p) => a + Number(p.original_amount || 0), 0);
  const outCat = (c: string) => ledger.filter(p => p.category === c).reduce((a, p) => a + Number(p.outstanding_amount || 0), 0);
  const sumTax = (t: string) => taxes.filter(x => x.tax_type === t).reduce((a, x) => a + Number(x.amount || 0), 0);
  const outTax = (t: string) => taxes.filter(x => x.tax_type === t).reduce((a, x) => a + Math.max(0, Number(x.amount || 0) - Number(x.paid_amount || 0)), 0);

  const commissionIncome = sumD("commission_before_tax");
  const incomeLoading = sumD("loading");
  const mktBudget = sumD("marketing_before_tax");
  const commissionNet = sumD("commission_after_tax");
  const taxOnMkt = sumD("marketing_tax");
  const taxOnCommission = sumD("commission_tax");
  const incomeTax = sumTax("income_tax");
  const premiumReceivable = recv.reduce((a, r) => a + Number(r.outstanding_amount || 0), 0);

  const receivables: Line[] = [
    { code: "1.1", label: "Commission Income", value: commissionIncome },
    { code: "1.2", label: "Income Loading", value: incomeLoading },
    { code: "1.3", label: "MKT Budget", value: mktBudget },
    { code: "1.4", label: "Commission Income (Net)", value: commissionNet },
    {
      code: "1.5", label: "Advance Tax", value: taxOnMkt + taxOnCommission + incomeTax,
      children: [
        { label: "Income Tax on MKT Budget", value: taxOnMkt },
        { label: "Income Tax on Commission Income", value: taxOnCommission },
        { label: "Income Tax", value: incomeTax },
      ],
    },
    {
      code: "1.6", label: "Receivable Tax", value: outTax("marketing_budget_tax") + outTax("commission_taker_tax") + outTax("income_tax"),
      children: [
        { label: "Income Tax on MKT Budget", value: outTax("marketing_budget_tax") },
        { label: "Income Tax on Commission Income", value: outTax("commission_taker_tax") + outTax("b2b_commission_tax") },
        { label: "Income Tax", value: outTax("income_tax") },
      ],
    },
    {
      code: "1.7", label: "Premium Receivable", value: premiumReceivable,
      children: [{ label: "Premium Receivable", value: premiumReceivable }],
    },
  ];

  const payables: Line[] = [
    { code: "2.1", label: "Expenses", value: sumCat("expense"), children: [{ label: "All expenses", value: sumCat("expense") }] },
    { code: "2.2", label: "Tax Payable", value: outCat("tax"), children: [{ label: "Tax payable", value: outCat("tax") }] },
    {
      code: "2.3", label: "B2B Commission Payable", value: sumD("b2b_commission"),
      children: [
        { label: "B2B Commission Payable", value: sumD("b2b_commission") },
        { label: "Actual gross amount of net", value: sumD("b2b_net_amount") },
      ],
    },
  ];

  const sales: Line[] = [
    { code: "3.1", label: "Commission Income", value: commissionIncome },
    { code: "3.2", label: "Income Loading", value: incomeLoading },
    { code: "3.3", label: "Marketing Budget", value: mktBudget },
  ];

  const taxesGroup: Line[] = [
    { code: "4.1", label: "Income Tax", value: sumTax("income_tax") },
    { code: "4.2", label: "Sales Tax (5%)", value: sumTax("sales_tax") },
    { code: "4.3", label: "Commission Taker Tax", value: sumTax("commission_taker_tax") + sumTax("b2b_commission_tax") },
    { code: "4.4", label: "Marketing Budget Tax (9%)", value: sumTax("marketing_budget_tax") },
  ];

  const total = (lines: Line[]) => lines.reduce((a, l) => a + l.value, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold tracking-tight">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only ledger view of Receivables, Payables, Sales and Taxes. Figures are derived from existing accounts data; no calculations are changed here.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Group title="1. Receivables" tone="receivable" lines={receivables} total={total(receivables)} />
        <Group title="2. Payables" tone="payable" lines={payables} total={total(payables)} />
        <Group title="3. Sales" tone="sales" lines={sales} total={total(sales)} />
        <Group title="4. Taxes" tone="taxes" lines={taxesGroup} total={total(taxesGroup)} />
      </div>
    </div>
  );
}

const TONES: Record<string, { head: string; card: string; accent: string }> = {
  receivable: { head: "bg-emerald-600 text-white", card: "border-emerald-200 dark:border-emerald-900", accent: "text-emerald-700 dark:text-emerald-400" },
  payable: { head: "bg-blue-600 text-white", card: "border-blue-200 dark:border-blue-900", accent: "text-blue-700 dark:text-blue-400" },
  sales: { head: "bg-purple-600 text-white", card: "border-purple-200 dark:border-purple-900", accent: "text-purple-700 dark:text-purple-400" },
  taxes: { head: "bg-orange-500 text-white", card: "border-orange-200 dark:border-orange-900", accent: "text-orange-700 dark:text-orange-400" },
};

function Group({ title, tone, lines, total }: { title: string; tone: keyof typeof TONES; lines: Line[]; total: number }) {
  const t = TONES[tone];
  return (
    <Card className={cn("overflow-hidden", t.card)}>
      <div className={cn("px-4 py-2.5 text-sm font-semibold tracking-wide uppercase", t.head)}>{title}</div>
      <CardContent className="p-4 space-y-3">
        {lines.map(l => (
          <div key={l.code} className="rounded-md border">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm font-medium">
                <span className={cn("mr-2 tabular-nums", t.accent)}>{l.code}</span>{l.label}
              </span>
              <span className="text-sm font-semibold tabular-nums">{fmtPKR(l.value)}</span>
            </div>
            {l.children && (
              <div className="border-t border-dashed px-3 py-2 space-y-1">
                {l.children.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{`(${["i","ii","iii","iv"][i] ?? i + 1}) ${c.label}`}</span>
                    <span className="tabular-nums">{fmtPKR(c.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="font-medium text-muted-foreground">Group Total</span>
          <span className="font-semibold tabular-nums">{fmtPKR(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
