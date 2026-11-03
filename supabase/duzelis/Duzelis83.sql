-- Duzelis83.sql — partner fixes that need no app update (Google, psql as supabase_admin).
-- Existing relations only (shopping_items, partner_messages, user_children stay CDC/writer guarded);
-- new objects are functions/triggers/policies.
--
-- 1. Shared shopping list. RLS allowed `uid = user_id OR uid = partner_id`, and partner_id was filled by
--    the app at insert time from the adder's link. Rows added before linking, after a re-link or when
--    that lookup failed carried partner_id NULL (99 of 134 rows), so the other person never saw them.
--    Now: the linked couple sees each other's rows; partner_id is filled/refreshed on the server.
-- 2. partner_children_v1(): the woman's active children for her linked partner (build 48 shows all).
-- 3. Daily summary message: the app always wrote "Mood | Water | Kicks" whatever the stage. A BEFORE
--    INSERT trigger rewrites the partner_messages 'daily_summary' body from real data by the sender's
--    stage (mommy: baby feeds/sleep/diapers + mother; flow: cycle day; bump: unchanged), honouring the
--    woman's partner_sharing_settings. Language-neutral (emoji + numbers).

-- ── 1. Shopping list ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own shopping items" ON public.shopping_items;
CREATE POLICY "Users can manage own shopping items" ON public.shopping_items
  FOR ALL TO public
  USING (auth.uid() = user_id OR auth.uid() = partner_id
         OR (auth.uid() IS NOT NULL AND user_id = public.get_linked_partner_user_id(auth.uid())))
  WITH CHECK (auth.uid() = user_id OR auth.uid() = partner_id
         OR (auth.uid() IS NOT NULL AND user_id = public.get_linked_partner_user_id(auth.uid())));

CREATE OR REPLACE FUNCTION public.shopping_items_fill_partner_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $$
DECLARE linked uuid;
BEGIN
  BEGIN
    linked := public.get_linked_partner_user_id(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN linked := NULL; END;
  IF linked IS NOT NULL THEN NEW.partner_id := linked; END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION public.shopping_items_fill_partner_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.shopping_items_fill_partner_v1() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_shopping_items_fill_partner ON public.shopping_items;
CREATE TRIGGER trg_shopping_items_fill_partner BEFORE INSERT ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.shopping_items_fill_partner_v1();

-- Existing rows of currently linked users point at the current partner.
UPDATE public.shopping_items s SET partner_id = public.get_linked_partner_user_id(s.user_id)
 WHERE public.get_linked_partner_user_id(s.user_id) IS NOT NULL
   AND s.partner_id IS DISTINCT FROM public.get_linked_partner_user_id(s.user_id);

-- ── 2. Children for the linked partner ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.partner_children_v1()
RETURNS TABLE(id uuid, name text, birth_date date, gender text, avatar_emoji text, sort_order integer, due_date date, is_current boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
DECLARE owner uuid := public.get_linked_partner_user_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF owner IS NULL OR NOT public.partner_can_see_v1(owner, 'baby_logs') THEN RETURN; END IF;
  RETURN QUERY
    SELECT c.id, c.name, c.birth_date, c.gender, c.avatar_emoji, c.sort_order, c.due_date,
           (c.birth_date = p.baby_birth_date AND lower(btrim(c.name)) = lower(btrim(coalesce(p.baby_name, ''))))
      FROM public.user_children c JOIN public.profiles p ON p.user_id = c.user_id
     WHERE c.user_id = owner AND c.is_active
     ORDER BY c.birth_date DESC NULLS LAST, c.sort_order NULLS LAST, c.created_at;
END $$;
ALTER FUNCTION public.partner_children_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.partner_children_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_children_v1() TO authenticated;

-- ── 3. Stage-aware daily summary message ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.partner_summary_stage_body_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $$
DECLARE
  doc jsonb; prof record; sh record; d date; dl record; parts text[] := '{}';
  feeds int; feed_ml int; sleep_min int; diapers int; cday int; clen int; plen int; moods text[] := ARRAY['😢','😔','😐','🙂','😊'];
  stage text;
BEGIN
  IF NEW.message_type IS DISTINCT FROM 'daily_summary' THEN RETURN NEW; END IF;
  BEGIN doc := NEW.content::jsonb; EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  SELECT p.life_stage, p.last_period_date, p.cycle_length, p.period_length INTO prof FROM public.profiles p WHERE p.user_id = NEW.sender_id;
  stage := coalesce(prof.life_stage, '');
  IF stage NOT IN ('mommy', 'flow') THEN RETURN NEW; END IF;  -- bump keeps mood | water | kicks
  SELECT * INTO sh FROM public.partner_sharing_settings s WHERE s.user_id = NEW.sender_id;
  d := coalesce(nullif(doc #>> '{summary,summary_date}', '')::date, (now() AT TIME ZONE 'Asia/Baku')::date);
  SELECT l.mood, l.water_intake INTO dl FROM public.daily_logs l WHERE l.user_id = NEW.sender_id AND l.log_date = d ORDER BY l.created_at DESC LIMIT 1;

  IF stage = 'mommy' AND coalesce(sh.share_baby_logs, true) THEN
    SELECT count(*) FILTER (WHERE b.log_type = 'feeding'),
           coalesce(sum(b.amount_ml) FILTER (WHERE b.log_type = 'feeding'), 0),
           coalesce(sum(greatest(0, extract(epoch FROM (b.end_time - b.start_time)) / 60)) FILTER (WHERE b.log_type = 'sleep' AND b.end_time IS NOT NULL), 0)::int,
           count(*) FILTER (WHERE b.log_type = 'diaper')
      INTO feeds, feed_ml, sleep_min, diapers
      FROM public.baby_logs b
     WHERE b.user_id = NEW.sender_id AND (b.start_time AT TIME ZONE 'Asia/Baku')::date = d;
    parts := parts || ('🍼 ' || feeds || CASE WHEN feed_ml > 0 THEN ' (' || feed_ml || ' ml)' ELSE '' END);
    parts := parts || ('😴 ' || (sleep_min / 60) || ':' || lpad((sleep_min % 60)::text, 2, '0'));
    parts := parts || ('🧷 ' || diapers);
  ELSIF stage = 'flow' AND coalesce(sh.share_cycle, true) AND prof.last_period_date IS NOT NULL THEN
    clen := greatest(coalesce(prof.cycle_length, 28), 15); plen := greatest(coalesce(prof.period_length, 5), 1);
    cday := ((d - prof.last_period_date) % clen + clen) % clen + 1;
    parts := parts || ('📅 ' || cday || '/' || clen || CASE WHEN cday <= plen THEN ' 🩸'
                          WHEN cday BETWEEN clen - 18 AND clen - 11 THEN ' 🌸' ELSE '' END);
  END IF;
  IF coalesce(sh.share_mood, true) AND dl.mood BETWEEN 1 AND 5 THEN parts := parts || moods[dl.mood]; END IF;
  IF coalesce(sh.share_water, true) AND coalesce(dl.water_intake, 0) > 0 THEN parts := parts || ('💧 ' || dl.water_intake || ' ml'); END IF;
  IF array_length(parts, 1) IS NULL THEN RETURN NEW; END IF;
  doc := jsonb_set(doc, '{body}', to_jsonb(array_to_string(parts, ' | ')));
  doc := doc || jsonb_build_object('stage', stage);
  NEW.content := doc::text;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block the message
END $$;
ALTER FUNCTION public.partner_summary_stage_body_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.partner_summary_stage_body_v1() FROM PUBLIC, anon, authenticated;
-- Name sorts before chat_message_contract_v2, so the contract validates the rewritten content.
DROP TRIGGER IF EXISTS anacan_daily_summary_stage_v1 ON public.partner_messages;
CREATE TRIGGER anacan_daily_summary_stage_v1 BEFORE INSERT ON public.partner_messages
  FOR EACH ROW EXECUTE FUNCTION public.partner_summary_stage_body_v1();

NOTIFY pgrst, 'reload schema';

-- ── 1b. (applied right after the block above) ───────────────────────────────
-- The app inserts priority 'medium' (default and the partner screen), but the check only allowed
-- low/normal/high/urgent, so those inserts failed and partner-added items were never saved.
ALTER TABLE public.shopping_items DROP CONSTRAINT IF EXISTS shopping_items_priority_check;
ALTER TABLE public.shopping_items ADD CONSTRAINT shopping_items_priority_check
  CHECK (priority = ANY (ARRAY['low','normal','medium','high','urgent']::text[]));
-- get_linked_partner_user_id() only answers for the caller (auth.uid()), so the backfill above matched
-- nothing when run without a session. Backfill from the mutual profile link directly.
UPDATE public.shopping_items s SET partner_id = other.user_id
  FROM public.profiles me JOIN public.profiles other
    ON other.id = me.linked_partner_id AND other.linked_partner_id = me.id AND other.id <> me.id
 WHERE me.user_id = s.user_id AND s.partner_id IS DISTINCT FROM other.user_id;
