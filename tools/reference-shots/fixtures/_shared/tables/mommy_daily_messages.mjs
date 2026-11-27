import { ml, uuid } from '../../_lib/text.mjs';
export default () => Array.from({ length: 400 }, (_, i) => ({ id: uuid('7e000000', i + 1), day_number: i + 1, is_active: true,
  ...ml('message', ['Ana, bu gün mənimlə güzgüyə baxaq? Gülümsəməyimi görmək istəyirəm! 💛', 'Mum, shall we look in the mirror today? I want to see my smile! 💛',
    'Мама, посмотрим сегодня в зеркало? Хочу увидеть свою улыбку! 💛', 'ماما، هل ننظر في المرآة اليوم؟ أريد أن أرى ابتسامتي! 💛']),
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }));
