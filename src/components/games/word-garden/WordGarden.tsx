import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Flower2, HelpCircle, Infinity as InfinityIcon, Leaf, LockKeyhole, Play, Settings2, Sparkles, Star, Trophy, WifiOff } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { tr } from '@/lib/tr';
import { pushBackHandler } from '@/lib/backButton';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { WORD_GARDEN_LIBRARIES, hasWordGardenLibrary, wordGardenLanguage } from './library';
import { LEVEL_PAGE_SIZE, type GardenPreferences, type WordGardenMode } from './model';
import { getGardenLevelProfile } from './model';
import { readGardenPreferences, writeGardenPreferences } from './storage';
import { useGardenProfile } from './useGardenProfile';
import { useGardenText } from './useGardenText';
import GardenScenery from './Scenery';
import GardenGame from './GardenGame';
import GardenDialog from './GardenDialog';
import GardenSettings from './GardenSettings';
import GardenHelp from './GardenHelp';
import companion from '@/assets/onboarding/cycle-freemode.webp';
import './word-garden.css';

const artLetters = ['S', 'Ö', 'Z'];

export default function WordGarden({ onBack }: { onBack: () => void }) {
  const rawLanguage = useUserStore(state => state.language) || 'az', language = wordGardenLanguage(rawLanguage);
  const [mode, setMode] = useState<WordGardenMode>('calm');
  if (!hasWordGardenLibrary(language)) return <div className="a-scope p-6">
    <button type="button" onClick={onBack} className="a-icon-btn" aria-label={tr('common_back', 'Geri')}><ArrowLeft size={19} /></button>
    <p className="mt-4">{tr('word_garden_language_pending', 'Bu dil üçün söz kitabxanası hazırlanır.')}</p>
  </div>;
  const descriptor = WORD_GARDEN_LIBRARIES[language];
  return <GardenJourney key={`${language}:${descriptor.revision}:${mode}`} language={language} locale={descriptor.locale}
    revision={descriptor.revision} mode={mode} onMode={setMode} onBack={onBack} />;
}
function GardenJourney({ language, locale, revision, mode, onMode, onBack }: {
  language: string; locale: string; revision: string; mode: WordGardenMode; onMode: (mode: WordGardenMode) => void; onBack: () => void;
}) {
  useScreenAnalytics('WordGarden', 'MiniGames');
  const { t, number } = useGardenText(language, locale);
  const { profile, current, transact, storageReady } = useGardenProfile(language, revision, mode);
  const [preferences, setPreferences] = useState(readGardenPreferences), [modal, setModal] = useState<'settings' | 'help' | 'library' | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null), [page, setPage] = useState(() => Math.floor((profile.progress.unlockedLevel - 1) / LEVEL_PAGE_SIZE));
  const librarySize = WORD_GARDEN_LIBRARIES[language];
  const latest = useRef({ onBack, selectedLevel, modal }); latest.current = { onBack, selectedLevel, modal };
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => pushBackHandler(() => {
    if (latest.current.selectedLevel !== null || latest.current.modal) return false;
    latest.current.onBack(); return true;
  }), []);
  const changePreferences = (next: GardenPreferences) => { setPreferences(next); writeGardenPreferences(next); };
  const play = (level: number) => {
    if (!Number.isSafeInteger(level) || level < 1 || level > current.current.progress.unlockedLevel) return;
    setSelectedLevel(level);
  };
  const savedLevel = profile.round && !profile.round.awarded ? Number(profile.round.levelId.split(':')[3]) : null;
  const resumeSaved = Number.isSafeInteger(savedLevel) && savedLevel! >= 1 && savedLevel! <= profile.progress.unlockedLevel;
  const startingLevel = resumeSaved ? savedLevel! : profile.progress.unlockedLevel;
  const first = page * LEVEL_PAGE_SIZE + 1;
  const levels = Array.from({ length: LEVEL_PAGE_SIZE }, (_, index) => first + index);
  const hasReducedMotion = preferences.reducedMotion;
  return createPortal(<div className={`wg-screen wg-theme-${preferences.theme} ${preferences.highContrast ? 'wg-high-contrast' : ''} ${hasReducedMotion ? 'wg-reduced-motion' : ''}`}
    data-testid="wordgarden-screen" lang={language} dir="ltr" data-game-id="word-garden" data-game-phase={selectedLevel === null ? 'menu' : undefined}
    data-ad-block="true" data-ad-allow={selectedLevel !== null ? 'games_break_interstitial game_revive_rewarded' : ''}>
    <GardenScenery />
    {selectedLevel === null ? <>
      <div className="wg-shell wg-lobby-shell">
        <header className="wg-header"><button type="button" className="wg-icon" aria-label={t('back')} onClick={onBack}><ArrowLeft size={19} /></button>
          <span className="wg-brand">Anacan<span>PLAY</span></span>
          <button type="button" className="wg-icon" aria-label={t('settings')} onClick={() => setModal('settings')}><Settings2 size={19} /></button></header>
        <div className="wg-lobby-scroll">
          <section className="wg-hero">
            <span className="wg-language-badge"><BookOpen size={12} />{t('language')}<span className="wg-badge-dot" /></span>
            <h1>{t('title')}<Flower2 className="wg-title-flower" size={30} /></h1>
            <p>{t('tagline')}</p>
            <div className="wg-hero-art" aria-hidden="true"><div className="wg-art-orbit" />
              <span className="wg-art-tile wg-art-s">{artLetters[0]}</span><span className="wg-art-tile wg-art-o">{artLetters[1]}</span><span className="wg-art-tile wg-art-z">{artLetters[2]}</span>
              <img src={companion} alt="" width="512" height="512" className="wg-companion" />
              <span className="wg-art-leaf"><Leaf size={21} /></span><span className="wg-art-spark"><Sparkles size={23} /></span></div>
            <div className="wg-mode-switch" role="group" aria-label={t('settings')}><button type="button" aria-pressed={mode === 'calm'} onClick={() => onMode('calm')}><Leaf size={14} />{t('calm')}</button>
              <button type="button" aria-pressed={mode === 'timed'} onClick={() => onMode('timed')}><Sparkles size={14} />{t('timed')}</button></div>
            <p className="wg-mode-description">{t(mode === 'calm' ? 'calmDescription' : 'timedDescription')}</p>
            <button type="button" className="wg-primary wg-play" onClick={() => play(startingLevel)}><span><Play size={17} fill="currentColor" />{t(resumeSaved ? 'resume' : 'play')}</span><small>{t('level', { level: startingLevel })}<ArrowRight size={15} /></small></button>
            <div className="wg-hero-proof"><span><InfinityIcon size={13} />{t('infinite')}</span><i /> <span><WifiOff size={12} />{t('offline')}</span></div>
          </section>
          <section className="wg-journey-panel">
            <div className="wg-chapter-header"><div><span className="wg-eyebrow">{t('journeyTitle')}</span><h2>{t('chapter', { chapter: page + 1 })}<small>{t('chapterRange', { from: first, to: first + LEVEL_PAGE_SIZE - 1 })}</small></h2></div>
              <span className="wg-chapter-flower"><Flower2 size={24} /></span></div>
            <div className="wg-level-grid">{levels.map(level => {
              const unlocked = level <= profile.progress.unlockedLevel, recent = profile.progress.levels[String(level)], completed = level < profile.progress.unlockedLevel;
              const isCurrent = level === profile.progress.unlockedLevel;
              return <button type="button" key={level} disabled={!unlocked} data-garden-level={level}
                aria-label={unlocked ? t('level', { level }) : t('lockedLevel', { level })}
                className={`wg-level ${isCurrent ? 'is-current' : ''} ${completed ? 'is-complete' : ''}`} onClick={() => play(level)}>
                {unlocked ? <strong>{number(level)}</strong> : <LockKeyhole size={16} />}
                <span>{completed ? recent ? [1, 2, 3].map(star => <Star key={star} size={9} fill={star <= recent.stars ? 'currentColor' : 'none'} />) : <Check size={13} /> : isCurrent ? <Leaf size={11} /> : number(level)}</span>
              </button>;
            })}</div>
            <div className="wg-page-controls"><button type="button" className="wg-icon" disabled={page === 0} aria-label={t('previousPage')} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} /></button>
              <span>{t(`difficulty${getGardenLevelProfile(first).difficulty}`)}</span>
              <button type="button" className="wg-icon" aria-label={t('nextPage')} disabled={first + LEVEL_PAGE_SIZE > Number.MAX_SAFE_INTEGER - LEVEL_PAGE_SIZE} onClick={() => setPage(value => value + 1)}><ChevronRight size={18} /></button></div>
            {Math.floor((profile.progress.unlockedLevel - 1) / LEVEL_PAGE_SIZE) !== page && <button type="button" className="wg-text-button" onClick={() => setPage(Math.floor((profile.progress.unlockedLevel - 1) / LEVEL_PAGE_SIZE))}>{t('currentLevel')}</button>}
          </section>
          <div className="wg-journey-stats"><div><Flower2 size={18} /><strong>{number(profile.progress.coins)}</strong><span>{t('coins')}</span></div><div><BookOpen size={18} /><strong>{number(profile.progress.totalWords)}</strong><span>{t('foundWords')}</span></div><div><Trophy size={18} /><strong>{number(profile.progress.bestScore)}</strong><span>{t('bestScore')}</span></div></div>
          <div className="wg-lobby-footer"><button type="button" onClick={() => setModal('help')}><HelpCircle size={15} />{t('help')}</button><button type="button" onClick={() => setModal('library')}><BookOpen size={15} />{t('library')}</button></div>
          <p className={`wg-save-note ${!storageReady ? 'wg-storage-warning' : ''}`} role="status">{t(storageReady ? 'saved' : 'storageError')}</p>
        </div>
      </div>
      {modal && <GardenDialog title={t(modal === 'settings' ? 'settings' : modal === 'help' ? 'helpTitle' : 'library')} closeLabel={t('close')} onClose={() => setModal(null)}>
        {modal === 'settings' && <GardenSettings preferences={preferences} onChange={changePreferences} t={t} />}
        {modal === 'help' && <GardenHelp t={t} />}
        {modal === 'library' && <><div className="wg-modal-emblem"><BookOpen size={30} /></div><p>{t('libraryDescription', { count: librarySize?.words || 0 })}</p>
          <span className="wg-library-tag">{t('libraryTargets', { count: librarySize?.targets || 0 })}</span><p className="wg-muted">{t('sourceNote')}</p>
          <a href="https://kaikki.org/dictionary/Azerbaijani/" target="_blank" rel="noopener noreferrer" className="wg-secondary">Wiktionary / Kaikki.org</a>
          <a href="https://github.com/subhangadirli/aosp-dict-az/tree/c68c85cb297510d19cee04787e445e2a558b1f70" target="_blank" rel="noopener noreferrer" className="wg-secondary">Leipzig · aosp-dict-az</a>
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="wg-text-button">CC BY-SA 4.0</a></>}
      </GardenDialog>}
    </> : <GardenGame key={selectedLevel} language={language} locale={locale} mode={mode} level={selectedLevel} profile={profile}
      current={current} transact={transact} preferences={preferences} onPreferences={changePreferences} t={t} number={number}
      storageReady={storageReady} onExit={() => { setPage(Math.floor((current.current.progress.unlockedLevel - 1) / LEVEL_PAGE_SIZE)); setSelectedLevel(null); }} onNext={play} />}
  </div>, document.body);
}
