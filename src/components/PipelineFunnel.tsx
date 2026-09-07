import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPKR } from "@/lib/format";
import { useVisibilityScope, isVisibleRow } from "@/lib/visibility";

type Props = {
  defaultFrom?: string;
  defaultTo?: string;
  lockUserId?: string;
  title?: string;
};

const STAGE_COLORS: Record<string, string> = {
  created: "#c8d34a",
  "follow up": "#c76ac9",
  qualified: "#f2c6de",
  negotiation: "#e8a33d",
  approval: "#8a7f78",
  won: "#2dbf9a",
  lost: "#9aa0a6",
};

const stageColor = (name: string) =>
  STAGE_COLORS[name.trim().toLowerCase()] ?? "hsl(var(--muted-foreground))";

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
      const [deals, stages, profiles] = await Promise.all([
        supabase.from("deals").select("id, gross_premium, stage_id, assigned_do_id, team_lead_id, created_at, deal_type"),
        supabase.from("deal_stages").select("id, name, sort_order, is_won, is_lost").order("sort_order"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        deals: deals.data ?? [],
        stages: stages.data ?? [],
        profiles: profiles.data ?? [],
      };
    },
  });

  const visibleProfiles = useMemo(
    () => (data?.profiles ?? []).filter((p: any) => scope.all || scope.ids.includes(p.id)),
    [data, scope.all, scope.ids],
  );

  const filteredDeals = useMemo(() => {
    const { start, end } = rangeFor(applied.mode, applied.year, applied.month, applied.quarter);
    return (data?.deals ?? []).filter((d: any) => {
      if (!isVisibleRow(d, scope)) return false;
      const dt = new Date(d.created_at);
      if (dt < start || dt > end) return false;
      if (applied.userId !== "all") {
        if (!scope.all && !scope.ids.includes(applied.userId)) return false;
        if (d.assigned_do_id !== applied.userId && d.team_lead_id !== applied.userId) return false;
      }
      return true;
    });
  }, [data, applied, scope]);

  const stages = data?.stages ?? [];
  const wonIds = new Set(stages.filter((s: any) => s.is_won).map((s: any) => s.id));
  const lostIds = new Set(stages.filter((s: any) => s.is_lost).map((s: any) => s.id));

  const overallTotal = filteredDeals.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);

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
    <div className="rounded-lg border bg-card">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 border-b">
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
        <Button variant="outline" onClick={apply}>Apply</Button>
        <span className="text-sm text-muted-foreground">{periodLabel}</span>
        <Link to="/master" search={{ tab: "pipeline" }} className="ml-auto">
          <Button variant="outline" size="sm">Setup pipelines</Button>
        </Link>
      </div>


      {title && <div className="px-4 pt-3 text-sm font-medium">{title}</div>}

      {/* Overall total */}
      <div className="text-center pt-4">
        <span className="text-xl font-semibold tabular-nums">{fmtPKR(overallTotal)}</span>
        <span className="text-muted-foreground ml-2 text-sm">· {filteredDeals.length} deals</span>
      </div>

      {/* Sections */}
      <div className="p-4 space-y-8 overflow-x-auto">
        {sections.map((sec) => {
          const inProgress = sec.deals.filter((d: any) => d.stage_id && !wonIds.has(d.stage_id) && !lostIds.has(d.stage_id));
          const inProgressTotal = inProgress.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);
          return (
            <div key={sec.key}>
              <div className="text-center mb-2">
                <span className="text-primary font-semibold">{sec.label}</span>
                <span className="text-sm ml-3 tabular-nums font-medium">{fmtPKR(inProgressTotal)}</span>
                <span className="text-sm text-muted-foreground ml-2">· {inProgress.length} deals in progress</span>
              </div>
              <div className="flex gap-0 min-w-max">
                {stages.map((s: any, idx: number) => {
                  const list = sec.deals.filter((d: any) => d.stage_id === s.id);
                  const total = list.reduce((a: number, d: any) => a + Number(d.gross_premium || 0), 0);
                  const color = stageColor(s.name);
                  const isFirst = idx === 0;
                  const isLast = idx === stages.length - 1;
                  const clip = isFirst
                    ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                    : isLast
                    ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)"
                    : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)";
                  return (
                    <div
                      key={s.id}
                      className="relative flex-1 min-w-[130px] px-4 py-3 bg-card"
                      style={{ clipPath: clip, marginLeft: isFirst ? 0 : -12, boxShadow: "inset 0 0 0 1px var(--border)" }}
                    >
                      <div className="text-xs text-muted-foreground text-center">{s.name}</div>
                      <div className="text-base font-semibold text-center tabular-nums mt-1">{fmtPKR(total)}</div>
                      <div className="text-xs text-muted-foreground text-center mt-0.5">{list.length} deals</div>
                      <div className="h-1 mt-2 rounded-full" style={{ background: color }} />
                    </div>
                  );
                })}
              </div>
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
