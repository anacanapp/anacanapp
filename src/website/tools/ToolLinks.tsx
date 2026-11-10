/** Internal links into the tool pages: from the related journal articles and from the calculators page. */
import { Baby, Banknote } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow } from '../components';
import { sitePath } from '../routes';
import { namesCopy } from './names';
import { DEKRET_COPY } from './dekret-copy';
import { PregnancyWeeksLink } from '../pregnancy-weeks/PregnancyWeekPages';
import './tools.css';

/** Journal article id → the tool page it leads to (az only: the dekret calculator and the az names). */
const ARTICLE_TOOLS: Record<string, { kind: 'maternityBenefit' | 'names'; title: string; text: string }> = {
  '8d83fe70-b8fd-4c76-9c33-0e1fab0d6794': { kind: 'maternityBenefit', title: 'Dekret pulunu hesablayın', text: 'Orta aylıq əmək haqqınıza görə analıq müavinətini, günləri və tarixləri hesablayın.' },
  '1b14e601-3cbe-40d4-997e-139f90a7a578': { kind: 'maternityBenefit', title: 'Dekret pulunu hesablayın', text: 'Analıq məzuniyyətinin günlərini və müavinətin təxmini məbləğini hesablayın.' },
  '65ea9140-5797-41f3-aafd-a8c2235664c9': { kind: 'names', title: 'Uşaq adları: mənaları ilə', text: 'Qız və oğlan adlarının mənası, mənşəyi və oxşar adlar: adı axtarın.' },
};
export function ArticleToolLink({ articleId }: { articleId: string }) {
  const { route, basePath } = useWebsite();
  const tool = ARTICLE_TOOLS[articleId];
  if (!tool || route.language !== 'az') return null;
  return <aside className="tl-article-tool"><span className="site-icon-wash site-wash-mint">{tool.kind === 'names' ? <Baby size={22} strokeWidth={1.5}/> : <Banknote size={22} strokeWidth={1.5}/>}</span>
    <div><strong>{tool.title}</strong><p>{tool.text}</p></div><a className="site-outline-button" href={basePath + sitePath('az', tool.kind)}>Aç<Arrow/></a></aside>;
}
/** Extra cards on the calculators page (only where the pages exist). */
export function ToolPageLinks() {
  const { route, basePath } = useWebsite();
  const names = namesCopy(route.language);
  const cards = [
    ...(route.language === 'az' ? [{ path: sitePath('az', 'maternityBenefit'), title: DEKRET_COPY.label, text: 'Analıq məzuniyyətinin günləri, gündəlik və ümumi müavinət.', Icon: Banknote, action: 'Hesabla' }] : []),
    ...(names ? [{ path: sitePath(route.language, 'names'), title: names.hubLabel, text: names.hubTitle, Icon: Baby, action: route.language === 'ka' ? 'გახსნა' : 'Bax' }] : []),
  ];
  if (!cards.length) return null;
  return <><div className="site-tool-grid tl-tool-grid">{cards.map(({ path, title, text, Icon, action }) => <a className="site-tool-card" href={basePath + path} key={path}>
    <span className="site-icon-wash site-wash-peach"><Icon size={23} strokeWidth={1.5}/></span><h3>{title}</h3><p>{text}</p><span className="site-text-link">{action}<Arrow/></span></a>)}</div><PregnancyWeeksLink/></>;
}
