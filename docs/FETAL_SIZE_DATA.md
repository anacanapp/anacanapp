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

## Known open item
`baby_daily_info` day 246: 13 translations (en, zh, ja, ko, fr, es, pt, id, vi, hi, pl, nl, sv) hold another day's
(20-month) text; it needs re-translation, not a number fix.
