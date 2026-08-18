CREATE TABLE public.travel_posting_transfers (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.travel_postings(id) on delete cascade,
  sr_no integer not null default 1,
  transfer_date date,
  bank_name text,
  amount numeric not null default 0,
  tid text,
  agent text,
  remarks text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_posting_transfers TO authenticated;
GRANT ALL ON public.travel_posting_transfers TO service_role;
ALTER TABLE public.travel_posting_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY travel_posting_transfers_all ON public.travel_posting_transfers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = travel_posting_transfers.posting_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = travel_posting_transfers.posting_id));
CREATE INDEX travel_posting_transfers_posting_idx ON public.travel_posting_transfers(posting_id);