import { uuid } from '../../_lib/text.mjs';
const T = [['🫖', 'Bu axşam ona isti çay hazırlayın və ayaqlarını ovuşdurun.', 'Make her a warm tea tonight and rub her feet.', 'Приготовьте ей тёплый чай и помассируйте ноги.', 'حضّر لها شاياً دافئاً الليلة ودلّك قدميها.'],
  ['🛒', 'Həftəlik alış-verişi öz üzərinizə götürün.', 'Take over the weekly shopping.', 'Возьмите на себя закупки на неделю.', 'تولَّ التسوق الأسبوعي.'],
  ['📅', 'Növbəti həkim görüşünə birlikdə gedin.', 'Go to the next doctor visit together.', 'Сходите вместе к врачу.', 'اذهبا معاً إلى موعد الطبيب القادم.']];
export default () => ['bump', 'mommy', 'flow'].flatMap((life_stage, s) => T.map(([tip_emoji, az, en, ru, ar], i) => ({ id: uuid('83000000', s * 10 + i + 1), life_stage, week_number: null,
  tip_emoji, tip_text: az, tip_text_az: az, tip_text_en: en, tip_text_ru: ru, tip_text_ar: ar, sort_order: i + 1, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: null })));
