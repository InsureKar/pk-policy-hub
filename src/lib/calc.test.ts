import { describe, it, expect } from "vitest";
import { aggregateDealFinancials, calculateDealFinancials, DEFAULT_BASE_PERCENTAGE } from "./calc";

describe("calculateDealFinancials", () => {
  it("Test Case 1 — standard deal", () => {
    const f = calculateDealFinancials({
      gross_premium: 1_000_000,
      commission_percentage: 10,
      marketing_budget_percentage: 5,
      loading: 10_000,
      b2b_commission: 5_000,
      base_percentage: 13,
    });
    expect(f.commission_before_tax).toBe(100_000);
    expect(f.commission_tax).toBe(17_000);
    expect(f.commission_after_tax).toBe(83_000);
    expect(f.marketing_before_tax).toBe(50_000);
    expect(f.marketing_tax).toBe(4_500);
    expect(f.marketing_after_tax).toBe(45_500);
    expect(f.total_income).toBe(143_500);
    expect(f.income_percentage).toBe(14.35);
    expect(f.tagged_premium_percentage).toBeCloseTo(110.384615, 5);
    expect(f.tagged_premium).toBe(1_000_000); // >= 100% → gross premium
    expect(f.net_premium).toBe(900_000);
  });

  it("Test Case 2 — tagged premium below 100%", () => {
    const f = calculateDealFinancials({
      gross_premium: 1_000_000,
      commission_percentage: 12.048192771084337, // → 100,000 total income
      marketing_budget_percentage: 0,
      loading: 0,
      b2b_commission: 0,
      base_percentage: 13,
    });
    expect(f.total_income).toBe(100_000);
    expect(f.income_percentage).toBeCloseTo(10, 6);
    expect(f.tagged_premium_percentage).toBeCloseTo(76.923077, 5);
    expect(f.tagged_premium).toBeCloseTo(769_230.77, 2);
  });

  it("Test Case 3 — zero premium, no division by zero", () => {
    const f = calculateDealFinancials({ gross_premium: 0, commission_percentage: 10 });
    expect(f.income_percentage).toBe(0);
    expect(f.tagged_premium_percentage).toBe(0);
    expect(f.tagged_premium).toBe(0);
    expect(f.total_income).toBe(0);
  });

  it("handles null / missing / invalid values", () => {
    const f = calculateDealFinancials({
      gross_premium: null,
      commission_percentage: null,
      marketing_budget_percentage: undefined,
      loading: null,
      b2b_commission: "abc" as unknown as number,
      base_percentage: 0,
    });
    expect(f.base_percentage).toBe(DEFAULT_BASE_PERCENTAGE);
    expect(f.total_income).toBe(0);
    expect(f.tagged_premium).toBe(0);
  });

  it("accepts numeric strings from the database", () => {
    const f = calculateDealFinancials({
      gross_premium: "1000000",
      commission_percentage: "10",
      marketing_budget_percentage: "5",
      loading: "10000",
      b2b_commission: "5000",
      base_percentage: "13",
    });
    expect(f.total_income).toBe(143_500);
  });

  it("tagged premium exactly at 100% returns gross premium", () => {
    const f = calculateDealFinancials({
      gross_premium: 1_000_000,
      commission_percentage: 0,
      marketing_budget_percentage: 0,
      loading: 130_000, // income% = 13 → tagged% = 100
      b2b_commission: 0,
      base_percentage: 13,
    });
    expect(f.tagged_premium_percentage).toBe(100);
    expect(f.tagged_premium).toBe(1_000_000);
  });

  it("adds (never subtracts) loading and B2B commission", () => {
    const base = { gross_premium: 500_000, commission_percentage: 10, marketing_budget_percentage: 5 };
    const without = calculateDealFinancials(base);
    const with_ = calculateDealFinancials({ ...base, loading: 1_000, b2b_commission: 2_000 });
    expect(with_.total_income).toBe(without.total_income + 3_000);
  });

  it("supports decimal percentages, small and very large premiums", () => {
    const small = calculateDealFinancials({ gross_premium: 100, commission_percentage: 12.375 });
    expect(small.commission_before_tax).toBe(12.38);
    expect(small.commission_after_tax).toBe(10.27);

    const large = calculateDealFinancials({ gross_premium: 5_000_000_000, commission_percentage: 7.5 });
    expect(large.commission_before_tax).toBe(375_000_000);
    expect(large.commission_after_tax).toBe(311_250_000);
  });

  it("uses the default base percentage when none is supplied", () => {
    const f = calculateDealFinancials({ gross_premium: 1_000_000, commission_percentage: 10 });
    expect(f.base_percentage).toBe(13);
  });
});

describe("aggregateDealFinancials (bulk & travel policies, dashboards, exports)", () => {
  it("sums bulk policy rows through the same engine", () => {
    const rows = [
      { gross_premium: 400_000, commission_percentage: 10, marketing_budget_percentage: 5, loading: 4_000, b2b_commission: 2_000 },
      { gross_premium: 600_000, commission_percentage: 10, marketing_budget_percentage: 5, loading: 6_000, b2b_commission: 3_000 },
    ];
    const agg = aggregateDealFinancials(rows, 13);
    const single = calculateDealFinancials({
      gross_premium: 1_000_000, commission_percentage: 10, marketing_budget_percentage: 5,
      loading: 10_000, b2b_commission: 5_000, base_percentage: 13,
    });
    expect(agg.gross_premium).toBe(single.gross_premium);
    expect(agg.total_income).toBe(single.total_income);
    expect(agg.income_percentage).toBeCloseTo(single.income_percentage, 6);
    expect(agg.tagged_premium_percentage).toBeCloseTo(single.tagged_premium_percentage, 6);
  });

  it("returns zeroes for an empty set", () => {
    const agg = aggregateDealFinancials([], 13);
    expect(agg.total_income).toBe(0);
    expect(agg.income_percentage).toBe(0);
    expect(agg.tagged_premium).toBe(0);
  });
});
