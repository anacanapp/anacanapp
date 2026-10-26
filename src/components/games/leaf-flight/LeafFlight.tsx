import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, ArrowUp, Heart, HelpCircle, Leaf, Pause, Play, RotateCcw, Star, Wind } from 'lucide-react';
import { pushBackHandler } from '@/lib/backButton';
import { hapticFeedback } from '@/lib/native';
import { useGameAds } from '@/hooks/useGameAds';
import { trackEvent, useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useCasualText } from '../casual/useCasualText';
import { readCasualProfile, recordCasualWin, writeCasualProfile, type CasualProfile } from '../casual/storage';
import GameLobby from '../casual/GameLobby';
import GameDialog from '../casual/GameDialog';
import { createFlightState, advanceFlight, flightLevel, flightResult, validFlightState } from './engine';
import { LEAF_FLIGHT_ID, LEAF_FLIGHT_LEVELS, LEAF_FLIGHT_REVISION, type FlightState } from './model';
import FlightCanvas from './FlightCanvas';
import { CASUAL_BRAND } from '../casual/art';
import tumurcuq from '@/assets/onboarding/pregnancy-mode.webp';
import '../casual/casual.css';
import './leaf-flight.css';

function validSavedRound(value: unknown): value is FlightState {
  try { const level = (value as FlightState)?.level; return validFlightState(value, flightLevel(level)); } catch { return false; }
}
export default function LeafFlight({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('LeafFlight', 'MiniGames');
  const { t, number, language, dir } = useCasualText();
  const [profile, setProfile] = useState(() => readCasualProfile(LEAF_FLIGHT_ID, LEAF_FLIGHT_REVISION, LEAF_FLIGHT_LEVELS, validSavedRound));
  const profileRef = useRef(profile); profileRef.current = profile;
  const [levelNumber, setLevelNumber] = useState<number | null>(null), [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'won' | 'lost'>('ready');
  const [help, setHelp] = useState(false), [view, setView] = useState<FlightState | null>(null), [pressed, setPressed] = useState(false), [storageReady, setStorageReady] = useState(true);
  const round = useRef<FlightState | null>(null), lifting = useRef(false), pointer = useRef<number | null>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const definition = useMemo(() => levelNumber === null ? null : flightLevel(levelNumber), [levelNumber]);
  const helpRef = useRef(help); helpRef.current = help;
  const gameAds = useGameAds(LEAF_FLIGHT_ID, help ? 'paused' : levelNumber === null ? 'menu' : phase, () => {});
  const waiting = useRef(gameAds.waiting); waiting.current = gameAds.waiting;
  const commit = useCallback((next: CasualProfile<FlightState>) => { profileRef.current = next; setProfile(next); setStorageReady(writeCasualProfile(next)); }, []);
  const release = useCallback(() => { pointer.current = null; lifting.current = false; setPressed(false); }, []);
  const save = useCallback(() => { if (round.current && !round.current.won) commit({ ...profileRef.current, round: round.current }); }, [commit]);
  const pause = useCallback(() => { release(); if (phaseRef.current === 'playing') { phaseRef.current = 'paused'; setPhase('paused'); save(); } }, [release, save]);
  const back = useRef(() => {}); back.current = () => { if (levelNumber === null) onBack(); else if (phaseRef.current === 'playing') pause(); else { save(); release(); setLevelNumber(null); } };
  useEffect(() => {
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const releaseBack = pushBackHandler(() => { if (helpRef.current) return false; back.current(); return true; });
    return () => { document.body.style.overflow = overflow; releaseBack(); save(); };
  }, [save]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) pause(); }, blur = () => { release(); pause(); };
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !help) { event.preventDefault(); back.current(); return; }
      if (phaseRef.current !== 'playing' || help || event.ctrlKey || event.metaKey || event.altKey) return;
      if ([' ', 'ArrowUp', 'w'].includes(event.key)) { event.preventDefault(); lifting.current = true; setPressed(true); }
    };
    const up = (event: KeyboardEvent) => { if ([' ', 'ArrowUp', 'w'].includes(event.key)) release(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('blur', blur); window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blur); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [pause, release, help]);
  useEffect(() => {
    if (!definition || phase !== 'playing' || help) return;
    let frame = 0, previous = performance.now(), carry = 0, painted = previous, saved = previous;
    const tick = (now: number) => {
      const elapsed = (now - previous) / 1000; previous = now;
      if (!round.current || document.hidden || waiting.current || phaseRef.current !== 'playing') { frame = requestAnimationFrame(tick); return; }
      const before = round.current, result = advanceFlight(definition, before, lifting.current, elapsed, carry); carry = result.carry; round.current = result.state;
      if (before.hearts !== result.state.hearts) void hapticFeedback.medium().catch(() => {});
      if (now - painted >= 100 || result.state.won || result.state.lost) { painted = now; setView(result.state); }
      if (now - saved >= 2000) { saved = now; save(); }
      if (result.state.won || result.state.lost) {
        release(); phaseRef.current = result.state.won ? 'won' : 'lost'; setPhase(phaseRef.current);
        if (result.state.won) { commit(recordCasualWin(profileRef.current, definition.level, LEAF_FLIGHT_LEVELS, flightResult(definition, result.state)));
          trackEvent('minigame_level_won', { game_id: LEAF_FLIGHT_ID, level: definition.level, score: flightResult(definition, result.state).score }); }
        else { save(); trackEvent('minigame_level_lost', { game_id: LEAF_FLIGHT_ID, level: definition.level }); }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => { cancelAnimationFrame(frame); save(); };
  }, [definition, phase, help, save, commit, release]);
  const start = (level: number) => {
    if (level < 1 || level > profileRef.current.unlocked) return;
    release(); setHelp(false); gameAds.resetRound(); const saved = profileRef.current.round;
    round.current = saved?.level === level && validFlightState(saved, flightLevel(level)) && !saved.won ? saved : createFlightState(level);
    setView(round.current); setLevelNumber(level); phaseRef.current = round.current.lost ? 'lost' : 'ready'; setPhase(phaseRef.current);
    commit({ ...profileRef.current, round: round.current });
  };
  const play = () => { release(); phaseRef.current = 'playing'; setPhase('playing'); trackEvent('minigame_level_started', { game_id: LEAF_FLIGHT_ID, level: levelNumber }); };
  const restart = () => { if (levelNumber === null) return; release(); round.current = createFlightState(levelNumber); setView(round.current); commit({ ...profileRef.current, round: round.current }); phaseRef.current = 'ready'; setPhase('ready'); gameAds.resetRound(); };
  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    if (phaseRef.current !== 'playing' || help || waiting.current || pointer.current !== null || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); lifting.current = true; setPressed(true);
  };
  const pointerUp = (event: PointerEvent<HTMLElement>) => { if (pointer.current === event.pointerId) release(); };
  const result = definition && view?.won ? flightResult(definition, view) : null;
  const modal = levelNumber !== null && phase !== 'playing';
  const title = help ? t('help') : phase === 'won' ? t('flightWon') : phase === 'lost' ? t('flightLost') : phase === 'ready' ? t('flightTitle') : t('pause');
  return createPortal(<div className="cg-screen flight-screen" lang={language} dir={dir} data-testid="leaf-flight-screen" data-game-id={LEAF_FLIGHT_ID} data-game-phase={levelNumber === null ? 'menu' : phase} data-ad-block="true" data-ad-allow={gameAds.allowedPlacements}>
    <div className="cg-shell"><header className="cg-header"><button type="button" className="cg-icon" aria-label={t('back')} onClick={() => back.current()}><ArrowLeft className="cg-back-arrow" size={20} /></button>
      <div><span>{levelNumber === null ? CASUAL_BRAND : t('flightTitle')}</span><h1>{levelNumber === null ? t('flightTitle') : t('level', { level: levelNumber })}</h1></div>
      <button type="button" className="cg-icon" aria-label={t('help')} onClick={() => { pause(); setHelp(true); }}><HelpCircle size={19} /></button></header>
      {definition && view ? <><div className="flight-metrics"><span className="flight-hearts" aria-label={number(view.hearts)}>{[1, 2, 3].map(heart => <Heart key={heart} size={17} fill={heart <= view.hearts ? 'currentColor' : 'none'} />)}</span><span><Star size={16} />{number(view.collected.length)} / {number(definition.stars.length)}</span>
        <strong>{number(Math.min(100, Math.floor(view.distance / definition.distance * 100)))}%</strong></div>
        <div className="flight-stage" data-flight-y={view.y.toFixed(2)} data-flight-velocity={view.velocity.toFixed(2)} data-flight-distance={view.distance.toFixed(2)} data-flight-time={view.time.toFixed(3)}
          onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={release} onLostPointerCapture={release}>
          <FlightCanvas level={definition} state={round} lifting={lifting} label={t('flightGuide')} />
          <div className="flight-route-label"><Leaf size={13} />{t((['flightTitle', 'wind', 'narrow', 'moving', 'secret'] as const)[definition.chapter - 1])}</div>
        </div>
        <div className="flight-controls"><button type="button" className="cg-icon" aria-label={t('pause')} disabled={phase !== 'playing'} onClick={pause}><Pause size={19} /></button>
          <button type="button" className={`flight-lift ${pressed ? 'is-held' : ''}`} disabled={phase !== 'playing' || gameAds.waiting} aria-label={t('lift')} aria-pressed={pressed}
            onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={release} onLostPointerCapture={release}><ArrowUp size={21} /><span>{t('lift')}<small>{t('release')}</small></span><Wind size={18} /></button></div>
        {!storageReady && <p className="cg-save-note">{t('storage')}</p>}
      </> : <GameLobby title={t('flightTitle')} description={t('flightCard')} image={tumurcuq} count={LEAF_FLIGHT_LEVELS} profile={profile}
        savedLevel={profile.round && !profile.round.won ? profile.round.level : null} t={t} number={number} onPlay={start} />}
    </div>
    {(help || modal) && <GameDialog title={title} closeLabel={t('close')} allowedPlacements={help ? '' : gameAds.allowedPlacements} onClose={() => { if (help) setHelp(false); else if (phase === 'paused') play(); else { save(); setLevelNumber(null); } }}>
      {help ? <p>{t('flightGuide')}</p> : phase === 'ready' ? <><div className="flight-intro-art"><Leaf size={34} /><img src={tumurcuq} alt="" width="78" height="78" /></div><p>{t('flightGuide')}</p><div className="cg-modal-actions"><button type="button" data-autofocus className="cg-primary" onClick={play}><Play size={17} />{t('play')}</button></div></>
        : phase === 'won' && result ? <><div className="cg-stars" aria-label={t('stars', { count: result.stars })}>{[1, 2, 3].map(star => <Star key={star} size={32} fill={star <= result.stars ? 'currentColor' : 'none'} />)}</div><p>{t('starCount', { count: result.collected })}</p><div className="cg-score">{number(result.score)}<small>{t('score')}</small></div>
          <div className="cg-modal-actions"><button type="button" data-autofocus className="cg-primary" disabled={gameAds.waiting} onClick={() => void gameAds.transition(() => levelNumber! < LEAF_FLIGHT_LEVELS ? start(levelNumber! + 1) : setLevelNumber(null))}>{t(levelNumber === LEAF_FLIGHT_LEVELS ? 'back' : 'next')}</button><button type="button" className="cg-secondary" onClick={() => void gameAds.transition(() => setLevelNumber(null))}>{t('back')}</button></div></>
          : phase === 'lost' ? <><p>{t('flightGuide')}</p><div className="cg-modal-actions"><button type="button" className="cg-primary" data-autofocus onClick={() => void gameAds.transition(restart)}><RotateCcw size={17} />{t('restart')}</button><button type="button" className="cg-secondary" onClick={() => void gameAds.transition(() => setLevelNumber(null))}>{t('back')}</button></div></>
            : <><p>{t('saved')}</p><div className="cg-modal-actions"><button type="button" data-autofocus className="cg-primary" onClick={play}><Play size={17} />{t('resume')}</button><button type="button" className="cg-secondary" onClick={restart}><RotateCcw size={17} />{t('restart')}</button><button type="button" className="cg-secondary" onClick={() => setLevelNumber(null)}>{t('back')}</button></div></>}
    </GameDialog>}
  </div>, document.body);
}
