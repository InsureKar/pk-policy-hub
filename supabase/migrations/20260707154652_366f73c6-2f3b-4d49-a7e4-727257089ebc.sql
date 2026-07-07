
-- =========================================================
-- ACCOUNTS MODULE FOUNDATION
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.payment_schedule_type AS ENUM ('annual','half_yearly','quarterly','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.receivable_status AS ENUM ('open','partial','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.installment_status AS ENUM ('pending','partial','paid','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payable_status AS ENUM ('pending','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method_type AS ENUM ('cash','cheque','ibft','bank_transfer','online','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles: commission share (percentage of deal commission_after_tax paid to that user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_share_percentage numeric(6,3) NOT NULL DEFAULT 0;

-- Sequences for human-friendly numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS public.receivable_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS public.payable_number_seq START 1000;

-- =========================================================
-- RECEIVABLES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_number text NOT NULL UNIQUE DEFAULT ('RCV-' || lpad(nextval('receivable_number_seq')::text, 6, '0')),
  deal_id uuid NOT NULL UNIQUE REFERENCES public.deals(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  assigned_do_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  team_lead_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gross_premium numeric(14,2) NOT NULL DEFAULT 0,
  base_premium numeric(14,2),
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  commission_receivable numeric(14,2) NOT NULL DEFAULT 0,
  payment_schedule public.payment_schedule_type NOT NULL DEFAULT 'annual',
  installment_count integer NOT NULL DEFAULT 1,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_amount numeric(14,2) NOT NULL DEFAULT 0,
  first_due_date date,
  expected_collection_date date,
  fully_paid_at timestamptz,
  status public.receivable_status NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receivables_deal ON public.receivables(deal_id);
CREATE INDEX IF NOT EXISTS idx_receivables_do ON public.receivables(assigned_do_id);
CREATE INDEX IF NOT EXISTS idx_receivables_team ON public.receivables(team_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.receivables TO service_role;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recv_admin_all" ON public.receivables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "recv_mgmt_read" ON public.receivables FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'management'));
CREATE POLICY "recv_tl_read" ON public.receivables FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team());
CREATE POLICY "recv_do_read" ON public.receivables FOR SELECT TO authenticated
  USING (assigned_do_id = auth.uid());

-- =========================================================
-- INVOICES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0')),
  receivable_id uuid NOT NULL UNIQUE REFERENCES public.receivables(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_receivable ON public.invoices(receivable_id);
CREATE INDEX IF NOT EXISTS idx_invoices_deal ON public.invoices(deal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_admin_all" ON public.invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "inv_read_scoped" ON public.invoices FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'management')
    OR EXISTS (SELECT 1 FROM public.receivables r WHERE r.id = receivable_id AND (
      (public.has_role(auth.uid(),'team_lead') AND r.team_id = public.current_user_team())
      OR r.assigned_do_id = auth.uid()
    ))
  );

-- =========================================================
-- INSTALLMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(14,2) NOT NULL DEFAULT 0,
  status public.installment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (receivable_id, installment_number)
);
CREATE INDEX IF NOT EXISTS idx_installments_recv ON public.installments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_installments_due ON public.installments(due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inst_admin_all" ON public.installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "inst_read_scoped" ON public.installments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'management')
    OR EXISTS (SELECT 1 FROM public.receivables r WHERE r.id = receivable_id AND (
      (public.has_role(auth.uid(),'team_lead') AND r.team_id = public.current_user_team())
      OR r.assigned_do_id = auth.uid()
    ))
  );

-- =========================================================
-- PAYMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE RESTRICT,
  installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT current_date,
  payment_method public.payment_method_type NOT NULL DEFAULT 'bank_transfer',
  transaction_reference text,
  ibft_reference text,
  cheque_number text,
  cash_voucher_number text,
  receiving_bank text,
  receiving_account text,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attachment_url text,
  notes text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_recv ON public.payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payments_inst ON public.payments(installment_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pay_admin_all" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pay_read_scoped" ON public.payments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'management')
    OR EXISTS (SELECT 1 FROM public.receivables r WHERE r.id = receivable_id AND (
      (public.has_role(auth.uid(),'team_lead') AND r.team_id = public.current_user_team())
      OR r.assigned_do_id = auth.uid()
    ))
  );

-- =========================================================
-- COMMISSION PAYABLES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.commission_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_number text NOT NULL UNIQUE DEFAULT ('PAY-' || lpad(nextval('payable_number_seq')::text, 6, '0')),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  beneficiary_role text NOT NULL,           -- 'do' | 'team_lead'
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  payable_date date NOT NULL DEFAULT current_date,
  paid_date date,
  payment_method public.payment_method_type,
  reference_number text,
  proof_url text,
  status public.payable_status NOT NULL DEFAULT 'pending',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (receivable_id, beneficiary_id, beneficiary_role)
);
CREATE INDEX IF NOT EXISTS idx_payables_recv ON public.commission_payables(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payables_beneficiary ON public.commission_payables(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON public.commission_payables(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payables TO authenticated;
GRANT ALL ON public.commission_payables TO service_role;
ALTER TABLE public.commission_payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_admin_all" ON public.commission_payables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "cp_mgmt_read" ON public.commission_payables FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'management'));
CREATE POLICY "cp_own_read" ON public.commission_payables FOR SELECT TO authenticated
  USING (beneficiary_id = auth.uid());

-- =========================================================
-- ACCOUNTS AUDIT LOG (immutable)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.accounts_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,      -- receivable | payment | invoice | payable | installment
  entity_id uuid NOT NULL,
  action text NOT NULL,           -- create | update | mark_paid | mark_partial | delete
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.accounts_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.accounts_audit_log(created_at DESC);

GRANT SELECT, INSERT ON public.accounts_audit_log TO authenticated;
GRANT ALL ON public.accounts_audit_log TO service_role;
ALTER TABLE public.accounts_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON public.accounts_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "audit_insert" ON public.accounts_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);
-- No update or delete policies = immutable

-- =========================================================
-- updated_at triggers
-- =========================================================
CREATE TRIGGER trg_recv_updated_at BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_inv_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_inst_updated_at BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cp_updated_at BEFORE UPDATE ON public.commission_payables FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- AUTO-CREATE RECEIVABLE + INVOICE + INSTALLMENTS ON DEAL WON
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_deal_won_to_receivable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_won boolean := false;
  was_won boolean := false;
  sched public.payment_schedule_type;
  count_i integer;
  step_months integer;
  i integer;
  per_amount numeric(14,2);
  last_amount numeric(14,2);
  start_date date;
  new_recv_id uuid;
  commission_recv numeric(14,2);
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT ds.is_won INTO is_won FROM public.deal_stages ds WHERE ds.id = NEW.stage_id;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage_id IS NOT NULL THEN
    SELECT ds.is_won INTO was_won FROM public.deal_stages ds WHERE ds.id = OLD.stage_id;
  END IF;

  IF NOT COALESCE(is_won, false) THEN RETURN NEW; END IF;
  IF COALESCE(was_won, false) THEN RETURN NEW; END IF;
  -- already exists?
  IF EXISTS (SELECT 1 FROM public.receivables WHERE deal_id = NEW.id) THEN RETURN NEW; END IF;

  sched := COALESCE(NULLIF(lower(NEW.payment_schedule),'')::public.payment_schedule_type, 'annual');
  count_i := CASE sched WHEN 'annual' THEN 1 WHEN 'half_yearly' THEN 2 WHEN 'quarterly' THEN 4 WHEN 'monthly' THEN 12 END;
  step_months := CASE sched WHEN 'annual' THEN 12 WHEN 'half_yearly' THEN 6 WHEN 'quarterly' THEN 3 WHEN 'monthly' THEN 1 END;

  commission_recv := COALESCE(NEW.commission_before_tax, 0);
  start_date := COALESCE(NEW.policy_start_date, current_date);

  INSERT INTO public.receivables (
    deal_id, client_id, team_id, assigned_do_id, team_lead_id,
    gross_premium, base_premium, net_premium, commission_receivable,
    payment_schedule, installment_count, total_amount, outstanding_amount,
    first_due_date, expected_collection_date, created_by
  ) VALUES (
    NEW.id, NEW.client_id, NEW.team_id, NEW.assigned_do_id, NEW.team_lead_id,
    NEW.gross_premium, NEW.base_premium, NEW.net_premium, commission_recv,
    sched, count_i, NEW.gross_premium, NEW.gross_premium,
    start_date, start_date, NEW.created_by
  ) RETURNING id INTO new_recv_id;

  INSERT INTO public.invoices (receivable_id, deal_id, client_id, issue_date, due_date, total_amount)
  VALUES (new_recv_id, NEW.id, NEW.client_id, current_date, start_date, NEW.gross_premium);

  per_amount := round(NEW.gross_premium / count_i, 2);
  last_amount := NEW.gross_premium - (per_amount * (count_i - 1));

  FOR i IN 1..count_i LOOP
    INSERT INTO public.installments (receivable_id, installment_number, due_date, amount, remaining_amount)
    VALUES (
      new_recv_id, i,
      (start_date + ((i - 1) * step_months || ' months')::interval)::date,
      CASE WHEN i = count_i THEN last_amount ELSE per_amount END,
      CASE WHEN i = count_i THEN last_amount ELSE per_amount END
    );
  END LOOP;

  INSERT INTO public.accounts_audit_log(entity_type, entity_id, action, actor_id, new_value)
  VALUES ('receivable', new_recv_id, 'create', auth.uid(), jsonb_build_object('deal_id', NEW.id, 'amount', NEW.gross_premium));

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deal_won_to_receivable ON public.deals;
CREATE TRIGGER trg_deal_won_to_receivable AFTER INSERT OR UPDATE OF stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_deal_won_to_receivable();

-- =========================================================
-- APPLY PAYMENT: allocate to installments, update receivable, generate payables when fully paid
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_payment_apply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.receivables%ROWTYPE;
  d public.deals%ROWTYPE;
  remaining numeric(14,2);
  inst RECORD;
  apply numeric(14,2);
  new_paid numeric(14,2);
  new_out numeric(14,2);
  new_status public.receivable_status;
  do_pct numeric(6,3);
  tl_pct numeric(6,3);
  do_amount numeric(14,2);
  tl_amount numeric(14,2);
BEGIN
  SELECT * INTO r FROM public.receivables WHERE id = NEW.receivable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receivable not found'; END IF;

  remaining := NEW.amount;

  -- Allocate to specific installment first
  IF NEW.installment_id IS NOT NULL THEN
    FOR inst IN SELECT * FROM public.installments WHERE id = NEW.installment_id FOR UPDATE LOOP
      apply := LEAST(remaining, inst.remaining_amount);
      UPDATE public.installments SET
        paid_amount = paid_amount + apply,
        remaining_amount = remaining_amount - apply,
        status = CASE WHEN (remaining_amount - apply) <= 0 THEN 'paid'::installment_status
                      WHEN (paid_amount + apply) > 0 THEN 'partial'::installment_status
                      ELSE status END,
        paid_at = CASE WHEN (remaining_amount - apply) <= 0 THEN now() ELSE paid_at END
      WHERE id = inst.id;
      remaining := remaining - apply;
    END LOOP;
  END IF;

  -- Then FIFO to remaining installments
  FOR inst IN SELECT * FROM public.installments WHERE receivable_id = r.id AND remaining_amount > 0 ORDER BY installment_number FOR UPDATE LOOP
    EXIT WHEN remaining <= 0;
    apply := LEAST(remaining, inst.remaining_amount);
    UPDATE public.installments SET
      paid_amount = paid_amount + apply,
      remaining_amount = remaining_amount - apply,
      status = CASE WHEN (remaining_amount - apply) <= 0 THEN 'paid'::installment_status
                    ELSE 'partial'::installment_status END,
      paid_at = CASE WHEN (remaining_amount - apply) <= 0 THEN now() ELSE paid_at END
    WHERE id = inst.id;
    remaining := remaining - apply;
  END LOOP;

  new_paid := r.paid_amount + NEW.amount;
  new_out := GREATEST(0, r.total_amount - new_paid);
  new_status := CASE
    WHEN new_out <= 0 THEN 'paid'::receivable_status
    WHEN new_paid > 0 THEN 'partial'::receivable_status
    ELSE 'open'::receivable_status
  END;

  UPDATE public.receivables SET
    paid_amount = new_paid,
    outstanding_amount = new_out,
    status = new_status,
    fully_paid_at = CASE WHEN new_out <= 0 THEN now() ELSE fully_paid_at END
  WHERE id = r.id;

  INSERT INTO public.accounts_audit_log(entity_type, entity_id, action, actor_id, new_value)
  VALUES ('payment', NEW.id, 'create', auth.uid(),
    jsonb_build_object('receivable_id', r.id, 'amount', NEW.amount, 'method', NEW.payment_method));

  -- Generate payables on full payment
  IF new_out <= 0 THEN
    SELECT * INTO d FROM public.deals WHERE id = r.deal_id;

    -- DO payable
    IF r.assigned_do_id IS NOT NULL THEN
      SELECT COALESCE(commission_share_percentage,0) INTO do_pct FROM public.profiles WHERE id = r.assigned_do_id;
      do_amount := round(COALESCE(d.commission_after_tax,0) * COALESCE(do_pct,0) / 100.0, 2);
      IF do_amount > 0 THEN
        INSERT INTO public.commission_payables (receivable_id, deal_id, beneficiary_id, beneficiary_role, commission_amount)
        VALUES (r.id, d.id, r.assigned_do_id, 'do', do_amount)
        ON CONFLICT (receivable_id, beneficiary_id, beneficiary_role) DO NOTHING;
      END IF;
    END IF;

    -- TL payable
    IF r.team_lead_id IS NOT NULL AND r.team_lead_id <> COALESCE(r.assigned_do_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      SELECT COALESCE(commission_share_percentage,0) INTO tl_pct FROM public.profiles WHERE id = r.team_lead_id;
      tl_amount := round(COALESCE(d.commission_after_tax,0) * COALESCE(tl_pct,0) / 100.0, 2);
      IF tl_amount > 0 THEN
        INSERT INTO public.commission_payables (receivable_id, deal_id, beneficiary_id, beneficiary_role, commission_amount)
        VALUES (r.id, d.id, r.team_lead_id, 'team_lead', tl_amount)
        ON CONFLICT (receivable_id, beneficiary_id, beneficiary_role) DO NOTHING;
      END IF;
    END IF;

    INSERT INTO public.accounts_audit_log(entity_type, entity_id, action, actor_id, new_value)
    VALUES ('receivable', r.id, 'mark_paid', auth.uid(), jsonb_build_object('paid_amount', new_paid));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_apply ON public.payments;
CREATE TRIGGER trg_payment_apply AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_payment_apply();

-- =========================================================
-- BACKFILL: create receivables for existing Won deals
-- =========================================================
DO $$
DECLARE
  d RECORD;
  sched public.payment_schedule_type;
  count_i integer;
  step_months integer;
  per_amount numeric(14,2);
  last_amount numeric(14,2);
  start_date date;
  new_recv_id uuid;
  i integer;
BEGIN
  FOR d IN
    SELECT dl.* FROM public.deals dl
    JOIN public.deal_stages s ON s.id = dl.stage_id
    WHERE s.is_won = true
      AND NOT EXISTS (SELECT 1 FROM public.receivables WHERE deal_id = dl.id)
  LOOP
    sched := COALESCE(NULLIF(lower(d.payment_schedule),'')::public.payment_schedule_type, 'annual');
    count_i := CASE sched WHEN 'annual' THEN 1 WHEN 'half_yearly' THEN 2 WHEN 'quarterly' THEN 4 WHEN 'monthly' THEN 12 END;
    step_months := CASE sched WHEN 'annual' THEN 12 WHEN 'half_yearly' THEN 6 WHEN 'quarterly' THEN 3 WHEN 'monthly' THEN 1 END;
    start_date := COALESCE(d.policy_start_date, current_date);

    INSERT INTO public.receivables (
      deal_id, client_id, team_id, assigned_do_id, team_lead_id,
      gross_premium, base_premium, net_premium, commission_receivable,
      payment_schedule, installment_count, total_amount, outstanding_amount,
      first_due_date, expected_collection_date, created_by
    ) VALUES (
      d.id, d.client_id, d.team_id, d.assigned_do_id, d.team_lead_id,
      d.gross_premium, d.base_premium, d.net_premium, COALESCE(d.commission_before_tax,0),
      sched, count_i, d.gross_premium, d.gross_premium,
      start_date, start_date, d.created_by
    ) RETURNING id INTO new_recv_id;

    INSERT INTO public.invoices (receivable_id, deal_id, client_id, issue_date, due_date, total_amount)
    VALUES (new_recv_id, d.id, d.client_id, current_date, start_date, d.gross_premium);

    per_amount := round(d.gross_premium / count_i, 2);
    last_amount := d.gross_premium - (per_amount * (count_i - 1));

    FOR i IN 1..count_i LOOP
      INSERT INTO public.installments (receivable_id, installment_number, due_date, amount, remaining_amount)
      VALUES (
        new_recv_id, i,
        (start_date + ((i - 1) * step_months || ' months')::interval)::date,
        CASE WHEN i = count_i THEN last_amount ELSE per_amount END,
        CASE WHEN i = count_i THEN last_amount ELSE per_amount END
      );
    END LOOP;
  END LOOP;
END $$;
