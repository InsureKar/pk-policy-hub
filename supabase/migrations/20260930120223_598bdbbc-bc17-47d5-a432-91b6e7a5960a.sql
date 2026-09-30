REVOKE EXECUTE ON FUNCTION public.tg_task_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_lead_of(uuid) FROM PUBLIC, anon;