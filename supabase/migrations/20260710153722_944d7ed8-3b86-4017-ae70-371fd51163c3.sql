
-- ============================================================
-- Accounts + Invoicing + Bulk Policies + Travel Posting + Email log
-- ============================================================

-- 1. Add "Invoice Issued" pipeline stage between Negotiation (30) and Cover Note Issued (40)
INSERT INTO public.deal_stages(name, sort_order, is_won)
SELECT 'Invoice Issued', 35, false
WHERE NOT EXISTS (SELECT 1 FROM public.deal_stages WHERE name='Invoice Issued');

-- 2. Deals: policy_type + posting reconciliation flag
DO $$ BEGIN
  CREATE TYPE public.policy_type_kind AS ENUM ('single','bulk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS policy_type public.policy_type_kind NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS posting_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS insurance_company_id_payment uuid REFERENCES public.insurance_companies(id);

-- 3. deal_policies (bulk policies)
CREATE TABLE IF NOT EXISTS public.deal_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  cover_note_number text,
  policy_number text,
  gross_premium numeric(14,2) NOT NULL DEFAULT 0,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_policies TO authenticated;
GRANT ALL ON public.deal_policies TO service_role;
ALTER TABLE public.deal_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_policies_read" ON public.deal_policies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id));
CREATE POLICY "deal_policies_write" ON public.deal_policies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id));
CREATE TRIGGER trg_deal_policies_updated BEFORE UPDATE ON public.deal_policies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Invoices: approval workflow
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','pending_approval','approved','rejected','sent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS status public.invoice_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS invoice_kind text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Sequence for issued-stage invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_issued_seq START 10000;

-- 5. Travel posting
CREATE TABLE IF NOT EXISTS public.travel_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL UNIQUE REFERENCES public.deals(id) ON DELETE CASCADE,
  total_policy_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_posting_amount numeric(14,2) NOT NULL DEFAULT 0,
  posting_from date,
  posting_to date,
  status text NOT NULL DEFAULT 'pending', -- balanced|excess|deficit|pending
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_travel_dates CHECK (posting_from IS NULL OR posting_to IS NULL OR posting_to >= posting_from)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_postings TO authenticated;
GRANT ALL ON public.travel_postings TO service_role;
ALTER TABLE public.travel_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "travel_postings_all" ON public.travel_postings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id));
CREATE TRIGGER trg_travel_postings_updated BEFORE UPDATE ON public.travel_postings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.travel_posting_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id uuid NOT NULL REFERENCES public.travel_postings(id) ON DELETE CASCADE,
  sr_no integer NOT NULL,
  travel_agent text,
  date_issued date,
  policy_number text,
  premium numeric(14,2) NOT NULL DEFAULT 0,
  commission_percentage numeric(6,3) NOT NULL DEFAULT 0,
  payable_company text,
  agent_name text,
  company_id uuid REFERENCES public.insurance_companies(id),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_posting_rows TO authenticated;
GRANT ALL ON public.travel_posting_rows TO service_role;
ALTER TABLE public.travel_posting_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "travel_posting_rows_all" ON public.travel_posting_rows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = posting_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = posting_id));

-- Recompute travel posting status trigger
CREATE OR REPLACE FUNCTION public.tg_travel_posting_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p_id uuid;
  total_prem numeric(14,2);
  total_amt numeric(14,2);
  new_status text;
BEGIN
  p_id := COALESCE(NEW.posting_id, OLD.posting_id);
  SELECT COALESCE(SUM(premium),0) INTO total_prem FROM public.travel_posting_rows WHERE posting_id = p_id;
  SELECT total_posting_amount INTO total_amt FROM public.travel_postings WHERE id = p_id;
  new_status := CASE
    WHEN total_amt = 0 THEN 'pending'
    WHEN total_prem = total_amt THEN 'balanced'
    WHEN total_prem > total_amt THEN 'excess'
    ELSE 'deficit'
  END;
  UPDATE public.travel_postings SET status = new_status WHERE id = p_id;
  UPDATE public.deals SET posting_status = new_status WHERE id = (SELECT deal_id FROM public.travel_postings WHERE id = p_id);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_travel_rows_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.travel_posting_rows
FOR EACH ROW EXECUTE FUNCTION public.tg_travel_posting_recalc();

CREATE OR REPLACE FUNCTION public.tg_travel_posting_amt_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  total_prem numeric(14,2);
  new_status text;
BEGIN
  SELECT COALESCE(SUM(premium),0) INTO total_prem FROM public.travel_posting_rows WHERE posting_id = NEW.id;
  new_status := CASE
    WHEN NEW.total_posting_amount = 0 THEN 'pending'
    WHEN total_prem = NEW.total_posting_amount THEN 'balanced'
    WHEN total_prem > NEW.total_posting_amount THEN 'excess'
    ELSE 'deficit'
  END;
  NEW.status := new_status;
  UPDATE public.deals SET posting_status = new_status WHERE id = NEW.deal_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_travel_posting_upd
BEFORE INSERT OR UPDATE OF total_posting_amount ON public.travel_postings
FOR EACH ROW EXECUTE FUNCTION public.tg_travel_posting_amt_change();

-- 6. Email history log
CREATE TABLE IF NOT EXISTS public.email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text,
  sent_by uuid,
  status text NOT NULL DEFAULT 'sent',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_history TO authenticated;
GRANT ALL ON public.email_history TO service_role;
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_history_read" ON public.email_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_history_insert" ON public.email_history FOR INSERT TO authenticated WITH CHECK (sent_by = auth.uid());

-- 7. Auto-create invoice draft when stage changes to "Invoice Issued"
CREATE OR REPLACE FUNCTION public.tg_deal_invoice_issued()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  stage_name text;
  new_inv_num text;
BEGIN
  IF NEW.stage_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO stage_name FROM public.deal_stages WHERE id = NEW.stage_id;
  IF stage_name <> 'Invoice Issued' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id THEN RETURN NEW; END IF;
  -- Skip if a manual invoice already exists for this deal in draft/pending
  IF EXISTS (SELECT 1 FROM public.invoices WHERE deal_id = NEW.id AND status IN ('draft','pending_approval','approved','sent')) THEN
    RETURN NEW;
  END IF;
  new_inv_num := 'INV-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.invoice_issued_seq')::text, 5, '0');
  INSERT INTO public.invoices (invoice_number, deal_id, client_id, issue_date, due_date, total_amount, status, invoice_kind, created_by)
  VALUES (new_inv_num, NEW.id, NEW.client_id, current_date, COALESCE(NEW.policy_start_date, current_date), NEW.gross_premium, 'pending_approval', 'issued_stage', COALESCE(auth.uid(), NEW.created_by));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_invoice_issued ON public.deals;
CREATE TRIGGER trg_deal_invoice_issued
AFTER INSERT OR UPDATE OF stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_deal_invoice_issued();

-- 8. Guard: prevent progressing Travel deal to Won unless posting balanced
CREATE OR REPLACE FUNCTION public.tg_deal_travel_posting_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  is_travel boolean := false;
  is_won boolean := false;
  ptype text;
BEGIN
  IF NEW.insurance_type_id IS NOT NULL THEN
    SELECT lower(name) = 'travel' INTO is_travel FROM public.insurance_types WHERE id = NEW.insurance_type_id;
  END IF;
  IF NOT COALESCE(is_travel, false) THEN RETURN NEW; END IF;
  IF NEW.stage_id IS NOT NULL THEN
    SELECT ds.is_won INTO is_won FROM public.deal_stages ds WHERE ds.id = NEW.stage_id;
  END IF;
  IF NOT COALESCE(is_won, false) THEN RETURN NEW; END IF;
  SELECT status INTO ptype FROM public.travel_postings WHERE deal_id = NEW.id;
  IF ptype IS NULL OR ptype <> 'balanced' THEN
    RAISE EXCEPTION 'Travel deal cannot proceed to Won until posting status is Balanced (current: %)', COALESCE(ptype, 'no posting');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_travel_guard ON public.deals;
CREATE TRIGGER trg_deal_travel_guard
BEFORE UPDATE OF stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_deal_travel_posting_guard();
