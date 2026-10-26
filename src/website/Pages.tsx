import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useWebsite } from './context';
import { Arrow, DownloadCard, FaqList, Intro, StoreLinks, ToolCards, SectionHeading } from './components';
import { FeatureGrid, StageCards } from './Home';
import { WEBSITE_ORIGIN, sitePath } from './routes';
import type { WebsiteCopyKey } from './model';

export function ToolsPage() {
  return <><Intro title="toolsTitle" description="toolsDescription" eyebrow="toolsEyebrow"/><ToolCards/><section className="site-section site-faq-section"><SectionHeading title="faq" description="faqDescription"/><FaqList keys={[5,4]}/></section><DownloadCard/></>;
}
export function FeaturesPage() {
  return <><Intro title="featuresTitle" description="featuresIntro" eyebrow="featureEyebrow"/><StageCards/><section className="site-section"><SectionHeading title="featureTitle" description="featureDescription"/><FeatureGrid/></section><DownloadCard/></>;
}
export function FaqPage() { return <><Intro title="faq" description="faqDescription"/><div className="site-narrow"><FaqList/></div><DownloadCard/></>; }
export function DownloadPage() {
  const {t,route}=useWebsite();
  return <><Intro title="downloadTitle" description="downloadDescription" eyebrow="downloadEyebrow"/><div className="site-download-page"><div className="site-download-app-icon"><img src="/brand-mark.png" width="112" height="112" alt="Anacan"/></div><StoreLinks/><p>{t('downloadNote')}</p><div className="site-qr-card"><QRCodeSVG value={WEBSITE_ORIGIN+sitePath(route.language,'download')} size={144} bgColor="#ffffff" fgColor="#333333" level="M" title={t('qrLabel')}/><div><h2>{t('qrLabel')}</h2><p>{t('qrDescription')}</p></div></div></div><section className="site-section"><SectionHeading title="stageTitle" description="stageDescription"/><StageCards/></section></>;
}
export function ContactPage() {
  const {t}=useWebsite();
  const [status,setStatus]=useState('');
  const send=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!event.currentTarget.reportValidity())return;
    const values=new FormData(event.currentTarget),name=String(values.get('name')||''),email=String(values.get('email')||''),subject=String(values.get('subject')||''),message=String(values.get('message')||'');
    const body=`${t('name')}: ${name}\n${t('email')}: ${email}\n\n${message}`;
    window.location.href=`mailto:info@anacan.az?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStatus(t('emailComposeReady'));
  };
  return <><Intro title="contactTitle" description="contactDescription"/><div className="site-contact-grid"><form className="site-contact-form" onSubmit={send}>
    <label htmlFor="contact-name">{t('name')}</label><input id="contact-name" name="name" autoComplete="name" maxLength={100} required/>
    <label htmlFor="contact-email">{t('email')}</label><input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} required/>
    <label htmlFor="contact-subject">{t('subject')}</label><input id="contact-subject" name="subject" maxLength={150} required/>
    <label htmlFor="contact-message">{t('message')}</label><textarea id="contact-message" name="message" rows={6} maxLength={3000} required/>
    <button type="submit" className="site-rainbow-button">{t('sendEmail')}<Arrow diagonal/></button><p className="site-input-help">{t('emailComposeNote')}</p><p role="status">{status}</p>
  </form><div className="site-contact-info"><article><Mail size={24} strokeWidth={1.5}/><h2>{t('generalSupport')}</h2><a href="mailto:info@anacan.az">info@anacan.az<Arrow diagonal/></a><p>{t('supportNote')}</p></article><article><ShieldCheck size={24} strokeWidth={1.5}/><h2>{t('privacySupport')}</h2><a href="mailto:privacy@anacan.az">privacy@anacan.az<Arrow diagonal/></a></article><article><MapPin size={24} strokeWidth={1.5}/><p>{t('contactLocation')}</p><div className="site-social-links"><a href="https://instagram.com/anacanapp" target="_blank" rel="noopener noreferrer">Instagram<Arrow diagonal/></a><a href="https://facebook.com/anacanapp" target="_blank" rel="noopener noreferrer">Facebook<Arrow diagonal/></a></div></article></div></div></>;
}
export function LegalPage({kind}:{kind:'privacy'|'terms'}) {
  const {t,legalContent,legalUpdated}=useWebsite();
  return <><Intro title={kind} description={kind==='privacy'?'privacyDescription':'termsDescription'}/><div className="site-narrow"><p className="site-legal-updated">{t('legalUpdated')}: <time dateTime={legalUpdated}>{legalUpdated?.slice(0,10)}</time></p><div className="site-prose" dangerouslySetInnerHTML={{__html:legalContent||''}}/><a className="site-text-link" href="mailto:privacy@anacan.az">privacy@anacan.az<Arrow diagonal/></a></div></>;
}
const symptomStages=['early','firstTrimester','firstTrimester','early','firstTrimester','early','early','firstTrimester','secondTrimester','secondTrimester','secondTrimester','thirdTrimester','thirdTrimester','thirdTrimester'] as const;
export function SymptomsPage() {
  const {t,href}=useWebsite();
  const [stage,setStage]=useState('');
  return <><Intro title="symptomsTitle" description="symptomsIntro"/><div className="site-filter-tabs site-symptom-tabs" aria-label={t('symptoms')}><button onClick={()=>setStage('')} aria-pressed={!stage}>{t('all')}</button>{(['early','firstTrimester','secondTrimester','thirdTrimester'] as const).map(item=><button key={item} onClick={()=>setStage(item)} aria-pressed={stage===item}>{t(item)}</button>)}</div>
    <div className="site-symptom-grid">{symptomStages.map((item,index)=>(!stage||stage===item)&&<article className="site-symptom-card" key={index}><span className="site-tag site-wash-sky">{t(item)}</span><h2><span>{String(index+1).padStart(2,'0')}</span>{t(`symptom${index+1}Title` as WebsiteCopyKey)}</h2><p>{t(`symptom${index+1}Text` as WebsiteCopyKey)}</p></article>)}</div>
    <section className="site-urgent-card"><h2>{t('urgentTitle')}</h2><p>{t('urgentText')}</p></section><div className="site-result-actions"><a className="site-outline-button" href={href('ovulation')}>{t('ovulation')}<Arrow/></a><a className="site-outline-button" href={href('dueDate')}>{t('dueDate')}<Arrow/></a></div>
    <section className="site-section site-faq-section"><SectionHeading title="faq"/><FaqList keys={[1,2]} prefix="symptomsFaq"/></section><div className="site-references"><h2>{t('sourcesNote')}</h2><ul><li><a href="https://www.nhs.uk/pregnancy/trying-for-a-baby/signs-and-symptoms-of-pregnancy/" target="_blank" rel="noopener noreferrer">NHS — Signs and symptoms of pregnancy<Arrow diagonal/></a></li><li><a href="https://www.nhs.uk/pregnancy/keeping-well/your-babys-movements/" target="_blank" rel="noopener noreferrer">NHS — Your baby's movements<Arrow diagonal/></a></li></ul></div><DownloadCard/></>;
}
export function SimulatorPage() {
  const {t}=useWebsite();
  const [current,setCurrent]=useState(-1),[choice,setChoice]=useState<number|null>(null),[checked,setChecked]=useState(false),[score,setScore]=useState(0);
  const finished=current===5;
  // Rotate answers so the correct option is not always in the same position.
  const positions=[1,2,0,2,1],order=current>=0&&current<5?[1,2,3].sort((a,b)=>((a-1+positions[current])%3)-((b-1+positions[current])%3)):[];
  const advance=()=>{setCurrent(value=>value+1);setChoice(null);setChecked(false);};
  const start=()=>{setCurrent(0);setScore(0);setChoice(null);setChecked(false);};
  return <><Intro title="simulatorTitle" description="simulatorIntro"/><section className="site-quiz" aria-live="polite">
    {current<0?<button className="site-rainbow-button" onClick={start}>{t('startTest')}<Arrow/></button>:finished?<><h2>{t('testComplete')}</h2><p className="site-quiz-score">{t('testScore',{count:score,total:5})}</p><p>{t('testEndText')}</p><button className="site-outline-button" onClick={start}>{t('restartTest')}<Arrow/></button></>:<><p className="site-eyebrow">{t('questionProgress',{current:current+1,total:5})}</p><h2>{t(`test${current+1}Question` as WebsiteCopyKey)}</h2><div className="site-quiz-choices">{order.map(option=><button key={option} aria-pressed={choice===option} disabled={checked} onClick={()=>setChoice(option)}>{t(`test${current+1}Option${option}` as WebsiteCopyKey)}</button>)}</div>{checked?<><p className="site-quiz-explanation">{t(`test${current+1}Explanation` as WebsiteCopyKey)}</p><button className="site-outline-button" onClick={advance}>{t('next')}<Arrow/></button></>:<button className="site-outline-button" disabled={choice===null} onClick={()=>{setChecked(true);if(choice===1)setScore(value=>value+1);}}>{t('checkAnswer')}<Arrow/></button>}</>}
  </section><DownloadCard/></>;
}
export function NotFoundPage() {
  const {t,href}=useWebsite();
  return <div className="site-not-found"><Intro title="notFound" description="notFoundDescription"/><a className="site-outline-button" href={href()}>{t('backHome')}<Arrow/></a><a className="site-ghost-button" href={href('journal')}>{t('journal')}<Arrow/></a></div>;
}
