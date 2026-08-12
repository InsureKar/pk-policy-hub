
ALTER FUNCTION public.perm_rank(public.permission_level) SET search_path = public;
ALTER FUNCTION public.normalize_policy_number(text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.travel_policy_conflict(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.module_allows(public.app_module, public.permission_level) FROM anon;
REVOKE EXECUTE ON FUNCTION public.module_level(uuid, public.app_module) FROM anon;
GRANT EXECUTE ON FUNCTION public.travel_policy_conflict(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_allows(public.app_module, public.permission_level) TO authenticated;
GRANT EXECUTE ON FUNCTION public.module_level(uuid, public.app_module) TO authenticated;
