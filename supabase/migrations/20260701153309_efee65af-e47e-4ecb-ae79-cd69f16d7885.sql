
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'corporate' CHECK (client_type IN ('individual','corporate'));
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients(client_type);
