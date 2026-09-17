import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
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
import {
  TravelBulkPolicies, emptyTravelRow, emptyTransferRow, payableOf,
  type TravelPolicyRow, type TravelTransferRow,
} from "@/components/TravelBulkPolicies";
import { fmtPKR, fmtPct, fmtDate } from "@/lib/format";
import { MoneyInput, amountInWords } from "@/components/MoneyInput";
import { cn } from "@/lib/utils";
import { DateField } from "@/components/DateField";
import { toast } from "sonner";
import B2BTakerField from "@/components/B2BTakerField";

export const Route = createFileRoute("/_app/deals/new")({
  component: NewDealPage,
});

function NewDealPage() {
  const nav = useNavigate();
  const { user, hasRole } = useAuth();
  // Premium & Commission inputs stay available to every user creating a deal.
  const canSeeFinancials = true;
  const canSeeMarketing = true;
  // Calculated Premium & Income figures (Tagged Premium, Live Calculations): Admin & Management only
  const canSeeLiveCalc = hasRole(["admin", "management"]);


  const { data: lists } = useQuery({
    queryKey: ["deal-form-lists"],
    queryFn: async () => {
      // clients are automatically scoped by RLS to what the current user can see
      const [clients, stages, companies, types, sources, settings, people] = await Promise.all([
        supabase.from("clients").select("id, company_name, full_name, client_type").order("company_name"),
        supabase.from("deal_stages").select("*").order("sort_order"),
        supabase.from("insurance_companies").select("id, name").eq("active", true).order("name"),
        supabase.from("insurance_types").select("id, name").eq("active", true).order("name"),
        supabase.from("lead_sources").select("id, name").eq("active", true).order("name"),
        supabase.from("app_settings").select("key, value").eq("key", "tagged_premium_base_percentage").maybeSingle(),
        supabase.from("profiles").select("id, full_name").order("full_name"),
      ]);
      return {
        clients: clients.data ?? [], stages: stages.data ?? [],
        companies: companies.data ?? [], types: types.data ?? [],
        sources: sources.data ?? [],
        people: people.data ?? [],
        basePct: Number(settings.data?.value ?? 13),
      };
    },
  });

  const [form, setForm] = useState({
    client_id: "", cover_note_number: "", policy_number: "",
    source_id: "", insurance_company_id: "", insurance_type_id: "", stage_id: "",
    net_premium: 0,
    gross_premium: 0, commission_percentage: 0,
    marketing_budget_percentage: 0, loading: 0, b2b_commission: 0,
    b2b_taker_id: "", b2b_taker_name: "",
    b2b_commission_type: "fixed" as "fixed" | "percentage",
    b2b_commission_percentage: 0,
    payment_destination: "company" as "company" | "insurance_company",
    payment_schedule: "" as string,
    payment_mode: "" as string,
    payment_receive_date: "",
    transaction_reference: "",
    payment_remarks: "",
    payment_proof_url: "",
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

  const isTravel = useMemo(() => {
    const t = lists?.types.find(x => x.id === form.insurance_type_id);
    return (t?.name ?? "").toLowerCase() === "travel";
  }, [form.insurance_type_id, lists?.types]);

  // Policy end date is auto-calculated as start + 1 year (minus a day) for every
  // product except Travel, where cover length varies per policy.
  const setStartDate = (v: string) => {
    setForm((f) => {
      const next = { ...f, policy_start_date: v };
      if (v && !isTravel) {
        const d = new Date(`${v}T00:00:00`);
        d.setFullYear(d.getFullYear() + 1);
        d.setDate(d.getDate() - 1);
        next.policy_end_date = d.toISOString().slice(0, 10);
      }
      return next;
    });
  };

  // Travel uses its own bulk format (Sr / Travel Agent / Date / Policy / Premium / Commission / Payable)
  const [travelRows, setTravelRows] = useState<TravelPolicyRow[]>([emptyTravelRow()]);
  const [travelTransfers, setTravelTransfers] = useState<TravelTransferRow[]>([emptyTransferRow()]);
  const [travelDupErrors, setTravelDupErrors] = useState<Record<number, string>>({});
  const checkTravelDuplicate = async (i: number, value: string) => {
    const n = norm(value);
    setTravelDupErrors(prev => { const c = { ...prev }; delete c[i]; return c; });
    if (!n) return;
    const localIdx = travelRows.findIndex((r, idx) => idx !== i && norm(r.policy_number) === n);
    if (localIdx >= 0) {
      setTravelDupErrors(prev => ({ ...prev, [i]: `Duplicate of row ${localIdx + 1} in this deal` }));
      return;
    }
    const { data } = await supabase.rpc("travel_policy_conflict" as any, { _policy_number: value, _exclude_row: null });
    const hit: any = Array.isArray(data) ? data[0] : data;
    if (hit) setTravelDupErrors(prev => ({ ...prev, [i]: `Policy number already used${hit.reference ? ` on ${hit.reference}` : ""}` }));
  };

  const bulkTotals = useMemo(() => {
    if (isTravel) {
      return travelRows.reduce((a, r) => ({
        gross: a.gross + Number(r.premium || 0),
        net: a.net + payableOf(r),
        count: a.count + 1,
      }), { gross: 0, net: 0, count: 0 });
    }
    return bulkRows.reduce((a, r) => ({
      gross: a.gross + Number(r.gross_premium || 0),
      net: a.net + Number(r.net_premium || 0),
      count: a.count + 1,
    }), { gross: 0, net: 0, count: 0 });
  }, [bulkRows, travelRows, isTravel]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setNum = (k: keyof typeof form, v: string) => set(k, (Number(v) || 0) as never);

  const baseGross = form.policy_type === "bulk" ? bulkTotals.gross : form.gross_premium;
  // Bulk policies feed Gross & Net premium straight into Premium & Commission.
  const baseNet = form.policy_type === "bulk" ? bulkTotals.net : form.net_premium;


  // ── Payment schedule instalment plan (auto-calculated from the total premium) ──
  const SCHEDULE_COUNT: Record<string, number> = { Monthly: 12, Quarterly: 4, "Bi-Annually": 2, Annually: 1 };
  const scheduleLabels = (n: number) =>
    n === 4 ? ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"]
      : n === 2 ? ["1st Half", "2nd Half"]
      : n === 12 ? Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`)
      : ["Full Payment"];
  // Quarterly / Bi-Annual: the first payment is entered manually, the rest is
  // distributed evenly across the remaining periods so the total always equals Net Premium.
  const [firstPayment, setFirstPayment] = useState(0);
  const manualSchedule = form.payment_schedule === "Quarterly" || form.payment_schedule === "Bi-Annually";
  /** Customisable plan — the user builds the instalment schedule row by row. */
  const isCustom = form.payment_schedule === "Custom";
  // Customisable plan: the user sets each instalment's due date and amount by hand.
  const [customRows, setCustomRows] = useState<{ due: string; amount: number }[]>([
    { due: "", amount: 0 }, { due: "", amount: 0 },
  ]);
  const setCustomRow = (i: number, patch: Partial<{ due: string; amount: number }>) =>
    setCustomRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  /** Schedules whose premium & commission are written per instalment. */
  const perIns = manualSchedule || isCustom;

  // Hand-written per-instalment premium & commission (Quarterly / Bi-Annually).
  // Every value is typed by the user; the deal totals are the sum of the periods.
  type InsBreakdown = { gross: number; net: number; loading: number; b2b: number; marketing: number; commission: number; b2b_taker_name?: string; b2b_type: "fixed" | "percentage"; b2b_pct: number };
  const [insBreakdown, setInsBreakdown] = useState<Record<number, Partial<InsBreakdown>>>({});
  const setBreakdown = (i: number, patch: Partial<InsBreakdown>) =>
    setInsBreakdown((m) => ({ ...m, [i]: { ...m[i], ...patch } }));
  const breakdownOf = (i: number): InsBreakdown => {
    const o = insBreakdown[i] ?? {};
    // Custom plan: the boxes start pre-filled with that instalment's own amount.
    const fb = isCustom ? Number(customRows[i]?.amount) || 0 : 0;
    return {
      gross: o.gross ?? fb, net: o.net ?? fb, loading: o.loading ?? 0,
      b2b: o.b2b ?? 0, marketing: o.marketing ?? 0, commission: o.commission ?? 0,
      b2b_taker_name: o.b2b_taker_name ?? "",
      b2b_type: o.b2b_type ?? "fixed", b2b_pct: o.b2b_pct ?? 0,
    };
  };
  /** Per-period B2B commission amount: percentage of that period's gross, or the fixed amount. */
  const b2bOf = (i: number): number => {
    const b = breakdownOf(i);
    return b.b2b_type === "percentage"
      ? Math.round((Number(b.gross) || 0) * (Number(b.b2b_pct) || 0)) / 100
      : Number(b.b2b) || 0;
  };

  const manualCount = isCustom ? customRows.length : manualSchedule ? (SCHEDULE_COUNT[form.payment_schedule] ?? 0) : 0;
  const manualTotals = useMemo(() => {
    let gross = 0, net = 0;
    for (let i = 0; i < manualCount; i++) {
      const b = insBreakdown[i] ?? {};
      const fb = isCustom ? Number(customRows[i]?.amount) || 0 : 0;
      gross += Number(b.gross ?? fb) || 0;
      net += Number(b.net ?? fb) || 0;
    }
    return { gross, net };
  }, [insBreakdown, manualCount, isCustom, customRows]);

  // Quarterly / Bi-Annually / Custom: the deal totals are the sum of the periods
  // entered by hand; otherwise the deal-level Premium & Commission values are used.
  const effGross = perIns && form.policy_type !== "bulk" ? manualTotals.gross : baseGross;
  const effNet = perIns && form.policy_type !== "bulk" ? manualTotals.net : baseNet;

  // B2B commission: percentage is auto-calculated from gross premium, fixed is used as entered.
  const b2bAmount = useMemo(
    () => form.b2b_commission_type === "percentage"
      ? Math.round(effGross * (Number(form.b2b_commission_percentage) || 0)) / 100
      : Number(form.b2b_commission) || 0,
    [form.b2b_commission_type, form.b2b_commission_percentage, form.b2b_commission, effGross],
  );

  // Single source of truth — real-time recalculation on every input change.
  const calc = useMemo(
    () => calculateDealFinancials({
      ...form,
      gross_premium: effGross,
      net_premium: effNet,
      b2b_commission: b2bAmount,
      base_percentage: lists?.basePct,
    }),
    [form, effGross, effNet, b2bAmount, lists?.basePct],
  );


  // Manually recorded payments per instalment (paid date + paid amount) and the
  // underwritten business, which is split evenly across Quarterly / Bi-Annual periods.
  const [paidRows, setPaidRows] = useState<{ paid_date: string; paid_amount: number }[]>([]);
  const [underwritten, setUnderwritten] = useState(0);

  const instalments = useMemo(() => {
    // Custom plan: every instalment's due date and amount is set by the user.
    if (isCustom) {
      return customRows.map((r, i) => ({
        label: `Instalment ${i + 1}`,
        due: r.due,
        amount: Number(r.amount) || 0,
        manual: false,
      }));
    }
    const count = SCHEDULE_COUNT[form.payment_schedule] ?? 0;
    if (!count) return [];
    const start = form.policy_start_date ? new Date(`${form.policy_start_date}T00:00:00`) : new Date();
    const step = 12 / count;
    const labels = scheduleLabels(count);
    let amounts: number[];
    if (manualSchedule) {
      // Quarterly / Bi-Annually: the underwritten premium is divided evenly and
      // becomes the amount due for each period.
      const per = Math.round((underwritten / count) * 100) / 100;
      amounts = Array.from({ length: count }, (_, i) =>
        i === count - 1 ? Math.round((underwritten - per * (count - 1)) * 100) / 100 : per);
    } else {
      const total = effGross;
      if (!(total > 0)) return [];
      const per = Math.round((total / count) * 100) / 100;
      amounts = Array.from({ length: count }, (_, i) =>
        i === count - 1 ? Math.round((total - per * (count - 1)) * 100) / 100 : per);
    }
    return Array.from({ length: count }, (_, i) => {
      const due = new Date(start);
      due.setMonth(due.getMonth() + Math.round(i * step));
      return { label: labels[i], due: due.toISOString().slice(0, 10), amount: amounts[i], manual: false };
    });
  }, [form.payment_schedule, form.policy_start_date, effGross, manualSchedule, underwritten, isCustom, customRows]);

  // ── Per-instalment payment status & collection details ──
  type InsCollect = { status: "due" | "paid"; mode: string; date: string; ref: string; remarks: string };
  const [insCollect, setInsCollect] = useState<Record<number, Partial<InsCollect>>>({});
  const setCollect = (i: number, patch: Partial<InsCollect>) =>
    setInsCollect((m) => ({ ...m, [i]: { ...m[i], ...patch } }));
  /** Paid / Due state of a period; defaults to paid once an amount is recorded. */
  const statusOf = (i: number): "due" | "paid" =>
    insCollect[i]?.status ?? ((paidRows[i]?.paid_amount ?? 0) > 0 ? "paid" : "due");

  // Once a period is settled, nothing remains due.
  const dueOf = (i: number) => {
    const paidAmt = paidRows[i]?.paid_amount ?? 0;
    if (manualSchedule && paidAmt > 0) return 0;
    // Custom plan: the instalment is settled when its status is set to Paid.
    if (isCustom && statusOf(i) === "paid") return 0;
    return instalments[i]?.amount ?? 0;
  };
  const scheduleTotal = instalments.reduce((a, _, i) => a + dueOf(i), 0);

  const setPaid = (i: number, patch: Partial<{ paid_date: string; paid_amount: number }>) => {
    setPaidRows((rs) => {
      const next = instalments.map((_, idx) => rs[idx] ?? { paid_date: "", paid_amount: 0 });
      next[i] = { ...next[i], ...patch };
      return next;
    });
    // The period's net premium follows the amount actually paid.
    if (manualSchedule && patch.paid_amount !== undefined) setBreakdown(i, { net: patch.paid_amount });
  };
  const taggedShares = useMemo(() => {
    const n = instalments.length;
    if (!manualSchedule || !n) return [] as number[];
    const per = Math.round((underwritten / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) =>
      i === n - 1 ? Math.round((underwritten - per * (n - 1)) * 100) / 100 : per);
  }, [underwritten, instalments.length, manualSchedule]);

  // Per-instalment premium & commission, calculated exactly like the deal-level
  // engine but from the hand-written values of each period.
  const [openIns, setOpenIns] = useState<number | null>(null);
  const instalmentCalcs = useMemo(() => {
    if (!perIns) return [] as ReturnType<typeof calculateDealFinancials>[];
    return Array.from({ length: manualCount }, (_, i) => {
      const b = insBreakdown[i] ?? {};
      const fb = isCustom ? Number(customRows[i]?.amount) || 0 : 0;
      const gross = Number(b.gross ?? fb) || 0;
      return calculateDealFinancials({
        gross_premium: gross,
        net_premium: Number(b.net ?? fb) || 0,
        commission_percentage: Number(b.commission) || 0,
        marketing_budget_percentage: Number(b.marketing) || 0,
        loading: Number(b.loading) || 0,
        b2b_commission: (b.b2b_type ?? "fixed") === "percentage"
          ? Math.round(gross * (Number(b.b2b_pct) || 0)) / 100
          : Number(b.b2b) || 0,

        base_percentage: lists?.basePct,
      });
    });
  }, [perIns, manualCount, insBreakdown, lists?.basePct, isCustom, customRows]);




  // All instalments of a policy year are tagged to the policy start year.
  const paymentYear = form.policy_start_date
    ? Number(form.policy_start_date.slice(0, 4))
    : new Date().getFullYear();

  // ── Duplicate Cover Note number check ──
  const [cnError, setCnError] = useState("");
  const checkCoverNote = async (value: string) => {
    setCnError("");
    const n = norm(value);
    if (!n) return;
    const [deals, policies] = await Promise.all([
      supabase.from("deals").select("deal_number, cover_note_number").not("cover_note_number", "is", null),
      supabase.from("deal_policies").select("cover_note_number, deal_id").not("cover_note_number", "is", null),
    ]);
    const hitDeal = (deals.data ?? []).find((d) => norm(d.cover_note_number ?? "") === n);
    if (hitDeal) return setCnError(`Cover note already used on deal ${hitDeal.deal_number}`);
    const hitPolicy = (policies.data ?? []).find((p) => norm(p.cover_note_number ?? "") === n);
    if (hitPolicy) setCnError("Cover note already used on an existing bulk policy row");
  };

  // ── Payment receipts upload (at least one required before a deal can be saved) ──
  const [uploading, setUploading] = useState(false);
  const [proofs, setProofs] = useState<{ path: string; name: string }[]>([]);
  const uploadProofs = async (fileList: File[]) => {
    if (!user || fileList.length === 0) return;
    setUploading(true);
    const done: { path: string; name: string }[] = [];
    for (const file of fileList) {
      const path = `payment-proofs/${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("crm-documents").upload(path, file, { upsert: false });
      if (error) toast.error(`${file.name}: ${error.message}`);
      else done.push({ path, name: file.name });
    }
    setUploading(false);
    if (!done.length) return;
    setProofs((prev) => {
      const next = [...prev, ...done];
      set("payment_proof_url", next[0].path);
      return next;
    });
    toast.success(`${done.length} receipt(s) uploaded`);
  };
  const removeProof = (path: string) => {
    setProofs((prev) => {
      const next = prev.filter((p) => p.path !== path);
      set("payment_proof_url", next[0]?.path ?? "");
      return next;
    });
  };

  // ── Per-period B2B commission payment receipts (Quarterly / Bi-Annually) ──
  const [insReceipts, setInsReceipts] = useState<Record<number, { path: string; name: string }[]>>({});
  const [insUploading, setInsUploading] = useState<number | null>(null);
  const uploadInsReceipts = async (i: number, fileList: File[]) => {
    if (!user || fileList.length === 0) return;
    setInsUploading(i);
    const done: { path: string; name: string }[] = [];
    for (const file of fileList) {
      const path = `b2b-receipts/${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("crm-documents").upload(path, file, { upsert: false });
      if (error) toast.error(`${file.name}: ${error.message}`);
      else done.push({ path, name: file.name });
    }
    setInsUploading(null);
    if (!done.length) return;
    setInsReceipts((m) => ({ ...m, [i]: [...(m[i] ?? []), ...done] }));
    toast.success(`${done.length} receipt(s) uploaded`);
  };
  const removeInsReceipt = (i: number, path: string) =>
    setInsReceipts((m) => ({ ...m, [i]: (m[i] ?? []).filter((p) => p.path !== path) }));

  // ── Per-instalment collection details (status lives above, next to dueOf) ──
  const collectOf = (i: number): InsCollect => {
    const o = insCollect[i] ?? {};
    return {
      status: statusOf(i),
      mode: o.mode ?? "", date: o.date ?? "", ref: o.ref ?? "", remarks: o.remarks ?? "",
    };
  };
  const setCollect = (i: number, patch: Partial<InsCollect>) =>
    setInsCollect((m) => ({ ...m, [i]: { ...m[i], ...patch } }));


  // Combined totals of all hand-written periods (shown below the quarter section).
  const periodTotals = useMemo(() => {
    return instalmentCalcs.reduce(
      (a, c) => ({
        gross: a.gross + c.gross_premium, net: a.net + c.net_premium,
        commBefore: a.commBefore + c.commission_before_tax, commTax: a.commTax + c.commission_tax,
        commAfter: a.commAfter + c.commission_after_tax, mktBefore: a.mktBefore + c.marketing_before_tax,
        mktTax: a.mktTax + c.marketing_tax, mktAfter: a.mktAfter + c.marketing_after_tax,
        loading: a.loading + c.loading, b2b: a.b2b + c.b2b_commission,
        income: a.income + c.total_income, tagged: a.tagged + c.tagged_premium,
      }),
      { gross: 0, net: 0, commBefore: 0, commTax: 0, commAfter: 0, mktBefore: 0, mktTax: 0, mktAfter: 0, loading: 0, b2b: 0, income: 0, tagged: 0 },
    );
  }, [instalmentCalcs]);




  const submit = async () => {
    if (!user) return;
    if (!form.client_id) return toast.error("Please pick a client");
   const effectiveGross = effGross;
   const effectiveNet = effNet;
   // Quarterly / Bi-Annually: the deal-level commission, marketing, loading and
   // B2B totals are the sum of the per-period hand-written figures.
   const manualAgg = perIns
     ? instalmentCalcs.reduce((a, c) => ({
         comm: a.comm + c.commission_before_tax, mkt: a.mkt + c.marketing_before_tax,
         loading: a.loading + c.loading, b2b: a.b2b + c.b2b_commission,
       }), { comm: 0, mkt: 0, loading: 0, b2b: 0 })
     : null;

    if (!(effectiveGross > 0)) return toast.error("Gross premium is required");
    if (!Number.isFinite(form.net_premium) || form.net_premium < 0) return toast.error("Net premium must be a positive number");
    if (cnError) return toast.error(cnError);
    // Per-instalment schedules capture their collection details and receipts inside each period.
    const firstInsProof = Object.values(insReceipts).flat()[0]?.path ?? "";
    if (perIns) {
      if (!form.payment_proof_url && !firstInsProof)
        return toast.error("Attach a payment receipt inside at least one instalment before saving");
    } else if (!form.payment_proof_url) {
      return toast.error("Payment proof is required before the deal can be saved");
    }

    const isTravelBulk = form.policy_type === "bulk" && isTravel;
    if (form.policy_type === "bulk" && (isTravelBulk ? travelRows.length === 0 : bulkRows.length === 0)) return toast.error("Add at least one bulk policy row");
    if (isTravelBulk) {
      const seen = new Map<string, number>();
      for (let i = 0; i < travelRows.length; i++) {
        const r = travelRows[i];
        if (r.commission_percentage < 0 || r.commission_percentage > 45) return toast.error(`Row ${i + 1}: commission must be between 0% and 45%`);
        const n = norm(r.policy_number);
        if (!n) return toast.error(`Row ${i + 1}: policy number is required`);
        if (seen.has(n)) return toast.error(`Duplicate policy number in rows ${seen.get(n)! + 1} and ${i + 1}`);
        seen.set(n, i);
        const { data: conflict } = await supabase.rpc("travel_policy_conflict" as any, { _policy_number: r.policy_number, _exclude_row: null });
        const hit: any = Array.isArray(conflict) ? conflict[0] : conflict;
        if (hit) return toast.error(`Policy ${r.policy_number} already exists${hit.reference ? ` on ${hit.reference}` : ""}`);
      }
      const payable = travelRows.reduce((a, r) => a + payableOf(r), 0);
      const transferred = travelTransfers.reduce((a, t) => a + Number(t.amount || 0), 0);
      if (transferred > 0 && Math.abs(transferred - payable) > 0.01) {
        return toast.error("Amount transfer total must match Payable to Insurance Company");
      }
    } else if (form.policy_type === "bulk") {
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
      marketing_budget_percentage: manualAgg
        ? (effectiveGross > 0 ? (manualAgg.mkt / effectiveGross) * 100 : 0)
        : (canSeeMarketing ? form.marketing_budget_percentage : 0),
      commission_percentage: manualAgg
        ? (effectiveGross > 0 ? (manualAgg.comm / effectiveGross) * 100 : 0)
        : form.commission_percentage,
      loading: manualAgg ? manualAgg.loading : form.loading,
      gross_premium: effectiveGross,
      net_premium: effectiveNet,
      base_percentage: lists?.basePct ?? 13,
      policy_start_date: form.policy_start_date || null,
      policy_end_date: form.policy_end_date || null,
      deal_type: form.deal_type,
      policy_type: form.policy_type,
      b2b_commission: manualAgg ? manualAgg.b2b : b2bAmount,

      b2b_taker_id: form.b2b_taker_id || null,
      b2b_taker_name: form.b2b_taker_name.trim() || null,
      b2b_commission_type: form.b2b_commission_type,
      b2b_commission_percentage: Number(form.b2b_commission_percentage) || 0,
      payment_destination: form.payment_destination,
      payment_schedule: form.payment_schedule || null,
      // Collection details are captured for both destinations; the receivable
      // exclusion for direct-to-insurer payments is handled in Accounts.
      payment_mode: form.payment_mode || null,
      payment_receive_date: form.payment_receive_date || null,
      transaction_reference: form.transaction_reference.trim() || null,
      payment_remarks: form.payment_remarks.trim() || null,
      payment_proof_url: form.payment_proof_url || firstInsProof || null,
      payment_year: paymentYear,
      underwritten_premium: manualSchedule || isCustom ? underwritten : 0,
    };
    const { data, error } = await supabase.from("deals").insert(payload).select("id").maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (data && proofs.length) {
      const { error: dErr } = await supabase.from("deal_documents").insert(
        proofs.map((p) => ({
          deal_id: data.id, client_id: form.client_id || null,
          doc_type: "payment_receipt", file_name: p.name,
          storage_path: p.path, uploaded_by: user.id,
        })),
      );
      if (dErr) toast.error("Deal created, but receipts failed to attach: " + dErr.message);
    }

    // Persist the instalment schedule (Quarterly / Bi-Annually / Monthly).
    if (data && (instalments.length > 1 || (isCustom && instalments.length > 0))) {
      const { error: iErr } = await supabase.from("deal_installments" as any).insert(
        instalments.map((ins, i) => {
          const row = paidRows[i] ?? { paid_date: "", paid_amount: 0 };
          const paid = row.paid_date ? new Date(`${row.paid_date}T00:00:00`) : null;
          const b = perIns ? breakdownOf(i) : null;
          const c = instalmentCalcs[i];
          return {
            deal_id: data.id,
            installment_number: i + 1,
            label: ins.label,
            due_date: ins.due || null,
            amount: ins.amount,
            paid_date: row.paid_date || null,
            paid_amount: row.paid_amount || 0,
            gross_premium: b ? b.gross : 0,
            net_premium: b ? b.net : 0,
            loading: b ? b.loading : 0,
            b2b_commission: b ? b2bOf(i) : 0,
            b2b_taker_name: b ? (b.b2b_taker_name?.trim() || null) : null,
            commission_percentage: b ? b.commission : 0,
            marketing_budget: c ? c.marketing_before_tax : 0,
            commission: c ? c.commission_before_tax : 0,
            underwritten_amount: manualSchedule ? (taggedShares[i] ?? 0) : 0,
            payment_status: collectOf(i).status,
            payment_mode: collectOf(i).mode || null,
            payment_receive_date: collectOf(i).date || null,
            transaction_reference: collectOf(i).ref.trim() || null,
            payment_remarks: collectOf(i).remarks.trim() || null,
            // A paid instalment is tagged to the month it was marked paid.
            tagged_month: collectOf(i).status === "paid"
              ? new Date().getMonth() + 1
              : paid ? paid.getMonth() + 1 : null,
            tagged_year: collectOf(i).status === "paid"
              ? new Date().getFullYear()
              : paid ? paid.getFullYear() : null,
            created_by: user.id,

          };

        }) as any,
      );
      if (iErr) toast.error("Deal created, but instalments failed to save: " + iErr.message);
    }

    // Per-period B2B commission payment receipts (Quarterly / Bi-Annually).
    if (data && perIns) {
      const docs = Object.entries(insReceipts).flatMap(([idx, files]) =>
        (files ?? []).map((p) => ({
          deal_id: data.id, client_id: form.client_id || null,
          doc_type: "b2b_commission_receipt",
          file_name: `${instalments[Number(idx)]?.label ?? `Period ${Number(idx) + 1}`} — ${p.name}`,
          storage_path: p.path, uploaded_by: user.id,
        })),
      );
      if (docs.length) {
        const { error: bErr } = await supabase.from("deal_documents").insert(docs);
        if (bErr) toast.error("Deal created, but B2B receipts failed to attach: " + bErr.message);
      }
    }



    if (form.policy_type === "bulk" && data && isTravel) {
      const payable = travelRows.reduce((a, r) => a + payableOf(r), 0);
      const transferred = travelTransfers.reduce((a, t) => a + Number(t.amount || 0), 0);
      const { data: posting, error: pErr } = await supabase.from("travel_postings").insert({
        deal_id: data.id,
        total_policy_amount: effectiveGross,
        total_posting_amount: transferred || payable,
      }).select("id").maybeSingle();
      if (pErr || !posting) toast.error("Deal created, but travel posting failed: " + (pErr?.message ?? ""));
      else {
        const { error: rErr } = await supabase.from("travel_posting_rows").insert(
          travelRows.map((r, idx) => ({
            posting_id: posting.id, sr_no: idx + 1,
            travel_agent: r.travel_agent || null,
            date_issued: r.date_issued || null,
            policy_number: r.policy_number || null,
            premium: r.premium, commission_percentage: r.commission_percentage,
            agent_name: r.agent_name || null, remarks: r.remarks || null,
          })),
        );
        if (rErr) toast.error("Deal created, but travel rows failed: " + rErr.message);
        const filled = travelTransfers.filter(t => Number(t.amount || 0) > 0 || t.bank_name || t.tid);
        if (filled.length) {
          const { error: tErr } = await supabase.from("travel_posting_transfers" as any).insert(
            filled.map((t, idx) => ({
              posting_id: posting.id, sr_no: idx + 1,
              transfer_date: t.transfer_date || null, bank_name: t.bank_name || null,
              amount: t.amount, tid: t.tid || null, agent: t.agent || null,
            })) as any,
          );
          if (tErr) toast.error("Deal created, but transfer details failed: " + tErr.message);
        }
      }
    } else if (form.policy_type === "bulk" && data) {
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
          ? "Team, DO and Team Lead are attached automatically. Tagged Premium is calculated automatically."
          : "Team is attached automatically. Enter policy and premium details below."}
      />

      <div className={canSeeLiveCalc && !perIns ? "grid lg:grid-cols-3 gap-4" : "grid gap-4"}>
        <div className={`space-y-4 ${canSeeLiveCalc && !perIns ? "lg:col-span-2" : ""}`}>

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
              <Field label="Cover Note Number">
                <Input
                  value={form.cover_note_number}
                  aria-invalid={!!cnError}
                  className={cnError ? "border-destructive" : ""}
                  onChange={(e)=>{ set("cover_note_number", e.target.value); if (cnError) setCnError(""); }}
                  onBlur={(e)=>checkCoverNote(e.target.value)}
                />
                {cnError && <p className="text-xs text-destructive mt-1">{cnError}</p>}
              </Field>
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
              <Field label="Policy Start">
                <DateField value={form.policy_start_date} onChange={setStartDate} placeholder="Start date"/>
              </Field>
              <Field label={isTravel ? "Policy End (solar calendar)" : "Policy End (auto +1 solar year)"}>
                <DateField value={form.policy_end_date} onChange={(v)=>set("policy_end_date", v)} placeholder="End date"/>
              </Field>
              <Field label="Payment Mode / Schedule">
                <Select value={form.payment_schedule} onValueChange={(v)=>set("payment_schedule", v)}>
                  <SelectTrigger><SelectValue placeholder="Select payment mode"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Bi-Annually">Bi-Annually</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                    <SelectItem value="Custom">Custom (set your own plan)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          {(instalments.length > 1 || isCustom) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {form.payment_schedule} Instalment Plan — {instalments.length} payments · tagged to year {paymentYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {manualSchedule && (
                  <div className="max-w-xs">
                    <p className="text-sm mb-1">Underwritten Business (Underwritten Premium)</p>
                    <MoneyInput value={underwritten} onChange={setUnderwritten} showWords={false}/>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Divided evenly across the periods as the amount due. Once a paid amount is
                      entered, that period's amount due becomes zero and its net premium follows the paid amount.
                    </p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left p-2">Instalment</th>
                        <th className="text-left p-2">Due Date</th>
                        <th className="text-right p-2">Amount Due</th>
                        
                        <th className="text-left p-2">Paid Date</th>
                        <th className="text-right p-2">Paid Amount</th>
                        <th className="text-left p-2">Payment Status</th>
                        <th className="text-left p-2">Tagged Month</th>

                        {isCustom && <th className="text-right p-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {instalments.map((ins, i) => {
                        const row = paidRows[i] ?? { paid_date: "", paid_amount: 0 };
                        const paid = row.paid_date ? new Date(`${row.paid_date}T00:00:00`) : null;
                        return (
                        <Fragment key={i}>
                        <tr className="border-t align-top">
                          <td className="p-2 whitespace-nowrap">
                            {perIns ? (
                              <button type="button" className="underline underline-offset-2 hover:text-primary"
                                onClick={() => setOpenIns(openIns === i ? null : i)}>
                                {ins.label} {openIns === i ? "▾" : "▸"}
                              </button>
                            ) : ins.label}
                          </td>

                          <td className="p-2 min-w-[170px]">
                            {isCustom ? (
                              <DateField value={ins.due} onChange={(v) => setCustomRow(i, { due: v })} placeholder="Due date"/>
                            ) : fmtDate(ins.due)}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {isCustom ? (
                              <div className="max-w-[200px] ml-auto">
                                <MoneyInput value={ins.amount} onChange={(v) => setCustomRow(i, { amount: v })} showWords={false}/>
                              </div>
                            ) : ins.manual ? (
                              <div className="max-w-[200px] ml-auto">
                                <MoneyInput value={firstPayment} onChange={(v) => setFirstPayment(v)} showWords={false}/>
                              </div>
                            ) : (
                              <span>{fmtPKR(dueOf(i))} <span className="text-xs text-muted-foreground">(auto)</span></span>
                            )}
                          </td>
                          <td className="p-2 min-w-[170px]">
                            <DateField value={row.paid_date} onChange={(v)=>setPaid(i, { paid_date: v })} placeholder="Paid date"/>
                          </td>
                          <td className="p-2 min-w-[150px]">
                            <MoneyInput value={row.paid_amount} onChange={(v)=>setPaid(i, { paid_amount: v })} showWords={false}/>
                          </td>
                          <td className="p-2 min-w-[130px]">
                            <Select value={collectOf(i).status} onValueChange={(v) => setCollect(i, { status: v as "due" | "paid" })}>
                              <SelectTrigger><SelectValue/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="due">Due</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 whitespace-nowrap text-muted-foreground">
                            {paid ? paid.toLocaleDateString("en-PK", { month: "short", year: "numeric" }) : "—"}
                          </td>
                          {isCustom && (
                            <td className="p-2 text-right">
                              <Button type="button" variant="ghost" size="sm" disabled={customRows.length <= 1}
                                onClick={() => setCustomRows((rs) => rs.filter((_, idx) => idx !== i))}>Remove</Button>
                            </td>
                          )}
                        </tr>
                        {perIns && openIns === i && (
                          <tr className="bg-muted/40">
                            <td colSpan={isCustom ? 8 : 7} className="p-3">

                              <div className="text-xs font-medium mb-2">{ins.label} — Premium &amp; Commission <span className="text-muted-foreground font-normal">(hand written for this period)</span></div>
                              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                                <div><p className="mb-1 text-muted-foreground">Gross Premium</p>
                                  <MoneyInput value={breakdownOf(i).gross} onChange={(v) => setBreakdown(i, { gross: v })} showWords={false} /></div>
                                <div><p className="mb-1 text-muted-foreground">Net Premium</p>
                                  <MoneyInput value={breakdownOf(i).net} onChange={(v) => setBreakdown(i, { net: v })} showWords={false} /></div>
                                <div><p className="mb-1 text-muted-foreground">Commission %</p>
                                  <Input type="number" step="0.001" className="text-right" value={breakdownOf(i).commission}
                                    onChange={(e) => setBreakdown(i, { commission: Number(e.target.value) || 0 })} /></div>
                                <div><p className="mb-1 text-muted-foreground">Marketing Budget %</p>
                                  <Input type="number" step="0.001" className="text-right" value={breakdownOf(i).marketing}
                                    onChange={(e) => setBreakdown(i, { marketing: Number(e.target.value) || 0 })} /></div>
                                <div><p className="mb-1 text-muted-foreground">Loading</p>
                                  <MoneyInput value={breakdownOf(i).loading} onChange={(v) => setBreakdown(i, { loading: v })} showWords={false} /></div>
                                <div><p className="mb-1 text-muted-foreground">B2B Commission Type</p>
                                  <Select value={breakdownOf(i).b2b_type}
                                    onValueChange={(v) => setBreakdown(i, { b2b_type: v as "fixed" | "percentage" })}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                                      <SelectItem value="percentage">Percentage of Gross</SelectItem>
                                    </SelectContent>
                                  </Select></div>
                                {breakdownOf(i).b2b_type === "percentage" ? (
                                  <>
                                    <div><p className="mb-1 text-muted-foreground">B2B Commission %</p>
                                      <Input type="number" step="0.001" className="text-right" value={breakdownOf(i).b2b_pct}
                                        onChange={(e) => setBreakdown(i, { b2b_pct: Number(e.target.value) || 0 })} /></div>
                                    <div><p className="mb-1 text-muted-foreground">B2B Commission (auto)</p>
                                      <Input readOnly tabIndex={-1} className="bg-muted/50 text-right" value={fmtPKR(b2bOf(i))} /></div>
                                  </>
                                ) : (
                                  <div><p className="mb-1 text-muted-foreground">B2B Commission</p>
                                    <MoneyInput value={breakdownOf(i).b2b} onChange={(v) => setBreakdown(i, { b2b: v })} showWords={false} /></div>
                                )}

                                <div className="col-span-2 md:col-span-6">
                                  <p className="mb-1 text-muted-foreground">Name of B2B Commission Taker</p>
                                  <B2BTakerField value={breakdownOf(i).b2b_taker_name ?? ""}
                                    onChange={(v) => setBreakdown(i, { b2b_taker_name: v })} />
                                </div>
                              </div>
                              {instalmentCalcs[i] && (
                                <div className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-1 text-xs max-w-3xl">
                                  {canSeeLiveCalc && (
                                    <>
                                      <Row k="Commission Before Tax" v={fmtPKR(instalmentCalcs[i].commission_before_tax)} />
                                      <Row k="Marketing Before Tax" v={fmtPKR(instalmentCalcs[i].marketing_before_tax)} />
                                      <Row k="Commission Tax (17%)" v={fmtPKR(instalmentCalcs[i].commission_tax)} />
                                      <Row k="Marketing Tax (9%)" v={fmtPKR(instalmentCalcs[i].marketing_tax)} />
                                      <Row k="Commission After Tax" v={fmtPKR(instalmentCalcs[i].commission_after_tax)} />
                                      <Row k="Marketing After Tax" v={fmtPKR(instalmentCalcs[i].marketing_after_tax)} />
                                      <Row k="Total Income" v={fmtPKR(instalmentCalcs[i].total_income)} strong />
                                      <Row k="Income %" v={fmtPct(instalmentCalcs[i].income_percentage)} />
                                    </>
                                  )}
                                  <Row k="Tagged Premium" v={fmtPKR(instalmentCalcs[i].tagged_premium)} strong />
                                </div>
                              )}
                              {canSeeFinancials && (
                                <div className="mt-3 rounded-md border p-3 space-y-3">
                                  <p className="text-xs font-medium">
                                    {form.payment_destination === "company"
                                      ? `Payment to Company — Collection Details — ${ins.label}`
                                      : `Payment Directly to Insurance Company — Details — ${ins.label}`}
                                  </p>
                                  <div className="grid sm:grid-cols-3 gap-3 text-xs">
                                    <div><p className="mb-1 text-muted-foreground">Payment Method</p>
                                      <Select value={collectOf(i).mode} onValueChange={(v) => setCollect(i, { mode: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select method"/></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Bank via Cheque Deposit">Bank via Cheque Deposit</SelectItem>
                                          <SelectItem value="Online Transfer">Online Transfer</SelectItem>
                                          <SelectItem value="Cash">Cash</SelectItem>
                                          <SelectItem value="Card">Card</SelectItem>
                                        </SelectContent>
                                      </Select></div>
                                    <div><p className="mb-1 text-muted-foreground">Payment Receive Date</p>
                                      <DateField value={collectOf(i).date} onChange={(v) => setCollect(i, { date: v })} placeholder="Receive date"/></div>
                                    <div><p className="mb-1 text-muted-foreground">Transaction / Cheque Reference</p>
                                      <Input value={collectOf(i).ref} onChange={(e) => setCollect(i, { ref: e.target.value })} placeholder="TID / Cheque no."/></div>
                                    <div className="sm:col-span-3"><p className="mb-1 text-muted-foreground">Payment Remarks</p>
                                      <Input value={collectOf(i).remarks} onChange={(e) => setCollect(i, { remarks: e.target.value })}/></div>
                                  </div>
                                </div>
                              )}
                              <div className="mt-3 space-y-1.5 max-w-md">

                                <Label className="text-xs">Payment Receipt — {ins.label}</Label>
                                <Input type="file" multiple accept="image/*,application/pdf"
                                  disabled={insUploading === i}
                                  onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) uploadInsReceipts(i, fs); e.currentTarget.value = ""; }} />
                                {(insReceipts[i] ?? []).length > 0 && (
                                  <ul className="space-y-1">
                                    {(insReceipts[i] ?? []).map((p) => (
                                      <li key={p.path} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                                        <span className="truncate">{p.name}</span>
                                        <button type="button" className="text-destructive ml-2" onClick={() => removeInsReceipt(i, p.path)}>Remove</button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                  {insUploading === i ? "Uploading…" : `Attach the payment receipt for ${ins.label}.`}
                                </p>
                              </div>
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Saved with the deal against {ins.label}
                                {row.paid_date ? ` — tagged to ${new Date(`${row.paid_date}T00:00:00`).toLocaleDateString("en-PK", { month: "long", year: "numeric" })}` : " — tagged once a paid date is entered"}.
                              </p>

                            </td>
                          </tr>
                        )}
                        </Fragment>
                        );

                      })}
                    </tbody>
                    <tfoot className="border-t font-medium">
                      <tr>
                        <td className="p-2" colSpan={2}>Total</td>
                        <td className="p-2 text-right tabular-nums">{fmtPKR(scheduleTotal)}</td>
                        
                        <td className="p-2" />
                        <td className="p-2 text-right tabular-nums">
                          {fmtPKR(instalments.reduce((a, _, i) => a + (paidRows[i]?.paid_amount ?? 0), 0))}
                        </td>
                        <td className="p-2" />
                        <td className="p-2" />
                        {isCustom && <td className="p-2" />}

                      </tr>
                    </tfoot>
                  </table>
                </div>
                {isCustom && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted-foreground">
                      Add as many instalments as you need and set each due date and amount yourself.
                    </p>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setCustomRows((rs) => [...rs, { due: "", amount: 0 }])}>
                      Add Instalment
                    </Button>
                  </div>
                )}
                {isCustom && (
                  <div className="rounded-lg border p-3 space-y-3 max-w-md">
                    <p className="text-sm font-medium">Underwritten</p>
                    <div>
                      <p className="text-sm mb-1">Underwritten Business (Underwritten Premium)</p>
                      <MoneyInput value={underwritten} onChange={setUnderwritten} showWords={false}/>
                    </div>
                    <div className="grid gap-1 text-xs">
                      <Row k="Total Underwritten" v={fmtPKR(underwritten)} strong />
                      <Row k="Remaining Outstanding Premium"
                        v={fmtPKR(Math.max(0, underwritten - instalments.reduce((a, _, i) => a + (paidRows[i]?.paid_amount ?? 0), 0)))} strong />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Not linked to the instalment amounts — the remaining outstanding premium is simply
                      the underwritten premium minus everything paid so far.
                    </p>
                  </div>
                )}



                {perIns && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <p className="text-sm font-medium">
                      Premium &amp; Commission — total of the {instalments.length} periods
                    </p>
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-xs max-w-3xl">
                      <Row k="Gross Premium" v={fmtPKR(periodTotals.gross)} strong />
                      <Row k="Net Premium" v={fmtPKR(periodTotals.net)} strong />
                      <Row k="Loading" v={fmtPKR(periodTotals.loading)} />
                      {canSeeLiveCalc && (
                        <>
                          <Row k="Commission Before Tax" v={fmtPKR(periodTotals.commBefore)} />
                          <Row k="Marketing Before Tax" v={fmtPKR(periodTotals.mktBefore)} />
                          <Row k="Commission Tax (17%)" v={fmtPKR(periodTotals.commTax)} />
                          <Row k="Marketing Tax (9%)" v={fmtPKR(periodTotals.mktTax)} />
                          <Row k="Commission After Tax" v={fmtPKR(periodTotals.commAfter)} />
                          <Row k="Marketing After Tax" v={fmtPKR(periodTotals.mktAfter)} />
                          <Row k="Total Income" v={fmtPKR(periodTotals.income)} strong />
                          {manualSchedule && <Row k="Underwritten Premium" v={fmtPKR(underwritten)} />}
                        </>
                      )}
                      <Row k="Tagged Premium" v={fmtPKR(periodTotals.tagged)} strong />
                    </div>
                    {canSeeFinancials && (
                      <div className="max-w-xs">
                        <Field label="Payment Destination">
                          <Select value={form.payment_destination} onValueChange={(v)=>set("payment_destination", v as "company" | "insurance_company")}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="company">Paid to Company (receivable)</SelectItem>
                              <SelectItem value="insurance_company">Paid directly to Insurance Company</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {perIns
                    ? `Open a period to enter its own premium & commission — the deal's Gross and Net Premium are the sum of all ${instalments.length} periods. Each period is tagged to the month its payment is recorded.`
                    : `Amounts are auto-calculated from the total gross premium. All instalments received against this policy stay tagged to ${paymentYear}.`}
                </p>


              </CardContent>
            </Card>
          )}


          {form.policy_type === "bulk" && isTravel && (
            <TravelBulkPolicies
              rows={travelRows} setRows={setTravelRows}
              transfers={travelTransfers} setTransfers={setTravelTransfers}
              dupErrors={travelDupErrors} onCheckDuplicate={checkTravelDuplicate}
            />
          )}

          {form.policy_type === "bulk" && !isTravel && (
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
                Choose Policy Type “Bulk Policies” to enter travel policies in the travel sheet format (Travel Agent, Date of Issued, Policy No., Premium, Commission 0–45%, auto Payable to Insurance Company, Agent, Remarks) plus the amount transfer details. Posting From/To and Balanced/Excess/Deficit reconciliation remain on the Deal detail page; the deal cannot be moved to Won until posting is Balanced.
              </CardContent>
            </Card>
          )}

          {perIns ? null : (

          <Card>
            <CardHeader><CardTitle className="text-base">Premium{canSeeFinancials ? " & Commission" : ""}</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <Field label={form.policy_type === "bulk" ? "Gross Premium (PKR) — from bulk policies" : "Gross Premium (PKR) *"}>
                <MoneyInput
                  value={effGross}
                  readOnly={form.policy_type === "bulk"}
                  className={form.policy_type === "bulk" ? "bg-muted/50" : ""}
                  onChange={(v)=>set("gross_premium", v)}
                />
              </Field>
              <Field label={form.policy_type === "bulk" ? "Net Premium (PKR) — from bulk policies" : "Net Premium (PKR)"}>
                <MoneyInput
                  value={effNet}
                  readOnly={form.policy_type === "bulk"}
                  className={form.policy_type === "bulk" ? "bg-muted/50" : ""}
                  onChange={(v)=>set("net_premium", v)}
                />
              </Field>
              <Field label="Tagged Premium (auto)">
                <Input readOnly tabIndex={-1} value={fmtPKR(calc.tagged_premium)} className="bg-muted/50"/>
                <p className="text-[11px] leading-tight text-muted-foreground mt-1">{amountInWords(calc.tagged_premium)}</p>
              </Field>
              {canSeeFinancials && (
                <>
                  <Field label="Commission %"><Input type="number" step="0.001" value={form.commission_percentage} onChange={(e)=>setNum("commission_percentage", e.target.value)}/></Field>
                  {canSeeMarketing && (
                    <Field label="Marketing Budget %"><Input type="number" step="0.001" value={form.marketing_budget_percentage} onChange={(e)=>setNum("marketing_budget_percentage", e.target.value)}/></Field>
                  )}

                  <Field label="Loading (PKR)"><Input type="number" step="0.01" value={form.loading} onChange={(e)=>setNum("loading", e.target.value)}/></Field>
                  <Field label="Payment Destination">
                    <Select value={form.payment_destination} onValueChange={(v)=>set("payment_destination", v as "company" | "insurance_company")}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Paid to Company (receivable)</SelectItem>
                        <SelectItem value="insurance_company">Paid directly to Insurance Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}
            </CardContent>

          </Card>
          )}


          {canSeeFinancials && !perIns && (

            <Card>
              <CardHeader><CardTitle className="text-base">
                {form.payment_destination === "company"
                  ? "Payment to Company — Collection Details"
                  : "Payment Directly to Insurance Company — Details"}
              </CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4">
                <Field label="Payment Method">
                  <Select value={form.payment_mode} onValueChange={(v)=>set("payment_mode", v)}>
                    <SelectTrigger><SelectValue placeholder="Select method"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank via Cheque Deposit">Bank via Cheque Deposit</SelectItem>
                      <SelectItem value="Online Transfer">Online Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Payment Receive Date">
                  <DateField value={form.payment_receive_date} onChange={(v)=>set("payment_receive_date", v)} placeholder="Receive date"/>
                </Field>
                <Field label="Transaction / Cheque Reference">
                  <Input value={form.transaction_reference} onChange={(e)=>set("transaction_reference", e.target.value)} placeholder="TID / Cheque no."/>
                </Field>
                <div className="sm:col-span-3">
                  <Field label="Payment Remarks">
                    <Input value={form.payment_remarks} onChange={(e)=>set("payment_remarks", e.target.value)}/>
                  </Field>
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs">Payment Receipts * (attach one or more)</Label>
                  <Input type="file" multiple accept="image/*,application/pdf" disabled={uploading}
                    onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) uploadProofs(fs); e.currentTarget.value = ""; }} />
                  {proofs.length > 0 && (
                    <ul className="space-y-1">
                      {proofs.map((p) => (
                        <li key={p.path} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                          <span className="truncate">{p.name}</span>
                          <button type="button" className="text-destructive ml-2" onClick={() => removeProof(p.path)}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className={`text-xs ${proofs.length ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {uploading ? "Uploading…" : proofs.length ? `${proofs.length} receipt(s) attached` : "Attach receipts / deposit slips / transfer screenshots."}
                  </p>
                </div>

                <p className="sm:col-span-3 text-xs text-muted-foreground">
                  {form.payment_destination === "company"
                    ? "Payments collected by the company post to Accounts as a premium receivable, and the amount payable onward to the insurance company appears under the Payables / expense head."
                    : "Paid directly to the insurance company — these details are recorded for the audit trail but are NOT counted as a premium receivable in Accounts."}
                </p>
              </CardContent>
            </Card>
          )}



          {canSeeFinancials && !perIns && (
            <Card>
              <CardHeader><CardTitle className="text-base">B2B Commission</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-4">
                <Field label="Name of B2B Commission Taker">
                  <B2BTakerField value={form.b2b_taker_name} onChange={(v)=>set("b2b_taker_name", v)} />
                </Field>
                <Field label="B2B Commission Type">
                  <Select value={form.b2b_commission_type} onValueChange={(v)=>set("b2b_commission_type", v as "fixed" | "percentage")}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.b2b_commission_type === "percentage" ? (
                  <>
                    <Field label="B2B Commission %"><Input type="number" step="0.001" value={form.b2b_commission_percentage} onChange={(e)=>setNum("b2b_commission_percentage", e.target.value)}/></Field>
                    <Field label="B2B Commission Amount (auto)"><Input readOnly tabIndex={-1} value={fmtPKR(b2bAmount)} className="bg-muted/50"/></Field>
                  </>
                ) : (
                  <Field label="B2B Commission (PKR)"><Input type="number" step="0.01" value={form.b2b_commission} onChange={(e)=>setNum("b2b_commission", e.target.value)}/></Field>
                )}
                <p className="sm:col-span-3 text-xs text-muted-foreground">
                  Tax deduction on this B2B commission is handled by the Accountant in Accounts → B2B Commission.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent><Textarea rows={3} value={form.notes} onChange={(e)=>set("notes", e.target.value)} placeholder="Internal notes"/></CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={()=>nav({ to: "/deals" })}>Cancel</Button>
            <Button onClick={submit}>Create Deal</Button>
          </div>
        </div>

        {canSeeLiveCalc && !perIns && (

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Live Calculations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row k="Gross Premium" v={fmtPKR(calc.gross_premium)} />
                <Row k="Net Premium (manual)" v={fmtPKR(calc.net_premium)} />
                <Row k="Commission Before Tax" v={fmtPKR(calc.commission_before_tax)} />
                <Row k="Commission Tax (17%)" v={fmtPKR(calc.commission_tax)} />
                <Row k="Commission After Tax" v={fmtPKR(calc.commission_after_tax)} />
                <Row k="Marketing Before Tax" v={fmtPKR(calc.marketing_before_tax)} />
                <Row k="Marketing Tax (9%)" v={fmtPKR(calc.marketing_tax)} />
                <Row k="Marketing After Tax" v={fmtPKR(calc.marketing_after_tax)} />
                <hr className="my-2"/>
                <Row k="Total Income (Comm. + Mktg + Loading − B2B)" v={fmtPKR(calc.total_income)} strong />
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
