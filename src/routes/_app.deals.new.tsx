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
import { calculateDealFinancials } from "@/lib/calc";
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
    policy_type: "single" as "single" | "bulk",
  });
  const [bulkRows, setBulkRows] = useState<Array<{cover_note_number:string;policy_number:string;gross_premium:number;net_premium:number;remarks:string}>>([
    { cover_note_number: "", policy_number: "", gross_premium: 0, net_premium: 0, remarks: "" },
  ]);
  const [dupErrors, setDupErrors] = useState<Record<number, string>>({});
  const addBulkRow = () => setBulkRows(r => [...r, { cover_note_number: "", policy_number: "", gross_premium: 0, net_premium: 0, remarks: "" }]);
  const removeBulkRow = (i: number) => setBulkRows(r => r.filter((_, idx) => idx !== i));
  const updateBulkRow = (i: number, k: string, v: any) => setBulkRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const norm = (v: string) => (v || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const checkDuplicate = async (i: number, value: string) => {
    const n = norm(value);
    setDupErrors(prev => { const c = { ...prev }; delete c[i]; return c; });
    if (!n) return;
    const localIdx = bulkRows.findIndex((r, idx) => idx !== i && norm(r.policy_number) === n);
    if (localIdx >= 0) {
      setDupErrors(prev => ({ ...prev, [i]: `Duplicate of row ${localIdx + 1} in this deal` }));
      return;
    }
    const { data } = await supabase.rpc("deal_policy_conflict" as any, { _policy_number: value, _exclude_row: null });
    const c: any = data;
    if (c) {
      const where = c.source === "deal" ? "deal" : "bulk policy on deal";
      setDupErrors(prev => ({ ...prev, [i]: `Already used on ${where} ${c.deal_number ?? "—"}${c.client_name ? ` (${c.client_name})` : ""}` }));
    }
  };

  const bulkTotals = useMemo(() => bulkRows.reduce((a, r) => ({
    gross: a.gross + Number(r.gross_premium || 0),
    net: a.net + Number(r.net_premium || 0),
    count: a.count + 1,
  }), { gross: 0, net: 0, count: 0 }), [bulkRows]);
  const isTravel = useMemo(() => {
    const t = lists?.types.find(x => x.id === form.insurance_type_id);
    return (t?.name ?? "").toLowerCase() === "travel";
  }, [form.insurance_type_id, lists?.types]);

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
    const effectiveGross = form.policy_type === "bulk" ? bulkTotals.gross : form.gross_premium;
    const effectiveNet = form.policy_type === "bulk" ? bulkTotals.net : netPremium;
    if (!(effectiveGross > 0)) return toast.error("Gross premium is required");
    if (form.policy_type === "bulk" && bulkRows.length === 0) return toast.error("Add at least one bulk policy row");
    if (form.policy_type === "bulk") {
      await Promise.all(bulkRows.map((r, i) => checkDuplicate(i, r.policy_number)));
      const seen = new Map<string, number>();
      for (let i = 0; i < bulkRows.length; i++) {
        const n = norm(bulkRows[i].policy_number);
        if (!n) continue;
        if (seen.has(n)) return toast.error(`Duplicate policy number in rows ${seen.get(n)! + 1} and ${i + 1}`);
        seen.set(n, i);
        const { data: conflict } = await supabase.rpc("deal_policy_conflict" as any, { _policy_number: bulkRows[i].policy_number, _exclude_row: null });
        if (conflict) {
          const c: any = conflict;
          return toast.error(`Policy ${bulkRows[i].policy_number} already exists on deal ${c.deal_number ?? "—"}${c.client_name ? ` (${c.client_name})` : ""}`);
        }
      }
    }
    const payload: any = {
      ...form,
      created_by: user.id,
      client_id: form.client_id || null,
      source_id: form.source_id || null,
      insurance_company_id: form.insurance_company_id || null,
      insurance_type_id: form.insurance_type_id || null,
      stage_id: form.stage_id || null,
      base_premium: isAdmin ? (form.base_premium || null) : null,
      marketing_budget_percentage: canSeeMarketing ? form.marketing_budget_percentage : 0,
      gross_premium: effectiveGross,
      net_premium: effectiveNet,
      policy_start_date: form.policy_start_date || null,
      policy_end_date: form.policy_end_date || null,
      deal_type: form.deal_type,
      policy_type: form.policy_type,
    };
    const { data, error } = await supabase.from("deals").insert(payload).select("id").maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (form.policy_type === "bulk" && data) {
      const rows = bulkRows.map((r, idx) => ({ ...r, deal_id: data.id, row_number: idx + 1 }));
      const { error: bErr } = await supabase.from("deal_policies").insert(rows);
      if (bErr) toast.error("Deal created, but bulk rows failed: " + bErr.message);
    }
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
              <Field label="Policy Type *">
                <Select value={form.policy_type} onValueChange={(v)=>set("policy_type", v as "single" | "bulk")}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Policy</SelectItem>
                    <SelectItem value="bulk">Bulk Policies</SelectItem>
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

          {form.policy_type === "bulk" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Bulk Policies</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Cover Note</th>
                        <th className="text-left p-2">Policy No.</th>
                        <th className="text-right p-2">Gross Premium</th>
                        <th className="text-right p-2">Net Premium</th>
                        <th className="text-left p-2">Remarks</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{i+1}</td>
                          <td className="p-2"><Input value={r.cover_note_number} onChange={e=>updateBulkRow(i,"cover_note_number",e.target.value)}/></td>
                          <td className="p-2">
                            <Input
                              value={r.policy_number}
                              aria-invalid={!!dupErrors[i]}
                              className={dupErrors[i] ? "border-destructive" : ""}
                              onChange={e=>updateBulkRow(i,"policy_number",e.target.value)}
                              onBlur={e=>checkDuplicate(i, e.target.value)}
                            />
                            {dupErrors[i] && <p className="text-xs text-destructive mt-1">{dupErrors[i]}</p>}
                          </td>
                          <td className="p-2"><Input type="number" step="0.01" className="text-right" value={r.gross_premium} onChange={e=>updateBulkRow(i,"gross_premium",Number(e.target.value)||0)}/></td>
                          <td className="p-2"><Input type="number" step="0.01" className="text-right" value={r.net_premium} onChange={e=>updateBulkRow(i,"net_premium",Number(e.target.value)||0)}/></td>
                          <td className="p-2"><Input value={r.remarks} onChange={e=>updateBulkRow(i,"remarks",e.target.value)}/></td>
                          <td className="p-2"><Button size="sm" variant="ghost" onClick={()=>removeBulkRow(i)} disabled={bulkRows.length===1}>×</Button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t font-medium">
                      <tr>
                        <td className="p-2" colSpan={3}>Totals ({bulkTotals.count} {bulkTotals.count===1?"policy":"policies"})</td>
                        <td className="p-2 text-right tabular-nums">{fmtPKR(bulkTotals.gross)}</td>
                        <td className="p-2 text-right tabular-nums">{fmtPKR(bulkTotals.net)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Button variant="outline" size="sm" onClick={addBulkRow}>+ Add Row</Button>
                <p className="text-xs text-muted-foreground">Deal totals (Gross & Net premium) will be set from the sum of these rows.</p>
              </CardContent>
            </Card>
          )}

          {isTravel && (
            <Card className="border-amber-500/50">
              <CardHeader><CardTitle className="text-base">Travel Product Detected</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Travel Posting details (Posting From/To, per-row postings, Balanced/Excess/Deficit reconciliation) will be entered on the Deal detail page after creation. The deal cannot be moved to Won until posting is Balanced.
              </CardContent>
            </Card>
          )}

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
                    <Field label="Marketing Budget %"><Input type="number" step="0.001" value={form.marketing_budget_percentage} onChange={(e)=>setNum("marketing_budget_percentage", e.target.value)}/></Field>
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
              <CardHeader><CardTitle className="text-base">Live Calculations</CardTitle></CardHeader>
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
