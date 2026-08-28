REVOKE EXECUTE ON FUNCTION public.tg_deals_b2b_calc() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_deal_accounting() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_tax_to_payable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_expense_to_payable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_commission_to_payable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_receivable_direct_flag() FROM anon, authenticated;