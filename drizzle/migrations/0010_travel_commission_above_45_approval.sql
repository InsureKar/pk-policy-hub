ALTER TABLE public.travel_posting_rows
  ADD COLUMN IF NOT EXISTS commission_approval text,
  ADD COLUMN IF NOT EXISTS commission_approval_by uuid,
  ADD COLUMN IF NOT EXISTS commission_approval_at timestamptz;

CREATE OR REPLACE FUNCTION public.tg_travel_row_commission_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_mgr boolean := auth.uid() IS NULL OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'management');
BEGIN
  IF coalesce(NEW.commission_percentage,0) <= 45 THEN
    NEW.commission_approval := NULL; NEW.commission_approval_by := NULL; NEW.commission_approval_at := NULL;
    RETURN NEW;
  END IF;
  IF is_mgr THEN
    IF NEW.commission_approval IS NULL OR NEW.commission_approval NOT IN ('pending','approved','rejected') THEN
      NEW.commission_approval := 'approved';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.commission_approval IS DISTINCT FROM OLD.commission_approval
       OR NEW.commission_percentage IS DISTINCT FROM OLD.commission_percentage THEN
      NEW.commission_approval_by := auth.uid(); NEW.commission_approval_at := now();
    END IF;
  ELSE
    IF TG_OP = 'INSERT' OR NEW.commission_percentage IS DISTINCT FROM OLD.commission_percentage THEN
      NEW.commission_approval := 'pending'; NEW.commission_approval_by := NULL; NEW.commission_approval_at := NULL;
    ELSE
      NEW.commission_approval := OLD.commission_approval;
      NEW.commission_approval_by := OLD.commission_approval_by;
      NEW.commission_approval_at := OLD.commission_approval_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS travel_row_commission_approval ON public.travel_posting_rows;
CREATE TRIGGER travel_row_commission_approval BEFORE INSERT OR UPDATE ON public.travel_posting_rows
FOR EACH ROW EXECUTE FUNCTION public.tg_travel_row_commission_approval();

CREATE OR REPLACE FUNCTION public.tg_travel_row_commission_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _deal uuid; _who text;
BEGIN
  IF NEW.commission_approval = 'pending' AND (TG_OP = 'INSERT' OR OLD.commission_approval IS DISTINCT FROM 'pending'
      OR NEW.commission_percentage IS DISTINCT FROM OLD.commission_percentage) THEN
    SELECT deal_id INTO _deal FROM travel_postings WHERE id = NEW.posting_id;
    SELECT coalesce(full_name, email) INTO _who FROM profiles WHERE id = auth.uid();
    INSERT INTO notifications(user_id, kind, title, message, entity_type, entity_id, created_by)
    SELECT DISTINCT ur.user_id, 'approval', 'Travel commission above 45% needs approval',
      coalesce(_who,'A user')||' entered '||NEW.commission_percentage||'% commission on travel policy '||coalesce(NEW.policy_number,'(no number)')||'. Please approve, edit or reject.',
      'deal', _deal, auth.uid()
    FROM user_roles ur WHERE ur.role IN ('admin','management');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS travel_row_commission_notify ON public.travel_posting_rows;
CREATE TRIGGER travel_row_commission_notify AFTER INSERT OR UPDATE ON public.travel_posting_rows
FOR EACH ROW EXECUTE FUNCTION public.tg_travel_row_commission_notify();