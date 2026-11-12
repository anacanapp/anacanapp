# Fetal size and baby growth data (audit and fix, 2026-11-12)

## Sources
- Weight from 20 weeks: Hadlock FP, Harrist RB, Martinez-Poyer J. Radiology 1991;181:129-133, Table 1 and equation
  ln(w) = 0.578 + 0.332·GA − 0.00354·GA² (GA in weeks). 30 wk p97 is misprinted as 1,649 in the paper; 1949 is used.
- Weight 8-19 weeks and length 14-20 weeks (CRL) / 20-42 weeks (crown-heel): compiled embryology/autopsy table
  (Archie 2006, Hansen 2003, Cussen 1990, via UNSW Embryology). Length before 14 weeks: Robinson & Fleming 1975 CRL.
- Baby growth: WHO Child Growth Standards (WHO Anthro daily LMS tables); src/lib/whoGrowth.ts already matched them.

## Where the numbers live
| Place | What | Source of truth |
|---|---|---|
| Hero (pregnancy) | per day size, weight, fruit (+20 translations) | `pregnancy_daily_content` (migration `20261112140000_hero_growth_data_fix.sql`) |
| Hero fallback, stories, partner card | per completed week | `FRUIT_SIZES` in `src/types/anacan.ts`, built from `src/lib/fetal-size.ts` |
| anacan.az week pages | per week + FAQ answers | `src/website/pregnancy-weeks/weeks.ts` (same module) and `az.ts` prose |
| USM weight tool | 3/10/50/90/97th percentile | `src/lib/fetalGrowth.ts` → `HADLOCK_EFW` |
| Baby daily texts | growth figures | `baby_daily_info` (WHO p3-p97 and medians) |

Length is crown-rump until week 20 and crown-heel after, so it jumps at week 20; the hero shows a note
(`src/lib/fetal-size-copy.ts`, 23 languages). Week numbers: the hero shows completed weeks; content is keyed by
pregnancy day, so `week_number` in the table (1-based) does not affect the numbers.

## Translation alignment audit (2026-11-12)
All 1457 `baby_daily_info` days × 21 languages were checked (numbers vs the Azerbaijani text and every other day,
meaning of en/ar vs az, failure markers). Fixed in `20261112160000_baby_text_translation_fix.sql`:
- days 1096-1100: "[[TRANSLATION FAILED]]" placeholders in every language; new Azerbaijani texts + 20 translations;
- days 246 and 387: en, zh, id, fr, es, pt, vi, hi, ja, ko, pl, nl, sv held days 606 / 462; re-translated.
No other misaligned day was found.
