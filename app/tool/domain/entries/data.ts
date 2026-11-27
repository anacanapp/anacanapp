// Data tables read by gen_data.mjs. Everything here comes from the original TypeScript modules.
import { WFA_BOYS_25_60, WFA_GIRLS_25_60, HFA_BOYS_24_60, HFA_GIRLS_24_60, HCFA_BOYS, HCFA_GIRLS } from '@/lib/whoGrowthData';
import { FETAL_SIZE_BY_WEEK, HADLOCK_EFW } from '@/lib/fetal-size';
import { fetalLengthNote, FETAL_LENGTH_NOTE_LANGUAGES } from '@/lib/fetal-size-copy';
import { maternityRules } from '@/data/maternityRules';
import { maternityPolicy, REGIONAL_MATERNITY_COUNTRIES } from '@/lib/maternity-regional';
import { RECAP_COPY } from '@/lib/recap/copy';
import { RECAP_LOOKS, RECAP_MUSIC_2026 } from '@/lib/recap/model';
import { RECAP_PERSONA_TABLE } from '@/lib/recap/persona';
import { APP_LANGUAGES } from '@/lib/app-languages';
import { getEmergencyNumber } from '@/lib/emergency';
import { DANGER_SIGNS } from '@/lib/redFlags';
import { classifyBp } from '@/lib/bloodPressure';
import { FRUIT_SIZES, SYMPTOMS, MOODS } from '@/types/anacan';
import { AD_PLACEMENTS, TEST_APP_IDS, TEST_UNIT_IDS, TEST_STORY_VIDEO_IDS } from '@/lib/ads/config';
import { PARENTING_CONTENT_LANGUAGES } from '@/data/parenting';

export function collect() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const emergency: Record<string, string> = {};
  for (const a of letters) for (const b of letters) {
    const n = getEmergencyNumber(a + b);
    if (n !== '112') emergency[a + b] = n;
  }
  const bp: Record<string, unknown> = {};
  for (const [s, d, p] of [[80, 50, false], [110, 70, false], [125, 75, false], [135, 85, false], [145, 92, false], [185, 125, false]] as const) {
    const r = classifyBp(s, d, p);
    bp[r.category] = { label: r.label, emoji: r.emoji, bg: r.bg, ink: r.ink, guidance: r.guidance };
  }
  return {
    who: { WFA_BOYS_25_60, WFA_GIRLS_25_60, HFA_BOYS_24_60, HFA_GIRLS_24_60, HCFA_BOYS, HCFA_GIRLS },
    fetal: { FETAL_SIZE_BY_WEEK, HADLOCK_EFW, notes: Object.fromEntries(FETAL_LENGTH_NOTE_LANGUAGES.map((l) => [l, fetalLengthNote(l)])) },
    maternityRules,
    regional: { countries: REGIONAL_MATERNITY_COUNTRIES, currency: Object.fromEntries(REGIONAL_MATERNITY_COUNTRIES.map((c) => [c, maternityPolicy.countries[c].currency])) },
    recap: { RECAP_COPY, RECAP_LOOKS, RECAP_MUSIC_2026, RECAP_PERSONA_TABLE },
    languages: APP_LANGUAGES.map((l) => ({ code: l.code, locale: l.locale, flag: l.flag })),
    emergency,
    dangerSigns: DANGER_SIGNS,
    bp,
    anacan: { FRUIT_SIZES, SYMPTOMS, MOODS },
    ads: { AD_PLACEMENTS, TEST_APP_IDS, TEST_UNIT_IDS, TEST_STORY_VIDEO_IDS },
    parentingLanguages: PARENTING_CONTENT_LANGUAGES,
  };
}
