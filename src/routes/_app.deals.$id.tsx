import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateDealFinancials } from "@/lib/calc";
import { fmtPKR, fmtPct, fmtDate } from "@/lib/format";
import { DateField } from "@/components/DateField";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/deals/$id")({
  component: DealDetail,
});

const PAYMENT_SCHEDULES = ["Annual", "Half-Yearly", "Quarterly", "Monthly"] as const;
const PAYMENT_MODES = ["IBFT", "Cheque", "Cash", "Pay Order", "Online Payment"] as const;

function DealDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  // Premium & Commission section matches the original spec — visible to all roles.
  const canSeeFinancials = true;


  const { data } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const [deal, stages, companies, types, sources, profiles, teams, clients, settings] = await Promise.all([
        supabase.from("deals").select("*").eq("id", id).maybeSingle(),
        supabase.from("deal_stages").select("*").order("sort_order"),
        supabase.from("insurance_companies").select("id, name"),
        supabase.from("insurance_types").select("id, name"),
        supabase.from("lead_sources").select("id, name"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("teams").select("id, name"),
        supabase.from("clients").select("id, company_name, full_name, client_type"),
        supabase.from("app_settings").select("value").eq("key","tagged_premium_base_percentage").maybeSingle(),
      ]);
      return { deal: deal.data, stages: stages.data ?? [], companies: companies.data ?? [], types: types.data ?? [],
        sources: sources.data ?? [], profiles: profiles.data ?? [], teams: teams.data ?? [], clients: clients.data ?? [],
        basePct: Number(settings.data?.value ?? 13) };
    },
  });

  const [stageId, setStageId] = useState<string>("");
  useEffect(() => { if (data?.deal?.stage_id) setStageId(data.deal.stage_id); }, [data?.deal?.stage_id]);

  const calc = useMemo(() => data?.deal ? calculateDealFinancials({
    gross_premium: data.deal.gross_premium,
    net_premium: data.deal.net_premium,
    commission_percentage: data.deal.commission_percentage,
    marketing_budget_percentage: data.deal.marketing_budget_percentage,
    loading: data.deal.loading,
    b2b_commission: data.deal.b2b_commission,
    base_percentage: (data.deal as any).base_percentage ?? data.basePct,
  }) : null, [data]);

  // Payment form state
  const [pay, setPay] = useState({
    insurance_company_id: "",
    payment_receive_date: "",
    payment_schedule: "",
    payment_mode: "",
    transaction_reference: "",
    received_by: "",
    payment_remarks: "",
  });
  useEffect(() => {
    if (!data?.deal) return;
    setPay({
      insurance_company_id: data.deal.insurance_company_id ?? "",
      payment_receive_date: data.deal.payment_receive_date ?? "",
      payment_schedule: data.deal.payment_schedule ?? "",
      payment_mode: data.deal.payment_mode ?? "",
      transaction_reference: data.deal.transaction_reference ?? "",
      received_by: data.deal.received_by ?? "",
      payment_remarks: data.deal.payment_remarks ?? "",
    });
  }, [data?.deal]);

  if (!data?.deal) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const d = data.deal;
  const company = data.companies.find(c=>c.id===d.insurance_company_id)?.name;
  const type = data.types.find(t=>t.id===d.insurance_type_id)?.name;
  const source = data.sources.find(s=>s.id===d.source_id)?.name;
  const stage = data.stages.find(s=>s.id===d.stage_id);
  const isWon = !!stage?.is_won;
  const doName = data.profiles.find(p=>p.id===d.assigned_do_id)?.full_name;
  const team = data.teams.find(t=>t.id===d.team_id)?.name;
  const c = data.clients.find(x=>x.id===d.client_id);
  const clientName = c ? (c.client_type === "individual" ? (c.full_name || c.company_name) : c.company_name) : null;

  const updateStage = async (newStage: string) => {
    setStageId(newStage);
    const { error } = await supabase.from("deals").update({ stage_id: newStage }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Stage updated"); qc.invalidateQueries({ queryKey: ["deal", id] }); }
  };

  const savePayment = async () => {
    // Mandatory validation
    if (!pay.insurance_company_id) return toast.error("Insurance company is required");
    if (!pay.payment_receive_date) return toast.error("Payment receive date is required");
    if (!pay.payment_schedule) return toast.error("Payment schedule is required");
    if (!pay.payment_mode) return toast.error("Payment mode is required");
    if (!pay.transaction_reference.trim()) return toast.error("Transaction reference is required");
    if (!pay.received_by) return toast.error("Received by is required");

    const { error } = await supabase.from("deals").update({
      insurance_company_id: pay.insurance_company_id,
      payment_receive_date: pay.payment_receive_date,
      payment_schedule: pay.payment_schedule,
      payment_mode: pay.payment_mode,
      transaction_reference: pay.transaction_reference.trim(),
      received_by: pay.received_by,
      payment_remarks: pay.payment_remarks.trim() || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment information saved");
    qc.invalidateQueries({ queryKey: ["deal", id] });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <Link to="/deals" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4"/>Back to deals</Link>
      <PageHeader title={d.deal_number} subtitle={`${clientName ?? "—"} · Created ${fmtDate(d.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-xs">Stage:</Label>
            <Select value={stageId} onValueChange={updateStage}>
              <SelectTrigger className="w-[200px]"><SelectValue/></SelectTrigger>
              <SelectContent>{data.stages.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className={canSeeFinancials ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader><CardTitle className="text-base">Deal Information</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <KV k="Cover Note #" v={d.cover_note_number || "—"} />
            <KV k="Policy #" v={d.policy_number || "—"} />
            <KV k="Deal Type" v={<Badge variant="outline">{(d as any).deal_type === "renewal" ? "Renewal" : "Fresh"}</Badge>} />
            <KV k="Insurance Company" v={company || "—"} />
            <KV k="Product" v={type || "—"} />
            <KV k="Source" v={source || "—"} />
            <KV k="Stage" v={stage ? <Badge variant={stage.is_won?"default":stage.is_lost?"destructive":"secondary"}>{stage.name}</Badge> : "—"} />
            {canSeeFinancials && <KV k="Assigned DO" v={doName || "—"} />}
            {canSeeFinancials && <KV k="Team" v={team || "—"} />}
            <KV k="Policy Start" v={fmtDate(d.policy_start_date)} />
            <KV k="Policy End" v={fmtDate(d.policy_end_date)} />
            <KV k="Gross Premium" v={fmtPKR(Number(d.gross_premium))} />
          </CardContent>
        </Card>

        {canSeeFinancials && (
          <Card>
            <CardHeader><CardTitle className="text-base">Premium & Income</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {calc && <>
                <KV k="Gross Premium" v={fmtPKR(calc.gross_premium)} />
                <KV k="Net Premium" v={fmtPKR(calc.net_premium)} />
                <KV k="Tagged Premium (auto)" v={<span className="font-semibold">{fmtPKR(calc.tagged_premium)}</span>} />
                <KV k="Commission %" v={fmtPct(calc.commission_percentage)} />
                <KV k="Marketing %" v={fmtPct(calc.marketing_budget_percentage)} />
                <KV k="Loading" v={fmtPKR(calc.loading)} />
                <KV k="B2B Commission" v={fmtPKR(calc.b2b_commission)} />
                <hr/>
                <KV k="Commission Before Tax" v={fmtPKR(calc.commission_before_tax)} />
                <KV k="Commission Tax (17%)" v={fmtPKR(calc.commission_tax)} />
                <KV k="Commission After Tax" v={fmtPKR(calc.commission_after_tax)} />
                <KV k="Marketing Before Tax" v={fmtPKR(calc.marketing_before_tax)} />
                <KV k="Marketing Tax (9%)" v={fmtPKR(calc.marketing_tax)} />
                <KV k="Marketing After Tax" v={fmtPKR(calc.marketing_after_tax)} />
                <KV k="Total Income" v={<span className="font-semibold">{fmtPKR(calc.total_income)}</span>} />
                <KV k="Income %" v={fmtPct(calc.income_percentage)} />
                <KV k={`Tagged Premium % (base ${calc.base_percentage}%)`} v={fmtPct(calc.tagged_premium_percentage)} />
                <KV k="Tagged Premium" v={<span className="font-semibold">{fmtPKR(calc.tagged_premium)}</span>} />
              </>}
            </CardContent>
          </Card>
        )}
      </div>

      {isWon && (
        <Card className="mt-4 border-primary/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Payment Information
              <Badge variant="default">Required — Deal Won</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Insurance Company *">
              <Select value={pay.insurance_company_id} onValueChange={(v)=>setPay(p=>({...p, insurance_company_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Select company"/></SelectTrigger>
                <SelectContent>{data.companies.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Payment Receive Date *">
              <DateField value={pay.payment_receive_date} onChange={(v)=>setPay(p=>({...p, payment_receive_date: v}))} placeholder="Receive date"/>
            </Field>
            <Field label="Payment Schedule *">
              <Select value={pay.payment_schedule} onValueChange={(v)=>setPay(p=>({...p, payment_schedule: v}))}>
                <SelectTrigger><SelectValue placeholder="Schedule"/></SelectTrigger>
                <SelectContent>{PAYMENT_SCHEDULES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Payment Mode *">
              <Select value={pay.payment_mode} onValueChange={(v)=>setPay(p=>({...p, payment_mode: v}))}>
                <SelectTrigger><SelectValue placeholder="Mode"/></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Transaction Reference *">
              <Input value={pay.transaction_reference} onChange={(e)=>setPay(p=>({...p, transaction_reference: e.target.value}))}/>
            </Field>
            <Field label="Received By *">
              <Select value={pay.received_by} onValueChange={(v)=>setPay(p=>({...p, received_by: v}))}>
                <SelectTrigger><SelectValue placeholder="Team member"/></SelectTrigger>
                <SelectContent>{data.profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name || "—"}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Remarks">
                <Textarea rows={2} value={pay.payment_remarks} onChange={(e)=>setPay(p=>({...p, payment_remarks: e.target.value}))}/>
              </Field>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
              <Button onClick={savePayment}>Save Payment Info</Button>
              <Button variant="secondary" onClick={async () => {
                await savePayment();
                if (!c) return;
                const recipient = (c as any).email || prompt("Recipient email:");
                if (!recipient) return;
                const subject = `Payment received — ${d.deal_number}`;
                const body = `Dear ${clientName ?? "Client"},\n\nWe confirm receipt of your payment on ${pay.payment_receive_date} via ${pay.payment_mode}. Reference: ${pay.transaction_reference}.\n\nThank you.`;
                const { error } = await supabase.from("email_history").insert({
                  deal_id: id, client_id: d.client_id, recipient, subject, body, status: "logged",
                  sent_by: (await supabase.auth.getUser()).data.user?.id,
                });
                if (error) toast.error("Email log failed: " + error.message);
                else toast.success("Payment saved & email logged. Configure email sending in Settings > Emails to deliver.");
              }}>Save & Send Email</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DealInvoicesAndTravel dealId={id} stage={stage} isTravel={(type ?? "").toLowerCase() === "travel"} />

      <StageHistory dealId={id} stages={data.stages} profiles={data.profiles} />

      {d.notes && <Card className="mt-4"><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent className="text-sm whitespace-pre-wrap">{d.notes}</CardContent></Card>}
    </div>
  );
}

/** Deal stage change log — visible to Admin & Management only. */
function StageHistory({ dealId, stages, profiles }: { dealId: string; stages: any[]; profiles: any[] }) {
  const { hasRole } = useAuth();
  const allowed = hasRole(["admin", "management"]);
  const { data: history } = useQuery({
    enabled: allowed,
    queryKey: ["deal-stage-history", dealId],
    queryFn: async () =>
      (await (supabase as any).from("deal_stage_history").select("*").eq("deal_id", dealId).order("created_at", { ascending: false })).data ?? [],
  });
  if (!allowed) return null;
  const stageName = (sid: string | null) => stages.find((s) => s.id === sid)?.name ?? "—";
  const personName = (pid: string | null) => profiles.find((p) => p.id === pid)?.full_name ?? "System";
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-base">Stage History <Badge variant="secondary">Admin & Management</Badge></CardTitle></CardHeader>
      <CardContent className="text-sm">
        {(history ?? []).length === 0 && <div className="text-muted-foreground">No stage changes recorded yet.</div>}
        <ul className="space-y-2">
          {(history ?? []).map((h: any) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2 last:border-0">
              <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
              <span className="font-medium">{h.from_stage_id ? `${stageName(h.from_stage_id)} → ` : ""}{stageName(h.to_stage_id)}</span>
              <span className="text-muted-foreground">by {personName(h.changed_by)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DealInvoicesAndTravel({ dealId, stage, isTravel }: { dealId: string; stage: any; isTravel: boolean }) {
  const qc = useQueryClient();
  const { data: invoices } = useQuery({
    queryKey: ["deal-invoices", dealId],
    queryFn: async () => (await supabase.from("invoices").select("*").eq("deal_id", dealId).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: posting } = useQuery({
    enabled: isTravel,
    queryKey: ["travel-posting", dealId],
    queryFn: async () => {
      const p = await supabase.from("travel_postings").select("*").eq("deal_id", dealId).maybeSingle();
      if (!p.data) return { header: null, rows: [] as any[] };
      const rows = await supabase.from("travel_posting_rows").select("*").eq("posting_id", p.data.id).order("sr_no");
      return { header: p.data, rows: rows.data ?? [] };
    },
  });

  const isInvoiceStage = stage?.name === "Invoice Issued";

  return (
    <>
      {(isInvoiceStage || (invoices?.length ?? 0) > 0) && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isInvoiceStage && (invoices?.length ?? 0) === 0 && (
              <p className="text-muted-foreground">Draft invoice will appear here after stage change is persisted. If missing, click Generate.</p>
            )}
            {isInvoiceStage && (
              <Button size="sm" variant="outline" onClick={async () => {
                const { data: d } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
                if (!d) return;
                const invNum = `INV-M-${Date.now().toString().slice(-8)}`;
                const { error } = await supabase.from("invoices").insert({
                  invoice_number: invNum, deal_id: dealId, client_id: d.client_id,
                  issue_date: new Date().toISOString().slice(0,10),
                  due_date: d.policy_start_date ?? new Date().toISOString().slice(0,10),
                  total_amount: d.gross_premium, status: "pending_approval", invoice_kind: "manual",
                });
                if (error) toast.error(error.message);
                else { toast.success("Invoice generated (Pending Approval)"); qc.invalidateQueries({ queryKey: ["deal-invoices", dealId] }); }
              }}>Generate Invoice</Button>
            )}
            {(invoices ?? []).map(inv => (
              <div key={inv.id} className="flex items-center justify-between border-t pt-2">
                <div className="font-mono text-xs">{inv.invoice_number}</div>
                <div className="tabular-nums">{fmtPKR(Number(inv.total_amount))}</div>
                <Badge variant="outline">{(inv.status as string).replace("_", " ")}</Badge>
                <span className="text-xs text-muted-foreground">{fmtDate(inv.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isTravel && <TravelPostingSection dealId={dealId} posting={posting ?? null}/>}
    </>
  );
}

function TravelPostingSection({ dealId, posting }: { dealId: string; posting: { header: any; rows: any[] } | null }) {
  const qc = useQueryClient();
  const header = posting?.header;
  const rows = posting?.rows ?? [];
  const [totalPolicy, setTotalPolicy] = useState(header?.total_policy_amount ?? 0);
  const [totalPost, setTotalPost] = useState(header?.total_posting_amount ?? 0);
  const [from, setFrom] = useState(header?.posting_from ?? "");
  const [to, setTo] = useState(header?.posting_to ?? "");
  useEffect(() => {
    if (header) {
      setTotalPolicy(header.total_policy_amount);
      setTotalPost(header.total_posting_amount);
      setFrom(header.posting_from ?? "");
      setTo(header.posting_to ?? "");
    }
  }, [header]);

  const totalPremium = rows.reduce((a, r) => a + Number(r.premium || 0), 0);
  const diff = totalPremium - Number(totalPost || 0);
  const status = Number(totalPost) === 0 ? "pending" : Math.abs(diff) < 0.01 ? "balanced" : diff > 0 ? "excess" : "deficit";
  const badgeCls: Record<string,string> = {
    balanced: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    excess: "bg-red-500/15 text-red-600 border-red-500/30",
    deficit: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    pending: "bg-muted text-muted-foreground",
  };

  const saveHeader = async () => {
    if (Number(totalPolicy) <= 0 || Number(totalPost) <= 0) return toast.error("Enter Total Policy & Total Posting amounts");
    if (from && to && to < from) return toast.error("To Date cannot be earlier than From Date");
    const payload: any = { deal_id: dealId, total_policy_amount: totalPolicy, total_posting_amount: totalPost, posting_from: from || null, posting_to: to || null };
    const { error } = header
      ? await supabase.from("travel_postings").update(payload).eq("id", header.id)
      : await supabase.from("travel_postings").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Posting header saved"); qc.invalidateQueries({ queryKey: ["travel-posting", dealId] }); }
  };

  const addRow = async () => {
    if (!header) return toast.error("Save posting header first");
    const { error } = await supabase.from("travel_posting_rows").insert({
      posting_id: header.id, sr_no: rows.length + 1, premium: 0, commission_percentage: 0,
    });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["travel-posting", dealId] });
  };

  const updateRow = async (id: string, patch: any) => {
    // Travel policy numbers must be unique across every record in the system
    if (typeof patch.policy_number === "string" && patch.policy_number.trim()) {
      const { data: conflict } = await supabase.rpc("travel_policy_conflict" as any, {
        _policy_number: patch.policy_number, _exclude_row_id: id,
      } as any);
      const hit = Array.isArray(conflict) ? conflict[0] : conflict;
      if (hit) {
        toast.error(
          `Policy number already exists — ${hit.source ?? "record"}${hit.reference ? ` (${hit.reference})` : ""}. Enter a unique policy number.`,
        );
        qc.invalidateQueries({ queryKey: ["travel-posting", dealId] });
        return;
      }
    }
    const { error } = await supabase.from("travel_posting_rows").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["travel-posting", dealId] });
  };

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from("travel_posting_rows").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["travel-posting", dealId] });
  };

  return (
    <Card className="mt-4 border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Travel Posting
          <Badge variant="outline" className={badgeCls[status]}>{status.toUpperCase()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Total Policy Amount *"><Input type="number" step="0.01" value={totalPolicy} onChange={e => setTotalPolicy(Number(e.target.value) || 0)}/></Field>
          <Field label="Total Posting Amount *"><Input type="number" step="0.01" value={totalPost} onChange={e => setTotalPost(Number(e.target.value) || 0)}/></Field>
          <Field label="Posting From *"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} onKeyDown={e => e.preventDefault()}/></Field>
          <Field label="Posting To *"><Input type="date" value={to} onChange={e => setTo(e.target.value)} onKeyDown={e => e.preventDefault()} min={from || undefined}/></Field>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveHeader}>{header ? "Update Header" : "Save Header"}</Button>
        </div>

        {header && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Sr</th>
                  <th className="text-left p-2">Travel Agent</th>
                  <th className="text-left p-2">Date Issued</th>
                  <th className="text-left p-2">Policy #</th>
                  <th className="text-right p-2">Premium</th>
                  <th className="text-right p-2">Comm %</th>
                  <th className="text-right p-2">Comm Amt</th>
                  <th className="text-left p-2">Payable Co.</th>
                  <th className="text-left p-2">Agent Name</th>
                  <th className="text-left p-2">Remarks</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const commAmt = Number(r.premium || 0) * Number(r.commission_percentage || 0) / 100;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.sr_no}</td>
                      <td className="p-2"><Input className="h-8" defaultValue={r.travel_agent ?? ""} onBlur={e => updateRow(r.id, { travel_agent: e.target.value })}/></td>
                      <td className="p-2"><Input type="date" className="h-8" defaultValue={r.date_issued ?? ""} onBlur={e => updateRow(r.id, { date_issued: e.target.value || null })}/></td>
                      <td className="p-2"><Input className="h-8" defaultValue={r.policy_number ?? ""} onBlur={e => updateRow(r.id, { policy_number: e.target.value })}/></td>
                      <td className="p-2"><Input type="number" step="0.01" className="h-8 text-right" defaultValue={r.premium ?? 0} onBlur={e => updateRow(r.id, { premium: Number(e.target.value) || 0 })}/></td>
                      <td className="p-2"><Input type="number" step="0.001" className="h-8 text-right" defaultValue={r.commission_percentage ?? 0} onBlur={e => updateRow(r.id, { commission_percentage: Number(e.target.value) || 0 })}/></td>
                      <td className="p-2 text-right tabular-nums">{fmtPKR(commAmt)}</td>
                      <td className="p-2"><Input className="h-8" defaultValue={r.payable_company ?? ""} onBlur={e => updateRow(r.id, { payable_company: e.target.value })}/></td>
                      <td className="p-2"><Input className="h-8" defaultValue={r.agent_name ?? ""} onBlur={e => updateRow(r.id, { agent_name: e.target.value })}/></td>
                      <td className="p-2"><Input className="h-8" defaultValue={r.remarks ?? ""} onBlur={e => updateRow(r.id, { remarks: e.target.value })}/></td>
                      <td className="p-2"><Button size="sm" variant="ghost" onClick={() => deleteRow(r.id)}>×</Button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t font-medium">
                <tr>
                  <td className="p-2" colSpan={4}>Totals</td>
                  <td className="p-2 text-right tabular-nums">{fmtPKR(totalPremium)}</td>
                  <td></td>
                  <td className="p-2 text-right tabular-nums">{fmtPKR(rows.reduce((a,r)=>a+(Number(r.premium||0)*Number(r.commission_percentage||0)/100),0))}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
            <div className="flex items-center justify-between mt-3">
              <Button size="sm" variant="outline" onClick={addRow}>+ Add Row</Button>
              <div className="text-xs">
                {status === "excess" && <span className="text-red-600">Excess: {fmtPKR(diff)}</span>}
                {status === "deficit" && <span className="text-amber-600">Deficit: {fmtPKR(-diff)}</span>}
                {status === "balanced" && <span className="text-emerald-600">Balanced ✓</span>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Deal cannot progress to Won until posting is Balanced.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
