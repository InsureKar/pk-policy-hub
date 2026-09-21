import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/DateField";
import { MoneyInput } from "@/components/MoneyInput";
import { fmtPKR } from "@/lib/format";
import { calculateDealFinancials } from "@/lib/calc";
import { toast } from "sonner";
import B2BTakerField from "@/components/B2BTakerField";
import { openStorageDoc } from "@/lib/openStorageDoc";

const PAYMENT_MODES = ["IBFT", "Cheque", "Cash", "Pay Order", "Online Payment"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Row = {
  id?: string;
  installment_number: number;
  label: string;
  due_date: string;
  amount: number;
  gross: number;
  net: number;
  loading: number;
  commission: number;
  marketing: number;
  b2b: number;
  b2b_type: "fixed" | "percentage";
  b2b_pct: number;
  b2b_taker_name: string;
  status: "due" | "paid";
  paid_date: string;
  mode: string;
  receive_date: string;
  reference: string;
  remarks: string;
  tagged_month: number | null;
  tagged_year: number | null;
};

const blank = (n: number, prev?: Row): Row => ({
  installment_number: n,
  label: `Instalment ${n}`,
  due_date: "",
  amount: 0,
  gross: 0, net: 0, loading: 0, commission: prev?.commission ?? 0, marketing: prev?.marketing ?? 0,
  b2b: 0, b2b_type: "fixed", b2b_pct: 0, b2b_taker_name: prev?.b2b_taker_name ?? "",
  status: "due", paid_date: "", mode: "", receive_date: "", reference: "", remarks: "",
  tagged_month: null, tagged_year: null,
});

/**
 * Custom ("set your own plan") instalment schedule on an existing deal.
 * Previously saved instalments are locked — the user can only mark them
 * Paid/Due with collection details, and append one or more new instalments.
 * An instalment only counts once its status is set to Paid, and it is tagged
 * to the month in which it was marked paid.
 */
export function DealCustomInstalments({
  dealId, basePercentage, canEdit = true,
}: {
  dealId: string;
  basePercentage?: number | null;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canSeeSensitive = hasRole(["admin", "management"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [pendingReceipts, setPendingReceipts] = useState<Record<number, { path: string; name: string }[]>>({});

  const { data: savedReceipts } = useQuery({
    queryKey: ["deal-installment-receipts", dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_documents" as any)
        .select("id, file_name, storage_path")
        .eq("deal_id", dealId)
        .eq("doc_type", "b2b_commission_receipt");
      return ((data ?? []) as any[]).map((d) => ({ id: d.id, file_name: d.file_name, storage_path: d.storage_path }));
    },
    enabled: !!dealId,
  });

  const receiptsFor = (label: string) =>
    (savedReceipts ?? []).filter((d) => d.file_name.startsWith(`${label} — `));

  const { data: saved } = useQuery({
    queryKey: ["deal-installments", dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_installments" as any)
        .select("*").eq("deal_id", dealId).order("installment_number");
      return (data ?? []) as any[];
    },
    enabled: !!dealId,
  });

  useEffect(() => {
    if (!saved) return;
    setRows(saved.map((s: any, i: number) => ({
      id: s.id,
      installment_number: s.installment_number ?? i + 1,
      label: s.label ?? `Instalment ${i + 1}`,
      due_date: s.due_date ?? "",
      amount: Number(s.amount ?? 0),
      gross: Number(s.gross_premium ?? 0),
      net: Number(s.net_premium ?? 0),
      loading: Number(s.loading ?? 0),
      commission: Number(s.commission_percentage ?? 0),
      marketing: Number(s.marketing_budget ?? 0) > 0 && Number(s.gross_premium ?? 0) > 0
        ? Math.round((Number(s.marketing_budget) / Number(s.gross_premium)) * 100 * 1000) / 1000
        : 0,
      b2b: Number(s.b2b_commission ?? 0),
      b2b_type: "fixed" as const,
      b2b_pct: 0,
      b2b_taker_name: s.b2b_taker_name ?? "",
      status: (s.payment_status === "paid" ? "paid" : "due") as "due" | "paid",
      paid_date: s.paid_date ?? "",
      mode: s.payment_mode ?? "",
      receive_date: s.payment_receive_date ?? "",
      reference: s.transaction_reference ?? "",
      remarks: s.payment_remarks ?? "",
      tagged_month: s.tagged_month ?? null,
      tagged_year: s.tagged_year ?? null,
    })));
  }, [saved]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const b2bOf = (r: Row) =>
    r.b2b_type === "percentage" ? Math.round((r.gross || 0) * (r.b2b_pct || 0)) / 100 : r.b2b || 0;

  const calcs = useMemo(() => rows.map((r) => calculateDealFinancials({
    gross_premium: r.gross,
    net_premium: r.net,
    commission_percentage: r.commission,
    marketing_budget_percentage: r.marketing,
    loading: r.loading,
    b2b_commission: b2bOf(r),
    base_percentage: basePercentage ?? undefined,
  })), [rows, basePercentage]);

  const totals = useMemo(() => calcs.reduce((a, c) => ({
    gross: a.gross + c.gross_premium, net: a.net + c.net_premium,
    commBefore: a.commBefore + c.commission_before_tax, commTax: a.commTax + c.commission_tax,
    commAfter: a.commAfter + c.commission_after_tax,
    mktBefore: a.mktBefore + c.marketing_before_tax, mktTax: a.mktTax + c.marketing_tax,
    mktAfter: a.mktAfter + c.marketing_after_tax,
    loading: a.loading + c.loading, b2b: a.b2b + c.b2b_commission,
    income: a.income + c.total_income, tagged: a.tagged + c.tagged_premium,
  }), {
    gross: 0, net: 0, commBefore: 0, commTax: 0, commAfter: 0, mktBefore: 0, mktTax: 0,
    mktAfter: 0, loading: 0, b2b: 0, income: 0, tagged: 0,
  }), [calcs]);

  const outstanding = rows.reduce((a, r) => a + (r.status === "paid" ? 0 : r.amount), 0);
  const collected = rows.reduce((a, r) => a + (r.status === "paid" ? r.amount : 0), 0);

  const addRow = () =>
    setRows((rs) => [...rs, blank(rs.length ? rs[rs.length - 1].installment_number + 1 : 1, rs[rs.length - 1])]);

  const removeRow = async (i: number) => {
    const r = rows[i];
    if (r.id) {
      if (!window.confirm("Remove this instalment permanently?")) return;
      const { error } = await supabase.from("deal_installments" as any).delete().eq("id", r.id);
      if (error) return toast.error(error.message);
    }
    setRows((rs) => rs.filter((_, idx) => idx !== i));
    qc.invalidateQueries({ queryKey: ["deal-installments", dealId] });
  };

  const buildPayload = async (r: Row, i: number) => {
    const now = new Date();
    const { data: auth } = await supabase.auth.getUser();
    const c = calcs[i];
    // Paid instalments are tagged to the month of their paid date
    // (falling back to any existing tag, then to the current month).
    const pd = r.paid_date ? new Date(r.paid_date) : null;
    const tagged = r.status === "paid"
      ? pd && !isNaN(pd.getTime())
        ? { m: pd.getMonth() + 1, y: pd.getFullYear() }
        : { m: r.tagged_month ?? now.getMonth() + 1, y: r.tagged_year ?? now.getFullYear() }
      : { m: null, y: null };
    return {
      ...(r.id ? { id: r.id } : {}),
      deal_id: dealId,
      installment_number: r.installment_number,
      label: r.label,
      due_date: r.due_date || null,
      amount: r.amount,
      paid_amount: r.status === "paid" ? r.amount : 0,
      paid_date: r.status === "paid" ? (r.paid_date || r.receive_date || null) : null,
      gross_premium: r.gross,
      net_premium: r.net,
      loading: r.loading,
      commission_percentage: r.commission,
      marketing_budget: c ? c.marketing_before_tax : 0,
      commission: c ? c.commission_before_tax : 0,
      b2b_commission: b2bOf(r),
      b2b_taker_name: r.b2b_taker_name.trim() || null,
      payment_status: r.status,
      payment_mode: r.mode || null,
      payment_receive_date: r.receive_date || null,
      transaction_reference: r.reference.trim() || null,
      payment_remarks: r.remarks.trim() || null,
      tagged_month: tagged.m,
      tagged_year: tagged.y,
      created_by: auth.user?.id ?? null,
    };
  };

  // Roll the instalment breakdowns up to the deal, exactly like the new-deal
  // screen does, so the deal header totals stay in step. Each instalment keeps
  // its OWN commission percentage and commission amount in deal_installments —
  // this roll-up only sums amounts and never rewrites, averages or
  // redistributes an instalment's own commission.
  const rollupDeal = async () => {
    const agg = calcs.reduce((a, c) => ({
      comm: a.comm + c.commission_before_tax, mkt: a.mkt + c.marketing_before_tax,
      loading: a.loading + c.loading, b2b: a.b2b + c.b2b_commission,
      gross: a.gross + c.gross_premium, net: a.net + c.net_premium,
    }), { comm: 0, mkt: 0, loading: 0, b2b: 0, gross: 0, net: 0 });
    await supabase.from("deals").update({
      gross_premium: agg.gross,
      net_premium: agg.net,
      commission_percentage: agg.gross > 0 ? (agg.comm / agg.gross) * 100 : 0,
      marketing_budget_percentage: agg.gross > 0 ? (agg.mkt / agg.gross) * 100 : 0,
      loading: agg.loading,
      b2b_commission: agg.b2b,
    } as any).eq("id", dealId);
  };

  const attachReceipts = async (i: number) => {
    const files = pendingReceipts[i] ?? [];
    if (!files.length) return;
    const { data: auth } = await supabase.auth.getUser();
    const label = rows[i]?.label ?? `Instalment ${i + 1}`;
    const docs = files.map((p) => ({
      deal_id: dealId,
      doc_type: "b2b_commission_receipt",
      file_name: `${label} — ${p.name}`,
      storage_path: p.path,
      uploaded_by: auth.user?.id ?? null,
    }));
    const { error } = await supabase.from("deal_documents").insert(docs as any);
    if (error) toast.error("Instalment saved, but receipt failed to attach: " + error.message);
    else setPendingReceipts((m) => ({ ...m, [i]: [] }));
    qc.invalidateQueries({ queryKey: ["deal-installment-receipts", dealId] });
  };

  const uploadReceipts = async (i: number, fileList: File[]) => {
    if (!fileList.length) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setUploadingIdx(i);
    const done: { path: string; name: string }[] = [];
    for (const file of fileList) {
      const path = `b2b-receipts/${auth.user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("crm-documents").upload(path, file, { upsert: false });
      if (error) toast.error(`${file.name}: ${error.message}`);
      else done.push({ path, name: file.name });
    }
    setUploadingIdx(null);
    if (!done.length) return;
    setPendingReceipts((m) => ({ ...m, [i]: [...(m[i] ?? []), ...done] }));
    toast.success(`${done.length} receipt(s) uploaded`);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["deal-installments", dealId] });
    qc.invalidateQueries({ queryKey: ["deal", dealId] });
  };

  // Save a single instalment (its premium boxes, collection details, receipts).
  const saveRow = async (i: number) => {
    setSavingIdx(i);
    const payload = await buildPayload(rows[i], i);
    const { error } = await supabase
      .from("deal_installments" as any)
      .upsert([payload] as any, { onConflict: "deal_id,installment_number" });
    if (error) { setSavingIdx(null); return toast.error(error.message); }
    await attachReceipts(i);
    await rollupDeal();
    setSavingIdx(null);
    toast.success(`${rows[i].label} saved`);
    invalidate();
  };

  const save = async () => {
    setSaving(true);
    const payload = await Promise.all(rows.map((r, i) => buildPayload(r, i)));
    const { error } = await supabase
      .from("deal_installments" as any)
      .upsert(payload as any, { onConflict: "deal_id,installment_number" });
    if (error) { setSaving(false); return toast.error(error.message); }

    for (let i = 0; i < rows.length; i++) await attachReceipts(i);
    await rollupDeal();

    setSaving(false);
    toast.success("Instalment plan saved");
    invalidate();
  };

  // Sequential unlock: only the first saved instalment that is still unpaid can
  // be edited. Paid instalments and later unpaid ones stay locked. Newly added
  // (unsaved) rows remain editable so users can append instalments.
  const firstUnpaidSaved = rows.findIndex((r) => r.id && r.status !== "paid");
  const rowEditable = (i: number) => canEdit && (!rows[i]?.id || i === firstUnpaidSaved);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Instalment Plan — Custom</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">Instalment</th>
                <th className="text-left p-2 whitespace-nowrap">Due Date</th>
                <th className="text-right p-2 whitespace-nowrap">Amount</th>
                <th className="text-left p-2 whitespace-nowrap">Payment Status</th>
                <th className="text-left p-2 whitespace-nowrap">Tagged Month</th>
                {canEdit && <th className="p-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No instalments yet</td></tr>
              )}
              {rows.map((r, i) => (
                <Fragment key={r.id ?? `new-${i}`}>
                  <tr className="border-t align-top">
                    <td className="p-2 whitespace-nowrap">
                      <button type="button" className="underline underline-offset-2 hover:text-primary"
                        onClick={() => setOpen(open === i ? null : i)}>
                        {r.label} {open === i ? "▾" : "▸"}
                      </button>
                    </td>
                    <td className="p-2 min-w-[170px]">
                      {canEdit && !r.id
                        ? <DateField value={r.due_date} onChange={(v) => setRow(i, { due_date: v })} placeholder="Due date" />
                        : (r.due_date || "—")}
                    </td>
                    <td className="p-2 text-right min-w-[150px]">
                      {canEdit && !r.id
                        ? <div className="max-w-[200px] ml-auto"><MoneyInput value={r.amount} onChange={(v) => setRow(i, { amount: v })} showWords={false} /></div>
                        : <span className="tabular-nums">{fmtPKR(r.amount)}</span>}
                    </td>
                    <td className="p-2 min-w-[130px]">
                      {rowEditable(i) ? (
                        <Select
                          value={r.status}
                          onValueChange={(v) => {
                            const status = v as "due" | "paid";
                            if (status === "paid") {
                              setRow(i, {
                                status,
                                paid_date: r.paid_date || new Date().toISOString().slice(0, 10),
                              });
                              setOpen(i);
                            } else {
                              setRow(i, { status, paid_date: "", tagged_month: null, tagged_year: null });
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="due">Due</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : r.status}
                    </td>
                    <td className="p-2 whitespace-nowrap text-muted-foreground">
                      {r.status === "paid"
                        ? (() => {
                          const pd = r.paid_date ? new Date(r.paid_date) : null;
                          if (pd && !isNaN(pd.getTime())) return `${MONTHS[pd.getMonth()]} ${pd.getFullYear()}`;
                          if (r.tagged_month) return `${MONTHS[r.tagged_month - 1]} ${r.tagged_year ?? ""}`;
                          return `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()} (on save)`;
                        })()
                        : "—"}
                    </td>
                    {canEdit && (
                      <td className="p-2 text-right">
                        {!r.id && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}>Remove</Button>
                        )}
                      </td>
                    )}
                  </tr>
                  {open === i && (
                    <tr className="bg-muted/40">
                      <td colSpan={6} className="p-3 space-y-3">
                        <div>
                          <div className="text-xs font-medium mb-2">
                            {r.label} — Premium &amp; Commission{" "}
                            <span className="text-muted-foreground font-normal">(hand written for this instalment)</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                            <div><p className="mb-1 text-muted-foreground">Gross Premium</p>
                              <MoneyInput value={r.gross} onChange={(v) => setRow(i, { gross: v })} disabled={!rowEditable(i)} showWords={false} /></div>
                            <div><p className="mb-1 text-muted-foreground">Net Premium</p>
                              <MoneyInput value={r.net} onChange={(v) => setRow(i, { net: v })} disabled={!rowEditable(i)} showWords={false} /></div>
                            <div><p className="mb-1 text-muted-foreground">Commission %</p>
                              <Input type="number" step="0.001" className="text-right" disabled={!rowEditable(i)} value={r.commission}
                                onChange={(e) => setRow(i, { commission: Number(e.target.value) || 0 })} /></div>
                            <div><p className="mb-1 text-muted-foreground">Marketing Budget %</p>
                              <Input type="number" step="0.001" className="text-right" disabled={!rowEditable(i)} value={r.marketing}
                                onChange={(e) => setRow(i, { marketing: Number(e.target.value) || 0 })} /></div>
                            <div><p className="mb-1 text-muted-foreground">Loading</p>
                              <MoneyInput value={r.loading} onChange={(v) => setRow(i, { loading: v })} disabled={!rowEditable(i)} showWords={false} /></div>
                            <div><p className="mb-1 text-muted-foreground">B2B Commission Type</p>
                              <Select value={r.b2b_type} disabled={!rowEditable(i)} onValueChange={(v) => setRow(i, { b2b_type: v as "fixed" | "percentage" })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                                  <SelectItem value="percentage">Percentage of Gross</SelectItem>
                                </SelectContent>
                              </Select></div>
                            {r.b2b_type === "percentage" ? (
                              <div><p className="mb-1 text-muted-foreground">B2B Commission %</p>
                                <Input type="number" step="0.001" className="text-right" disabled={!rowEditable(i)} value={r.b2b_pct}
                                  onChange={(e) => setRow(i, { b2b_pct: Number(e.target.value) || 0 })} /></div>
                            ) : (
                              <div><p className="mb-1 text-muted-foreground">B2B Commission</p>
                                <MoneyInput value={r.b2b} onChange={(v) => setRow(i, { b2b: v })} disabled={!rowEditable(i)} showWords={false} /></div>
                            )}
                            <div className="col-span-2 md:col-span-6"><p className="mb-1 text-muted-foreground">Name of B2B Commission Taker</p>
                              {rowEditable(i)
                                ? <B2BTakerField value={r.b2b_taker_name} onChange={(v) => setRow(i, { b2b_taker_name: v })} />
                                : <span>{r.b2b_taker_name || "—"}</span>}</div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
                            <div className="rounded-md border p-3">
                              <p className="text-xs text-muted-foreground">Commission ({r.commission || 0}%)</p>
                              <p className="font-medium tabular-nums">{fmtPKR(calcs[i]?.commission_before_tax ?? 0)}</p>
                            </div>
                            <div className="rounded-md border p-3">
                              <p className="text-xs text-muted-foreground">Tagged Premium</p>
                              <p className="font-medium tabular-nums">{fmtPKR(calcs[i]?.tagged_premium ?? 0)}</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium mb-2">Payment to Company — Collection Details — {r.label}</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            {r.status === "paid" && (
                              <div><p className="mb-1 text-muted-foreground">Paid Date</p>
                                <DateField value={r.paid_date} onChange={(v) => setRow(i, { paid_date: v })} disabled={!rowEditable(i)} placeholder="Paid date" />
                                <p className="mt-1 text-[11px] text-muted-foreground">Tagged to this month</p></div>
                            )}
                            <div><p className="mb-1 text-muted-foreground">Payment Method</p>
                              <Select value={r.mode} disabled={!rowEditable(i)} onValueChange={(v) => setRow(i, { mode: v })}>
                                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select></div>
                            <div><p className="mb-1 text-muted-foreground">Payment Receive Date</p>
                              <DateField value={r.receive_date} onChange={(v) => setRow(i, { receive_date: v })} disabled={!rowEditable(i)} placeholder="Receive date" /></div>
                            <div><p className="mb-1 text-muted-foreground">Transaction / Cheque Reference</p>
                              <Input value={r.reference} disabled={!rowEditable(i)} onChange={(e) => setRow(i, { reference: e.target.value })} placeholder="TID / Cheque no." /></div>
                            <div><p className="mb-1 text-muted-foreground">Payment Remarks</p>
                              <Input value={r.remarks} disabled={!rowEditable(i)} onChange={(e) => setRow(i, { remarks: e.target.value })} /></div>
                          </div>
                        </div>
                        <div className="space-y-1.5 max-w-md">
                          <div className="text-xs font-medium">Payment Receipt — {r.label}</div>
                          {rowEditable(i) && (
                            <Input type="file" multiple accept="image/*,application/pdf"
                              disabled={uploadingIdx === i}
                              onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) uploadReceipts(i, fs); e.currentTarget.value = ""; }} />
                          )}
                          {(receiptsFor(r.label).length > 0 || (pendingReceipts[i] ?? []).length > 0) && (
                            <ul className="space-y-1">
                              {receiptsFor(r.label).map((d) => (
                                <li key={d.id} className="rounded border px-2 py-1 text-xs truncate">
                                  <button type="button" className="text-primary hover:underline truncate" title="View receipt"
                                    onClick={() => openStorageDoc(d.storage_path)}>{d.file_name.replace(`${r.label} — `, "")}</button>
                                </li>
                              ))}
                              {(pendingReceipts[i] ?? []).map((p) => (
                                <li key={p.path} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                                  <span className="truncate">{p.name}</span>
                                  {rowEditable(i) && (
                                    <button type="button" className="text-destructive ml-2"
                                      onClick={() => setPendingReceipts((m) => ({ ...m, [i]: (m[i] ?? []).filter((x) => x.path !== p.path) }))}>Remove</button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {uploadingIdx === i ? "Uploading…" : `Attach the payment receipt for ${r.label}.`}
                          </p>
                        </div>
                        {rowEditable(i) ? (
                          <div className="flex justify-end">
                            <Button type="button" size="sm" onClick={() => saveRow(i)} disabled={savingIdx === i}>
                              {savingIdx === i ? "Saving…" : `Save ${r.label}`}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-right">
                            {r.status === "paid"
                              ? "This instalment is paid and locked."
                              : "Locked — mark the earlier instalment as paid to unlock this one."}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 justify-between">
              <Button type="button" variant="outline" onClick={addRow}>Add Instalment</Button>
              <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Instalment Plan"}</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Open any instalment to fill in its premium &amp; commission details or mark it Paid — you can also add one or more new instalments below.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Box label="Collected (Paid)" value={fmtPKR(collected)} />
          <Box label="Outstanding Premium" value={fmtPKR(outstanding)} />
          <Box label="Gross Premium (all instalments)" value={fmtPKR(totals.gross)} />
          <Box label="Net Premium (all instalments)" value={fmtPKR(totals.net)} />
          <Box label="B2B Commission" value={fmtPKR(totals.b2b)} />
          <Box label="Tagged Premium" value={fmtPKR(totals.tagged)} />
          {canSeeSensitive && (
            <>
              <Box label="Commission Before Tax" value={fmtPKR(totals.commBefore)} />
              <Box label="Commission Tax (17%)" value={fmtPKR(totals.commTax)} />
              <Box label="Commission After Tax" value={fmtPKR(totals.commAfter)} />
              <Box label="Marketing Before Tax" value={fmtPKR(totals.mktBefore)} />
              <Box label="Marketing Tax (9%)" value={fmtPKR(totals.mktTax)} />
              <Box label="Marketing After Tax" value={fmtPKR(totals.mktAfter)} />
              <Box label="Loading" value={fmtPKR(totals.loading)} />
              <Box label="Total Income" value={fmtPKR(totals.income)} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
