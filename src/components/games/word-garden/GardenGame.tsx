import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { ArrowLeft, BookOpen, Check, Clock3, Flower2, Gift, HelpCircle, Home, Leaf, Lightbulb, Pause, Play, RotateCcw, Settings2, Sparkles, Star } from 'lucide-react';
import { hapticFeedback } from '@/lib/native';
import { pushBackHandler } from '@/lib/backButton';
import { useGameAds, type GameReviveBenefits } from '@/hooks/useGameAds';
import { trackEvent } from '@/hooks/useScreenAnalytics';
import GameReviveAction from '../GameReviveAction';
import { gardenTimeLimit, HINT_COST, WORD_GARDEN_ID, type GardenPreferences, type GardenProfile, type WordGardenLevel, type WordGardenMode } from './model';
import { completeGardenLevel, createGardenRound, gardenResult, isGardenSolved, submitGardenWord, revealGardenHint, validGardenRound, visibleGardenCells } from './state';
import { gardenRandom, shuffleLetters } from './generator';
import { disposeGardenWorker, loadGardenLevel } from './workerClient';
import { displayGardenWord } from './lexicon';
import { createGardenAudio } from './audio';
import type { GardenMessageKey } from './messages';
import type { GardenText } from './useGardenText';
import LetterWheel from './LetterWheel';
import CrosswordBoard from './CrosswordBoard';
import GardenDialog from './GardenDialog';
import GardenSettings from './GardenSettings';
import GardenHelp from './GardenHelp';

type Phase = 'loading' | 'ready' | 'playing' | 'paused' | 'won' | 'lost' | 'error';
type Modal = 'settings' | 'help' | 'bonus' | null;
interface Props {
  language: string; locale: string; mode: WordGardenMode; level: number; profile: GardenProfile;
  current: MutableRefObject<GardenProfile>; transact: (update: (value: GardenProfile) => GardenProfile) => GardenProfile;
  preferences: GardenPreferences; onPreferences: (next: GardenPreferences) => void; t: GardenText; number: (value: number) => string;
  onExit: () => void; onNext: (level: number) => void; storageReady: boolean;
}
const formatTime = (seconds: number) => `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, '0')}`;
export default function GardenGame({ language, locale, mode, level, profile, current, transact, preferences, onPreferences, t, number, onExit, onNext, storageReady }: Props) {
  const [definition, setDefinition] = useState<WordGardenLevel | null>(null), [phase, setPhase] = useState<Phase>('loading');
  const [modal, setModal] = useState<Modal>(null), [letters, setLetters] = useState<string[]>([]), [hintReady, setHintReady] = useState(false);
  const [notice, setNotice] = useState<GardenMessageKey | null>(null), [recentWord, setRecentWord] = useState<string | null>(null);
  const [noticeWord, setNoticeWord] = useState('');
  const [reward, setReward] = useState(0), [attempt, setAttempt] = useState(0), [retry, setRetry] = useState(0);
  const phaseRef = useRef(phase), definitionRef = useRef(definition), modalRef = useRef(modal), preferencesRef = useRef(preferences);
  phaseRef.current = phase; definitionRef.current = definition; modalRef.current = modal; preferencesRef.current = preferences;
  const audio = useRef(createGardenAudio()).current, noticeTimer = useRef<ReturnType<typeof setTimeout>>(), recentTimer = useRef<ReturnType<typeof setTimeout>>();
  const onComplete = useRef(false), focusTimer = useRef<ReturnType<typeof setTimeout>>();
  const clock = useRef<(() => void) | null>(null);
  const changePhase = useCallback((next: Phase) => {
    if (phaseRef.current === 'playing' && next !== 'playing') clock.current?.();
    phaseRef.current = next; setPhase(next);
  }, []);
  const feedback = useCallback((kind: 'letter' | 'found' | 'bonus' | 'win') => {
    const options = preferencesRef.current;
    audio.play(kind, options.sound);
    if (options.haptics) void (kind === 'letter' ? hapticFeedback.light() : hapticFeedback.medium()).catch(() => {});
  }, [audio]);
  const restore = useCallback((benefits: GameReviveBenefits) => {
    const definition = definitionRef.current;
    if (!definition || phaseRef.current !== 'lost' || mode !== 'timed' || !Number.isFinite(benefits.seconds) || benefits.seconds <= 0) return;
    transact(value => !value.round || value.round.levelId !== definition.id ? value : { ...value,
      round: { ...value.round, started: true, remainingSeconds: Math.min(600, (value.round.remainingSeconds || 0) + Math.floor(benefits.seconds)) } });
    changePhase('playing');
  }, [mode, transact, changePhase]);
  const gameAds = useGameAds(WORD_GARDEN_ID, modal ? 'paused' : phase, restore);
  const blocked = phase !== 'playing' || !!modal || gameAds.waiting;
  const round = definition && profile.round?.levelId === definition.id ? profile.round : null;
  const activeRoundId = round?.levelId;

  useEffect(() => {
    const controller = new AbortController(); changePhase('loading'); onComplete.current = false;
    const saved = current.current.round;
    const savedRevision = saved && !saved.awarded && Number(saved.levelId.split(':')[3]) === level
      ? saved.levelId.split(':')[1] : current.current.revision;
    loadGardenLevel(language, level, mode, controller.signal, savedRevision).then(generated => {
      if (controller.signal.aborted) return;
      const value = generated.mode === 'timed' && generated.revision !== current.current.revision
        ? { ...generated, timeLimit: gardenTimeLimit(generated.words, generated.letters.length, generated.difficulty) } : generated;
      definitionRef.current = value; setDefinition(value); setLetters(value.letters);
      const resumed = validGardenRound(saved, value) && !saved.awarded;
      transact(profile => ({ ...profile, round: resumed ? { ...saved,
        remainingSeconds: generated.revision !== current.current.revision && saved.remainingSeconds !== null
          ? Math.min(saved.remainingSeconds, value.timeLimit!) : saved.remainingSeconds } : createGardenRound(value) }));
      changePhase(current.current.round?.remainingSeconds === 0 ? 'lost'
        : mode === 'timed' && current.current.round?.started === false ? 'ready' : 'playing');
      trackEvent('minigame_level_started', { game_id: WORD_GARDEN_ID, language, mode, level });
      focusTimer.current = setTimeout(() => document.querySelector<HTMLElement>('[data-testid="wordgarden-wheel"]')?.focus(), 50);
    }).catch(() => { if (!controller.signal.aborted) changePhase('error'); });
    return () => { controller.abort(); clearTimeout(focusTimer.current); };
  }, [language, level, mode, retry, current, transact, changePhase]);
  useEffect(() => () => { audio.close(); clearTimeout(noticeTimer.current); clearTimeout(recentTimer.current); }, [audio]);
  useEffect(() => disposeGardenWorker, []);
  useEffect(() => {
    if (!definition || blocked || !activeRoundId) return;
    let previous = performance.now();
    const flush = () => {
      const now = performance.now(), seconds = (now - previous) / 1000; previous = now;
      if (phaseRef.current !== 'playing' || seconds <= 0) return;
      transact(value => !value.round || value.round.levelId !== definition.id || value.round.awarded ? value : { ...value,
        round: { ...value.round, elapsedSeconds: value.round.elapsedSeconds + seconds,
          remainingSeconds: value.round.remainingSeconds === null ? null : Math.max(0, value.round.remainingSeconds - seconds) } });
    };
    clock.current = flush;
    const tick = () => {
      if (document.hidden || phaseRef.current !== 'playing' || modalRef.current) return;
      flush();
      const next = current.current;
      if (next.round?.remainingSeconds === 0 && !isGardenSolved(definition, next.round)) { setHintReady(false); changePhase('lost'); }
    };
    const timer = setInterval(tick, mode === 'timed' ? 250 : 1000);
    const hidden = () => { if (document.hidden && phaseRef.current === 'playing') { setHintReady(false); changePhase('paused'); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { flush(); if (clock.current === flush) clock.current = null; clearInterval(timer); document.removeEventListener('visibilitychange', hidden); };
  }, [definition, blocked, activeRoundId, current, transact, changePhase, mode]);
  useEffect(() => {
    if (!definition || !round || phase !== 'playing' || !isGardenSolved(definition, round)) return;
    const result = completeGardenLevel(current.current, definition);
    if (!result) return;
    transact(() => result.profile); setReward(result.reward); setHintReady(false); changePhase('won');
    if (!onComplete.current) {
      onComplete.current = true; feedback('win');
      trackEvent('minigame_level_won', { game_id: WORD_GARDEN_ID, language, mode, level, score: result.result.score });
    }
  }, [definition, round, phase, current, transact, changePhase, feedback, language, mode, level]);
  const back = useRef(() => {});
  back.current = () => { if (phaseRef.current === 'playing') { setHintReady(false); changePhase('paused'); } else onExit(); };
  useEffect(() => {
    const release = pushBackHandler(() => { back.current(); return true; });
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape' && !modalRef.current) { event.preventDefault(); back.current(); } };
    window.addEventListener('keydown', keyboard);
    return () => { release(); window.removeEventListener('keydown', keyboard); };
  }, []);
  const showNotice = (key: GardenMessageKey) => {
    clearTimeout(noticeTimer.current); setNotice(key);
    noticeTimer.current = setTimeout(() => setNotice(null), 1800);
  };
  const submit = (word: string) => {
    if (!definitionRef.current || phaseRef.current !== 'playing' || modalRef.current || gameAds.waiting || hintReady) return;
    clock.current?.();
    if (current.current.round?.remainingSeconds === 0) { changePhase('lost'); return; }
    const decision = submitGardenWord(current.current, definitionRef.current, word);
    setNoticeWord(word);
    if (decision.profile !== current.current) transact(() => decision.profile);
    const keys = { found: 'wordFound', bonus: 'bonusFound', already: 'alreadyFound', short: 'tooShort', invalid: 'notInDictionary' } as const;
    showNotice(keys[decision.decision]);
    if (decision.decision === 'found') {
      clearTimeout(recentTimer.current); setRecentWord(word); recentTimer.current = setTimeout(() => setRecentWord(null), 850); feedback('found');
    } else if (decision.decision === 'bonus') { showNotice(decision.reward ? 'bonusFound' : 'bonusReplayFound'); feedback('bonus'); }
  };
  const restart = () => {
    if (!definition) return;
    transact(value => ({ ...value, round: createGardenRound(definition) }));
    setLetters(definition.letters); setReward(0); setNotice(null); setHintReady(false); setRecentWord(null);
    onComplete.current = false; setAttempt(value => value + 1); gameAds.resetRound(); changePhase(mode === 'timed' ? 'ready' : 'playing');
  };
  const reveal = (key: string) => {
    if (!definition || !hintReady || blocked) return;
    clock.current?.();
    if (current.current.round?.remainingSeconds === 0) { setHintReady(false); changePhase('lost'); return; }
    const result = revealGardenHint(current.current, definition, key);
    if (result.used) { transact(() => result.profile); setHintReady(false); showNotice('hintGiven'); feedback('found'); }
  };
  const activateHint = () => {
    if (!definition || !round || blocked) return;
    if (hintReady) { setHintReady(false); return; }
    if (round.hintsUsed > 0 && profile.progress.coins < HINT_COST) { showNotice('noHintCoins'); return; }
    if (visibleGardenCells(definition, round).size === definition.cells.length) return;
    setNotice(null); setHintReady(true);
  };
  const result = useMemo(() => definition && round ? gardenResult(definition, round) : null, [definition, round]);
  const terminal = !modal && ['paused', 'won', 'lost'].includes(phase);
  const title = modal === 'settings' ? t('settings') : modal === 'help' ? t('helpTitle') : modal === 'bonus' ? t('bonusTitle')
    : phase === 'won' ? t('won') : phase === 'lost' ? t('timeUp') : t('paused');
  const remaining = round?.remainingSeconds || 0;
  const urgent = mode === 'timed' && remaining <= Math.min(10, (definition?.timeLimit || 0) * .25);

  return <div className="wg-game-root" data-testid="wordgarden-game" data-game-phase={phase} data-rack-size={letters.length}
    data-ad-block="true" data-ad-allow={gameAds.allowedPlacements}>
    <div className="wg-shell wg-game-shell">
      <header className="wg-header">
        <button type="button" className="wg-icon" aria-label={t('back')} onClick={() => back.current()}><ArrowLeft size={19} /></button>
        <div className="wg-heading"><span>{t('title')}</span><h1>{t('level', { level })}</h1></div>
        <button type="button" className="wg-wallet" onClick={() => { setHintReady(false); setModal('bonus'); }} aria-label={t('coins')}><Flower2 size={17} /><strong>{number(profile.progress.coins)}</strong></button>
        <button type="button" className="wg-icon" aria-label={t('settings')} onClick={() => { setHintReady(false); setModal('settings'); }}><Settings2 size={19} /></button>
      </header>
      {phase === 'loading' || phase === 'error' ? <div className="wg-loading"><Flower2 size={48} className={phase === 'loading' ? 'wg-loading-flower' : ''} />
        <h2>{t(phase === 'loading' ? 'loading' : 'loadError')}</h2>{phase === 'error' && <button type="button" className="wg-primary" onClick={() => setRetry(value => value + 1)}>{t('retry')}</button>}
        <button type="button" className="wg-secondary" onClick={onExit}>{t('back')}</button></div> : definition && round && <>
        <div className="wg-game-metrics">
          <div className="wg-progress-label"><BookOpen size={17} /><div><strong>{t('wordsProgress', { found: round.found.length, total: definition.words.length })}</strong><span>{t(`difficulty${definition.difficulty}`)}</span></div></div>
          <div className={`wg-clock ${urgent ? 'wg-time-warning' : ''}`} data-testid="wordgarden-timer">
            {mode === 'timed' ? <Clock3 size={18} /> : <Leaf size={18} />}<div><strong>{mode === 'timed' ? formatTime(remaining) : t('calm')}</strong><small>{t(mode === 'timed' ? 'timeLeft' : 'noRush')}</small></div>
          </div>
          <div className="wg-game-progress" role="progressbar" aria-label={t('foundWords')} aria-valuemin={0} aria-valuemax={definition.words.length} aria-valuenow={round.found.length}>
            <i style={{ width: `${round.found.length / definition.words.length * 100}%` }} />
          </div>
          {mode === 'timed' && <div className={`wg-timer-track ${urgent ? 'is-urgent' : ''}`} aria-hidden="true"><i style={{ width: `${Math.min(100, remaining / definition.timeLimit! * 100)}%` }} /></div>}
        </div>
        <div className="wg-game-stage">
          <section className="wg-board-panel" aria-label={t('boardLabel')}>
            <div className="wg-board-caption"><span><Sparkles size={14} />{t('boardTitle')}</span><small>{t('languageShort')}</small></div>
            <CrosswordBoard level={definition} round={round} locale={locale} t={t} disabled={blocked} hintReady={hintReady && !blocked} onHint={reveal} recentWord={recentWord} />
          </section>
          <section className="wg-input-panel" aria-label={t('wheelLabel')} data-feedback={notice || ''}>
            <div className={`wg-notice ${hintReady ? 'is-hint' : ''} ${notice === 'wordFound' || notice === 'bonusFound' ? 'is-positive' : ''}`} role="status" aria-live="polite">{hintReady ? t('hintReady') : notice ? t(notice, { count: HINT_COST, word: displayGardenWord(noticeWord, locale) }) : <><Leaf size={12} />{t('drawShort')}</>}</div>
            <LetterWheel letters={letters} locale={locale} t={t} disabled={blocked || hintReady} resetKey={`${definition.id}:${attempt}`}
              onPick={() => feedback('letter')} onSubmit={submit} onShuffle={() => setLetters(value => shuffleLetters(value, gardenRandom(Date.now())))} />
          </section>
          {phase === 'ready' && <div className="wg-ready-overlay"><div><Clock3 size={28} /><h2>{t('readyTitle')}</h2><p>{t('readyDescription', { count: definition.timeLimit! })}</p>
            <button type="button" className="wg-primary" onClick={() => {
              transact(value => value.round ? { ...value, round: { ...value.round, started: true } } : value); changePhase('playing');
            }}><Play size={17} />{t('startTimed')}</button></div></div>}
        </div>
        <footer className="wg-game-tools">
          <button type="button" disabled={blocked} className={`wg-tool ${hintReady ? 'is-active' : ''}`} onClick={activateHint}>
            <Lightbulb size={20} /><span>{t(hintReady ? 'cancelHint' : 'hint')}<small>{round.hintsUsed === 0 ? t('freeHint') : t('hintPrice', { count: HINT_COST })}</small></span>
          </button>
          <button type="button" disabled={blocked} className="wg-tool" onClick={() => { setHintReady(false); setModal('bonus'); }}><Gift size={20} /><span>{t('bonusShort')}<small>{t('bonusCount', { count: round.bonus.length })}</small></span></button>
          <button type="button" disabled={blocked} className="wg-tool" onClick={() => { setHintReady(false); changePhase('paused'); }}><Pause size={20} /><span>{t('pauseAction')}<small>{t('savedShort')}</small></span></button>
        </footer>
        {!storageReady && <p className="wg-storage-warning" role="status">{t('storageError')}</p>}
      </>}
    </div>
    {(modal || terminal) && <GardenDialog title={title} closeLabel={t('close')} allowedPlacements={modal ? '' : gameAds.allowedPlacements}
      onClose={() => { if (modal) setModal(null); else if (phase === 'paused') changePhase('playing'); else void gameAds.transition(onExit); }} className={phase === 'won' && !modal ? 'wg-won-modal' : ''}>
      {modal === 'settings' && <GardenSettings preferences={preferences} onChange={onPreferences} t={t} />}
      {modal === 'help' && <GardenHelp t={t} />}
      {modal === 'bonus' && <><p>{t('bonusDescription')}</p><div className="wg-bonus-words">{round?.bonus.length ? round.bonus.map(word => <span key={word}>{displayGardenWord(word, locale)}<Check size={12} /></span>) : <div className="wg-bonus-empty"><Flower2 size={36} /><p>{t('bonusEmpty')}</p></div>}</div>
        {definition && <p className="wg-muted">{t('bonusAvailable', { count: definition.bonusWords.length })}</p>}</>}
      {!modal && phase === 'paused' && <><div className="wg-modal-emblem"><Pause size={30} /></div><p>{t('pausedDescription')}</p><div className="wg-modal-actions">
        <button data-autofocus type="button" className="wg-primary" onClick={() => changePhase('playing')}><Play size={17} />{t('resume')}</button>
        <button type="button" className="wg-secondary" onClick={onExit}><Home size={17} />{t('exitLevel')}</button>
        <button type="button" className="wg-text-button" onClick={() => setModal('help')}><HelpCircle size={16} />{t('help')}</button></div></>}
      {!modal && phase === 'won' && result && <><div className="wg-victory-flower"><Flower2 size={50} /></div><p>{t('wonDescription')}</p>
        <div className="wg-stars" aria-label={t('stars', { count: result.stars })}>{[1, 2, 3].map(star => <Star key={star} size={38} fill={star <= result.stars ? 'currentColor' : 'none'} className={star <= result.stars ? 'is-earned' : ''} />)}</div>
        <div className="wg-result-metrics"><div><strong>{number(result.score)}</strong><span>{t('score')}</span></div><div><strong>+{number(reward)}</strong><span>{t('coins')}</span></div><div><strong>{number(result.bonusWords)}</strong><span>{t('bonusWords')}</span></div></div>
        <div className="wg-solved-words">{definition?.words.map(word => <span key={word.id} title={word.definition}>{displayGardenWord(word.word, locale)}</span>)}</div>
        <p className="wg-muted">{round?.hintsUsed ? t('hintsUsed', { count: round.hintsUsed }) : t('noHints')}</p>
        <div className="wg-modal-actions"><button data-autofocus type="button" className="wg-primary" disabled={gameAds.waiting} onClick={() => { void gameAds.transition(() => onNext(level + 1)); }}><Play size={17} />{t('nextLevel')}</button>
          <button type="button" className="wg-secondary" disabled={gameAds.waiting} onClick={() => { void gameAds.transition(onExit); }}><Home size={17} />{t('exitLevel')}</button></div></>}
      {!modal && phase === 'lost' && <><div className="wg-modal-emblem"><RotateCcw size={30} /></div><p>{t('timeUpDescription')}</p><div className="wg-modal-actions">
        <button type="button" data-autofocus className="wg-primary" disabled={gameAds.waiting} onClick={() => { void gameAds.transition(restart); }}><RotateCcw size={17} />{t('replay')}</button>
        <GameReviveAction ads={{ ...gameAds, canOffer: gameAds.canOffer && gameAds.benefits.seconds > 0 }} game="basket" labels={{ action: t(gameAds.premium ? 'revivePremium' : 'reviveVideo', { count: gameAds.benefits.seconds }),
          note: t('reviveNote'), failed: t('reviveFailed'), unavailable: t('reviveUnavailable') }} />
        <button type="button" className="wg-secondary" disabled={gameAds.waiting} onClick={() => { void gameAds.transition(onExit); }}><Home size={17} />{t('exitLevel')}</button></div></>}
    </GardenDialog>}
  </div>;
}
