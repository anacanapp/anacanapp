import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { WorldScene } from '../world/WorldScene';
import { OBJECTS, PLACEMENT_SPOTS, worldObjects, type Point } from '../game/navigation';
import { currentStep } from '../game/progression';
import type { GameState, Room } from '../game/types';
import { Icon } from './Icon';
import { t } from '../game/i18n';
import { activityById } from '../game/engine';

export interface WorldHandle {
  walkTo(id: string, onArrive?: () => void): void;
  cancelWalk(): void;
  focusRoom(room: Room | 'home'): void;
  capture(): string | undefined;
  select(id: string | null): void;
  focusActivity(id: string): void;
}

export const WorldView = forwardRef<WorldHandle, {
  state: GameState; onObject(id: string): void; onFloor(p: Point): void; photoMode?: boolean; paused?: boolean; intro?: boolean; placing?: string | null; visible?: boolean;
}>(({ state, onObject, onFloor, photoMode = false, paused = false, intro = false, placing = null, visible = true }, ref) => {
  const container = useRef<HTMLDivElement>(null), world = useRef<WorldScene>();
  const callbacks = useRef({ onObject, onFloor }); callbacks.current = { onObject, onFloor };
  const stateRef = useRef(state); stateRef.current = state;
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});
  const [ready, setReady] = useState(false), [error, setError] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    try {
      world.current = new WorldScene(container.current, stateRef.current, {
        onObject: id => callbacks.current.onObject(id), onFloor: p => callbacks.current.onFloor(p),
        onPositions: setPositions, onReady: () => setReady(true),
      });
    } catch { setError(true); }
    return () => { world.current?.dispose(); world.current = undefined; };
  }, []);
  useEffect(() => { world.current?.update(state); }, [state]);
  useEffect(() => { world.current?.setPhotoMode(photoMode); }, [photoMode]);
  useEffect(() => { world.current?.setPlacing(placing); }, [placing]);
  useEffect(() => { world.current?.setPaused(paused); }, [paused]);
  useEffect(() => { world.current?.setVisible(visible); }, [visible]);
  useImperativeHandle(ref, () => ({
    walkTo: (id, onArrive) => world.current ? world.current.walkTo(id, onArrive) : onArrive?.(),
    cancelWalk: () => world.current?.cancelWalk(), focusRoom: room => world.current?.focusRoom(room),
    capture: () => world.current?.capture(), select: id => world.current?.select(id),
    focusActivity: id => world.current?.focusActivity(id),
  }), []);

  const pins = state.location === 'clinic' ? ['scanner', 'doctor', 'birthbed', 'clinicdresser', 'reception'] :
    state.pregnancy.born ? ['counter', 'sofa', 'crib', 'dresser', 'playmat', 'bench', 'partner'] : ['counter', 'sofa', 'crib', 'dresser', 'bench', 'partner', 'bath'];
  const step = currentStep(state);
  return <div className={`world-view ${ready ? 'ready' : ''} ${intro ? 'world-intro' : ''}`}>
    <div className="world-canvas" ref={container} />
    {!ready && !error && <div className="world-loading"><Icon name="sparkles" size={30} /><span>Mommy Simulator</span></div>}
    {error && <div className="world-fallback"><img src="/assets/anacan-mom.webp" alt="Anacan" /><p>{t('yourRhythm', state.language)}</p><small>{t('activities', state.language)}</small></div>}
    {!photoMode && !intro && !error && <div className="world-pins">{pins.map(id => {
      const p = positions[id], o = worldObjects(state.location).find(o => o.id === id)!;
      if (!p?.visible) return null;
      const key = id === 'dresser' && state.pregnancy.born ? 'diaper' : id === 'crib' && !state.pregnancy.born ? state.chapter >= 6 ? 'assemble' : 'read' : id === 'bath' && state.chapter === 0 ? 'test' : id === 'birthbed' && state.pregnancy.born ? 'skin' : o.label;
      const label = activityById(key as Parameters<typeof activityById>[0]);
      return <button key={id} className={`world-pin pin-${id} ${step?.action === key ? 'mission-pin' : ''}`} style={{ left: p.x, top: p.y }} onClick={() => onObject(id)} aria-label={label ? label.title[state.language === 'az' ? 0 : state.language === 'en' ? 1 : 2] : id} data-testid={`pin-${id}`}>
        <Icon name={o.icon} size={18} /><span className="pin-dot" />
      </button>;
    })}</div>}
    {!intro && !photoMode && positions.mother && <div className="sim-diamond" style={{ left: positions.mother.x, top: positions.mother.y }}><i /></div>}
    {placing && <div className="placement-slots">{PLACEMENT_SPOTS.map((spot, index) => {
      const p = positions[`slot-${index}`];
      return p?.visible ? <button key={index} style={{ left: p.x, top: p.y }} onClick={() => onFloor(spot)} aria-label={`${t('place', state.language)} ${index + 1}`} data-testid={`placement-slot-${index}`}><Icon name="plus" size={19} /></button> : null;
    })}</div>}
  </div>;
});
WorldView.displayName = 'WorldView';
