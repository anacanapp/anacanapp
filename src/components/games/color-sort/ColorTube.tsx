import { forwardRef, useId } from 'react';
import { motion } from 'framer-motion';
import { Check, LockKeyhole } from 'lucide-react';
import type { LiquidUnit } from './session';

export const LIQUID_COLORS = ['#E85E87', '#4D88E5', '#28AA80', '#E4B13B', '#9364D5', '#27A8B8', '#EB8740', '#56628E'];
interface Props {
  units: LiquidUnit[]; revealed: Set<number>; index: number; label: string; number: (value: number) => string;
  selected: boolean; complete: boolean; locked: number; disabled: boolean; markers: boolean;
  hint: 'from' | 'to' | null; pouring: boolean; direction: number; onClick: () => void;
}
const ColorTube = forwardRef<HTMLButtonElement, Props>(function ColorTube({ units, revealed, index, label, number,
  selected, complete, locked, disabled, markers, hint, pouring, direction, onClick }, ref) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clip = `${id}-glass`;
  return <motion.button ref={ref} type="button" data-colorsort-tube={index} data-selected={selected || undefined}
    data-complete={complete || undefined} data-locked={locked > 0 || undefined} data-hint={hint || undefined}
    aria-label={label} aria-pressed={selected} disabled={disabled} onClick={onClick}
    className={`colorsort-tube ${complete ? 'is-complete' : ''} ${hint ? `is-hint-${hint}` : ''}`}
    animate={{ y: pouring ? -14 : selected ? -9 : 0, rotate: pouring ? direction * 16 : 0 }}
    transition={{ duration: 0.2 }}>
    <span className="colorsort-tube-status" aria-hidden="true">
      {locked > 0 ? <><LockKeyhole size={13} /><span>{number(locked)}</span></> : complete ? <Check size={17} /> : null}
    </span>
    <svg viewBox="0 0 60 156" aria-hidden="true" className="colorsort-glass">
      <defs>
        <clipPath id={clip}><path d="M10 24H50V130Q50 148 30 148Q10 148 10 130Z" /></clipPath>
        <linearGradient id={`${id}-shine`} x1="0" x2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.85" /><stop offset="0.35" stopColor="white" stopOpacity="0.1" />
          <stop offset="1" stopColor="white" stopOpacity="0.4" />
        </linearGradient>
        {LIQUID_COLORS.map((color, value) => <linearGradient key={color} id={`${id}-color-${value}`} x1="0" x2="1" y1="0" y2="0.5">
          <stop stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0.8" />
        </linearGradient>)}
      </defs>
      <path d="M8 20H52V130Q52 151 30 151Q8 151 8 130Z" fill="var(--colorsort-glass)" stroke="var(--colorsort-glass-line)" strokeWidth="2" />
      <g clipPath={`url(#${clip})`}>
        {units.map((unit, depth) => {
          const visible = revealed.has(unit.id), y = 143 - (depth + 1) * 27;
          return <g key={unit.id}>
            <rect x="10" y={y} width="40" height="27" fill={visible ? `url(#${id}-color-${unit.color})` : 'var(--colorsort-hidden)'} />
            <path d={`M10 ${y + 1}Q20 ${y - 1} 30 ${y + 1}T50 ${y + 1}`} stroke="white" strokeOpacity="0.4" strokeWidth="1.3" fill="none" />
            {(!visible || markers) && <text x="30" y={y + 18} textAnchor="middle" fontSize="12" fontWeight="800"
              fill={!visible ? 'var(--colorsort-hidden-ink)' : unit.color === 7 ? '#fff' : '#10283b'}>
              {visible ? number(unit.color + 1) : '?'}
            </text>}
          </g>;
        })}
        <path d="M14 27V129Q14 140 23 143" stroke="white" strokeOpacity="0.38" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      <path d="M8 20H52" stroke={complete ? '#38b58a' : 'var(--colorsort-glass-line)'} strokeWidth={complete ? '5' : '3'} strokeLinecap="round" />
      <path d="M12 12H48" stroke="var(--colorsort-glass-line)" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      {locked > 0 && <rect x="10" y="24" width="40" height="121" rx="18" fill="var(--colorsort-lock-cover)" />}
    </svg>
    <span className="colorsort-tube-number" aria-hidden="true">{number(index + 1)}</span>
  </motion.button>;
});
export default ColorTube;
