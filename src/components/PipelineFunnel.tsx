import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPKR } from "@/lib/format";
import { calculateDealFinancials } from "@/lib/calc";
import { useVisibilityScope, isVisibleRow } from "@/lib/visibility";
import { Circle } from "lucide-react";

type Props = {
  defaultFrom?: string;
  defaultTo?: string;
  lockUserId?: string;
  title?: string;
};

type Mode = "month" | "quarter" | "year";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: new Date(2000, i, 1).toLocaleString("en-US", { month: "long" }),
}));

const QUARTERS = [
  { value: "1", label: "Q1 (Jan – Mar)", start: 0, end: 2 },
  { value: "2", label: "Q2 (Apr – Jun)", start: 3, end: 5 },
  { value: "3", label: "Q3 (Jul – Sep)", start: 6, end: 8 },
  { value: "4", label: "Q4 (Oct – Dec)", start: 9, end: 11 },
];

function rangeFor(mode: Mode, year: number, month: number, quarter: string) {
  let startM = 0;
  let endM = 11;
  if (mode === "month") { startM = month; endM = month; }
  else if (mode === "quarter") {
    const q = QUARTERS.find((x) => x.value === quarter)!;
    startM = q.start; endM = q.end;
  } else if (mode === "year" && month >= 0) { startM = month; endM = month; }
  const start = new Date(year, startM, 1);
  const end = new Date(year, endM + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function PipelineFunnel({ lockUserId, title }: Props) {
  const scope = useVisibilityScope();
  const now = new Date();
  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 4 + i);

  const [modeDraft, setModeDraft] = useState<Mode>("year");
  const [yearDraft, setYearDraft] = useState<number>(now.getFullYear());
  const [monthDraft, setMonthDraft] = useState<number>(now.getMonth());
  const [yearMonthDraft, setYearMonthDraft] = useState<string>("all"); // month picker inside year mode
  const [quarterDraft, setQuarterDraft] = useState<string>(String(Math.floor(now.getMonth() / 3) + 1));
  const [userDraft, setUserDraft] = useState<string>(lockUserId ?? "all");

  const [applied, setApplied] = useState({
    mode: "year" as Mode,
    year: now.getFullYear(),
    month: -1,
    quarter: String(Math.floor(now.getMonth() / 3) + 1),
    userId: lockUserId ?? "all",
  });

  const { data } = useQuery({
    queryKey: ["pipeline-funnel"],
    queryFn: async () => {
      const [deals, stages, profiles, inst] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, stage_id, assigned_do_id, team_lead_id, created_at, deal_type, payment_schedule, base_percentage"),
        supabase.from("deal_stages").select("id, name, sort_order, is_won, is_lost").order("sort_order"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("deal_installments" as any).select("deal_id, amount, gross_premium, net_premium, commission_percentage, marketing_budget, loading, b2b_commission, paid_amount, paid_date, payment_receive_date, due_date, payment_status"),
      ]);
      return {
        deals: deals.data ?? [],
        stages: stages.data ?? [],
        profiles: profiles.data ?? [],
        installments: (inst.data ?? []) as any[],
      };
    },

  });

  const visibleProfiles = useMemo(
    () => (data?.profiles ?? []).filter((p: any) => scope.all || scope.ids.includes(p.id)),
    [data, scope.all, scope.ids],
  );

  const range = useMemo(
    () => rangeFor(applied.mode, applied.year, applied.month, applied.quarter),
    [applied],
  );

  /** Custom ("set your own plan") deals are reported per instalment. */
  const customDealIds = useMemo(
    () => new Set(
      (data?.deals ?? [])
        .filter((d: any) => String(d.payment_schedule ?? "").toLowerCase().startsWith("custom"))
        .map((d: any) => d.id),
    ),
    [data?.deals],
  );

  const baseOf = useMemo(() => {
    const m = new Map<string, number | undefined>();
    for (const d of (data?.deals ?? []) as any[]) m.set(d.id, d.base_percentage ?? undefined);
    return m;
  }, [data?.deals]);

  // Instalment-based deals: only the instalments actually marked paid count as won
  // business; everything still due is reported as Outstanding Premium.
  const insByDeal = useMemo(() => {
    const m = new Map<string, { paid: number; due: number }>();
    for (const r of (data?.installments ?? [])) {
      const e = m.get(r.deal_id) ?? { paid: 0, due: 0 };
      const isPaid = r.payment_status === "paid" || Number(r.paid_amount || 0) > 0;
      const value = Number(r.gross_premium || 0) || Number(r.amount || 0);
      if (isPaid) e.paid += Number(r.paid_amount || 0) || value;
      else e.due += value;
      m.set(r.deal_id, e);
    }
    return m;
  }, [data?.installments]);

  /** The date a paid instalment belongs to — its actual payment date. */
  const paidDateOf = (r: any) => {
    const raw = r.paid_date || r.payment_receive_date || r.due_date;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  /**
   * Custom plans: each paid instalment keeps its own commission and its own
   * Tagged Premium, and is reported in the month of its own payment date.
   */
  const customPaidTagged = useMemo(() => {
    const m = new Map<string, { tagged: number; date: Date | null }[]>();
    for (const r of (data?.installments ?? [])) {
      if (!customDealIds.has(r.deal_id)) continue;
      const isPaid = r.payment_status === "paid" || Number(r.paid_amount || 0) > 0;
      if (!isPaid) continue;
      const gross = Number(r.gross_premium || 0);
      const mktPct = gross > 0 ? (Number(r.marketing_budget || 0) / gross) * 100 : 0;
      const f = calculateDealFinancials({
        gross_premium: gross,
        net_premium: Number(r.net_premium || 0),
        commission_percentage: Number(r.commission_percentage || 0),
        marketing_budget_percentage: mktPct,
        loading: Number(r.loading || 0),
        b2b_commission: Number(r.b2b_commission || 0),
        base_percentage: baseOf.get(r.deal_id),
      });
      const list = m.get(r.deal_id) ?? [];
      list.push({ tagged: f.tagged_premium, date: paidDateOf(r) });
      m.set(r.deal_id, list);
    }
    return m;
  }, [data?.installments, customDealIds, baseOf]);

  /** Tagged Premium of the custom instalments paid inside the selected period. */
  const customWonInRange = (dealId: string) =>
    (customPaidTagged.get(dealId) ?? []).reduce(
      (a, x) => a + (x.date && x.date >= range.start && x.date <= range.end ? x.tagged : 0),
      0,
    );

  const filteredDeals = useMemo(() => {
    return (data?.deals ?? []).filter((d: any) => {
      if (!isVisibleRow(d, scope)) return false;
      const dt = new Date(d.created_at);
      const inPeriod = dt >= range.start && dt <= range.end;
      // Custom plans are also included when one of their instalments was paid
      // inside the selected period, whatever the date the deal was created.
      const paidInPeriod = customDealIds.has(d.id) && customWonInRange(d.id) > 0;
      if (!inPeriod && !paidInPeriod) return false;
      if (applied.userId !== "all") {
        if (!scope.all && !scope.ids.includes(applied.userId)) return false;
        if (d.assigned_do_id !== applied.userId && d.team_lead_id !== applied.userId) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, applied, scope, range, customDealIds, customPaidTagged]);

  const stages = data?.stages ?? [];
  const wonIds = new Set(stages.filter((s: any) => s.is_won).map((s: any) => s.id));
  const lostIds = new Set(stages.filter((s: any) => s.is_lost).map((s: any) => s.id));

  /**
   * Won value of a deal — custom plans report the Tagged Premium of the
   * instalments paid inside the selected period; other instalment deals keep
   * counting their paid amounts, and plain deals their gross premium.
   */
  const wonValue = (d: any) => {
    if (customDealIds.has(d.id)) return customWonInRange(d.id);
    const e = insByDeal.get(d.id);
    return e ? e.paid : Number(d.gross_premium || 0);
  };
  const dueValue = (d: any) => insByDeal.get(d.id)?.due ?? 0;

  const overallTotal = filteredDeals.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);

  const reset = () => {
    const currentYear = now.getFullYear();
    setModeDraft("year");
    setYearDraft(currentYear);
    setYearMonthDraft("all");
    setUserDraft(lockUserId ?? "all");
    setApplied({ mode: "year", year: currentYear, month: -1, quarter: String(Math.floor(now.getMonth() / 3) + 1), userId: lockUserId ?? "all" });
  };

  const apply = () => {
    setApplied({
      mode: modeDraft,
      year: yearDraft,
      month: modeDraft === "month" ? monthDraft : modeDraft === "year" ? (yearMonthDraft === "all" ? -1 : Number(yearMonthDraft)) : -1,
      quarter: quarterDraft,
      userId: userDraft,
    });
  };

  const periodLabel = (() => {
    if (applied.mode === "month") return `${MONTHS[applied.month]?.label} ${applied.year}`;
    if (applied.mode === "quarter") return `${QUARTERS.find((q) => q.value === applied.quarter)?.label} ${applied.year}`;
    return applied.month >= 0 ? `${MONTHS[applied.month].label} ${applied.year}` : `Year ${applied.year}`;
  })();

  const sections: { key: string; label: string; deals: any[] }[] = [
    {
      key: "fresh",
      label: "Fresh",
      deals: filteredDeals.filter((d: any) => d.deal_type === "fresh"),
    },
    {
      key: "renewal",
      label: "Renewal",
      deals: filteredDeals.filter((d: any) => d.deal_type === "renewal"),
    },
    {
      key: "total",
      label: "Total",
      deals: filteredDeals,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <Select value={modeDraft} onValueChange={(v) => setModeDraft(v as Mode)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month Wise</SelectItem>
            <SelectItem value="quarter">Quarter Wise</SelectItem>
            <SelectItem value="year">Year Wise</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(yearDraft)} onValueChange={(v) => setYearDraft(Number(v))}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        {modeDraft === "month" && (
          <Select value={String(monthDraft)} onValueChange={(v) => setMonthDraft(Number(v))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {modeDraft === "quarter" && (
          <Select value={quarterDraft} onValueChange={setQuarterDraft}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {modeDraft === "year" && (
          <Select value={yearMonthDraft} onValueChange={setYearMonthDraft}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All 12 months</SelectItem>
              {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label} {yearDraft}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {!lockUserId && (scope.all || scope.ids.length > 1) && (
          <Select value={userDraft} onValueChange={setUserDraft}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {visibleProfiles.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button onClick={apply}>Apply</Button>
        <Button variant="ghost" onClick={reset}>Reset</Button>
        <span className="ml-auto text-xs font-medium text-muted-foreground">{periodLabel}</span>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {sections.map((sec) => {
          const inProgress = sec.deals.filter((d: any) => d.stage_id && !wonIds.has(d.stage_id) && !lostIds.has(d.stage_id));
          const inProgressTotal = inProgress.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);
          return (
            <div key={sec.key} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Circle className={`h-2 w-2 fill-current ${sec.key === "fresh" ? "text-primary" : sec.key === "renewal" ? "text-brand-orange" : "text-success"}`} />
                <span className="text-sm font-semibold">{sec.label}</span>
                <span className="text-xs text-muted-foreground">{fmtPKR(inProgressTotal)} in progress · {inProgress.length} deals</span>
                {sec.key === "total" && <span className="ml-auto text-xs font-medium text-muted-foreground">{fmtPKR(overallTotal)} · {filteredDeals.length} total deals</span>}
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-max">
                {stages.map((s: any) => {
                  const list = sec.deals.filter((d: any) => d.stage_id === s.id);
                  const total = list.reduce((a: number, d: any) => a + (s.is_won ? wonValue(d) : Number(d.gross_premium || 0)), 0);
                  return (
                    <div
                      key={s.id}
                      className={`min-w-[130px] flex-1 border-r px-3 py-2 last:border-r-0 ${s.is_won ? "bg-success/10" : s.is_lost ? "bg-destructive/5" : ""}`}
                    >
                      <div className="text-xs text-muted-foreground">{s.name}</div>
                      <div className={`mt-2 text-base font-semibold tabular-nums ${s.is_won ? "text-success" : s.is_lost ? "text-destructive" : ""}`}>{fmtPKR(total)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{list.length} deals</div>
                    </div>
                  );
                })}
                {(() => {
                  const list = sec.deals.filter((d: any) => dueValue(d) > 0);
                  const outstanding = list.reduce((a: number, d: any) => a + dueValue(d), 0);
                  return (
                    <div className="min-w-[150px] flex-1 border-l px-3 py-2 bg-warning/5">
                      <div className="text-xs text-muted-foreground">Outstanding Premium</div>
                      <div className="mt-2 text-base font-semibold tabular-nums text-brand-orange">{fmtPKR(outstanding)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{list.length} {list.length === 1 ? "deal" : "deals"} with due instalments</div>
                    </div>
                  );
                })()}
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{sec.key === "fresh" ? "New business currently moving through the pipeline" : sec.key === "renewal" ? "Renewal business currently moving through the pipeline" : "Combined fresh and renewal business"}</div>
            </div>
          );
        })}
        {stages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No pipeline stages configured.</div>
        )}
      </div>
    </div>
  );
}
