import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCorrectDealRecords } from "@/lib/deal-correction-access";
import { dealRecordFields } from "@/lib/deal-record-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/MoneyInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { refreshCorrectedInstalmentTotals } from "@/lib/deal-instalment-rollup";
import { calculateDealFinancials } from "@/lib/calc";

const enums: Record<string, string[]> = {
  deal_type: ["fresh", "renewal"], policy_type_kind: ["single", "bulk"],
  installment_status: ["pending", "partial", "paid", "overdue"],
  invoice_status: ["draft", "pending_approval", "approved", "rejected", "sent"],
  payable_category: ["commission", "b2b_commission", "tax", "expense", "other"],
  payable_status: ["pending", "paid", "cancelled"],
  payment_method_type: ["cash", "cheque", "ibft", "bank_transfer", "online", "other"],
  payment_schedule_type: ["annual", "half_yearly", "quarterly", "monthly"],
  receivable_status: ["open", "partial", "paid", "overdue", "cancelled"],
  tax_kind: ["income_tax", "sales_tax", "marketing_budget_tax", "commission_taker_tax", "b2b_commission_tax"],
  line_of_business: ["group_health", "motor", "marine", "travel", "fire", "misc"],
};
const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function DealRecordEditor({ table, title, record, defaults = {}, fields, onSaved }: {
  table: string; title: string; record?: Record<string, any>; defaults?: Record<string, any>;
  fields?: string[]; onSaved: () => void;
}) {
  const { roles, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [file, setFile] = useState<File | null>(null);
  const { data: choices } = useQuery({
    queryKey: ["deal-correction-choices"], enabled: open && canCorrectDealRecords(roles),
    queryFn: async () => {
      const tables = ["profiles", "teams", "clients", "insurance_companies", "insurance_types", "lead_sources", "deal_stages", "receivables", "installments", "invoices", "policies", "commission_payables", "tax_records", "expenses"];
      const pairs = await Promise.all(tables.map(async (t) => {
        const { data, error } = await (supabase as any).from(t).select("*");
        if (error) throw error;
        return [t, (data ?? []).map((r: any) => ({ id: r.id, label: r.full_name || r.company_name || r.name || r.receivable_number || r.invoice_number || r.policy_number || r.payable_number || r.label || r.expense_code || `${r.tax_type ?? t} ${r.period_date ?? ""}` }))] as const;
      }));
      return Object.fromEntries(pairs) as Record<string, { id: string; label: string }[]>;
    },
  });
  useEffect(() => { if (open) { setForm({ ...defaults, ...record }); setFile(null); } }, [open]);
  if (!canCorrectDealRecords(roles)) return null;
  const columns = (dealRecordFields[table] ?? []).filter((f) =>
    !(f.key in defaults) && (!fields || fields.includes(f.key)) &&
    !(table === "deal_installments" && ["commission", "tagged_month", "tagged_year"].includes(f.key)));
  const relation: Record<string, string> = {
    client_id: "clients", company_id: "insurance_companies", insurance_company_id: "insurance_companies", insurance_company_id_payment: "insurance_companies",
    insurance_type_id: "insurance_types", source_id: "lead_sources", stage_id: "deal_stages", team_id: "teams",
    assigned_do_id: "profiles", team_lead_id: "profiles", received_by: "profiles", owner_id: "profiles", b2b_taker_id: "profiles", beneficiary_id: "profiles", deducted_from: "profiles", payee_profile_id: "profiles",
    receivable_id: "receivables", installment_id: "installments", parent_invoice_id: "invoices", policy_id: "policies", commission_payable_id: "commission_payables", tax_record_id: "tax_records", expense_id: "expenses",
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const payload: Record<string, any> = record ? {} : { ...defaults };
      for (const field of columns) {
        const value = form[field.key];
        if (record && value === record[field.key]) continue;
        if (value === undefined || value === "") {
          if (!record && field.defaulted) continue;
          payload[field.key] = field.required && ["numeric", "int4", "int8"].includes(field.type) ? 0 : null;
        } else payload[field.key] = value;
      }
      if (file) {
        const path = `deal-corrections/${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const upload = await supabase.storage.from("crm-documents").upload(path, file);
        if (upload.error) throw upload.error;
        payload.storage_path = path;
        if (table === "deal_documents") payload.file_name = form.file_name || file.name;
        else payload.name = form.name || file.name;
      }
      if (!record && table === "deal_documents") payload.uploaded_by = user.id;
      if (!record && table === "documents") payload.uploaded_by = user.id;
      if (!record && table === "payments") payload.recorded_by = user.id;
      if (!record && table === "receivables") payload.created_by = user.id;
      if (!record && table === "deal_installments") payload.created_by = user.id;
      if (table === "deal_installments") {
        const row = { ...record, ...defaults, ...payload };
        const gross = Number(row.gross_premium ?? 0);
        payload.commission = calculateDealFinancials({ gross_premium: gross, commission_percentage: row.commission_percentage }).commission_before_tax;
        if (row.payment_status === "paid") {
          if (!row.paid_date) throw new Error("Enter the paid date before saving a paid instalment.");
          const receipts = await supabase.from("deal_documents").select("file_name").eq("deal_id", row.deal_id).eq("doc_type", "b2b_commission_receipt");
          if (receipts.error) throw receipts.error;
          if (!receipts.data?.some((d) => d.file_name.startsWith(`${row.label} — `))) throw new Error("Upload the payment receipt before saving a paid instalment.");
          const date = new Date(`${String(row.paid_date).slice(0, 10)}T00:00:00`);
          payload.tagged_month = date.getMonth() + 1;
          payload.tagged_year = date.getFullYear();
        } else if (payload.payment_status === "due") {
          payload.tagged_month = null; payload.tagged_year = null;
        }
      }
      const result = record
        ? await (supabase as any).from(table).update(payload).eq("id", record.id).select("id").maybeSingle()
        : await (supabase as any).from(table).insert(payload).select("id").single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("This record could not be saved with your current access.");
      if (table === "deal_installments") await refreshCorrectedInstalmentTotals(String(defaults.deal_id ?? record?.deal_id));
      toast.success(`${title} saved`); setOpen(false); onSaved();
    } catch (e: any) { toast.error(e.message ?? "Could not save record"); }
    finally { setBusy(false); }
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`${record ? "Edit" : "Add"} ${title}`}>
      {record ? <Pencil className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}{record ? "Edit" : "Add"} {title}
    </Button>
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? "Edit" : "Add"} {title}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          {columns.map((f) => {
            const id = `${table}-${f.key}`;
            return <div key={f.key} className="space-y-1.5"><Label htmlFor={id}>{label(f.key)}</Label>
              {f.type === "bool" ? <Checkbox id={id} checked={!!form[f.key]} onCheckedChange={(v) => setForm((s) => ({ ...s, [f.key]: v === true }))} />
                : relation[f.key] ? <Select value={form[f.key] || "__empty"} onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: v === "__empty" ? null : v }))}>
                  <SelectTrigger id={id}><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="__empty">—</SelectItem>{(choices?.[relation[f.key]] ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
                : enums[f.type] ? <Select value={form[f.key] || "__empty"} onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: v === "__empty" ? null : v }))}>
                  <SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__empty">—</SelectItem>{enums[f.type].map((v) => <SelectItem key={v} value={v}>{label(v)}</SelectItem>)}</SelectContent>
                </Select>
                : f.type === "numeric" && !/percentage|rate/.test(f.key) ? <div aria-label={label(f.key)}><MoneyInput value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} /></div>
                : <Input id={id} type={f.type === "date" ? "date" : f.type === "timestamptz" ? "datetime-local" : ["numeric", "int4", "int8"].includes(f.type) ? "number" : "text"}
                  step="any" value={form[f.key] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [f.key]: ["numeric", "int4", "int8"].includes(f.type) ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))} />}
            </div>;
          })}
          {["deal_documents", "documents"].includes(table) && <div className="space-y-1.5"><Label htmlFor={`${table}-file`}>Upload file</Label><Input id={`${table}-file`} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Changes"}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

export function DealRecordDelete({ table, title, record, onSaved }: { table: string; title: string; record: Record<string, any>; onSaved: () => void }) {
  const { roles } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!canCorrectDealRecords(roles)) return null;
  return <Button variant="ghost" size="icon" title={`Delete ${title}`} aria-label={`Delete ${title}`} disabled={busy} onClick={async () => {
    if (!window.confirm(`Delete this ${title} and its dependent records? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).from(table).delete().eq("id", record.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("This record could not be deleted with your current access.");
      if (table === "deal_installments") await refreshCorrectedInstalmentTotals(record.deal_id);
      toast.success(`${title} deleted`); onSaved();
    } catch (e: any) { toast.error(e.message ?? "Could not delete record"); }
    finally { setBusy(false); }
  }}><Trash2 className="w-4 h-4 text-destructive" /></Button>;
}