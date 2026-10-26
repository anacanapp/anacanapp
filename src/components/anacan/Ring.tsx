import type { ReactNode } from 'react';

interface RingProps {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
}

/** Progress ring with a tip marker; draws itself when its container has `.a3-enter`. */
export function Ring({ value, size = 128, stroke = 9, children, className = '' }: RingProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const angle = (2 * Math.PI * pct) / 100;
  const tipX = size / 2 + r * Math.cos(angle);
  const tipY = size / 2 + r * Math.sin(angle);
  return (
    <span className={`a3-ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ ['--c' as string]: c }}
        />
        {pct > 0 && <circle className="tip" cx={tipX} cy={tipY} r={stroke / 2 + 2} />}
      </svg>
      <span className="core">{children}</span>
    </span>
  );
}

/** Small completion ring with a "done/total" label. */
export function MiniRing({ done, total }: { done: number; total: number }) {
  const r = 18, c = 2 * Math.PI * r, off = c * (1 - (total ? done / total : 0));
  return (
    <span className="a3-mini-ring a3-num" aria-label={`${done}/${total}`}>
      <svg width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--a-coral-soft)" strokeWidth="5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--a-coral)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 600ms var(--a-spring)' }} />
      </svg>
      {done}/{total}
    </span>
  );
}
