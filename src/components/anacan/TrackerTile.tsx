import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { hapticFeedback } from '@/lib/native';

export type Tone = 'c-peach' | 'c-pink' | 'c-lav' | 'c-blue' | 'c-green' | 'c-yellow' | 'c-coral' | 'c-ink';

interface TrackerTileProps {
  icon: LucideIcon;
  tone: Tone;
  value: ReactNode;
  label: string;
  onClick: () => void;
  /** Shows a "+" chip and celebrates increments of `count`. */
  plus?: boolean;
  count?: number;
  live?: boolean;
  ariaLabel?: string;
}

/** Compact "today" tile: icon, big value, label. Increments pop with a floating +1. */
export function TrackerTile({ icon: Icon, tone, value, label, onClick, plus, count, live, ariaLabel }: TrackerTileProps) {
  const previous = useRef(count);
  const tappedAt = useRef(0);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    // Only celebrate increases the user just caused, not data arriving from the server.
    const fresh = Date.now() - tappedAt.current < 5000;
    if (fresh && count !== undefined && previous.current !== undefined && count > previous.current) setBump((n) => n + 1);
    previous.current = count;
  }, [count]);

  return (
    <button
      type="button"
      className={`a3-tk${live ? ' live' : ''}${bump ? ' bump' : ''}`}
      key={bump}
      onClick={() => { tappedAt.current = Date.now(); void hapticFeedback.light(); onClick(); }}
      aria-label={ariaLabel || label}
    >
      <span className={`ico ${tone}`}><Icon size={16} strokeWidth={2} /></span>
      {plus && <span className="plus" aria-hidden="true"><Plus size={14} strokeWidth={2.6} /></span>}
      <span style={{ minWidth: 0 }}><b className="a3-num">{value}</b><span className="lbl">{label}</span></span>
      {bump > 0 && <span className="a3-plus1" aria-hidden="true">+1</span>}
    </button>
  );
}
