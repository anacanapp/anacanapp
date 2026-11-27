-- Banners: optional platform targeting (iOS / Android / web) so iOS and Android can get separate creatives.
-- NULL or empty = every platform (unchanged behaviour). Filtered in BannerSlot via Capacitor.getPlatform().
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS target_platforms text[];
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_target_platforms_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_target_platforms_check
  CHECK (target_platforms IS NULL OR target_platforms <@ ARRAY['ios','android','web']::text[]);
COMMENT ON COLUMN public.banners.target_platforms IS 'Hədəf platformalar: ios, android, web. NULL/boş = hamısı.';
notify pgrst, 'reload schema';
