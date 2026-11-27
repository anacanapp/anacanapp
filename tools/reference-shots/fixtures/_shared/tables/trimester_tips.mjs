const TIPS = [
  ['💧', 'Gündə ən azı 2 litr su için', 'Drink at least 2 litres of water a day', 'Пейте не менее 2 литров воды в день', 'اشربي لترين من الماء على الأقل يومياً'],
  ['🥦', 'Fol turşusu və dəmirlə zəngin qidalanın', 'Eat foods rich in folate and iron', 'Ешьте продукты с фолатом и железом', 'تناولي أطعمة غنية بالفولات والحديد'],
  ['🚶‍♀️', 'Hər gün 30 dəqiqə yüngül gəzinti edin', 'Take a light 30-minute walk every day', 'Каждый день гуляйте 30 минут', 'امشي مشياً خفيفاً لمدة 30 دقيقة يومياً'],
  ['😴', 'Sol böyrü üstə yatın', 'Sleep on your left side', 'Спите на левом боку', 'نامي على جانبك الأيسر'],
];
export default () => [1, 2, 3].flatMap((trimester) => TIPS.map(([icon, az, en, ru, ar], i) => ({
  id: `72000000-0000-4000-8000-${String(trimester * 10 + i).padStart(12, '0')}`, trimester, icon, sort_order: i + 1, is_active: true,
  tip_text: az, tip_text_en: en, tip_text_ru: ru, tip_text_ar: ar, created_at: '2026-01-01T00:00:00Z',
})));
