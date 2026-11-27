-- crash_reports insert filter after 20261125170000_push_expected_outcomes_noise.sql.
-- Runs in one transaction and rolls back. Prints PUSH_NOISE_FILTER_OK when every check passes.
BEGIN;
SET LOCAL client_min_messages = warning;

DO $$
DECLARE
  tag text := 'push-noise-test-' || gen_random_uuid()::text;
  kept int;
BEGIN
  INSERT INTO public.crash_reports (error_message, url) VALUES
    ('[push:community_like] no_device_tokens', tag),
    ('[push:group_message] preferences_disabled', tag),
    ('[push:story_like] duplicate', tag),
    ('[push:group_message] not_member', tag),
    ('[push:community_like] device_tokens_rejected', tag),
    ('[push:comment_like] interaction_gone', tag),
    ('[auth:apple] AuthorizationError error 1001', tag),
    -- real failures stay
    ('[push:community_like] invoke error: Edge Function returned a non-2xx status code', tag),
    ('[push:group_message_fanout] fanout incomplete', tag),
    ('[push:community_reply] contract error: empty title or body', tag),
    ('[push:direct_message] fcm_not_configured', tag),
    ('[push:community_like] interaction_gone and more', tag),
    ('TypeError: x is undefined', tag);

  SELECT count(*) INTO kept FROM public.crash_reports WHERE url = tag;
  IF kept <> 6 THEN RAISE EXCEPTION 'T1 expected 6 kept rows, got %', kept; END IF;
  IF EXISTS (SELECT 1 FROM public.crash_reports WHERE url = tag
             AND error_message ~ '(no_device_tokens|preferences_disabled|duplicate|not_member|device_tokens_rejected|interaction_gone)$') THEN
    RAISE EXCEPTION 'T2 an expected push outcome was stored';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crash_reports WHERE url = tag AND error_message LIKE '%fanout incomplete') THEN
    RAISE EXCEPTION 'T3 a real failure was dropped';
  END IF;
  RAISE WARNING 'PUSH_NOISE_FILTER_OK';
END $$;

ROLLBACK;
