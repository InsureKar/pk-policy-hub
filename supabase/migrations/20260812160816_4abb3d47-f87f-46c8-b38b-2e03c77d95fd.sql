ALTER TABLE public.deal_policies ADD COLUMN IF NOT EXISTS policy_number_norm text;

UPDATE public.deal_policies SET policy_number_norm = public.normalize_policy_number(policy_number) WHERE policy_number_norm IS NULL;

CREATE OR REPLACE FUNCTION public.tg_deal_policies_norm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.policy_number_norm := public.normalize_policy_number(NEW.policy_number);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deal_policies_norm ON public.deal_policies;
CREATE TRIGGER deal_policies_norm BEFORE INSERT OR UPDATE ON public.deal_policies
FOR EACH ROW EXECUTE FUNCTION public.tg_deal_policies_norm();

CREATE UNIQUE INDEX IF NOT EXISTS deal_policies_policy_number_norm_key
  ON public.deal_policies (policy_number_norm) WHERE policy_number_norm IS NOT NULL;

CREATE OR REPLACE FUNCTION public.deal_policy_conflict(_policy_number text, _exclude_row uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text := public.normalize_policy_number(_policy_number);
  res jsonb;
BEGIN
  IF n IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object('source','bulk_policy','policy_number', dp.policy_number,
                            'deal_number', d.deal_number, 'deal_id', d.id,
                            'client_name', coalesce(c.company_name, c.full_name),
                            'created_at', dp.created_at)
  INTO res
  FROM public.deal_policies dp
  JOIN public.deals d ON d.id = dp.deal_id
  LEFT JOIN public.clients c ON c.id = d.client_id
  WHERE dp.policy_number_norm = n AND (_exclude_row IS NULL OR dp.id <> _exclude_row)
  LIMIT 1;
  IF res IS NOT NULL THEN RETURN res; END IF;

  SELECT jsonb_build_object('source','deal','policy_number', d.policy_number,
                            'deal_number', d.deal_number, 'deal_id', d.id,
                            'client_name', coalesce(c.company_name, c.full_name),
                            'created_at', d.created_at)
  INTO res
  FROM public.deals d
  LEFT JOIN public.clients c ON c.id = d.client_id
  WHERE public.normalize_policy_number(d.policy_number) = n
  LIMIT 1;
  RETURN res;
END $$;

REVOKE ALL ON FUNCTION public.deal_policy_conflict(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deal_policy_conflict(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_deal_policies_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict jsonb;
BEGIN
  IF NEW.policy_number_norm IS NULL THEN RETURN NEW; END IF;
  conflict := public.deal_policy_conflict(NEW.policy_number, NEW.id);
  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate policy number % already used on deal %', NEW.policy_number, conflict->>'deal_number';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deal_policies_unique ON public.deal_policies;
CREATE TRIGGER deal_policies_unique BEFORE INSERT OR UPDATE ON public.deal_policies
FOR EACH ROW EXECUTE FUNCTION public.tg_deal_policies_unique();