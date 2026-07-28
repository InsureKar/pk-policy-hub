
ALTER TABLE public.invoices ALTER COLUMN deal_id DROP NOT NULL;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS insurance_type_id uuid REFERENCES public.insurance_types(id),
  ADD COLUMN IF NOT EXISTS payment_schedule public.payment_schedule_type,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS installment_index integer,
  ADD COLUMN IF NOT EXISTS installment_total integer;

DROP POLICY IF EXISTS inv_admin_all ON public.invoices;
DROP POLICY IF EXISTS inv_read_scoped ON public.invoices;

CREATE POLICY inv_admin_mgmt_all ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE POLICY inv_read_scoped ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'management')
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.receivables r
      WHERE r.id = invoices.receivable_id
        AND (
          (public.has_role(auth.uid(),'team_lead') AND r.team_id = public.current_user_team())
          OR r.assigned_do_id = auth.uid()
        )
    )
  );

-- Seed reimbursement categories
INSERT INTO public.expense_categories (name, slug, is_system, parent_id) VALUES
  ('Reimbursement', 'reimbursement', true, NULL)
ON CONFLICT DO NOTHING;

WITH parent AS (SELECT id FROM public.expense_categories WHERE slug='reimbursement' LIMIT 1)
INSERT INTO public.expense_categories (name, slug, is_system, parent_id)
SELECT n, s, true, (SELECT id FROM parent)
FROM (VALUES
  ('Travel & Transport','rmb-travel'),
  ('Fuel','rmb-fuel'),
  ('Meals & Client Entertainment','rmb-meals'),
  ('Accommodation','rmb-hotel'),
  ('Office Supplies','rmb-supplies'),
  ('Mobile / Internet','rmb-comms'),
  ('Training / Courses','rmb-training'),
  ('Medical','rmb-medical'),
  ('Miscellaneous','rmb-misc')
) AS t(n,s)
ON CONFLICT DO NOTHING;
