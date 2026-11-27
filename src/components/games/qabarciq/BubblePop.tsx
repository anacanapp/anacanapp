import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Clock, Link2, Pause, Play, Rainbow, Share2, Sparkles, Volume2, VolumeX, WandSparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { pushBackHandler } from '@/lib/backButton';
import { hapticFeedback, nativeShare } from '@/lib/native';
import { appLanguageLocale, normalizeAppLanguage } from '@/lib/app-languages';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { useGameAds } from '@/hooks/useGameAds';
import { useMyGameScore, useSubmitGameScore } from '@/hooks/useGameScores';
import { trackEvent, useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import {
  BUBBLE_ID, COLS, COMBO_WINDOW_MS, MAX_SCORE, ROUND_SECONDS, ROWS, START_RAINBOWS, START_WANDS,
  cellsOfColor, createBoard, emptyStats, findGroup, multiplierFor, pointsFor, removeCells,
  type BoardState, type RoundStats,
} from './engine';
import { bubbleText, type BubbleKey } from './messages';
import { useWeeklyLeaderboard, type WeeklyRow } from './useWeeklyLeaderboard';
import './bubble-pop.css';

const BEST_KEY = 'anacan:qabarciq:best:v1';
const SOUND_KEY = 'anacan:qabarciq:sound:v1';
const readNumber = (k: string) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const readSound = () => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } };

type View = 'lobby' | 'play' | 'result';
interface Ghost { id: number; c: number; r: number; color: number }
interface Burst { id: number; x: number; y: number; text: string; color: number }
interface Result extends RoundStats { record: boolean }

let audio: AudioContext | null = null;
function popSound(combo: number, big: boolean) {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    const base = 420 + Math.min(combo, 10) * 45;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * (big ? 2.4 : 1.8), t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(audio.destination);
    osc.start(t); osc.stop(t + 0.18);
  } catch { /* audio unavailable */ }
}

function Avatar({ row, you }: { row: { name: string | null; avatarUrl: string | null }; you?: string }) {
  const label = row.name || you || '?';
  return row.avatarUrl
    ? <img className="bp-avatar" src={row.avatarUrl} alt="" loading="lazy" />
    : <span className="bp-avatar" data-tone={label.charCodeAt(0) % 6} aria-hidden="true">{label.trim().charAt(0).toUpperCase()}</span>;
}

function HeroBubbles() {
  const circles: [number, number, number, number][] = [[72, 88, 44, 0], [140, 70, 34, 2], [190, 100, 30, 3], [118, 130, 52, 1], [184, 160, 40, 5], [64, 158, 32, 0], [98, 196, 26, 4]];
  return <svg className="bp-hero-art" viewBox="0 0 260 230" aria-hidden="true">
    <defs>{['#f47c7c', '#f9a66c', '#7fd1a8', '#b79ceb', '#7fb8f0', '#f7d66b'].map((color, i) =>
      <radialGradient key={i} id={`bp-h${i}`} cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".22" stopColor={color} stopOpacity=".75" /><stop offset="1" stopColor={color} /></radialGradient>)}</defs>
    <circle cx="130" cy="125" r="104" fill="#ffe3d8" opacity=".55" />
    {circles.map(([x, y, r, c], i) => <circle key={i} className="bp-hero-bubble" style={{ animationDelay: `${i * 0.35}s` }} cx={x} cy={y} r={r} fill={`url(#bp-h${c})`} />)}
    {[[34, 70], [226, 64], [222, 190], [40, 206], [150, 24]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} fill={i % 2 ? '#b79ceb' : '#f9a66c'} />)}
  </svg>;
}

export default function BubblePop({ onBack }: { onBack: () => void }) {
  useScreenAnalytics('BubblePop', 'MiniGames');
  const language = normalizeAppLanguage(useUserStore(state => state.language));
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const fmt = useMemo(() => new Intl.NumberFormat(appLanguageLocale(language), { maximumFractionDigits: 0 }), [language]);
  const t = useCallback((k: BubbleKey, v: Record<string, string | number> = {}) =>
    bubbleText(language, k, Object.fromEntries(Object.entries(v).map(([n, x]) => [n, typeof x === 'number' ? fmt.format(x) : x]))), [language, fmt]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const submit = useSubmitGameScore(BUBBLE_ID);
  const { data: myScore } = useMyGameScore(BUBBLE_ID);
  const weekly = useWeeklyLeaderboard(BUBBLE_ID, 20);

  const [view, setView] = useState<View>('lobby');
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(readSound);
  const [localBest, setLocalBest] = useState(() => readNumber(BEST_KEY));
  const best = Math.max(localBest, myScore?.best_score ?? 0);

  const [board, setBoard] = useState<BoardState>(() => createBoard(Date.now()));
  const [stats, setStats] = useState<RoundStats>(emptyStats);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(ROUND_SECONDS * 1000);
  const [wands, setWands] = useState(START_WANDS);
  const [rainbows, setRainbows] = useState(START_RAINBOWS);
  const [mode, setMode] = useState<'pop' | 'wand' | 'rainbow'>('pop');
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [fresh, setFresh] = useState<Map<number, number>>(new Map());
  const [shake, setShake] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const endAt = useRef(0), lastPop = useRef(0), comboRef = useRef(0), seq = useRef(1);
  const boardRef = useRef(board); boardRef.current = board;
  const statsRef = useRef(stats); statsRef.current = stats;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const viewRef = useRef(view); viewRef.current = view;
  const leftRef = useRef(left); leftRef.current = left;
  const bestRef = useRef(best); bestRef.current = best;

  const gameAds = useGameAds(BUBBLE_ID, view === 'result' ? 'won' : view === 'play' ? (paused ? 'paused' : 'playing') : 'menu', () => {});

  // Board size: the largest square cell that fits the available area.
  const fieldRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(40);
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || view !== 'play') return;
    const measure = () => setCell(Math.max(24, Math.floor(Math.min(el.clientWidth / COLS, el.clientHeight / ROWS))));
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const start = useCallback(() => {
    const next = createBoard(Date.now());
    setBoard(next); setStats(emptyStats()); setCombo(0); comboRef.current = 0; lastPop.current = 0;
    setWands(START_WANDS); setRainbows(START_RAINBOWS); setMode('pop'); setGhosts([]); setBursts([]); setResult(null);
    setFresh(new Map(next.grid.flatMap((col, c) => col.map((b, r) => [b.id, r + 1 + c % 3] as [number, number]))));
    setLeft(ROUND_SECONDS * 1000); endAt.current = performance.now() + ROUND_SECONDS * 1000;
    setPaused(false); setView('play');
    gameAds.resetRound();
    trackEvent('minigame_level_started', { game_id: BUBBLE_ID, level: 1 });
  }, [gameAds]);

  const finish = useCallback(() => {
    const s = statsRef.current, score = Math.min(MAX_SCORE, s.score);
    const record = score > 0 && score > bestRef.current;
    if (record) { write(BEST_KEY, String(score)); setLocalBest(score); }
    setResult({ ...s, score, record });
    setView('result'); setMode('pop');
    trackEvent('minigame_level_won', { game_id: BUBBLE_ID, level: 1, score });
    if (score > 0 && user) {
      submit.mutateAsync({ score, level: 1 }).then(() => queryClient.invalidateQueries({ queryKey: ['game-weekly-leaderboard'] })).catch(() => {});
    }
    void hapticFeedback.medium();
  }, [submit, queryClient, user]);

  // Clock
  useEffect(() => {
    if (view !== 'play' || paused) return;
    endAt.current = performance.now() + leftRef.current;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, endAt.current - performance.now());
      setLeft(remaining);
      if (comboRef.current && Date.now() - lastPop.current > COMBO_WINDOW_MS) { comboRef.current = 0; setCombo(0); }
      if (remaining <= 0) { window.clearInterval(id); finish(); }
    }, 100);
    return () => window.clearInterval(id);
  }, [view, paused, finish]);

  // Pause when the app goes to background
  useEffect(() => {
    const hidden = () => { if (document.hidden && viewRef.current === 'play') setPaused(true); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  // Hardware back
  const backRef = useRef(() => {});
  backRef.current = () => {
    if (view === 'play') { if (!paused) setPaused(true); else setView('lobby'); }
    else if (view === 'result') setView('lobby');
    else onBack();
  };
  useEffect(() => pushBackHandler(() => { backRef.current(); return true; }), []);

  const pop = useCallback((cells: [number, number][], points: number, kind: 'group' | 'wand' | 'rainbow') => {
    const current = boardRef.current;
    const now = Date.now();
    const nextCombo = now - lastPop.current <= COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
    lastPop.current = now; comboRef.current = nextCombo; setCombo(nextCombo);
    const gained = kind === 'group' ? pointsFor(cells.length, nextCombo) : points;
    const next = removeCells(current, cells);
    // New bubbles drop from above: offset = number removed in that column.
    const removedPerCol = new Array(COLS).fill(0);
    cells.forEach(([c]) => { removedPerCol[c]++; });
    const spawned = new Map<number, number>();
    next.grid.forEach((col, c) => col.forEach((b, r) => { if (b.id >= current.nextId) spawned.set(b.id, removedPerCol[c]); }));
    setFresh(spawned);
    setBoard(next);
    const color = current.grid[cells[0][0]][cells[0][1]].color;
    const gid = seq.current;
    setGhosts(g => [...g.slice(-40), ...cells.map(([c, r], i) => ({ id: gid * 1000 + i, c, r, color }))]);
    const cx = cells.reduce((a, [c]) => a + c, 0) / cells.length, cy = cells.reduce((a, [, r]) => a + r, 0) / cells.length;
    const burstId = seq.current++;
    setBursts(b => [...b.slice(-6), { id: burstId, x: cx, y: cy, text: `+${fmt.format(gained)}`, color }]);
    window.setTimeout(() => {
      setGhosts(g => g.filter(x => Math.floor(x.id / 1000) !== gid));
      setBursts(b => b.filter(x => x.id !== burstId));
    }, 750);
    setStats(s => ({ score: Math.min(MAX_SCORE, s.score + gained), popped: s.popped + cells.length, bestCombo: Math.max(s.bestCombo, nextCombo), pops: s.pops + 1 }));
    if (sound) popSound(nextCombo, cells.length >= 6 || kind !== 'group');
    void (cells.length >= 6 || kind !== 'group' ? hapticFeedback.medium() : hapticFeedback.light());
  }, [fmt, sound]);

  const tap = useCallback((c: number, r: number) => {
    if (viewRef.current !== 'play' || pausedRef.current) return;
    const grid = boardRef.current.grid;
    if (mode === 'wand' && wands > 0) {
      const group = findGroup(grid, c, r);
      setWands(w => w - 1); setMode('pop');
      pop(group, Math.round(Math.max(1, group.length) ** 2 * 5 * multiplierFor(comboRef.current + 1)) + 50, 'wand');
      return;
    }
    if (mode === 'rainbow' && rainbows > 0) {
      const cells = cellsOfColor(grid, grid[c][r].color);
      setRainbows(n => n - 1); setMode('pop');
      pop(cells, Math.round(cells.length * 25 * multiplierFor(comboRef.current + 1)), 'rainbow');
      return;
    }
    const group = findGroup(grid, c, r);
    if (group.length < 2) {
      const id = grid[c][r].id;
      setShake(id); window.setTimeout(() => setShake(s => (s === id ? null : s)), 320);
      return;
    }
    pop(group, 0, 'group');
  }, [mode, wands, rainbows, pop]);

  const toggleSound = () => { const next = !sound; setSound(next); write(SOUND_KEY, next ? 'on' : 'off'); };
  const share = async (score: number) => { await nativeShare({ title: t('title'), text: t('shareText', { score }) }); trackEvent('minigame_shared', { game_id: BUBBLE_ID, score }); };

  const seconds = Math.ceil(left / 1000);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const ring = 2 * Math.PI * 26;

  const board5 = weekly.data?.top ?? [];
  const meRow = weekly.data?.me;
  const meInTop = (rows: WeeklyRow[]) => !!user && rows.some(row => row.userId === user.id);

  const rankList = (count: number, compact: boolean) => {
    if (!user) return <p className="bp-note">{t('signIn')}</p>;
    if (weekly.isLoading) return <div className="bp-skeleton" aria-hidden="true" />;
    if (weekly.isError) return <div className="bp-note">{t('loadError')} <button type="button" className="bp-link" onClick={() => weekly.refetch()}>{t('retry')}</button></div>;
    const rows = board5.slice(0, count);
    if (!rows.length) return <p className="bp-note">{t('empty')}</p>;
    return <ol className={`bp-ranks${compact ? ' compact' : ''}`}>
      {rows.map(row => <li key={row.userId} className={row.userId === user.id ? 'me' : ''}>
        <span className="bp-rank" data-top={row.rank <= 3 ? row.rank : undefined}>{row.rank}</span>
        <Avatar row={row} you={t('you')} />
        <span className="bp-name">{row.userId === user.id ? t('you') : row.name || t('player')}</span>
        <b>{fmt.format(row.score)}</b>
      </li>)}
      {meRow && !meInTop(rows) && <li className="me">
        <span className="bp-rank">{fmt.format(meRow.rank)}</span>
        <Avatar row={{ name: t('you'), avatarUrl: null }} />
        <span className="bp-name">{t('you')}</span>
        <b>{fmt.format(meRow.score)}</b>
      </li>}
    </ol>;
  };

  const header = (title?: string) => <header className="bp-top">
    <button type="button" className="bp-icon" onClick={() => backRef.current()} aria-label={t('back')}><ArrowLeft className="bp-flip" size={19} /></button>
    {title ? <h1>{title}</h1> : <span />}
    <button type="button" className="bp-icon" onClick={toggleSound} aria-label={t('sound')} aria-pressed={sound}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
  </header>;

  let body: JSX.Element;
  if (view === 'lobby') {
    body = <div className="bp-lobby">
      {header()}
      <div className="bp-hero">
        <h1 className="bp-title">{t('title')}</h1>
        <p className="bp-tagline">{t('tagline')}</p>
        <HeroBubbles />
      </div>
      <div className="bp-best">{t('best')}: <b>{fmt.format(best)}</b></div>
      <button type="button" className="bp-primary bp-play" onClick={start}><Play size={20} fill="currentColor" />{t('play')}</button>
      <p className="bp-howto">{t('howTo')}</p>
      <section className="bp-card">
        <div className="bp-card-head"><h2>{t('weekly')}</h2>{weekly.data && <span>{t('players', { n: weekly.data.players })}</span>}</div>
        {rankList(3, true)}
        <p className="bp-reset">{t('resets')}</p>
      </section>
    </div>;
  } else if (view === 'play') {
    const w = cell * COLS, h = cell * ROWS;
    body = <div className="bp-play-view">
      <div className="bp-hud">
        <button type="button" className="bp-icon light" onClick={() => setPaused(true)} aria-label={t('paused')}><Pause size={18} fill="currentColor" /></button>
        <div className="bp-score" aria-live="polite">{fmt.format(stats.score)}</div>
        <div className="bp-clock" data-low={seconds <= 10 || undefined}>
          <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" className="bp-ring-bg" /><circle cx="30" cy="30" r="26" className="bp-ring" strokeDasharray={ring} strokeDashoffset={ring * (1 - left / (ROUND_SECONDS * 1000))} /></svg>
          <span>{clock}</span>
        </div>
        <div className={`bp-combo${combo >= 2 ? ' on' : ''}`} key={combo}>{combo >= 2 && <><Sparkles size={13} />{t('combo', { n: combo })}</>}</div>
      </div>
      <div className="bp-field" ref={fieldRef}>
        <div className={`bp-board${mode !== 'pop' ? ' picking' : ''}`} style={{ width: w, height: h, ['--cell' as string]: `${cell}px` }} dir="ltr">
          {board.grid.map((col, c) => col.map((b, r) => {
            const drop = fresh.get(b.id);
            return <button type="button" key={b.id} className={`bp-bubble${drop ? ' drop' : ''}${shake === b.id ? ' nope' : ''}`} data-color={b.color}
              style={{ ['--x' as string]: `${c * cell}px`, ['--y' as string]: `${r * cell}px`, ['--drop' as string]: `${(drop ?? 0) * cell + cell}px` }}
              onPointerDown={e => { e.preventDefault(); tap(c, r); }} aria-label={`${c + 1}:${r + 1}`} tabIndex={-1} />;
          }))}
          {ghosts.map(g => <span key={g.id} className="bp-ghost" data-color={g.color} style={{ ['--x' as string]: `${g.c * cell}px`, ['--y' as string]: `${g.r * cell}px` }} />)}
        </div>
        <div className="bp-fx" style={{ width: w, height: h }} dir="ltr" aria-hidden="true">
          {bursts.map(b => <span key={b.id} className="bp-burst" data-color={b.color} style={{ left: (b.x + 0.5) * cell, top: (b.y + 0.5) * cell }}>
            <i /><i /><i /><i /><i /><i /><i /><i /><em>{b.text}</em></span>)}
        </div>
      </div>
      <div className="bp-tools">
        {mode !== 'pop' && <p className="bp-hint">{t(mode === 'wand' ? 'pickWand' : 'pickRainbow')}</p>}
        <button type="button" className={`bp-tool wand${mode === 'wand' ? ' active' : ''}`} disabled={!wands} onClick={() => setMode(m => (m === 'wand' ? 'pop' : 'wand'))} aria-label={t('wand')}>
          <WandSparkles size={24} /><span className="bp-count">{wands}</span></button>
        <button type="button" className={`bp-tool rainbow${mode === 'rainbow' ? ' active' : ''}`} disabled={!rainbows} onClick={() => setMode(m => (m === 'rainbow' ? 'pop' : 'rainbow'))} aria-label={t('rainbow')}>
          <Rainbow size={24} /><span className="bp-count">{rainbows}</span></button>
      </div>
      {paused && <div className="bp-modal" role="dialog" aria-modal="true" aria-label={t('paused')}>
        <div className="bp-modal-panel">
          <h2>{t('paused')}</h2>
          <p className="bp-modal-score">{fmt.format(stats.score)}</p>
          <button type="button" className="bp-primary" onClick={() => setPaused(false)}><Play size={18} fill="currentColor" />{t('resume')}</button>
          <button type="button" className="bp-secondary" onClick={() => { setPaused(false); setView('lobby'); }}>{t('quit')}</button>
        </div>
      </div>}
    </div>;
  } else {
    const r = result ?? { ...emptyStats(), record: false };
    body = <div className="bp-result">
      {header()}
      <section className="bp-result-card">
        <p className="bp-timeup">{t('timeUp')}</p>
        <h1>{t(r.record || r.score >= 8000 ? 'great' : 'good')}</h1>
        <div className="bp-big">{fmt.format(r.score)}{r.record && <span className="bp-record">{t('newRecord')}</span>}</div>
        <div className="bp-stats">
          <div><Sparkles size={16} /><span>{t('popped')}</span><b>{fmt.format(r.popped)}</b></div>
          <div><Link2 size={16} /><span>{t('bestCombo')}</span><b>x{fmt.format(r.bestCombo)}</b></div>
          <div><Clock size={16} /><span>{t('time')}</span><b>{t('seconds', { n: ROUND_SECONDS })}</b></div>
        </div>
      </section>
      <section className="bp-card grow">
        <div className="bp-card-head"><h2>{t('weeklyTitle')}</h2>{weekly.data && <span>{t('players', { n: weekly.data.players })}</span>}</div>
        {rankList(5, false)}
      </section>
      <div className="bp-actions">
        <button type="button" className="bp-primary" disabled={gameAds.waiting} onClick={() => gameAds.transition(start)}>{t('again')}</button>
        <button type="button" className="bp-secondary" onClick={() => share(r.score)}><Share2 size={17} />{t('share')}</button>
      </div>
    </div>;
  }

  return createPortal(<div className="bp-screen" lang={language} dir={dir} data-testid="bubble-pop-screen" data-game-id={BUBBLE_ID}
    data-game-phase={view === 'play' ? (paused ? 'paused' : 'playing') : view === 'result' ? 'won' : 'menu'}
    data-ad-block="true" data-ad-allow={gameAds.allowedPlacements}>
    <div className="bp-shell">{body}</div>
  </div>, document.body);
}
