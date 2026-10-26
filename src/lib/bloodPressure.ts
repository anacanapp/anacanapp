import { tr } from '@/lib/tr';

/**
 * Qan təzyiqi aralıqları — böyüklər üçün AHA, hamiləlik üçün ayrıca hədlər.
 * Hamiləlikdə: ≥140/90 = hipertenziya (həkim), ≥160/110 = ağır (təcili).
 * Aralıq etiketi tək bir ölçmədən hipertenziya diaqnozu qoymur.
 */

export type BpCategory =
'low' // <90/60
| 'normal' // AHA: <120/80; hamiləlikdə: <130/85 (aşağı həddən yuxarı)
| 'elevated' // AHA: 120-129 / <80; hamiləlikdə: 130-139 və ya 85-89
| 'stage1' // AHA izləmə aralığı: 130-139 və ya 80-89; diaqnoz deyil
| 'stage2' // ≥140 / ≥90
| 'crisis'; // ≥180 / ≥120

export interface BpAssessment {
  category: BpCategory;
  label: string;
  emoji: string;
  /** a-* palitra tint/ink */
  bg: string;
  ink: string;
  guidance: string;
  /** Hamiləlikdə xüsusi xəbərdarlıq (preeklampsiya) */
  pregnancyAlert: 'none' | 'warning' | 'urgent';
}

export function classifyBp(systolic: number, diastolic: number, isPregnant: boolean): BpAssessment {
  let category: BpCategory;
  if (systolic >= 180 || diastolic >= 120) category = 'crisis';else
  if (systolic >= 140 || diastolic >= 90) category = 'stage2';else
  if (isPregnant && (systolic >= 130 || diastolic >= 85)) category = 'elevated';else
  if (!isPregnant && (systolic >= 130 || diastolic >= 80)) category = 'stage1';else
  if (!isPregnant && systolic >= 120) category = 'elevated';else
  if (systolic < 90 || diastolic < 60) category = 'low';else
  category = 'normal';

  // Hamiləlik overlay-i
  let pregnancyAlert: BpAssessment['pregnancyAlert'] = 'none';
  if (isPregnant) {
    if (systolic >= 160 || diastolic >= 110) pregnancyAlert = 'urgent';else
    if (systolic >= 140 || diastolic >= 90) pregnancyAlert = 'warning';
  }

  const META: Record<BpCategory, Omit<BpAssessment, 'category' | 'pregnancyAlert'>> = {
    low: {
      label: tr('bp_cat_low', 'Aşağı'),
      emoji: '🥶',
      bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)',
      guidance: tr('bp_guide_low', 'Başgicəllənmə hiss edirsinizsə oturun, su için. Təkrarlanırsa həkimə bildirin.')
    },
    normal: {
      label: tr('bp_cat_normal', 'Normal'),
      emoji: '💚',
      bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)',
      guidance: tr('bp_guide_normal', 'Əla! Təzyiqiniz sağlam aralıqdadır.')
    },
    elevated: {
      label: tr('bp_cat_elevated', 'Yüksəlmiş'),
      emoji: '🟡',
      bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)',
      guidance: tr('bp_guide_elevated', 'Duz qəbulunu azaldın, istirahət edin və müntəzəm ölçün.')
    },
    stage1: {
      label: tr('bp_cat_monitor', 'Yüksəlmiş — izləyin'),
      emoji: '🟠',
      bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)',
      guidance: tr('bp_guide_monitor', 'Tək ölçmə hipertenziya diaqnozu deyil. Dincəldikdən sonra yenidən ölçün; bu aralıq təkrarlanırsa həkiminizlə məsləhətləşin.')
    },
    stage2: {
      label: tr('bp_cat_high_reading', 'Yüksək təzyiq'),
      emoji: '🔴',
      bg: 'var(--a-alert-bg)', ink: 'var(--a-alert-ink)',
      guidance: tr('bp_guide_stage2', 'Bu gün həkiminizlə əlaqə saxlayın.')
    },
    crisis: {
      label: tr('bp_cat_crisis', 'Hipertonik böhran'),
      emoji: '🚨',
      bg: 'var(--a-alert-bg)', ink: 'var(--a-alert-ink)',
      guidance: tr('bp_guide_crisis', 'DƏRHAL təcili yardıma (103) müraciət edin!')
    }
  };

  return { category, pregnancyAlert, ...META[category] };
}
