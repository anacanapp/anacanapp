-- Duzelis66.sql — Anacan AI söhbətinə şəkil dəstəyi
-- ai_chat_messages: istifadəçinin göndərdiyi şəklin URL-i (chat-media bucket).
-- Şəkil Gemini-yə base64 (inline_data) kimi gedir; URL yalnız tarixçə
-- görüntüsü üçündür.

ALTER TABLE public.ai_chat_messages
  ADD COLUMN IF NOT EXISTS image_url text;

NOTIFY pgrst, 'reload schema';
