-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.tax_kind AS ENUM ('income_tax','sales_tax','marketing_budget_tax','commission_taker_tax','b2b_commission_tax');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payable_category AS ENUM ('commission','b2b_commission','tax','expense','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DEALS: B2B + payment destination
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS b2b_taker_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS b2b_commission_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS b2b_commission_percentage numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS b2b_tax_deduct boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS b2b_tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS b2b_tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS b2b_net_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS b2b_transfer_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS b2b_transfer_date date,
  ADD COLUMN IF NOT EXISTS payment_destination text NOT NULL DEFAULT 'company';

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS excluded_from_receivable boolean NOT NULL DEFAULT false;

-- TAX RECORDS
CREATE TABLE IF NOT EXISTS public.tax_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type public.tax_kind NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id),
  team_id uuid REFERENCES public.teams(id),
  insurance_type_id uuid REFERENCES public.insurance_types(id),
  deducted_from uuid REFERENCES public.profiles(id),
  source_type text NOT NULL DEFAULT 'deal',
  source_id uuid,
  base_amount numeric(14,2) NOT NULL DEFAULT 0,
  rate numeric(6,3) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  period_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_records_deal_source_uq
  ON public.tax_records (deal_id, tax_type, source_type) WHERE deal_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_records TO authenticated;
GRANT ALL ON public.tax_records TO service_role;
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_records_admin_all" ON public.tax_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE TRIGGER tax_records_updated BEFORE UPDATE ON public.tax_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- PAYABLES LEDGER
CREATE TABLE IF NOT EXISTS public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.payable_category NOT NULL,
  payee_profile_id uuid REFERENCES public.profiles(id),
  payee_name text,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
  tax_record_id uuid REFERENCES public.tax_records(id) ON DELETE CASCADE,
  commission_payable_id uuid REFERENCES public.commission_payables(id) ON DELETE CASCADE,
  description text,
  original_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_amount numeric(14,2) GENERATED ALWAYS AS (original_amount - paid_amount) STORED,
  due_date date,
  payment_date date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payables_expense_uq ON public.payables (expense_id) WHERE expense_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payables_tax_uq ON public.payables (tax_record_id) WHERE tax_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payables_commission_uq ON public.payables (commission_payable_id) WHERE commission_payable_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payables_b2b_uq ON public.payables (deal_id, category) WHERE category = 'b2b_commission';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payables_admin_all" ON public.payables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE TRIGGER payables_updated BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- B2B derived amounts on deals
CREATE OR REPLACE FUNCTION public.tg_deals_b2b_calc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.b2b_commission_type = 'percentage' THEN
    NEW.b2b_commission := round(COALESCE(NEW.gross_premium,0) * COALESCE(NEW.b2b_commission_percentage,0) / 100.0, 2);
  END IF;
  NEW.b2b_commission := GREATEST(0, COALESCE(NEW.b2b_commission,0));
  IF NEW.b2b_tax_deduct THEN
    NEW.b2b_tax_amount := round(NEW.b2b_commission * COALESCE(NEW.b2b_tax_rate,0) / 100.0, 2);
  ELSE
    NEW.b2b_tax_amount := 0;
  END IF;
  NEW.b2b_net_amount := GREATEST(0, NEW.b2b_commission - NEW.b2b_tax_amount);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deals_b2b_calc ON public.deals;
CREATE TRIGGER deals_b2b_calc BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.tg_deals_b2b_calc();

-- Deal → tax records + b2b payable
CREATE OR REPLACE FUNCTION public.tg_deal_accounting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  comm_before numeric(14,2) := COALESCE(NEW.commission_before_tax, 0);
  mkt_tax numeric(14,2) := COALESCE(NEW.marketing_tax, 0);
  sales_t numeric(14,2);
  income_t numeric(14,2);
  tax_id uuid;
BEGIN
  sales_t := round(comm_before * 0.05, 2);
  income_t := round(comm_before * 0.12, 2);

  -- 17% commission tax segregated: 5% sales tax + 12% income tax
  INSERT INTO public.tax_records (tax_type, deal_id, client_id, team_id, insurance_type_id, deducted_from,
                                  source_type, source_id, base_amount, rate, amount, period_date)
  VALUES ('sales_tax', NEW.id, NEW.client_id, NEW.team_id, NEW.insurance_type_id, NEW.assigned_do_id,
          'deal_commission', NEW.id, comm_before, 5, sales_t, COALESCE(NEW.policy_start_date, current_date))
  ON CONFLICT (deal_id, tax_type, source_type) WHERE deal_id IS NOT NULL
  DO UPDATE SET base_amount = EXCLUDED.base_amount, amount = EXCLUDED.amount,
                client_id = EXCLUDED.client_id, team_id = EXCLUDED.team_id,
                insurance_type_id = EXCLUDED.insurance_type_id, deducted_from = EXCLUDED.deducted_from;

  INSERT INTO public.tax_records (tax_type, deal_id, client_id, team_id, insurance_type_id, deducted_from,
                                  source_type, source_id, base_amount, rate, amount, period_date)
  VALUES ('income_tax', NEW.id, NEW.client_id, NEW.team_id, NEW.insurance_type_id, NEW.assigned_do_id,
          'deal_commission', NEW.id, comm_before, 12, income_t, COALESCE(NEW.policy_start_date, current_date))
  ON CONFLICT (deal_id, tax_type, source_type) WHERE deal_id IS NOT NULL
  DO UPDATE SET base_amount = EXCLUDED.base_amount, amount = EXCLUDED.amount,
                client_id = EXCLUDED.client_id, team_id = EXCLUDED.team_id,
                insurance_type_id = EXCLUDED.insurance_type_id, deducted_from = EXCLUDED.deducted_from;

  -- Marketing budget tax kept separate
  INSERT INTO public.tax_records (tax_type, deal_id, client_id, team_id, insurance_type_id, deducted_from,
                                  source_type, source_id, base_amount, rate, amount, period_date)
  VALUES ('marketing_budget_tax', NEW.id, NEW.client_id, NEW.team_id, NEW.insurance_type_id, NEW.assigned_do_id,
          'deal_marketing', NEW.id, COALESCE(NEW.marketing_before_tax,0), 9, mkt_tax, COALESCE(NEW.policy_start_date, current_date))
  ON CONFLICT (deal_id, tax_type, source_type) WHERE deal_id IS NOT NULL
  DO UPDATE SET base_amount = EXCLUDED.base_amount, amount = EXCLUDED.amount,
                client_id = EXCLUDED.client_id, team_id = EXCLUDED.team_id,
                insurance_type_id = EXCLUDED.insurance_type_id, deducted_from = EXCLUDED.deducted_from;

  -- B2B commission tax (deducted from the commission taker)
  IF NEW.b2b_tax_deduct AND COALESCE(NEW.b2b_tax_amount,0) > 0 THEN
    INSERT INTO public.tax_records (tax_type, deal_id, client_id, team_id, insurance_type_id, deducted_from,
                                    source_type, source_id, base_amount, rate, amount, period_date)
    VALUES ('b2b_commission_tax', NEW.id, NEW.client_id, NEW.team_id, NEW.insurance_type_id, NEW.b2b_taker_id,
            'b2b_commission', NEW.id, NEW.b2b_commission, NEW.b2b_tax_rate, NEW.b2b_tax_amount, COALESCE(NEW.policy_start_date, current_date))
    ON CONFLICT (deal_id, tax_type, source_type) WHERE deal_id IS NOT NULL
    DO UPDATE SET base_amount = EXCLUDED.base_amount, rate = EXCLUDED.rate, amount = EXCLUDED.amount,
                  deducted_from = EXCLUDED.deducted_from
    RETURNING id INTO tax_id;
  ELSE
    DELETE FROM public.payables p USING public.tax_records t
      WHERE p.tax_record_id = t.id AND t.deal_id = NEW.id AND t.tax_type = 'b2b_commission_tax' AND p.paid_amount = 0;
    DELETE FROM public.tax_records WHERE deal_id = NEW.id AND tax_type = 'b2b_commission_tax' AND paid_amount = 0;
  END IF;

  -- B2B net commission payable
  IF COALESCE(NEW.b2b_commission,0) > 0 AND NEW.b2b_taker_id IS NOT NULL THEN
    INSERT INTO public.payables (category, payee_profile_id, deal_id, description, original_amount, due_date, status)
    VALUES ('b2b_commission', NEW.b2b_taker_id, NEW.id,
            'B2B commission for deal ' || COALESCE(NEW.deal_number,''), COALESCE(NEW.b2b_net_amount,0),
            COALESCE(NEW.policy_start_date, current_date), 'pending')
    ON CONFLICT (deal_id, category) WHERE category = 'b2b_commission'
    DO UPDATE SET payee_profile_id = EXCLUDED.payee_profile_id,
                  original_amount = EXCLUDED.original_amount,
                  description = EXCLUDED.description;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deal_accounting ON public.deals;
CREATE TRIGGER deal_accounting AFTER INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.tg_deal_accounting();

-- Tax record → tax payable (no duplicates)
CREATE OR REPLACE FUNCTION public.tg_tax_to_payable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(NEW.amount,0) <= 0 THEN RETURN NEW; END IF;
  INSERT INTO public.payables (category, payee_profile_id, deal_id, tax_record_id, description,
                               original_amount, paid_amount, due_date, status)
  VALUES ('tax', NEW.deducted_from, NEW.deal_id, NEW.id,
          replace(initcap(replace(NEW.tax_type::text,'_',' ')),'Tax Tax','Tax'),
          NEW.amount, NEW.paid_amount, NEW.period_date,
          CASE WHEN NEW.paid_amount >= NEW.amount THEN 'paid' WHEN NEW.paid_amount > 0 THEN 'partial' ELSE 'pending' END)
  ON CONFLICT (tax_record_id) WHERE tax_record_id IS NOT NULL
  DO UPDATE SET original_amount = EXCLUDED.original_amount, paid_amount = EXCLUDED.paid_amount,
                payee_profile_id = EXCLUDED.payee_profile_id, status = EXCLUDED.status;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tax_to_payable ON public.tax_records;
CREATE TRIGGER tax_to_payable AFTER INSERT OR UPDATE ON public.tax_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_tax_to_payable();

-- Expense → payable
CREATE OR REPLACE FUNCTION public.tg_expense_to_payable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cat_name text;
BEGIN
  SELECT name INTO cat_name FROM public.expense_categories WHERE id = NEW.category_id;
  INSERT INTO public.payables (category, payee_name, expense_id, description, original_amount,
                               paid_amount, due_date, payment_date, status)
  VALUES ('expense', NEW.vendor, NEW.id,
          COALESCE(cat_name,'Expense') || COALESCE(' — ' || NEW.remarks, ''),
          COALESCE(NEW.amount,0) + COALESCE(NEW.tax_amount,0),
          CASE WHEN NEW.payment_date IS NOT NULL THEN COALESCE(NEW.amount,0) + COALESCE(NEW.tax_amount,0) ELSE 0 END,
          NEW.expense_date, NEW.payment_date,
          CASE WHEN NEW.payment_date IS NOT NULL THEN 'paid' ELSE 'pending' END)
  ON CONFLICT (expense_id) WHERE expense_id IS NOT NULL
  DO UPDATE SET original_amount = EXCLUDED.original_amount, paid_amount = EXCLUDED.paid_amount,
                payee_name = EXCLUDED.payee_name, description = EXCLUDED.description,
                payment_date = EXCLUDED.payment_date, status = EXCLUDED.status;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS expense_to_payable ON public.expenses;
CREATE TRIGGER expense_to_payable AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_expense_to_payable();

-- Staff commission payable → ledger
CREATE OR REPLACE FUNCTION public.tg_commission_to_payable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.payables (category, payee_profile_id, deal_id, commission_payable_id, description,
                               original_amount, paid_amount, due_date, payment_date, status)
  VALUES ('commission', NEW.beneficiary_id, NEW.deal_id, NEW.id,
          'Commission (' || NEW.beneficiary_role || ')', NEW.commission_amount,
          CASE WHEN NEW.status = 'paid' THEN NEW.commission_amount ELSE 0 END,
          NEW.payable_date, NEW.paid_date,
          CASE WHEN NEW.status = 'paid' THEN 'paid' WHEN NEW.status = 'cancelled' THEN 'cancelled' ELSE 'pending' END)
  ON CONFLICT (commission_payable_id) WHERE commission_payable_id IS NOT NULL
  DO UPDATE SET original_amount = EXCLUDED.original_amount, paid_amount = EXCLUDED.paid_amount,
                payment_date = EXCLUDED.payment_date, status = EXCLUDED.status;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS commission_to_payable ON public.commission_payables;
CREATE TRIGGER commission_to_payable AFTER INSERT OR UPDATE ON public.commission_payables
  FOR EACH ROW EXECUTE FUNCTION public.tg_commission_to_payable();

-- Receivable exclusion for direct insurance company payments
CREATE OR REPLACE FUNCTION public.tg_receivable_direct_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE dest text;
BEGIN
  SELECT payment_destination INTO dest FROM public.deals WHERE id = NEW.deal_id;
  NEW.excluded_from_receivable := COALESCE(dest,'company') = 'insurance_company';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS receivable_direct_flag ON public.receivables;
CREATE TRIGGER receivable_direct_flag BEFORE INSERT ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.tg_receivable_direct_flag();

-- Backfill accounting records for existing data
UPDATE public.deals SET updated_at = updated_at;
UPDATE public.expenses SET updated_at = updated_at;
UPDATE public.commission_payables SET updated_at = updated_at;
UPDATE public.receivables r SET excluded_from_receivable = (COALESCE(d.payment_destination,'company') = 'insurance_company')
  FROM public.deals d WHERE d.id = r.deal_id;
