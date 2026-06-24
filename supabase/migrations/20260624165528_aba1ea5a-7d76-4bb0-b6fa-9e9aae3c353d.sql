
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'management', 'team_lead', 'do');

-- ============ HELPER: updated_at ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ TEAMS ============
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL DEFAULT '',
  lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  designation TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_team()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid()
$$;

-- handle new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'do');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ MASTER DATA ============
CREATE TABLE public.insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_companies TO authenticated;
GRANT ALL ON public.insurance_companies TO service_role;
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.insurance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_types TO authenticated;
GRANT ALL ON public.insurance_types TO service_role;
ALTER TABLE public.insurance_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_stages TO authenticated;
GRANT ALL ON public.deal_stages TO service_role;
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sources TO authenticated;
GRANT ALL ON public.lead_sources TO service_role;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  poc_name TEXT,
  poc_number TEXT,
  poc_email TEXT,
  poc_address TEXT,
  industry TEXT,
  ntn TEXT,
  existing_insurance_company TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_clients_created_by ON public.clients(created_by);
CREATE INDEX idx_clients_team ON public.clients(team_id);

-- ============ DEALS ============
CREATE SEQUENCE public.deal_number_seq START 1000;

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_number TEXT NOT NULL UNIQUE DEFAULT ('DEAL-' || LPAD(nextval('public.deal_number_seq')::text, 6, '0')),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cover_note_number TEXT,
  policy_number TEXT,
  source_id UUID REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  insurance_company_id UUID REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  insurance_type_id UUID REFERENCES public.insurance_types(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  assigned_do_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  -- premium & commission inputs
  gross_premium NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_premium NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
  marketing_budget_percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
  loading NUMERIC(14,2) NOT NULL DEFAULT 0,
  b2b_commission NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- generated calculations
  commission_before_tax NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(commission_percentage * gross_premium / 100.0, 2)) STORED,
  commission_after_tax NUMERIC(14,2) GENERATED ALWAYS AS (ROUND((commission_percentage * gross_premium / 100.0) * 0.83, 2)) STORED,
  marketing_before_tax NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(marketing_budget_percentage * gross_premium / 100.0, 2)) STORED,
  marketing_after_tax NUMERIC(14,2) GENERATED ALWAYS AS (ROUND((marketing_budget_percentage * gross_premium / 100.0) * 0.91, 2)) STORED,
  total_income NUMERIC(14,2) GENERATED ALWAYS AS (
    ROUND(
      (commission_percentage * gross_premium / 100.0) * 0.83
      + (marketing_budget_percentage * gross_premium / 100.0) * 0.91
      + loading + b2b_commission, 2)
  ) STORED,
  income_percentage NUMERIC(8,4) GENERATED ALWAYS AS (
    CASE WHEN gross_premium > 0 THEN
      ROUND(((commission_percentage * gross_premium / 100.0) * 0.83
        + (marketing_budget_percentage * gross_premium / 100.0) * 0.91
        + loading + b2b_commission) / gross_premium * 100.0, 4)
    ELSE 0 END
  ) STORED,
  policy_start_date DATE,
  policy_end_date DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER deals_updated BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_deals_assigned ON public.deals(assigned_do_id);
CREATE INDEX idx_deals_team ON public.deals(team_id);
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_deals_created_at ON public.deals(created_at);

-- ============ DOCUMENTS ============
CREATE TABLE public.deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  doc_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_documents TO authenticated;
GRANT ALL ON public.deal_documents TO service_role;
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

-- ============ FK back for teams.lead_id ============
ALTER TABLE public.teams ADD CONSTRAINT teams_lead_fk FOREIGN KEY (lead_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- POLICIES
-- ============================================================

-- profiles: everyone authenticated can read (for team/DO display); user updates own; admin manages all
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin_all ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles: user sees own; admin manages all
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- teams: read all auth; admin write
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY teams_admin_write ON public.teams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- master data: select for all authenticated; admin write
CREATE POLICY ic_sel ON public.insurance_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY ic_adm ON public.insurance_companies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY it_sel ON public.insurance_types FOR SELECT TO authenticated USING (true);
CREATE POLICY it_adm ON public.insurance_types FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY ds_sel ON public.deal_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY ds_adm ON public.deal_stages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY ls_sel ON public.lead_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY ls_adm ON public.lead_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY as_sel ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY as_adm ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- clients: DO sees own; team_lead sees team; mgmt/admin all
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'management')
  OR (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team())
  OR created_by = auth.uid()
);
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR created_by = auth.uid()
  OR (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team())
);
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- deals
CREATE POLICY deals_select ON public.deals FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'management')
  OR (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team())
  OR assigned_do_id = auth.uid()
  OR created_by = auth.uid()
);
CREATE POLICY deals_insert ON public.deals FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY deals_update ON public.deals FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR assigned_do_id = auth.uid()
  OR created_by = auth.uid()
  OR (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team())
);
CREATE POLICY deals_delete ON public.deals FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- documents: follow deal/client access
CREATE POLICY dd_select ON public.deal_documents FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND (d.assigned_do_id = auth.uid() OR d.created_by = auth.uid() OR (public.has_role(auth.uid(),'team_lead') AND d.team_id = public.current_user_team())))
  OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND (c.created_by = auth.uid() OR (public.has_role(auth.uid(),'team_lead') AND c.team_id = public.current_user_team())))
);
CREATE POLICY dd_insert ON public.deal_documents FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY dd_delete ON public.deal_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR uploaded_by = auth.uid());

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO public.teams (name, location) VALUES
  ('Lahore Head Office', 'Lahore'),
  ('Shahdra Team', 'Shahdra'),
  ('Karachi Team', 'Karachi'),
  ('Lahore Team A', 'Lahore');

INSERT INTO public.insurance_companies (name) VALUES
  ('EFU General Insurance'),('Jubilee General Insurance'),('Adamjee Insurance'),
  ('IGI Insurance'),('TPL Insurance'),('UBL Insurers'),('Askari General Insurance');

INSERT INTO public.insurance_types (name) VALUES
  ('Motor'),('Health'),('Fire & Property'),('Marine'),('Travel'),('Life'),('Engineering'),('Liability');

INSERT INTO public.deal_stages (name, sort_order, is_won, is_lost) VALUES
  ('New Lead', 10, false, false),
  ('Quotation Sent', 20, false, false),
  ('Negotiation', 30, false, false),
  ('Cover Note Issued', 40, false, false),
  ('Policy Issued', 50, true, false),
  ('Won', 60, true, false),
  ('Lost', 70, false, true);

INSERT INTO public.lead_sources (name) VALUES
  ('Referral'),('Cold Call'),('Website'),('Walk-in'),('Existing Client'),('Marketing Campaign'),('LinkedIn');

INSERT INTO public.app_settings (key, value) VALUES
  ('tagged_premium_base_percentage', '13'::jsonb),
  ('commission_tax_percentage', '17'::jsonb),
  ('marketing_tax_percentage', '9'::jsonb);
