CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  serial_number text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  location text,
  purchase_date date NOT NULL DEFAULT current_date,
  purchase_cost numeric(14,2) NOT NULL DEFAULT 0,
  salvage_value numeric(14,2) NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL DEFAULT 5,
  depreciation_method text NOT NULL DEFAULT 'straight_line',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select_auth" ON public.assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "assets_insert_mgmt" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE POLICY "assets_update_mgmt" ON public.assets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE POLICY "assets_delete_mgmt" ON public.assets
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();