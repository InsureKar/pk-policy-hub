-- 1. Base percentage stored per deal (nullable => falls back to 13)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS base_percentage numeric;

-- 2. Tax amounts (generated, always consistent with the engine)
ALTER TABLE public.deals
  ADD COLUMN commission_tax numeric GENERATED ALWAYS AS (
    round((COALESCE(commission_percentage,0) * COALESCE(gross_premium,0) / 100.0) * 0.17, 2)
  ) STORED,
  ADD COLUMN marketing_tax numeric GENERATED ALWAYS AS (
    round((COALESCE(marketing_budget_percentage,0) * COALESCE(gross_premium,0) / 100.0) * 0.09, 2)
  ) STORED,
  ADD COLUMN tagged_premium_percentage numeric GENERATED ALWAYS AS (
    CASE
      WHEN COALESCE(gross_premium,0) > 0 AND COALESCE(base_percentage,13) > 0 THEN
        round(
          ((((COALESCE(commission_percentage,0) * gross_premium / 100.0) * 0.83)
            + ((COALESCE(marketing_budget_percentage,0) * gross_premium / 100.0) * 0.91)
            + COALESCE(loading,0) + COALESCE(b2b_commission,0)) / gross_premium * 100.0)
          / COALESCE(base_percentage,13) * 100.0
        , 6)
      ELSE 0
    END
  ) STORED,
  ADD COLUMN tagged_premium numeric GENERATED ALWAYS AS (
    CASE
      WHEN COALESCE(gross_premium,0) > 0 AND COALESCE(base_percentage,13) > 0 THEN
        CASE
          WHEN (((((COALESCE(commission_percentage,0) * gross_premium / 100.0) * 0.83)
                + ((COALESCE(marketing_budget_percentage,0) * gross_premium / 100.0) * 0.91)
                + COALESCE(loading,0) + COALESCE(b2b_commission,0)) / gross_premium * 100.0)
                / COALESCE(base_percentage,13) * 100.0) < 100
          THEN round(
            ((((((COALESCE(commission_percentage,0) * gross_premium / 100.0) * 0.83)
              + ((COALESCE(marketing_budget_percentage,0) * gross_premium / 100.0) * 0.91)
              + COALESCE(loading,0) + COALESCE(b2b_commission,0)) / gross_premium * 100.0)
              / COALESCE(base_percentage,13) * 100.0) / 100.0) * gross_premium
          , 2)
          ELSE round(gross_premium, 2)
        END
      ELSE 0
    END
  ) STORED;

-- 3. Autofill base_percentage from the global setting on insert
CREATE OR REPLACE FUNCTION public.tg_deals_base_percentage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.base_percentage IS NULL THEN
    SELECT COALESCE((value #>> '{}')::numeric, 13) INTO NEW.base_percentage
    FROM public.app_settings WHERE key = 'tagged_premium_base_percentage';
    NEW.base_percentage := COALESCE(NEW.base_percentage, 13);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_base_percentage ON public.deals;
CREATE TRIGGER deals_base_percentage
BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_deals_base_percentage();

-- 4. Backfill historical deals + audit trail
INSERT INTO public.accounts_audit_log (entity_type, entity_id, action, previous_value, new_value)
SELECT 'deal', d.id, 'financial_recalculation',
       jsonb_build_object('base_percentage', d.base_percentage, 'total_income', d.total_income, 'income_percentage', d.income_percentage),
       jsonb_build_object('base_percentage', COALESCE((s.value #>> '{}')::numeric, 13), 'engine_version', 'v2')
FROM public.deals d
LEFT JOIN public.app_settings s ON s.key = 'tagged_premium_base_percentage'
WHERE d.base_percentage IS NULL;

UPDATE public.deals d
SET base_percentage = COALESCE((SELECT (value #>> '{}')::numeric FROM public.app_settings WHERE key = 'tagged_premium_base_percentage'), 13)
WHERE d.base_percentage IS NULL;