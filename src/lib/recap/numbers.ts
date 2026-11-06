/**
 * Deterministic number, percent and unit formatting for the 23 app languages.
 * Intl is not used on purpose: Chromium (and Android WebView) ship reduced ICU data without, e.g.,
 * Azerbaijani or Kyrgyz, which would turn "1.505 gün" into "1,505 days" on some devices and make
 * frames differ between devices. CLDR separators and plural rules are reproduced here for what the video needs.
 */

interface Seps { group: string; decimal: string; minGroup?: number }
const NB = ' ';
const NNB = ' ';
const SEPS: Record<string, Seps> = {
  az: { group: NB, decimal: ',' }, en: { group: ',', decimal: '.' }, tr: { group: '.', decimal: ',' }, ru: { group: NB, decimal: ',' },
  de: { group: '.', decimal: ',' }, ar: { group: ',', decimal: '.' }, ka: { group: NB, decimal: ',' }, kk: { group: NB, decimal: ',' },
  uz: { group: NB, decimal: ',' }, zh: { group: ',', decimal: '.' }, id: { group: '.', decimal: ',' }, fr: { group: NNB, decimal: ',' },
  es: { group: '.', decimal: ',', minGroup: 2 }, pt: { group: NB, decimal: ',', minGroup: 2 }, vi: { group: '.', decimal: ',' },
  hi: { group: ',', decimal: '.' }, ja: { group: ',', decimal: '.' }, ko: { group: ',', decimal: '.' }, pl: { group: NB, decimal: ',', minGroup: 2 },
  nl: { group: '.', decimal: ',' }, sv: { group: NB, decimal: ',' }, ky: { group: NB, decimal: ',' }, et: { group: NB, decimal: ',', minGroup: 2 },
};

export function formatNumber(lang: string, n: number, decimals = 0): string {
  const s = SEPS[lang] ?? SEPS.en;
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.length > 3 + ((s.minGroup ?? 1) - 1) ? int.replace(/\B(?=(\d{3})+(?!\d))/g, s.group) : int;
  return `${neg ? '-' : ''}${grouped}${frac ? s.decimal + frac : ''}`;
}

export function formatPercent(lang: string, n: number): string {
  const v = formatNumber(lang, Math.round(n));
  if (lang === 'tr') return `%${v}`;
  if (['de', 'ru', 'fr', 'sv', 'pl', 'et', 'kk', 'ky', 'uz', 'ka', 'nl', 'es', 'pt'].includes(lang)) return `${v}${lang === 'fr' ? NNB : NB}%`;
  return `${v}%`;
}

type Plural = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** CLDR cardinal categories for the languages that inflect after numerals. */
export function pluralOf(lang: string, n: number): Plural {
  const int = Number.isInteger(n);
  const i = Math.floor(Math.abs(n)), m10 = i % 10, m100 = i % 100;
  switch (lang) {
    case 'en': case 'de': case 'nl': case 'sv': case 'es': case 'et': return int && i === 1 ? 'one' : 'other';
    case 'pt': case 'fr': case 'hi': return i <= 1 ? 'one' : 'other';
    case 'ru':
      if (!int) return 'other';
      if (m10 === 1 && m100 !== 11) return 'one';
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
      return 'many';
    case 'pl':
      if (!int) return 'other';
      if (i === 1) return 'one';
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
      return 'many';
    case 'ar':
      if (!int) return 'other';
      if (i === 0) return 'zero';
      if (i === 1) return 'one';
      if (i === 2) return 'two';
      if (m100 >= 3 && m100 <= 10) return 'few';
      if (m100 >= 11) return 'many';
      return 'other';
    default: return 'other';
  }
}

type Forms = Partial<Record<Plural, string>> & { other: string };
const glue = new Set(['zh', 'ja', 'ko']);
const DAY: Record<string, Forms> = {
  az: { other: 'gün' }, en: { one: 'day', other: 'days' }, tr: { other: 'gün' }, ru: { one: 'день', few: 'дня', many: 'дней', other: 'дня' },
  de: { one: 'Tag', other: 'Tage' }, ar: { zero: 'يوم', one: 'يوم', two: 'يومان', few: 'أيام', many: 'يومًا', other: 'يوم' }, ka: { other: 'დღე' },
  kk: { other: 'күн' }, uz: { other: 'kun' }, zh: { other: '天' }, id: { other: 'hari' }, fr: { one: 'jour', other: 'jours' },
  es: { one: 'día', other: 'días' }, pt: { one: 'dia', other: 'dias' }, vi: { other: 'ngày' }, hi: { one: 'दिन', other: 'दिन' }, ja: { other: '日' },
  ko: { other: '일' }, pl: { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' }, nl: { one: 'dag', other: 'dagen' }, sv: { one: 'dag', other: 'dagar' },
  ky: { other: 'күн' }, et: { one: 'päev', other: 'päeva' },
};
const HOUR: Record<string, Forms> = {
  az: { other: 'saat' }, en: { one: 'hour', other: 'hours' }, tr: { other: 'saat' }, ru: { one: 'час', few: 'часа', many: 'часов', other: 'часа' },
  de: { one: 'Stunde', other: 'Stunden' }, ar: { zero: 'ساعة', one: 'ساعة', two: 'ساعتان', few: 'ساعات', many: 'ساعة', other: 'ساعة' }, ka: { other: 'საათი' },
  kk: { other: 'сағат' }, uz: { other: 'soat' }, zh: { other: '小时' }, id: { other: 'jam' }, fr: { one: 'heure', other: 'heures' },
  es: { one: 'hora', other: 'horas' }, pt: { one: 'hora', other: 'horas' }, vi: { other: 'giờ' }, hi: { one: 'घंटा', other: 'घंटे' }, ja: { other: '時間' },
  ko: { other: '시간' }, pl: { one: 'godzina', few: 'godziny', many: 'godzin', other: 'godziny' }, nl: { one: 'uur', other: 'uur' }, sv: { one: 'timme', other: 'timmar' },
  ky: { other: 'саат' }, et: { one: 'tund', other: 'tundi' },
};
const KG: Record<string, string> = {
  az: 'kq', ru: 'кг', kk: 'кг', ky: 'кг', ka: 'კგ', ar: 'كغ', hi: 'कि.ग्रा.', zh: '公斤', ja: 'kg', ko: 'kg',
};

export type RecapUnit = 'day' | 'hour' | 'kilogram';

export function formatUnit(lang: string, n: number, unit: RecapUnit, decimals = 0): string {
  const rounded = Number(n.toFixed(decimals));
  const value = formatNumber(lang, rounded, Number.isInteger(rounded) ? 0 : decimals);
  if (unit === 'kilogram') return `${value}${glue.has(lang) && lang === 'zh' ? '' : NB}${KG[lang] ?? 'kg'}`;
  const table = unit === 'day' ? DAY : HOUR;
  const forms = table[lang] ?? table.en;
  const word = forms[pluralOf(lang, rounded)] ?? forms.other;
  return glue.has(lang) ? `${value}${word}` : `${value}${NB}${word}`;
}

/** 24-hour clock, "22:00". */
export const formatHour = (hour: number) => `${String(Math.max(0, Math.min(23, Math.floor(hour)))).padStart(2, '0')}:00`;
