import { ml, uuid } from '../../_lib/text.mjs';
const M = [[6, '😊', 'smile', ['İlk gülüş', 'First smile', 'Первая улыбка', 'الابتسامة الأولى']], [12, '🙆', 'head', ['Başını saxlayır', 'Holds head up', 'Держит голову', 'يرفع رأسه']],
  [16, '🔄', 'roll', ['Çevrilir', 'Rolls over', 'Переворачивается', 'يتقلب']], [24, '🪑', 'sit', ['Oturur', 'Sits up', 'Сидит', 'يجلس']],
  [36, '🐛', 'crawl', ['Sürünür', 'Crawls', 'Ползает', 'يحبو']], [52, '🚶', 'walk', ['İlk addımlar', 'First steps', 'Первые шаги', 'الخطوات الأولى']]];
export default () => M.map(([week_number, emoji, milestone_key, label], i) => ({ id: uuid('80000000', i + 1), week_number, emoji, milestone_key, sort_order: i + 1, is_active: true,
  ...ml('label', label), ...ml('description', label), created_at: '2026-01-01T00:00:00Z' }));
