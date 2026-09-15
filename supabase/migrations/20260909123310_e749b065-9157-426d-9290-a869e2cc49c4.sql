CREATE TABLE IF NOT EXISTS public.b2b_commission_takers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_commission_takers TO authenticated;
GRANT ALL ON public.b2b_commission_takers TO service_role;

ALTER TABLE public.b2b_commission_takers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own commission takers"
ON public.b2b_commission_takers FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_b2b_commission_takers_updated_at
BEFORE UPDATE ON public.b2b_commission_takers
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();