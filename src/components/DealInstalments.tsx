import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateField } from "@/components/DateField";
import { MoneyInput } from "@/components/MoneyInput";
import { fmtPKR, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import B2BTakerField from "@/components/B2BTakerField";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** How many instalments each payment mode produces. */
export function instalmentCount(schedule?: string | null): number {
  const s = (schedule ?? "").toLowerCase();
  if (s.startsWith("month")) return 12;
  if (s.startsWith("quarter")) return 4;
  if (s.startsWith("bi-annual") || s.startsWith("bi annual") || s.startsWith("half")) return 2;
  return 0;
}

export function instalmentLabels(n: number): string[] {
  if (n === 4) return ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];
  if (n === 2) return ["1st Half", "2nd Half"];
  if (n === 12) return MONTH_NAMES.map((m) => `Month ${m}`);
  return ["Full Payment"];
}

/** Even split with the rounding difference absorbed by the last row. */
function splitEvenly(total: number, count: number): number[] {
  if (!count) return [];
  const per = Math.round((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? Math.round((total - per * (count - 1)) * 100) / 100 : per);
}

interface Row {
  installment_number: number;
  label: string;
  due_date: string;
  amount: number;
  paid_date: string;
  paid_amount: number;
  b2b_taker_name?: string;
}

/**
 * Instalment schedule for Quarterly / Bi-Annually / Monthly payment modes.
 * Due dates and amounts derive from the policy start date and premium; the
 * user records Paid Date and Paid Amount manually. For Quarterly and
 * Bi-Annually an extra Underwritten Premium tab splits the underwritten
 * business across the periods; each period's tagged amount is shown next to
 * the amount due and is tagged to the month the payment was actually paid.
 */
export function DealInstalments({
  dealId, schedule, startDate, netPremium, underwrittenPremium, canEdit = true,
}: {
  dealId: string;
  schedule?: string | null;
  startDate?: string | null;
  netPremium: number;
  underwrittenPremium?: number | null;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const count = instalmentCount(schedule);
  const showUnderwriting = count === 4 || count === 2;

  const { data: saved } = useQuery({
    queryKey: ["deal-installments", dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_installments" as any)
        .select("*").eq("deal_id", dealId).order("installment_number");
      return (data ?? []) as any[];
    },
    enabled: !!dealId && count > 0,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [uw, setUw] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setUw(Number(underwrittenPremium ?? 0)); }, [underwrittenPremium]);

  // Build the schedule: saved values win, otherwise derive from the policy.
  useEffect(() => {
    if (!count) { setRows([]); return; }
    const labels = instalmentLabels(count);
    const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    const step = 12 / count;
    // Quarterly / Bi-Annually: the underwritten premium is what falls due each period.
    const amounts = splitEvenly(Math.max(0, showUnderwriting ? uw : netPremium), count);
    setRows(Array.from({ length: count }, (_, i) => {
      const s = (saved ?? []).find((r) => r.installment_number === i + 1);
      const due = new Date(start);
      due.setMonth(due.getMonth() + Math.round(i * step));
      return {
        installment_number: i + 1,
        label: labels[i],
        due_date: s?.due_date ?? due.toISOString().slice(0, 10),
        amount: showUnderwriting ? amounts[i] : s ? Number(s.amount) : amounts[i],
        paid_date: s?.paid_date ?? "",
        paid_amount: s ? Number(s.paid_amount) : 0,
        b2b_taker_name: s?.b2b_taker_name ?? "",
      };
    }));
  }, [count, startDate, netPremium, saved, uw, showUnderwriting]);

  // Underwritten business split evenly across the periods (tagged amounts).
  const tagged = useMemo(() => splitEvenly(Math.max(0, uw), count || 1), [uw, count]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Once a paid amount is recorded the period is settled, so nothing remains due.
  const dueOf = (r: Row) => (showUnderwriting && r.paid_amount > 0 ? 0 : r.amount);

  if (!count) return null;

  const totalDue = rows.reduce((a, r) => a + dueOf(r), 0);
  const totalPaid = rows.reduce((a, r) => a + r.paid_amount, 0);

  const save = async () => {
    setSaving(true);
    const payload = rows.map((r, i) => {
      const paid = r.paid_date ? new Date(`${r.paid_date}T00:00:00`) : null;
      return {
        deal_id: dealId,
        installment_number: r.installment_number,
        label: r.label,
        due_date: r.due_date || null,
        amount: dueOf(r),
        paid_date: r.paid_date || null,
        paid_amount: r.paid_amount,
        b2b_taker_name: r.b2b_taker_name?.trim() || null,
        underwritten_amount: showUnderwriting ? tagged[i] ?? 0 : 0,
        // A paid instalment is tagged to the month the payment was received.
        tagged_month: paid ? paid.getMonth() + 1 : null,
        tagged_year: paid ? paid.getFullYear() : null,
      };
    });
    const { error } = await supabase
      .from("deal_installments" as any)
      .upsert(payload as any, { onConflict: "deal_id,installment_number" });
    if (!error && showUnderwriting) {
      await supabase.from("deals").update({ underwritten_premium: uw } as any).eq("id", dealId);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Instalment schedule saved");
    qc.invalidateQueries({ queryKey: ["deal-installments", dealId] });
    qc.invalidateQueries({ queryKey: ["deal", dealId] });
  };

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="text-left p-2">Instalment</th>
            <th className="text-left p-2">Due Date</th>
            <th className="text-right p-2">Amount Due</th>
            
            <th className="text-left p-2">Paid Date</th>
            <th className="text-right p-2">Paid Amount</th>
            <th className="text-left p-2">B2B Taker Name</th>
            <th className="text-left p-2">Tagged Month</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const paid = r.paid_date ? new Date(`${r.paid_date}T00:00:00`) : null;
            return (
              <tr key={r.installment_number} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{r.label}</td>
                <td className="p-2">{fmtDate(r.due_date)}</td>
                <td className="p-2 text-right tabular-nums">
                  {fmtPKR(dueOf(r))} <span className="text-xs text-muted-foreground">(auto)</span>
                </td>
                <td className="p-2 min-w-[170px]">
                  <DateField value={r.paid_date} onChange={(v) => setRow(i, { paid_date: v })}
                    disabled={!canEdit} placeholder="Paid date" />
                </td>
                <td className="p-2 min-w-[150px]">
                  <MoneyInput value={r.paid_amount} onChange={(v) => setRow(i, { paid_amount: v })}
                    disabled={!canEdit} showWords={false} />
                </td>
                <td className="p-2 min-w-[180px]">
                  {canEdit ? (
                    <B2BTakerField
                      value={r.b2b_taker_name ?? ""}
                      onChange={(v) => setRow(i, { b2b_taker_name: v })}
                    />
                  ) : (
                    <span className="text-muted-foreground">{r.b2b_taker_name || "—"}</span>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap text-muted-foreground">
                  {paid ? `${MONTH_NAMES[paid.getMonth()]} ${paid.getFullYear()}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t font-medium">
          <tr>
            <td className="p-2" colSpan={2}>Total</td>
            <td className="p-2 text-right tabular-nums">{fmtPKR(totalDue)}</td>
            
            <td className="p-2" />
            <td className="p-2 text-right tabular-nums">{fmtPKR(totalPaid)}</td>
            <td className="p-2" />
            <td className="p-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Instalment Schedule — {schedule}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showUnderwriting ? (
          <Tabs defaultValue="schedule">
            <TabsList>
              <TabsTrigger value="schedule">Instalments</TabsTrigger>
              <TabsTrigger value="underwritten">Underwritten Premium</TabsTrigger>
            </TabsList>
            <TabsContent value="schedule" className="pt-3">{table}</TabsContent>
            <TabsContent value="underwritten" className="pt-3 space-y-3">
              <div className="max-w-xs">
                <p className="text-sm mb-1">Underwritten Business</p>
                <MoneyInput value={uw} onChange={setUw} disabled={!canEdit} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Period</th>
                      <th className="text-right p-2">Underwritten Share</th>
                      <th className="text-left p-2">Tagged Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const paid = r.paid_date ? new Date(`${r.paid_date}T00:00:00`) : null;
                      return (
                        <tr key={r.installment_number} className="border-t">
                          <td className="p-2">{r.label}</td>
                          <td className="p-2 text-right tabular-nums">{fmtPKR(tagged[i] ?? 0)}</td>
                          <td className="p-2 text-muted-foreground">
                            {paid ? `${MONTH_NAMES[paid.getMonth()]} ${paid.getFullYear()}` : "Not paid yet"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                The underwritten business is split evenly across the {count} periods. Once a period's
                payment is recorded with a paid date, its share is tagged to that month.
              </p>
            </TabsContent>
          </Tabs>
        ) : table}
        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Instalments"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
