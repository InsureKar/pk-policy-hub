
CREATE POLICY "docs_bucket_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-documents' AND (public.has_role(auth.uid(),'admin') OR owner = auth.uid()));
CREATE POLICY "docs_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-documents' AND owner = auth.uid());
CREATE POLICY "docs_bucket_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-documents' AND (public.has_role(auth.uid(),'admin') OR owner = auth.uid()));
CREATE POLICY "docs_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crm-documents' AND (public.has_role(auth.uid(),'admin') OR owner = auth.uid()));
