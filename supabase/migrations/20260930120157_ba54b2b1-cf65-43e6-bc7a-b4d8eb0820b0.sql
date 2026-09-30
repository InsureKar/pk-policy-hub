ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time time, ADD COLUMN IF NOT EXISTS attachment_path text, ADD COLUMN IF NOT EXISTS attachment_name text;

CREATE OR REPLACE FUNCTION public.is_team_lead_of(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND public.has_role(auth.uid(),'team_lead') AND (
    _user = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = _user AND t.lead_id = auth.uid()))
$$;

CREATE POLICY tasks_select_team_lead ON public.tasks FOR SELECT TO authenticated
  USING (public.is_team_lead_of(assigned_to) OR public.is_team_lead_of(created_by));
CREATE POLICY tasks_update_team_lead ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_team_lead_of(assigned_to) OR public.is_team_lead_of(created_by))
  WITH CHECK (public.is_team_lead_of(assigned_to) OR public.is_team_lead_of(created_by));

CREATE TABLE public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_activity TO authenticated;
GRANT ALL ON public.task_activity TO service_role;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_activity_select ON public.task_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));

CREATE OR REPLACE FUNCTION public.tg_task_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text := '';
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity(task_id, actor_id, action, details) VALUES (NEW.id, auth.uid(), 'created', NEW.title);
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN d := d || 'Status: ' || OLD.status || ' → ' || NEW.status || '. '; END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN d := d || 'Reassigned. '; END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN d := d || 'Priority: ' || OLD.priority || ' → ' || NEW.priority || '. '; END IF;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.due_time IS DISTINCT FROM OLD.due_time THEN d := d || 'Due changed. '; END IF;
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description THEN d := d || 'Details edited. '; END IF;
    IF NEW.attachment_path IS DISTINCT FROM OLD.attachment_path THEN d := d || 'Attachment updated. '; END IF;
    IF d <> '' THEN INSERT INTO public.task_activity(task_id, actor_id, action, details) VALUES (NEW.id, auth.uid(), 'updated', trim(d)); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_activity_trg AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tg_task_activity();

CREATE POLICY task_attachment_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-documents' AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.attachment_path = objects.name));