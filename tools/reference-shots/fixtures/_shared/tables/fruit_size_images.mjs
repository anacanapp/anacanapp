import { uuid } from '../../_lib/text.mjs';
const F = [[4,'🌱','xaşxaş toxumu','poppy seed','мак'],[8,'🫐','moruq','raspberry','малина'],[12,'🍋','limon','lime','лайм'],[16,'🥑','avokado','avocado','авокадо'],
  [20,'🍌','banan','banana','банан'],[24,'🌽','qarğıdalı','corn','кукуруза'],[28,'🍆','badımcan','aubergine','баклажан'],[32,'🥥','kokos','coconut','кокос'],
  [36,'🍈','yemiş','melon','дыня'],[40,'🍉','qarpız','watermelon','арбуз']];
export default () => F.flatMap(([w, emoji, az, en, ru], i) => [0, 1, 2, 3].map((k) => ({
  id: uuid('7c000000', i * 4 + k + 1), week_number: w + k, emoji, fruit_name: az, fruit_name_az: az, fruit_name_en: en, fruit_name_ru: ru,
  image_url: null, weight_g: Math.round(((w + k) / 40) ** 3 * 3400), created_at: '2026-01-01T00:00:00Z' })));
