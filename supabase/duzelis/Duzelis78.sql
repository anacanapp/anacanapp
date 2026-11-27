-- Duzelis78 (2026-11-01): fix create_premium_sponsor_link_v1 — (1) RETURNS TABLE OUT names collided with
-- table columns ("column reference expires_at is ambiguous"); (2) gen_random_bytes needs pgcrypto which is
-- not installed. Add #variable_conflict use_column and build the token from gen_random_uuid() (built-in).
-- Function only; no table/RLS/CDC change. Applied once on Google (psql as supabase_admin).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.create_premium_sponsor_link_v1(p_kind text, p_relation text DEFAULT NULL, p_language text DEFAULT 'az')
RETURNS TABLE(token text, expires_at timestamptz, kind text, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  uid uuid := auth.uid();
  v_kind text := CASE WHEN p_kind IN ('partner', 'gift') THEN p_kind ELSE NULL END;
  v_relation text := CASE WHEN p_relation IN ('spouse', 'mother', 'father', 'sibling', 'family', 'other') THEN p_relation ELSE NULL END;
  v_language text := coalesce(nullif(p_language, ''), 'az');
  v_tok text;
  v_exp timestamptz;
  existing public.premium_sponsor_links%ROWTYPE;
  recent integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING errcode = '28000'; END IF;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'INVALID_KIND' USING errcode = '22023'; END IF;

  -- Mark the caller's lapsed links expired (housekeeping, cheap).
  UPDATE public.premium_sponsor_links
     SET status = 'expired'
   WHERE requester_user_id = uid AND status = 'pending' AND expires_at <= now();

  -- Reuse a fresh pending link of the same kind (>1 day left) so repeated taps share one URL.
  SELECT * INTO existing FROM public.premium_sponsor_links
   WHERE requester_user_id = uid AND kind = v_kind AND status = 'pending' AND expires_at > now() + interval '1 day'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE public.premium_sponsor_links SET relation = v_relation, language = v_language WHERE id = existing.id;
    RETURN QUERY SELECT existing.token, existing.expires_at, existing.kind, true;
    RETURN;
  END IF;

  -- Light abuse limit: at most 20 links created per user per hour.
  SELECT count(*) INTO recent FROM public.premium_sponsor_links
   WHERE requester_user_id = uid AND created_at > now() - interval '1 hour';
  IF recent >= 20 THEN RAISE EXCEPTION 'TOO_MANY_LINKS' USING errcode = '53400'; END IF;

  v_tok := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);  -- 42 url-safe hex chars (no pgcrypto)
  v_exp := now() + interval '7 days';
  INSERT INTO public.premium_sponsor_links(token, requester_user_id, kind, relation, language, expires_at)
  VALUES (v_tok, uid, v_kind, v_relation, v_language, v_exp);
  RETURN QUERY SELECT v_tok, v_exp, v_kind, false;
END $$;
ALTER FUNCTION public.create_premium_sponsor_link_v1(text, text, text) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.create_premium_sponsor_link_v1(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_premium_sponsor_link_v1(text, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
