/** Azerbaijani SEO content pages: short answer on the website, full guide in the app (texts in content-az.ts). */
import { useState } from 'react';
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow, Eyebrow } from '../components';
import { ToolBreadcrumb } from '../tools/NamesPages';
import { seoHubContent } from './registry';
import { seoHubSitePath, type SeoHubPage } from './routes';
import type { FeverAge, HubFaq, HubSource, Verdict } from './content-az';
import { AppGate, AppInline, AppPill, AppSticky } from './AppConvert';
import '../tools/tools.css';
import './seo-hubs.css';

const Disclaimer = () => <p className="tl-note tl-disclaimer">Bu səhifə ümumi maarifləndirmə məqsədi daşıyır və həkim müayinəsini və ya məsləhətini əvəz etmir. Sizə aid suallar üçün həkiminizə müraciət edin.</p>;
function Sources({ items }: { items: HubSource[] }) {
  const unique = items.filter((item, index) => items.findIndex(other => other.url === item.url) === index);
  return <section className="site-section tl-prose"><h2>Mənbələr</h2><ul className="tl-sources">{unique.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}<Arrow diagonal/></a></li>)}</ul></section>;
}
function Faq({ items }: { items: HubFaq[] }) {
  if (!items.length) return null;
  return <section className="site-section site-faq-section"><h2>Tez-tez verilən suallar</h2><div className="site-faq-list">{items.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>;
}
const Answer = ({ text, label = 'Qısa cavab' }: { text: string; label?: string }) => <aside className="tl-answer" aria-label={label}><strong>{label}</strong><p>{text}</p></aside>;
const VerdictChip = ({ verdict, label }: { verdict: Verdict; label: string }) => <span className={`sh-verdict sh-v-${verdict}`}>{label}</span>;
const hubPath = (basePath: string, kind: SeoHubPage, slug?: string) => basePath + seoHubSitePath(kind, slug);

/* ---------- fever ---------- */
function FeverPage() {
  const c = seoHubContent()!, f = c.FEVER;
  const [age, setAge] = useState<FeverAge>(1), [temp, setTemp] = useState(38.4), [days, setDays] = useState(1);
  const [flags, setFlags] = useState<Record<string, boolean>>({}), [dry, setDry] = useState(false);
  const advice = c.feverAdvice({ age, temp, days, redFlag: Object.values(flags).some(Boolean), dehydrated: dry });
  const tone = advice.level === 'emergency' ? 'bad' : advice.level === 'doctor' || advice.level === 'low' ? 'warn' : 'ok';
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Pulsuz yoxlama aləti</Eyebrow><h1>{f.heading}</h1><p>{f.intro}</p></div>
    <AppPill tool="first-aid" area="fever" text="Temperatur jurnalı və qrafik Anacan tətbiqindədir"/>
    <Answer text={f.answer}/>
    <div className="sh-fever">
      <form className="sh-form" onSubmit={event => event.preventDefault()}>
        <label htmlFor="sh-age">Uşağın yaşı</label>
        <select id="sh-age" value={age} onChange={event => setAge(Number(event.target.value) as FeverAge)}>{c.FEVER_AGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <label htmlFor="sh-temp">Temperatur</label>
        <span className="sh-temp"><input id="sh-temp" type="range" min={35.5} max={41.5} step={0.1} value={temp} onChange={event => setTemp(Number(event.target.value))}/><output htmlFor="sh-temp">{temp.toFixed(1).replace('.', ',')} °C</output></span>
        <label htmlFor="sh-days">Qızdırma neçə gündür?</label>
        <select id="sh-days" value={days} onChange={event => setDays(Number(event.target.value))}><option value={1}>1 gündən az</option><option value={3}>1-4 gün</option><option value={5}>5 gün və daha çox</option></select>
        <fieldset><legend>Bu əlamətlərdən biri varmı?</legend>
          {c.FEVER_RED_FLAGS.map(flag => <label key={flag.id}><input type="checkbox" checked={!!flags[flag.id]} onChange={event => setFlags({ ...flags, [flag.id]: event.target.checked })}/>{flag.label}</label>)}
          <label><input type="checkbox" checked={dry} onChange={event => setDry(event.target.checked)}/>Sidik az, ağız quru, ağlayanda göz yaşı yoxdur</label>
        </fieldset>
      </form>
      <div className={`sh-result sh-r-${tone}`} aria-live="polite">
        <Eyebrow>Nəticə</Eyebrow>
        <strong>{advice.title}</strong>
        <p>{advice.text}</p>
        {advice.level === 'emergency' ? <p>Təcili tibbi yardım: <a href="tel:103">103</a></p> : <p>Qızdırmanın gedişini izləmək üçün temperaturu hər ölçəndə qeyd edin: həkim ilk olaraq bunu soruşacaq.</p>}
      </div>
    </div>
    <AppInline tool="first-aid" area="fever" text="Hər ölçməni Anacan-da qeyd edin: temperatur qrafiki, verilən dərmanlar və saatlar bir yerdə."/>
    <section className="site-section tl-prose"><h2>Evdə nə etmək olar?</h2><ul className="pw-checklist">{f.homeCare.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    <section className="site-section tl-prose"><h2>Temperaturu necə ölçmək lazımdır?</h2>
      <div className="tl-table-wrap"><table className="tl-table"><thead><tr><th>Yaş</th><th>Necə ölçmək</th></tr></thead><tbody>{f.measure.map(row => <tr key={row.age}><th scope="row">{row.age}</th><td>{row.how}</td></tr>)}</tbody></table></div></section>
    <AppGate tool="first-aid" area="fever" title="Xəstəlik günlərini Anacan-da izləyin" text="Saytda ilk qərarı verdiniz. Qızdırmanın gedişini, dərmanları və simptomları tətbiqdə qeyd edin, həkimə göstərmək üçün hazır hesabat alın." locked={f.locked}/>
    <Faq items={f.faq}/>
    <Sources items={f.sources}/>
    <Disclaimer/>
    <AppSticky tool="first-aid" area="fever" text="Temperatur jurnalı Anacan-da"/>
  </>;
}

/* ---------- solid foods ---------- */
function SolidHubPage() {
  const { basePath } = useWebsite(), c = seoHubContent()!, h = c.SOLID_HUB;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Körpə qidalanması</Eyebrow><h1>{h.heading}</h1><p>{h.intro}</p></div>
    <AppPill tool="solid-food-guide" area="solid" text="Ay-ay menyu və reseptlər Anacan tətbiqində"/>
    <Answer text={h.answer}/>
    <section className="site-section tl-prose"><h2>Ay-ay cədvəl</h2>
      <div className="tl-table-wrap"><table className="tl-table"><thead><tr><th>Yaş</th><th>Konsistensiya</th><th>Gündə</th></tr></thead>
        <tbody>{c.SOLID_MONTHS.map(m => <tr key={m.month}><th scope="row"><a className="site-text-link" href={hubPath(basePath, 'solidFoodMonth', String(m.month))}>{m.month} ay</a></th><td>{m.texture}</td><td>{m.meals}</td></tr>)}</tbody></table></div></section>
    <AppInline tool="solid-food-guide" area="solid" text="Körpənizin yaşına uyğun gündəlik menyu, reseptlər və allergen planı Anacan-dadır."/>
    <section className="site-section tl-prose"><h2>Körpə əlavə qidaya hazırdırmı?</h2><ul className="pw-checklist">{h.ready.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    <section className="site-section"><h2 className="sh-h2">Ay seçin</h2><ul className="sh-month-grid">{c.SOLID_MONTHS.map(m => <li key={m.month}><a href={hubPath(basePath, 'solidFoodMonth', String(m.month))}><strong>{m.month} ay</strong><span>{m.meals}</span></a></li>)}</ul></section>
    <AppGate tool="solid-food-guide" area="solid" premium title="Tam əlavə qida bələdçisi Anacan-da" text="Saytda ümumi cədvəli gördünüz. Körpənizin yaşına görə nə, nə qədər və necə veriləcəyi, reseptlər və qaydalar tətbiqdədir." locked={h.locked}/>
    <Sources items={h.sources}/>
    <Disclaimer/>
    <AppSticky tool="solid-food-guide" area="solid" text="Ay-ay menyu Anacan-da"/>
  </>;
}
function SolidMonthPage() {
  const { route, basePath } = useWebsite(), c = seoHubContent()!;
  const m = c.solidMonth(Number(route.slug));
  if (!m) return null;
  const prev = c.solidMonth(m.month - 1), next = c.solidMonth(m.month + 1), area = `solid_${m.month}`;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Əlavə qida · {m.month} ay</Eyebrow><h1>{m.title}</h1></div>
    <AppPill tool="solid-food-guide" area={area} text={`${m.month} aylıq menyu və reseptlər tətbiqdə`}/>
    <Answer text={m.quick}/>
    <section className="tl-prose"><div className="tl-table-wrap"><table className="tl-table pw-table"><tbody>
      <tr><th scope="row">Konsistensiya</th><td>{m.texture}</td></tr><tr><th scope="row">Gündə neçə dəfə</th><td>{m.meals}</td></tr><tr><th scope="row">Əsas qida</th><td>{m.month < 12 ? 'Ana südü və ya süd qarışığı' : 'Ailə yeməyi; ana südü davam edə bilər'}</td></tr>
    </tbody></table></div></section>
    <section className="site-section tl-prose"><h2>Bu ayda nə vermək olar?</h2><ul className="sh-chips">{m.foods.map(food => <li key={food}>{food}</li>)}</ul></section>
    <section className="site-section tl-prose"><h2>Diqqət edin</h2><ul>{m.watch.map(text => <li key={text}>{text}</li>)}</ul></section>
    <AppGate tool="solid-food-guide" area={area} premium title={`${m.month} aylıq körpə üçün tam plan tətbiqdədir`} text="Saytda qısa siyahını gördünüz. Gündəlik menyu, porsiyalar, reseptlər və yeni qidaların qeydi Anacan-dadır." locked={c.SOLID_HUB.locked}/>
    <Faq items={m.faq}/>
    <nav className="pw-pager" aria-label="Aylar">
      {prev ? <a href={hubPath(basePath, 'solidFoodMonth', String(prev.month))} rel="prev"><ChevronLeft aria-hidden="true" size={18}/><span><small>Əvvəlki</small>{prev.month} ay</span></a> : <span/>}
      <a className="pw-pager-hub" href={hubPath(basePath, 'solidFoods')}>Bütün aylar</a>
      {next ? <a href={hubPath(basePath, 'solidFoodMonth', String(next.month))} rel="next"><span><small>Növbəti</small>{next.month} ay</span><ChevronRight aria-hidden="true" size={18}/></a> : <span/>}
    </nav>
    <Sources items={c.SOLID_HUB.sources}/>
    <Disclaimer/>
    <AppSticky tool="solid-food-guide" area={area} text={`${m.month} aylıq menyu Anacan-da`}/>
  </>;
}

/* ---------- pregnancy can / can't ---------- */
function SafeHubPage() {
  const { basePath } = useWebsite(), c = seoHubContent()!;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Hamiləlik</Eyebrow><h1>{c.SAFE_HUB.heading}</h1><p>{c.SAFE_HUB.intro}</p></div>
    <AppPill tool="safety" area="safe" text="İstənilən qidanı və fəaliyyəti Anacan-da yoxlayın"/>
    <ul className="sh-q-grid">{c.SAFE_ITEMS.map(item => <li key={item.slug}><a href={hubPath(basePath, 'pregnancySafeItem', item.slug)}><strong>{item.question}</strong><VerdictChip verdict={item.verdict} label={c.VERDICT_LABEL[item.verdict]}/></a></li>)}</ul>
    <AppGate tool="safety" area="safe" title="Sualınız siyahıda yoxdur? Anacan-da yoxlayın" text="Qida, dərman, gözəllik vasitəsi və ya fəaliyyətin adını yazın: Anacan dərhal olar, ehtiyatla və ya olmaz cavabını göstərir." locked={SAFE_LOCKED}/>
    <Sources items={c.SAFE_ITEMS.flatMap(item => item.sources)}/>
    <Disclaimer/>
    <AppSticky tool="safety" area="safe" text="Olar və olmaz yoxlayıcısı Anacan-da"/>
  </>;
}
const SAFE_LOCKED = ['Qida və fəaliyyət axtarışı', 'Kateqoriyalar: qida, dərman, gözəllik, fəaliyyət', 'Süni intellektlə sual-cavab', 'Həftənizə uyğun gündəlik məsləhət'];
function SafeItemPage() {
  const { route, basePath, href } = useWebsite(), c = seoHubContent()!;
  const item = c.safeItem(route.slug);
  if (!item) return null;
  const others = c.SAFE_ITEMS.filter(other => other.slug !== item.slug).slice(0, 6), area = `safe_${item.slug.replace(/-/g, '_')}`;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Hamiləlikdə olar və olmaz</Eyebrow><h1>{item.question}</h1></div>
    <div className="sh-answer"><VerdictChip verdict={item.verdict} label={c.VERDICT_LABEL[item.verdict]}/><p>{item.answer}</p></div>
    <section className="tl-prose"><h2>Niyə?</h2><p>{item.explain[0]}</p></section>
    <AppInline tool="safety" area={area} text="Başqa qida və ya fəaliyyət haqqında sualınız var? Anacan-da adını yazın, cavabı dərhal görün."/>
    <section className="tl-prose">{item.explain.slice(1).map(text => <p key={text}>{text}</p>)}</section>
    <section className="site-section tl-prose"><h2>Faydalı məsləhətlər</h2><ul className="pw-checklist">{item.tips.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    {c.SAFE_ARTICLES[item.slug] && <section className="site-section tl-prose"><h2>Ətraflı oxuyun</h2><p><a className="site-text-link" href={href('article', c.SAFE_ARTICLES[item.slug].slug)}>{c.SAFE_ARTICLES[item.slug].title}<Arrow/></a></p></section>}
    <AppGate tool="safety" area={area} title="Hər gün yeni sual yaranır. Cavablar Anacan-dadır" text="Anacan-ın olar və olmaz yoxlayıcısı hamiləlikdə qida, dərman və fəaliyyətlər üçün qısa, mənbəli cavab verir." locked={SAFE_LOCKED}/>
    <section className="site-section"><h2 className="sh-h2">Digər suallar</h2><ul className="sh-q-grid">{others.map(other => <li key={other.slug}><a href={hubPath(basePath, 'pregnancySafeItem', other.slug)}><strong>{other.question}</strong><VerdictChip verdict={other.verdict} label={c.VERDICT_LABEL[other.verdict]}/></a></li>)}</ul>
      <a className="site-text-link" href={hubPath(basePath, 'pregnancySafe')}>Bütün 20 sual<Arrow/></a></section>
    <Sources items={item.sources}/>
    <Disclaimer/>
    <AppSticky tool="safety" area={area} text="Olar və olmaz yoxlayıcısı Anacan-da"/>
  </>;
}

/* ---------- breast milk storage ---------- */
function MilkPage() {
  const c = seoHubContent()!, m = c.MILK;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Ana südü</Eyebrow><h1>{m.heading}</h1></div>
    <AppPill tool="baby-tracker" area="milk" text="Qidalanma qeydləri Anacan tətbiqində"/>
    <Answer text={m.answer}/>
    <section className="tl-prose sh-milk"><h2>Saxlama cədvəli</h2>
      <div className="tl-table-wrap"><table className="tl-table"><thead><tr><th>Harada</th><th>Təzə sağılmış süd</th><th>Əridilmiş süd</th></tr></thead>
        <tbody>{m.rows.map(row => <tr key={row.place}><th scope="row">{row.place}</th><td><strong>{row.fresh}</strong></td><td>{row.thawed}</td></tr>)}</tbody></table></div>
      <button type="button" className="site-outline-button sh-print" onClick={() => window.print()}><Printer aria-hidden="true" size={16}/>Cədvəli çap et</button>
    </section>
    <AppInline tool="baby-tracker" area="milk" text="Hər qidalanmanı bir toxunuşla qeyd edin: sol və sağ döş, şüşə, miqdar və vaxt."/>
    <section className="site-section tl-prose"><h2>Qaydalar</h2><ul className="pw-checklist">{m.rules.map(text => <li key={text}><Check aria-hidden="true" size={17} strokeWidth={2}/><span>{text}</span></li>)}</ul></section>
    <AppGate tool="baby-tracker" area="milk" title="Qidalanmanı Anacan-da izləyin" text="Saxlama qaydalarını öyrəndiniz. Əmizdirmə, şüşə ilə qidalanma və gündəlik statistika üçün Anacan-ı yükləyin." locked={m.locked}/>
    <Faq items={m.faq}/>
    <Sources items={m.sources}/>
    <Disclaimer/>
    <AppSticky tool="baby-tracker" area="milk" text="Qidalanma izləyicisi Anacan-da"/>
  </>;
}

/* ---------- periods ---------- */
function PeriodPage() {
  const { href } = useWebsite(), c = seoHubContent()!, p = c.PERIOD;
  return <>
    <ToolBreadcrumb/>
    <div className="site-page-intro tl-intro"><Eyebrow>Qadın sağlamlığı</Eyebrow><h1>{p.heading}</h1></div>
    <AppPill tool="calendar" area="period" text="Aybaşı təqvimi Anacan tətbiqində"/>
    <Answer text={p.answer}/>
    <section className="tl-prose"><h2>Aybaşı, menstruasiya, period, regl: fərq var?</h2><p>{p.names}</p></section>
    <nav className="tl-links" aria-label="Mövzular">{p.sections.map(section => <a key={section.id} className="site-outline-button" href={`#${section.id}`}>{section.title}</a>)}</nav>
    {p.sections.map((section, index) => <div key={section.id}>
      <section className="site-section tl-prose" id={section.id}><h2>{section.title}</h2><p>{section.text}</p></section>
      {index === 1 && <AppInline tool="calendar" area="period" text="Anacan dövrünüzü öyrənir: növbəti aybaşını, ovulyasiyanı və gecikməni əvvəlcədən göstərir."/>}
    </div>)}
    <section className="site-section tl-prose pw-warning"><h2><AlertTriangle aria-hidden="true" size={22} strokeWidth={1.8}/>Nə vaxt həkimə müraciət etməli</h2><ul>{p.doctor.map(text => <li key={text}>{text}</li>)}</ul></section>
    <aside className="tl-article-tool pw-due"><span className="site-icon-wash site-wash-mint"><CalendarDays size={22} strokeWidth={1.5}/></span>
      <div><strong>Növbəti aybaşınız nə vaxtdır?</strong><p>Son aybaşı tarixinə görə növbəti 3 dövrü hesablayın.</p></div>
      <a className="site-outline-button" href={href('periodCalendar')}>Aybaşı təqvimi<Arrow/></a></aside>
    <AppGate tool="calendar" area="period" title="Dövrünüzü Anacan-da izləyin" text="Bir dəfə qeyd edin, qalanını Anacan hesablayır: proqnozlar, xatırlatmalar və nizamsızlıq barədə xəbərdarlıq." locked={p.locked}/>
    <section className="site-section tl-prose"><h2>Ətraflı oxuyun</h2><ul>{p.articles.map(article => <li key={article.slug}><a className="site-text-link" href={href('article', article.slug)}>{article.title}</a></li>)}</ul></section>
    <Faq items={p.faq}/>
    <Sources items={p.sources}/>
    <Disclaimer/>
    <AppSticky tool="calendar" area="period" text="Aybaşı təqvimi Anacan-da"/>
  </>;
}

export default function SeoHubPageView({ kind }: { kind: SeoHubPage }) {
  if (!seoHubContent()) return null;
  return kind === 'feverGuide' ? <FeverPage/> : kind === 'solidFoods' ? <SolidHubPage/> : kind === 'solidFoodMonth' ? <SolidMonthPage/>
    : kind === 'pregnancySafe' ? <SafeHubPage/> : kind === 'pregnancySafeItem' ? <SafeItemPage/> : kind === 'milkStorage' ? <MilkPage/> : <PeriodPage/>;
}
