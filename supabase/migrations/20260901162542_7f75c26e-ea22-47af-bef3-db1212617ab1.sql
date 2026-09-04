CREATE POLICY "ticket_attachment_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'crm-documents'
  AND EXISTS (
    SELECT 1 FROM public.ticket_attachments ta
    JOIN public.tickets t ON t.id = ta.ticket_id
    WHERE ta.storage_path = storage.objects.name
      AND public.can_view_ticket(t)
  )
);