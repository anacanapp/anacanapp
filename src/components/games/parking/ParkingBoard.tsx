import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, KeyRound, LockKeyhole } from 'lucide-react';
import { moveParking } from './engine';
import type { ParkingLevel, ParkingState, ParkingMove } from './model';
import type { CasualText } from '../casual/useCasualText';
import qucaq from '@/assets/onboarding/mother-mode.webp';
import { QUCAQ_NAME } from '../casual/art';

const COLORS = ['#58a18d', '#eaa478', '#af8dc8', '#73a7c1', '#dbbb6c', '#cf8d9b', '#8cab75', '#6caeae', '#c39c77', '#aa91be', '#a9b87b'];
export default function ParkingBoard({ level, state, selected, onSelect, onMove, hint, disabled, t }: {
  level: ParkingLevel; state: ParkingState; selected: number | null; onSelect: (car: number) => void;
  onMove: (move: ParkingMove) => void; hint: ParkingMove | null; disabled: boolean; t: CasualText;
}) {
  const region = useRef<HTMLDivElement>(null), board = useRef<HTMLDivElement>(null), [size, setSize] = useState(280);
  const gesture = useRef<{ id: number; car: number; from: number; x: number; y: number; offset: number } | null>(null);
  const [drag, setDrag] = useState<{ car: number; offset: number } | null>(null);
  useEffect(() => {
    const measure = () => { const el = region.current; if (el?.clientHeight && el.clientWidth) setSize(Math.floor(Math.max(170, Math.min(420, el.clientWidth - 30, el.clientHeight - 35)))); };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (region.current) observer?.observe(region.current); measure(); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  useEffect(() => { if (disabled) { gesture.current = null; setDrag(null); } }, [disabled]);
  const cell = (size - 6) / 6;
  const maxOffset = (carIndex: number, requested: number) => {
    const from = state.positions[carIndex], sign = Math.sign(requested), car = level.cars[carIndex];
    let max = 0;
    for (let amount = 1; amount <= 6; amount++) {
      const to = from + sign * amount;
      if (to < 0 || to > 6 - car.length || !moveParking(level, state, { car: carIndex, to })) break;
      max = amount;
    }
    if (carIndex === 0 && sign > 0 && moveParking(level, state, { car: 0, to: 6 })) max = 6 - from;
    return sign * Math.min(Math.abs(requested), max * cell);
  };
  return <div className="parking-region" ref={region} dir="ltr"><div className="parking-lot" ref={board} style={{ width: size, height: size, '--parking-cell': `${cell}px` } as CSSProperties} data-testid="parking-board">
    <div className="parking-grid" aria-hidden="true" />
    <div className={`parking-exit ${state.open ? 'is-open' : ''}`} style={{ top: cell * 2 + 3, height: cell - 6 }} aria-label={t('exit')}>{state.open ? <ArrowRight size={18} /> : <LockKeyhole size={16} />}</div>
    {level.keyBay && <div className="parking-key-bay" style={{ left: level.cars[level.keyBay.car].axis === 'h' ? level.keyBay.position * cell : level.cars[level.keyBay.car].lane * cell,
      top: level.cars[level.keyBay.car].axis === 'h' ? level.cars[level.keyBay.car].lane * cell : level.keyBay.position * cell }}><KeyRound size={18} /></div>}
    {level.cars.map((car, index) => {
      const from = state.positions[index], offset = drag?.car === index ? drag.offset : 0;
      const horizontal = car.axis === 'h';
      const forward = hint?.car === index && hint.to > from, HintIcon = horizontal ? forward ? ArrowRight : ArrowLeft : forward ? ArrowDown : ArrowUp;
      return <button type="button" key={car.id} disabled={disabled} className={`parking-car ${horizontal ? 'is-horizontal' : 'is-vertical'} ${index === 0 ? 'is-qucaq' : ''} ${selected === index ? 'is-selected' : ''} ${hint?.car === index ? 'is-hint' : ''} ${drag?.car === index ? 'is-dragging' : ''}`}
        data-parking-car={index} data-car-position={from} data-car-axis={car.axis} aria-label={index === 0 ? QUCAQ_NAME : `${t(car.length === 3 ? 'bus' : 'cars')} ${car.id}`} aria-pressed={selected === index}
        style={{ left: (horizontal ? from : car.lane) * cell + 4, top: (horizontal ? car.lane : from) * cell + 4,
          width: (horizontal ? car.length : 1) * cell - 8, height: (horizontal ? 1 : car.length) * cell - 8,
          '--car-color': COLORS[index % COLORS.length], transform: `translate${horizontal ? 'X' : 'Y'}(${offset}px)` } as CSSProperties}
        onPointerDown={event => {
          if (disabled || gesture.current || event.button !== 0 || event.isPrimary === false) return;
          event.preventDefault(); onSelect(index); gesture.current = { id: event.pointerId, car: index, from, x: event.clientX, y: event.clientY, offset: 0 };
          event.currentTarget.setPointerCapture?.(event.pointerId); setDrag({ car: index, offset: 0 });
        }}
        onPointerMove={event => {
          const current = gesture.current; if (!current || current.id !== event.pointerId || disabled) return;
          current.offset = maxOffset(index, horizontal ? event.clientX - current.x : event.clientY - current.y); setDrag({ car: index, offset: current.offset });
        }}
        onPointerUp={event => {
          const current = gesture.current; if (!current || current.id !== event.pointerId) return;
          gesture.current = null; setDrag(null);
          let to = current.from + Math.round(current.offset / cell);
          if (index === 0 && current.offset / cell > 4.7 - current.from && moveParking(level, state, { car: 0, to: 6 })) to = 6;
          if (to !== current.from) onMove({ car: index, to });
        }}
        onPointerCancel={() => { gesture.current = null; setDrag(null); }} onLostPointerCapture={() => { if (gesture.current) { gesture.current = null; setDrag(null); } }}
        onClick={event => { if (event.detail === 0) onSelect(index); }}>
        <i className="parking-window" /><i className="parking-roof" /><span className="parking-car-mark">{index === 0 ? <img src={qucaq} width="40" height="40" alt="" /> : car.id}</span>
        {level.keyBay?.car === index && <KeyRound size={13} className="parking-key-mark" />}
        <i className="parking-wheel parking-wheel-1" /><i className="parking-wheel parking-wheel-2" />
        {hint?.car === index && <span className="parking-hint-arrow"><HintIcon size={22} /></span>}
      </button>;
    })}
  </div></div>;
}
