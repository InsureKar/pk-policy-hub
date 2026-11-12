import { describe, expect, it } from "vitest";
import { selectDashboardDeals } from "./dashboard-filter";

describe("dashboard cards share Business Overview filters", () => {
  const deals = [
    { id: "july-do-a", gross_premium: 15000, net_premium: 14000, tagged_premium: 12000, total_income: 1560, stage: "won" },
    { id: "october-do-a", gross_premium: 30000, net_premium: 28000, tagged_premium: 24000, total_income: 3120, stage: "won" },
    { id: "july-do-b", gross_premium: 5000, net_premium: 4000, tagged_premium: 3000, total_income: 390, stage: "lost" },
  ];

  it("uses the applied Month and DO deal set for every card, without changing values", () => {
    const selected = selectDashboardDeals(deals, ["july-do-a"]);
    expect(selected).toEqual([deals[0]]);
    expect(selected[0]).toBe(deals[0]);
    expect(selected.reduce((sum, d) => sum + d.gross_premium, 0)).toBe(15000);
    expect(selected.reduce((sum, d) => sum + d.net_premium, 0)).toBe(14000);
    expect(selected.reduce((sum, d) => sum + d.tagged_premium, 0)).toBe(12000);
    expect(selected.reduce((sum, d) => sum + d.total_income, 0)).toBe(1560);
    expect(selected.length).toBe(1);
    expect(selected.filter((d) => d.stage === "won").length).toBe(1);
    expect(selected.filter((d) => d.stage === "lost").length).toBe(0);
  });

  it("restores all overview-selected deals on reset", () => {
    expect(selectDashboardDeals(deals, deals.map((d) => d.id))).toEqual(deals);
  });

  it("does not expose rows outside the dashboard's existing visibility set", () => {
    expect(selectDashboardDeals([deals[0]], ["july-do-a", "july-do-b"])).toEqual([deals[0]]);
  });

  it("shows no card deals for empty or not-yet-loaded overview results", () => {
    expect(selectDashboardDeals(deals, [])).toEqual([]);
    expect(selectDashboardDeals(deals, null)).toEqual([]);
  });
});