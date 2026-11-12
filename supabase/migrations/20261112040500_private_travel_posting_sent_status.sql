CREATE TABLE public.travel_posting_delivery_status (
  posting_id uuid PRIMARY KEY REFERENCES public.travel_postings(id) ON DELETE CASCADE,
  sent_status text NOT NULL DEFAULT 'unsent' CHECK (sent_status IN ('sent', 'unsent'))
);
GRANT SELECT, INSERT, UPDATE ON public.travel_posting_delivery_status TO authenticated;
GRANT ALL ON public.travel_posting_delivery_status TO service_role;
ALTER TABLE public.travel_posting_delivery_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_posting_status_read ON public.travel_posting_delivery_status FOR SELECT TO authenticated
USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')) AND EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = posting_id));
CREATE POLICY manager_posting_status_insert ON public.travel_posting_delivery_status FOR INSERT TO authenticated
WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')) AND EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = posting_id));
CREATE POLICY manager_posting_status_update ON public.travel_posting_delivery_status FOR UPDATE TO authenticated
USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')) AND EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = posting_id))
WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')) AND EXISTS (SELECT 1 FROM public.travel_postings p WHERE p.id = posting_id));
CREATE FUNCTION public.tg_travel_posting_delivery_default() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.travel_posting_delivery_status (posting_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_travel_posting_delivery_default() FROM PUBLIC;
CREATE TRIGGER travel_posting_delivery_default AFTER INSERT ON public.travel_postings FOR EACH ROW EXECUTE FUNCTION public.tg_travel_posting_delivery_default();
COMMENT ON TABLE public.travel_posting_delivery_status IS 'Private Admin/Management sent tracking, separate from financial reconciliation. Existing postings without a tracking row are Unsent.';