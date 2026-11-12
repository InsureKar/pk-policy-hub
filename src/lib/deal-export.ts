import * as XLSX from "xlsx";

export type ExportPeriod = { mode: "all" | "month" | "dates"; month: string; from: string; to: string };

export function canExportDeals(roles: readonly string[]) {
  return roles.includes("admin");
}

export function matchesExportPeriod(createdAt: string, period: ExportPeriod) {
  const date = createdAt.slice(0, 10);
  if (period.mode === "month") return date.slice(0, 7) === period.month;
  if (period.mode === "dates") return date >= period.from && date <= period.to;
  return true;
}

export function exportSheet(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const header = keys.map(key => key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows.map(row => keys.map(key => {
    const value = row[key];
    if (value == null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  }))]);
  sheet["!cols"] = keys.map(() => ({ wch: 22 }));
  if (rows.length && keys.length) sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: keys.length - 1 } }) };
  return sheet;
}

export function downloadDealWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}