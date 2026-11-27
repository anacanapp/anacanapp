-- Duzelis66.sql — Chat reaksiyaları: "+" altındakı əlavə emojilər
--
-- Mesaj menyusundakı "+" düyməsi 16 əlavə reaksiya açır (src/lib/chat.ts
-- CHAT_MORE_REACTIONS). chat_set_reaction_v2 yalnız sabit siyahını qəbul
-- edir və cədvəldə eyni siyahı CHECK kimi var; ikisi də genişləndirilir. Görünürlük, silinmiş mesaj yoxlaması, kilid,
-- RLS və writer guard/CDC trigerləri dəyişmir; funksiya imzası eynidir.
--
-- İCRA (Google): VM-də anacan-postgres konteynerində bir transaksiyada.

BEGIN;
CREATE OR REPLACE FUNCTION public.chat_set_reaction_v2(p_actor uuid, p_kind text, p_message uuid, p_emoji text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE actor uuid:=public.chat_actor_v2(p_actor); deleted boolean;
BEGIN
  IF NOT public.chat_message_visible_v2(p_kind,p_message) OR (p_emoji IS NOT NULL AND p_emoji NOT IN ('👍','❤️','😂','😮','😢','🙏','🔥','👏','😍','🥰','😘','🤗','😅','😭','😡','🤔','👌','🙌','💪','🎉','💕','🌸','👶','🍼')) THEN RAISE EXCEPTION 'CHAT_REACTION_NOT_ALLOWED' USING ERRCODE='42501'; END IF;
  IF p_kind='direct' THEN SELECT deleted_at IS NOT NULL INTO deleted FROM public.direct_messages WHERE id=p_message FOR UPDATE;
  ELSIF p_kind='partner' THEN SELECT deleted_at IS NOT NULL INTO deleted FROM public.partner_messages WHERE id=p_message FOR UPDATE;
  ELSE SELECT deleted_at IS NOT NULL INTO deleted FROM public.group_messages WHERE id=p_message FOR UPDATE; END IF;
  IF coalesce(deleted,true) THEN RAISE EXCEPTION 'CHAT_MESSAGE_DELETED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_message::text||actor::text,72019));
  DELETE FROM public.chat_message_reactions WHERE user_id=actor AND ((p_kind='direct' AND direct_message_id=p_message) OR (p_kind='partner' AND partner_message_id=p_message) OR (p_kind='group' AND group_message_id=p_message));
  IF p_emoji IS NOT NULL THEN INSERT INTO public.chat_message_reactions(direct_message_id,partner_message_id,group_message_id,user_id,emoji)
    VALUES(CASE WHEN p_kind='direct' THEN p_message END,CASE WHEN p_kind='partner' THEN p_message END,CASE WHEN p_kind='group' THEN p_message END,actor,p_emoji); END IF;
END $function$;

-- The table carries the same list as a CHECK; widen it with the function.
ALTER TABLE public.chat_message_reactions DROP CONSTRAINT chat_reaction_emoji_v2;
ALTER TABLE public.chat_message_reactions ADD CONSTRAINT chat_reaction_emoji_v2
  CHECK (emoji = ANY (ARRAY['👍'::text, '❤️'::text, '😂'::text, '😮'::text, '😢'::text, '🙏'::text, '🔥'::text, '👏'::text, '😍'::text, '🥰'::text, '😘'::text, '🤗'::text, '😅'::text, '😭'::text, '😡'::text, '🤔'::text, '👌'::text, '🙌'::text, '💪'::text, '🎉'::text, '💕'::text, '🌸'::text, '👶'::text, '🍼'::text]));

NOTIFY pgrst, 'reload schema';
COMMIT;
