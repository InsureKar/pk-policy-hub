import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { fmtPKR } from "@/lib/format";
import { SubHeadTabs } from "@/components/SubHeadTabs";
import { DealAmountTable } from "@/components/DealAmountTable";

export const Route = createFileRoute("/_app/accounts/sales")({
  component: SalesPage,
});

const sb = supabase as any;

const SUBHEADS = [
  { value: "commission_income", label: "Commission Income" },
  { value: "income_loading", label: "Income Loading" },
  { value: "marketing_budget", label: "Marketing Budget" },
];

function SalesPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin", "management"]);
  const [head, setHead] = useState("commission_income");

  const { data } = useQuery({
    queryKey: ["accounts-sales"],
    enabled: isAdmin,
    queryFn: async () => {
      const [deals, clients] = await Promise.all([
        sb.from("deals").select("id,deal_number,policy_number,client_id,created_at,commission_before_tax,marketing_before_tax,loading").order("created_at", { ascending: false }),
        sb.from("clients").select("id,company_name,full_name"),
      ]);
      return {
        rows: (deals.data ?? []) as any[],
        clients: new Map(((clients.data ?? []) as any[]).map(c => [c.id, c.company_name || c.full_name])),
      };
    },
  });

  const rows = data?.rows ?? [];
  const clientOf = (r: any) => (data?.clients.get(r.client_id) as string) ?? "";

  const totals = useMemo(() => rows.reduce((a, r) => {
    a.commission += Number(r.commission_before_tax || 0);
    a.loading += Number(r.loading || 0);
    a.marketing += Number(r.marketing_before_tax || 0);
    return a;
  }, { commission: 0, loading: 0, marketing: 0 }), [rows]);

  if (!isAdmin) return <Navigate to="/accounts" replace />;

  const column =
    head === "income_loading"
      ? { key: "loading", label: "Income Loading", value: (r: any) => Number(r.loading || 0) }
      : head === "marketing_budget"
        ? { key: "marketing", label: "Marketing Budget", value: (r: any) => Number(r.marketing_before_tax || 0) }
        : { key: "commission", label: "Commission Income", value: (r: any) => Number(r.commission_before_tax || 0) };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPI label="Commission Income" value={fmtPKR(totals.commission)} />
        <KPI label="Income Loading" value={fmtPKR(totals.loading)} />
        <KPI label="Marketing Budget" value={fmtPKR(totals.marketing)} />
      </div>

      <SubHeadTabs value={head} onChange={setHead} items={SUBHEADS} />

      <DealAmountTable
        rows={rows}
        columns={[column]}
        clientOf={clientOf}
        title={SUBHEADS.find(s => s.value === head)!.label}
        emptyLabel="No sales records"
      />
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-lg font-semibold mt-1 tabular-nums">{value}</div>
    </CardContent></Card>
  );
}
