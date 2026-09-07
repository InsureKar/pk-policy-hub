ALTER TABLE public.tax_records DROP CONSTRAINT tax_records_client_id_fkey;
ALTER TABLE public.tax_records ADD CONSTRAINT tax_records_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.tax_records DROP CONSTRAINT tax_records_team_id_fkey;
ALTER TABLE public.tax_records ADD CONSTRAINT tax_records_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.tickets DROP CONSTRAINT tickets_assigned_team_id_fkey;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_assigned_team_id_fkey FOREIGN KEY (assigned_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.payments DROP CONSTRAINT payments_receivable_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_receivable_id_fkey FOREIGN KEY (receivable_id) REFERENCES public.receivables(id) ON DELETE CASCADE;

ALTER TABLE public.receivables DROP CONSTRAINT receivables_deal_id_fkey;
ALTER TABLE public.receivables ADD CONSTRAINT receivables_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;