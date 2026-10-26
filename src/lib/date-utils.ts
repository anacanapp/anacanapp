import { tr } from "@/lib/tr";import { format } from 'date-fns';
import { az, enUS, ru, tr as trLocale, kk, de, ar, uz, ka, zhCN, id, fr, es, pt, vi, hi, ja, ko, pl, nl, sv } from 'date-fns/locale';
import { getPersistedLanguage } from './tr';
import { NEW_LANGUAGE_CODES, appLanguageLocale } from './app-languages';

/** Sunday-first labels for weekly grids; the date stays in UTC. */
export function weekdayLabels(language: string): string[] {
  const formatter = new Intl.DateTimeFormat(appLanguageLocale(language), { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2024, 0, 7 + index))));
}

export const getCurrentDateLocale = () => {
  const lang = getPersistedLanguage();
  if (lang === 'en') return enUS;
  if (lang === 'ru') return ru;
  if (lang === 'tr') return trLocale;
  if (lang === 'kk') return kk;
  if (lang === 'de') return de;
  if (lang === 'ar') return ar;
  if (lang === 'uz') return uz;
  if (lang === 'ka') return ka;
  if (lang === 'zh') return zhCN;
  if (lang === 'id') return id;
  if (lang === 'fr') return fr;
  if (lang === 'es') return es;
  if (lang === 'pt') return pt;
  if (lang === 'vi') return vi;
  if (lang === 'hi') return hi;
  if (lang === 'ja') return ja;
  if (lang === 'ko') return ko;
  if (lang === 'pl') return pl;
  if (lang === 'nl') return nl;
  if (lang === 'sv') return sv;
  return az;
};
/**
 * Format date to Azerbaijani format: "18 Fevral" or "18 Fevral 2025"
 */
export const getTranslatedMonth = (monthIndex: number): string => {
  const months = [
    tr('month_january', 'Yanvar'),
    tr('month_february', 'Fevral'),
    tr('month_march', 'Mart'),
    tr('month_april', 'Aprel'),
    tr('month_may', 'May'),
    tr('month_june', 'İyun'),
    tr('month_july', 'İyul'),
    tr('month_august', 'Avqust'),
    tr('month_september', 'Sentyabr'),
    tr('month_october', 'Oktyabr'),
    tr('month_november', 'Noyabr'),
    tr('month_december', 'Dekabr')
  ];
  return months[monthIndex] || '';
};

/**
 * Format date to Azerbaijani format: "18 Fevral" or "18 Fevral 2025"
 */
export const formatDateAz = (date: Date | string, includeYear = false): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const language = getPersistedLanguage();
  if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) return new Intl.DateTimeFormat(appLanguageLocale(language), {
    day: 'numeric', month: 'long', ...(includeYear ? { year: 'numeric' as const } : {}),
    ...(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { timeZone: 'UTC' } : {}),
  }).format(d);

  const day = d.getDate();
  const month = getTranslatedMonth(d.getMonth());
  const year = d.getFullYear();
  return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
};

/**
 * Format date with time: "18 Fevral, 14:30"
 */
export const formatDateTimeAz = (date: Date | string, includeYear = false): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const language = getPersistedLanguage();
  if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) return new Intl.DateTimeFormat(appLanguageLocale(language), {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, ...(includeYear ? { year: 'numeric' as const } : {}),
  }).format(d);

  const day = d.getDate();
  const month = getTranslatedMonth(d.getMonth());
  const year = d.getFullYear();
  const time = format(d, 'HH:mm');
  return includeYear ? `${day} ${month} ${year}, ${time}` : `${day} ${month}, ${time}`;
};

/**
 * Format time only: "14:30"
 */
export const formatTimeAz = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return format(d, 'HH:mm', { locale: getCurrentDateLocale() });
};

/**
 * Format relative date: "Bu gün", "Dünən", or full date
 */
export const formatRelativeDateAz = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return `${tr("dateutils_today", "Bu gün")}, ${formatTimeAz(d)}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `${tr("dateutils_yesterday", "Dünən")}, ${formatTimeAz(d)}`;
  }

  return formatDateTimeAz(d);
};

/**
 * Symptom translation map - Returns dynamically evaluated map so `tr()` gets the active language.
 */
export const getSymptomTranslations = (): Record<string, string> => ({
  // Common symptoms
  'headache': tr("dateutils_basagrisi_9e17a3", "Başağrısı"),
  'Headache': tr("dateutils_basagrisi_9e17a3", "Başağrısı"),
  'tired': tr("dateutils_yorgunluq_c68d62", "Yorğunluq"),
  'Tired': tr("dateutils_yorgunluq_c68d62", "Yorğunluq"),
  'fatigue': tr("dateutils_yorgunluq_c68d62", "Yorğunluq"),
  'Fatigue': tr("dateutils_yorgunluq_c68d62", "Yorğunluq"),
  'nausea': tr("dateutils_urekbulanma_a42830", "Ürəkbulanma"),
  'Nausea': tr("dateutils_urekbulanma_a42830", "Ürəkbulanma"),
  'cramps': tr("dateutils_sanci_350c2d", "Sancı"),
  'Cramps': tr("dateutils_sanci_350c2d", "Sancı"),
  'bloating': tr("dateutils_siskinlik_7c7923", "Şişkinlik"),
  'Bloating': tr("dateutils_siskinlik_7c7923", "Şişkinlik"),
  'back_pain': tr("dateutils_bel_agrisi_9e824e", "Bel ağrısı"),
  'backpain': tr("dateutils_bel_agrisi_9e824e", "Bel ağrısı"),
  'Back Pain': tr("dateutils_bel_agrisi_9e824e", "Bel ağrısı"),
  'mood_swings': tr("dateutils_ehval_deyisikliyi_9fa36f", "Əhval dəyişikliyi"),
  'Mood Swings': tr("dateutils_ehval_deyisikliyi_9fa36f", "Əhval dəyişikliyi"),
  'insomnia': tr("dateutils_yuxusuzluq_68d6ab", "Yuxusuzluq"),
  'Insomnia': tr("dateutils_yuxusuzluq_68d6ab", "Yuxusuzluq"),
  'appetite_changes': tr("dateutils_i_stah_deyisikliyi_fea8a7", "İştah dəyişikliyi"),
  'Appetite Changes': tr("dateutils_i_stah_deyisikliyi_fea8a7", "İştah dəyişikliyi"),
  'breast_tenderness': tr("dateutils_dos_hessasligi_326b6d", "Döş həssaslığı"),
  'Breast Tenderness': tr("dateutils_dos_hessasligi_326b6d", "Döş həssaslığı"),
  'acne': tr("dateutils_sizanaq_0b0664", "Sızanaq"),
  'Acne': tr("dateutils_sizanaq_0b0664", "Sızanaq"),
  'dizziness': tr("dateutils_basgicellenme_9e0b89", "Başgicəllənmə"),
  'Dizziness': tr("dateutils_basgicellenme_9e0b89", "Başgicəllənmə"),
  'anxiety': tr("dateutils_narahatliq_33f05c", "Narahatlıq"),
  'Anxiety': tr("dateutils_narahatliq_33f05c", "Narahatlıq"),
  'stress': tr("dateutils_stress", 'Stress'),
  'Stress': tr("dateutils_stress", 'Stress'),
  'swelling': tr("dateutils_sislik_cd02e0", "Şişlik"),
  'Swelling': tr("dateutils_sislik_cd02e0", "Şişlik"),
  'constipation': tr("dateutils_qebizlik_aef088", "Qəbizlik"),
  'Constipation': tr("dateutils_qebizlik_aef088", "Qəbizlik"),
  'heartburn': tr("dateutils_kopukleme_2d7a33", "Köpükləmə"),
  'Heartburn': tr("dateutils_kopukleme_2d7a33", "Köpükləmə"),
  'frequent_urination': tr("dateutils_tez_tez_sidike_getme_bfc357", "Tez-tez sidikə getmə"),
  'Frequent Urination': tr("dateutils_tez_tez_sidike_getme_bfc357", "Tez-tez sidikə getmə"),
  'hot_flashes': tr("dateutils_i_stilikler_9c6091", "İstiliklər"),
  'Hot Flashes': tr("dateutils_i_stilikler_9c6091", "İstiliklər"),
  'cravings': tr("dateutils_i_stah_artimi_2b1e0b", "İştah artımı"),
  'Cravings': tr("dateutils_i_stah_artimi_2b1e0b", "İştah artımı"),
  // Flow specific
  'bas_agrisi': tr("dateutils_basagrisi_9e17a3", "Başağrısı"),
  'sanci': tr("dateutils_sanci_350c2d", "Sancı"),
  'yorgunluq': tr("dateutils_yorgunluq_c68d62", "Yorğunluq"),
  'siskinlik': tr("dateutils_siskinlik_7c7923", "Şişkinlik"),
  'bel_agrisi': tr("dateutils_bel_agrisi_9e824e", "Bel ağrısı"),
  'ehval_deyisikliyi': tr("dateutils_ehval_deyisikliyi_9fa36f", "Əhval dəyişikliyi")
});

/**
 * Translate symptom to Azerbaijani
 */
export const translateSymptom = (symptom: string): string => {
  const map = getSymptomTranslations();
  
  // First check exact match
  if (map[symptom]) {
    return map[symptom];
  }

  // Check lowercase
  const lowerSymptom = symptom.toLowerCase();
  if (map[lowerSymptom]) {
    return map[lowerSymptom];
  }

  // Return original if no translation found
  return symptom;
};

/**
 * Translate array of symptoms
 */
export const translateSymptoms = (symptoms: string[]): string[] => {
  return symptoms.map(translateSymptom);
};
