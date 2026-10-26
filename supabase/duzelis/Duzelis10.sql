-- Duzelis10: Community "Blue Tick" (verified badge) + admin post pinning support.
-- Idempotent — safe to re-run.

-- ============================================================
-- 1. profiles: is_verified / verified_until (verified_until = NULL means permanent)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_until timestamptz;

-- ============================================================
-- 2. public_profile_cards: mirror columns (this is what Community actually reads)
-- ============================================================
ALTER TABLE public.public_profile_cards
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_until timestamptz;

-- ============================================================
-- 3. Extend the profiles -> public_profile_cards sync trigger function
--    to also carry is_verified / verified_until.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_public_profile_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_profile_cards (
    user_id,
    name,
    avatar_url,
    badge_type,
    life_stage,
    is_premium,
    is_verified,
    verified_until,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.name,
    NEW.avatar_url,
    NEW.badge_type,
    NEW.life_stage,
    COALESCE(NEW.is_premium, false),
    COALESCE(NEW.is_verified, false),
    NEW.verified_until,
    NEW.created_at,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    badge_type = EXCLUDED.badge_type,
    life_stage = EXCLUDED.life_stage,
    is_premium = EXCLUDED.is_premium,
    is_verified = EXCLUDED.is_verified,
    verified_until = EXCLUDED.verified_until,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Extend the self-elevation guard trigger so a regular user
--    cannot grant themselves a blue tick via their own allowed
--    profile UPDATE (mirrors the existing is_premium/badge_type guard).
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins and service role full control
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block changes to privileged columns by non-admin users
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    NEW.is_premium := OLD.is_premium;
  END IF;
  IF NEW.premium_until IS DISTINCT FROM OLD.premium_until THEN
    NEW.premium_until := OLD.premium_until;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  IF NEW.badge_type IS DISTINCT FROM OLD.badge_type THEN
    NEW.badge_type := OLD.badge_type;
  END IF;
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    NEW.is_verified := OLD.is_verified;
  END IF;
  IF NEW.verified_until IS DISTINCT FROM OLD.verified_until THEN
    NEW.verified_until := OLD.verified_until;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Backfill / re-sync existing rows (idempotent — defaults already
--    match, but keeps public_profile_cards perfectly in lockstep).
-- ============================================================
INSERT INTO public.public_profile_cards (
  user_id, name, avatar_url, badge_type, life_stage, is_premium,
  is_verified, verified_until, created_at, updated_at
)
SELECT
  p.user_id, p.name, p.avatar_url, p.badge_type, p.life_stage,
  COALESCE(p.is_premium, false),
  COALESCE(p.is_verified, false),
  p.verified_until,
  p.created_at,
  now()
FROM public.profiles p
ON CONFLICT (user_id) DO UPDATE
SET
  name = EXCLUDED.name,
  avatar_url = EXCLUDED.avatar_url,
  badge_type = EXCLUDED.badge_type,
  life_stage = EXCLUDED.life_stage,
  is_premium = EXCLUDED.is_premium,
  is_verified = EXCLUDED.is_verified,
  verified_until = EXCLUDED.verified_until,
  updated_at = now();

-- ============================================================
-- Note on community_posts.is_pinned: column + RLS already exist
-- (created in migrations/20260122081705_..., admin FOR ALL policy
-- already permits admins to update it — see migrations/20260122081705
-- and 20260122093541). No schema change needed for pinning; only the
-- app-side write path (admin-only Pin/Unpin action) was missing.
-- ============================================================

-- ============================================================
-- 6. New UI translation keys (pin + comment-redesign strings) —
--    DB overlay for all 7 languages (local seed files also updated
--    directly, per app's i18n architecture: seed = baseline,
--    DB = admin-editable overlay on top).
-- ============================================================
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('postcard_pinlenmis_post', 'az', 'Pinlənmiş', 'community'),
  ('postcard_pinlenmis_post', 'en', 'Pinned', 'community'),
  ('postcard_pinlenmis_post', 'ru', 'Закреплено', 'community'),
  ('postcard_pinlenmis_post', 'tr', 'Sabitlendi', 'community'),
  ('postcard_pinlenmis_post', 'kk', 'Бекітілген', 'community'),
  ('postcard_pinlenmis_post', 'de', 'Angeheftet', 'community'),
  ('postcard_pinlenmis_post', 'ar', 'مثبّت', 'community'),

  ('postcard_pini_gotur', 'az', 'Pini götür', 'community'),
  ('postcard_pini_gotur', 'en', 'Unpin', 'community'),
  ('postcard_pini_gotur', 'ru', 'Открепить', 'community'),
  ('postcard_pini_gotur', 'tr', 'Sabitlemeyi kaldır', 'community'),
  ('postcard_pini_gotur', 'kk', 'Бекітуден шығару', 'community'),
  ('postcard_pini_gotur', 'de', 'Lösen', 'community'),
  ('postcard_pini_gotur', 'ar', 'إلغاء التثبيت', 'community'),

  ('postcard_pinle', 'az', 'Pinlə', 'community'),
  ('postcard_pinle', 'en', 'Pin', 'community'),
  ('postcard_pinle', 'ru', 'Закрепить', 'community'),
  ('postcard_pinle', 'tr', 'Sabitle', 'community'),
  ('postcard_pinle', 'kk', 'Бекіту', 'community'),
  ('postcard_pinle', 'de', 'Anheften', 'community'),
  ('postcard_pinle', 'ar', 'تثبيت', 'community'),

  ('usecommunity_post_pinlendi', 'az', '📌 Post pinləndi', 'community'),
  ('usecommunity_post_pinlendi', 'en', '📌 Post pinned', 'community'),
  ('usecommunity_post_pinlendi', 'ru', '📌 Пост закреплён', 'community'),
  ('usecommunity_post_pinlendi', 'tr', '📌 Gönderi sabitlendi', 'community'),
  ('usecommunity_post_pinlendi', 'kk', '📌 Жазба бекітілді', 'community'),
  ('usecommunity_post_pinlendi', 'de', '📌 Beitrag angeheftet', 'community'),
  ('usecommunity_post_pinlendi', 'ar', '📌 تم تثبيت المنشور', 'community'),

  ('usecommunity_post_pini_goturuldu', 'az', 'Post pindən çıxarıldı', 'community'),
  ('usecommunity_post_pini_goturuldu', 'en', 'Post unpinned', 'community'),
  ('usecommunity_post_pini_goturuldu', 'ru', 'Пост откреплён', 'community'),
  ('usecommunity_post_pini_goturuldu', 'tr', 'Gönderinin sabitlemesi kaldırıldı', 'community'),
  ('usecommunity_post_pini_goturuldu', 'kk', 'Жазба бекітуден шығарылды', 'community'),
  ('usecommunity_post_pini_goturuldu', 'de', 'Beitrag gelöst', 'community'),
  ('usecommunity_post_pini_goturuldu', 'ar', 'تم إلغاء تثبيت المنشور', 'community'),

  ('commentreply_beyenme_sayi', 'az', 'bəyənmə', 'community'),
  ('commentreply_beyenme_sayi', 'en', 'likes', 'community'),
  ('commentreply_beyenme_sayi', 'ru', 'лайков', 'community'),
  ('commentreply_beyenme_sayi', 'tr', 'beğenme', 'community'),
  ('commentreply_beyenme_sayi', 'kk', 'лайк', 'community'),
  ('commentreply_beyenme_sayi', 'de', 'Gefällt mir', 'community'),
  ('commentreply_beyenme_sayi', 'ar', 'إعجاب', 'community'),

  ('commentreply_cavablari_gizle', 'az', 'Cavabları gizlə', 'community'),
  ('commentreply_cavablari_gizle', 'en', 'Hide replies', 'community'),
  ('commentreply_cavablari_gizle', 'ru', 'Скрыть ответы', 'community'),
  ('commentreply_cavablari_gizle', 'tr', 'Yanıtları gizle', 'community'),
  ('commentreply_cavablari_gizle', 'kk', 'Жауаптарды жасыру', 'community'),
  ('commentreply_cavablari_gizle', 'de', 'Antworten ausblenden', 'community'),
  ('commentreply_cavablari_gizle', 'ar', 'إخفاء الردود', 'community'),

  ('commentreply_n_cavab_goster', 'az', '{n} cavab göstər', 'community'),
  ('commentreply_n_cavab_goster', 'en', 'View {n} replies', 'community'),
  ('commentreply_n_cavab_goster', 'ru', 'Посмотреть ответы: {n}', 'community'),
  ('commentreply_n_cavab_goster', 'tr', '{n} yanıtı gör', 'community'),
  ('commentreply_n_cavab_goster', 'kk', '{n} жауапты көру', 'community'),
  ('commentreply_n_cavab_goster', 'de', '{n} Antworten ansehen', 'community'),
  ('commentreply_n_cavab_goster', 'ar', 'عرض {n} من الردود', 'community'),

  ('commentreply_beyen', 'az', 'Bəyən', 'community'),
  ('commentreply_beyen', 'en', 'Like', 'community'),
  ('commentreply_beyen', 'ru', 'Нравится', 'community'),
  ('commentreply_beyen', 'tr', 'Beğen', 'community'),
  ('commentreply_beyen', 'kk', 'Лайк қою', 'community'),
  ('commentreply_beyen', 'de', 'Gefällt mir', 'community'),
  ('commentreply_beyen', 'ar', 'إعجاب', 'community')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
