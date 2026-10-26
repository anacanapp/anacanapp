import { useState } from 'react';
import { CHAPTERS, copy } from '../game/content';
import { createState, DEFAULT_AVATAR } from '../game/engine';
import { t, text } from '../game/i18n';
import type { Avatar, Language } from '../game/types';
import { AvatarEditor } from './AvatarEditor';
import { Icon } from './Icon';
import { WorldView } from './WorldView';
import { FIRST_BABY_CHAPTER } from '../game/scenario';

export function Onboarding({ onStart, language, onLanguage }: { onStart(avatar: Avatar, chapter: number): void; language: Language; onLanguage(language: Language): void }) {
  const [step, setStep] = useState(0), [avatar, setAvatar] = useState<Avatar>({ ...DEFAULT_AVATAR }), [chapter, setChapter] = useState(0);
  const [preview] = useState(() => createState());
  return <main className={`onboarding onboarding-step-${step}`}>
    <header className="onboarding-header"><div className="brand-lockup"><img src="/assets/mark.svg" alt="" /><div>Mommy Simulator<small>by Anacan</small></div></div>
      <select value={language} onChange={e => onLanguage(e.target.value as Language)} aria-label={t('language', language)}><option value="az">AZ</option><option value="en">EN</option><option value="tr">TR</option></select></header>
    {step === 0 ? <>
      <div className="welcome-copy"><span className="eyebrow">{t('welcomeTag', language)}</span><h1>{t('welcomeTitle', language).split('\n').map((line, i) => <span key={line}>{i === 1 ? <em>{line}</em> : line}</span>)}</h1><p>{t('welcomeBody', language)}</p></div>
      <div className="welcome-diorama"><div className="diorama-halo" /><WorldView state={preview} onObject={() => {}} onFloor={() => {}} intro /><span className="welcome-float float-one"><Icon name="heart" size={16} />{text(copy('Sevgi ilə böyü', 'Grow with love', 'Sevgiyle büyü'), language)}</span><span className="welcome-float float-two"><Icon name="home" size={16} />{text(copy('Öz yuvanı yarat', 'Create your nest', 'Yuvanı yarat'), language)}</span></div>
      <div className="welcome-footer"><div className="welcome-features"><span><Icon name="sparkles" size={17} />3D</span><span><Icon name="leaf" size={17} />{text(copy('Sakit ritm', 'Cozy rhythm', 'Sakin ritim'), language)}</span><span><Icon name="heart" size={17} />{text(copy('Sənin hekayən', 'Your story', 'Senin hikâyen'), language)}</span></div>
        <button className="button primary large" onClick={() => setStep(1)} data-testid="welcome-start">{t('continue', language)}<Icon name="arrow" size={20} /></button><small>{t('gentleNote', language)}</small></div>
    </> : <div className="onboarding-content">
      <div className="onboarding-step-top"><button className="icon-button" onClick={() => setStep(step - 1)} aria-label={t('back', language)}><Icon name="left" /></button><div className="step-dots">{[0, 1, 2].map(i => <span key={i} className={i <= step ? 'active' : ''} />)}</div><span className="step-count">0{step + 1} / 03</span></div>
      <span className="eyebrow">{step === 1 ? t('yourCharacter', language) : t('chooseChapter', language)}</span>
      <h1>{step === 1 ? t('appearance', language) : t('chooseChapter', language)}</h1>
      {step === 1 ? <AvatarEditor avatar={avatar} onChange={setAvatar} language={language} /> : <>
        <p className="muted chapter-hint">{t('chapterHint', language)}</p><div className="start-chapters">{[0, FIRST_BABY_CHAPTER + 1].map(index => <button key={index} className={`start-chapter ${chapter === index ? 'selected' : ''}`} onClick={() => setChapter(index)} aria-pressed={chapter === index} data-testid={`start-chapter-${index}`}>
          <span className="chapter-radio">{chapter === index && <Icon name="check" size={14} />}</span><img src={`/assets/anacan-${index === 0 ? 'bump' : 'mom'}.webp`} alt="" /><span className="chapter-choice-title">{t(index === 0 ? 'pregnancy' : 'motherhood', language)}</span><strong>{text(CHAPTERS[index].title, language)}</strong><span>{text(CHAPTERS[index].subtitle, language)}</span><small>{text(CHAPTERS[index].period, language)} <Icon name="arrow" size={13} /></small>
        </button>)}</div><div className="gentle-card"><Icon name="bookheart" size={23} /><p>{text(copy('Bu dünya Anacan-ın Google kitabxanasındakı həqiqi məlumatlardan ilham alır. Sənin balaca, yaradıcı hekayən.', 'This world is inspired by real content in Anacan’s Google library. Your little creative story.', 'Bu dünya Anacan’ın Google kütüphanesindeki gerçek içerikten ilham alır. Senin küçük, yaratıcı hikâyen.'), language)}</p></div>
      </>}
      <button className="button primary large onboarding-next" onClick={() => step === 1 ? setStep(2) : onStart(avatar, chapter)} data-testid={step === 1 ? 'avatar-next' : 'begin-story'}>{step === 1 ? t('continue', language) : t('start', language)}<Icon name="arrow" /></button>
    </div>}
  </main>;
}
