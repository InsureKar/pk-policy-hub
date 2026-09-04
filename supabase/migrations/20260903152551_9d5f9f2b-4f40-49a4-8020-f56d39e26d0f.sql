CREATE TABLE public.dispatch_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level public.permission_level NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_access TO authenticated;
GRANT ALL ON public.dispatch_access TO service_role;
ALTER TABLE public.dispatch_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispatch_access_read" ON public.dispatch_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE POLICY "dispatch_access_manage" ON public.dispatch_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE TRIGGER dispatch_access_updated_at BEFORE UPDATE ON public.dispatch_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.dispatch_allows(_min public.permission_level)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') THEN true
    ELSE public.perm_rank(COALESCE((SELECT level FROM public.dispatch_access WHERE user_id = auth.uid()), 'none'))
         >= public.perm_rank(_min)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.dispatch_allows(public.permission_level) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.dispatch_allows(public.permission_level) TO authenticated;

CREATE TABLE public.dispatch_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_kind text NOT NULL DEFAULT 'dispatched',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  dispatch_date date NOT NULL DEFAULT CURRENT_DATE,
  tracking_number text,
  document_status text NOT NULL DEFAULT 'dispatched',
  document_type text NOT NULL,
  description text,
  dispatcher_name text,
  receiver_name text,
  card_count integer,
  cheque_number text,
  cheque_payee text,
  cheque_amount numeric(14,2),
  cheque_status text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_records TO authenticated;
GRANT ALL ON public.dispatch_records TO service_role;
ALTER TABLE public.dispatch_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispatch_records_select" ON public.dispatch_records FOR SELECT TO authenticated
  USING (public.dispatch_allows('view'));
CREATE POLICY "dispatch_records_insert" ON public.dispatch_records FOR INSERT TO authenticated
  WITH CHECK (public.dispatch_allows('add') AND created_by = auth.uid());
CREATE POLICY "dispatch_records_update" ON public.dispatch_records FOR UPDATE TO authenticated
  USING (public.dispatch_allows('edit')) WITH CHECK (public.dispatch_allows('edit'));
CREATE POLICY "dispatch_records_delete" ON public.dispatch_records FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));
CREATE TRIGGER dispatch_records_updated_at BEFORE UPDATE ON public.dispatch_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_dispatch_records_date ON public.dispatch_records(dispatch_date DESC);
CREATE INDEX idx_dispatch_records_client ON public.dispatch_records(client_id);