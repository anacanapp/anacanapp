import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ACTIVITIES, CHAPTERS, FURNITURE, copy } from '../game/content';
import { activityById, chapterCanAdvance, dailyGoals, goalsComplete, isBaby, levelFor } from '../game/engine';
import { text, t } from '../game/i18n';
import { downloadSave, parseSave } from '../game/persistence';
import { exportNativeSave, sharePhoto } from '../game/native';
import type { Avatar, Catalogue, GameAction, GameState, Memory, Panel, PublicRow } from '../game/types';
import { Icon } from './Icon';
import { Needs } from './Needs';
import { AvatarPortrait } from './AvatarPortrait';
import { AvatarEditor } from './AvatarEditor';
import { Library } from './Library';
import { MissionPanel, TownMap } from './MissionPanel';
import { missionProgress } from '../game/progression';
import { LifeDayPanel, LuzernMap } from './LifeDayPanel';

export function GamePanel({ panel, state, catalogue, dispatch, onActivity, onPlace, onClose, onRefresh, refreshing, onCook, onReset, onToast, onTravel, onHelp }: {
  panel: Panel; state: GameState; catalogue: Catalogue; dispatch(action: GameAction): void;
  onActivity(id: Parameters<typeof activityById>[0]): void; onPlace(id: string): void; onClose(): void;
  onRefresh(): void; refreshing: boolean; onCook(row: PublicRow): void; onReset(): void; onToast(message: string): void;
  onTravel(location?: GameState['location']): void;
  onHelp(): void;
}) {
  const language = state.language;
  switch (panel) {
    case 'tasks': return <MissionPanel state={state} dispatch={dispatch} onActivity={onActivity} onTravel={() => onTravel()} onClose={onClose} />;
    case 'map': return <LuzernMap state={state} onTravel={location => onTravel(location)} />;
    case 'day': return <LifeDayPanel state={state} dispatch={dispatch} onActivity={onActivity} onTravel={onTravel} onClose={onClose} />;
    case 'journey': return <JourneyPanel state={state} dispatch={dispatch} onClose={onClose} />;
    case 'decorate': return <DecorPanel state={state} dispatch={dispatch} onPlace={onPlace} onToast={onToast} />;
    case 'family': return <FamilyPanel state={state} dispatch={dispatch} onActivity={onActivity} />;
    case 'album': return <AlbumPanel state={state} onToast={onToast} />;
    case 'library': return <Library state={state} catalogue={catalogue} onFavourite={id => dispatch({ type: 'FAVOURITE', id })}
      onName={name => { dispatch({ type: 'AVATAR', avatar: { ...state.avatar, babyName: name } }); onToast(name); }}
      onCook={onCook} onRefresh={onRefresh} refreshing={refreshing} />;
    case 'settings': return <SettingsPanel state={state} dispatch={dispatch} onReset={onReset} onToast={onToast} onHelp={onHelp} />;
    case 'help': return <div className="help-panel">{[1, 2, 3, 4].map((i) => <article key={i}><span className="help-number">0{i}</span><div><h3>{t(`help${i}Title` as 'help1Title', language)}</h3><p>{t(`help${i}` as 'help1', language)}</p></div></article>)}<div className="gentle-card"><Icon name="leaf" /><p>{t('gentleNote', language)}</p></div></div>;
  }
}

function DayPanel({ state, dispatch, onActivity, onClose }: { state: GameState; dispatch(action: GameAction): void; onActivity(id: Parameters<typeof activityById>[0]): void; onClose(): void }) {
  const language = state.language, goals = dailyGoals(state), complete = goalsComplete(state);
  return <div className="day-panel"><div className="daily-intro"><div><span className="eyebrow">{t('day', language)} {String(state.day).padStart(2, '0')}</span><h3>{t('objective', language)}</h3><p>{t('objectiveHint', language)}</p></div><span className="daily-flower"><Icon name="flower" size={40} /></span></div>
    <div className="goal-list">{goals.map((id, i) => {
      const a = activityById(id), done = state.completedToday.includes(id);
      return <button key={id} className={`goal ${done ? 'done' : ''}`} onClick={() => !done && onActivity(id)} disabled={done || Boolean(state.activity)} data-testid={`goal-${id}`}><span className="goal-icon"><Icon name={done ? 'check' : a.icon} size={24} /></span><div><span className="goal-index">0{i + 1}</span><strong>{text(a.title, language)}</strong><small>{done ? t('completed', language) : text(a.description, language)}</small></div><Icon name={done ? 'check' : 'right'} size={19} /></button>;
    })}</div>
    <div className={`daily-gift ${complete ? 'available' : ''}`}><span><Icon name="gift" size={28} /></span><div><strong>55 <Icon name="coins" size={16} /> + 1 <Icon name="star" size={15} /></strong><small>{t(state.dailyRewardClaimed ? 'claimed' : 'miniBonus', language)}</small></div><button className="button primary" disabled={!complete || state.dailyRewardClaimed} onClick={() => dispatch({ type: 'CLAIM_DAILY' })} data-testid="claim-daily">{t(state.dailyRewardClaimed ? 'claimed' : 'claim', language)}</button></div>
    <div className="day-divider" /><h4>{t('activities', language)}</h4><div className="all-activities">{ACTIVITIES.filter(a => (!a.babyOnly || isBaby(state)) && (!a.pregnancyOnly || !isBaby(state))).map(a => <button key={a.id} onClick={() => onActivity(a.id)} disabled={Boolean(state.activity)} data-testid={`activity-${a.id}`}><Icon name={a.icon} size={19} /><span>{text(a.title, language)}</span><Icon name="plus" size={14} /></button>)}</div>
    <div className="sleep-card"><Icon name="moon" size={27} /><div><strong>{t('sleep', language)}</strong><small>{t(state.dailyActions < 3 ? 'finishSome' : 'sleepHint', language)}</small></div><button className="icon-button" onClick={() => { dispatch({ type: chapterCanAdvance(state) ? 'ADVANCE_CHAPTER' : 'SLEEP' }); onClose(); }} disabled={state.dailyActions < 3 || Boolean(state.activity)} aria-label={t('sleep', language)} data-testid="finish-day"><Icon name="arrow" /></button></div>
  </div>;
}

function JourneyPanel({ state, dispatch, onClose }: { state: GameState; dispatch(action: GameAction): void; onClose(): void }) {
  const language = state.language, advance = chapterCanAdvance(state);
  return <div className="journey-panel"><div className="journey-hero"><img src={`/assets/anacan-${isBaby(state) ? 'mom' : 'bump'}.webp`} alt="" /><div><span className="eyebrow">{t('chapter', language)} {state.chapter + 1} / {CHAPTERS.length}</span><h3>{text(CHAPTERS[state.chapter].title, language)}</h3><p>{text(CHAPTERS[state.chapter].intro, language)}</p></div></div>
    <div className="journey-timeline">{CHAPTERS.map((chapter, index) => <article className={`timeline-chapter ${index === state.chapter ? 'current' : index < state.chapter ? 'done' : 'locked'}`} key={chapter.id}><span className="timeline-dot" style={{ '--chapter-colour': chapter.colour } as React.CSSProperties}><Icon name={index < state.chapter ? 'check' : chapter.icon} size={22} /></span><div><small>{text(chapter.period, language)}</small><h4>{text(chapter.title, language)}</h4><p>{text(chapter.subtitle, language)}</p></div><span className="chapter-status">{t(index === state.chapter ? 'current' : index < state.chapter ? 'completed' : 'coming', language)}</span></article>)}</div>
    <div className="journey-next"><Icon name={advance ? 'sparkles' : 'bookheart'} size={25} /><div><strong>{t(advance ? 'chapterReady' : state.chapter === CHAPTERS.length - 1 ? 'freePlay' : 'chapterMissionLocked', language)}</strong><small>{missionProgress(state).completed} / {missionProgress(state).total} · {t('missions', language)}</small></div></div>
    {state.chapter < CHAPTERS.length - 1 && <button className="button primary large" disabled={!advance || Boolean(state.activity)} onClick={() => { dispatch({ type: 'ADVANCE_CHAPTER' }); onClose(); }} data-testid="advance-chapter">{t('nextChapter', language)}<Icon name="arrow" /></button>}
  </div>;
}

function DecorPanel({ state, dispatch, onPlace, onToast }: { state: GameState; dispatch(action: GameAction): void; onPlace(id: string): void; onToast(message: string): void }) {
  const language = state.language, [tab, setTab] = useState<'shop' | 'collection'>('shop');
  return <div className="decor-panel"><div className="theme-section"><h3>{t('theme', language)}</h3><div className="theme-options">{(['lavender', 'peach', 'sage'] as const).map(theme => <button key={theme} className={`${theme} ${state.theme === theme ? 'selected' : ''}`} onClick={() => dispatch({ type: 'THEME', theme })} aria-pressed={state.theme === theme}><span className="theme-swatch">{state.theme === theme && <Icon name="check" size={20} />}</span><span>{t(theme, language)}</span></button>)}</div></div>
    <div className="shop-top"><div className="segmented"><button className={tab === 'shop' ? 'selected' : ''} onClick={() => setTab('shop')}>{t('shop', language)}</button><button className={tab === 'collection' ? 'selected' : ''} onClick={() => setTab('collection')}>{t('collection', language)}</button></div><span className="coin-balance"><Icon name="coins" size={18} />{state.coins}</span></div>
    <div className="decor-grid">{FURNITURE.filter(item => tab === 'shop' || state.inventory.includes(item.id)).map(item => {
      const owned = state.inventory.includes(item.id), placed = state.placements.find(p => p.itemId === item.id), locked = levelFor(state.xp) < item.level;
      return <article className={`decor-card ${owned ? 'owned' : ''}`} key={item.id}><div className={`decor-preview decor-${item.kind}`} style={{ '--decor-colour': item.colour } as React.CSSProperties}><div className="decor-art"><Icon name={item.icon} size={47} /></div>{owned && <span className="owned-tick"><Icon name="check" size={12} /></span>}{locked && <span className="level-lock"><Icon name="lock" size={12} />{item.level}</span>}</div><h4>{text(item.title, language)}</h4><p>{text(item.description, language)}</p>
        {placed ? <button className="button subtle" onClick={() => dispatch({ type: 'REMOVE', id: placed.id })}><Icon name="trash" size={14} />{t('remove', language)}</button>
          : owned ? <button className="button secondary" onClick={() => onPlace(item.id)} data-testid={`place-${item.id}`}><Icon name="plus" size={15} />{t('place', language)}</button>
          : <button className="button subtle" disabled={locked} onClick={() => { if (state.coins < item.price) { onToast(t('notEnough', language)); return; } dispatch({ type: 'BUY', itemId: item.id }); onToast(t('bought', language)); }} data-testid={`buy-${item.id}`}><Icon name="coins" size={16} />{item.price}<span>{t('buy', language)}</span></button>}
      </article>;
    })}</div>
  </div>;
}

function FamilyPanel({ state, dispatch, onActivity }: { state: GameState; dispatch(action: GameAction): void; onActivity(id: Parameters<typeof activityById>[0]): void }) {
  const language = state.language, [editing, setEditing] = useState(false), [avatar, setAvatar] = useState<Avatar>({ ...state.avatar });
  if (editing) return <div className="family-editor"><AvatarEditor avatar={avatar} onChange={setAvatar} language={language} baby={isBaby(state)} /><button className="button primary large" onClick={() => { dispatch({ type: 'AVATAR', avatar }); setEditing(false); }}>{t('characterSave', language)}<Icon name="check" /></button></div>;
  return <div className="family-panel"><div className="family-mother"><AvatarPortrait avatar={state.avatar} baby={isBaby(state)} /><div><span className="eyebrow">{t('yourCharacter', language)}</span><h3>{state.avatar.name}</h3><small>{t(state.avatar.personality, language)}</small><button className="button subtle" onClick={() => setEditing(true)}><Icon name="shirt" size={16} />{t('appearance', language)}</button></div></div><Needs state={state} />
    {isBaby(state) && <div className="baby-family-card"><span className="baby-avatar"><Icon name="baby" size={33} /></span><div><h3>{state.avatar.babyName}</h3><small>{text(CHAPTERS[state.chapter].period, language)}</small></div><span className="bond-pill"><Icon name="heart" size={16} />{Math.round(state.needs.bond)}</span></div>}
    {isBaby(state) && <Needs state={state} baby />}
    <div className="partner-card"><span><Icon name="hands" size={28} /></span><div><h3>{t('partner', language)}</h3><p>{t('partnerBody', language)}</p></div></div><div className="family-actions">{(['talk', 'help'] as const).map(id => <button className="button secondary" key={id} disabled={Boolean(state.activity)} onClick={() => onActivity(id)}><Icon name={activityById(id).icon} size={18} />{text(activityById(id).title, language)}</button>)}</div>
    <h4 className="skills-title">{t('skills', language)}</h4><div className="skills-grid">{(['care', 'cooking', 'creativity', 'balance'] as const).map((skill, i) => <div className="skill" key={skill}><span className={`skill-icon skill-${i}`}><Icon name={['heart', 'cooking', 'palette', 'leaf'][i]} size={20} /></span><div><strong>{t(skill, language)}</strong><div className="skill-track"><i style={{ width: `${Math.min(100, state.skills[skill])}%` }} /></div><small>{state.skills[skill]} XP</small></div></div>)}</div>
  </div>;
}

function AlbumPanel({ state, onToast }: { state: GameState; onToast(message: string): void }) {
  const [selected, setSelected] = useState<Memory | null>(null), language = state.language;
  if (selected) return <div className="memory-detail"><button className="back-link" onClick={() => setSelected(null)}><Icon name="left" size={16} />{t('back', language)}</button>{selected.photo ? <img src={selected.photo} className="memory-detail-photo" alt={text(selected.title, language)} /> : <div className="memory-art"><Icon name={selected.icon} size={70} /><Icon name="sparkles" size={24} /></div>}<span className="eyebrow">{t('day', language)} {selected.day} · {text(CHAPTERS[selected.chapter].period, language)}</span><h3>{text(selected.title, language)}</h3><p>{text(selected.description, language)}</p>{selected.photo && <button className="button primary" onClick={() => { void sharePhoto(selected.photo!).catch(() => onToast(t('refreshFailed', language))); }}><Icon name="share" size={18} />{t('share', language)}</button>}</div>;
  return <div className="album-panel">{!state.memories.length ? <div className="empty-state"><Icon name="camera" size={40} /><h3>{t('memoryEmpty', language)}</h3><p>{t('memoryHint', language)}</p></div> : <><div className="album-intro"><Icon name="heart" size={22} /><p>{text(copy('Balaca anları saxla. Bir gün ən böyük xəzinən olacaqlar.', 'Keep the little moments. One day they will be your greatest treasure.', 'Küçük anları sakla. Bir gün en büyük hazinen olacaklar.'), language)}</p></div><div className="album-grid">{state.memories.map(memory => <button className={`memory-card memory-${memory.kind}`} onClick={() => setSelected(memory)} key={memory.id}>{memory.photo ? <img src={memory.photo} alt="" loading="lazy" /> : <span className="memory-card-art"><Icon name={memory.icon} size={35} /><i /></span>}<small>{t('day', language)} {memory.day}</small><strong>{text(memory.title, language)}</strong><span>{text(CHAPTERS[memory.chapter].period, language)}</span></button>)}</div></>}</div>;
}

function SettingsPanel({ state, dispatch, onReset, onToast, onHelp }: { state: GameState; dispatch(action: GameAction): void; onReset(): void; onToast(message: string): void; onHelp(): void }) {
  const language = state.language, file = useRef<HTMLInputElement>(null), [resetting, setResetting] = useState(false);
  return <div className="settings-panel"><div className="settings-language"><Icon name="bookheart" /><label>{t('language', language)}<select value={language} onChange={e => dispatch({ type: 'LANGUAGE', language: e.target.value as GameState['language'] })}><option value="az">Azərbaycan</option><option value="en">English</option><option value="tr">Türkçe</option></select></label></div>
    {(['sound', 'haptics', 'reducedMotion'] as const).map((setting, i) => <button className="setting-row" key={setting} onClick={() => dispatch({ type: 'SETTINGS', settings: { [setting]: !state.settings[setting] } })} role="switch" aria-checked={state.settings[setting]}><Icon name={['volume', 'hands', 'waves'][i]} size={20} /><span>{t(setting, language)}</span><i className={`switch ${state.settings[setting] ? 'on' : ''}`} /></button>)}
    <button className="setting-row" onClick={onHelp}><Icon name="help" size={20} /><span>{t('help', language)}</span><Icon name="right" size={17} /></button>
    <div className="save-card"><Icon name="check" size={25} /><div><strong>{t('autosave', language)}</strong><small>{t('day', language)} {state.day} · {state.totalActions} {text(copy('kiçik an', 'little moments', 'küçük an'), language)}</small></div></div>
    <div className="save-actions"><button className="button secondary" onClick={() => { if (Capacitor.isNativePlatform()) void exportNativeSave(state).catch(() => onToast(t('storageFailed', language))); else downloadSave(state); }}><Icon name="download" size={18} />{t('exportSave', language)}</button><button className="button subtle" onClick={() => file.current?.click()}><Icon name="upload" size={18} />{t('importSave', language)}</button></div>
    <input ref={file} type="file" accept="application/json,.json" className="visually-hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const loaded = f.size < 12 * 1024 * 1024 ? parseSave(await f.text()) : null; if (loaded) { dispatch({ type: 'LOAD', state: loaded }); onToast(t('saved', language)); } else onToast(t('importFailed', language)); e.target.value = ''; }} />
    {resetting ? <div className="reset-confirm"><h4>{t('resetConfirm', language)}</h4><p>{t('resetBody', language)}</p><div><button className="button subtle" onClick={() => setResetting(false)}>{t('cancel', language)}</button><button className="button danger" onClick={onReset}>{t('reset', language)}</button></div></div> : <button className="reset-button" onClick={() => setResetting(true)}>{t('reset', language)}<Icon name="right" size={17} /></button>}
    <div className="about-game"><img src="/assets/mark.svg" alt="" /><strong>Mommy Simulator</strong><small>0.2.0 · a little world by Anacan</small><span>iOS + Android · Google content</span></div>
  </div>;
}
