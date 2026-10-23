import { describe, expect, it } from "vitest";
import { parseRefundSheet } from "./refunds";

const H = ["Name", "Policy No.", "Agent Name", "Premium", "DO Name", "Refunded"];

describe("parseRefundSheet", () => {
  it("rejects non-numeric premium", () => {
    expect(parseRefundSheet([H, ["A", "P1", "", "abc", "", ""]], [])[0].errors).toContain("Premium must be a valid number");
  });
  it("flags duplicates within the upload", () => {
    const r = parseRefundSheet([H, ["A", "P1", "", 10, "", ""], ["B", " p1 ", "", 10, "", ""]], []);
    expect(r[0].errors).toEqual([]);
    expect(r[1].errors[0]).toMatch(/Duplicate/);
  });
  it("flags policies that already exist", () => {
    expect(parseRefundSheet([H, ["A", "P9", "", 10, "", ""]], ["p9"])[0].errors).toContain("Policy No. already exists in refunds");
  });
});
