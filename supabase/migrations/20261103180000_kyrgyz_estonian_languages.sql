-- Duzelis85: Kyrgyz (ky) and Estonian (et) app languages.
-- Content for both languages ships as source-bound bundles (no new _ky/_et columns);
-- only the server-side language allow-lists and contracts are extended. Idempotent.
DO $$
DECLARE f regprocedure; def text; changed text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.community_language_valid_v1(text)'::regprocedure,
    'public.get_community_language_contract_v1()'::regprocedure,
    'public.get_localization_contract_v1()'::regprocedure,
    'public.get_moderator_contract_v1()'::regprocedure,
    'public.get_community_ad_moderation_contract_v1()'::regprocedure,
    'public.admin_insight_filters_v1(jsonb)'::regprocedure,
    'public.search_share_blogs_v1(text,text,uuid[],integer)'::regprocedure]
  LOOP
    def := pg_get_functiondef(f);
    IF def ~ '''ky''' THEN CONTINUE; END IF;
    changed := regexp_replace(def, '''sv''(::text)?', '''sv''\1,''ky''\1,''et''\1', 'g');
    -- Kyrgyz readers fall back to Russian blog titles like the other CIS languages.
    changed := replace(changed, 'p_language IN (''ka'',''kk'',''uz'')', 'p_language IN (''ka'',''kk'',''uz'',''ky'')');
    IF changed = def THEN RAISE EXCEPTION 'KY_ET_LANGUAGE_LIST_NOT_FOUND %', f; END IF;
    EXECUTE changed;
  END LOOP;
END $$;

ALTER TABLE public.community_post_translations DROP CONSTRAINT IF EXISTS community_post_translations_lang_check;
ALTER TABLE public.community_post_translations ADD CONSTRAINT community_post_translations_lang_check
  CHECK (lang = ANY (ARRAY['az','en','tr','ru','de','ar','ka','kk','uz','zh','id','fr','es','pt','vi','hi','ja','ko','pl','nl','sv','ky','et']::text[]));
