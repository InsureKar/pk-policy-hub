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
  const { user } = useAuth();

  const { data: lists } = useQuery({
    queryKey: ["deal-form-lists"],
    queryFn: async () => {
      const [clients, stages, companies, types, sources, profiles, teams, settings] = await Promise.all([
        supabase.from("clients").select("id, company_name, team_id").order("company_name"),
        supabase.from("deal_stages").select("*").order("sort_order"),
        supabase.from("insurance_companies").select("id, name").eq("active", true).order("name"),
        supabase.from("insurance_types").select("id, name").eq("active", true).order("name"),
        supabase.from("lead_sources").select("id, name").eq("active", true).order("name"),
        supabase.from("profiles").select("id, full_name, team_id"),
        supabase.from("teams").select("id, name"),
        supabase.from("app_settings").select("key, value").eq("key", "tagged_premium_base_percentage").maybeSingle(),
      ]);
      return {
        clients: clients.data ?? [], stages: stages.data ?? [],
        companies: companies.data ?? [], types: types.data ?? [],
        sources: sources.data ?? [], profiles: profiles.data ?? [],
        teams: teams.data ?? [], basePct: Number(settings.data?.value ?? 13),
      };
    },
  });

  const [form, setForm] = useState({
    client_id: "", cover_note_number: "", policy_number: "",
    source_id: "", insurance_company_id: "", insurance_type_id: "", stage_id: "",
    assigned_do_id: user?.id ?? "", team_id: "",
    gross_premium: 0, net_premium: 0, commission_percentage: 0,
    marketing_budget_percentage: 0, loading: 0, b2b_commission: 0,
    policy_start_date: "", policy_end_date: "", notes: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setNum = (k: keyof typeof form, v: string) => set(k, (Number(v) || 0) as never);

  const calc = useMemo(() => computeDeal(form, lists?.basePct ?? 13), [form, lists?.basePct]);

  const submit = async () => {
    if (!user) return;
    const payload = {
      ...form,
      created_by: user.id,
      client_id: form.client_id || null,
      source_id: form.source_id || null,
      insurance_company_id: form.insurance_company_id || null,
      insurance_type_id: form.insurance_type_id || null,
      stage_id: form.stage_id || null,
      assigned_do_id: form.assigned_do_id || null,
      team_id: form.team_id || null,
      policy_start_date: form.policy_start_date || null,
      policy_end_date: form.policy_end_date || null,
    };
    const { data, error } = await supabase.from("deals").insert(payload).select("id").maybeSingle();
    if (error) { toast.error(error.message); return; }
    toast.success("Deal created");
    nav({ to: "/deals/$id", params: { id: data!.id } });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="New Deal" subtitle="Auto-calculated commission, taxes, total income and tagged premium." />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <Field label="Client">
                <Select value={form.client_id} onValueChange={(v)=>set("client_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select client"/></SelectTrigger>
                  <SelectContent>{lists?.clients.map(c=><SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Stage">
                <Select value={form.stage_id} onValueChange={(v)=>set("stage_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Stage"/></SelectTrigger>
                  <SelectContent>{lists?.stages.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
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
              <Field label="Insurance Type">
                <Select value={form.insurance_type_id} onValueChange={(v)=>set("insurance_type_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Type"/></SelectTrigger>
                  <SelectContent>{lists?.types.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Assigned DO">
                <Select value={form.assigned_do_id} onValueChange={(v)=>set("assigned_do_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Sales agent"/></SelectTrigger>
                  <SelectContent>{lists?.profiles.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name || "Unnamed"}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Team">
                <Select value={form.team_id} onValueChange={(v)=>set("team_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Team"/></SelectTrigger>
                  <SelectContent>{lists?.teams.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Policy Start"><Input type="date" value={form.policy_start_date} onChange={(e)=>set("policy_start_date", e.target.value)}/></Field>
              <Field label="Policy End"><Input type="date" value={form.policy_end_date} onChange={(e)=>set("policy_end_date", e.target.value)}/></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Premium & Commission</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <Field label="Gross Premium (PKR)"><Input type="number" step="0.01" value={form.gross_premium} onChange={(e)=>setNum("gross_premium", e.target.value)}/></Field>
              <Field label="Net Premium (PKR)"><Input type="number" step="0.01" value={form.net_premium} onChange={(e)=>setNum("net_premium", e.target.value)}/></Field>
              <Field label="Commission %"><Input type="number" step="0.001" value={form.commission_percentage} onChange={(e)=>setNum("commission_percentage", e.target.value)}/></Field>
              <Field label="Marketing Budget %"><Input type="number" step="0.001" value={form.marketing_budget_percentage} onChange={(e)=>setNum("marketing_budget_percentage", e.target.value)}/></Field>
              <Field label="Loading (PKR)"><Input type="number" step="0.01" value={form.loading} onChange={(e)=>setNum("loading", e.target.value)}/></Field>
              <Field label="B2B Commission (PKR)"><Input type="number" step="0.01" value={form.b2b_commission} onChange={(e)=>setNum("b2b_commission", e.target.value)}/></Field>
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

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Live Calculations</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
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
