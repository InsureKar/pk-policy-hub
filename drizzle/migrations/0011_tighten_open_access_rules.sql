CREATE OR REPLACE FUNCTION public.is_crm_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_crm_user() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_crm_user() TO authenticated;

ALTER POLICY "ls_sel" ON public.lead_sources USING (public.is_crm_user());
ALTER POLICY "uwtpl_select" ON public.underwriting_requirement_templates USING (public.is_crm_user());
ALTER POLICY "teams_select" ON public.teams USING (public.is_crm_user());
ALTER POLICY "ccr_read" ON public.company_commission_rates USING (public.is_crm_user());
ALTER POLICY "profiles_select" ON public.profiles USING (public.is_crm_user());
ALTER POLICY "assets_select_auth" ON public.assets USING (public.is_crm_user());
ALTER POLICY "it_sel" ON public.insurance_types USING (public.is_crm_user());
ALTER POLICY "sla_read" ON public.ticket_sla_settings USING (public.is_crm_user());
ALTER POLICY "ic_sel" ON public.insurance_companies USING (public.is_crm_user());
ALTER POLICY "as_sel" ON public.app_settings USING (public.is_crm_user());
ALTER POLICY "ds_sel" ON public.deal_stages USING (public.is_crm_user());

ALTER POLICY "audit insert" ON public.permission_audit_log WITH CHECK (changed_by = auth.uid());
ALTER POLICY "Authenticated can insert stage history" ON public.deal_stage_history
  WITH CHECK (changed_by = auth.uid() AND EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id));

ALTER POLICY "email_history_read" ON public.email_history USING (
  sent_by = auth.uid()
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR (deal_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.deals d WHERE d.id = email_history.deal_id))
);

ALTER POLICY "deal_installments_select_auth" ON public.deal_installments
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id));
ALTER POLICY "deal_installments_insert_auth" ON public.deal_installments
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id));
ALTER POLICY "deal_installments_update_auth" ON public.deal_installments
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id));
ALTER POLICY "deal_installments_delete_auth" ON public.deal_installments
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_installments.deal_id));

ALTER POLICY "task_attachment_read" ON storage.objects USING (
  bucket_id = 'crm-documents' AND auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.attachment_path = objects.name)
);