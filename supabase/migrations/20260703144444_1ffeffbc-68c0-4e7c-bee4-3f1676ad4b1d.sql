
DO $$
DECLARE
  pair record;
  short_id uuid;
  full_id uuid;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('Adamjee','Adamjee Insurance'),
      ('Askari','Askari General Insurance'),
      ('EFU','EFU General Insurance'),
      ('IGI','IGI Insurance'),
      ('Jubilee','Jubilee General Insurance'),
      ('TPL','TPL Insurance')
    ) AS t(short_name, full_name)
  LOOP
    SELECT id INTO short_id FROM public.insurance_companies WHERE name = pair.short_name;
    SELECT id INTO full_id FROM public.insurance_companies WHERE name = pair.full_name;
    IF short_id IS NOT NULL AND full_id IS NOT NULL AND short_id <> full_id THEN
      UPDATE public.deals SET insurance_company_id = full_id WHERE insurance_company_id = short_id;
      -- move commission rates, skipping ones that would collide with existing (company, line) rows
      DELETE FROM public.company_commission_rates ccr
        WHERE ccr.company_id = short_id
          AND EXISTS (
            SELECT 1 FROM public.company_commission_rates x
            WHERE x.company_id = full_id AND x.line_of_business = ccr.line_of_business
          );
      UPDATE public.company_commission_rates SET company_id = full_id WHERE company_id = short_id;
      DELETE FROM public.insurance_companies WHERE id = short_id;
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_type') THEN
    CREATE TYPE public.deal_type AS ENUM ('fresh', 'renewal');
  END IF;
END $$;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_type public.deal_type NOT NULL DEFAULT 'fresh';

CREATE TABLE IF NOT EXISTS public.user_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  target_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_targets TO authenticated;
GRANT ALL ON public.user_targets TO service_role;

ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targets_admin_all" ON public.user_targets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'management'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "targets_read_self" ON public.user_targets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "targets_read_team" ON public.user_targets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'team_lead'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_targets.user_id
        AND p.team_id = public.current_user_team()
    )
  );

CREATE TRIGGER user_targets_updated BEFORE UPDATE ON public.user_targets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_targets_user_month ON public.user_targets(user_id, period_month);
