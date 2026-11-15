/** Inbound links to the SEO content pages (rendered only while published, az only). */
import { Baby, Droplets, Milk, ShieldCheck, Thermometer, type LucideIcon } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow } from '../components';
import { seoHubSitePath, seoHubsPublished, type SeoHubPage } from './routes';
import { pregnancyWeeksHubPath, pregnancyWeeksPublished } from '../pregnancy-weeks/weeks';

interface HubCard { path: string; title: string; text: string; Icon: LucideIcon }
const CARDS: Record<string, HubCard> = {
  weeks: { path: '', title: 'Hamiləlik həftə-həftə', text: '1-42-ci həftələr: körpənin ölçüsü, əsas göstəricilər və təhlükə əlamətləri.', Icon: Baby },
  pregnancySafe: { path: seoHubSitePath('pregnancySafe'), title: 'Hamiləlikdə olar və olmaz', text: 'Kofe, hamam, saç boyası, dərmanlar: 20 sualın qısa cavabı.', Icon: ShieldCheck },
  feverGuide: { path: seoHubSitePath('feverGuide'), title: 'Uşaqda qızdırma', text: 'Yaşa və temperatura görə: evdə izləmək, həkim, yoxsa 103?', Icon: Thermometer },
  solidFoods: { path: seoHubSitePath('solidFoods'), title: 'Əlavə qida cədvəli', text: '6-12 ay: nə, nə vaxt və gündə neçə dəfə.', Icon: Baby },
  milkStorage: { path: seoHubSitePath('milkStorage'), title: 'Ana südünün saxlanması', text: 'Otaq, soyuducu, dondurucu: çap edilə bilən cədvəl.', Icon: Milk },
  periodHub: { path: seoHubSitePath('periodHub'), title: 'Aybaşı bələdçisi', text: 'Normal müddət, gecikmə, ağrı və nə vaxt həkimə.', Icon: Droplets },
};
const BY_PLACE: Record<string, Array<keyof typeof CARDS>> = {
  tools: ['weeks', 'feverGuide', 'solidFoods', 'pregnancySafe', 'milkStorage', 'periodHub'],
  pregnancy: ['weeks', 'pregnancySafe'],
  motherhood: ['feverGuide', 'solidFoods', 'milkStorage'],
  cycle: ['periodHub'],
};
export function SeoHubLinks({ place }: { place: keyof typeof BY_PLACE }) {
  const { route, basePath } = useWebsite();
  if (route.language !== 'az') return null;
  const cards = BY_PLACE[place].filter(key => key === 'weeks' ? pregnancyWeeksPublished() : seoHubsPublished())
    .map(key => ({ ...CARDS[key], path: key === 'weeks' ? pregnancyWeeksHubPath() : CARDS[key].path }));
  if (!cards.length) return null;
  return <div className="site-tool-grid tl-tool-grid sh-links">{cards.map(({ path, title, text, Icon }) => <a className="site-tool-card" href={basePath + path} key={path}>
    <span className="site-icon-wash site-wash-peach"><Icon size={23} strokeWidth={1.5}/></span><h3>{title}</h3><p>{text}</p><span className="site-text-link">Bax<Arrow/></span></a>)}</div>;
}
export type { SeoHubPage };
