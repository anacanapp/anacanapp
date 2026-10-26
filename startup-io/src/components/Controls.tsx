import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject, PointerEvent } from 'react';
import { Fingerprint, MoveUpRight, RotateCcw, Zap } from 'lucide-react';
import type { Input } from '../game/model';
import { clamp } from '../game/model';
import { copy } from '../i18n';
import type { Language } from '../i18n';

interface Stick { x: number; y: number; dx: number; dy: number; active: boolean }

/** A full-arena floating joystick: touch wherever your thumb is comfortable. */
export function Controls({ input, energy, boosting, language, sensitivity, pivotCooldown, started }: { input: MutableRefObject<Input>; energy: number; boosting: boolean; language: Language; sensitivity: number; pivotCooldown: number; started: boolean }) {
  const t = copy(language);
  const movementPointer = useRef<number | null>(null);
  const boostPointers = useRef(new Set<number>());
  const origin = useRef({ x: 0, y: 0 });
  const radius = 53;
  const [stick, setStick] = useState<Stick>({ x: 0, y: 0, dx: 0, dy: 0, active: false });
  const [hasMoved, setHasMoved] = useState(false);
  const refreshBoost = () => { input.current.boost = boostPointers.current.size > 0; };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (movementPointer.current !== event.pointerId) return;
    let dx = event.clientX - origin.current.x;
    let dy = event.clientY - origin.current.y;
    const distance = Math.hypot(dx, dy);
    // Follow a long thumb drag instead of forcing the player back to a fixed base.
    if (distance > radius * 1.8) {
      const excess = distance - radius * 1.8;
      origin.current.x += dx / distance * excess; origin.current.y += dy / distance * excess;
      dx = event.clientX - origin.current.x; dy = event.clientY - origin.current.y;
    }
    const magnitude = Math.hypot(dx, dy);
    const deadZone = 5;
    const throttle = clamp((magnitude - deadZone) / (radius * .7 / sensitivity), 0, 1);
    input.current.x = magnitude > deadZone ? dx / magnitude * throttle : 0;
    input.current.y = magnitude > deadZone ? dy / magnitude * throttle : 0;
    if (magnitude > 10) setHasMoved(true);
    setStick({ x: origin.current.x, y: origin.current.y, dx: dx / Math.max(radius, magnitude) * radius, dy: dy / Math.max(radius, magnitude) * radius, active: true });
  };
  const release = (event: PointerEvent<HTMLElement>) => {
    if (movementPointer.current === event.pointerId) {
      movementPointer.current = null; input.current.x = input.current.y = 0;
      setStick(current => ({ ...current, active: false }));
    }
    boostPointers.current.delete(event.pointerId); refreshBoost();
  };
  useEffect(() => {
    const reset = () => { movementPointer.current = null; boostPointers.current.clear(); input.current = { x: 0, y: 0, boost: false }; setStick(current => ({ ...current, active: false })); };
    window.addEventListener('blur', reset); window.addEventListener('orientationchange', reset);
    return () => { reset(); window.removeEventListener('blur', reset); window.removeEventListener('orientationchange', reset); };
  }, [input]);

  return <>
    <div className="steering-surface" role="group" aria-label={t.joystick} data-testid="joystick"
      onPointerDown={event => {
        if (event.button > 0) return;
        event.preventDefault();
        if (movementPointer.current === null) {
          movementPointer.current = event.pointerId; origin.current = { x: event.clientX, y: event.clientY };
          setStick({ x: event.clientX, y: event.clientY, dx: 0, dy: 0, active: true });
        } else { boostPointers.current.add(event.pointerId); refreshBoost(); }
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer may already be released. */ }
      }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      <div className={`floating-stick ${stick.active ? 'active' : ''}`} style={{ left: stick.x, top: stick.y } as CSSProperties} aria-hidden="true"><div className="stick-dashed-ring" /><div className="floating-thumb" style={{ transform: `translate(${stick.dx}px,${stick.dy}px)` }}><MoveUpRight size={23} /></div></div>
    </div>
    {!hasMoved && !started && <div className="steering-hint"><Fingerprint size={23} /><span>{t.dragHint}<small>{t.controlMode}</small></span></div>}
    <div className="boost-dock">
      <button className={`pivot-action ${pivotCooldown > 0 ? 'cooldown' : ''}`} aria-label={t.pivot} disabled={!started || pivotCooldown > 0} onPointerDown={event => { event.preventDefault(); input.current.pivot = true; }} onClick={event => { if (event.detail === 0) input.current.pivot = true; }}><RotateCcw size={17} /><b>{pivotCooldown > 0 ? Math.ceil(pivotCooldown) : 'PIVOT'}</b></button>
      <button className={`boost-action ${boosting ? 'boosting' : ''}`} aria-label={t.boost} data-testid="boost" style={{ '--energy-angle': `${energy * 3.6}deg` } as CSSProperties}
        onPointerDown={event => { event.preventDefault(); boostPointers.current.add(event.pointerId); refreshBoost(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer may already be released. */ } }}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
        <span className="boost-action-core"><Zap size={27} fill="currentColor" strokeWidth={1.5} /><b>BOOST</b></span>
      </button>
      <span className="boost-percent">{Math.round(energy)}%</span>
    </div>
  </>;
}
