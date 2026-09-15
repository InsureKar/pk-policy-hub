ALTER TABLE public.deal_installments
  ADD COLUMN IF NOT EXISTS commission_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS b2b_commission numeric NOT NULL DEFAULT 0;