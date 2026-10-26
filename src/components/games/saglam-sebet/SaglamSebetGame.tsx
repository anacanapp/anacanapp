import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Pause,
  Play,
  Heart,
  Trophy,
  RotateCcw,
  Home,
  ShoppingBasket,
  Clock,
  Star,
  Check,
} from 'lucide-react';
import { tr } from '@/lib/tr';
import { hapticFeedback } from '@/lib/native';
import { trTierName } from '../tierLabels';
import { useGameAds, type GameReviveBenefits } from '@/hooks/useGameAds';
import GameReviveAction from '../GameReviveAction';
import {
  GOOD_ITEMS,
  BAD_ITEMS,
  getLevelConfig,
  getStarsForScore,
  GameItemDef,
  TOTAL_LEVELS,
} from './levelConfig';

interface SaglamSebetGameProps {
  level: number;
  onExit: () => void;
  onLevelComplete: (result: { level: number; score: number; stars: 0 | 1 | 2 | 3; passed: boolean }) => void;
  onRetry?: () => void;
  onNextLevel?: () => void;
}

type Phase = 'intro' | 'countdown' | 'playing' | 'paused' | 'won' | 'lost';

interface FallingObject {
  id: number;
  x: number;
  y: number;
  speed: number;
  def: GameItemDef;
  isBad: boolean;
  size: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

const ITEM_SIZE = 42;
const BASKET_WIDTH = 96;
const BASKET_HEIGHT = 62;
const BASKET_BOTTOM_MARGIN = 18;

let objectIdCounter = 0;
let floatingIdCounter = 0;

const SaglamSebetGame = ({ level, onExit, onLevelComplete, onRetry, onNextLevel }: SaglamSebetGameProps) => {
  const config = getLevelConfig(level);

  const [phase, setPhase] = useState<Phase>('intro');
  const [countdownValue, setCountdownValue] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(config.lives);
  const [timeLeft, setTimeLeft] = useState(config.duration);
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [basketX, setBasketX] = useState(50); // percentage-ish px, set on measure
  const [shake, setShake] = useState(false);
  const [catchPulse, setCatchPulse] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 360, height: 560 });
  const [finalStars, setFinalStars] = useState<0 | 1 | 2 | 3>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const basketXRef = useRef(basketX);
  const phaseRef = useRef(phase);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const spawnAccumulatorRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(config.lives);
  // Objects live in a ref: the game loop mutates this pure data and pushes a
  // single state snapshot per frame. Catch side-effects (score, lives, haptics)
  // are applied OUTSIDE any setState updater so they can never double-fire.
  const objectsRef = useRef<FallingObject[]>([]);
  // One-shot guard: onLevelComplete must fire at most once per round,
  // structurally — independent of how many times the win/lose effect below
  // happens to re-run (e.g. due to a parent re-render recreating the
  // onLevelComplete prop reference right as a round ends).
  const completedRef = useRef(false);
  const restoreRound = useCallback((benefits: GameReviveBenefits) => {
    livesRef.current = Math.min(config.lives, benefits.lives);
    setLives(livesRef.current); setTimeLeft(value => Math.max(value, benefits.seconds));
    objectsRef.current = []; setObjects([]); setFloatingTexts([]);
    completedRef.current = false; lastFrameRef.current = 0; spawnAccumulatorRef.current = 0;
    phaseRef.current = 'playing'; setPhase('playing');
  }, [config.lives]);
  const gameAds = useGameAds('saglam-sebet', phase, restoreRound);
  // Pending window.setTimeout ids (floating +/- text, catch pulse, shake)
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

  // Unmount cleanup: cancel any still-pending timeouts so nothing touches
  // state after this instance is gone (relevant since `key={level}` fully
  // remounts this component on "next level", and onExit fully unmounts it).
  useEffect(() => {
    return () => {
      pendingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      pendingTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    basketXRef.current = basketX;
  }, [basketX]);

  // Measure play area
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
        setBasketX((prev) => (prev === 50 ? rect.width / 2 : Math.min(prev, rect.width - BASKET_WIDTH / 2)));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const spawnObject = useCallback((): FallingObject => {
    const isBad = Math.random() < config.badChance;
    const pool = isBad ? BAD_ITEMS : GOOD_ITEMS;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const paddingX = ITEM_SIZE;
    const x = paddingX + Math.random() * Math.max(containerSize.width - paddingX * 2, 40);
    const variance = 1 + (Math.random() * 2 - 1) * config.speedVariance;
    const speed = config.fallSpeed * variance;

    return {
      id: ++objectIdCounter,
      x,
      y: -ITEM_SIZE,
      speed,
      def,
      isBad,
      size: ITEM_SIZE,
    };
  }, [config.badChance, config.fallSpeed, config.speedVariance, containerSize.width]);

  const addFloatingText = useCallback(
    (x: number, y: number, text: string, color: string) => {
      const id = ++floatingIdCounter;
      setFloatingTexts((prev) => [...prev, { id, x, y, text, color }]);
      trackTimeout(
        window.setTimeout(() => {
          setFloatingTexts((prev) => prev.filter((f) => f.id !== id));
        }, 750)
      );
    },
    [trackTimeout]
  );

  const handleCatchGood = useCallback(
    (obj: FallingObject) => {
      scoreRef.current += obj.def.points;
      setScore(scoreRef.current);
      addFloatingText(obj.x, containerSize.height - BASKET_HEIGHT - BASKET_BOTTOM_MARGIN - 20, `+${obj.def.points}`, 'text-primary');
      setCatchPulse(true);
      trackTimeout(window.setTimeout(() => setCatchPulse(false), 180));
      hapticFeedback.light();
    },
    [addFloatingText, containerSize.height, trackTimeout]
  );

  const handleCatchBad = useCallback(
    (obj: FallingObject) => {
      livesRef.current = Math.max(0, livesRef.current - 1);
      setLives(livesRef.current);
      addFloatingText(obj.x, containerSize.height - BASKET_HEIGHT - BASKET_BOTTOM_MARGIN - 20, tr('saglamsebet_life_lost_text', '-1 ❤️'), 'text-destructive');
      setShake(true);
      trackTimeout(window.setTimeout(() => setShake(false), 320));
      hapticFeedback.heavy();
    },
    [addFloatingText, containerSize.height, trackTimeout]
  );

  // Main game loop — pure simulation on objectsRef, one state snapshot per frame,
  // side effects applied after the physics pass.
  useEffect(() => {
    if (phase !== 'playing') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
      return;
    }

    const tick = (now: number) => {
      if (phaseRef.current !== 'playing') return;
      if (!lastFrameRef.current) lastFrameRef.current = now;
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;

      spawnAccumulatorRef.current += dt * 1000;
      if (spawnAccumulatorRef.current >= config.spawnInterval) {
        spawnAccumulatorRef.current = 0;
        objectsRef.current = [...objectsRef.current, spawnObject()];
      }

      const basketTop = containerSize.height - BASKET_HEIGHT - BASKET_BOTTOM_MARGIN;
      const basketCenter = basketXRef.current;

      const caughtGood: FallingObject[] = [];
      const caughtBad: FallingObject[] = [];
      const next: FallingObject[] = [];

      for (const obj of objectsRef.current) {
        const newY = obj.y + obj.speed * dt;
        const centerY = newY + obj.size / 2;

        const inCatchZone = centerY >= basketTop - 6 && centerY <= basketTop + BASKET_HEIGHT * 0.55;
        const withinX = Math.abs(obj.x - basketCenter) <= BASKET_WIDTH / 2 + obj.size / 2 - 14;

        if (inCatchZone && withinX) {
          if (obj.isBad) caughtBad.push(obj);
          else caughtGood.push(obj);
          continue; // resolved — remove
        }

        if (newY > containerSize.height + 40) {
          continue; // fell past — remove (no penalty either way)
        }

        next.push({ ...obj, y: newY });
      }

      objectsRef.current = next;
      setObjects(next);

      for (const obj of caughtGood) handleCatchGood(obj);
      for (const obj of caughtBad) handleCatchBad(obj);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, config.spawnInterval, containerSize.height, spawnObject, handleCatchBad, handleCatchGood]);

  // Countdown timer (seconds remaining in the level)
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  // Win / lose condition watcher.
  // The round always runs for its full duration: reaching the target early no
  // longer ends the level (otherwise the 2-3 star thresholds — 1.25× and 1.6×
  // the target — would be mathematically unreachable). At time-up the result
  // is evaluated; running out of lives ends the level immediately.
  useEffect(() => {
    if (phase !== 'playing') return;
    if (lives <= 0) {
      setPhase('lost');
      return;
    }
    if (timeLeft <= 0) {
      if (score >= config.targetScore) {
        const stars = getStarsForScore(score, config.targetScore);
        setFinalStars(stars);
        setPhase('won');
        if (!completedRef.current) {
          completedRef.current = true;
          onLevelComplete({ level, score, stars, passed: true });
        }
        hapticFeedback.medium();
      } else {
        setPhase('lost');
      }
    }
  }, [lives, score, timeLeft, phase, config.targetScore, level, onLevelComplete]);

  useEffect(() => {
    if (phase === 'lost' && !completedRef.current) {
      completedRef.current = true;
      onLevelComplete({ level, score, stars: 0, passed: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startCountdown = () => {
    setPhase('countdown');
    setCountdownValue(3);
  };

  // 3 → 2 → 1 → "Go!" (shown briefly at 0) → playing
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownValue < 0) {
      setPhase('playing');
      lastFrameRef.current = 0;
      return;
    }
    const t = window.setTimeout(() => setCountdownValue((v) => v - 1), countdownValue === 0 ? 500 : 700);
    return () => window.clearTimeout(t);
  }, [phase, countdownValue]);

  const resetGame = () => {
    scoreRef.current = 0;
    livesRef.current = config.lives;
    objectsRef.current = [];
    completedRef.current = false; // allow onLevelComplete to fire again for the new round
    setScore(0);
    setLives(config.lives);
    setTimeLeft(config.duration);
    setObjects([]);
    setFloatingTexts([]);
    setFinalStars(0);
    spawnAccumulatorRef.current = 0;
  };

  const handleRetry = () => {
    void gameAds.transition(() => {
      resetGame(); gameAds.resetRound(); startCountdown(); onRetry?.();
    });
  };

  // Pointer / touch drag handling for the basket
  const handlePointerMove = (clientX: number) => {
    if (!containerRef.current) return;
    if (phaseRef.current !== 'playing') return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const clamped = Math.max(BASKET_WIDTH / 2, Math.min(rect.width - BASKET_WIDTH / 2, relativeX));
    setBasketX(clamped);
  };

  const targetProgress = Math.min(100, Math.round((score / config.targetScore) * 100));
  const targetReached = score >= config.targetScore;
  const twoStarScore = Math.ceil(config.targetScore * 1.25);
  const threeStarScore = Math.ceil(config.targetScore * 1.6);

  // PORTAL: transform-lu valideynlərdə (motion kartlar) fixed overlay stacking
  // context tələsinə düşüb nav-ın altında qalırdı → səbət görünmürdü.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-sky-100 via-emerald-50 to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800" data-ad-block="true" data-ad-allow={gameAds.allowedPlacements} data-game-phase={phase} data-game-lives={lives} data-game-score={score}>
      {/* Status bar spacer */}
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
                {tr('saglamsebet_level_label', 'Səviyyə')} {level}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <Clock className="w-3 h-3" />
                {timeLeft}s
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${targetReached ? 'bg-emerald-500' : 'gradient-primary'}`}
                animate={{ width: `${targetProgress}%` }}
                transition={{ ease: 'easeOut', duration: 0.25 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {Array.from({ length: config.lives }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 transition-all ${i < lives ? 'text-rose-500 fill-rose-500' : 'text-muted-foreground/30'}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          {targetReached ? (
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <Check className="w-3 h-3" />
              {tr('saglamsebet_target_reached', 'Hədəf keçildi!')}{' '}
              {score < threeStarScore && (
                <span className="text-muted-foreground font-medium">
                  · {score < twoStarScore ? `⭐⭐ ${twoStarScore}` : `⭐⭐⭐ ${threeStarScore}`}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {tr('saglamsebet_target_prefix', 'Hədəf')}: {config.targetScore}
            </span>
          )}
          <span className="text-sm font-extrabold text-primary">{score}</span>
        </div>
      </div>

      {/* Play area */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden touch-none select-none ${shake ? 'animate-wiggle' : ''}`}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          handlePointerMove(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType === 'mouse') return;
          handlePointerMove(e.clientX);
        }}
      >
        {/* decorative clouds */}
        <div className="absolute top-6 start-6 text-3xl opacity-30 animate-float pointer-events-none">☁️</div>
        <div className="absolute top-16 end-10 text-2xl opacity-20 animate-float-delayed pointer-events-none">☁️</div>

        {/* Falling objects */}
        {objects.map((obj) => (
          <div
            key={obj.id}
            className="absolute leading-none drop-shadow-md pointer-events-none"
            style={{
              insetInlineStart: 0,
              top: 0,
              width: obj.size,
              height: obj.size,
              fontSize: obj.size * 0.8,
              // GPU compositing: layout (left/top) əvəzinə transform — daha axıcı
              transform: `translate3d(${obj.x - obj.size / 2}px, ${obj.y}px, 0)`,
              willChange: 'transform',
            }}
          >
            {obj.def.emoji}
          </div>
        ))}

        {/* Floating +/- text */}
        <AnimatePresence>
          {floatingTexts.map((ft) => (
            <motion.div
              key={ft.id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -40, scale: 1.1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className={`absolute font-extrabold text-sm pointer-events-none ${ft.color}`}
              style={{ insetInlineStart: ft.x - 16, top: ft.y }}
            >
              {ft.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Basket */}
        <motion.div
          className="absolute flex items-end justify-center pointer-events-none"
          style={{
            insetInlineStart: 0,
            bottom: BASKET_BOTTOM_MARGIN,
            width: BASKET_WIDTH,
            height: BASKET_HEIGHT,
            x: basketX - BASKET_WIDTH / 2,
            willChange: 'transform',
          }}
          animate={{ scale: catchPulse ? 1.12 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <div className="w-full h-full rounded-b-[28px] rounded-t-xl bg-gradient-to-b from-amber-400 to-amber-600 shadow-elevated border-2 border-amber-700/40 flex items-center justify-center relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0 3px, transparent 3px 8px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.15) 0 3px, transparent 3px 8px)',
              }}
            />
            <ShoppingBasket className="w-7 h-7 text-white/90 relative z-10" />
          </div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[70%] h-2 rounded-full bg-amber-700/50" />
        </motion.div>

        {/* Intro overlay */}
        {phase === 'intro' && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6 text-center z-30">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-1">
              <ShoppingBasket className="w-8 h-8 text-white" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
              {trTierName(config.tierName)}
            </span>
            <h2 className="text-xl font-bold text-foreground">
              {tr('saglamsebet_level_label', 'Səviyyə')} {level}
            </h2>
            <p className="text-sm text-muted-foreground max-w-[240px]">
              {tr(
                'saglamsebet_intro_desc',
                'Sağlam qidaları səbətə tut, zərərli qidalardan və stress buludlarından qaç!'
              )}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" /> {config.targetScore} {tr('saglamsebet_points_short', 'xal')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {config.duration}s
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500" /> {config.lives}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>⭐⭐ ≥ {twoStarScore}</span>
              <span>⭐⭐⭐ ≥ {threeStarScore}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startCountdown}
              className="mt-3 px-8 py-3 rounded-2xl gradient-primary text-white font-bold shadow-button"
            >
              {tr('saglamsebet_start_button', 'Başla')}
            </motion.button>
          </div>
        )}

        {/* Countdown overlay */}
        {phase === 'countdown' && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center z-30">
            <motion.div
              key={countdownValue}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="text-6xl font-black text-primary drop-shadow-lg"
            >
              {countdownValue > 0 ? countdownValue : tr('saglamsebet_go_text', 'Başla!')}
            </motion.div>
          </div>
        )}

        {/* Paused overlay */}
        {phase === 'paused' && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
            <h2 className="text-lg font-bold text-foreground">{tr('saglamsebet_paused_title', 'Fasilə')}</h2>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setPhase('playing')}
              className="w-48 py-3 rounded-2xl gradient-primary text-white font-bold shadow-button flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> {tr('saglamsebet_resume_button', 'Davam et')}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleRetry}
              className="w-48 py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> {tr('saglamsebet_restart_button', 'Yenidən başla')}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { void gameAds.transition(onExit); }}
              className="w-48 py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> {tr('saglamsebet_menu_button', 'Menyu')}
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
              className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-glow mb-1"
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
            <h2 className="text-xl font-bold text-foreground">{tr('saglamsebet_level_complete_title', 'Səviyyə tamamlandı!')}</h2>
            <div className="flex items-center gap-1 my-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15 + i * 0.15, type: 'spring', stiffness: 260, damping: 14 }}
                >
                  <Star
                    className={`w-9 h-9 ${i < finalStars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/25'}`}
                  />
                </motion.div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {tr('saglamsebet_your_score_prefix', 'Xalınız')}: <span className="font-bold text-foreground">{score}</span>
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[260px] mt-3">
              {level < TOTAL_LEVELS && onNextLevel && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { void gameAds.transition(onNextLevel); }}
                  className="py-3 rounded-2xl gradient-primary text-white font-bold shadow-button"
                >
                  {tr('saglamsebet_next_level_button', 'Növbəti səviyyə')}
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRetry}
                className="py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> {tr('saglamsebet_replay_button', 'Təkrar oyna')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { void gameAds.transition(onExit); }}
                className="py-3 rounded-2xl bg-muted/60 text-muted-foreground font-medium flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> {tr('saglamsebet_menu_button', 'Menyu')}
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
            <h2 className="text-xl font-bold text-foreground">
              {lives <= 0
                ? tr('saglamsebet_out_of_lives_title', 'Canlar bitdi!')
                : tr('saglamsebet_time_up_title', 'Vaxt bitdi!')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tr('saglamsebet_your_score_prefix', 'Xalınız')}: <span className="font-bold text-foreground">{score}</span> / {config.targetScore}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[260px] mt-3">
              <GameReviveAction ads={gameAds} game="basket" />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRetry}
                className="py-3 rounded-2xl gradient-primary text-white font-bold shadow-button flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> {tr('saglamsebet_retry_button', 'Yenidən cəhd et')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { void gameAds.transition(onExit); }}
                className="py-3 rounded-2xl bg-muted text-foreground font-semibold flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> {tr('saglamsebet_menu_button', 'Menyu')}
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

export default SaglamSebetGame;
