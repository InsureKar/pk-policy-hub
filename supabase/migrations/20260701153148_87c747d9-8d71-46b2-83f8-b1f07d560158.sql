
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE public.line_of_business AS ENUM ('group_health','motor','marine','travel','fire','misc');

CREATE TABLE public.company_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.insurance_companies(id) ON DELETE CASCADE,
  line_of_business public.line_of_business NOT NULL,
  percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, line_of_business)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_commission_rates TO authenticated;
GRANT ALL ON public.company_commission_rates TO service_role;
ALTER TABLE public.company_commission_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ccr_read" ON public.company_commission_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "ccr_admin" ON public.company_commission_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ccr_upd BEFORE UPDATE ON public.company_commission_rates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  line_of_business public.line_of_business,
  premium NUMERIC(14,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policies TO authenticated;
GRANT ALL ON public.policies TO service_role;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pol_sel" ON public.policies FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team())
  OR owner_id = auth.uid()
);
CREATE POLICY "pol_ins" ON public.policies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pol_upd" ON public.policies FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR owner_id = auth.uid()
  OR (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team())
);
CREATE POLICY "pol_del" ON public.policies FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_pol_upd BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_pol_end ON public.policies(end_date);
CREATE INDEX idx_pol_owner ON public.policies(owner_id);
CREATE INDEX idx_pol_team ON public.policies(team_id);

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  version INT NOT NULL DEFAULT 1,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_sel" ON public.documents FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR (public.has_role(auth.uid(),'team_lead') AND team_id = public.current_user_team())
  OR uploaded_by = auth.uid()
);
CREATE POLICY "doc_ins" ON public.documents FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "doc_upd" ON public.documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR uploaded_by = auth.uid());
CREATE POLICY "doc_del" ON public.documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR uploaded_by = auth.uid());
CREATE TRIGGER trg_doc_upd BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dv_sel" ON public.document_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id=document_id));
CREATE POLICY "dv_ins" ON public.document_versions FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_sel" ON public.activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') OR actor_id = auth.uid());
CREATE POLICY "act_ins" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
CREATE INDEX idx_act_created ON public.activity_log(created_at DESC);

INSERT INTO public.insurance_companies (name, active) VALUES ('United Insurance', true) ON CONFLICT (name) DO NOTHING;

INSERT INTO public.company_commission_rates (company_id, line_of_business, percentage)
SELECT c.id, lob, 0
FROM public.insurance_companies c
CROSS JOIN unnest(ARRAY['group_health','motor','marine','travel','fire','misc']::public.line_of_business[]) AS lob
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW public.v_renewals AS
SELECT p.*,
  CASE
    WHEN p.end_date < CURRENT_DATE THEN 'expired'
    WHEN p.end_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due'
    WHEN p.end_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'upcoming'
    ELSE 'completed'
  END AS renewal_status
FROM public.policies p;
GRANT SELECT ON public.v_renewals TO authenticated;
