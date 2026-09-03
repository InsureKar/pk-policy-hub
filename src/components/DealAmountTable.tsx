import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmtPKR, fmtDate } from "@/lib/format";
import { Download } from "lucide-react";

export interface AmountColumn {
  key: string;
  label: string;
  value: (row: any) => number;
}

/**
 * Read-only breakdown of existing deal-level financial values.
 * Values are taken as-is from the stored deal/tax records — no new formulas.
 */
export function DealAmountTable({
  rows,
  columns,
  clientOf,
  title,
  emptyLabel = "No records",
}: {
  rows: any[];
  columns: AmountColumn[];
  clientOf: (row: any) => string;
  title: string;
  emptyLabel?: string;
}) {
  const totals = columns.map((c) => rows.reduce((a, r) => a + Number(c.value(r) || 0), 0));

  const exportCsv = () => {
    const head = ["Deal", "Client", "Policy", ...columns.map((c) => c.label), "Date"];
    const body = rows.map((r) => [
      r.deal_number ?? "",
      clientOf(r),
      r.policy_number ?? "",
      ...columns.map((c) => c.value(r)),
      r.created_at ? String(r.created_at).slice(0, 10) : "",
    ]);
    const csv = [head, ...body]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4">
          <div className="text-sm font-medium">{title}</div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Policy</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.key} className="text-right">{c.label}</TableHead>
                ))}
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 4} className="text-center text-muted-foreground py-8">
                    {emptyLabel}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.deal_number ?? "—"}</TableCell>
                  <TableCell>{clientOf(r) || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.policy_number ?? "—"}</TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="text-right tabular-nums">{fmtPKR(c.value(r))}</TableCell>
                  ))}
                  <TableCell>{r.created_at ? fmtDate(String(r.created_at).slice(0, 10)) : "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={3}>Total</TableCell>
                  {totals.map((t, i) => (
                    <TableCell key={i} className="text-right tabular-nums">{fmtPKR(t)}</TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
