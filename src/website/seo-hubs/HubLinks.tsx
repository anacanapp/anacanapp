/** Inbound links to the SEO content pages and the pregnancy weeks (rendered only while published, az and ru). */
import { Baby, Droplets, Milk, ShieldCheck, Thermometer, Utensils, type LucideIcon } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow } from '../components';
import { isSeoHubLanguage, seoHubSitePath, seoHubsPublished } from './routes';
import { pregnancyWeeksPublished } from '../pregnancy-weeks/weeks';
import { localizedWeekHubPath } from '../pregnancy-weeks/routes';

type CardKey = 'weeks' | 'pregnancySafe' | 'feverGuide' | 'solidFoods' | 'milkStorage' | 'periodHub';
const ICONS: Record<CardKey, LucideIcon> = { weeks: Baby, pregnancySafe: ShieldCheck, feverGuide: Thermometer, solidFoods: Utensils, milkStorage: Milk, periodHub: Droplets };
const TEXTS: Record<'az' | 'ru', { look: string; cards: Record<CardKey, [string, string]> }> = {
  az: { look: 'Bax', cards: {
    weeks: ['Hamiləlik həftə-həftə', '1-42-ci həftələr: körpənin ölçüsü, əsas göstəricilər və təhlükə əlamətləri.'],
    pregnancySafe: ['Hamiləlikdə olar və olmaz', 'Kofe, hamam, saç boyası, dərmanlar: 20 sualın qısa cavabı.'],
    feverGuide: ['Uşaqda qızdırma', 'Yaşa və temperatura görə: evdə izləmək, həkim, yoxsa 103?'],
    solidFoods: ['Əlavə qida cədvəli', '6-12 ay: nə, nə vaxt və gündə neçə dəfə.'],
    milkStorage: ['Ana südünün saxlanması', 'Otaq, soyuducu, dondurucu: çap edilə bilən cədvəl.'],
    periodHub: ['Aybaşı bələdçisi', 'Normal müddət, gecikmə, ağrı və nə vaxt həkimə.'] } },
  ru: { look: 'Смотреть', cards: {
    weeks: ['Беременность по неделям', 'С 1-й по 42-ю неделю: размер малыша, главные показатели и опасные симптомы.'],
    pregnancySafe: ['Можно ли беременным', 'Кофе, баня, окрашивание волос, лекарства: короткие ответы на 20 вопросов.'],
    feverGuide: ['Температура у ребенка', 'По возрасту и температуре: наблюдать дома, к врачу или звонить 103?'],
    solidFoods: ['Прикорм по месяцам', 'С 6 до 12 месяцев: что, когда и сколько раз в день.'],
    milkStorage: ['Хранение грудного молока', 'Комната, холодильник, морозилка: таблица для печати.'],
    periodHub: ['Месячные', 'Нормальная длительность, задержка, боль и когда идти к врачу.'] } },
};
const BY_PLACE: Record<string, CardKey[]> = {
  tools: ['weeks', 'feverGuide', 'solidFoods', 'pregnancySafe', 'milkStorage', 'periodHub'],
  pregnancy: ['weeks', 'pregnancySafe'],
  motherhood: ['feverGuide', 'solidFoods', 'milkStorage'],
  cycle: ['periodHub'],
};
export function SeoHubLinks({ place }: { place: keyof typeof BY_PLACE }) {
  const { route, basePath } = useWebsite();
  const language = route.language;
  if (!isSeoHubLanguage(language)) return null;
  const t = TEXTS[language];
  const cards = BY_PLACE[place].filter(key => key === 'weeks' ? pregnancyWeeksPublished() : seoHubsPublished())
    .map(key => ({ key, path: key === 'weeks' ? localizedWeekHubPath(language) : seoHubSitePath(key, undefined, language), title: t.cards[key][0], text: t.cards[key][1], Icon: ICONS[key] }));
  if (!cards.length) return null;
  return <div className="site-tool-grid tl-tool-grid sh-links">{cards.map(({ key, path, title, text, Icon }) => <a className="site-tool-card" href={basePath + path} key={key}>
    <span className="site-icon-wash site-wash-peach"><Icon size={23} strokeWidth={1.5}/></span><h3>{title}</h3><p>{text}</p><span className="site-text-link">{t.look}<Arrow/></span></a>)}</div>;
}
