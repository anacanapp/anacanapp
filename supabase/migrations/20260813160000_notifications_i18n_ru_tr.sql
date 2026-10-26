-- ============================================================
-- Statik push bildirişlərinin ru/tr dəstəyi.
-- scheduled_notifications: cron-un göndərdiyi günlük şablonlar (title/body + _en var idi).
-- send-daily-notifications edge function pickLang() ilə title_{lang}/body_{lang} oxuyur.
-- Dəyərlər translate-content edge function (Claude→Gemini) ilə doldurulur.
-- ============================================================

ALTER TABLE public.scheduled_notifications
  ADD COLUMN IF NOT EXISTS title_ru text,
  ADD COLUMN IF NOT EXISTS title_tr text,
  ADD COLUMN IF NOT EXISTS body_ru text,
  ADD COLUMN IF NOT EXISTS body_tr text;
