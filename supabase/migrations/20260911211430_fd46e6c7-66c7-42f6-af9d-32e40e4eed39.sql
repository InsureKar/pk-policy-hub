ALTER TABLE public.deal_installments
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'due',
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS payment_receive_date date,
  ADD COLUMN IF NOT EXISTS transaction_reference text,
  ADD COLUMN IF NOT EXISTS payment_remarks text;