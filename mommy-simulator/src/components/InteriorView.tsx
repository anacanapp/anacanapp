import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { InteriorScene, type InteriorPosition } from '../world/InteriorScene';
import type { ActivityId, GameState, Room } from '../game/types';
import { availableActivities, activityById } from '../game/engine';
import { currentStep } from '../game/progression';
import { text, t } from '../game/i18n';
import { Icon } from './Icon';

export interface InteriorHandle { capture(): string | undefined }
export const InteriorView = forwardRef<InteriorHandle, { state: GameState; room: Room; onActivity(id: ActivityId): void; paused: boolean; visible: boolean; photoMode: boolean }>(
  ({ state, room, onActivity, paused, visible, photoMode }, ref) => {
    const container = useRef<HTMLDivElement>(null), scene = useRef<InteriorScene>(), callback = useRef(onActivity); callback.current = onActivity;
    const current = useRef({ state, room, paused, visible }); current.current = { state, room, paused, visible };
    const [positions, setPositions] = useState<Partial<Record<ActivityId, InteriorPosition>>>({});
    const [ready, setReady] = useState(false), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
    useEffect(() => {
      if (!container.current) return; setError(false); setReady(false);
      try {
        scene.current = new InteriorScene(container.current, current.current.state, current.current.room, {
          onActivity: id => callback.current(id), onPositions: setPositions, onReady: () => setReady(true),
        });
        scene.current.setPaused(current.current.paused); scene.current.setVisible(current.current.visible);
      } catch { setError(true); }
      return () => { scene.current?.dispose(); scene.current = undefined; };
    }, [attempt]);
    useEffect(() => { scene.current?.update(state); }, [state]);
    useEffect(() => { scene.current?.setRoom(room); }, [room]);
    useEffect(() => { scene.current?.setPaused(paused); }, [paused]);
    useEffect(() => { scene.current?.setVisible(visible); }, [visible]);
    useImperativeHandle(ref, () => ({ capture: () => scene.current?.capture() }), []);
    const allowed = availableActivities(state), step = currentStep(state);
    return <div className={`luzern-interior ${ready ? 'ready' : ''}`} data-testid="interior-view" data-room={room}>
      <div className="interior-renderer" ref={container} />
      {!ready && !error && <div className="interior-loading"><Icon name="sparkles" size={28} /><span>{t('realTime', state.language)}</span></div>}
      {error && <div className="interior-fallback"><Icon name="sofa" size={32} /><p>{t('realTimeUnavailable', state.language)}</p><button className="button secondary" onClick={() => setAttempt(n => n + 1)}>{t('retry', state.language)}</button></div>}
      {ready && visible && !photoMode && <div className="interior-hotspots">{Object.entries(positions).map(([key, position]) => {
        const id = key as ActivityId; if (!position.visible || !allowed.some(a => a.id === id)) return null;
        const activity = activityById(id);
        return <button key={id} className={`interior-hotspot ${step?.action === id ? 'next' : ''}`} style={{ left: position.x, top: position.y }}
          onClick={() => onActivity(id)} disabled={Boolean(state.activity)} aria-label={text(activity.title, state.language)} data-testid={`interior-action-${id}`}>
          <Icon name={activity.icon} size={17} /><span>{text(activity.title, state.language)}</span>
        </button>;
      })}</div>}
    </div>;
  }
);
InteriorView.displayName = 'InteriorView';
