import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CheckCheck, EyeOff, FlaskConical, HelpCircle, Home, KeyRound, Layers, Loader2, Pause, Play, Plus, RotateCcw, Sparkles, Star, Trophy, Undo2, X } from 'lucide-react';
import { hapticFeedback } from '@/lib/native';
import { useGameAds, type GameReviveBenefits } from '@/hooks/useGameAds';
import GameReviveAction from '../GameReviveAction';
import ColorTube, { LIQUID_COLORS } from './ColorTube';
import { completedCount, inspectPour, isComplete, isLocked, isSolved, legalMoves, topColor, type Move } from './engine';
import { COLOR_SORT_ID, LEVEL_PACK_SIZE, MAX_LEVEL_COUNT, resultForLevel, type ColorSortLevel } from './difficulty';
import { addTube, boardOf, clearSavedSession, createSession, MAX_EXTRA_TUBES, MAX_HINTS, pourSession, readSavedSession, remainingMoves, saveSession, undoSession, type ColorSortSession } from './session';
import { loadColorSortLevel, requestColorSortHint } from './workerClient';
import { useColorSortText } from './useColorSortText';
import type { MessageKey } from './messages';
import './color-sort.css';

type Phase = 'loading' | 'intro' | 'playing' | 'paused' | 'won' | 'lost' | 'error';
interface Result { level: number; score: number; stars: 0 | 1 | 2 | 3; passed: boolean }
interface Props { level: number; levelCount: number; onExit: () => void; onLevelComplete: (result: Result) => void; onNextLevel: () => void }
interface Notice { key: MessageKey; parameters?: Record<string, string | number> }
interface PourAnimation extends Move { color: number; path: string; direction: number }

export default function ColorSortGame({ level, levelCount, onExit, onLevelComplete, onNextLevel }: Props) {
  const { t, number, language, dir } = useColorSortText();
  const reduceMotion = useReducedMotion();
  const [definition, setDefinition] = useState<ColorSortLevel | null>(null);
  const [session, setSession] = useState<ColorSortSession | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [findingHint, setFindingHint] = useState(false);
  const [hint, setHint] = useState<Move | null>(null), [pouring, setPouring] = useState<PourAnimation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null), [helpOpen, setHelpOpen] = useState(false);
  const [hasSaved, setHasSaved] = useState(false), [columns, setColumns] = useState(5);
  const [markers, setMarkers] = useState(() => { try { return localStorage.getItem('anacan_colorsort_markers_v1') !== 'false'; } catch { return true; } });
  const boardRef = useRef<HTMLDivElement>(null), dialogRef = useRef<HTMLDivElement>(null);
  const tubeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null), hintController = useRef<AbortController | null>(null);
  const alive = useRef(true), generation = useRef(0), completed = useRef(false);
  const latest = useRef({ definition, session, phase, busy, findingHint });
  latest.current = { definition, session, phase, busy, findingHint };

  const changePhase = useCallback((value: Phase) => { latest.current.phase = value; setPhase(value); }, []);
  const commit = useCallback((value: ColorSortSession) => { latest.current.session = value; setSession(value); }, []);
  const cancelHint = useCallback(() => {
    hintController.current?.abort(); hintController.current = null;
    latest.current.findingHint = false; setFindingHint(false);
  }, []);
  const restoreRound = useCallback((benefits: GameReviveBenefits) => {
    const current = latest.current;
    if (!current.session || !current.definition || current.phase !== 'lost') return;
    commit({ ...current.session, bonusMoves: Math.min(60, current.session.bonusMoves + benefits.moves) });
    setNotice(null); setSelected(null); changePhase('playing');
  }, [commit, changePhase]);
  const gameAds = useGameAds(COLOR_SORT_ID, phase, restoreRound);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    loadColorSortLevel(level, controller.signal).then(value => {
      if (controller.signal.aborted || !alive.current) return;
      const saved = readSavedSession(value);
      latest.current.definition = value; setDefinition(value); commit(saved ?? createSession(value));
      setHasSaved(!!saved); changePhase('intro');
    }).catch(() => { if (!controller.signal.aborted && alive.current) changePhase('error'); });
    return () => {
      alive.current = false; generation.current++; controller.abort(); hintController.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
      const current = latest.current;
      if (current.definition && current.session && ['playing', 'paused', 'lost'].includes(current.phase)) saveSession(current.session, current.definition);
    };
  }, [level, commit, changePhase]);

  useEffect(() => {
    if (definition && session && ['playing', 'paused', 'lost'].includes(phase)) saveSession(session, definition);
  }, [definition, session, phase]);
  useEffect(() => { try { localStorage.setItem('anacan_colorsort_markers_v1', String(markers)); } catch { /* visual preference is optional */ } }, [markers]);
  useEffect(() => {
    const measure = () => {
      const width = boardRef.current?.clientWidth ?? window.innerWidth - 24;
      setColumns(width >= 350 ? 6 : width >= 280 ? 5 : 4);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (boardRef.current) observer?.observe(boardRef.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [definition]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && latest.current.phase === 'playing') { cancelHint(); changePhase('paused'); }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [cancelHint, changePhase]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (helpOpen) { setHelpOpen(false); return; }
        if (latest.current.phase === 'playing') { cancelHint(); changePhase('paused'); }
        else if (latest.current.phase === 'paused') changePhase('playing');
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [helpOpen, cancelHint, changePhase]);

  const board = useMemo(() => session ? boardOf(session) : [], [session]);
  const revealed = useMemo(() => new Set(session?.revealed ?? []), [session?.revealed]);
  const sorted = definition ? completedCount(board, definition.rules.capacity) : 0;
  const left = session && definition ? remainingMoves(session, definition) : null;
  const result = session && definition ? resultForLevel(definition, session.moves, session.hints, session.extraTubes, session.undos) : null;
  const stuck = !!definition && !!session && !isSolved(board, definition.rules.capacity) && legalMoves(board, definition.rules).length === 0;

  useEffect(() => {
    if (!definition || !session || phase !== 'playing' || busy || latest.current.phase !== 'playing') return;
    if (isSolved(board, definition.rules.capacity)) {
      cancelHint(); changePhase('won'); clearSavedSession(definition);
      if (!completed.current) {
        completed.current = true;
        onLevelComplete(resultForLevel(definition, session.moves, session.hints, session.extraTubes, session.undos));
        hapticFeedback.medium();
      }
    } else if (remainingMoves(session, definition) === 0) { cancelHint(); changePhase('lost'); }
  }, [board, definition, session, phase, busy, onLevelComplete, cancelHint, changePhase]);

  const startNew = () => {
    const current = latest.current.definition;
    if (!current) return;
    generation.current++; completed.current = false; cancelHint();
    if (timerRef.current) clearTimeout(timerRef.current);
    latest.current.busy = false; setBusy(false); setPouring(null); setHint(null); setSelected(null); setNotice(null); setHasSaved(false);
    commit(createSession(current)); gameAds.resetRound(); changePhase('playing');
  };
  const reportLoss = () => {
    if (latest.current.phase === 'lost' && !completed.current) { completed.current = true; onLevelComplete({ level, score: 0, stars: 0, passed: false }); }
  };
  const exit = () => { reportLoss(); cancelHint(); void gameAds.transition(onExit); };
  const restart = () => { reportLoss(); cancelHint(); void gameAds.transition(startNew); };

  const selectTube = (index: number) => {
    const current = latest.current;
    if (!current.definition || !current.session || current.phase !== 'playing' || current.busy || current.findingHint || helpOpen) return;
    const currentBoard = boardOf(current.session), rules = current.definition.rules;
    if (isLocked(currentBoard, rules, index)) {
      const after = rules.locks.find(lock => lock.tube === index)!.after;
      setNotice({ key: 'locked_tube', parameters: { count: after - completedCount(currentBoard, rules.capacity) } }); return;
    }
    if (selected === index) { setSelected(null); setNotice(null); return; }
    if (selected === null) {
      if (!currentBoard[index].length) { setNotice({ key: 'empty_tube' }); return; }
      if (isComplete(currentBoard[index], rules.capacity)) { setNotice({ key: 'complete_tube' }); return; }
      setSelected(index); setNotice(null); hapticFeedback.light(); return;
    }
    const move = { from: selected, to: index }, decision = inspectPour(currentBoard, rules, selected, index);
    const next = pourSession(current.session, current.definition, move);
    if (!next) {
      setNotice({ key: decision.reason === 'full' ? 'invalid_full' : decision.reason === 'complete' ? 'complete_tube' : 'invalid_color' });
      if (currentBoard[index].length && !isComplete(currentBoard[index], rules.capacity)) setSelected(index);
      return;
    }
    latest.current.busy = true; setBusy(true); setSelected(null); setHint(null); setNotice(null);
    const source = tubeRefs.current[selected]?.getBoundingClientRect(), target = tubeRefs.current[index]?.getBoundingClientRect(), bounds = boardRef.current?.getBoundingClientRect();
    if (source && target && bounds && !reduceMotion) {
      const sx = source.x + source.width / 2 - bounds.x, sy = source.y + 22 - bounds.y;
      const tx = target.x + target.width / 2 - bounds.x, ty = target.y + 22 - bounds.y;
      setPouring({ ...move, color: next.color, direction: tx >= sx ? 1 : -1,
        path: `M${sx} ${sy} Q${sx} ${Math.min(sy, ty) - 28} ${(sx + tx) / 2} ${Math.min(sy, ty) - 28} T${tx} ${ty}` });
    }
    commit(next.session); hapticFeedback.light();
    const epoch = generation.current;
    timerRef.current = setTimeout(() => {
      if (!alive.current || epoch !== generation.current) return;
      latest.current.busy = false; setBusy(false); setPouring(null);
    }, reduceMotion ? 30 : 380);
  };

  const undo = () => {
    const current = latest.current;
    if (!current.session || current.busy || current.findingHint || !['playing', 'lost'].includes(current.phase)) return;
    const next = undoSession(current.session);
    if (next) { commit(next); setSelected(null); setHint(null); setNotice(null); changePhase('playing'); hapticFeedback.light(); }
  };
  const extra = () => {
    const current = latest.current;
    if (!current.session || current.busy || current.findingHint || current.phase !== 'playing') return;
    const next = addTube(current.session);
    if (next) { commit(next); setSelected(null); setHint(null); setNotice({ key: 'extra_added' }); }
    else setNotice({ key: 'extra_empty' });
  };
  const showHint = async () => {
    const current = latest.current;
    if (!current.session || !current.definition || current.busy || current.findingHint || current.phase !== 'playing') return;
    if (current.session.hints >= MAX_HINTS) { setNotice({ key: 'hint_empty' }); return; }
    const snapshot = current.session, epoch = generation.current, controller = new AbortController();
    hintController.current?.abort(); hintController.current = controller;
    latest.current.findingHint = true; setFindingHint(true); setNotice(null);
    try {
      const move = await requestColorSortHint(current.definition, boardOf(snapshot), controller.signal);
      if (controller.signal.aborted || !alive.current || generation.current !== epoch || latest.current.phase !== 'playing' || latest.current.session !== snapshot) return;
      if (move) {
        commit({ ...snapshot, hints: snapshot.hints + 1 }); setHint(move); setSelected(null);
        setNotice({ key: 'hint_move', parameters: { from: move.from + 1, to: move.to + 1 } });
      } else setNotice({ key: 'hint_none' });
    } finally {
      if (alive.current && hintController.current === controller) { latest.current.findingHint = false; setFindingHint(false); hintController.current = null; }
    }
  };

  const overlay = helpOpen ? 'help' : phase === 'playing' ? null : phase;
  const controlsDisabled = busy || findingHint || gameAds.waiting || phase !== 'playing';
  const noticeText = busy ? t('pouring') : findingHint ? t('hint_busy') : notice ? t(notice.key, notice.parameters) : stuck ? t('stuck') : t(selected === null ? 'select_source' : 'select_target');

  return createPortal(<div className="colorsort-screen" dir={dir} lang={language} data-testid="colorsort-game"
    data-ad-block="true" data-ad-allow={gameAds.allowedPlacements} data-game-phase={phase} data-colorsort-moves={session?.moves ?? 0}>
    <header className="colorsort-header" aria-hidden={!!overlay}>
      <button type="button" className="colorsort-icon" aria-label={t('pause')} disabled={busy || !!overlay} onClick={() => { cancelHint(); changePhase('paused'); }}><Pause size={18} /></button>
      <div className="colorsort-heading"><h1>{t('title')}</h1><p>{t('level', { level })} · {definition ? t(`difficulty_${definition.difficulty}`) : ''}</p></div>
      <button type="button" className="colorsort-icon" aria-label={t('help')} disabled={busy || !!overlay} onClick={() => { cancelHint(); setHelpOpen(true); }}><HelpCircle size={20} /></button>
    </header>
    <div className="colorsort-stats" aria-hidden={!!overlay}>
      <div className="colorsort-stat"><span>{t(left === null ? 'moves' : 'moves_left')}</span><strong>{left === null ? number(session?.moves ?? 0) : number(left)}</strong></div>
      <div className="colorsort-stat"><span>{t('sorted')}</span><strong>{number(sorted)}/{number(definition?.colors ?? 0)}</strong></div>
    </div>
    <p className="colorsort-notice" role="status" aria-live="polite" aria-hidden={!!overlay}>{noticeText}</p>
    <div className="colorsort-playarea" aria-hidden={!!overlay}>
      <div className="colorsort-board" ref={boardRef} role="group" aria-label={t('title')} style={{ '--columns': Math.min(columns, session?.tubes.length ?? columns) } as CSSProperties}>
        {definition && session?.tubes.map((tube, index) => {
          const locked = isLocked(board, definition.rules, index) ? definition.rules.locks.find(item => item.tube === index)!.after - sorted : 0;
          const top = topColor(board[index]), complete = isComplete(board[index], definition.rules.capacity);
          const label = locked ? `${t('tube', { number: index + 1 })}. ${t('locked_tube', { count: locked })}`
            : t('tube_label', { number: index + 1, top: complete ? t('complete_tube') : top === null ? t('empty_tube') : t(`color_${top}` as MessageKey), space: definition.rules.capacity - tube.length });
          return <ColorTube key={index} ref={element => { tubeRefs.current[index] = element; }} units={tube} revealed={revealed}
            index={index} label={label} number={number} selected={selected === index} complete={complete} locked={locked}
            markers={markers} disabled={controlsDisabled || !!overlay} hint={hint?.from === index ? 'from' : hint?.to === index ? 'to' : null}
            pouring={pouring?.from === index} direction={pouring?.direction ?? 1} onClick={() => selectTube(index)} />;
        })}
        {pouring && <svg className="colorsort-stream" aria-hidden="true"><motion.path d={pouring.path} fill="none" stroke={LIQUID_COLORS[pouring.color]}
          strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0.6 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.2 }} /></svg>}
      </div>
    </div>
    <footer className="colorsort-bottom" aria-hidden={!!overlay}>
      <div className="colorsort-tools">
        <button type="button" className="colorsort-tool" disabled={controlsDisabled || !session?.history.length || !!overlay} onClick={undo}><span className="colorsort-tool-icon"><Undo2 size={18} /></span>{t('undo')}</button>
        <button type="button" className="colorsort-tool" disabled={controlsDisabled || !session || session.hints >= MAX_HINTS || !!overlay} onClick={() => { void showHint(); }}><span className="colorsort-tool-icon">{findingHint ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}<small>{number(MAX_HINTS - (session?.hints ?? 0))}</small></span>{t('hint')}</button>
        <button type="button" className="colorsort-tool" disabled={controlsDisabled || !session || session.extraTubes >= MAX_EXTRA_TUBES || !!overlay} onClick={extra}><span className="colorsort-tool-icon"><Plus size={18} /><small>{number(MAX_EXTRA_TUBES - (session?.extraTubes ?? 0))}</small></span>{t('extra_tube')}</button>
      </div>
      <div className="colorsort-options"><button type="button" aria-pressed={markers} disabled={!!overlay} onClick={() => setMarkers(value => !value)}><Layers size={13} />{t('markers')}</button><span>{t('saved')}</span></div>
    </footer>

    {overlay && <div key={overlay} className="colorsort-overlay" role="dialog" aria-modal="true" aria-labelledby="colorsort-dialog-title"
      data-ad-block="true" data-ad-allow={helpOpen ? '' : gameAds.allowedPlacements} ref={dialogRef}>
      <div className="colorsort-dialog">
        {overlay === 'loading' && <><div className="colorsort-emblem"><Loader2 size={32} className="animate-spin" /></div><h2 id="colorsort-dialog-title">{t('loading')}</h2><button className="colorsort-secondary" onClick={exit}><ArrowLeft size={16} className="rtl:rotate-180" />{t('back')}</button></>}
        {overlay === 'error' && <><h2 id="colorsort-dialog-title">{t('title')}</h2><p>{t('load_error')}</p><div className="colorsort-actions"><button autoFocus className="colorsort-primary" onClick={exit}>{t('menu')}</button></div></>}
        {overlay === 'intro' && definition && <>
          <div className="colorsort-emblem"><FlaskConical size={40} /></div><span className="colorsort-tier">{t(`difficulty_${definition.difficulty}`)}</span>
          <h2 id="colorsort-dialog-title">{t('level', { level })}</h2><p>{t('goal')}</p>
          <div className="colorsort-intro-stats">
            <div><strong>{number(definition.colors)}</strong><span>{t('colors')}</span></div><div><strong>{number(definition.emptyTubes)}</strong><span>{t('empty')}</span></div>
            <div><strong>{definition.moveLimit === null ? '∞' : number(definition.moveLimit)}</strong><span>{definition.moveLimit === null ? t('unlimited') : t('moves')}</span></div>
            <div><strong>{number(definition.lockedTubes)}</strong><span>{t('locks')}</span></div>
          </div>
          {definition.hiddenTubes > 0 && <p><EyeOff size={14} className="inline-block align-middle me-1" />{t('hidden')}</p>}
          <p>{t('target_moves', { count: definition.parMoves + 2 })}</p>
          <div className="colorsort-actions">
            {hasSaved && <button autoFocus className="colorsort-primary" onClick={() => changePhase('playing')}><Play size={17} />{t('resume_saved')}</button>}
            <button autoFocus={!hasSaved} className={hasSaved ? 'colorsort-secondary' : 'colorsort-primary'} onClick={startNew}><Play size={17} />{t(hasSaved ? 'new_game' : 'start')}</button>
            <button className="colorsort-secondary" onClick={() => setHelpOpen(true)}><HelpCircle size={17} />{t('help')}</button>
            <button className="colorsort-secondary" onClick={exit}><ArrowLeft size={17} className="rtl:rotate-180" />{t('menu')}</button>
          </div>
        </>}
        {overlay === 'help' && <>
          <h2 id="colorsort-dialog-title">{t('help')}</h2>
          <ul className="colorsort-rules">
            {([[FlaskConical, 'rule_pour'], [CheckCheck, 'rule_seal'], [KeyRound, 'rule_lock'], [EyeOff, 'rule_hidden'], [Sparkles, 'rule_help'], [Star, 'rule_stars']] as const).map(([Icon, key]) => <li key={key}><Icon size={19} /><p>{t(key)}</p></li>)}
          </ul>
          <div className="colorsort-color-key">{LIQUID_COLORS.slice(0, definition?.colors ?? 8).map((color, index) => <span key={color} style={{ background: color, color: index === 7 ? '#fff' : '#10283b' }} title={t(`color_${index}` as MessageKey)}>{number(index + 1)}</span>)}</div>
          <div className="colorsort-actions"><button autoFocus className="colorsort-primary" onClick={() => setHelpOpen(false)}><X size={17} />{t('close')}</button></div>
        </>}
        {overlay === 'paused' && <>
          <div className="colorsort-emblem"><Pause size={34} /></div><h2 id="colorsort-dialog-title">{t('paused')}</h2><p>{t('saved')}</p>
          <div className="colorsort-actions"><button autoFocus className="colorsort-primary" onClick={() => changePhase('playing')}><Play size={17} />{t('resume')}</button>
            <button className="colorsort-secondary" disabled={gameAds.waiting} onClick={restart}><RotateCcw size={17} />{t('restart')}</button>
            <button className="colorsort-secondary" disabled={gameAds.waiting} onClick={exit}><Home size={17} />{t('menu')}</button></div>
        </>}
        {overlay === 'won' && result && <>
          <div className="colorsort-emblem"><Trophy size={38} /></div><h2 id="colorsort-dialog-title">{t('won')}</h2>
          <div className="colorsort-star-row" aria-label={t('stars', { count: result.stars })}>{[1, 2, 3].map(star => <Star key={star} size={38} fill={star <= result.stars ? 'currentColor' : 'none'} opacity={star <= result.stars ? 1 : 0.25} />)}</div>
          <p>{t('score')}: <strong>{number(result.score)}</strong> · {t('moves')}: {number(session?.moves ?? 0)}</p>
          <div className="colorsort-actions">
            {level < MAX_LEVEL_COUNT && <button autoFocus className="colorsort-primary" disabled={gameAds.waiting} onClick={() => { void gameAds.transition(onNextLevel); }}>{level < levelCount ? t('next') : t('add_levels', { count: Math.min(LEVEL_PACK_SIZE, MAX_LEVEL_COUNT - levelCount) })}</button>}
            <button className="colorsort-secondary" disabled={gameAds.waiting} onClick={restart}><RotateCcw size={17} />{t('restart')}</button>
            <button className="colorsort-secondary" disabled={gameAds.waiting} onClick={exit}><Home size={17} />{t('menu')}</button>
          </div>
        </>}
        {overlay === 'lost' && <>
          <div className="colorsort-emblem"><FlaskConical size={38} /></div><h2 id="colorsort-dialog-title">{t('lost')}</h2><p>{t('lost_desc')}</p>
          <div className="colorsort-actions">
            {!!session?.history.length && <button autoFocus className="colorsort-primary" disabled={gameAds.waiting} onClick={undo}><Undo2 size={17} />{t('undo')}</button>}
            <GameReviveAction ads={gameAds} game="match" labels={{ action: t(gameAds.premium ? 'revive_premium' : 'revive_video', { count: gameAds.benefits.moves }),
              note: t('revive_note'), failed: t('revive_failed'), unavailable: t('ads_unavailable') }} />
            <button className="colorsort-secondary" disabled={gameAds.waiting} onClick={restart}><RotateCcw size={17} />{t('restart')}</button>
            <button className="colorsort-secondary" disabled={gameAds.waiting} onClick={exit}><Home size={17} />{t('menu')}</button>
          </div>
        </>}
      </div>
    </div>}
  </div>, document.body);
}
