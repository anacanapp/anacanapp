import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CarFront, HelpCircle, KeyRound, Lightbulb, Pause, Play, RotateCcw, Star, Undo2 } from 'lucide-react';
import { pushBackHandler } from '@/lib/backButton';
import { hapticFeedback } from '@/lib/native';
import { trackEvent, useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useGameAds } from '@/hooks/useGameAds';
import { readCasualProfile, recordCasualWin, writeCasualProfile, type CasualProfile } from '../casual/storage';
import { useCasualText } from '../casual/useCasualText';
import GameLobby from '../casual/GameLobby';
import GameDialog from '../casual/GameDialog';
import { PARKING_ID, PARKING_LEVELS, PARKING_REVISION, type ParkingMove, type ParkingRound } from './model';
import { parkingLevel } from './levels';
import { moveParking, parkingSolved, replayParking } from './engine';
import { createParkingRound, parkingResult, validParkingRound } from './state';
import { requestParkingHint } from './hints';
import ParkingBoard from './ParkingBoard';
import qucaq from '@/assets/onboarding/mother-mode.webp';
import { CASUAL_BRAND, QUCAQ_NAME } from '../casual/art';
import '../casual/casual.css';
import './parking.css';

export default function ClearTheWay({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('ClearTheWay', 'MiniGames');
  const { t, number, language, dir } = useCasualText();
  const [profile, setProfile] = useState(() => readCasualProfile(PARKING_ID, PARKING_REVISION, PARKING_LEVELS, validParkingRound)), current = useRef(profile); current.current = profile;
  const [levelNumber, setLevelNumber] = useState<number | null>(null), [modal, setModal] = useState<'pause' | 'help' | 'restart' | null>(null);
  const [selected, setSelected] = useState<number | null>(null), [hint, setHint] = useState<ParkingMove | null>(null), [hintBusy, setHintBusy] = useState(false), [storageReady, setStorageReady] = useState(true);
  const [finishedRound, setFinishedRound] = useState<ParkingRound | null>(null), [notice, setNotice] = useState<'blocked' | 'parkingKey' | 'hintNone' | 'hintEmpty' | null>(null);
  const definition = useMemo(() => levelNumber === null ? null : parkingLevel(levelNumber), [levelNumber]);
  const round = definition ? profile.round?.level === definition.level ? profile.round : finishedRound : null;
  const state = useMemo(() => definition && round ? replayParking(definition, round.path) : null, [definition, round]);
  const won = !!state && parkingSolved(state), phase = !definition ? 'menu' : modal ? 'paused' : won ? 'won' : 'playing';
  const gameAds = useGameAds(PARKING_ID, phase, () => {}), controller = useRef<AbortController | null>(null), completed = useRef(false);
  const latest = useRef({ definition, round, state, phase, hintBusy, waiting: gameAds.waiting, modal, selected }); latest.current = { definition, round, state, phase, hintBusy, waiting: gameAds.waiting, modal, selected };
  const commit = useCallback((value: CasualProfile<ParkingRound>) => { current.current = value; setProfile(value); setStorageReady(writeCasualProfile(value)); }, []);
  const cancelHint = useCallback(() => { controller.current?.abort(); controller.current = null; setHintBusy(false); setHint(null); }, []);
  useEffect(() => {
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!definition || !round || !won || completed.current) return;
    completed.current = true; setFinishedRound(round); commit(recordCasualWin(current.current, definition.level, PARKING_LEVELS, parkingResult(definition, round)));
    void hapticFeedback.medium().catch(() => {}); trackEvent('minigame_level_won', { game_id: PARKING_ID, level: definition.level, score: parkingResult(definition, round).score });
  }, [definition, round, won, commit]);
  const move = useCallback((value: ParkingMove) => {
    const currentState = latest.current;
    if (!currentState.definition || !currentState.round || !currentState.state || currentState.phase !== 'playing' || currentState.waiting || currentState.hintBusy) return;
    const next = moveParking(currentState.definition, currentState.state, value);
    if (!next) { setNotice('blocked'); return; }
    if (currentState.round.path.length >= 240) { setNotice('hintNone'); return; }
    setHint(null); setNotice(!currentState.state.open && next.open ? 'parkingKey' : null);
    commit({ ...current.current, round: { ...currentState.round, path: [...currentState.round.path, value], moves: currentState.round.moves + 1 } });
    void hapticFeedback.light().catch(() => {});
  }, [commit]);
  const back = useRef(() => {}); back.current = () => { cancelHint(); if (levelNumber === null) onBack(); else if (phase === 'playing') setModal('pause'); else { setModal(null); setLevelNumber(null); } };
  const moveRef = useRef(move); moveRef.current = move;
  useEffect(() => {
    const release = pushBackHandler(() => { if (latest.current.modal) return false; back.current(); return true; });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.modal) { event.preventDefault(); back.current(); return; }
      const snapshot = latest.current; if (snapshot.phase !== 'playing' || snapshot.selected === null || !snapshot.definition || !snapshot.state || event.ctrlKey || event.metaKey || event.altKey) return;
      const car = snapshot.definition.cars[snapshot.selected], sign = car.axis === 'h' ? event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0 : event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (sign) { event.preventDefault(); const from = snapshot.state.positions[snapshot.selected];
        moveRef.current({ car: snapshot.selected, to: snapshot.selected === 0 && sign > 0 && from === 4 ? 6 : from + sign }); }
    };
    const hidden = () => { if (document.hidden && latest.current.phase === 'playing') { cancelHint(); setModal('pause'); } };
    window.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', hidden);
    return () => { release(); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', hidden); };
  }, [cancelHint]);
  const start = (level: number) => {
    if (level < 1 || level > current.current.unlocked) return;
    cancelHint(); setModal(null); setNotice(null); setSelected(null); setFinishedRound(null); completed.current = false; gameAds.resetRound();
    if (current.current.round?.level !== level) commit({ ...current.current, round: createParkingRound(level) });
    setLevelNumber(level); trackEvent('minigame_level_started', { game_id: PARKING_ID, level });
  };
  const restart = () => { if (levelNumber === null) return; cancelHint(); setModal(null); setNotice(null); setSelected(null); completed.current = false; setFinishedRound(null); commit({ ...current.current, round: createParkingRound(levelNumber) }); gameAds.resetRound(); };
  const undo = () => { const round = current.current.round; if (!round?.path.length || gameAds.waiting || hintBusy) return;
    cancelHint(); setNotice(null); commit({ ...current.current, round: { ...round, path: round.path.slice(0, -1), undos: round.undos + 1 } }); };
  const getHint = async () => {
    if (!definition || !state || !round || phase !== 'playing' || hintBusy || gameAds.waiting) return;
    if (round.hints >= 3) { setNotice('hintEmpty'); return; }
    const abort = new AbortController(), path = round.path; controller.current?.abort(); controller.current = abort; setHintBusy(true); setNotice(null);
    try { const found = await requestParkingHint(definition, state, abort.signal);
      if (abort.signal.aborted || current.current.round?.path !== path || latest.current.phase !== 'playing') return;
      if (found) { setHint(found); setSelected(found.car); commit({ ...current.current, round: { ...round, hints: round.hints + 1 } }); }
      else setNotice('hintNone');
    } catch { if (!abort.signal.aborted) setNotice('hintNone'); }
    finally { if (controller.current === abort) { controller.current = null; setHintBusy(false); } }
  };
  const shift = (sign: number) => { if (selected === null || !state) return; const from = state.positions[selected]; move({ car: selected, to: selected === 0 && sign > 0 && from === 4 ? 6 : from + sign }); };
  const result = definition && round ? parkingResult(definition, round) : null;
  const Left = selected !== null && definition?.cars[selected].axis === 'v' ? ArrowUp : ArrowLeft, Right = selected !== null && definition?.cars[selected].axis === 'v' ? ArrowDown : ArrowRight;
  return createPortal(<div className="cg-screen parking-screen" lang={language} dir={dir} data-testid="parking-screen" data-game-id={PARKING_ID} data-game-phase={phase} data-parking-moves={round?.moves || 0} data-ad-block="true" data-ad-allow={gameAds.allowedPlacements}>
    <div className="cg-shell"><header className="cg-header"><button type="button" className="cg-icon" aria-label={t('back')} onClick={() => back.current()}><ArrowLeft className="cg-back-arrow" size={20} /></button><div><span>{levelNumber === null ? CASUAL_BRAND : t('parkingTitle')}</span><h1>{levelNumber === null ? t('parkingTitle') : t('level', { level: levelNumber })}</h1></div>
      <button type="button" className="cg-icon" aria-label={t('help')} onClick={() => { cancelHint(); setModal('help'); }}><HelpCircle size={19} /></button></header>
      {definition && state && round ? <><div className="parking-metrics"><span><CarFront size={17} />{number(definition.cars.length)}<small>{t('cars')}</small></span><strong>{number(round.moves)}<small>{t('moves')}</small></strong><span>{t('par', { count: definition.par })}</span></div>
        <ParkingBoard level={definition} state={state} selected={selected} onSelect={setSelected} onMove={move} hint={hint} disabled={phase !== 'playing' || hintBusy || gameAds.waiting} t={t} />
        <div className="parking-dock"><p className="parking-notice" role="status" aria-live="polite">{hintBusy ? t('hintBusy') : notice ? t(notice) : definition.keyBay && !state.open ? t('parkingKey') : t('parkingGuide')}</p>
          <div className="parking-selection" dir="ltr"><button type="button" disabled={selected === null || phase !== 'playing' || hintBusy} aria-label={t(selected !== null && definition.cars[selected].axis === 'v' ? 'up' : 'left')} onClick={() => shift(-1)}><Left size={21} /></button>
            <span>{selected === null ? <CarFront size={21} /> : selected === 0 ? <><img src={qucaq} alt="" width="37" height="37" />{QUCAQ_NAME}</> : <>{definition.cars[selected].id}{definition.keyBay?.car === selected && <KeyRound size={13} />}</>}</span>
            <button type="button" disabled={selected === null || phase !== 'playing' || hintBusy} aria-label={t(selected !== null && definition.cars[selected].axis === 'v' ? 'down' : 'right')} onClick={() => shift(1)}><Right size={21} /></button>
            <button type="button" className="parking-drive-out" disabled={phase !== 'playing' || !moveParking(definition, state, { car: 0, to: 6 })} onClick={() => move({ car: 0, to: 6 })}><ArrowRight size={17} />{t('exit')}</button></div>
          <div className="cg-tools"><button type="button" disabled={!round.path.length || phase !== 'playing' || hintBusy} onClick={undo}><Undo2 size={17} />{t('undo')}</button><button type="button" disabled={phase !== 'playing' || hintBusy} onClick={() => void getHint()}><Lightbulb size={17} />{t('hint')}<small>{number(3 - round.hints)}</small></button><button type="button" disabled={phase !== 'playing'} onClick={() => { cancelHint(); setModal('pause'); }}><Pause size={17} />{t('pause')}</button></div>
          {!storageReady && <p className="cg-save-note">{t('storage')}</p>}
        </div></> : <GameLobby title={t('parkingTitle')} description={t('parkingCard')} image={qucaq} count={PARKING_LEVELS} profile={profile} savedLevel={profile.round?.level || null} t={t} number={number} onPlay={start} />}
    </div>
    {(modal || won) && <GameDialog title={t(modal === 'help' ? 'help' : modal === 'restart' ? 'restart' : modal === 'pause' ? 'pause' : 'parkingWon')} closeLabel={t('close')} allowedPlacements={modal ? '' : gameAds.allowedPlacements} onClose={() => { if (modal) setModal(null); else setLevelNumber(null); }}>
      {modal === 'help' ? <><p>{t('parkingGuide')}</p><p>{t('parkingKey')}</p></> : modal === 'restart' ? <div className="cg-modal-actions"><button type="button" className="cg-primary" data-autofocus onClick={restart}><RotateCcw size={17} />{t('restart')}</button><button type="button" className="cg-secondary" onClick={() => setModal(null)}>{t('resume')}</button></div>
        : modal === 'pause' ? <><p>{t('saved')}</p><div className="cg-modal-actions"><button type="button" className="cg-primary" data-autofocus onClick={() => setModal(null)}><Play size={17} />{t('resume')}</button><button type="button" className="cg-secondary" onClick={() => setModal('restart')}><RotateCcw size={17} />{t('restart')}</button><button type="button" className="cg-secondary" onClick={() => { setModal(null); setLevelNumber(null); }}>{t('back')}</button></div></>
          : result && <><img src={qucaq} alt="" className="parking-win-art" width="100" height="100" /><div className="cg-stars" aria-label={t('stars', { count: result.stars })}>{[1, 2, 3].map(star => <Star key={star} size={32} fill={star <= result.stars ? 'currentColor' : 'none'} />)}</div><div className="cg-score">{number(result.score)}<small>{t('score')}</small></div><p>{t('par', { count: definition!.par })}</p>
            <div className="cg-modal-actions"><button type="button" className="cg-primary" data-autofocus disabled={gameAds.waiting} onClick={() => void gameAds.transition(() => levelNumber! < PARKING_LEVELS ? start(levelNumber! + 1) : setLevelNumber(null))}>{t(levelNumber === PARKING_LEVELS ? 'back' : 'next')}</button><button type="button" className="cg-secondary" onClick={() => void gameAds.transition(() => setLevelNumber(null))}>{t('back')}</button></div></>}
    </GameDialog>}
  </div>, document.body);
}
