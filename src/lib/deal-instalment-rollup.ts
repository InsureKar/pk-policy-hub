import { supabase } from "@/integrations/supabase/client";
import { calculateDealFinancials } from "@/lib/calc";

/** Refresh the existing schedule roll-up after an explicit manager correction. */
export async function refreshCorrectedInstalmentTotals(dealId: string) {
  const deal = await supabase.from("deals").select("payment_schedule, base_percentage").eq("id", dealId).single();
  if (deal.error) throw deal.error;
  if (!/^(custom|quarter|bi-annual|bi annual|half)/.test(String(deal.data.payment_schedule ?? "").toLowerCase())) return;
  const result = await supabase.from("deal_installments").select("*").eq("deal_id", dealId);
  if (result.error) throw result.error;
  const sums = result.data.reduce((a, row) => {
    const gross = Number(row.gross_premium ?? 0);
    const c = calculateDealFinancials({ gross_premium: gross, net_premium: row.net_premium, commission_percentage: row.commission_percentage,
      marketing_budget_percentage: gross > 0 ? Number(row.marketing_budget ?? 0) / gross * 100 : 0,
      loading: row.loading, b2b_commission: row.b2b_commission, base_percentage: deal.data.base_percentage });
    return { gross: a.gross + c.gross_premium, net: a.net + c.net_premium, comm: a.comm + c.commission_before_tax,
      mkt: a.mkt + c.marketing_before_tax, loading: a.loading + c.loading, b2b: a.b2b + c.b2b_commission };
  }, { gross: 0, net: 0, comm: 0, mkt: 0, loading: 0, b2b: 0 });
  const updated = await supabase.from("deals").update({ gross_premium: sums.gross, net_premium: sums.net,
    commission_percentage: sums.gross > 0 ? sums.comm / sums.gross * 100 : 0,
    marketing_budget_percentage: sums.gross > 0 ? sums.mkt / sums.gross * 100 : 0,
    loading: sums.loading, b2b_commission: sums.b2b }).eq("id", dealId);
  if (updated.error) throw updated.error;
}