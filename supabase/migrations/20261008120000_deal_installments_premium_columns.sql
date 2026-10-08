-- Columns used by instalment save that were added on the Lovable database
-- outside the migration files. IF NOT EXISTS is a no-op where they already exist.
ALTER TABLE public.deal_installments
  ADD COLUMN IF NOT EXISTS gross_premium numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_premium numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loading numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_budget numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission numeric NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';