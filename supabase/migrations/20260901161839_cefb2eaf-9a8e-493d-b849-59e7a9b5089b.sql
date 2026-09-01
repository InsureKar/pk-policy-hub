-- ENUMS
CREATE TYPE public.ticket_status AS ENUM ('new','assigned','in_progress','on_hold','resolved','closed','reopened');
CREATE TYPE public.ticket_priority AS ENUM ('critical','high','medium','low');
CREATE TYPE public.ticket_department AS ENUM ('operations','accounts','technology','sales');
CREATE TYPE public.ticket_assignee_kind AS ENUM ('employee','team','department');

-- CATEGORIES
CREATE TABLE public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department public.ticket_department NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_categories TO authenticated;
GRANT ALL ON public.ticket_categories TO service_role;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_read" ON public.ticket_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_write" ON public.ticket_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- SLA SETTINGS
CREATE TABLE public.ticket_sla_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority public.ticket_priority NOT NULL,
  category_id uuid REFERENCES public.ticket_categories(id) ON DELETE CASCADE,
  hours numeric NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ticket_sla_priority_default ON public.ticket_sla_settings (priority) WHERE category_id IS NULL;
CREATE UNIQUE INDEX ticket_sla_priority_cat ON public.ticket_sla_settings (priority, category_id) WHERE category_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_sla_settings TO authenticated;
GRANT ALL ON public.ticket_sla_settings TO service_role;
ALTER TABLE public.ticket_sla_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_read" ON public.ticket_sla_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_write" ON public.ticket_sla_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

-- TICKETS
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  subject text NOT NULL,
  description text,
  department public.ticket_department NOT NULL,
  service_module text,
  category_id uuid REFERENCES public.ticket_categories(id),
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'new',
  assignee_kind public.ticket_assignee_kind,
  assigned_to uuid REFERENCES public.profiles(id),
  assigned_team_id uuid REFERENCES public.teams(id),
  assigned_department public.ticket_department,
  due_date date,
  sla_due_at timestamptz,
  sla_breached boolean NOT NULL DEFAULT false,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_minutes integer,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL,
  policy_number text,
  insurance_company_id uuid REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tickets_status_idx ON public.tickets (status);
CREATE INDEX tickets_assigned_idx ON public.tickets (assigned_to);
CREATE INDEX tickets_deal_idx ON public.tickets (deal_id);
CREATE INDEX tickets_client_idx ON public.tickets (client_id);
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_ticket(_t public.tickets)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'management')
      OR _t.created_by = auth.uid()
      OR _t.assigned_to = auth.uid()
      OR (_t.assigned_team_id IS NOT NULL AND _t.assigned_team_id = public.current_user_team())
$$;

CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated
  USING (public.can_view_ticket(tickets));
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated
  USING (public.can_view_ticket(tickets))
  WITH CHECK (public.can_view_ticket(tickets));

-- COMMENTS
CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id),
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_select" ON public.ticket_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.can_view_ticket(t)));
CREATE POLICY "tc_insert" ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.can_view_ticket(t)));

-- ATTACHMENTS
CREATE TABLE public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_select" ON public.ticket_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.can_view_ticket(t)));
CREATE POLICY "ta_insert" ON public.ticket_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.can_view_ticket(t)));

-- ACTIVITY
CREATE TABLE public.ticket_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_activity TO authenticated;
GRANT ALL ON public.ticket_activity TO service_role;
ALTER TABLE public.ticket_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tact_select" ON public.ticket_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND public.can_view_ticket(t)));

-- NUMBERING + SLA
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq START 1;
CREATE OR REPLACE FUNCTION public.tg_ticket_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
      NEW.ticket_number := 'TKT-' || lpad(nextval('public.ticket_number_seq')::text, 5, '0');
    END IF;
  END IF;
  SELECT hours INTO h FROM public.ticket_sla_settings
    WHERE priority = NEW.priority AND (category_id = NEW.category_id OR category_id IS NULL)
    ORDER BY category_id NULLS LAST LIMIT 1;
  IF h IS NOT NULL THEN
    NEW.sla_due_at := COALESCE(NEW.created_at, now()) + (h || ' hours')::interval;
  END IF;
  IF NEW.status IN ('resolved','closed') THEN
    IF NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    NEW.resolution_minutes := GREATEST(0, (EXTRACT(EPOCH FROM (NEW.resolved_at - COALESCE(NEW.created_at, now())))/60)::int);
    IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  ELSE
    NEW.resolved_at := NULL; NEW.closed_at := NULL; NEW.resolution_minutes := NULL;
  END IF;
  NEW.sla_breached := (NEW.sla_due_at IS NOT NULL
    AND COALESCE(NEW.resolved_at, now()) > NEW.sla_due_at);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_before BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_before();

CREATE OR REPLACE FUNCTION public.tg_ticket_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_activity(ticket_id, actor_id, action, detail)
      VALUES (NEW.id, auth.uid(), 'created', 'Ticket ' || NEW.ticket_number || ' created');
    IF NEW.assigned_to IS NOT NULL OR NEW.assigned_team_id IS NOT NULL OR NEW.assigned_department IS NOT NULL THEN
      INSERT INTO public.ticket_activity(ticket_id, actor_id, action, detail)
        VALUES (NEW.id, auth.uid(), 'assigned', 'Ticket assigned');
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_activity(ticket_id, actor_id, action, detail)
      VALUES (NEW.id, auth.uid(), 'status', 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.ticket_activity(ticket_id, actor_id, action, detail)
      VALUES (NEW.id, auth.uid(), 'priority', 'Priority changed from ' || OLD.priority || ' to ' || NEW.priority);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.assigned_team_id IS DISTINCT FROM OLD.assigned_team_id
     OR NEW.assigned_department IS DISTINCT FROM OLD.assigned_department THEN
    INSERT INTO public.ticket_activity(ticket_id, actor_id, action, detail)
      VALUES (NEW.id, auth.uid(), 'assigned', 'Ticket reassigned');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_activity AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_activity();

CREATE OR REPLACE FUNCTION public.tg_ticket_comment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ticket_activity(ticket_id, actor_id, action, detail)
    VALUES (NEW.ticket_id, NEW.author_id, 'comment', left(NEW.body, 160));
  RETURN NEW;
END $$;
CREATE TRIGGER ticket_comment_activity AFTER INSERT ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_comment_activity();

CREATE OR REPLACE FUNCTION public.tg_ticket_attachment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ticket_activity(ticket_id, actor_id, action, detail)
    VALUES (NEW.ticket_id, NEW.uploaded_by, 'attachment', 'Uploaded ' || NEW.file_name);
  RETURN NEW;
END $$;
CREATE TRIGGER ticket_attachment_activity AFTER INSERT ON public.ticket_attachments
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_attachment_activity();

-- SEED SLA
INSERT INTO public.ticket_sla_settings(priority, hours) VALUES
  ('critical', 2), ('high', 4), ('medium', 8), ('low', 24);

-- SEED CATEGORIES
INSERT INTO public.ticket_categories(department, name, sort_order) VALUES
  ('operations','Employee Fluctuation',1),
  ('operations','Policy Issuance',2),
  ('operations','Endorsement',3),
  ('operations','Claims',4),
  ('operations','Documents',5),
  ('operations','Posting',6),
  ('operations','Renewal',7),
  ('operations','Other',8),
  ('accounts','Invoice',1),
  ('accounts','Payment',2),
  ('accounts','Receivable',3),
  ('accounts','Payable',4),
  ('accounts','Commission',5),
  ('accounts','B2B Commission',6),
  ('accounts','Tax',7),
  ('accounts','Expense',8),
  ('technology','Bug',1),
  ('technology','Portal Issue',2),
  ('technology','Login/Access',3),
  ('technology','Data Issue',4),
  ('technology','API/Integration',5),
  ('technology','Upload Issue',6),
  ('technology','Dashboard Issue',7),
  ('technology','Report Issue',8),
  ('technology','Feature Request',9),
  ('sales','Lead',1),
  ('sales','Quotation',2),
  ('sales','Client Requirement',3),
  ('sales','Policy',4),
  ('sales','Renewal',5),
  ('sales','Other',6);