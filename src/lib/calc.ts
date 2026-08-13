/**
 * CENTRALIZED FINANCIAL CALCULATION ENGINE — SINGLE SOURCE OF TRUTH
 *
 * Every module (deals, dashboard, pipeline, accounts, reports, analytics,
 * operations, exports, bulk & travel policies) MUST use calculateDealFinancials().
 * Never recreate these formulas anywhere else.
 *
 * Mirrors the database generated columns on public.deals exactly.
 */

/** Tax deducted from commission (17%). */
export const COMMISSION_TAX_RATE = 0.17;
/** Tax deducted from marketing budget (9%). */
export const MARKETING_TAX_RATE = 0.09;
/** Fallback base percentage when the configurable app setting is unavailable. */
export const DEFAULT_BASE_PERCENTAGE = 13;

export interface DealFinancialInputs {
  gross_premium?: number | string | null;
  commission_percentage?: number | string | null;
  marketing_budget_percentage?: number | string | null;
  loading?: number | string | null;
  b2b_commission?: number | string | null;
  /** Configurable base percentage (default 13). */
  base_percentage?: number | string | null;
}

export interface DealFinancials {
  gross_premium: number;
  commission_percentage: number;
  marketing_budget_percentage: number;
  loading: number;
  b2b_commission: number;
  base_percentage: number;
  commission_before_tax: number;
  commission_tax: number;
  commission_after_tax: number;
  marketing_before_tax: number;
  marketing_tax: number;
  marketing_after_tax: number;
  /** Gross Premium − Commission Before Tax (never negative). */
  net_premium: number;
  total_income: number;
  income_percentage: number;
  tagged_premium_percentage: number;
  tagged_premium: number;
}

/** Safe numeric coercion: null/undefined/NaN/Infinity → 0. */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Round to `d` decimals (used only for final output values). */
export function round(n: number, d = 2): number {
  if (!Number.isFinite(n)) return 0;
  const p = Math.pow(10, d);
  return Math.round((n + Number.EPSILON) * p) / p;
}

/**
 * The authoritative calculation. Full precision throughout; rounding applied
 * only to the returned values (money → 2dp, percentages → 6dp).
 */
export function calculateDealFinancials(input: DealFinancialInputs): DealFinancials {
  const gross = Math.max(0, num(input.gross_premium));
  const commPct = num(input.commission_percentage);
  const mktPct = num(input.marketing_budget_percentage);
  const loading = num(input.loading);
  const b2b = num(input.b2b_commission);
  const baseRaw = num(input.base_percentage);
  const base = baseRaw > 0 ? baseRaw : DEFAULT_BASE_PERCENTAGE;

  const commBefore = (gross * commPct) / 100;
  const commTax = commBefore * COMMISSION_TAX_RATE;
  const commAfter = commBefore - commTax;

  const mktBefore = (gross * mktPct) / 100;
  const mktTax = mktBefore * MARKETING_TAX_RATE;
  const mktAfter = mktBefore - mktTax;

  const totalIncome = commAfter + mktAfter + loading + b2b;

  const incomePct = gross > 0 ? (totalIncome / gross) * 100 : 0;
  const taggedPct = gross > 0 ? (incomePct / base) * 100 : 0;
  const tagged = gross > 0 ? (taggedPct < 100 ? (taggedPct / 100) * gross : gross) : 0;

  return {
    gross_premium: round(gross),
    commission_percentage: commPct,
    marketing_budget_percentage: mktPct,
    loading: round(loading),
    b2b_commission: round(b2b),
    base_percentage: base,
    commission_before_tax: round(commBefore),
    commission_tax: round(commTax),
    commission_after_tax: round(commAfter),
    marketing_before_tax: round(mktBefore),
    marketing_tax: round(mktTax),
    marketing_after_tax: round(mktAfter),
    net_premium: round(Math.max(0, gross - commBefore)),
    total_income: round(totalIncome),
    income_percentage: round(incomePct, 6),
    tagged_premium_percentage: round(taggedPct, 6),
    tagged_premium: round(tagged),
  };
}

/**
 * Aggregate many deals through the same engine (bulk policies, travel rows,
 * dashboards, reports and exports). Percentages are derived from the totals.
 */
export function aggregateDealFinancials(
  deals: DealFinancialInputs[],
  basePercentage: number = DEFAULT_BASE_PERCENTAGE,
) {
  const base = num(basePercentage) > 0 ? num(basePercentage) : DEFAULT_BASE_PERCENTAGE;
  type Acc = Record<
    | "gross_premium" | "net_premium" | "commission_before_tax" | "commission_tax"
    | "commission_after_tax" | "marketing_before_tax" | "marketing_tax"
    | "marketing_after_tax" | "total_income" | "tagged_premium",
    number
  >;
  const acc = deals.reduce<Acc>(
    (a, d) => {
      const f = calculateDealFinancials({ ...d, base_percentage: d.base_percentage ?? base });
      a.gross_premium += f.gross_premium;
      a.net_premium += f.net_premium;
      a.commission_before_tax += f.commission_before_tax;
      a.commission_tax += f.commission_tax;
      a.commission_after_tax += f.commission_after_tax;
      a.marketing_before_tax += f.marketing_before_tax;
      a.marketing_tax += f.marketing_tax;
      a.marketing_after_tax += f.marketing_after_tax;
      a.total_income += f.total_income;
      a.tagged_premium += f.tagged_premium;
      return a;
    },
    {
      gross_premium: 0, net_premium: 0, commission_before_tax: 0, commission_tax: 0,
      commission_after_tax: 0, marketing_before_tax: 0, marketing_tax: 0,
      marketing_after_tax: 0, total_income: 0, tagged_premium: 0,
    },
  );
  const income_percentage = acc.gross_premium > 0 ? (acc.total_income / acc.gross_premium) * 100 : 0;
  return {
    ...acc,
    gross_premium: round(acc.gross_premium),
    net_premium: round(acc.net_premium),
    commission_before_tax: round(acc.commission_before_tax),
    commission_tax: round(acc.commission_tax),
    commission_after_tax: round(acc.commission_after_tax),
    marketing_before_tax: round(acc.marketing_before_tax),
    marketing_tax: round(acc.marketing_tax),
    marketing_after_tax: round(acc.marketing_after_tax),
    total_income: round(acc.total_income),
    tagged_premium: round(acc.tagged_premium),
    base_percentage: base,
    income_percentage: round(income_percentage, 6),
    tagged_premium_percentage: round((income_percentage / base) * 100, 6),
  };
}
