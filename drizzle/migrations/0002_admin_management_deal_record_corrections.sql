DO $migration$
DECLARE t text; p record; role_check text := '(public.has_role(auth.uid(), ''admin''::public.app_role) OR public.has_role(auth.uid(), ''management''::public.app_role))';
BEGIN
  FOREACH t IN ARRAY ARRAY['deals','deal_installments','deal_documents','deal_policies','travel_postings','travel_posting_rows','travel_posting_transfers','receivables','payments','installments','invoices','commission_payables','payables','tax_records','policies','documents','tasks'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY manager_deal_corrections ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', t, role_check, role_check);
    FOR p IN SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND permissive = 'RESTRICTIVE' LOOP
      EXECUTE format('ALTER POLICY %I ON public.%I %s %s', p.policyname, t,
        CASE WHEN p.qual IS NULL THEN '' ELSE format('USING ((%s) OR %s)', p.qual, role_check) END,
        CASE WHEN p.with_check IS NULL THEN '' ELSE format('WITH CHECK ((%s) OR %s)', p.with_check, role_check) END);
    END LOOP;
  END LOOP;
END $migration$;

-- Existing insert allocation logic is unchanged. Corrections replay the same
-- specific-instalment-first/FIFO allocation only for a verifiable pure ledger.
-- Mixed manual balances are rejected rather than silently overwritten.
CREATE OR REPLACE FUNCTION public.tg_payment_correct()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  r public.receivables%ROWTYPE;
  payment record; inst record; cp record;
  alloc jsonb := '{}'::jsonb; old_alloc jsonb := '{}'::jsonb;
  pass integer; remaining numeric; applied numeric; paid numeric; total_paid numeric;
  baseline numeric; new_out numeric; old_sum numeric; full_date timestamptz;
  d public.deals%ROWTYPE; pct numeric; commission_amount numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.amount IS NOT DISTINCT FROM OLD.amount
    AND NEW.receivable_id IS NOT DISTINCT FROM OLD.receivable_id
    AND NEW.installment_id IS NOT DISTINCT FROM OLD.installment_id THEN RETURN NEW; END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'management')) THEN
    RAISE EXCEPTION 'Only admin and management may correct applied payments';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.receivable_id IS DISTINCT FROM OLD.receivable_id THEN
    RAISE EXCEPTION 'Delete the old payment and add it to the correct receivable; receivable reassignment cannot be applied in one correction';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.amount < 0 THEN RAISE EXCEPTION 'Payment amount cannot be negative'; END IF;
  SELECT * INTO r FROM public.receivables WHERE id = OLD.receivable_id FOR UPDATE;
  -- Cascading deletion of the parent must not reconstruct a removed receivable.
  IF NOT FOUND THEN IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RAISE EXCEPTION 'Receivable not found'; END IF; END IF;
  PERFORM id FROM public.installments WHERE receivable_id=r.id ORDER BY installment_number FOR UPDATE;
  SELECT COALESCE(sum(amount),0) INTO old_sum FROM public.payments WHERE receivable_id=r.id;
  baseline := r.paid_amount - old_sum;
  IF baseline < 0 THEN RAISE EXCEPTION 'Payment correction blocked: recorded payments and receivable balance disagree; reconcile the balance first'; END IF;
  FOR pass IN 1..2 LOOP
    alloc := '{}'::jsonb;
    FOR payment IN
      SELECT q.* FROM (
        SELECT p.id, p.amount, p.installment_id, p.created_at FROM public.payments p
          WHERE p.receivable_id=r.id AND (pass=1 OR p.id<>OLD.id)
        UNION ALL
        SELECT NEW.id, NEW.amount, NEW.installment_id, NEW.created_at
          WHERE pass=2 AND TG_OP='UPDATE'
      ) q ORDER BY q.created_at,q.id
    LOOP
      remaining := payment.amount;
      IF payment.installment_id IS NOT NULL THEN
        FOR inst IN SELECT * FROM public.installments WHERE id=payment.installment_id AND receivable_id=r.id LOOP
          paid := COALESCE((alloc->>inst.id::text)::numeric,0);
          applied := LEAST(remaining,GREATEST(0,inst.amount-paid));
          alloc := jsonb_set(alloc,ARRAY[inst.id::text],to_jsonb(paid+applied));
          remaining := remaining-applied;
        END LOOP;
      END IF;
      FOR inst IN SELECT * FROM public.installments WHERE receivable_id=r.id ORDER BY installment_number LOOP
        EXIT WHEN remaining<=0;
        paid := COALESCE((alloc->>inst.id::text)::numeric,0);
        applied := LEAST(remaining,GREATEST(0,inst.amount-paid));
        alloc := jsonb_set(alloc,ARRAY[inst.id::text],to_jsonb(paid+applied));
        remaining := remaining-applied;
      END LOOP;
    END LOOP;
    IF pass=1 THEN old_alloc:=alloc; END IF;
  END LOOP;
  FOR inst IN SELECT * FROM public.installments WHERE receivable_id=r.id LOOP
    IF inst.paid_amount <> COALESCE((old_alloc->>inst.id::text)::numeric,0)
      OR inst.remaining_amount <> GREATEST(0,inst.amount-inst.paid_amount) THEN
      RAISE EXCEPTION 'Payment correction blocked: accounting instalment % contains separate manual adjustments; reconcile those before changing an applied payment', inst.installment_number;
    END IF;
  END LOOP;
  total_paid := baseline + old_sum - OLD.amount;
  IF TG_OP='UPDATE' THEN total_paid:=total_paid+NEW.amount; END IF;
  new_out:=GREATEST(0,r.total_amount-total_paid);
  IF new_out>0 AND EXISTS(SELECT 1 FROM public.commission_payables c WHERE c.receivable_id=r.id AND (c.status='paid' OR c.paid_date IS NOT NULL)) THEN
    RAISE EXCEPTION 'Payment correction blocked: a linked commission is already paid; correct that settlement first';
  END IF;
  IF new_out>0 AND EXISTS(SELECT 1 FROM public.payables p JOIN public.commission_payables c ON c.id=p.commission_payable_id WHERE c.receivable_id=r.id AND p.paid_amount>0) THEN
    RAISE EXCEPTION 'Payment correction blocked: a linked payable has already been paid; correct that settlement first';
  END IF;
  FOR inst IN SELECT * FROM public.installments WHERE receivable_id=r.id LOOP
    paid:=COALESCE((alloc->>inst.id::text)::numeric,0);
    UPDATE public.installments SET paid_amount=paid, remaining_amount=GREATEST(0,amount-paid),
      status=CASE WHEN amount-paid<=0 THEN 'paid'::public.installment_status WHEN paid>0 THEN 'partial'::public.installment_status WHEN due_date<current_date THEN 'overdue'::public.installment_status ELSE 'pending'::public.installment_status END,
      paid_at=CASE WHEN amount-paid<=0 THEN COALESCE(paid_at,now()) ELSE NULL END
      WHERE id=inst.id;
  END LOOP;
  UPDATE public.receivables SET paid_amount=total_paid,outstanding_amount=new_out,
    status=CASE WHEN new_out<=0 THEN 'paid'::public.receivable_status WHEN total_paid>0 THEN 'partial'::public.receivable_status ELSE 'open'::public.receivable_status END,
    fully_paid_at=CASE WHEN new_out<=0 THEN COALESCE(fully_paid_at,now()) ELSE NULL END WHERE id=r.id;
  IF new_out>0 THEN
    DELETE FROM public.payables p USING public.commission_payables c WHERE p.commission_payable_id=c.id AND c.receivable_id=r.id AND p.paid_amount=0;
    DELETE FROM public.commission_payables WHERE receivable_id=r.id AND status<>'paid' AND paid_date IS NULL;
  ELSIF r.outstanding_amount>0 THEN
    SELECT * INTO d FROM public.deals WHERE id=r.deal_id;
    IF r.assigned_do_id IS NOT NULL THEN
      SELECT COALESCE(commission_share_percentage,0) INTO pct FROM public.profiles WHERE id=r.assigned_do_id;
      commission_amount:=round(COALESCE(d.commission_after_tax,0)*COALESCE(pct,0)/100.0,2);
      IF commission_amount>0 THEN INSERT INTO public.commission_payables(receivable_id,deal_id,beneficiary_id,beneficiary_role,commission_amount)
        VALUES(r.id,d.id,r.assigned_do_id,'do',commission_amount) ON CONFLICT(receivable_id,beneficiary_id,beneficiary_role) DO NOTHING; END IF;
    END IF;
    IF r.team_lead_id IS NOT NULL AND r.team_lead_id<>COALESCE(r.assigned_do_id,'00000000-0000-0000-0000-000000000000'::uuid) THEN
      SELECT COALESCE(commission_share_percentage,0) INTO pct FROM public.profiles WHERE id=r.team_lead_id;
      commission_amount:=round(COALESCE(d.commission_after_tax,0)*COALESCE(pct,0)/100.0,2);
      IF commission_amount>0 THEN INSERT INTO public.commission_payables(receivable_id,deal_id,beneficiary_id,beneficiary_role,commission_amount)
        VALUES(r.id,d.id,r.team_lead_id,'team_lead',commission_amount) ON CONFLICT(receivable_id,beneficiary_id,beneficiary_role) DO NOTHING; END IF;
    END IF;
  END IF;
  INSERT INTO public.accounts_audit_log(entity_type,entity_id,action,actor_id,old_value,new_value)
    VALUES('payment',OLD.id,lower(TG_OP),auth.uid(),to_jsonb(OLD),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(NEW) ELSE NULL END);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;
REVOKE EXECUTE ON FUNCTION public.tg_payment_correct() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER payment_correction_guard BEFORE UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_payment_correct();