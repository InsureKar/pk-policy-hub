CREATE OR REPLACE FUNCTION public.tg_travel_posting_recalc() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p_id uuid; total_pay numeric; total_amt numeric; new_status text;
BEGIN
  p_id := COALESCE(NEW.posting_id, OLD.posting_id);
  SELECT round(COALESCE(SUM(COALESCE(premium,0) - COALESCE(premium,0)*COALESCE(commission_percentage,0)/100),0)) INTO total_pay FROM public.travel_posting_rows WHERE posting_id = p_id;
  SELECT round(total_posting_amount) INTO total_amt FROM public.travel_postings WHERE id = p_id;
  new_status := CASE WHEN COALESCE(total_amt,0) = 0 THEN 'pending' WHEN total_pay = total_amt THEN 'balanced' WHEN total_pay > total_amt THEN 'excess' ELSE 'deficit' END;
  UPDATE public.travel_postings SET status = new_status WHERE id = p_id;
  UPDATE public.deals SET posting_status = new_status WHERE id = (SELECT deal_id FROM public.travel_postings WHERE id = p_id);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.tg_travel_posting_amt_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_pay numeric; total_amt numeric; new_status text;
BEGIN
  SELECT round(COALESCE(SUM(COALESCE(premium,0) - COALESCE(premium,0)*COALESCE(commission_percentage,0)/100),0)) INTO total_pay FROM public.travel_posting_rows WHERE posting_id = NEW.id;
  total_amt := round(COALESCE(NEW.total_posting_amount,0));
  new_status := CASE WHEN total_amt = 0 THEN 'pending' WHEN total_pay = total_amt THEN 'balanced' WHEN total_pay > total_amt THEN 'excess' ELSE 'deficit' END;
  NEW.status := new_status;
  UPDATE public.deals SET posting_status = new_status WHERE id = NEW.deal_id;
  RETURN NEW;
END $$;