
-- Phase 1: schema updates for CRM enterprise upgrade

-- 1. Clients: individual/corporate fields + ownership snapshot
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS cnic text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS do_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_lead_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_do_id ON public.clients(do_id);
CREATE INDEX IF NOT EXISTS idx_clients_team_lead_id ON public.clients(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_cnic ON public.clients(cnic);

-- 2. Deals: base premium, TL snapshot, payment info
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS base_premium numeric(14,2),
  ADD COLUMN IF NOT EXISTS team_lead_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_receive_date date,
  ADD COLUMN IF NOT EXISTS payment_schedule text,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS transaction_reference text,
  ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_remarks text;

CREATE INDEX IF NOT EXISTS idx_deals_team_lead_id ON public.deals(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_policy_number ON public.deals(policy_number);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON public.deals(stage_id);

-- 3. Auto-populate ownership + calculated net_premium on clients and deals
CREATE OR REPLACE FUNCTION public.tg_clients_autofill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_do boolean;
  is_tl boolean;
  creator_team uuid;
  team_lead uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT team_id INTO creator_team FROM public.profiles WHERE id = NEW.created_by;
    SELECT public.has_role(NEW.created_by, 'do'::app_role) INTO is_do;
    SELECT public.has_role(NEW.created_by, 'team_lead'::app_role) INTO is_tl;

    IF NEW.team_id IS NULL THEN NEW.team_id := creator_team; END IF;

    IF is_do THEN
      NEW.do_id := NEW.created_by;
      SELECT lead_id INTO team_lead FROM public.teams WHERE id = creator_team;
      NEW.team_lead_id := team_lead;
    ELSIF is_tl THEN
      NEW.team_lead_id := NEW.created_by;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS clients_autofill ON public.clients;
CREATE TRIGGER clients_autofill BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_clients_autofill();

CREATE OR REPLACE FUNCTION public.tg_deals_autofill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_do boolean;
  is_tl boolean;
  creator_team uuid;
  team_lead uuid;
BEGIN
  -- Ownership on insert
  IF TG_OP = 'INSERT' THEN
    SELECT team_id INTO creator_team FROM public.profiles WHERE id = NEW.created_by;
    SELECT public.has_role(NEW.created_by, 'do'::app_role) INTO is_do;
    SELECT public.has_role(NEW.created_by, 'team_lead'::app_role) INTO is_tl;

    IF is_do THEN
      NEW.assigned_do_id := NEW.created_by;
      IF NEW.team_id IS NULL THEN NEW.team_id := creator_team; END IF;
      SELECT lead_id INTO team_lead FROM public.teams WHERE id = COALESCE(NEW.team_id, creator_team);
      NEW.team_lead_id := team_lead;
    ELSIF is_tl THEN
      NEW.team_lead_id := NEW.created_by;
      IF NEW.team_id IS NULL THEN NEW.team_id := creator_team; END IF;
    ELSE
      -- Admin: derive TL from assigned_do or team
      IF NEW.assigned_do_id IS NOT NULL THEN
        SELECT team_id INTO creator_team FROM public.profiles WHERE id = NEW.assigned_do_id;
        IF NEW.team_id IS NULL THEN NEW.team_id := creator_team; END IF;
      END IF;
      IF NEW.team_id IS NOT NULL THEN
        SELECT lead_id INTO team_lead FROM public.teams WHERE id = NEW.team_id;
        NEW.team_lead_id := team_lead;
      END IF;
    END IF;
  END IF;

  -- Net premium = Gross - commission_before_tax (spec: gross - commission)
  NEW.net_premium := round(GREATEST(0, COALESCE(NEW.gross_premium,0) - (COALESCE(NEW.commission_percentage,0) * COALESCE(NEW.gross_premium,0) / 100.0))::numeric, 2);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS deals_autofill ON public.deals;
CREATE TRIGGER deals_autofill BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.tg_deals_autofill();

-- 4. Backfill existing rows
UPDATE public.clients c
SET do_id = COALESCE(c.do_id, c.created_by),
    team_lead_id = COALESCE(c.team_lead_id, (SELECT lead_id FROM public.teams WHERE id = c.team_id))
WHERE c.do_id IS NULL OR c.team_lead_id IS NULL;

UPDATE public.deals d
SET team_lead_id = COALESCE(d.team_lead_id, (SELECT lead_id FROM public.teams WHERE id = d.team_id)),
    net_premium = round(GREATEST(0, COALESCE(d.gross_premium,0) - (COALESCE(d.commission_percentage,0) * COALESCE(d.gross_premium,0) / 100.0))::numeric, 2);

-- 5. Tighten RLS: TLs see records by team_lead_id snapshot (not only team)
DROP POLICY IF EXISTS deals_select ON public.deals;
CREATE POLICY deals_select ON public.deals FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR (has_role(auth.uid(), 'team_lead'::app_role) AND (team_lead_id = auth.uid() OR team_id = current_user_team()))
  OR assigned_do_id = auth.uid()
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS deals_update ON public.deals;
CREATE POLICY deals_update ON public.deals FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'team_lead'::app_role) AND (team_lead_id = auth.uid() OR team_id = current_user_team()))
  OR assigned_do_id = auth.uid()
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'management'::app_role)
  OR (has_role(auth.uid(), 'team_lead'::app_role) AND (team_lead_id = auth.uid() OR team_id = current_user_team()))
  OR created_by = auth.uid()
  OR do_id = auth.uid()
);

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'team_lead'::app_role) AND (team_lead_id = auth.uid() OR team_id = current_user_team()))
  OR created_by = auth.uid()
  OR do_id = auth.uid()
);

-- 6. Seed requested insurance companies (idempotent)
INSERT INTO public.insurance_companies(name)
SELECT n FROM (VALUES
  ('Jubilee'),('Adamjee'),('EFU'),('TPL'),('Askari'),('Habib'),('IGI'),
  ('State Life'),('UIC'),('East West'),('Century'),('Direct Insurance'),('Other')
) AS t(n)
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_companies ic WHERE lower(ic.name) = lower(t.n));
