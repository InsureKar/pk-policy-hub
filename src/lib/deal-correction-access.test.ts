import { describe, expect, it } from "vitest";
import { canCorrectDealRecords, canEditDealInstalment, dealPlanPeriodLimit } from "./deal-correction-access";

describe("deal record corrections", () => {
  it("preserves the Custom four-instalment limit", () => expect(dealPlanPeriodLimit("Custom")).toBe(4));
  it("preserves the four quarters", () => expect(dealPlanPeriodLimit("Quarterly")).toBe(4));
  it("preserves the two halves", () => expect(dealPlanPeriodLimit("Bi-Annually")).toBe(2));
  it("gives admin full corrections", () => expect(canCorrectDealRecords(["admin"])).toBe(true));
  it("gives management full corrections", () => expect(canCorrectDealRecords(["management"])).toBe(true));
  it("does not expand normal-user or team-lead corrections", () => {
    expect(canCorrectDealRecords(["do"])).toBe(false);
    expect(canCorrectDealRecords(["team_lead"])).toBe(false);
  });
  it("unlocks paid and later periods for managers", () => {
    expect(canEditDealInstalment(true, false, false, 0, 1)).toBe(true);
    expect(canEditDealInstalment(true, true, false, 3, 1)).toBe(true);
  });
  it("preserves ordinary users' next-unpaid lock", () => {
    expect(canEditDealInstalment(false, true, false, 0, 1)).toBe(false);
    expect(canEditDealInstalment(false, true, false, 1, 1)).toBe(true);
    expect(canEditDealInstalment(false, true, false, 2, 1)).toBe(false);
    expect(canEditDealInstalment(false, false, true, 1, 1)).toBe(false);
  });
});