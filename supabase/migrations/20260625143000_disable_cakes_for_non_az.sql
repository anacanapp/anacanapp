-- Disable 'cakes' tool for all non-Azerbaijani languages
-- This makes the Tortlar (Cakes) feature unavailable for international users
-- Admin can re-enable via AdminLanguages panel

UPDATE public.app_languages
SET disabled_tools = 
  CASE 
    WHEN disabled_tools IS NULL OR disabled_tools = '[]'::jsonb THEN '["cakes"]'::jsonb
    WHEN NOT disabled_tools ? 'cakes' THEN disabled_tools || '["cakes"]'::jsonb
    ELSE disabled_tools
  END
WHERE code != 'az';
