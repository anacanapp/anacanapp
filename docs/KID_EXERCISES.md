# Uşaq məşqləri (2026-11-21)

Illustrated movement exercises a parent does with a child from birth to 5 years: 141 exercises in 5 age groups
(0–1, 1–2, 2–3, 3–4, 4–5 years), each with an illustration, age, how to do it, duration, benefit and, where needed,
a caution. Source: the owner's "Uşaq məşqləri kitabxanası" artifact (data.json + 141 illustrations).

- Tool id `kid-exercises`, a code tool (`src/lib/code-tools.ts`), free (`FREE_TOOL_IDS`); the admin can make it Premium
  with `tool_configs.is_premium` once the row exists. Visible for the Ana module in every language with content
  (admins in any stage). ToolsHub shows it even before the row exists (virtual tile, like Süddən ayırma).
- Row: migration `20261121120000_kid_exercises_tool.sql` (+ `.cdc.json`): `tool_configs` row with `is_active = false`
  on purpose (older native builds never show it) and the code-tools read policy widened to include it. Data and policy
  only; `tool_configs` is already guarded.
- Content: `src/data/kid-exercises/az.json` is the source (sets with month ranges and general rules, exercises in
  display order, group labels, Azerbaijani text). Each other language is its own lazy JSON chunk
  `src/data/kid-exercises/<lang>.json` (UI strings, set labels and rules, group labels, exercise text by id).
  `tile.ts` holds the tile name per language and the language list; `index.ts` the lazy loaders.
  Translator brief: `src/data/kid-exercises/TRANSLATING.md`; checks: `node scripts/check-kid-exercises-locale.mjs <lang>`
  and `src/data/kid-exercises/kid-exercises-i18n.test.ts`.
- Images: `public/exercises/<set>/<file>.webp`, 640×640 (resized from the 1024 px originals), no text on them, shared
  by every language. Drawn on white, so they always sit on a white plate (also in dark mode).
- Logic: `src/lib/kid-exercises.ts`: age group from the child's age, the child's current month group in the first two
  sets ("İndiki yaş" badge), three daily picks (in baby groups only the child's group and younger groups), search,
  progress on the phone per account (done today, favourites, chosen group; bounded: 400 log rows, 60 favourites).
  No server relation.
- Screen: `src/components/tools/exercises/KidExercisesTool.tsx`: age tabs, today card with 7-day dots and a safety
  note, today's three picks, search, all/favourites, general rules per group, grouped list; exercise screen with
  illustration, age and duration, how, benefit, caution, a stopwatch, "Etdik", previous/next.
- Analytics: `kid_exercises_opened`, `kid_exercise_viewed`, `kid_exercise_done`.
- Content review: the source texts were not checked by a specialist. A paediatrician or a children's
  physiotherapist should review them (Azerbaijani first) before wide promotion.

## Deploy (2026-11-22)

- Migration `20261121120000_kid_exercises_tool.sql` applied on `anacan` (row `kid-exercises`: is_active=false,
  mommy_active=true, is_premium=false, order 936; code-tools read policy lists it).
- Web: gateway `sha256:f84ddd27…` (tag `gw-kidex-202611220634`, index `index-ChUR7vEQ.js`), plan
  `/home/anacan-runner/kidex-web-plan.json`; rollback: `sudo python3 /home/anacan-runner/deploy-current-web.py
  /home/anacan-runner/rollback-kidex-web-plan.json` (back to `sha256:5b73a2d2…`).
- Native apps need a new build to show the tool.
