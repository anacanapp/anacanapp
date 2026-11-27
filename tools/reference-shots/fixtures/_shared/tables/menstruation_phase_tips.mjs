import { ml, uuid } from '../../_lib/text.mjs';
const I = [['follicular', '⚡', ['Enerji yüksəlir', 'Energy is rising', 'Энергия растёт', 'الطاقة في ازدياد'], ['Estrogen artır — yeni işlərə başlamaq üçün yaxşı vaxtdır.', 'Oestrogen rises — a good time to start new things.', 'Эстроген растёт — хорошее время для новых дел.', 'يرتفع الإستروجين — وقت جيد للبدء بأشياء جديدة.']],
  ['ovulation', '🌸', ['Fertil pəncərə', 'Fertile window', 'Фертильное окно', 'نافذة الخصوبة'], ['Hamiləlik ehtimalı ən yüksəkdir.', 'Your chance of pregnancy is highest.', 'Вероятность беременности максимальна.', 'فرصة الحمل في أعلى مستوياتها.']],
  ['luteal', '🍫', ['PMS yaxınlaşır', 'PMS is near', 'Близко ПМС', 'اقتراب متلازمة ما قبل الحيض'], ['Maqnezium zəngin qidalar kömək edir.', 'Magnesium-rich foods help.', 'Помогают продукты с магнием.', 'تساعد الأطعمة الغنية بالمغنيسيوم.']],
  ['menstrual', '🛌', ['Dincəlin', 'Rest', 'Отдыхайте', 'استريحي'], ['İsti su kisəsi sancıları yüngülləşdirir.', 'A hot-water bottle eases cramps.', 'Грелка облегчает спазмы.', 'تخفف قربة الماء الساخن التقلصات.']]];
export default () => I.map(([phase, emoji, t, c], i) => ({ id: uuid('82000000', i + 1), phase, emoji, category: ['nutrition','exercise','selfcare','nutrition'][i], updated_at: '2026-01-01T00:00:00Z', sort_order: i + 1, is_active: true,
  ...ml('title', t), ...ml('content', c), created_at: '2026-01-01T00:00:00Z' }));
