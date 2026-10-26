import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Pause, Play, Trophy, RotateCcw, Home, Puzzle, Target, Sparkles, Star } from 'lucide-react';
import { tr } from '@/lib/tr';
import { hapticFeedback } from '@/lib/native';
import { trTierName } from '../tierLabels';
import { useGameAds, type GameReviveBenefits } from '@/hooks/useGameAds';
import GameReviveAction from '../GameReviveAction';
import {
  Board,
  Pos,
  SpecialEvent,
  applyMatchResult,
  activateColorBombSwap,
  createBoard,
  findMatchGroups,
  hasAnyPossibleMove,
  isAdjacent,
  reshuffleBoard,
  swap,
} from './matchEngine';
import { TILE_DEFS, getTilePool, BONUS_NAMES } from './tileDefs';
import { getLevelConfig, getStarsForScore, BOARD_ROWS, BOARD_COLS, TOTAL_LEVELS } from './levelConfig';

interface BirlesdirGameProps {
  level: number;
  onExit: () => void;
  onLevelComplete: (result: { level: number; score: number; stars: 0 | 1 | 2 | 3; passed: boolean }) => void;
  onNextLevel?: () => void;
}

type Phase = 'intro' | 'playing' | 'paused' | 'won' | 'lost';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function computeScore(clearedCount: number, cascadeIndex: number, events: SpecialEvent[], scoreMultiplier: number): number {
  const base = clearedCount * 12;
  const cascadeMultiplier = 1 + cascadeIndex * 0.5;
  let bonus = 0;
  for (const e of events) {
    if (e.kind === 'striped-h' || e.kind === 'striped-v') bonus += e.created ? 30 : 60;
    else if (e.kind === 'wrapped') bonus += e.created ? 50 : 100;
    else if (e.kind === 'color-bomb') bonus += e.created ? 80 : 160;
  }
  return Math.round((base * cascadeMultiplier + bonus) * scoreMultiplier);
}

const BirlesdirGame = ({ level, onExit, onLevelComplete, onNextLevel }: BirlesdirGameProps) => {
  const config = getLevelConfig(level);
  const tilePool = getTilePool(config.tileTypesCount);
  const typeCount = tilePool.length;

  const [phase, setPhase] = useState<Phase>('intro');
  const [board, setBoard] = useState<Board>([]);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(config.movesLimit);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [invalidPair, setInvalidPair] = useState<Pos[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [bonusBanner, setBonusBanner] = useState<{ label: string; emoji: string; key: string } | null>(null);
  const [shuffleNotice, setShuffleNotice] = useState(false);
  const [finalStars, setFinalStars] = useState<0 | 1 | 2 | 3>(0);
  const [moveBonus, setMoveBonus] = useState(0);
  const [cellSize, setCellSize] = useState(40);

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ row: number; col: number; x: number; y: number; moved: boolean } | null>(null);
  const phaseRef = useRef(phase);
  // Generation counter: bumped on every reset/restart so any in-flight async
  // cascade (resolveFrom awaits) from a previous round can detect it is stale
  // and stop touching the fresh board/score.
  const genRef = useRef(0);
  // One-shot guard: onLevelComplete must fire at most once per round,
  // structurally — independent of how many times the win/lose effect below
  // happens to re-run (e.g. due to a parent re-render recreating the
  // onLevelComplete prop reference right as a round ends).
  const completedRef = useRef(false);
  const restoreRound = useCallback((benefits: GameReviveBenefits) => {
    genRef.current++; completedRef.current = false;
    setMovesLeft(value => Math.max(0, value) + benefits.moves); setBusy(false); setSelected(null); setInvalidPair(null);
    phaseRef.current = 'playing'; setPhase('playing');
  }, []);
  const gameAds = useGameAds('birlesdir', phase, restoreRound);
  // Pending window.setTimeout ids (bonus banner / shuffle notice auto-clear)
  // so they can be cancelled on unmount instead of firing setState on a
  // component that's no longer mounted (e.g. player exits mid-animation).
  const pendingTimeoutsRef = useRef<number[]>([]);
  const trackTimeout = useCallback((id: number) => {
    pendingTimeoutsRef.current.push(id);
    return id;
  }, []);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Unmount cleanup: invalidate any in-flight async cascade and cancel any
  // still-pending timeouts so nothing touches state after this instance is
  // gone (relevant since `key={selectedLevel}` fully remounts this component
  // on "next level", and onExit fully unmounts it on "menu").
  useEffect(() => {
    return () => {
      genRef.current += 1;
      pendingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      pendingTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const gap = 5;
        setCellSize(Math.floor((rect.width - gap * (BOARD_COLS - 1)) / BOARD_COLS));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [phase]);

  const triggerBonusBanner = useCallback(
    (events: SpecialEvent[]) => {
      if (!events.length) return;
      const first = events[0];
      const info = BONUS_NAMES[first.kind];
      const key = `${Date.now()}-${Math.random()}`;
      setBonusBanner({ label: tr(info.key, info.name), emoji: info.emoji, key });
      trackTimeout(
        window.setTimeout(() => {
          setBonusBanner((prev) => (prev?.key === key ? null : prev));
        }, 850)
      );
    },
    [trackTimeout]
  );

  const resolveFrom = useCallback(
    async (
      startBoard: Board,
      firstResolved?: { board: Board; clearedCount: number; events: SpecialEvent[] }
    ) => {
      const gen = genRef.current;
      const isStale = () => genRef.current !== gen;
      let current = startBoard;
      let cascadeIndex = 0;

      if (firstResolved) {
        const gained = computeScore(firstResolved.clearedCount, 0, firstResolved.events, config.scoreMultiplier);
        current = firstResolved.board;
        setScore((s) => s + gained);
        setBoard(current);
        if (firstResolved.events.length) {
          triggerBonusBanner(firstResolved.events);
          hapticFeedback.medium();
        }
        cascadeIndex = 1;
        await sleep(360);
        if (isStale()) return;
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const matchResult = findMatchGroups(current);
        if (matchResult.groups.length === 0) break;
        await sleep(160);
        if (isStale()) return;
        const step = applyMatchResult(current, matchResult, typeCount);
        const gained = computeScore(step.clearedCount, cascadeIndex, step.events, config.scoreMultiplier);
        current = step.board;
        setScore((s) => s + gained);
        setBoard(current);
        if (step.events.length) {
          triggerBonusBanner(step.events);
          hapticFeedback.medium();
        }
        cascadeIndex++;
        await sleep(360);
        if (isStale()) return;
      }

      if (!hasAnyPossibleMove(current, typeCount)) {
        await sleep(450);
        if (isStale()) return;
        current = reshuffleBoard(current, typeCount);
        setBoard(current);
        setShuffleNotice(true);
        trackTimeout(window.setTimeout(() => setShuffleNotice(false), 1400));
        await sleep(500);
        if (isStale()) return;
      }

      setBusy(false);
    },
    [typeCount, triggerBonusBanner, config.scoreMultiplier, trackTimeout]
  );

  const attemptSwap = useCallback(
    async (a: Pos, b: Pos) => {
      if (busy || phaseRef.current !== 'playing') return;
      const gen = genRef.current;
      const tileA = board[a.row][a.col];
      const tileB = board[b.row][b.col];

      if (tileA?.special === 'color-bomb' || tileB?.special === 'color-bomb') {
        setBusy(true);
        setSelected(null);
        setMovesLeft((m) => m - 1);
        hapticFeedback.heavy();
        const step = activateColorBombSwap(board, a, b, typeCount);
        await resolveFrom(board, step);
        return;
      }

      const swapped = swap(board, a, b);
      const matchResult = findMatchGroups(swapped, [a, b]);

      if (matchResult.groups.length === 0) {
        setBusy(true);
        setSelected(null);
        setInvalidPair([a, b]);
        setBoard(swapped);
        await sleep(230);
        if (genRef.current !== gen) return;
        setBoard(board);
        setInvalidPair(null);
        setBusy(false);
        return;
      }

      setBusy(true);
      setSelected(null);
      setMovesLeft((m) => m - 1);
      hapticFeedback.light();
      setBoard(swapped);
      await sleep(140);
      if (genRef.current !== gen) return;
      const step = applyMatchResult(swapped, matchResult, typeCount);
      await resolveFrom(swapped, step);
    },
    [board, busy, resolveFrom, typeCount]
  );

  const handleTap = useCallback(
    (pos: Pos) => {
      if (busy || phaseRef.current !== 'playing') return;
      if (!selected) {
        setSelected(pos);
        hapticFeedback.light();
        return;
      }
      if (selected.row === pos.row && selected.col === pos.col) {
        setSelected(null);
        return;
      }
      if (isAdjacent(selected, pos)) {
        attemptSwap(selected, pos);
      } else {
        setSelected(pos);
        hapticFeedback.light();
      }
    },
    [selected, busy, attemptSwap]
  );

  const handlePointerDown = (row: number, col: number, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { row, col, x: e.clientX, y: e.clientY, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.moved) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 18) return;

    drag.moved = true;
    let target: Pos;
    if (Math.abs(dx) > Math.abs(dy)) {
      target = { row: drag.row, col: drag.col + (dx > 0 ? 1 : -1) };
    } else {
      target = { row: drag.row + (dy > 0 ? 1 : -1), col: drag.col };
    }
    if (target.row >= 0 && target.row < BOARD_ROWS && target.col >= 0 && target.col < BOARD_COLS) {
      setSelected(null);
      attemptSwap({ row: drag.row, col: drag.col }, target);
    }
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (drag && !drag.moved) {
      handleTap({ row: drag.row, col: drag.col });
    }
    dragRef.current = null;
  };

  const resetGame = useCallback(() => {
    genRef.current += 1; // cancel any in-flight cascade from the previous round
    completedRef.current = false; // allow onLevelComplete to fire again for the new round
    const newBoard = createBoard(BOARD_ROWS, BOARD_COLS, typeCount);
    setBoard(newBoard);
    setScore(0);
    setMovesLeft(config.movesLimit);
    setSelected(null);
    setInvalidPair(null);
    setBusy(false);
    setBonusBanner(null);
    setShuffleNotice(false);
    setFinalStars(0);
    setMoveBonus(0);
  }, [config.movesLimit, typeCount]);

  const startGame = () => {
    resetGame();
    setPhase('playing');
  };

  const handleRetry = () => {
    void gameAds.transition(() => { resetGame(); gameAds.resetRound(); setPhase('playing'); });
  };

  // Win / lose watcher — only evaluated once the board has fully settled (busy === false).
  // On a win, every unused move converts into bonus points (standard match-3 UX):
  // finishing efficiently is what pushes the final score past the 2★ / 3★
  // thresholds, so the star mechanic is actually attainable.
  useEffect(() => {
    if (phase !== 'playing' || busy) return;
    if (score >= config.targetScore) {
      const perMoveBonus = Math.max(12, Math.round(55 * config.scoreMultiplier));
      const bonus = Math.max(0, movesLeft) * perMoveBonus;
      const finalScore = score + bonus;
      const stars = getStarsForScore(finalScore, config.targetScore);
      setMoveBonus(bonus);
      setScore(finalScore);
      setFinalStars(stars);
      setPhase('won');
      if (!completedRef.current) {
        completedRef.current = true;
        onLevelComplete({ level, score: finalScore, stars, passed: true });
      }
      hapticFeedback.medium();
      return;
    }
    if (movesLeft <= 0) {
      setPhase('lost');
    }
  }, [score, movesLeft, busy, phase, config.targetScore, config.scoreMultiplier, level, onLevelComplete]);

  useEffect(() => {
    if (phase === 'lost' && !completedRef.current) {
      completedRef.current = true;
      onLevelComplete({ level, score, stars: 0, passed: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const targetProgress = Math.min(100, Math.round((score / config.targetScore) * 100));
  const gap = 5;

  const renderTileContent = (special: string | undefined, emoji: string) => {
    if (special === 'color-bomb') {
      return (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-fuchsia-400 via-amber-300 to-sky-400 flex items-center justify-center shadow-inner animate-pulse-scale">
          <Sparkles className="w-1/2 h-1/2 text-white drop-shadow" />
        </div>
      );
    }
    if (special === 'wrapped') {
      return (
        <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-amber-200/70 to-amber-400/70 flex items-center justify-center ring-2 ring-amber-400/70">
          <span style={{ fontSize: cellSize * 0.55 }}>{emoji}</span>
          <Sparkles className="w-3 h-3 text-amber-600 absolute -top-1 -end-1" />
        </div>
      );
    }
    if (special === 'striped-h' || special === 'striped-v') {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <span style={{ fontSize: cellSize * 0.55 }}>{emoji}</span>
          <div
            className={`absolute bg-white/80 rounded-full ${
              special === 'striped-h' ? 'inset-x-0.5 h-[3px] top-1/2 -translate-y-1/2' : 'inset-y-0.5 w-[3px] left-1/2 -translate-x-1/2'
            }`}
          />
        </div>
      );
    }
    return <span style={{ fontSize: cellSize * 0.55 }}>{emoji}</span>;
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-violet-50 via-rose-50 to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800" data-ad-block="true" data-ad-allow={gameAds.allowedPlacements} data-game-phase={phase} data-game-moves={movesLeft} data-game-score={score}>
      <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-top)' }} />

      {/* HUD */}
      <div className="flex-shrink-0 px-3 pt-2 pb-2 bg-background/70 backdrop-blur-md border-b border-border/40 relative z-20">
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => (phase === 'playing' ? setPhase('paused') : void gameAds.transition(onExit))}
            whileTap={{ scale: 0.9 }}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"
          >
            {phase === 'playing' ? <Pause className="w-4 h-4 text-foreground" /> : <ArrowLeft className="rtl:rotate-180 w-4 h-4 text-foreground" />}
          </motion.button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-foreground">
                {tr('birlesdir_level_label', 'Səviyyə')} {level}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <Target className="w-3 h-3" />
                {movesLeft} {tr('birlesdir_moves_short', 'gediş')}
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                animate={{ width: `${targetProgress}%` }}
                transition={{ ease: 'easeOut', duration: 0.25 }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">
            {tr('birlesdir_target_prefix', 'Hədəf')}: {config.targetScore}
          </span>
          <span className="text-sm font-extrabold text-violet-600">{score}</span>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-3 relative overflow-hidden">
        {phase !== 'intro' && (
          <div
            ref={boardRef}
            className="relative w-full max-w-[480px] mx-auto touch-none select-none grid"
            style={{
              gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)`,
              gap: `${gap}px`,
            }}
          >
            {board.map((row, r) =>
              row.map((tile, c) => {
                if (!tile) return <div key={`empty-${r}-${c}`} style={{ width: cellSize, height: cellSize }} />;
                const def = TILE_DEFS[tile.type] || TILE_DEFS[0];
                const isSelected = selected?.row === r && selected?.col === c;
                const isInvalid = invalidPair?.some((p) => p.row === r && p.col === c);
                return (
                  <motion.div
                    key={tile.id}
                    layout
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{
                      scale: isSelected ? 1.1 : 1,
                      opacity: 1,
                      x: isInvalid ? [0, -4, 4, -4, 0] : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    onPointerDown={(e) => handlePointerDown(r, c, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    style={{ width: cellSize, height: cellSize }}
                    className={`rounded-xl flex items-center justify-center cursor-pointer bg-card/70 border ${
                      isSelected ? 'border-primary ring-2 ring-primary shadow-glow' : 'border-border/30'
                    }`}
                  >
                    {renderTileContent(tile.special, def.emoji)}
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* Bonus banner */}
        <AnimatePresence>
          {bonusBanner && (
            <motion.div
              key={bonusBanner.key}
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1.05, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-extrabold text-sm shadow-xl flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{bonusBanner.emoji}</span>
              {bonusBanner.label}
            </motion.div>
          )}
        </AnimatePresence>

        {shuffleNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground shadow"
          >
            {tr('birlesdir_shuffle_notice', 'Lövhə qarışdırıldı 🔄')}
          </motion.div>
        )}

        {/* Intro overlay */}
        {phase === 'intro' && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6 text-center z-30">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-glow mb-1">
              <Puzzle className="w-8 h-8 text-white" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              {trTierName(config.tierName)}
            </span>
            <h2 className="text-xl font-bold text-foreground">
              {tr('birlesdir_level_label', 'Səviyyə')} {level}
            </h2>
            <p className="text-sm text-muted-foreground max-w-[260px]">
              {tr(
                'birlesdir_intro_desc',
                '3 və ya daha çox eyni əşyanı yan-yana gətir, "Sakitlik Anı" və "Super Ana" bonuslarını aç!'
              )}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" /> {config.targetScore} {tr('birlesdir_points_short', 'xal')}
              </span>
              <span className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> {config.movesLimit} {tr('birlesdir_moves_short', 'gediş')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>⭐⭐ ≥ {Math.ceil(config.targetScore * 1.2)}</span>
              <span>⭐⭐⭐ ≥ {Math.ceil(config.targetScore * 1.5)}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="mt-3 px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold shadow-button"
            >
              {tr('birlesdir_start_button', 'Başla')}
            </motion.button>
          </div>
        )}

        {/* Paused overlay */}
        {phase === 'paused' && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
            <h2 className="text-lg font-bold text-foreground">{tr('birlesdir_paused_title', 'Fasilə')}</h2>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setPhase('playing')}
              className="w-48 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold shadow-button flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> {tr('birlesdir_resume_button', 'Davam et')}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleRetry}
              className="w-48 py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> {tr('birlesdir_restart_button', 'Yenidən başla')}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { void gameAds.transition(onExit); }}
              className="w-48 py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> {tr('birlesdir_menu_button', 'Menyu')}
            </motion.button>
          </div>
        )}

        {/* Win overlay */}
        {phase === 'won' && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30 px-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center shadow-glow mb-1"
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
            <h2 className="text-xl font-bold text-foreground">{tr('birlesdir_level_complete_title', 'Səviyyə tamamlandı!')}</h2>
            <div className="flex items-center gap-1 my-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15 + i * 0.15, type: 'spring', stiffness: 260, damping: 14 }}
                >
                  <Star className={`w-9 h-9 ${i < finalStars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/25'}`} />
                </motion.div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {tr('birlesdir_your_score_prefix', 'Xalınız')}: <span className="font-bold text-foreground">{score}</span>
            </p>
            {moveBonus > 0 && (
              <p className="text-xs font-semibold text-violet-600">
                +{moveBonus} {tr('birlesdir_move_bonus_label', 'gediş bonusu')} ✨
              </p>
            )}
            <div className="flex flex-col gap-2 w-full max-w-[260px] mt-3">
              {level < TOTAL_LEVELS && onNextLevel && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { void gameAds.transition(onNextLevel); }}
                  className="py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold shadow-button"
                >
                  {tr('birlesdir_next_level_button', 'Növbəti səviyyə')}
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRetry}
                className="py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> {tr('birlesdir_replay_button', 'Təkrar oyna')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { void gameAds.transition(onExit); }}
                className="py-3 rounded-2xl bg-muted/60 text-muted-foreground font-medium flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> {tr('birlesdir_menu_button', 'Menyu')}
              </motion.button>
            </div>
          </div>
        )}

        {/* Lose overlay */}
        {phase === 'lost' && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-1">
              <span className="text-4xl">😔</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">{tr('birlesdir_out_of_moves_title', 'Gedişlər bitdi!')}</h2>
            <p className="text-sm text-muted-foreground">
              {tr('birlesdir_your_score_prefix', 'Xalınız')}: <span className="font-bold text-foreground">{score}</span> / {config.targetScore}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[260px] mt-3">
              <GameReviveAction ads={gameAds} game="match" />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRetry}
                className="py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold shadow-button flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> {tr('birlesdir_retry_button', 'Yenidən cəhd et')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { void gameAds.transition(onExit); }}
                className="py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> {tr('birlesdir_menu_button', 'Menyu')}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom safe-area spacer (game covers the app bottom nav) */}
      <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </div>,
  document.body);
};

export default BirlesdirGame;
