-- ============================================================
-- FIX: RLS policy funksiyalarına authenticated EXECUTE icazəsinin bərpası
--
-- 20260514093608 sərtləşdirməsi bu funksiyalardan "anon, PUBLIC" icazəsini
-- geri aldı, lakin "authenticated"-ə açıq GRANT vermədi. Postgres-də
-- funksiyalar EXECUTE-u PUBLIC vasitəsilə alır → PUBLIC-dən revoke
-- authenticated-i də kəsir. Bu funksiyalar isə RLS policy-lərdə çağırılır:
--   • get_user_linked_partner_id → profiles SELECT + partner-paylaşım policy-ləri
--   • has_role                   → admin yoxlamaları
--   • is_group_member            → qrup policy-ləri
--   • find_partner_by_code / link_partners → partnyor qoşulma RPC-ləri
--
-- Nəticə: BÜTÜN daxil olmuş istifadəçilər üçün profiles sorğuları
-- "permission denied for function get_user_linked_partner_id" (42501) ilə
-- çökürdü → yeni qeydiyyatda "Körpənizi tanıyaq" addımı saxlanıla bilmirdi.
--
-- anon üçün qadağa QALIR (sərtləşdirmənin məqsədi qorunur).
-- İdempotentdir.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_linked_partner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_partner_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_partners(uuid, uuid, uuid) TO authenticated;
