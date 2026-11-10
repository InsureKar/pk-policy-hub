import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { canExportDeals, matchesExportPeriod, exportSheet } from "./deal-export";

describe("Admin deals export", () => {
  it("permits Admin only", () => {
    expect(canExportDeals(["admin"])).toBe(true);
    for (const role of ["management", "team_lead", "do"]) expect(canExportDeals([role])).toBe(false);
  });
  it("selects the requested creation month", () => {
    const period = { mode: "month", month: "2026-07", from: "", to: "" } as const;
    expect(matchesExportPeriod("2026-07-31T23:59:59Z", period)).toBe(true);
    expect(matchesExportPeriod("2026-11-01T00:00:00Z", period)).toBe(false);
  });
  it("includes both date-range endpoints and excludes other dates", () => {
    const period = { mode: "dates", month: "", from: "2026-11-01", to: "2026-11-10" } as const;
    expect(matchesExportPeriod("2026-11-01T00:00:00Z", period)).toBe(true);
    expect(matchesExportPeriod("2026-11-10T23:59:59Z", period)).toBe(true);
    expect(matchesExportPeriod("2026-11-11T00:00:00Z", period)).toBe(false);
    expect(matchesExportPeriod("2026-10-31T23:59:59Z", period)).toBe(false);
  });
  it("retains every supplied deal field and stored financial value without recalculation", () => {
    const sheet = exportSheet([{ deal_number: "001024", gross_premium: 181859, tagged_premium: 727434, notes: "=Not a formula", commission_percentage: 15 }]);
    expect(XLSX.utils.sheet_to_json(sheet)).toEqual([{ "Deal Number": "001024", "Gross Premium": 181859, "Tagged Premium": 727434, "Notes": "=Not a formula", "Commission Percentage": 15 }]);
    expect(sheet.D2.t).toBe("s");
    expect(sheet.D2.f).toBeUndefined();
  });
});