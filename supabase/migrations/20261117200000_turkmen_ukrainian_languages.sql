-- Turkmen (tk) and Ukrainian (uk) app languages, after Kyrgyz/Estonian (20261103180000).
-- Content ships as source-bound bundles (no new _tk/_uk content columns); the server-side language
-- allow-lists and contracts accept tk/uk. Push template columns follow in the companion Duzelis file.
-- Idempotent: functions that already list 'tk' are skipped.
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
    IF def ~ '''tk''' THEN CONTINUE; END IF;
    changed := regexp_replace(def, '''et''(::text)?', '''et''\1,''tk''\1,''uk''\1', 'g');
    IF changed = def THEN RAISE EXCEPTION 'TK_UK_LANGUAGE_LIST_NOT_FOUND %', f; END IF;
    EXECUTE changed;
  END LOOP;
END $$;

ALTER TABLE public.community_post_translations DROP CONSTRAINT IF EXISTS community_post_translations_lang_check;
ALTER TABLE public.community_post_translations ADD CONSTRAINT community_post_translations_lang_check
  CHECK (lang = ANY (ARRAY['az','en','tr','ru','de','ar','ka','kk','uz','zh','id','fr','es','pt','vi','hi','ja','ko','pl','nl','sv','ky','et','tk','uk']::text[]));
