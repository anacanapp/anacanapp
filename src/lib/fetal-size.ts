/**
 * Fetal size by completed pregnancy week (2026-11-12), the single source for the app hero fallback (FRUIT_SIZES),
 * the anacan.az week pages and the ultrasound weight tool. Same values the database holds for the first day of each
 * week (pregnancy_daily_content, migration 20261112140000_hero_growth_data_fix.sql).
 *
 * Weight: from 20 weeks Hadlock FP et al., Radiology 1991;181:129-133 (ln w = 0.578 + 0.332 GA - 0.00354 GA^2);
 * 8-19 weeks the compiled embryology table (Archie 2006, Hansen 2003, Cussen 1990); earlier from the CRL.
 * Length: crown-rump (Robinson & Fleming 1975) until 14 weeks, CRL table 14-19 weeks, crown-heel from 20 weeks.
 * Pure data (no i18n), so the website can import it. Audit: docs/FETAL_SIZE_DATA.md.
 */
export type FetalMeasure = 'crl' | 'crown-heel';
export interface FetalSizeRow { fruit: string; emoji: string; lengthCm: number; weightG: number; measure: FetalMeasure }

export const FETAL_SIZE_BY_WEEK: Record<number, FetalSizeRow> = {
  4: { fruit: 'Xaşxaş toxumu', emoji: '🌱', lengthCm: 0.03, weightG: 0.01, measure: 'crl' },
  5: { fruit: 'Küncüt toxumu', emoji: '🌾', lengthCm: 0.2, weightG: 0.01, measure: 'crl' },
  6: { fruit: 'Mərcimək', emoji: '🫘', lengthCm: 0.51, weightG: 0.03, measure: 'crl' },
  7: { fruit: 'Qaragilə', emoji: '🫐', lengthCm: 0.98, weightG: 0.23, measure: 'crl' },
  8: { fruit: 'Moruq', emoji: '🍇', lengthCm: 1.6, weightG: 1, measure: 'crl' },
  9: { fruit: 'Gilas', emoji: '🍒', lengthCm: 2.4, weightG: 2, measure: 'crl' },
  10: { fruit: 'Çiyələk', emoji: '🍓', lengthCm: 3.3, weightG: 4, measure: 'crl' },
  11: { fruit: 'Əncir', emoji: '🫒', lengthCm: 4.4, weightG: 7, measure: 'crl' },
  12: { fruit: 'Laym', emoji: '🍋', lengthCm: 5.6, weightG: 14, measure: 'crl' },
  13: { fruit: 'Limon', emoji: '🍋', lengthCm: 7, weightG: 23, measure: 'crl' },
  14: { fruit: 'Şaftalı', emoji: '🍑', lengthCm: 8.7, weightG: 43, measure: 'crl' },
  15: { fruit: 'Alma', emoji: '🍎', lengthCm: 10.1, weightG: 70, measure: 'crl' },
  16: { fruit: 'Avokado', emoji: '🥑', lengthCm: 11.6, weightG: 100, measure: 'crl' },
  17: { fruit: 'Armud', emoji: '🍐', lengthCm: 13, weightG: 140, measure: 'crl' },
  18: { fruit: 'Şirin bibər', emoji: '🫑', lengthCm: 14.2, weightG: 190, measure: 'crl' },
  19: { fruit: 'Pomidor', emoji: '🍅', lengthCm: 15.3, weightG: 240, measure: 'crl' },
  20: { fruit: 'Banan', emoji: '🍌', lengthCm: 25.6, weightG: 331, measure: 'crown-heel' },
  21: { fruit: 'Yerkökü', emoji: '🥕', lengthCm: 26.7, weightG: 399, measure: 'crown-heel' },
  22: { fruit: 'Qreypfrut', emoji: '🍊', lengthCm: 27.8, weightG: 478, measure: 'crown-heel' },
  23: { fruit: 'Böyük manqo', emoji: '🥭', lengthCm: 28.9, weightG: 568, measure: 'crown-heel' },
  24: { fruit: 'Qarğıdalı', emoji: '🌽', lengthCm: 30, weightG: 670, measure: 'crown-heel' },
  25: { fruit: 'Gül kələmi', emoji: '🥦', lengthCm: 34.6, weightG: 785, measure: 'crown-heel' },
  26: { fruit: 'Kabaçok', emoji: '🥒', lengthCm: 35.6, weightG: 913, measure: 'crown-heel' },
  27: { fruit: 'Brokkoli', emoji: '🥦', lengthCm: 36.6, weightG: 1055, measure: 'crown-heel' },
  28: { fruit: 'Badımcan', emoji: '🍆', lengthCm: 37.6, weightG: 1210, measure: 'crown-heel' },
  29: { fruit: 'Armudvari balqabaq', emoji: '🎃', lengthCm: 38.6, weightG: 1379, measure: 'crown-heel' },
  30: { fruit: 'Kələm', emoji: '🥬', lengthCm: 39.9, weightG: 1559, measure: 'crown-heel' },
  31: { fruit: 'Kokos', emoji: '🥥', lengthCm: 41.1, weightG: 1751, measure: 'crown-heel' },
  32: { fruit: 'Böyük kabaçok', emoji: '🥒', lengthCm: 42.4, weightG: 1953, measure: 'crown-heel' },
  33: { fruit: 'Ananas', emoji: '🍍', lengthCm: 43.7, weightG: 2162, measure: 'crown-heel' },
  34: { fruit: 'Yemiş', emoji: '🍈', lengthCm: 45, weightG: 2377, measure: 'crown-heel' },
  35: { fruit: 'Şirin qovun', emoji: '🍈', lengthCm: 46.2, weightG: 2595, measure: 'crown-heel' },
  36: { fruit: 'Kahı', emoji: '🥬', lengthCm: 47.4, weightG: 2813, measure: 'crown-heel' },
  37: { fruit: 'Pazı', emoji: '🥬', lengthCm: 48.6, weightG: 3028, measure: 'crown-heel' },
  38: { fruit: 'Pırasa', emoji: '🌿', lengthCm: 49.8, weightG: 3236, measure: 'crown-heel' },
  39: { fruit: 'Kiçik qarpız', emoji: '🍉', lengthCm: 50.7, weightG: 3435, measure: 'crown-heel' },
  40: { fruit: 'Qarpız', emoji: '🍉', lengthCm: 51.2, weightG: 3619, measure: 'crown-heel' },
  41: { fruit: 'Böyük qarpız', emoji: '🍉', lengthCm: 51.7, weightG: 3787, measure: 'crown-heel' },
  42: { fruit: 'Böyük balqabaq', emoji: '🎃', lengthCm: 51.5, weightG: 3934, measure: 'crown-heel' },
};

/** Hadlock 1991 Table 1: estimated fetal weight (g) by menstrual week, [p3, p10, p50, p90, p97]. 30 wk p97 is printed
 *  as 1,649 in the paper (misprint); 1949 follows the published equation and the neighbouring weeks. */
export const HADLOCK_EFW: Record<number, [number, number, number, number, number]> = {
  10: [26, 29, 35, 41, 44],
  11: [34, 37, 45, 53, 56],
  12: [43, 48, 58, 68, 73],
  13: [55, 61, 73, 85, 91],
  14: [70, 77, 93, 109, 116],
  15: [88, 97, 117, 137, 146],
  16: [110, 121, 146, 171, 183],
  17: [136, 150, 181, 212, 226],
  18: [167, 185, 223, 261, 279],
  19: [205, 227, 273, 319, 341],
  20: [248, 275, 331, 387, 414],
  21: [299, 331, 399, 467, 499],
  22: [359, 398, 478, 559, 598],
  23: [426, 471, 568, 665, 710],
  24: [503, 556, 670, 784, 838],
  25: [589, 652, 785, 918, 981],
  26: [685, 758, 913, 1068, 1141],
  27: [791, 876, 1055, 1234, 1319],
  28: [908, 1004, 1210, 1416, 1513],
  29: [1034, 1145, 1379, 1613, 1724],
  30: [1169, 1294, 1559, 1824, 1949],
  31: [1313, 1453, 1751, 2049, 2189],
  32: [1465, 1621, 1953, 2285, 2441],
  33: [1622, 1794, 2162, 2530, 2703],
  34: [1783, 1973, 2377, 2781, 2971],
  35: [1946, 2154, 2595, 3036, 3244],
  36: [2110, 2335, 2813, 3291, 3516],
  37: [2271, 2513, 3028, 3543, 3785],
  38: [2427, 2686, 3236, 3786, 4045],
  39: [2576, 2851, 3435, 4019, 4294],
  40: [2714, 3004, 3619, 4234, 4524],
};

/** Hadlock 1991 median estimated fetal weight (g) at an exact gestational age in weeks. */
export const hadlockMedianG = (gaWeeks: number): number => Math.exp(0.578 + 0.332 * gaWeeks - 0.00354 * gaWeeks * gaWeeks);
