
CREATE POLICY "clients_delete_mgmt" ON public.clients FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "payments_delete_mgmt" ON public.payments FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "receivables_delete_mgmt" ON public.receivables FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "installments_delete_mgmt" ON public.installments FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "commission_payables_delete_mgmt" ON public.commission_payables FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "reimbursements_delete_mgmt" ON public.reimbursements FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "policies_delete_mgmt" ON public.policies FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "teams_delete_mgmt" ON public.teams FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "tickets_delete_mgmt" ON public.tickets FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "insurance_companies_delete_mgmt" ON public.insurance_companies FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "insurance_types_delete_mgmt" ON public.insurance_types FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "lead_sources_delete_mgmt" ON public.lead_sources FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "deal_stages_delete_mgmt" ON public.deal_stages FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
CREATE POLICY "expense_categories_delete_mgmt" ON public.expense_categories FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management'));
