import { ml, uuid } from '../../_lib/text.mjs';
const N = [['Aylin', 'girl', ['Ay işığı', 'Moonlight', 'Лунный свет', 'ضوء القمر']], ['Nərgiz', 'girl', ['Nərgiz çiçəyi', 'Narcissus flower', 'Цветок нарцисс', 'زهرة النرجس']],
  ['Leyla', 'girl', ['Gecə', 'Night', 'Ночь', 'الليل']], ['Zəhra', 'girl', ['Parlaq', 'Radiant', 'Сияющая', 'المشرقة']],
  ['Murad', 'boy', ['Arzu, istək', 'Wish', 'Желание', 'المراد']], ['Kənan', 'boy', ['Müqəddəs torpaq', 'Holy land', 'Святая земля', 'كنعان']],
  ['Tural', 'boy', ['Canlı, diri', 'Lively', 'Живой', 'حيوي']], ['Elnur', 'boy', ['Xalqın nuru', 'Light of the people', 'Свет народа', 'نور الشعب']]];
export default () => ['az', 'en', 'ru', 'ar', 'tr'].flatMap((lang, l) => N.map(([name, gender, m], i) => ({
  id: uuid('85000000', l * 20 + i + 1), name, gender, lang, origin: 'Azərbaycan', origin_en: 'Azerbaijani', origin_ru: 'азербайджанское', origin_ar: 'أذربيجاني',
  ...ml('meaning', m), popularity: 100 - i * 7, is_active: true, created_at: '2026-01-01T00:00:00Z' })));
