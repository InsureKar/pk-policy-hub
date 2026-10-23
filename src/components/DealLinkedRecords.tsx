import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCorrectDealRecords } from "@/lib/deal-correction-access";
import { DealRecordEditor, DealRecordDelete } from "@/components/DealRecordEditor";
import { fmtPKR } from "@/lib/format";

export function DealLinkedRecords({ dealId, clientId }: { dealId: string; clientId: string | null }) {
  const { roles } = useAuth();
  const allowed = canCorrectDealRecords(roles);
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["deal-linked-records", dealId], enabled: allowed,
    queryFn: async () => {
      const tables = ["deal_installments", "receivables", "invoices", "payables", "commission_payables", "tax_records", "policies"];
      const groups = await Promise.all(tables.map(async (table) => {
        const result = await (supabase as any).from(table).select("*").eq("deal_id", dealId);
        if (result.error) throw result.error;
        return { table, rows: result.data ?? [] };
      }));
      const recvIds = groups.find((g) => g.table === "receivables")?.rows.map((r: any) => r.id) ?? [];
      const policyIds = groups.find((g) => g.table === "policies")?.rows.map((r: any) => r.id) ?? [];
      for (const table of ["payments", "installments", "documents"]) {
        const ids = table === "documents" ? policyIds : recvIds;
        if (!ids.length) { groups.push({ table, rows: [] }); continue; }
        const result = await (supabase as any).from(table).select("*").in(table === "documents" ? "policy_id" : "receivable_id", ids);
        if (result.error) throw result.error;
        groups.push({ table, rows: result.data ?? [] });
      }
      return { groups, recvIds, policyIds };
    },
  });
  if (!allowed) return null;
  const names: Record<string, string> = { deal_installments: "Deal Instalment", receivables: "Receivable", invoices: "Invoice", payables: "Payable", commission_payables: "Commission Payable", tax_records: "Tax Record", policies: "Policy", payments: "Accounting Payment", installments: "Accounting Instalment", documents: "Policy Document" };
  const refresh = () => { qc.invalidateQueries(); };
  return <section className="mt-6 space-y-4 border-t pt-4">
    <h2 className="text-base font-semibold">Linked Records — Admin &amp; Management</h2>
    {error && <p className="text-destructive text-sm">Could not load linked records: {error.message}</p>}
    {data?.groups.map(({ table, rows }) => {
      const title = names[table];
      const defaults: Record<string, any> = ["payments", "installments"].includes(table)
        ? {} : table === "documents" ? {} : { deal_id: dealId };
      if (table === "policies" && clientId) defaults.client_id = clientId;
      return <div key={table} className="space-y-2 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{title}s ({rows.length})</h3>
          <DealRecordEditor table={table} title={title} defaults={defaults} onSaved={refresh} />
        </div>
        {rows.map((r: any) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-2 border-t">
          <span>{r.invoice_number || r.receivable_number || r.payable_number || r.policy_number || r.name || r.label || r.tax_type || r.description || title}</span>
          <span className="tabular-nums">{fmtPKR(Number(r.total_amount ?? r.original_amount ?? r.commission_amount ?? r.amount ?? r.premium ?? 0))}</span>
          <span>{r.status ?? r.payment_date ?? ""}</span>
          <div className="flex items-center gap-1"><DealRecordEditor table={table} title={title} record={r} defaults={defaults} onSaved={refresh} /><DealRecordDelete table={table} title={title} record={r} onSaved={refresh} /></div>
        </div>)}
      </div>;
    })}
  </section>;
}