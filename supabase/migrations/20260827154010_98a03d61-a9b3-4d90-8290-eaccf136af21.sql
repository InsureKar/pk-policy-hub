CREATE TABLE public.deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.deal_stages(id),
  to_stage_id uuid REFERENCES public.deal_stages(id),
  changed_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.deal_stage_history TO authenticated;
GRANT ALL ON public.deal_stage_history TO service_role;

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and management can view stage history"
  ON public.deal_stage_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management'));

CREATE POLICY "Authenticated can insert stage history"
  ON public.deal_stage_history FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_deal_stage_history_deal ON public.deal_stage_history(deal_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_deal_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_id IS NOT NULL THEN
      INSERT INTO public.deal_stage_history(deal_id, from_stage_id, to_stage_id, changed_by)
      VALUES (NEW.id, NULL, NEW.stage_id, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.deal_stage_history(deal_id, from_stage_id, to_stage_id, changed_by)
    VALUES (NEW.id, OLD.stage_id, NEW.stage_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_deal_stage_history() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_deal_stage_history
AFTER INSERT OR UPDATE OF stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_deal_stage_history();