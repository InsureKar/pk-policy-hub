ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS payment_proof_url text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS payment_year integer;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS poc_designation text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS poc_department text;

DROP POLICY IF EXISTS deals_delete ON public.deals;
CREATE POLICY deals_delete ON public.deals FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

DROP POLICY IF EXISTS deals_update ON public.deals;
CREATE POLICY deals_update ON public.deals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR (public.has_role(auth.uid(),'team_lead') AND (team_lead_id = auth.uid() OR team_id = public.current_user_team()))
  OR assigned_do_id = auth.uid() OR created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR created_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR created_by = auth.uid() OR assigned_to = auth.uid())
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management')
  OR created_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') OR created_by = auth.uid());

CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date);