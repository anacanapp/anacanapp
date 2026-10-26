import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft, ChevronRight, HeartHandshake, HelpCircle, Home, Lightbulb, LockKeyhole, Pause, Play, RotateCcw, Settings2, Star, Undo2, Volume2, Vibrate } from 'lucide-react';
import { pushBackHandler } from '@/lib/backButton';
import { hapticFeedback } from '@/lib/native';
import { trackEvent, useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useGameAds } from '@/hooks/useGameAds';
import { writeStorageItem } from '@/lib/local-storage';
import { createGardenAudio } from '../word-garden/audio';
import { friendsLevel } from './levels';
import { FRIEND_NAMES, FRIEND_DIRECTIONS, TWO_FRIENDS_ID, TWO_FRIENDS_LEVELS, type FriendDirection, type FriendsPreferences, type FriendsProfile } from './model';
import { friendsSolved, moveFriends, replayFriends } from './engine';
import { completeFriendsLevel, createFriendsRound, FRIENDS_HINT_LIMIT, FRIENDS_PATH_LIMIT, FRIENDS_PREFERENCES_KEY, friendsResult, readFriendsProfile, writeFriendsProfile } from './state';
import { useFriendsText, type FriendsText } from './useFriendsText';
import type { FriendsMessageKey } from './messages';
import { requestFriendsHint } from './hints';
import FriendsBoard from './FriendsBoard';
import { FRIENDS_ART, FRIENDS_BRAND } from './art';
import FriendsDialog from './FriendsDialog';
import './two-friends.css';

const DIRECTION_ICONS = { up: ArrowUp, right: ArrowRight, down: ArrowDown, left: ArrowLeft };
const KEY_DIRECTIONS: Record<string, FriendDirection> = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' };
type Modal = 'pause' | 'help' | 'settings' | 'restart' | null;
function readPreferences(): FriendsPreferences {
  try { const value = JSON.parse(localStorage.getItem(FRIENDS_PREFERENCES_KEY) || 'null'); return { sound: value?.sound === true, haptics: value?.haptics !== false }; }
  catch { return { sound: false, haptics: true }; }
}
function Rules({ t }: { t: FriendsText }) {
  return <ol className="tf-rules">{(['helpMove', 'helpWalls', 'helpKeys', 'helpPlates', 'helpHome'] as const).map((key, i) => <li key={key}><span>{i + 1}</span><p>{t(key)}</p></li>)}</ol>;
}
export default function TwoFriends({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('TwoFriends', 'MiniGames');
  const { t, number, language, dir } = useFriendsText();
  const [profile, setProfile] = useState(readFriendsProfile), current = useRef(profile); current.current = profile;
  const [levelNumber, setLevelNumber] = useState<number | null>(null), [chapter, setChapter] = useState(() => Math.ceil(profile.progress.unlocked / 8));
  const [modal, setModal] = useState<Modal>(null), [preferences, setPreferences] = useState(readPreferences), [storageReady, setStorageReady] = useState(true);
  const [notice, setNotice] = useState<FriendsMessageKey | null>(null), [hint, setHint] = useState<FriendDirection | null>(null), [hintBusy, setHintBusy] = useState(false);
  const audio = useRef(createGardenAudio()).current, sound = useRef(preferences); sound.current = preferences;
  const hintController = useRef<AbortController | null>(null), movementTime = useRef(-Infinity);
  const definition = levelNumber === null ? null : friendsLevel(levelNumber);
  const round = definition && profile.round?.level === definition.level ? profile.round : null;
  const replay = useMemo(() => definition && round ? replayFriends(definition, round.path) : null, [definition, round]);
  const won = !!definition && !!replay && !replay.lost && friendsSolved(definition, replay.state);
  const phase = !definition ? 'menu' : modal ? 'paused' : replay?.lost ? 'lost' : won ? 'won' : 'playing';
  const gameAds = useGameAds(TWO_FRIENDS_ID, phase, () => {});
  const latest = useRef({ definition, round, replay, phase, hintBusy, waiting: gameAds.waiting, modal });
  latest.current = { definition, round, replay, phase, hintBusy, waiting: gameAds.waiting, modal };
  const transact = useCallback((update: (value: FriendsProfile) => FriendsProfile) => {
    const next = update(current.current); if (next === current.current) return;
    current.current = next; setProfile(next); setStorageReady(writeFriendsProfile(next));
  }, []);
  const feedback = useCallback((kind: 'letter' | 'found' | 'win') => {
    audio.play(kind, sound.current.sound);
    if (sound.current.haptics) void (kind === 'letter' ? hapticFeedback.light() : hapticFeedback.medium()).catch(() => {});
  }, [audio]);
  const cancelHint = useCallback(() => { hintController.current?.abort(); hintController.current = null; setHintBusy(false); setHint(null); }, []);
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; audio.close(); hintController.current?.abort(); };
  }, [audio]);
  useEffect(() => {
    if (!definition || !round || !won || round.awarded || current.current.round?.awarded) return;
    transact(value => completeFriendsLevel(value, definition)); feedback('win');
    trackEvent('minigame_level_won', { game_id: TWO_FRIENDS_ID, level: definition.level, score: friendsResult(definition, round).score });
  }, [definition, round, won, transact, feedback]);
  const back = useRef(() => {});
  back.current = () => { cancelHint(); if (latest.current.definition) { if (latest.current.phase === 'playing') setModal('pause'); else { setModal(null); setLevelNumber(null); } } else onBack(); };
  const direction = useCallback((value: FriendDirection) => {
    const snapshot = latest.current;
    if (!snapshot.definition || !snapshot.round || !snapshot.replay || snapshot.phase !== 'playing' || snapshot.waiting || snapshot.hintBusy) return;
    const now = performance.now(); if (now - movementTime.current < 135) return; movementTime.current = now;
    const move = moveFriends(snapshot.definition, snapshot.replay.state, value);
    if (!move.changed) { setNotice('blocked'); return; }
    if (snapshot.round.path.length >= FRIENDS_PATH_LIMIT) { setNotice('hintNone'); return; }
    setHint(null); setNotice(move.collectedKeys ? 'keyFound' : move.openedDoors ? 'gateOpen' : null);
    transact(profile => !profile.round ? profile : { ...profile, round: { ...profile.round, path: [...profile.round.path, value], moves: profile.round.moves + 1 } });
    feedback(move.collectedKeys || move.openedDoors ? 'found' : 'letter');
  }, [transact, feedback]);
  const directionRef = useRef(direction); directionRef.current = direction;
  useEffect(() => {
    const release = pushBackHandler(() => { if (latest.current.modal) return false; back.current(); return true; });
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.target instanceof HTMLElement && event.target.matches('input,textarea,[contenteditable=true]')) return;
      const value = KEY_DIRECTIONS[event.key];
      if (value && latest.current.phase === 'playing') { event.preventDefault(); directionRef.current(value); }
      if (event.key === 'Escape' && !latest.current.modal) { event.preventDefault(); back.current(); }
    };
    const visibility = () => { if (document.hidden && latest.current.phase === 'playing') { cancelHint(); setModal('pause'); } };
    window.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility);
    return () => { release(); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); };
  }, [cancelHint]);
  const start = (level: number) => {
    if (level < 1 || level > current.current.progress.unlocked) return;
    cancelHint(); setNotice(null); setModal(null); movementTime.current = -Infinity;
    if (current.current.round?.level !== level || current.current.round.awarded) transact(value => ({ ...value, round: createFriendsRound(level) }));
    setLevelNumber(level); gameAds.resetRound();
    trackEvent('minigame_level_started', { game_id: TWO_FRIENDS_ID, level });
  };
  const restart = () => { cancelHint(); setNotice(null); setModal(null); if (levelNumber !== null) transact(value => ({ ...value, round: createFriendsRound(levelNumber) })); gameAds.resetRound(); movementTime.current = -Infinity; };
  const undo = () => {
    if (!current.current.round?.path.length || won || gameAds.waiting) return;
    cancelHint(); setNotice(null); movementTime.current = -Infinity;
    transact(value => ({ ...value, round: { ...value.round!, path: value.round!.path.slice(0, -1), undos: value.round!.undos + 1 } })); feedback('letter');
  };
  const requestHint = async () => {
    if (!definition || !round || !replay || phase !== 'playing' || gameAds.waiting || hintBusy) return;
    if (round.hints >= FRIENDS_HINT_LIMIT) { setNotice('hintEmpty'); return; }
    const controller = new AbortController(), path = round.path;
    hintController.current?.abort(); hintController.current = controller; setHintBusy(true); setNotice(null);
    try {
      const found = await requestFriendsHint(definition, replay.state, controller.signal);
      if (controller.signal.aborted || current.current.round?.path !== path || latest.current.phase !== 'playing') return;
      if (found) { setHint(found); transact(value => ({ ...value, round: { ...value.round!, hints: value.round!.hints + 1 } })); }
      else setNotice('hintNone');
    } catch { if (!controller.signal.aborted) setNotice('hintNone'); }
    finally { if (hintController.current === controller) { hintController.current = null; setHintBusy(false); } }
  };
  const setPreference = (key: keyof FriendsPreferences) => {
    const next = { ...preferences, [key]: !preferences[key] }; setPreferences(next);
    try { writeStorageItem(localStorage, FRIENDS_PREFERENCES_KEY, JSON.stringify(next)); } catch { /* optional settings remain in memory */ }
  };
  const result = definition && round ? friendsResult(definition, round) : null;
  const savedLevel = profile.round && !profile.round.awarded ? profile.round.level : profile.progress.unlocked;
  const overlayTitle = modal ? t(modal === 'pause' ? 'pause' : modal === 'restart' ? 'restart' : modal) : t(won ? 'won' : 'lost');
  return createPortal(<div className="tf-screen" lang={language} dir={dir} data-testid="two-friends-screen" data-game-id={TWO_FRIENDS_ID} data-game-phase={phase}
    data-friends-level={levelNumber || undefined} data-friends-moves={round?.moves || 0} data-ad-block="true" data-ad-allow={gameAds.allowedPlacements}>
    <div className="tf-landscape" aria-hidden="true"><i /><i /><i /><span>✦</span></div>
    <div className="tf-shell">
      <header className="tf-header"><button type="button" className="tf-icon" aria-label={t('back')} onClick={() => back.current()}><ArrowLeft className="tf-back-arrow" size={20} /></button>
        <div><span>{definition ? t('title') : FRIENDS_BRAND}</span><h1>{definition ? t('level', { level: definition.level }) : t('title')}</h1></div>
        <button type="button" className="tf-icon" aria-label={t('settings')} onClick={() => { cancelHint(); setModal('settings'); }}><Settings2 size={20} /></button>
      </header>
      {!definition ? <div className="tf-lobby">
        <section className="tf-hero"><span className="tf-eyebrow"><HeartHandshake size={14} />{t('tagline')}</span><h2>{t('title')}</h2>
          <div className="tf-hero-friends" aria-hidden="true"><div><img src={FRIENDS_ART[0]} width="512" height="512" alt="" /><span>{FRIEND_NAMES[0]}</span></div><HeartHandshake size={28} /><div><img src={FRIENDS_ART[1]} width="512" height="512" alt="" /><span>{FRIEND_NAMES[1]}</span></div></div>
          <p>{t('card')}</p><button type="button" className="tf-primary tf-play" onClick={() => start(savedLevel)}><Play size={18} fill="currentColor" /><span>{t(profile.round && !profile.round.awarded ? 'resume' : 'play')}</span><small>{t('level', { level: savedLevel })}<ArrowRight size={16} /></small></button>
        </section>
        <section className="tf-level-panel"><div className="tf-chapter"><button type="button" className="tf-icon" aria-label={t('back')} disabled={chapter === 1} onClick={() => setChapter(value => value - 1)}><ChevronLeft className="rtl:rotate-180" size={19} /></button>
          <div><span>{number(chapter)} / {number(5)}</span><h3>{t(`chapter${chapter}` as FriendsMessageKey)}</h3></div>
          <button type="button" className="tf-icon" aria-label={t('next')} disabled={chapter === 5} onClick={() => setChapter(value => value + 1)}><ChevronRight className="rtl:rotate-180" size={19} /></button></div>
          <div className="tf-levels">{Array.from({ length: 8 }, (_, index) => (chapter - 1) * 8 + index + 1).map(level => {
            const unlocked = level <= profile.progress.unlocked, completed = profile.progress.levels[String(level)];
            return <button type="button" key={level} data-friends-level-button={level} aria-label={t('level', { level })} disabled={!unlocked}
              className={completed ? 'is-complete' : level === profile.progress.unlocked ? 'is-current' : ''} onClick={() => start(level)}>
              {unlocked ? <strong>{number(level)}</strong> : <LockKeyhole size={19} />}
              <span>{completed ? [1, 2, 3].map(star => <Star size={9} key={star} fill={star <= completed.stars ? 'currentColor' : 'none'} />) : <Home size={12} />}</span>
            </button>;
          })}</div>
        </section>
        <div className="tf-lobby-bottom"><button type="button" className="tf-secondary" onClick={() => setModal('help')}><HelpCircle size={16} />{t('help')}</button><p>{t(storageReady ? 'saved' : 'storage')}</p></div>
      </div> : round && replay && <>
        <div className="tf-status"><span><HeartHandshake size={16} />{t(definition.control)}</span><strong>{number(round.moves)}<small>{t('moves')}</small></strong></div>
        <FriendsBoard level={definition} state={replay.state} t={t} number={number} disabled={phase !== 'playing' || hintBusy || gameAds.waiting} onDirection={direction} />
        <div className="tf-game-dock"><div className={`tf-notice ${hint ? 'is-hint' : ''}`} role="status" aria-live="polite">{hintBusy ? t('hintBusy') : hint ? <><Lightbulb size={15} />{t(hint)}</> : notice ? t(notice) : t('instruction')}</div>
          <div className="tf-controls" dir="ltr"><div className="tf-control-note"><img src={FRIENDS_ART[0]} alt="" width="44" height="44" /><span>{FRIEND_NAMES[0]}</span><small>{t('same')}</small></div>
            <div className="tf-dpad" role="group" aria-label={t('instruction')}>{FRIEND_DIRECTIONS.map(value => { const Icon = DIRECTION_ICONS[value]; return <button type="button" key={value} className={`tf-direction tf-direction-${value} ${hint === value ? 'is-hint' : ''}`} aria-label={t(value)} data-friends-direction={value}
              disabled={phase !== 'playing' || hintBusy || gameAds.waiting} onClick={() => direction(value)}><Icon size={23} /></button>; })}<span><HeartHandshake size={16} /></span></div>
            <div className="tf-control-note"><img src={FRIENDS_ART[1]} alt="" width="44" height="44" /><span>{FRIEND_NAMES[1]}</span><small>{t(definition.control)}</small></div></div>
          <div className="tf-tools"><button type="button" disabled={!round.path.length || won || gameAds.waiting || !!modal} onClick={undo}><Undo2 size={17} /><span>{t('undo')}</span></button>
            <button type="button" disabled={phase !== 'playing' || hintBusy || gameAds.waiting} onClick={() => void requestHint()}><Lightbulb size={17} /><span>{t('hint')}<small>{number(FRIENDS_HINT_LIMIT - round.hints)}</small></span></button>
            <button type="button" disabled={phase !== 'playing' || gameAds.waiting} onClick={() => { cancelHint(); setModal('pause'); }}><Pause size={17} /><span>{t('pause')}</span></button>
          </div>
          {!storageReady && <p className="tf-storage-note" role="status">{t('storage')}</p>}
        </div>
      </>}
    </div>
    {(modal || definition && (won || replay?.lost)) && <FriendsDialog title={overlayTitle} closeLabel={t('close')} allowedPlacements={modal ? '' : gameAds.allowedPlacements} onClose={() => { if (modal) setModal(null); else { cancelHint(); setLevelNumber(null); } }}>
      {modal === 'help' && <Rules t={t} />}
      {modal === 'settings' && <div className="tf-settings">{(['sound', 'haptics'] as const).map(key => { const Icon = key === 'sound' ? Volume2 : Vibrate; return <button type="button" key={key} role="switch" aria-checked={preferences[key]} onClick={() => setPreference(key)}><Icon size={19} /><span>{t(key)}</span><i>{preferences[key] && <Check size={14} />}</i></button>; })}</div>}
      {modal === 'pause' && <><p>{t('saved')}</p><div className="tf-modal-actions"><button type="button" className="tf-primary" data-autofocus onClick={() => setModal(null)}><Play size={17} />{t('resume')}</button>
        <button type="button" className="tf-secondary" onClick={() => setModal('restart')}><RotateCcw size={16} />{t('restart')}</button>
        <button type="button" className="tf-secondary" onClick={() => { setModal(null); setLevelNumber(null); }}><Home size={16} />{t('back')}</button>
        <button type="button" className="tf-text" onClick={() => setModal('help')}>{t('help')}</button></div></>}
      {modal === 'restart' && <div className="tf-modal-actions"><button type="button" className="tf-primary" data-autofocus onClick={restart}><RotateCcw size={17} />{t('restart')}</button><button type="button" className="tf-secondary" onClick={() => setModal(null)}>{t('resume')}</button></div>}
      {!modal && won && result && <><div className="tf-win-friends"><img src={FRIENDS_ART[0]} alt="" width="92" height="92" /><HeartHandshake size={27} /><img src={FRIENDS_ART[1]} alt="" width="92" height="92" /></div><p>{t('wonDesc')}</p>
        <div className="tf-stars" aria-label={t('stars', { count: result.stars })}>{[1, 2, 3].map(star => <Star key={star} size={31} fill={star <= result.stars ? 'currentColor' : 'none'} />)}</div>
        <div className="tf-result"><strong>{number(result.score)}<small>{t('score')}</small></strong><strong>{number(round!.moves)}<small>{t('moves')}</small></strong></div>
        <p className="tf-par">{t('par', { count: definition!.par })}</p><div className="tf-modal-actions"><button type="button" className="tf-primary" data-autofocus disabled={gameAds.waiting} onClick={() => void gameAds.transition(() => { if (levelNumber! < TWO_FRIENDS_LEVELS) start(levelNumber! + 1); else setLevelNumber(null); })}><Play size={17} />{t(levelNumber === TWO_FRIENDS_LEVELS ? 'allDone' : 'next')}</button>
          <button type="button" className="tf-secondary" disabled={gameAds.waiting} onClick={() => void gameAds.transition(() => setLevelNumber(null))}>{t('back')}</button></div></>}
      {!modal && replay?.lost && <><p>{t('lostDesc')}</p><div className="tf-modal-actions"><button type="button" className="tf-primary" data-autofocus onClick={undo}><Undo2 size={17} />{t('undo')}</button>
        <button type="button" className="tf-secondary" disabled={gameAds.waiting} onClick={() => void gameAds.transition(restart)}><RotateCcw size={17} />{t('restart')}</button></div></>}
    </FriendsDialog>}
  </div>, document.body);
}
