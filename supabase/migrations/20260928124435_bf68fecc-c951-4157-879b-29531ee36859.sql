ALTER TABLE public.travel_posting_transfers
  ADD COLUMN IF NOT EXISTS agent_payment_destination boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_destination text;