-- 1) Recreate income/tagged premium generated columns: B2B commission is now SUBTRACTED
ALTER TABLE public.deals DROP COLUMN total_income;
ALTER TABLE public.deals DROP COLUMN income_percentage;
ALTER TABLE public.deals DROP COLUMN tagged_premium_percentage;
ALTER TABLE public.deals DROP COLUMN tagged_premium;

ALTER TABLE public.deals
  ADD COLUMN total_income numeric(14,2) GENERATED ALWAYS AS (
    round(
      ((COALESCE(commission_percentage,0) * COALESCE(gross_premium,0)) / 100.0) * 0.83
      + ((COALESCE(marketing_budget_percentage,0) * COALESCE(gross_premium,0)) / 100.0) * 0.91
      + COALESCE(loading,0) - COALESCE(b2b_commission,0)
    , 2)
  ) STORED;

ALTER TABLE public.deals
  ADD COLUMN income_percentage numeric(14,4) GENERATED ALWAYS AS (
    CASE WHEN COALESCE(gross_premium,0) > 0 THEN round(
      ((((COALESCE(commission_percentage,0) * gross_premium) / 100.0) * 0.83
        + ((COALESCE(marketing_budget_percentage,0) * gross_premium) / 100.0) * 0.91
        + COALESCE(loading,0) - COALESCE(b2b_commission,0)) / gross_premium) * 100.0
    , 4) ELSE 0 END
  ) STORED;

ALTER TABLE public.deals
  ADD COLUMN tagged_premium_percentage numeric(14,6) GENERATED ALWAYS AS (
    CASE WHEN COALESCE(gross_premium,0) > 0 AND COALESCE(base_percentage,13) > 0 THEN round(
      (((((COALESCE(commission_percentage,0) * gross_premium) / 100.0) * 0.83
        + ((COALESCE(marketing_budget_percentage,0) * gross_premium) / 100.0) * 0.91
        + COALESCE(loading,0) - COALESCE(b2b_commission,0)) / gross_premium) * 100.0)
      / COALESCE(base_percentage,13) * 100.0
    , 6) ELSE 0 END
  ) STORED;

ALTER TABLE public.deals
  ADD COLUMN tagged_premium numeric(14,2) GENERATED ALWAYS AS (
    CASE WHEN COALESCE(gross_premium,0) > 0 AND COALESCE(base_percentage,13) > 0 THEN
      CASE WHEN ((((((COALESCE(commission_percentage,0) * gross_premium) / 100.0) * 0.83
             + ((COALESCE(marketing_budget_percentage,0) * gross_premium) / 100.0) * 0.91
             + COALESCE(loading,0) - COALESCE(b2b_commission,0)) / gross_premium) * 100.0)
             / COALESCE(base_percentage,13) * 100.0) < 100
      THEN round(
        (((((((COALESCE(commission_percentage,0) * gross_premium) / 100.0) * 0.83
           + ((COALESCE(marketing_budget_percentage,0) * gross_premium) / 100.0) * 0.91
           + COALESCE(loading,0) - COALESCE(b2b_commission,0)) / gross_premium) * 100.0)
           / COALESCE(base_percentage,13) * 100.0) / 100.0) * gross_premium
      , 2)
      ELSE round(gross_premium, 2) END
    ELSE 0 END
  ) STORED;

-- 2) Net Premium is now a manually entered independent value: stop auto-deriving it
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

  -- Net premium is a manual, independent input. Never derive it from gross premium.
  NEW.net_premium := GREATEST(0, COALESCE(NEW.net_premium, 0));
  RETURN NEW;
END; $function$;

-- 3) Migrate legacy Base Premium values into Net Premium (no data loss; base_premium retained for audit)
UPDATE public.deals
SET net_premium = base_premium
WHERE base_premium IS NOT NULL AND base_premium > 0;

INSERT INTO public.accounts_audit_log(entity_type, entity_id, action, previous_value, new_value)
SELECT 'deal', id, 'base_premium_migrated_to_net_premium',
       jsonb_build_object('base_premium', base_premium),
       jsonb_build_object('net_premium', net_premium)
FROM public.deals
WHERE base_premium IS NOT NULL AND base_premium > 0;