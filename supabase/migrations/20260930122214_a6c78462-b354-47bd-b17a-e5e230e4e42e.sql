
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS module text, ADD COLUMN IF NOT EXISTS summary text, ADD COLUMN IF NOT EXISTS old_value jsonb, ADD COLUMN IF NOT EXISTS new_value jsonb;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'activity',
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  dedupe_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notifications_dedupe ON public.notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_sel_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_upd_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_del_own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Generic activity logger
CREATE OR REPLACE FUNCTION public.tg_log_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _name text;
  _rec jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  _old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  _label text; _module text := TG_ARGV[0]; _noun text := TG_ARGV[1];
  _verb text; _summary text; _diff_old jsonb := '{}'; _diff_new jsonb := '{}';
  _k text; _etype text := TG_ARGV[2]; _eid uuid; _s1 text; _s2 text;
  _ignore text[] := ARRAY['updated_at','created_at'];
BEGIN
  IF _actor IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(nullif(full_name,''), email, 'A user') INTO _name FROM profiles WHERE id = _actor;
  _name := coalesce(_name, 'A user');
  _label := coalesce(_rec->>'deal_number', _rec->>'invoice_number', _rec->>'policy_number', _rec->>'title', _rec->>'name', _rec->>'company_name', _rec->>'label', _rec->>'file_name', _rec->>'code', '');
  IF _etype = 'deal' AND _rec ? 'deal_id' THEN _eid := (_rec->>'deal_id')::uuid; ELSE _eid := (_rec->>'id')::uuid; END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR _k IN SELECT jsonb_object_keys(_rec) LOOP
      IF NOT (_k = ANY(_ignore)) AND (_rec->_k) IS DISTINCT FROM (_old->_k) THEN
        _diff_old := _diff_old || jsonb_build_object(_k, _old->_k);
        _diff_new := _diff_new || jsonb_build_object(_k, _rec->_k);
      END IF;
    END LOOP;
    IF _diff_new = '{}'::jsonb THEN RETURN NULL; END IF;
  END IF;

  _verb := CASE TG_OP WHEN 'INSERT' THEN 'added' WHEN 'UPDATE' THEN 'edited' ELSE 'deleted' END;
  _summary := format('%s %s %s %s', _name, _verb, _noun, _label);

  IF TG_TABLE_NAME = 'deals' AND TG_OP = 'UPDATE' AND _diff_new ? 'stage_id' THEN
    SELECT name INTO _s1 FROM deal_stages WHERE id = (_old->>'stage_id')::uuid;
    SELECT name INTO _s2 FROM deal_stages WHERE id = (_rec->>'stage_id')::uuid;
    _summary := format('%s changed Deal %s stage from %s to %s', _name, _label, coalesce(_s1,'—'), coalesce(_s2,'—'));
  ELSIF TG_TABLE_NAME = 'deal_installments' AND TG_OP = 'UPDATE' AND (_diff_new->>'payment_status') = 'paid' THEN
    _summary := format('%s marked %s as Paid', _name, coalesce(nullif(_label,''),'an instalment'));
  ELSIF TG_TABLE_NAME = 'tasks' AND TG_OP = 'UPDATE' AND lower(coalesce(_diff_new->>'status','')) IN ('completed','done') THEN
    _summary := format('%s completed Task %s', _name, _label);
  END IF;

  INSERT INTO activity_log(actor_id, action, entity_type, entity_id, metadata, module, summary, old_value, new_value)
  VALUES (_actor, lower(TG_OP), _etype, _eid, jsonb_build_object('table', TG_TABLE_NAME, 'label', _label), _module, _summary,
    CASE WHEN TG_OP='UPDATE' THEN _diff_old WHEN TG_OP='DELETE' THEN _old END,
    CASE WHEN TG_OP='UPDATE' THEN _diff_new WHEN TG_OP='INSERT' THEN _rec END);

  INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, created_by)
  SELECT DISTINCT ur.user_id, 'activity', _module || ' activity', _summary, _etype, _eid, _actor
  FROM user_roles ur WHERE ur.role IN ('management','admin') AND ur.user_id <> _actor;

  -- Notify task assignee
  IF TG_TABLE_NAME = 'tasks' AND (_rec->>'assigned_to') IS NOT NULL AND (_rec->>'assigned_to')::uuid <> _actor
     AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = (_rec->>'assigned_to')::uuid AND role IN ('management','admin'))
     AND (TG_OP = 'INSERT' OR _diff_new ? 'assigned_to' OR _diff_new ? 'status' OR _diff_new ? 'due_date') THEN
    INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, created_by)
    VALUES ((_rec->>'assigned_to')::uuid, 'activity', 'Task update', _summary, 'task', (_rec->>'id')::uuid, _actor);
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('deals','Deals','Deal','deal'),
    ('clients','Clients','Client','client'),
    ('tasks','Tasks','Task','task'),
    ('deal_installments','Deals','Instalment','deal'),
    ('payments','Accounts','Payment','payment'),
    ('invoices','Accounts','Invoice','invoice'),
    ('receivables','Accounts','Receivable','receivable'),
    ('payables','Accounts','Payable','payable'),
    ('policies','Policies','Policy','policy'),
    ('deal_policies','Policies','Policy','deal'),
    ('deal_documents','Documents','Document','deal'),
    ('documents','Documents','Document','document'),
    ('travel_postings','Travel','Travel Bulk Posting','travel'),
    ('travel_posting_rows','Travel','Travel Bulk Policy','travel'),
    ('tax_records','Accounts','Tax entry','tax'),
    ('expenses','Accounts','Expense','expense'),
    ('reimbursements','Operations','Reimbursement','reimbursement')
  ) v(tbl, module, noun, etype) LOOP
    IF to_regclass('public.'||t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS zz_log_activity ON public.%I', t.tbl);
      EXECUTE format('CREATE TRIGGER zz_log_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_log_activity(%L,%L,%L)', t.tbl, t.module, t.noun, t.etype);
    END IF;
  END LOOP;
END $$;

-- Manual send (admin/management only)
CREATE OR REPLACE FUNCTION public.send_notification(_user_ids uuid[], _title text, _message text, _entity_type text DEFAULT NULL, _entity_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(trim(_title),'') = '' THEN RAISE EXCEPTION 'Title required'; END IF;
  INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, created_by)
  SELECT u, 'manual', left(_title,200), left(_message,2000), _entity_type, _entity_id, auth.uid() FROM unnest(_user_ids) u;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO activity_log(actor_id, action, entity_type, module, summary, metadata)
  VALUES (auth.uid(), 'notify', 'notification', 'Notifications', 'Sent notification: '||_title, jsonb_build_object('recipients', n));
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.send_notification(uuid[],text,text,text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid[],text,text,text,uuid) TO authenticated;

-- Reminders for the calling user only (deduped per day)
CREATE OR REPLACE FUNCTION public.generate_my_reminders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid := auth.uid(); _mgr boolean; n integer := 0; c integer;
BEGIN
  IF _u IS NULL THEN RETURN 0; END IF;
  _mgr := has_role(_u,'admin') OR has_role(_u,'management');

  INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, dedupe_key)
  SELECT _u, 'reminder',
    CASE WHEN t.due_date < current_date THEN 'Overdue task' ELSE 'Task due soon' END,
    format('Task "%s" is %s (due %s)', t.title, CASE WHEN t.due_date < current_date THEN 'overdue' ELSE 'due soon' END, t.due_date),
    'task', t.id, 'task:'||t.id||':'||current_date
  FROM tasks t WHERE t.assigned_to = _u AND t.due_date IS NOT NULL AND t.due_date <= current_date + 1
    AND lower(coalesce(t.status,'')) NOT IN ('completed','done','cancelled')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;

  INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, dedupe_key)
  SELECT _u, 'reminder',
    CASE WHEN i.due_date < current_date THEN 'Overdue payment' ELSE 'Upcoming instalment' END,
    format('%s of Deal %s (Rs %s) is %s on %s', coalesce(i.label,'Instalment '||i.installment_number), d.deal_number, to_char(coalesce(i.amount,0),'FM999,999,999,990'),
      CASE WHEN i.due_date < current_date THEN 'overdue since' ELSE 'due' END, i.due_date),
    'deal', d.id, 'inst:'||i.id||':'||current_date
  FROM deal_installments i JOIN deals d ON d.id = i.deal_id
  WHERE coalesce(i.payment_status,'due') <> 'paid' AND i.due_date IS NOT NULL AND i.due_date <= current_date + 7
    AND i.due_date >= current_date - 60
    AND (d.assigned_do_id = _u OR d.created_by = _u)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;

  INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, dedupe_key)
  SELECT _u, 'reminder', 'Policy renewal approaching',
    format('Policy for Deal %s ends on %s', d.deal_number, d.policy_end_date), 'deal', d.id, 'renew:'||d.id||':'||d.policy_end_date
  FROM deals d WHERE d.policy_end_date BETWEEN current_date AND current_date + 30
    AND (d.assigned_do_id = _u OR d.created_by = _u)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;

  IF _mgr THEN
    INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, dedupe_key)
    SELECT _u, 'reminder', 'Invoice awaiting approval', format('Invoice %s is pending approval', inv.invoice_number),
      'invoice', inv.id, 'invappr:'||inv.id
    FROM invoices inv WHERE inv.status = 'pending_approval'
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.generate_my_reminders() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_my_reminders() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
