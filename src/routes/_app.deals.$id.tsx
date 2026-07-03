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
import { computeDeal } from "@/lib/calc";
import { fmtPKR, fmtPct, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/deals/$id")({
  component: DealDetail,
});

const PAYMENT_SCHEDULES = ["Annual", "Half-Yearly", "Quarterly", "Monthly"] as const;
const PAYMENT_MODES = ["IBFT", "Cheque", "Cash", "Pay Order", "Online Payment"] as const;

function DealDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const canSeeFinancials = hasRole(["admin", "management", "team_lead"]);

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

  const calc = useMemo(() => data?.deal ? computeDeal({
    gross_premium: Number(data.deal.gross_premium),
    commission_percentage: Number(data.deal.commission_percentage),
    marketing_budget_percentage: Number(data.deal.marketing_budget_percentage),
    loading: Number(data.deal.loading), b2b_commission: Number(data.deal.b2b_commission),
  }, data.basePct) : null, [data]);

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
              {isAdmin && d.base_premium != null && <KV k="Base Premium" v={fmtPKR(Number(d.base_premium))} />}
              <KV k="Gross Premium" v={fmtPKR(Number(d.gross_premium))} />
              <KV k="Net Premium" v={fmtPKR(Number(d.net_premium))} />
              <KV k="Commission %" v={fmtPct(Number(d.commission_percentage))} />
              <KV k="Marketing %" v={fmtPct(Number(d.marketing_budget_percentage))} />
              <KV k="Loading" v={fmtPKR(Number(d.loading))} />
              <KV k="B2B Commission" v={fmtPKR(Number(d.b2b_commission))} />
              <hr/>
              <KV k="Commission Before Tax" v={fmtPKR(Number(d.commission_before_tax))} />
              <KV k="Commission After Tax" v={fmtPKR(Number(d.commission_after_tax))} />
              <KV k="Marketing After Tax" v={fmtPKR(Number(d.marketing_after_tax))} />
              <KV k="Total Income" v={<span className="font-semibold">{fmtPKR(Number(d.total_income))}</span>} />
              <KV k="Income %" v={fmtPct(Number(d.income_percentage))} />
              {calc && <>
                <KV k="Tagged Premium %" v={fmtPct(calc.tagged_premium_percentage)} />
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
              <Input type="date" value={pay.payment_receive_date} onChange={(e)=>setPay(p=>({...p, payment_receive_date: e.target.value}))}/>
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
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <Button onClick={savePayment}>Save Payment Info</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {d.notes && <Card className="mt-4"><CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader><CardContent className="text-sm whitespace-pre-wrap">{d.notes}</CardContent></Card>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
