// Mirror of DB-generated calculations for live form preview.
// Tax constants match the migration: commission tax 17%, marketing tax 9%.
export const COMMISSION_TAX = 0.17;
export const MARKETING_TAX = 0.09;

export interface DealInputs {
  gross_premium: number;
  commission_percentage: number;
  marketing_budget_percentage: number;
  loading: number;
  b2b_commission: number;
}

export function computeDeal(d: DealInputs, basePct = 13) {
  const gp = Number(d.gross_premium) || 0;
  const commBefore = (Number(d.commission_percentage) || 0) * gp / 100;
  const commAfter = commBefore * (1 - COMMISSION_TAX);
  const mktBefore = (Number(d.marketing_budget_percentage) || 0) * gp / 100;
  const mktAfter = mktBefore * (1 - MARKETING_TAX);
  const totalIncome = commAfter + mktAfter + (Number(d.loading) || 0) + (Number(d.b2b_commission) || 0);
  const incomePct = gp > 0 ? (totalIncome / gp) * 100 : 0;
  const taggedPremiumPct = basePct > 0 ? (incomePct / basePct) * 100 : 0;
  const taggedPremium = taggedPremiumPct < 100 ? (taggedPremiumPct / 100) * gp : gp;
  return {
    commission_before_tax: round(commBefore),
    commission_after_tax: round(commAfter),
    marketing_before_tax: round(mktBefore),
    marketing_after_tax: round(mktAfter),
    total_income: round(totalIncome),
    income_percentage: round(incomePct, 4),
    tagged_premium_percentage: round(taggedPremiumPct, 4),
    tagged_premium: round(taggedPremium),
  };
}

function round(n: number, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}
