
REVOKE EXECUTE ON FUNCTION public.tg_deal_won_to_receivable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_payment_apply() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "audit_insert" ON public.accounts_audit_log;
CREATE POLICY "audit_insert" ON public.accounts_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
