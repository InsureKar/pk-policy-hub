REVOKE EXECUTE ON FUNCTION public.tg_ticket_before() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_ticket_activity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_ticket_comment_activity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_ticket_attachment_activity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_ticket(public.tickets) FROM anon;