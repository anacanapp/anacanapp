# Translating "Uşaqla oyun" (Play together)

Anacan is a pregnancy and motherhood app. "Uşaqla oyun" is a tool with screen-free games a parent plays with a
child (6 months to 8 years). The source is Azerbaijani.

Source files (read, do not change):
- `src/data/play-together/az.ts`: 48 games (`PLAY_GAMES_AZ`), with fields title, why, materials[], steps[], tip?, safety?.
- `src/data/play-together/ui-az.ts`: UI strings (`PLAY_UI_AZ`).
- `src/data/play-together/types.ts`: the `PlayLocale` type your file must satisfy.

Write `src/data/play-together/<lang>.ts`:

```ts
import type { PlayLocale } from './types';

const locale: PlayLocale = {
  ui: { /* every key of PLAY_UI_AZ, translated */ },
  games: {
    peekaboo: { title: '...', why: '...', materials: ['...'], steps: ['...'], tip: '...' },
    // every game id from az.ts, in the same order
  },
};
export default locale;
```

Rules:
1. Every game id; `materials` and `steps` keep exactly the same number of items and order. Include `tip` / `safety`
   only when the source has them.
2. Keep `{n}` and `{name}` placeholders exactly as they are. `ageLabel` keys stay '6m','1y',...,'6y'
   (labels like "6-12 months", "1 year", "6+ years"). `ageMonths` is like "{n} mo", `ageYears` like "{n} yrs".
3. Write natural, warm, simple parenting language as a native speaker would, addressing the parent. Not literal.
   Formal "you" where the language has it (ru «вы», tr "siz", de: informal "du", fr "vous", ar: feminine singular
   أنتِ). kk Cyrillic, uz Latin, ky Cyrillic, zh Simplified.
4. Adapt culture-specific content so it works in that language:
   - word games (`word-chain`, `letter-hunt`, `i-spy`): use that language's alphabet/sounds and real example words;
     for zh/ja/ko adapt naturally (ja: shiritori, zh: 词语接龙 by the last character, ko: 끝말잇기).
   - `world-trip`: replace Azerbaijan with "your country" and its animals with "animals of your country" style
     wording (no specific country).
   - `shop-play`: "manat" becomes a neutral word ("coins", "money").
   - Keep foods, materials and measurements generic and commonly available.
5. Safety notes must keep their full meaning (choking, magnets, water, scissors). Do not soften them.
6. "Mənbə: ÜST (2019), Amerika Pediatriya Akademiyası" = "Source: WHO (2019), American Academy of Pediatrics" using
   the language's usual name/abbreviation for WHO.
7. Never use the long dash "—" anywhere. Use commas, colons or a plain hyphen.
8. No Azerbaijani words left in the output.
9. Also add your language to `src/data/play-together/tile.ts` is NOT your job: do not edit tile.ts or any other file.

Check your file: `npx vitest run src/data/play-together/play-i18n.test.ts -t "<lang>"` from the repo root.
Failures about tile.ts and about other languages' missing files are expected (the coordinator fills tile.ts).
Fix everything else for your languages. Then type-check quickly: `npx tsc --noEmit -p tsconfig.app.json`
(errors in other languages' missing files are expected while others are still writing).
