import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_app/accounts/")({
  component: AccountsDashboard,
});

function AccountsDashboard() {
  const { data } = useQuery({
    queryKey: ["accounts-dashboard"],
    queryFn: async () => {
      const sb = supabase as any;
      const [recv, pay, payables, deals, ledger, taxes] = await Promise.all([
        supabase.from("receivables").select("id,total_amount,paid_amount,outstanding_amount,status,first_due_date,gross_premium,net_premium,commission_receivable,created_at,excluded_from_receivable" as any),
        supabase.from("payments").select("id,amount,payment_date,created_at"),
        supabase.from("commission_payables").select("id,commission_amount,status,paid_date,created_at"),
        supabase.from("deals").select("id,gross_premium,net_premium,stage_id"),
        sb.from("payables").select("id,category,original_amount,paid_amount,outstanding_amount,status"),
        sb.from("tax_records").select("id,tax_type,amount,paid_amount"),
      ]);
      return {
        recv: (recv.data ?? []) as any[],
        pay: pay.data ?? [],
        payables: payables.data ?? [],
        deals: deals.data ?? [],
        ledger: (ledger.data ?? []) as any[],
        taxes: (taxes.data ?? []) as any[],
      };
    },
  });

  const allRecv = (data?.recv ?? []) as any[];
  const excludedDirect = allRecv.filter(r => r.excluded_from_receivable).reduce((a, r) => a + Number(r.total_amount), 0);
  const ledger = data?.ledger ?? [];
  const taxes = data?.taxes ?? [];
  const sumCat = (c: string) => ledger.filter(p => p.category === c).reduce((a, p) => a + Number(p.original_amount || 0), 0);
  const sumTax = (t: string) => taxes.filter(x => x.tax_type === t).reduce((a, x) => a + Number(x.amount || 0), 0);
  const taxOutstanding = taxes.reduce((a, x) => a + Math.max(0, Number(x.amount || 0) - Number(x.paid_amount || 0)), 0);
  const payablesOutstanding = ledger.reduce((a, p) => a + Number(p.outstanding_amount || 0), 0);
  const recv = allRecv.filter(r => !r.excluded_from_receivable);
  const pay = data?.pay ?? [];
  const payables = data?.payables ?? [];

  const today = new Date();
  const totalReceivable = recv.reduce((a, r) => a + Number(r.total_amount), 0);
  const outstanding = recv.reduce((a, r) => a + Number(r.outstanding_amount), 0);
  const overdue = recv
    .filter(r => r.status !== "paid" && r.first_due_date && new Date(r.first_due_date) < today)
    .reduce((a, r) => a + Number(r.outstanding_amount), 0);
  const totalCommissionReceivable = recv.reduce((a, r) => a + Number(r.commission_receivable ?? 0), 0);
  const totalCommissionPayable = payables.reduce((a, p) => a + Number(p.commission_amount), 0);
  const pendingPayable = payables.filter(p => p.status === "pending").reduce((a, p) => a + Number(p.commission_amount), 0);
  const paidCommission = payables.filter(p => p.status === "paid").reduce((a, p) => a + Number(p.commission_amount), 0);
  const totalGross = recv.reduce((a, r) => a + Number(r.gross_premium), 0);
  const totalNet = recv.reduce((a, r) => a + Number(r.net_premium), 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthlyCollections = pay.filter(p => new Date(p.payment_date) >= monthStart).reduce((a, p) => a + Number(p.amount), 0);
  const monthlyCommissionPaid = payables.filter(p => p.status === "paid" && p.paid_date && new Date(p.paid_date) >= monthStart).reduce((a, p) => a + Number(p.commission_amount), 0);

  // Charts
  const monthlyMap: Record<string, { month: string; collections: number; commissionPaid: number }> = {};
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const k = d.toISOString().slice(0, 7);
    keys.push(k);
    monthlyMap[k] = { month: k, collections: 0, commissionPaid: 0 };
  }
  pay.forEach(p => { const k = p.payment_date.slice(0, 7); if (monthlyMap[k]) monthlyMap[k].collections += Number(p.amount); });
  payables.forEach(p => { if (p.paid_date) { const k = p.paid_date.slice(0, 7); if (monthlyMap[k]) monthlyMap[k].commissionPaid += Number(p.commission_amount); } });
  const monthly = keys.map(k => monthlyMap[k]);

  const rvp = [
    { name: "Receivable", value: totalReceivable },
    { name: "Payable", value: totalCommissionPayable },
  ];
  const statusDist = Object.entries(
    recv.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const outstandingTrend = keys.map(k => {
    const cutoff = new Date(k + "-01");
    cutoff.setMonth(cutoff.getMonth() + 1);
    const total = recv.filter(r => new Date(r.created_at) < cutoff).reduce((a, r) => a + Number(r.total_amount), 0);
    const paid = pay.filter(p => new Date(p.payment_date) < cutoff).reduce((a, p) => a + Number(p.amount), 0);
    return { month: k, outstanding: Math.max(0, total - paid) };
  });

  const commissionTrend = keys.map(k => {
    const inMonth = payables.filter(p => (p.created_at ?? "").slice(0, 7) === k);
    return { month: k, generated: inMonth.reduce((a, p) => a + Number(p.commission_amount), 0) };
  });

  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPI label="Total Premium Receivable" value={fmtPKR(totalReceivable)}/>
        <KPI label="Outstanding" value={fmtPKR(outstanding)}/>
        <KPI label="Overdue" value={fmtPKR(overdue)} tone="danger"/>
        <KPI label="Commission Receivable" value={fmtPKR(totalCommissionReceivable)}/>
        <KPI label="Commission Payable" value={fmtPKR(totalCommissionPayable)}/>
        <KPI label="Pending Payable" value={fmtPKR(pendingPayable)}/>
        <KPI label="Paid Commission" value={fmtPKR(paidCommission)}/>
        <KPI label="Monthly Collections" value={fmtPKR(monthlyCollections)}/>
        <KPI label="Monthly Comm. Paid" value={fmtPKR(monthlyCommissionPaid)}/>
        <KPI label="Total Gross Premium" value={fmtPKR(totalGross)}/>
        <KPI label="Total Net Premium" value={fmtPKR(totalNet)}/>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Collections</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="month" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                <Bar dataKey="collections" fill="var(--chart-1)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Receivable vs Payable</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={rvp}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                <Bar dataKey="value" fill="var(--chart-2)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Outstanding Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={outstandingTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="month" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                <Line type="monotone" dataKey="outstanding" stroke="var(--chart-3)" strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Commission Trend (generated)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={commissionTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="month" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v: any) => fmtPKR(Number(v))}/>
                <Line type="monotone" dataKey="generated" stroke="var(--chart-4)" strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Payment Status Distribution</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" outerRadius={100} label>
                  {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip/>
                <Legend/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-lg font-semibold mt-1 tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </CardContent></Card>
  );
}
