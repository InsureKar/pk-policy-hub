import { useRef } from "react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtPKR } from "@/lib/format";
import { toast } from "sonner";

export type TravelPolicyRow = {
  travel_agent: string;
  date_issued: string;
  policy_number: string;
  premium: number;
  commission_percentage: number;
  agent_name: string;
  remarks: string;
};

export type TravelTransferRow = {
  transfer_date: string;
  bank_name: string;
  amount: number;
  tid: string;
  agent: string;
};

export const emptyTravelRow = (): TravelPolicyRow => ({
  travel_agent: "", date_issued: "", policy_number: "", premium: 0,
  commission_percentage: 0, agent_name: "", remarks: "",
});
export const emptyTransferRow = (): TravelTransferRow => ({
  transfer_date: "", bank_name: "", amount: 0, tid: "", agent: "",
});

export const payableOf = (r: TravelPolicyRow) =>
  Number(r.premium || 0) - (Number(r.premium || 0) * Number(r.commission_percentage || 0)) / 100;

const clampPct = (v: number) => Math.min(45, Math.max(0, Number(v) || 0));

const norm = (v: any) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const num = (v: any) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[(),\s]/g, "").replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

const toDate = (v: any): string => {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export function TravelBulkPolicies({
  rows, setRows, transfers, setTransfers, dupErrors, onCheckDuplicate,
}: {
  rows: TravelPolicyRow[];
  setRows: (r: TravelPolicyRow[]) => void;
  transfers: TravelTransferRow[];
  setTransfers: (t: TravelTransferRow[]) => void;
  dupErrors?: Record<number, string>;
  onCheckDuplicate?: (index: number, value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const totalPremium = rows.reduce((a, r) => a + Number(r.premium || 0), 0);
  const totalCommission = rows.reduce((a, r) => a + (Number(r.premium || 0) * Number(r.commission_percentage || 0)) / 100, 0);
  const totalPayable = rows.reduce((a, r) => a + payableOf(r), 0);
  const totalTransfers = transfers.reduce((a, t) => a + Number(t.amount || 0), 0);
  const diff = Number((totalTransfers - totalPayable).toFixed(2));
  const matchStatus = transfers.length === 0 ? "pending" : diff === 0 ? "matched" : diff > 0 ? "excess" : "short";
  const matchCls: Record<string, string> = {
    matched: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    excess: "bg-red-500/15 text-red-600 border-red-500/30",
    short: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    pending: "bg-muted text-muted-foreground",
  };

  const update = (i: number, patch: Partial<TravelPolicyRow>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateT = (i: number, patch: Partial<TravelTransferRow>) =>
    setTransfers(transfers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const onUpload = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const mapped: TravelPolicyRow[] = [];
      for (const raw of json) {
        const policy = String(pick(raw, ["policyno", "policynumber", "policy"]) ?? "").trim();
        const premium = Number(String(pick(raw, ["premium"]) ?? 0).toString().replace(/[^0-9.-]/g, "")) || 0;
        if (!policy && !premium) continue;
        mapped.push({
          travel_agent: String(pick(raw, ["travelagent", "agentcompany"]) ?? "").trim(),
          date_issued: toDate(pick(raw, ["dateofissued", "dateissued", "issuedate", "date"])),
          policy_number: policy,
          premium,
          commission_percentage: clampPct(Number(String(pick(raw, ["commission", "comm"]) ?? 0).toString().replace(/[^0-9.-]/g, "")) || 0),
          agent_name: String(pick(raw, ["agentname", "agents", "agent"]) ?? "").trim(),
          remarks: String(pick(raw, ["remarks", "notes"]) ?? "").trim(),
        });
      }
      if (mapped.length === 0) return toast.error("No travel policy rows found in that sheet");
      setRows(mapped);
      toast.success(`Imported ${mapped.length} policy rows from the travel sheet`);
    } catch (e: any) {
      toast.error("Could not read that file: " + (e?.message ?? "unknown error"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Travel Bulk Policies</CardTitle>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>Bulk Policy Upload</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left p-3 whitespace-nowrap">Sr. No</th>
                <th className="text-left p-3 whitespace-nowrap">Travel Agent</th>
                <th className="text-left p-3 whitespace-nowrap">Date of Issued</th>
                <th className="text-left p-3 whitespace-nowrap">Policy No.</th>
                <th className="text-right p-3 whitespace-nowrap">Premium</th>
                <th className="text-right p-3 whitespace-nowrap">Commission %</th>
                <th className="text-right p-3 whitespace-nowrap">Payable to Insurance Co.</th>
                <th className="text-left p-3 whitespace-nowrap">Agent Name</th>
                <th className="text-left p-3 whitespace-nowrap">Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-3 pt-5 align-top">{i + 1}</td>
                  <td className="p-3 align-top"><Input className="h-10" value={r.travel_agent} onChange={(e) => update(i, { travel_agent: e.target.value })}/></td>
                  <td className="p-3 align-top"><Input type="date" className="h-10" value={r.date_issued} onChange={(e) => update(i, { date_issued: e.target.value })}/></td>
                  <td className="p-3 align-top">
                    <Input
                      className={`h-10 ${dupErrors?.[i] ? "border-destructive" : ""}`}
                      aria-invalid={!!dupErrors?.[i]}
                      value={r.policy_number}
                      onChange={(e) => update(i, { policy_number: e.target.value })}
                      onBlur={(e) => onCheckDuplicate?.(i, e.target.value)}
                    />
                    {dupErrors?.[i] && <p className="text-xs text-destructive mt-1.5">{dupErrors[i]}</p>}
                  </td>
                  <td className="p-3 align-top"><Input type="number" step="0.01" min="0" className="h-10 text-right" value={r.premium} onChange={(e) => update(i, { premium: Number(e.target.value) || 0 })}/></td>
                  <td className="p-3 align-top">
                    <Input type="number" step="0.01" min="0" max="45" className="h-10 text-right" value={r.commission_percentage}
                      onChange={(e) => update(i, { commission_percentage: Number(e.target.value) || 0 })}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v < 0 || v > 45) toast.error("Commission must be between 0% and 45%");
                        update(i, { commission_percentage: clampPct(v) });
                      }}/>
                  </td>
                  <td className="p-3 pt-5 text-right tabular-nums align-top">{fmtPKR(payableOf(r))}</td>
                  <td className="p-3 align-top"><Input className="h-10" value={r.agent_name} onChange={(e) => update(i, { agent_name: e.target.value })}/></td>
                  <td className="p-3 align-top"><Input className="h-10" value={r.remarks} onChange={(e) => update(i, { remarks: e.target.value })}/></td>
                  <td className="p-3 pt-4 align-top"><Button size="sm" variant="ghost" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>×</Button></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t font-medium">
              <tr>
                <td className="p-3" colSpan={4}>Totals ({rows.length})</td>
                <td className="p-3 text-right tabular-nums">{fmtPKR(totalPremium)}</td>
                <td className="p-3 text-right tabular-nums">{fmtPKR(totalCommission)}</td>
                <td className="p-3 text-right tabular-nums">{fmtPKR(totalPayable)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <Button variant="outline" onClick={() => setRows([...rows, emptyTravelRow()])}>+ Add Row</Button>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between pt-2">
            <h4 className="text-base font-medium">Amount Transfer Details</h4>
            <Badge variant="outline" className={matchCls[matchStatus]}>{matchStatus.toUpperCase()}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left p-3 whitespace-nowrap">Sr. No</th>
                  <th className="text-left p-3 whitespace-nowrap">Date</th>
                  <th className="text-left p-3 whitespace-nowrap">Bank Name</th>
                  <th className="text-right p-3 whitespace-nowrap">Amount</th>
                  <th className="text-left p-3 whitespace-nowrap">TID</th>
                  <th className="text-left p-3 whitespace-nowrap">Agent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3"><Input type="date" className="h-10" value={t.transfer_date} onChange={(e) => updateT(i, { transfer_date: e.target.value })}/></td>
                    <td className="p-3"><Input className="h-10" value={t.bank_name} onChange={(e) => updateT(i, { bank_name: e.target.value })}/></td>
                    <td className="p-3"><Input type="number" step="0.01" min="0" className="h-10 text-right" value={t.amount} onChange={(e) => updateT(i, { amount: Number(e.target.value) || 0 })}/></td>
                    <td className="p-3"><Input className="h-10" value={t.tid} onChange={(e) => updateT(i, { tid: e.target.value })}/></td>
                    <td className="p-3"><Input className="h-10" value={t.agent} onChange={(e) => updateT(i, { agent: e.target.value })}/></td>
                    <td className="p-3"><Button size="sm" variant="ghost" onClick={() => setTransfers(transfers.filter((_, idx) => idx !== i))}>×</Button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t font-medium">
                <tr>
                  <td className="p-3" colSpan={3}>Total Transferred</td>
                  <td className="p-3 text-right tabular-nums">{fmtPKR(totalTransfers)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setTransfers([...transfers, emptyTransferRow()])}>+ Add Transfer</Button>
            <p className="text-sm">
              {matchStatus === "matched" && <span className="text-emerald-600">Transfers match Payable to Insurance Company ✓</span>}
              {matchStatus === "excess" && <span className="text-red-600">Excess by {fmtPKR(diff)}</span>}
              {matchStatus === "short" && <span className="text-amber-600">Short by {fmtPKR(-diff)}</span>}
              {matchStatus === "pending" && <span className="text-muted-foreground">Add transfers totalling {fmtPKR(totalPayable)}</span>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
