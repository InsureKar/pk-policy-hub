
-- ============================================================
-- CLIENT CODE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.client_code_seq START 1;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.tg_clients_set_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_code IS NULL THEN
    NEW.client_code := 'CLI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.client_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clients_set_code ON public.clients;
CREATE TRIGGER clients_set_code BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_clients_set_code();

-- Backfill existing clients
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.clients WHERE client_code IS NULL ORDER BY created_at LOOP
    UPDATE public.clients SET client_code = 'CLI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.client_code_seq')::text, 6, '0') WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================
-- PROFILES compensation fields
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS monthly_salary numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_tax_percentage numeric(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_allowances numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_deductions numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'active';

-- ============================================================
-- PAYROLL RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  gross_salary numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  bonuses numeric(14,2) NOT NULL DEFAULT 0,
  allowances numeric(14,2) NOT NULL DEFAULT 0,
  net_salary numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payment_method text,
  reference_number text,
  remarks text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, period_year, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll admin all" ON public.payroll_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'));

CREATE TRIGGER payroll_runs_updated BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_payroll_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.net_salary := ROUND(GREATEST(0, COALESCE(NEW.gross_salary,0) - COALESCE(NEW.tax_amount,0) - COALESCE(NEW.deductions,0) + COALESCE(NEW.bonuses,0) + COALESCE(NEW.allowances,0))::numeric, 2);
  RETURN NEW;
END $$;

CREATE TRIGGER payroll_runs_calc BEFORE INSERT OR UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_payroll_calc();

-- ============================================================
-- SALARY REVISIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  previous_salary numeric(14,2),
  new_salary numeric(14,2) NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_revisions TO authenticated;
GRANT ALL ON public.salary_revisions TO service_role;
ALTER TABLE public.salary_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salary revisions admin" ON public.salary_revisions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense cats read" ON public.expense_categories FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "expense cats write admin" ON public.expense_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed default categories
INSERT INTO public.expense_categories (name, slug, is_system) VALUES
  ('Administrative', 'admin', true),
  ('HR', 'hr', true),
  ('Technology', 'tech', true),
  ('Marketing', 'marketing', true),
  ('Entertainment', 'entertainment', true),
  ('Official Travel', 'travel', true),
  ('Insurance', 'insurance', true),
  ('Miscellaneous', 'misc', true)
ON CONFLICT (slug) DO NOTHING;

-- Seed subcategories
DO $$
DECLARE
  admin_id uuid; hr_id uuid; tech_id uuid; mkt_id uuid; ent_id uuid; trv_id uuid; ins_id uuid;
BEGIN
  SELECT id INTO admin_id FROM public.expense_categories WHERE slug='admin';
  SELECT id INTO hr_id FROM public.expense_categories WHERE slug='hr';
  SELECT id INTO tech_id FROM public.expense_categories WHERE slug='tech';
  SELECT id INTO mkt_id FROM public.expense_categories WHERE slug='marketing';
  SELECT id INTO ent_id FROM public.expense_categories WHERE slug='entertainment';
  SELECT id INTO trv_id FROM public.expense_categories WHERE slug='travel';
  SELECT id INTO ins_id FROM public.expense_categories WHERE slug='insurance';

  INSERT INTO public.expense_categories (parent_id,name,slug,is_system) VALUES
    (admin_id,'Office Rent','admin-rent',true),
    (admin_id,'Utilities','admin-utilities',true),
    (admin_id,'Internet','admin-internet',true),
    (admin_id,'Office Supplies','admin-supplies',true),
    (hr_id,'Salaries','hr-salaries',true),
    (hr_id,'Bonuses','hr-bonuses',true),
    (hr_id,'Employee Benefits','hr-benefits',true),
    (hr_id,'Recruitment','hr-recruitment',true),
    (hr_id,'Training','hr-training',true),
    (tech_id,'CRM Development','tech-crm',true),
    (tech_id,'Server Hosting','tech-hosting',true),
    (tech_id,'Domains','tech-domains',true),
    (tech_id,'APIs','tech-apis',true),
    (tech_id,'AI Services','tech-ai',true),
    (tech_id,'Software Licenses','tech-licenses',true),
    (tech_id,'Cloud Infrastructure','tech-cloud',true),
    (mkt_id,'Meta Ads','mkt-meta',true),
    (mkt_id,'Google Ads','mkt-google',true),
    (mkt_id,'LinkedIn Ads','mkt-linkedin',true),
    (mkt_id,'SEO','mkt-seo',true),
    (mkt_id,'Events','mkt-events',true),
    (mkt_id,'Printing','mkt-printing',true),
    (mkt_id,'Promotional Material','mkt-promo',true),
    (ent_id,'Client Meetings','ent-meetings',true),
    (ent_id,'Business Lunches','ent-lunches',true),
    (ent_id,'Gifts','ent-gifts',true),
    (ent_id,'Hospitality','ent-hospitality',true),
    (trv_id,'Flights','trv-flights',true),
    (trv_id,'Hotels','trv-hotels',true),
    (trv_id,'Fuel','trv-fuel',true),
    (trv_id,'Local Transport','trv-transport',true),
    (trv_id,'Daily Allowance','trv-allowance',true),
    (ins_id,'Company Insurance','ins-company',true),
    (ins_id,'Employee Insurance','ins-employee',true),
    (ins_id,'Other Policies','ins-other',true)
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.expense_seq START 1;

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_code text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.expense_categories(id),
  subcategory_id uuid REFERENCES public.expense_categories(id),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  vendor text,
  invoice_number text,
  payment_method text,
  payment_date date,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  attachment_url text,
  remarks text,
  approval_status text NOT NULL DEFAULT 'approved',
  approved_by uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses admin all" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE TRIGGER expenses_updated BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_expense_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expense_code IS NULL OR NEW.expense_code = '' THEN
    NEW.expense_code := 'EXP-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.expense_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expenses_set_code BEFORE INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.tg_expense_code();

-- ============================================================
-- REIMBURSEMENTS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.reimbursement_seq START 1;

CREATE TABLE IF NOT EXISTS public.reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id),
  description text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  expense_date date NOT NULL,
  attachment_url text,
  remarks text,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  payment_method text,
  payment_reference text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reimbursements TO authenticated;
GRANT ALL ON public.reimbursements TO service_role;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reimb select own or admin" ON public.reimbursements FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'management')
  );
CREATE POLICY "reimb insert own" ON public.reimbursements FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY "reimb update admin" ON public.reimbursements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "reimb update own draft" ON public.reimbursements FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() AND status IN ('draft','submitted'))
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "reimb delete admin" ON public.reimbursements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER reimb_updated BEFORE UPDATE ON public.reimbursements
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_reimb_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.request_code IS NULL OR NEW.request_code = '' THEN
    NEW.request_code := 'RMB-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.reimbursement_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reimb_set_code BEFORE INSERT ON public.reimbursements
FOR EACH ROW EXECUTE FUNCTION public.tg_reimb_code();
