CREATE OR REPLACE FUNCTION public.tg_deals_autofill()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_do boolean;
  is_tl boolean;
  creator_team uuid;
  team_lead uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT team_id INTO creator_team FROM public.profiles WHERE id = NEW.created_by;
    SELECT public.has_role(NEW.created_by, 'do'::app_role) INTO is_do;
    SELECT public.has_role(NEW.created_by, 'team_lead'::app_role) INTO is_tl;

    IF is_do THEN
      NEW.assigned_do_id := NEW.created_by;
      IF NEW.team_id IS NULL THEN NEW.team_id := creator_team; END IF;
      SELECT lead_id INTO team_lead FROM public.teams WHERE id = COALESCE(NEW.team_id, creator_team);
      NEW.team_lead_id := team_lead;
    ELSIF is_tl THEN
      NEW.team_lead_id := NEW.created_by;
      IF NEW.team_id IS NULL THEN NEW.team_id := creator_team; END IF;
      -- Team Lead deals default to the Team Lead; another assignee must belong to their team.
      IF NEW.assigned_do_id IS NULL THEN
        NEW.assigned_do_id := NEW.created_by;
      ELSIF NEW.assigned_do_id <> NEW.created_by AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = NEW.assigned_do_id
          AND p.team_id IS NOT NULL
          AND (p.team_id = creator_team OR p.team_id IN (SELECT t.id FROM public.teams t WHERE t.lead_id = NEW.created_by))
      ) THEN
        RAISE EXCEPTION 'The selected assignee is not in your team.' USING ERRCODE = '42501';
      END IF;
    ELSE
      IF NEW.assigned_do_id IS NOT NULL THEN
        SELECT team_id INTO creator_team FROM public.profiles WHERE id = NEW.assigned_do_id;
        IF NEW.team_id IS NULL THEN NEW.team_id := creator_team; END IF;
      END IF;
      IF NEW.team_id IS NOT NULL THEN
        SELECT lead_id INTO team_lead FROM public.teams WHERE id = NEW.team_id;
        NEW.team_lead_id := team_lead;
      END IF;
    END IF;
  END IF;

  NEW.net_premium := GREATEST(0, COALESCE(NEW.net_premium, 0));
  RETURN NEW;
END; $function$;