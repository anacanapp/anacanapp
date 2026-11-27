import { ml, uuid } from '../../_lib/text.mjs';
const T = [['🧸', ['Oyuncağa uzanmaq', 'Reaching for toys', 'Тянуться к игрушкам', 'الوصول إلى الألعاب'], ['Oyuncağı bir az uzağa qoyun.', 'Place a toy just out of reach.', 'Положите игрушку чуть дальше.', 'ضعي لعبة بعيدة قليلاً.']],
  ['📚', ['Birlikdə kitab', 'Books together', 'Книги вместе', 'الكتب معاً'], ['Hər gün şəkilli kitab oxuyun.', 'Read a picture book every day.', 'Читайте книжки с картинками каждый день.', 'اقرئي كتاباً مصوراً كل يوم.']],
  ['🎵', ['Mahnılar', 'Songs', 'Песенки', 'الأغاني'], ['Sadə mahnılar oxuyun və əl çalın.', 'Sing simple songs and clap.', 'Пойте простые песни и хлопайте.', 'غني أغاني بسيطة وصفقي.']]];
export default () => ['newborn', 'infant', 'toddler'].flatMap((age_group, g) => T.map(([emoji, t, c], i) => ({ id: uuid('7f000000', g * 10 + i + 1), age_group, emoji,
  sort_order: i + 1, is_active: true, ...ml('title', t), ...ml('content', c), created_at: '2026-01-01T00:00:00Z' })));
