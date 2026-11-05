-- 2026-11-05 (owner decision): these tools are free for everyone. Stage activity (life_stages,
-- *_active, *_locked) is unchanged, so each tool stays visible only where it already was.
-- The client free list (src/lib/freemium.ts) carries the same ids.
UPDATE public.tool_configs
   SET is_premium = false, premium_type = 'none', premium_limit = 0, updated_at = now()
 WHERE tool_id IN ('doctors','hospital','danger-signs','vaccine-calendar','baby-album','pregnancy-album','mood')
   AND (is_premium IS DISTINCT FROM false OR premium_type IS DISTINCT FROM 'none');

-- Show each of these tools only in the stages it is meant for (its own life_stages):
-- e.g. Peyvənd Təqvimi was active for flow/bump too although life_stages = {mommy}.
UPDATE public.tool_configs
   SET flow_active  = ('flow'  = ANY(life_stages)),
       bump_active  = ('bump'  = ANY(life_stages)),
       mommy_active = ('mommy' = ANY(life_stages)),
       updated_at = now()
 WHERE tool_id IN ('doctors','hospital','danger-signs','vaccine-calendar','baby-album','pregnancy-album','mood')
   AND (flow_active  IS DISTINCT FROM ('flow'  = ANY(life_stages))
     OR bump_active  IS DISTINCT FROM ('bump'  = ANY(life_stages))
     OR mommy_active IS DISTINCT FROM ('mommy' = ANY(life_stages)));
