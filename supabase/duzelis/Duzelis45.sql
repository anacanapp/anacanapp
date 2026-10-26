-- Duzelis45: Partnyor gamifikasiyasının birləşdirilməsi - 2 yeni nailiyyət
--
-- KOK SƏBƏB: `partner_achievements` cədvəlində unlock_condition yalnız
-- 'always_unlocked' / 'completed_surprises' / 'surprise_points' dəyərlərini
-- dəstəkləyirdi - yəni Sürprizlər planlaşdırmaq/tamamlamaq xaricində HEÇ BİR
-- partnyor aktivliyi (gündəlik missiyaları tamamlamaq, sevgi/mesaj göndərmək)
-- heç bir nailiyyətə təsir etmirdi, halbuki profil ekranında bunların hamısı
-- eyni yerdə göstərilir (real, qeyri-inteqrasiya olunmuş iki ayrı sistem
-- kimi görünürdü). Kod tərəfi (PartnerProfileScreen.tsx, usePartnerConfig.ts)
-- artıq 'messages_sent' və 'missions_completed' şərtlərini tanıyır - bu fayl
-- bunları real, əlçatan nailiyyətlər kimi DB-yə əlavə edir.
--
-- İdempotentdir (ON CONFLICT DO NOTHING - təkrar işlətmək təhlükəsizdir).

INSERT INTO public.partner_achievements
  (achievement_key, name, name_az, emoji, unlock_condition, unlock_threshold, sort_order, is_active)
VALUES
  ('messenger', 'Messenger of Love', 'Sevgi Elçisi', '💌', 'messages_sent', 10, 6, true),
  ('weekly_hero', 'Weekly Hero', 'Həftəlik Qəhrəman', '📅', 'missions_completed', 7, 7, true)
ON CONFLICT (achievement_key) DO NOTHING;
