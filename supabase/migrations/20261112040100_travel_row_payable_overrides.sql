ALTER TABLE public.travel_posting_rows ADD COLUMN IF NOT EXISTS payable_own numeric, ADD COLUMN IF NOT EXISTS payable_insurance numeric;

CREATE OR REPLACE FUNCTION public.tg_travel_row_payable_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.payable_own := NULL; NEW.payable_insurance := NULL;
  ELSE NEW.payable_own := OLD.payable_own; NEW.payable_insurance := OLD.payable_insurance; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS travel_row_payable_guard ON public.travel_posting_rows;
CREATE TRIGGER travel_row_payable_guard BEFORE INSERT OR UPDATE ON public.travel_posting_rows FOR EACH ROW EXECUTE FUNCTION public.tg_travel_row_payable_guard();

CREATE OR REPLACE FUNCTION public.tg_travel_posting_recalc() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p_id uuid; total_pay numeric; total_amt numeric; new_status text;
BEGIN
  p_id := COALESCE(NEW.posting_id, OLD.posting_id);
  SELECT round(COALESCE(SUM(COALESCE(payable_own, COALESCE(premium,0) - COALESCE(premium,0)*COALESCE(commission_percentage,0)/100)),0)) INTO total_pay FROM public.travel_posting_rows WHERE posting_id = p_id;
  SELECT round(total_posting_amount) INTO total_amt FROM public.travel_postings WHERE id = p_id;
  new_status := CASE WHEN COALESCE(total_amt,0) = 0 THEN 'pending' WHEN total_pay = total_amt THEN 'balanced' WHEN total_pay > total_amt THEN 'excess' ELSE 'deficit' END;
  UPDATE public.travel_postings SET status = new_status WHERE id = p_id;
  UPDATE public.deals SET posting_status = new_status WHERE id = (SELECT deal_id FROM public.travel_postings WHERE id = p_id);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.tg_travel_posting_amt_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_pay numeric; total_amt numeric; new_status text;
BEGIN
  SELECT round(COALESCE(SUM(COALESCE(payable_own, COALESCE(premium,0) - COALESCE(premium,0)*COALESCE(commission_percentage,0)/100)),0)) INTO total_pay FROM public.travel_posting_rows WHERE posting_id = NEW.id;
  total_amt := round(COALESCE(NEW.total_posting_amount,0));
  new_status := CASE WHEN total_amt = 0 THEN 'pending' WHEN total_pay = total_amt THEN 'balanced' WHEN total_pay > total_amt THEN 'excess' ELSE 'deficit' END;
  NEW.status := new_status;
  UPDATE public.deals SET posting_status = new_status WHERE id = NEW.deal_id;
  RETURN NEW;
END $$;