revoke execute on function public.tg_uw_before() from public, anon, authenticated;
revoke execute on function public.tg_uw_after() from public, anon, authenticated;
revoke execute on function public.tg_uw_doc_after() from public, anon, authenticated;
revoke execute on function public.can_view_uw(uuid) from public, anon;
grant execute on function public.can_view_uw(uuid) to authenticated;