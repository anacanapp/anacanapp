# Uşaq məşqləri: translator brief

Source: `src/data/kid-exercises/az.json` (5 age groups, 141 exercises) and `src/data/kid-exercises/ui-az.ts` (UI strings).
Each language is one file, `src/data/kid-exercises/<lang>.json`:

```json
{
  "ui": { "...": "every key of KIDEX_UI_AZ, same keys, translated" },
  "sets": { "0-1": { "label": "...", "months": "...", "rules": ["... same count and order as az ..."] } },
  "groups": { "0–3 ay": "...", "Topla oyunlar": "..." },
  "exercises": { "0-1/01_tummy_time": { "title": "...", "age": "...", "how": "...", "duration": "...", "benefit": "...", "caution": "..." } }
}
```

Rules
- Translate from the Azerbaijani meaning into natural, warm parent-facing language, the way a careful paediatric
  physiotherapist would explain it. Not word for word. Same form of address as the rest of the app in that language
  (see `src/data/play-together/<lang>.ts`: e.g. Russian «вы», German «Sie»/«du» as used there, Turkish «siz»).
- Keep every id, key and the structure. `groups` has one entry for every distinct `group` value in az.json (18).
  `caution` only where the source has one. `rules` keep the source count and order.
- Keep every number, range and unit exactly (2–3, 30–40, 1 m, 30 sm → 30 cm), always with Western digits 0-9. Use the local decimal and range style
  only if it is clearly required; an en dash range like `1–3` is fine everywhere.
- `benefit` and `caution` in the source start lowercase after a label; in the translation start them with a capital
  letter (the app shows them under their own heading). The same for `duration`.
- Placeholders `{n}` and `{name}` stay exactly as they are.
- No long dashes (—) as sentence punctuation; use a comma, colon or a new sentence.
- Safety meaning must not change: "only while awake and supervised", "always on the back to sleep", "helmet",
  "stop if the child cries or is tired", "ask a paediatrician" must stay as strong as the source.
- Valid JSON (UTF-8, no comments, no trailing commas).

Check: `node scripts/check-kid-exercises-locale.mjs <lang>` and `npx vitest run src/data/kid-exercises`.
