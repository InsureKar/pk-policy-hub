
CREATE OR REPLACE FUNCTION public.tg_deal_won_to_receivable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_won boolean := false;
  was_won boolean := false;
  raw text;
  sched public.payment_schedule_type;
  count_i integer;
  step_months integer;
  i integer;
  per_amount numeric(14,2);
  last_amount numeric(14,2);
  start_date date;
  new_recv_id uuid;
  commission_recv numeric(14,2);
BEGIN
  IF NEW.stage_id IS NOT NULL THEN
    SELECT ds.is_won INTO is_won FROM public.deal_stages ds WHERE ds.id = NEW.stage_id;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage_id IS NOT NULL THEN
    SELECT ds.is_won INTO was_won FROM public.deal_stages ds WHERE ds.id = OLD.stage_id;
  END IF;

  IF NOT COALESCE(is_won, false) THEN RETURN NEW; END IF;
  IF COALESCE(was_won, false) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.receivables WHERE deal_id = NEW.id) THEN RETURN NEW; END IF;

  raw := lower(regexp_replace(COALESCE(NEW.payment_schedule,''), '[^a-z]', '', 'g'));
  sched := CASE
    WHEN raw IN ('monthly','month') THEN 'monthly'::public.payment_schedule_type
    WHEN raw IN ('quarterly','quarter','quart') THEN 'quarterly'::public.payment_schedule_type
    WHEN raw IN ('halfyearly','semiannual','semiannually','biannual','biannually','half') THEN 'half_yearly'::public.payment_schedule_type
    ELSE 'annual'::public.payment_schedule_type
  END;
  count_i := CASE sched WHEN 'annual' THEN 1 WHEN 'half_yearly' THEN 2 WHEN 'quarterly' THEN 4 WHEN 'monthly' THEN 12 END;
  step_months := CASE sched WHEN 'annual' THEN 12 WHEN 'half_yearly' THEN 6 WHEN 'quarterly' THEN 3 WHEN 'monthly' THEN 1 END;

  commission_recv := COALESCE(NEW.commission_before_tax, 0);
  start_date := COALESCE(NEW.policy_start_date, current_date);

  INSERT INTO public.receivables (
    deal_id, client_id, team_id, assigned_do_id, team_lead_id,
    gross_premium, base_premium, net_premium, commission_receivable,
    payment_schedule, installment_count, total_amount, outstanding_amount,
    first_due_date, expected_collection_date, created_by
  ) VALUES (
    NEW.id, NEW.client_id, NEW.team_id, NEW.assigned_do_id, NEW.team_lead_id,
    NEW.gross_premium, NEW.base_premium, NEW.net_premium, commission_recv,
    sched, count_i, NEW.gross_premium, NEW.gross_premium,
    start_date, start_date, NEW.created_by
  ) RETURNING id INTO new_recv_id;

  INSERT INTO public.invoices (receivable_id, deal_id, client_id, issue_date, due_date, total_amount)
  VALUES (new_recv_id, NEW.id, NEW.client_id, current_date, start_date, NEW.gross_premium);

  per_amount := round(NEW.gross_premium / count_i, 2);
  last_amount := NEW.gross_premium - (per_amount * (count_i - 1));

  FOR i IN 1..count_i LOOP
    INSERT INTO public.installments (receivable_id, installment_number, due_date, amount, remaining_amount)
    VALUES (
      new_recv_id, i,
      (start_date + ((i - 1) * step_months || ' months')::interval)::date,
      CASE WHEN i = count_i THEN last_amount ELSE per_amount END,
      CASE WHEN i = count_i THEN last_amount ELSE per_amount END
    );
  END LOOP;

  INSERT INTO public.accounts_audit_log(entity_type, entity_id, action, actor_id, new_value)
  VALUES ('receivable', new_recv_id, 'create', auth.uid(), jsonb_build_object('deal_id', NEW.id, 'amount', NEW.gross_premium));

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_deal_won_to_receivable() FROM PUBLIC, anon, authenticated;
