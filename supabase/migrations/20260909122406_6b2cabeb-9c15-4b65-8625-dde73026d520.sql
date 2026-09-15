ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS b2b_taker_name text;
ALTER TABLE public.deal_installments ADD COLUMN IF NOT EXISTS b2b_taker_name text;