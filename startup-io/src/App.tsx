import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Cpu, Gamepad2, Globe2, Infinity as InfinityIcon, Info, Map, Paintbrush, Play, Rocket, Settings2, ShieldCheck, ShoppingBag, Trophy, Users, Volume2, X, Zap } from 'lucide-react';
import { audio } from './audio';
import { ArenaPreview } from './components/ArenaPreview';
import { Game } from './components/Game';
import { Coin, Logo, LogoToken } from './components/Logo';
import { Customize, Marketplace } from './components/Marketplace';
import { BRANDS } from './game/cosmetics';
import { ASSET_CATALOG, formatMoney, formatTime } from './game/assets';
import type { GameResult, RunSave } from './game/model';
import { assetName, copy } from './i18n';
import { listenForBack } from './native';
import { checkpointRun, loadProgress, recordResult, saveProgress } from './persistence';
import type { Progress } from './persistence';
import { freshProgress } from './persistence';
import { SECTORS } from './game/market';
import { LegalPanel } from './components/LegalPanel';
import { version as appVersion } from '../package.json';

type Tab = 'arena' | 'marketplace' | 'customize';
export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [run, setRun] = useState<{ key: number; saved?: RunSave }>();
  const [tab, setTab] = useState<Tab>('arena');
  const [modal, setModal] = useState<'settings' | 'tutorial' | 'new-run' | 'privacy' | 'terms' | 'support' | 'reset'>();
  const [pendingLaunch, setPendingLaunch] = useState(false);
  const progressRef = useRef(progress); progressRef.current = progress;
  const t = copy(progress.settings.language);
  const updateProgress = (next: Progress) => { progressRef.current = next; setProgress(next); saveProgress(next); };
  const update = (patch: Partial<Progress>) => updateProgress({ ...progressRef.current, ...patch });
  const navigate = (value: Tab) => { setTab(value); window.scrollTo({ top: 0, behavior: 'instant' }); };
  useEffect(() => { saveProgress(progress); audio.configure(progress.settings.sound, progress.settings.haptics); document.documentElement.lang = progress.settings.language; }, [progress]);
  useEffect(() => {
    const close = () => { if (modal) { setModal(undefined); setPendingLaunch(false); } else if (tab !== 'arena') navigate('arena'); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', escape); const remove = !run ? listenForBack(close) : () => undefined;
    return () => { window.removeEventListener('keydown', escape); remove(); };
  }, [modal, tab, run]);
  const launch = (resume = true) => { audio.unlock(); setRun({ key: Date.now(), saved: resume ? progressRef.current.activeRun ?? undefined : undefined }); };
  const start = () => { if (!progressRef.current.tutorialSeen) { setPendingLaunch(true); setModal('tutorial'); } else launch(); };
  const completeTutorial = () => { update({ tutorialSeen: true }); setModal(undefined); if (pendingLaunch) launch(); setPendingLaunch(false); };
  const result = (value: GameResult) => updateProgress(recordResult(progressRef.current, value));
  const checkpoint = (value: RunSave) => updateProgress(checkpointRun(progressRef.current, value));
  const newRun = () => {
    const saved = progressRef.current.activeRun;
    if (saved) result({ runId: saved.runId, elapsed: saved.elapsed, mass: saved.player.mass, stats: saved.stats, reason: 'quit' });
    setModal(undefined); launch(false);
  };
  const toggleSound = () => { const sound = !progressRef.current.settings.sound; audio.configure(sound, progressRef.current.settings.haptics); audio.unlock(); update({ settings: { ...progressRef.current.settings, sound } }); };

  if (run) return <Game key={run.key} saved={run.saved} progress={progress} onResult={result} onCheckpoint={checkpoint} onHome={() => setRun(undefined)} onRestart={() => launch(false)} onSound={toggleSound} />;
  const saved = progress.activeRun;
  return <div className={`app-shell tab-${tab} unlimited-app venture-ui`} style={{ '--player-color': progress.color } as CSSProperties}>
    <header className="home-header"><button className="brand" onClick={() => navigate('arena')} aria-label="startup.io"><div className="brand-icon"><Rocket size={21} /></div><span>startup<span className="brand-io">.io</span></span></button><div className="header-actions"><button className="wallet-pill" onClick={() => navigate('marketplace')} aria-label={`${t.wallet}: ${progress.credits}`} data-testid="wallet"><Coin size={19} /><b>{progress.credits.toLocaleString()}</b></button><button className="icon-button" onClick={() => setModal('settings')} aria-label={t.settings} data-testid="settings"><Settings2 size={18} /></button></div></header>
    <main className="home-main">
      {tab === 'arena' && <section className="arena-menu endless-menu">
        <div className="arena-menu-hero"><div className="arena-intro"><span className="endless-tag"><span className="status-dot" />{t.botArenaLabel}</span><h1>{t.lobbyTitle}</h1><p>{t.lobbySubtitle}</p></div>
          <div className="founder-stage calm-stage venture-preview"><ArenaPreview color={progress.color} look={progress.look} /><div className="preview-topline"><span>{t.roomPreview}<small>VC–1862</small></span><span><Users size={11} />49 <b>BOT</b></span></div><span className="preview-engine-label">{t.engineLabel}</span><span className="preview-vignette" /></div>
          <button className="founder-profile" onClick={() => navigate('customize')} data-testid="open-customize"><LogoToken look={progress.look} color={progress.color} size={36} /><span><small>{t.featured}</small><b>{progress.name || 'My Startup'}</b></span><div className="profile-edit"><Paintbrush size={13} /><ChevronRight size={13} /></div></button>
        </div>
        <div className="arena-launch-panel endless-launch">
          <div className="endless-mode-card"><span className="endless-mode-symbol"><InfinityIcon size={28} /></span><div><small>{saved ? t.savedCompany : t.unlimitedWorld}</small><b>{saved ? formatMoney(saved.player.mass) : 'Venture City'}</b><span>{saved ? t.savedHint : t.population}</span></div><span className="mode-status">UNLIMITED</span></div>
          {!saved && <div className="sector-selector" aria-label={t.sector}>{SECTORS.map(sector => <button key={sector.id} onClick={() => update({ sector: sector.id })} aria-pressed={progress.sector === sector.id} className={progress.sector === sector.id ? 'selected' : ''}><Logo id={sector.logo} size={15} color={sector.color} /><span>{sector.id === 'ai' ? 'AI' : sector.id === 'fintech' ? 'Fintech' : 'Cloud'}</span></button>)}</div>}
          {!saved && <p className="sector-benefit">{t[`${progress.sector}Benefit`]}</p>}
          <button className="primary-button launch-button" onClick={start} data-testid="play"><span><Play size={19} fill="currentColor" />{saved ? t.continue : t.play}</span><ArrowUpRight size={24} /></button>
          <div className="launch-meta"><span><Check size={11} />{t.autosave}</span><button onClick={() => { setPendingLaunch(false); setModal('tutorial'); }}><Info size={13} />{t.how}</button></div>
          {saved && <button className="new-startup-link" onClick={() => setModal('new-run')}>{t.newRun}<ArrowRight size={12} /></button>}
          <div className="endless-records"><div><Trophy size={15} /><span>{t.record}</span><b>{progress.endless.bestMass ? formatMoney(progress.endless.bestMass) : '—'}</b></div><div><Map size={15} /><span>{t.acquisitions}</span><b>{progress.endless.acquisitions}</b></div></div>
          <div className="quiet-rivals"><span>{t.rivals}</span><div>{BRANDS.slice(-5).map(brand => <Logo key={brand.logo} id={brand.logo} size={17} color={brand.color} />)}</div></div>
        </div>
      </section>}
      {tab === 'marketplace' && <Marketplace progress={progress} onChange={updateProgress} onPlay={() => { navigate('arena'); start(); }} />}
      {tab === 'customize' && <Customize progress={progress} onChange={updateProgress} onPlay={() => navigate('arena')} />}
    </main>
    <nav className="main-nav" aria-label="startup.io"><button className={tab === 'arena' ? 'selected' : ''} onClick={() => navigate('arena')} aria-current={tab === 'arena' ? 'page' : undefined}><Gamepad2 size={21} /><span>{t.arena}</span></button><button className={tab === 'marketplace' ? 'selected' : ''} onClick={() => navigate('marketplace')} aria-current={tab === 'marketplace' ? 'page' : undefined} data-testid="nav-marketplace"><ShoppingBag size={20} /><span>{t.marketplace}</span></button><button className={tab === 'customize' ? 'selected' : ''} onClick={() => navigate('customize')} aria-current={tab === 'customize' ? 'page' : undefined} data-testid="nav-customize"><Paintbrush size={20} /><span>{t.customize}</span></button></nav>
    {modal && <div className="modal-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) { setModal(undefined); setPendingLaunch(false); } }}><section className={`home-modal ${modal === 'tutorial' ? 'tutorial-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><span className="eyebrow">{modal === 'settings' ? 'MAKE IT YOURS' : 'STARTUP.IO ∞'}</span><button className="icon-button" onClick={() => { setModal(undefined); setPendingLaunch(false); }} aria-label={t.close}><X size={19} /></button></div><h2 id="modal-title">{modal === 'settings' ? t.settings : modal === 'new-run' ? t.leaveTitle : modal === 'privacy' ? t.privacy : modal === 'terms' ? t.terms : modal === 'support' ? t.support : modal === 'reset' ? t.resetTitle : t.how}</h2>
      {modal === 'settings' ? <div className="settings-list"><div className="setting-row"><span><Globe2 size={18} />{t.language}</span><div className="language-options"><button className={progress.settings.language === 'az' ? 'selected' : ''} onClick={() => update({ settings: { ...progress.settings, language: 'az' } })}>AZ</button><button className={progress.settings.language === 'en' ? 'selected' : ''} onClick={() => update({ settings: { ...progress.settings, language: 'en' } })}>EN</button></div></div>{(['sound', 'haptics', 'details'] as const).map(setting => <div className="setting-row" key={setting}><span>{setting === 'sound' ? <Volume2 size={18} /> : setting === 'haptics' ? <Zap size={18} /> : <Map size={18} />}{t[setting]}</span><button className={`switch ${progress.settings[setting] ? 'on' : ''}`} role="switch" aria-label={t[setting]} aria-checked={progress.settings[setting]} onClick={() => setting === 'sound' ? toggleSound() : update({ settings: { ...progress.settings, [setting]: !progress.settings[setting] } })}><span /></button></div>)}<label className="sensitivity-setting"><span>{t.sensitivity}<b>{Math.round(progress.settings.sensitivity * 100)}%</b></span><input type="range" min=".65" max="1.5" step=".05" value={progress.settings.sensitivity} onChange={event => update({ settings: { ...progress.settings, sensitivity: Number(event.target.value) } })} /></label><div className="settings-links">{(['privacy', 'terms', 'support'] as const).map(value => <button key={value} onClick={() => setModal(value)}>{t[value]}<ChevronRight size={12} /></button>)}<button className="delete-progress-link" onClick={() => setModal('reset')}>{t.resetProgress}<ChevronRight size={12} /></button></div><p className="settings-caption">startup.io · {appVersion} · Phaser 3.90<br />{t.offline}</p></div> : ['privacy', 'terms', 'support'].includes(modal) ? <LegalPanel type={modal as 'privacy' | 'terms' | 'support'} language={progress.settings.language} /> : modal === 'reset' ? <><p className="modal-description">{t.resetText}</p><button className="primary-button" onClick={() => { updateProgress(freshProgress()); setModal(undefined); }}>{t.resetConfirm}<ArrowRight size={18} /></button><button className="text-button" onClick={() => setModal('settings')}>{t.stay}</button></> : modal === 'new-run' ? <><p className="modal-description">{t.leaveText}</p><button className="primary-button" onClick={newRun}>{t.newRun}<ArrowRight size={18} /></button><button className="text-button" onClick={() => setModal(undefined)}>{t.stay}</button></> : <>
        <div className="tutorial-rules"><div className="tutorial-rule"><span className="rule-icon funding-icon">$</span><div><h3>{t.rule1}</h3><p>{t.rule1text}</p></div></div><div className="tutorial-rule"><span className="rule-icon gpu-icon"><Cpu size={22} /></span><div><h3>{t.rule2}</h3><p>{t.rule2text}</p></div></div><div className="tutorial-rule"><span className="rule-icon threat-icon"><ShieldCheck size={22} /></span><div><h3>{t.rule3}</h3><p>{t.rule3text}</p></div></div></div><div className="tutorial-control"><Gamepad2 size={23} /><p>{t.controls}<small>{t.desktopControls}</small></p></div><details className="mechanics-guide"><summary>{t.mechanics}</summary><p>{t.mechanicsText}</p></details><div className="tutorial-assets">{ASSET_CATALOG.slice(0, 4).map(spec => <span key={spec.kind}>{assetName(spec.kind, progress.settings.language)}</span>)}</div><button className="primary-button" onClick={completeTutorial} data-testid="tutorial-start">{t.gotIt}<Play size={18} fill="currentColor" /></button>
      </>}
    </section></div>}
  </div>;
}
