// weekly_tips: one row per week and life stage (useWeeklyTips: life_stage + week_number).
const L = { az: 'həftə', en: 'week', ru: 'неделя', ar: 'الأسبوع' };
export default () => {
  const rows = [];
  for (const stage of ['bump', 'mommy', 'flow']) for (let w = 0; w <= 52; w++) {
    const n = rows.length + 1;
    rows.push({
      id: `71000000-0000-4000-8000-${String(n).padStart(12, '0')}`, life_stage: stage, week_number: w, is_active: true, image_url: null,
      title: `${w}. ${L.az}: bədəniniz və körpəniz`, title_en: `Week ${w}: you and your baby`, title_ru: `${w}-я ${L.ru}: вы и малыш`, title_ar: `${L.ar} ${w}: أنتِ وطفلك`,
      content: 'Bu həftə bol su için, kifayət qədər dincəlin və gündəlik gəzintiləri unutmayın.',
      content_en: 'Drink plenty of water this week, rest well and keep up your daily walks.',
      content_ru: 'На этой неделе пейте больше воды, хорошо отдыхайте и гуляйте каждый день.',
      content_ar: 'اشربي الكثير من الماء هذا الأسبوع، واحصلي على قسط كافٍ من الراحة، وواظبي على المشي يومياً.',
      tips: ['Gündə 8 stəkan su', 'Dəmir zəngin qidalar', '30 dəqiqə gəzinti'],
      tips_en: ['8 glasses of water a day', 'Iron-rich foods', 'A 30-minute walk'],
      tips_ru: ['8 стаканов воды в день', 'Продукты с железом', 'Прогулка 30 минут'],
      tips_ar: ['8 أكواب من الماء يومياً', 'أطعمة غنية بالحديد', 'مشي لمدة 30 دقيقة'],
      created_at: '2026-01-01T00:00:00Z',
    });
  }
  return rows;
};
