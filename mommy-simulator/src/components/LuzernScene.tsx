import { useEffect, useRef, useState } from 'react';
import { art, LIFE_LOCATIONS, LIFE_ROOMS } from '../game/luzern';
import { text, t } from '../game/i18n';
import { activityById, availableActivities } from '../game/engine';
import { currentStep } from '../game/progression';
import type { Activity, ActivityId, GameState, Room } from '../game/types';
import { Icon } from './Icon';
import { ROOM_ACTIVITIES } from '../game/interior';

export type SceneMode = 'cinematic' | 'room' | 'overview';

const positions: Record<string, [number, number]> = {
  feed: [57, 50], diaper: [77, 56], play: [42, 70], lullaby: [20, 49], assemble: [20, 49],
  rest: [62, 50], talk: [73, 56], read: [45, 61], clean: [37, 68], journal: [27, 60], help: [77, 58],
  cook: [35, 59], water: [47, 44], sterilise: [68, 52], bath: [26, 51], test: [71, 58],
  laundry: [77, 63], routine: [28, 63], walk: [65, 47], plant: [24, 52], breathe: [48, 47],
  stretch: [59, 64], scan: [39, 55], checkup: [76, 58], skin: [44, 62], birth: [47, 57],
  carseat: [82, 65], groceries: [61, 55], coffee: [63, 63], lakesideWalk: [52, 62], soothe: [63, 46], pack: [76, 56],
};

export function LuzernScene({ state, room, mode, moving, onActivity, onMode, onRoom, photoMode, paused }: {
  state: GameState; room: Room; mode: SceneMode; moving: Activity | null; onActivity(id: ActivityId): void;
  onMode(mode: SceneMode): void; onRoom(room: Room): void; photoMode: boolean; paused: boolean;
}) {
  const l = state.language, container = useRef<HTMLDivElement>(null), [drag, setDrag] = useState(false), [pan, setPan] = useState(50);
  const last = useRef(0), moved = useRef(false), [selectedImage, setSelectedImage] = useState(''), [openActions, setOpenActions] = useState(false);
  const active = state.activity ? activityById(state.activity.id) : moving;
  const info = state.location === 'home' ? LIFE_ROOMS.find(r => r.id === room) ?? LIFE_ROOMS[0] : LIFE_LOCATIONS.find(l => l.id === state.location)!;
  let image = info.image;
  if (state.location === 'home' && room === 'nursery' && state.pregnancy.born) image = active?.id === 'diaper' ? 'changing' : active?.id === 'lullaby' ? 'sleeping' : 'feeding';
  if (state.location === 'home' && room === 'living') image = state.pregnancy.born ? 'family' : state.chapter >= 2 ? 'pregnancy' : 'living';
  const actions = ROOM_ACTIVITIES[state.location === 'home' ? room : state.location].filter(id => availableActivities(state).some(a => a.id === id));
  if (state.location === 'clinic' && currentStep(state)?.action === 'birth') actions.unshift('birth');
  const dayLight = state.time < 6 * 60 || state.time >= 21 * 60 ? 'night' : state.time < 17 * 60 ? 'morning' : 'evening';
  useEffect(() => { setPan(50); setSelectedImage(image); setOpenActions(false); }, [room, state.location, image]);
  useEffect(() => {
    for (const image of ['living', 'nursery', 'feeding', 'kitchen', 'pregnancy']) { const preload = new Image(); preload.src = art(image); }
  }, []);
  return <div className={`luzern-scene mode-${mode} light-${dayLight} ${active ? 'scene-active' : ''} ${photoMode ? 'scene-photo' : ''} ${state.household.weather === 'rain' ? 'scene-rain' : ''}`} ref={container} data-testid="luzern-scene" data-room={room}>
    {mode === 'cinematic' && <div className="cinematic-room" onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) return; last.current = e.clientX; moved.current = false; setDrag(true); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!drag) return; const delta = e.clientX - last.current; if (Math.abs(delta) > 3) moved.current = true; setPan(old => Math.max(25, Math.min(75, old - delta * .08))); last.current = e.clientX; }} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}>
      <img src={art(selectedImage || image)} className="cinematic-art" alt={text(info.title, l)} style={{ objectPosition: `${pan}% 52%` }} data-testid="room-artwork" draggable={false} />
      <div className="room-sunlight" /><div className="room-vignette" />
      {!state.settings.reducedMotion && !paused && <div className="sun-dust">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ left: `${15 + i * 12}%`, top: `${22 + i % 3 * 15}%`, animationDelay: `${-i * 2}s` }} />)}</div>}
      {!photoMode && <div className="room-hotspots">{actions.slice(0, 5).map((id, i) => {
        const a = activityById(id), p = positions[id] ?? [30 + i * 13, 50], step = currentStep(state);
        return <button key={id} className={`room-hotspot ${step?.action === id ? 'next' : ''}`} style={{ left: `${p[0]}%`, top: `${p[1]}%` }} onClick={() => onActivity(id)} aria-label={text(a.title, l)} data-testid={`room-action-${id}`} disabled={Boolean(active)}><i /><span><Icon name={a.icon} size={18} /></span><small>{text(a.title, l)}</small></button>;
      })}</div>}
    </div>}
    {!photoMode && <>
      <div className="luzern-room-heading"><span className="room-eyebrow">{state.location === 'home' ? 'LAKEVIEW HOUSE · LUZERN' : 'LUZERN · SWITZERLAND'}</span><div><h2>{text(info.title, l)}</h2><span>✦</span></div><p>{'caption' in info ? text(info.caption, l) : text(info.subtitle, l)}</p></div>
      <div className="view-mode-toggle"><button className={mode === 'cinematic' ? 'selected' : ''} onClick={() => onMode('cinematic')} aria-label={t('cinematic', l)} aria-pressed={mode === 'cinematic'} data-testid="mode-cinematic"><Icon name="camera" size={16} /></button><button className={mode === 'room' ? 'selected' : ''} onClick={() => onMode('room')} aria-label={t('realTime', l)} aria-pressed={mode === 'room'} data-testid="mode-room"><Icon name="sofa" size={16} /></button>{['home', 'clinic'].includes(state.location) && <button className={mode === 'overview' ? 'selected' : ''} onClick={() => onMode('overview')} aria-label={t('overview', l)} aria-pressed={mode === 'overview'} data-testid="mode-overview"><Icon name="home" size={16} /></button>}</div>
      {state.location === 'home' && <nav className="luzern-room-tabs" aria-label={t('rooms', l)}>{LIFE_ROOMS.map(r => <button key={r.id} className={r.id === room ? 'active' : ''} onClick={() => onRoom(r.id)} aria-label={text(r.title, l)} aria-pressed={r.id === room} data-testid={`room-${r.id}`}><Icon name={r.icon} size={18} /><span>{text(r.title, l)}</span></button>)}</nav>}
    <div className="room-activity-title"><span>{mode === 'room' ? t('roomControls', l) : t('roomActions', l)}</span><button onClick={() => setOpenActions(!openActions)} aria-label={t('roomActions', l)} aria-expanded={openActions} data-testid="room-actions-toggle"><Icon name={openActions ? 'close' : 'plus'} size={16} /></button></div>
      {openActions && <div className="room-action-tray">{actions.map(id => <button key={id} onClick={() => onActivity(id)} disabled={Boolean(active)} data-testid={`room-tray-${id}`}><Icon name={activityById(id).icon} size={20} /><span>{text(activityById(id).title, l)}</span><Icon name="arrow" size={15} /></button>)}</div>}
    </>}
  </div>;
}

export async function captureCinematic(image: string, title: string): Promise<string> {
  const img = new Image(); img.src = art(image); await img.decode();
  const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = 680; const c = canvas.getContext('2d')!;
  c.fillStyle = '#f5f0e5'; c.fillRect(0, 0, 1100, 680); c.drawImage(img, 15, 15, 1070, 611);
  c.font = '600 15px Manrope, sans-serif'; c.fillStyle = '#778069'; c.textAlign = 'center'; c.fillText(`${title} · Mommy Simulator · Luzern`, 550, 654);
  return canvas.toDataURL('image/jpeg', .78);
}
