import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { computeDeal } from "@/lib/calc";
import { fmtPKR, fmtPct } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/deals/new")({
  component: NewDealPage,
});

function NewDealPage() {
  const nav = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  // Premium & Commission section is available to every user creating a deal,
  // matching the original spec — no tax or marketing-budget restrictions.
  const canSeeFinancials = true;
  const canSeeMarketing = true;
  const canSeeLiveCalc = true;


  const { data: lists } = useQuery({
    queryKey: ["deal-form-lists"],
    queryFn: async () => {
      // clients are automatically scoped by RLS to what the current user can see
      const [clients, stages, companies, types, sources, settings] = await Promise.all([
        supabase.from("clients").select("id, company_name, full_name, client_type").order("company_name"),
        supabase.from("deal_stages").select("*").order("sort_order"),
        supabase.from("insurance_companies").select("id, name").eq("active", true).order("name"),
        supabase.from("insurance_types").select("id, name").eq("active", true).order("name"),
        supabase.from("lead_sources").select("id, name").eq("active", true).order("name"),
        supabase.from("app_settings").select("key, value").eq("key", "tagged_premium_base_percentage").maybeSingle(),
      ]);
      return {
        clients: clients.data ?? [], stages: stages.data ?? [],
        companies: companies.data ?? [], types: types.data ?? [],
        sources: sources.data ?? [],
        basePct: Number(settings.data?.value ?? 13),
      };
    },
  });

  const [form, setForm] = useState({
    client_id: "", cover_note_number: "", policy_number: "",
    source_id: "", insurance_company_id: "", insurance_type_id: "", stage_id: "",
    base_premium: 0,
    gross_premium: 0, commission_percentage: 0,
    marketing_budget_percentage: 0, loading: 0, b2b_commission: 0,
    policy_start_date: "", policy_end_date: "", notes: "",
    deal_type: "fresh" as "fresh" | "renewal",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setNum = (k: keyof typeof form, v: string) => set(k, (Number(v) || 0) as never);

  const netPremium = useMemo(
    () => Math.max(0, form.gross_premium - (form.commission_percentage * form.gross_premium) / 100),
    [form.gross_premium, form.commission_percentage],
  );
  const calc = useMemo(() => computeDeal(form, lists?.basePct ?? 13), [form, lists?.basePct]);

  const submit = async () => {
    if (!user) return;
    if (!form.client_id) return toast.error("Please pick a client");
    if (!(form.gross_premium > 0)) return toast.error("Gross premium is required");
    const payload: any = {
      ...form,
      created_by: user.id,
      client_id: form.client_id || null,
      source_id: form.source_id || null,
      insurance_company_id: form.insurance_company_id || null,
      insurance_type_id: form.insurance_type_id || null,
      stage_id: form.stage_id || null,
      base_premium: isAdmin ? (form.base_premium || null) : null,
      // DO/TL cannot set marketing budget — force to 0
      marketing_budget_percentage: canSeeMarketing ? form.marketing_budget_percentage : 0,
      net_premium: netPremium,
      policy_start_date: form.policy_start_date || null,
      policy_end_date: form.policy_end_date || null,
      deal_type: form.deal_type,
    };
    const { data, error } = await supabase.from("deals").insert(payload).select("id").maybeSingle();
    if (error) { toast.error(error.message); return; }
    toast.success("Deal created");
    nav({ to: "/deals/$id", params: { id: data!.id } });
  };

  const clientLabel = (c: { company_name: string; full_name: string | null; client_type: string | null }) =>
    c.client_type === "individual" ? (c.full_name || c.company_name) : c.company_name;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="New Deal"
        subtitle={canSeeFinancials
          ? "Team, DO and Team Lead are attached automatically. Net Premium auto-calculates."
          : "Team is attached automatically. Enter policy and premium details below."}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <Field label="Client *">
                <Select value={form.client_id} onValueChange={(v)=>set("client_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select client"/></SelectTrigger>
                  <SelectContent>{lists?.clients.map(c=><SelectItem key={c.id} value={c.id}>{clientLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Stage">
                <Select value={form.stage_id} onValueChange={(v)=>set("stage_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Stage"/></SelectTrigger>
                  <SelectContent>{lists?.stages.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Deal Type *">
                <Select value={form.deal_type} onValueChange={(v)=>set("deal_type", v as "fresh" | "renewal")}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fresh">Fresh</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cover Note Number"><Input value={form.cover_note_number} onChange={(e)=>set("cover_note_number", e.target.value)}/></Field>
              <Field label="Policy Number"><Input value={form.policy_number} onChange={(e)=>set("policy_number", e.target.value)}/></Field>
              <Field label="Source">
                <Select value={form.source_id} onValueChange={(v)=>set("source_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Source"/></SelectTrigger>
                  <SelectContent>{lists?.sources.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Insurance Company">
                <Select value={form.insurance_company_id} onValueChange={(v)=>set("insurance_company_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Company"/></SelectTrigger>
                  <SelectContent>{lists?.companies.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Product">
                <Select value={form.insurance_type_id} onValueChange={(v)=>set("insurance_type_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Product"/></SelectTrigger>
                  <SelectContent>{lists?.types.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Policy Start"><Input type="date" value={form.policy_start_date} onChange={(e)=>set("policy_start_date", e.target.value)}/></Field>
              <Field label="Policy End"><Input type="date" value={form.policy_end_date} onChange={(e)=>set("policy_end_date", e.target.value)}/></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Premium{canSeeFinancials ? " & Commission" : ""}</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              {isAdmin && (
                <Field label="Base Premium (PKR)"><Input type="number" step="0.01" value={form.base_premium} onChange={(e)=>setNum("base_premium", e.target.value)}/></Field>
              )}
              <Field label="Gross Premium (PKR) *"><Input type="number" step="0.01" value={form.gross_premium} onChange={(e)=>setNum("gross_premium", e.target.value)}/></Field>
              {canSeeFinancials && (
                <>
                  <Field label="Commission %"><Input type="number" step="0.001" value={form.commission_percentage} onChange={(e)=>setNum("commission_percentage", e.target.value)}/></Field>
                  <Field label="Net Premium (auto)"><Input readOnly value={fmtPKR(netPremium)} className="bg-muted/50"/></Field>
                  {canSeeMarketing && (
                    <Field label="Marketing Budget % (Admin only)"><Input type="number" step="0.001" value={form.marketing_budget_percentage} onChange={(e)=>setNum("marketing_budget_percentage", e.target.value)}/></Field>
                  )}
                  <Field label="Loading (PKR)"><Input type="number" step="0.01" value={form.loading} onChange={(e)=>setNum("loading", e.target.value)}/></Field>
                  <Field label="B2B Commission (PKR)"><Input type="number" step="0.01" value={form.b2b_commission} onChange={(e)=>setNum("b2b_commission", e.target.value)}/></Field>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent><Textarea rows={3} value={form.notes} onChange={(e)=>set("notes", e.target.value)} placeholder="Internal notes"/></CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={()=>nav({ to: "/deals" })}>Cancel</Button>
            <Button onClick={submit}>Create Deal</Button>
          </div>
        </div>

        {canSeeLiveCalc && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Live Calculations <span className="text-xs font-normal text-muted-foreground">(Admin only)</span></CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row k="Net Premium (Gross − Commission)" v={fmtPKR(netPremium)} />
                <Row k="Commission Before Tax" v={fmtPKR(calc.commission_before_tax)} />
                <Row k="Commission After Tax (-17%)" v={fmtPKR(calc.commission_after_tax)} />
                <Row k="Marketing Before Tax" v={fmtPKR(calc.marketing_before_tax)} />
                <Row k="Marketing After Tax (-9%)" v={fmtPKR(calc.marketing_after_tax)} />
                <hr className="my-2"/>
                <Row k="Total Income" v={fmtPKR(calc.total_income)} strong />
                <Row k="Income %" v={fmtPct(calc.income_percentage)} />
                <Row k={`Tagged Premium % (base ${lists?.basePct ?? 13}%)`} v={fmtPct(calc.tagged_premium_percentage)} />
                <Row k="Tagged Premium" v={fmtPKR(calc.tagged_premium)} strong />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{k}</span><span className={strong?"font-semibold":""}>{v}</span></div>;
}
