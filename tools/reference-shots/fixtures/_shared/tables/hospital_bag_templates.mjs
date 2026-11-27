import { uuid } from '../../_lib/text.mjs';
const T = [['documents', 'Şəxsiyyət vəsiqəsi', 'ID card', 'Удостоверение личности', 'بطاقة الهوية', true], ['documents', 'Hamiləlik kartı', 'Pregnancy record', 'Обменная карта', 'سجل الحمل', true],
  ['mother', 'Gecə köynəyi (2 ədəd)', 'Nightgowns (2)', 'Ночные рубашки (2)', 'قمصان نوم (2)', true], ['mother', 'Doğuşdan sonrakı bezlər', 'Maternity pads', 'Послеродовые прокладки', 'فوط ما بعد الولادة', true],
  ['mother', 'Terlik', 'Slippers', 'Тапочки', 'نعال', false], ['baby', 'Bodi (3 ədəd)', 'Bodysuits (3)', 'Боди (3)', 'ملابس داخلية للرضيع (3)', true],
  ['baby', 'Yenidoğan bezləri', 'Newborn nappies', 'Подгузники для новорождённых', 'حفاضات حديثي الولادة', true], ['baby', 'Papaq', 'Hat', 'Шапочка', 'قبعة', false]];
export default () => T.map(([category, az, en, ru, ar, essential], i) => ({ id: uuid('86000000', i + 1), item_id: `item-${i + 1}`, category,
  item_name: az, item_name_az: az, item_name_en: en, item_name_ru: ru, item_name_ar: ar, is_essential: essential, priority: essential ? 1 : 2,
  notes: null, sort_order: i + 1, is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }));
