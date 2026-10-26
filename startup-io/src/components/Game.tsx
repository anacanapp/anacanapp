import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, ChevronLeft, Clock3, Home, Infinity as InfinityIcon, Info, Maximize2, Pause, Play, RotateCcw, Shield, Sparkles, Trophy, Users, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { audio } from '../audio';
import { resultCredits } from '../economy';
import { formatMoney, formatTime } from '../game/assets';
import type { PhaserArena } from '../game/phaser-arena';
import { GameSimulation } from '../game/simulation';
import type { GameResult, GameSnapshot, Input, RunSave } from '../game/model';
import { assetName, copy, districtName } from '../i18n';
import type { Language } from '../i18n';
import { listenForAppState, listenForBack } from '../native';
import type { Progress } from '../persistence';
import { Controls } from './Controls';
import { Coin, Logo } from './Logo';
import { project } from '../game/isometric';
import { prepareLogoImage } from '../game/logo-art';
import { FUND_BY_ID } from '../game/market';

declare global { interface Window { __startupio?: { game: GameSimulation; snapshot: () => GameSnapshot; metrics: () => { engine: string; renderer: string; frames: number; sprites: number; textures: number } } } }
interface GameProps { saved?: RunSave; progress: Progress; onResult: (result: GameResult) => void; onCheckpoint: (run: RunSave) => void; onHome: () => void; onRestart: () => void; onSound: () => void }
export function Game({ saved, progress, onResult, onCheckpoint, onHome, onRestart, onSound }: GameProps) {
  const sceneHost = useRef<HTMLDivElement>(null);
  const simulation = useRef<GameSimulation>(); const engine = useRef<PhaserArena>();
  const input = useRef<Input>({ x: 0, y: 0, boost: false }); const keys = useRef(new Set<string>());
  const callbacks = useRef({ onResult, onCheckpoint }); callbacks.current = { onResult, onCheckpoint };
  const [snapshot, setSnapshot] = useState<GameSnapshot>(); const [result, setResult] = useState<GameResult>();
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number }>(); const [restarting, setRestarting] = useState(false);
  const [showLeaders, setShowLeaders] = useState(false); const [showInfo, setShowInfo] = useState(false); const [wide, setWide] = useState(false);
  const t = copy(progress.settings.language); const languageRef = useRef<Language>(progress.settings.language); languageRef.current = progress.settings.language;
  const checkpoint = () => { const game = simulation.current; if (game && !game.result) callbacks.current.onCheckpoint(game.save()); };
  const pause = () => { simulation.current?.pause(); keys.current.clear(); input.current = { x: 0, y: 0, boost: false }; checkpoint(); if (simulation.current) setSnapshot(simulation.current.snapshot()); };
  const resume = () => { simulation.current?.resume(); audio.unlock(); if (simulation.current) setSnapshot(simulation.current.snapshot()); };
  const saveExit = () => { pause(); onHome(); };
  const restart = () => { simulation.current?.abandon(); onRestart(); };

  useEffect(() => { engine.current?.setDetails(progress.settings.details); }, [progress.settings.details]);
  useEffect(() => {
    if (!sceneHost.current) return;
    const game = new GameSimulation({ name: progress.name, color: progress.color, look: progress.look, saved, sector: progress.sector });
    simulation.current = game; if (saved) game.resume();
    setSnapshot(game.snapshot()); let toastTimeout: ReturnType<typeof setTimeout> | undefined;
    const handleEvent = (event: import('../game/model').GameEvent) => {
      audio.event(event);
      if (event.type === 'unlock' || event.type === 'acquisition') {
        const language = languageRef.current;
        setToast({ text: event.type === 'unlock' ? `${assetName(event.kind, language)} ${copy(language).newAsset}` : `${event.name} +${formatMoney(event.value)}`, id: Date.now() });
        clearTimeout(toastTimeout); toastTimeout = setTimeout(() => setToast(undefined), 2000);
      }
      if (event.type === 'opportunity' || event.type === 'mission') {
        const language = languageRef.current; const text = copy(language);
        const message = event.type === 'mission' ? `${text.missionDone} +${event.reward}` : event.kind === 'fund' ? `${FUND_BY_ID(event.fund).name} +${formatMoney(event.value)}` : event.kind === 'audit' ? `${text.audit} ${event.value < 0 ? `−${formatMoney(Math.abs(event.value))}` : text.protected}` : text[event.kind];
        setToast({ text: message, id: Date.now() }); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => setToast(undefined), 2400);
      }
      if (event.type === 'result') { if (event.result.reason !== 'quit') setResult(event.result); callbacks.current.onResult(event.result); }
    };
    const deactivate = () => { keys.current.clear(); input.current = { x: 0, y: 0, boost: false }; game.pause(); if (!game.result) callbacks.current.onCheckpoint(game.save()); setSnapshot(game.snapshot()); };
    const keydown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'Escape'].includes(event.code)) event.preventDefault();
      if (event.code === 'Escape' && !event.repeat) { if (game.status === 'playing') deactivate(); else if (game.status === 'paused') game.resume(); setSnapshot(game.snapshot()); }
      if (game.status === 'playing') keys.current.add(event.code);
    };
    const keyup = (event: KeyboardEvent) => keys.current.delete(event.code);
    const visibility = () => { if (document.hidden) deactivate(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', deactivate);
    window.addEventListener('pagehide', deactivate); document.addEventListener('visibilitychange', visibility);
    const removeAppState = listenForAppState(active => { if (!active) deactivate(); }); const removeBack = listenForBack(() => { if (game.status === 'playing') deactivate(); });
    let disposed = false; let lastSave = game.elapsed;
    void Promise.all([import('../game/phaser-arena'), prepareLogoImage(progress.look)]).then(([{ createPhaserArena }]) => {
      if (disposed || !sceneHost.current) return;
      const arena = createPhaserArena(sceneHost.current, { simulation: game, details: progress.settings.details,
        input: () => {
      const x = (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) - (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0);
      const y = (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0) - (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0);
      const boost = keys.current.has('Space') || keys.current.has('ShiftLeft') || keys.current.has('ShiftRight') || input.current.boost;
      const pivot = keys.current.has('KeyQ') || input.current.pivot === true;
      input.current.pivot = false;
      return x || y ? { x, y, boost, pivot } : { ...input.current, boost, pivot };
        }, onEvent: handleEvent, onSuspend: deactivate, onReady: () => setReady(true), onSnapshot: value => {
          setSnapshot(value);
          if (game.started && !game.result && game.elapsed - lastSave >= 8) { callbacks.current.onCheckpoint(game.save()); lastSave = game.elapsed; }
        },
      });
      engine.current = arena;
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('e2e')) window.__startupio = { game, snapshot: () => game.snapshot(), metrics: arena.metrics };
    });
    return () => { disposed = true; engine.current?.destroy(); clearTimeout(toastTimeout); keys.current.clear(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', deactivate); window.removeEventListener('pagehide', deactivate); document.removeEventListener('visibilitychange', visibility); removeAppState(); removeBack(); if (window.__startupio?.game === game) delete window.__startupio; simulation.current = undefined; engine.current = undefined; };
    // A new/resumed company has an isolated fixed-step lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <main className="game-screen endless-game phaser-game polished-game" style={{ '--player-color': progress.color } as CSSProperties} data-testid="game-screen" data-engine="phaser"><div ref={sceneHost} className="phaser-host" aria-label="startup.io arena" />{!ready && <div className="engine-loading"><span className="loading-orbit" /><b>VENTURE CITY</b><small>Phaser · 2.5D</small></div>}{snapshot && ready && <>
    <header className="clean-hud arena-topbar"><div className="clean-valuation"><span className="hud-logo"><Logo id={progress.look.logo} size={18} color={progress.color} look={progress.look} /></span><div><span className="valuation-eyebrow">{t.valuation}</span><strong data-testid="valuation">{formatMoney(snapshot.mass)}</strong></div></div><span className="clean-run-coins"><Coin size={14} />+{snapshot.credits}</span><button className={`clean-rank ${snapshot.rankChange > 0 ? 'rank-up' : ''}`} onClick={() => setShowLeaders(value => !value)} aria-label={showLeaders ? t.leaderClose : t.leaderOpen}><Trophy size={14} /><b>#{snapshot.rank}</b>{snapshot.rankChange > 0 && <i>↑{snapshot.rankChange}</i>}</button><button className="icon-button" onClick={pause} aria-label={t.pause} data-testid="pause"><Pause size={17} /></button></header>
    <div className="arena-room-strip"><span className="room-id">{snapshot.room}<b><InfinityIcon size={10} />UNLIMITED</b></span><span className="room-founder-count"><Users size={11} />{snapshot.founders}<small>{t.botFounders}</small></span></div>
    {snapshot.danger && snapshot.status === 'playing' && <div className="takeover-warning" role="status" data-testid="takeover-warning" style={{ '--takeover-progress': `${snapshot.danger.progress * 100}%` } as CSSProperties}><AlertTriangle size={15} /><span><b>{t.takeoverWarning}</b><small>{snapshot.danger.name} · {t.pivotHint}</small></span><ArrowRight size={15} style={{ transform: `rotate(${Math.atan2(project(snapshot.danger).y, project(snapshot.danger).x)}rad)` }} /></div>}
    {snapshot.mission && <div className="founder-mission-chip" data-testid="founder-mission"><span><b>{t[snapshot.mission.id as 'first-funding']}</b><small>+{snapshot.mission.reward} <Coin size={11} /></small></span><div className="mission-progress"><i style={{ width: `${snapshot.mission.progress / snapshot.mission.target * 100}%` }} /></div><em>{snapshot.mission.progress}/{snapshot.mission.target}</em></div>}
    {snapshot.market.active && <div className={`market-phase-chip phase-${snapshot.market.phase}`}><Sparkles size={11} /><b>{t[snapshot.market.phase]}</b><span>{Math.ceil(snapshot.market.remaining)}s</span></div>}
    {snapshot.powers.length > 0 && <div className="active-powers">{snapshot.powers.map(power => <span key={power.kind} className={`power-${power.kind}`} title={t[power.kind]}>{power.kind === 'firewall' ? <Shield size={12} /> : power.kind === 'accelerator' ? <Zap size={12} /> : power.kind === 'magnet' ? <Users size={12} /> : <BriefcaseBusiness size={12} />}<b>{Math.ceil(power.until - snapshot.elapsed)}s</b></span>)}</div>}
    {snapshot.nearestFund && <div className="venture-beacon" aria-label={t.fund}><BriefcaseBusiness size={14} /><span>{t.fund}<b>+{formatMoney(snapshot.nearestFund.value)}</b></span><ArrowRight size={16} style={{ transform: `rotate(${Math.atan2(project(snapshot.nearestFund).y, project(snapshot.nearestFund).x)}rad)` }} /></div>}
    {showLeaders && <aside className="market-leaders"><h3>{t.leaderboard}<button onClick={() => setShowLeaders(false)} aria-label={t.leaderClose}><X size={13} /></button></h3>{snapshot.leaderboard.map((actor, index) => <div className={`leader-row ${actor.player ? 'is-player' : ''}`} key={actor.id}><span>{index + 1}</span><Logo id={actor.logo} size={13} color={actor.color} look={actor.player ? progress.look : undefined} /><b>{actor.player ? t.you : actor.name}</b><em>{formatMoney(actor.mass)}</em></div>)}</aside>}
    {!showLeaders && <aside className="arena-event-feed" aria-label={t.marketActivity} data-testid="arena-feed">{snapshot.activity.slice(-2).map(event => <div className={`arena-feed-row event-${event.type}`} key={event.id}><Logo id={event.actor.logo} size={11} color={event.actor.color} look={event.actor.id === 0 ? progress.look : undefined} /><b>{event.actor.name}</b>{event.type === 'joined' ? <span>{t.joinedArena}</span> : <><ArrowRight size={9} />{event.target && <Logo id={event.target.logo} size={11} color={event.target.color} />}<span>{event.target?.name}</span></>}</div>)}</aside>}
    <div className="quiet-district district-corner">{districtName(snapshot.district, progress.settings.language)}</div>
    <div className="arena-map-dock quiet-map"><div className="minimap" aria-label={t.market}><div className="map-grid" />{snapshot.map.map(actor => { const p = project({ x: actor.x - .5, y: actor.y - .5 }); return <i key={actor.id} className={actor.id === 0 ? 'map-player' : actor.threat ? 'map-threat' : 'map-bot'} style={{ left: `${Math.max(4, Math.min(96, 50 + p.x * 80))}%`, top: `${Math.max(4, Math.min(96, 50 + p.y * 100))}%` }} />; })}</div><div className="map-tools"><button onClick={() => { setWide(!wide); engine.current?.setWide(!wide); }} aria-label={wide ? t.zoomIn : t.zoomOut}><Maximize2 size={12} /></button><button onClick={() => setShowInfo(!showInfo)} aria-label={t.info}><Info size={12} /></button></div></div>
    {showInfo && <aside className="arena-info-card"><h3>{t.infoTitle}<button onClick={() => setShowInfo(false)} aria-label={t.close}><X size={14} /></button></h3><p>{t.infoText}</p><div><span>{t.time}</span><b>{formatTime(snapshot.elapsed)}</b></div><div><span>{t.record}</span><b>{formatMoney(progress.endless.bestMass)}</b></div>{snapshot.nextAsset && <div><span>{assetName(snapshot.nextAsset.kind, progress.settings.language)}</span><b>{formatMoney(snapshot.nextAsset.requiredMass)}</b></div>}{snapshot.mission && <div className="mission-detail"><span>{t[snapshot.mission.id as 'first-funding']}</span><b>{snapshot.mission.progress}/{snapshot.mission.target} · +{snapshot.mission.reward}</b></div>}</aside>}
    {snapshot.shield > 0 && snapshot.started && snapshot.status === 'playing' && <div className="quiet-shield"><Shield size={10} /><span>{Math.ceil(snapshot.shield)}s</span></div>}
    {toast && snapshot.status === 'playing' && <div className="game-toast" key={toast.id}><Sparkles size={14} />{toast.text}</div>}
    {snapshot.status === 'playing' && <Controls input={input} energy={snapshot.energy} boosting={snapshot.boosting} language={progress.settings.language} sensitivity={progress.settings.sensitivity} pivotCooldown={snapshot.pivotCooldown} started={snapshot.started} />}
    {snapshot.status === 'paused' && !result && <div className="game-overlay"><section className="game-dialog pause-dialog" role="dialog" aria-modal="true" aria-label={t.paused} data-testid="pause-dialog"><div className="dialog-top"><span className="eyebrow">STARTUP.IO ∞</span><button className="icon-button" onClick={resume} aria-label={t.close}><X size={18} /></button></div><div className="dialog-symbol"><InfinityIcon size={30} /></div><h1>{restarting ? t.leaveTitle : t.paused}</h1><p>{restarting ? t.leaveText : t.pausedText}</p>{restarting ? <><button className="primary-button" onClick={restart}>{t.newRun}<ArrowRight size={18} /></button><button className="text-button" onClick={() => setRestarting(false)}>{t.stay}</button></> : <><button className="primary-button" onClick={resume} data-testid="resume">{t.resume}<Play size={17} fill="currentColor" /></button><div className="pause-secondary"><button onClick={saveExit} data-testid="save-exit"><Home size={15} />{t.saveExit}</button><button onClick={() => setRestarting(true)}><RotateCcw size={15} />{t.newRun}</button></div><div className="pause-credit-line"><Coin size={14} /><span>{t.earned}</span><b>+{snapshot.credits}</b></div><button className="audio-toggle" onClick={onSound}>{progress.settings.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}{t.sound}<span>{progress.settings.sound ? t.on : t.off}</span></button></>}</section></div>}
    {result && <div className="game-overlay result-overlay result-lost"><section className="game-dialog result-dialog unlimited-result" role="dialog" aria-modal="true" aria-label={t.lost} data-testid="result-dialog"><div className="dialog-top"><span className="eyebrow">{t.summary}</span><button className="icon-button" onClick={onHome} aria-label={t.home}><X size={18} /></button></div><div className="result-symbol"><Logo id={progress.look.logo} size={37} color={progress.color} look={progress.look} /></div><h1>{t.lost}</h1><p><strong>{result.killer}</strong> {t.lostCompetitor}</p><div className="result-valuation"><span>{t.valuation}</span><strong>{formatMoney(result.mass)}</strong></div><div className="result-stats"><div><ArrowUpRight size={15} /><b>{result.stats.investments}</b><span>{t.collected}</span></div><div><Building2 size={15} /><b>{result.stats.assets}</b><span>{t.assets}</span></div><div><Trophy size={15} /><b>{result.stats.acquisitions}</b><span>{t.acquisitions}</span></div><div><Clock3 size={15} /><b>{formatTime(result.elapsed)}</b><span>{t.time}</span></div></div><div className="result-reward"><Coin size={27} /><div><span>{t.earned}</span><strong>+{resultCredits(result)}</strong></div><small>{t.autosave}</small></div><button className="primary-button" onClick={onRestart} data-testid="result-primary">{t.retry}<ArrowRight size={18} /></button><button className="text-button" onClick={onHome}><ChevronLeft size={14} />{t.home}</button></section></div>}
  </>}</main>;
}
