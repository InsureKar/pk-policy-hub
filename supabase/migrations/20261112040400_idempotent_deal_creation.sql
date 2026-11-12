ALTER TABLE public.deals ADD COLUMN submission_key uuid;
COMMENT ON COLUMN public.deals.submission_key IS 'Idempotency key for new deal submission; null for existing and legacy records.';
CREATE UNIQUE INDEX deals_submission_key_unique ON public.deals (submission_key) WHERE submission_key IS NOT NULL;

CREATE FUNCTION public.create_deal_once(_submission_key uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  created_id uuid;
  columns_sql text;
  values_sql text;
  clean_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to save a deal.' USING ERRCODE = '42501'; END IF;
  IF _submission_key IS NULL OR jsonb_typeof(_payload) <> 'object' OR _payload IS NULL THEN
    RAISE EXCEPTION 'A submission key and deal details are required.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_submission_key::text, 0));
  SELECT id INTO existing_id FROM public.deals WHERE submission_key = _submission_key;
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', existing_id, 'replayed', true);
  END IF;
  clean_payload := (_payload - 'submission_key') || jsonb_build_object('submission_key', _submission_key);
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(clean_payload) AS k(key)
    WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = 'public.deals'::regclass AND a.attname = k.key AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '')
  ) THEN RAISE EXCEPTION 'Invalid deal field.' USING ERRCODE = '22023'; END IF;
  SELECT string_agg(format('%I', key), ', ' ORDER BY key),
         string_agg(format('r.%I', key), ', ' ORDER BY key)
  INTO columns_sql, values_sql FROM jsonb_object_keys(clean_payload) AS k(key);
  BEGIN
    EXECUTE format('INSERT INTO public.deals (%s) SELECT %s FROM jsonb_populate_record(NULL::public.deals, $1) r RETURNING id', columns_sql, values_sql)
      INTO created_id USING clean_payload;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO existing_id FROM public.deals WHERE submission_key = _submission_key;
    IF existing_id IS NULL THEN RAISE; END IF;
    RETURN jsonb_build_object('id', existing_id, 'replayed', true);
  END;
  RETURN jsonb_build_object('id', created_id, 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_deal_once(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deal_once(uuid, jsonb) TO authenticated, service_role;