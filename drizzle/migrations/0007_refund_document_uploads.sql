CREATE TABLE public.refund_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 refund_id uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
 document_type text NOT NULL CHECK (document_type IN ('refusal_letter', 'policy')),
 file_name text NOT NULL,
 storage_path text NOT NULL UNIQUE,
 uploaded_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT refund_document_path CHECK (split_part(storage_path, '/', 1) = refund_id::text AND split_part(storage_path, '/', 2) = document_type AND array_length(string_to_array(storage_path, '/'), 1) = 3)
);
GRANT SELECT, INSERT ON public.refund_documents TO authenticated;
GRANT ALL ON public.refund_documents TO service_role;
ALTER TABLE public.refund_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX refund_documents_refund_idx ON public.refund_documents(refund_id);
CREATE POLICY refund_documents_read ON public.refund_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.refunds r WHERE r.id = refund_id AND public.can_see_refund(r.do_user_id)));
CREATE POLICY refund_documents_upload ON public.refund_documents FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND public.refund_allows('refunds.edit') AND EXISTS (SELECT 1 FROM public.refunds r WHERE r.id = refund_id AND public.can_see_refund(r.do_user_id)));
CREATE POLICY refund_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'refund-documents' AND EXISTS (SELECT 1 FROM public.refund_documents d WHERE d.storage_path = name));
CREATE POLICY refund_files_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'refund-documents' AND public.refund_allows('refunds.edit') AND split_part(name, '/', 2) IN ('refusal_letter', 'policy') AND array_length(string_to_array(name, '/'), 1) = 3 AND EXISTS (SELECT 1 FROM public.refunds r WHERE r.id::text = split_part(name, '/', 1) AND public.can_see_refund(r.do_user_id)));
CREATE POLICY refund_files_cleanup ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'refund-documents' AND owner = auth.uid() AND public.refund_allows('refunds.edit') AND NOT EXISTS (SELECT 1 FROM public.refund_documents d WHERE d.storage_path = name) AND EXISTS (SELECT 1 FROM public.refunds r WHERE r.id::text = split_part(name, '/', 1) AND public.can_see_refund(r.do_user_id)));