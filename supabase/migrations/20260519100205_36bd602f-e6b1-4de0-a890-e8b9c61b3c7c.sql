-- Deduplicate device_tokens: keep only the most recently updated row per token
DELETE FROM public.device_tokens a
USING public.device_tokens b
WHERE a.token = b.token
  AND a.updated_at < b.updated_at;

-- Prevent the same FCM token from being attached to multiple users in the future
ALTER TABLE public.device_tokens
  DROP CONSTRAINT IF EXISTS device_tokens_token_unique;
ALTER TABLE public.device_tokens
  ADD CONSTRAINT device_tokens_token_unique UNIQUE (token);