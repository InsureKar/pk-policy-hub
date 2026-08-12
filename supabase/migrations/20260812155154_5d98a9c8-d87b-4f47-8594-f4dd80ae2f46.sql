
-- ============ 1. PERMISSIONS ============
CREATE TYPE public.app_module AS ENUM ('dashboard','leads','clients','deals','renewals','accounts','operations','reports','admin','settings');
CREATE TYPE public.permission_level AS ENUM ('none','view','edit','add');

CREATE TABLE public.user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  level public.permission_level NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_permissions TO authenticated;
GRANT ALL ON public.user_module_permissions TO service_role;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or admin" ON public.user_module_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "manage by admin/management" ON public.user_module_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE TRIGGER ump_updated BEFORE UPDATE ON public.user_module_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid,
  user_affected uuid NOT NULL,
  module text,
  previous_value text,
  new_value text,
  change_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.permission_audit_log TO authenticated;
GRANT ALL ON public.permission_audit_log TO service_role;
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read admin" ON public.permission_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "audit insert" ON public.permission_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_permission_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'user_module_permissions' THEN
    INSERT INTO public.permission_audit_log(changed_by, user_affected, module, previous_value, new_value, change_type)
    VALUES (auth.uid(), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.module, OLD.module)::text,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.level::text END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.level::text END,
            'module_permission');
  ELSE
    INSERT INTO public.permission_audit_log(changed_by, user_affected, module, previous_value, new_value, change_type)
    VALUES (auth.uid(), COALESCE(NEW.user_id, OLD.user_id), 'role',
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role::text END,
            CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.role::text END,
            'role');
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER ump_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_module_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_permission_audit();
CREATE TRIGGER roles_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_permission_audit();

-- Role changes restricted to admin/management
CREATE OR REPLACE FUNCTION public.tg_guard_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')) THEN
    RAISE EXCEPTION 'Only Management can assign or change roles';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER roles_guard BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_role_change();

-- Effective level + enforcement helpers
CREATE OR REPLACE FUNCTION public.module_level(_user uuid, _module public.app_module)
RETURNS public.permission_level LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.level FROM public.user_module_permissions p WHERE p.user_id = _user AND p.module = _module),
    'add'::public.permission_level)
$$;

CREATE OR REPLACE FUNCTION public.perm_rank(_l public.permission_level)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _l WHEN 'none' THEN 0 WHEN 'view' THEN 1 WHEN 'edit' THEN 2 WHEN 'add' THEN 3 END
$$;

CREATE OR REPLACE FUNCTION public.module_allows(_module public.app_module, _min public.permission_level)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN true
              ELSE public.perm_rank(public.module_level(auth.uid(), _module)) >= public.perm_rank(_min) END
$$;

-- Restrictive policies: AND-ed with existing policies. Default level is 'add', so no behaviour change
-- until Management explicitly restricts a user.
DO $$
DECLARE t text; m text;
BEGIN
  FOR t, m IN SELECT * FROM (VALUES
    ('clients','clients'), ('deals','deals'), ('policies','renewals'),
    ('receivables','accounts'), ('invoices','accounts'), ('installments','accounts'),
    ('payments','accounts'), ('commission_payables','accounts'),
    ('expenses','operations'), ('reimbursements','operations'),
    ('payroll_runs','operations'), ('salary_revisions','operations')
  ) AS v(t,m) LOOP
    EXECUTE format($f$
      CREATE POLICY "module_read_guard" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
        USING (public.module_allows(%L::public.app_module, 'view'));
      CREATE POLICY "module_add_guard" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (public.module_allows(%L::public.app_module, 'add'));
      CREATE POLICY "module_edit_guard" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (public.module_allows(%L::public.app_module, 'edit'))
        WITH CHECK (public.module_allows(%L::public.app_module, 'edit'));
      CREATE POLICY "module_delete_guard" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
        USING (public.module_allows(%L::public.app_module, 'edit'));
    $f$, t, m, t, m, t, m, m, t, m);
  END LOOP;
END $$;

-- ============ 2. TRAVEL POLICY NUMBER UNIQUENESS ============
CREATE OR REPLACE FUNCTION public.normalize_policy_number(_v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(upper(regexp_replace(coalesce(_v,''), '[^A-Za-z0-9]', '', 'g')), '')
$$;

ALTER TABLE public.travel_posting_rows
  ADD COLUMN policy_number_norm text GENERATED ALWAYS AS (public.normalize_policy_number(policy_number)) STORED;

CREATE UNIQUE INDEX travel_posting_rows_policy_unique
  ON public.travel_posting_rows (policy_number_norm)
  WHERE policy_number_norm IS NOT NULL;

-- Cross-record check against travel deals and bulk policy rows of travel deals
CREATE OR REPLACE FUNCTION public.travel_policy_conflict(_policy_number text, _exclude_row uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := public.normalize_policy_number(_policy_number);
  res jsonb;
BEGIN
  IF n IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object('source','posting','policy_number', r.policy_number,
                            'posting_date', p.created_at, 'posting_reference', p.id)
  INTO res
  FROM public.travel_posting_rows r
  JOIN public.travel_postings p ON p.id = r.posting_id
  WHERE r.policy_number_norm = n AND (_exclude_row IS NULL OR r.id <> _exclude_row)
  LIMIT 1;
  IF res IS NOT NULL THEN RETURN res; END IF;

  SELECT jsonb_build_object('source','deal','policy_number', d.policy_number,
                            'posting_date', d.created_at, 'posting_reference', d.deal_number)
  INTO res
  FROM public.deals d
  JOIN public.insurance_types it ON it.id = d.insurance_type_id
  WHERE lower(it.name) = 'travel' AND public.normalize_policy_number(d.policy_number) = n
  LIMIT 1;
  IF res IS NOT NULL THEN RETURN res; END IF;

  SELECT jsonb_build_object('source','bulk_policy','policy_number', dp.policy_number,
                            'posting_date', dp.created_at, 'posting_reference', d.deal_number)
  INTO res
  FROM public.deal_policies dp
  JOIN public.deals d ON d.id = dp.deal_id
  JOIN public.insurance_types it ON it.id = d.insurance_type_id
  WHERE lower(it.name) = 'travel' AND public.normalize_policy_number(dp.policy_number) = n
  LIMIT 1;
  RETURN res;
END $$;

GRANT EXECUTE ON FUNCTION public.travel_policy_conflict(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_travel_row_policy_unique()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb;
BEGIN
  IF public.normalize_policy_number(NEW.policy_number) IS NULL THEN RETURN NEW; END IF;
  c := public.travel_policy_conflict(NEW.policy_number, NEW.id);
  IF c IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate Policy Number — this policy has already been posted (%).', COALESCE(c->>'posting_reference','existing record');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER travel_row_policy_unique
BEFORE INSERT OR UPDATE OF policy_number ON public.travel_posting_rows
FOR EACH ROW EXECUTE FUNCTION public.tg_travel_row_policy_unique();
