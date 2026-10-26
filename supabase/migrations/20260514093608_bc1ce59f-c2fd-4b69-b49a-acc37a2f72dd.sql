
-- Revoke anon access from SECURITY DEFINER functions that should require auth
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_linked_partner_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_partner_by_code(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_partners(uuid, uuid, uuid) FROM anon, PUBLIC;
