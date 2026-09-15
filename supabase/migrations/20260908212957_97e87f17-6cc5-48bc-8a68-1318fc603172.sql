ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS underwritten_premium numeric NOT NULL DEFAULT 0;

CREATE TABLE public.deal_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  label text,
  due_date date,
  amount numeric NOT NULL DEFAULT 0,
  paid_date date,
  paid_amount numeric NOT NULL DEFAULT 0,
  underwritten_amount numeric NOT NULL DEFAULT 0,
  tagged_month integer,
  tagged_year integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, installment_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_installments TO authenticated;
GRANT ALL ON public.deal_installments TO service_role;

ALTER TABLE public.deal_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_installments_select_auth" ON public.deal_installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "deal_installments_insert_auth" ON public.deal_installments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deal_installments_update_auth" ON public.deal_installments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deal_installments_delete_auth" ON public.deal_installments FOR DELETE TO authenticated USING (true);

CREATE TRIGGER deal_installments_updated BEFORE UPDATE ON public.deal_installments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();