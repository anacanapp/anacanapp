import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './States';

/** Inline SVG sparkline (no chart library, so the dashboard chunk stays small). */
export function Sparkline({ values, width = 96, height = 28, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - 2 - ((value - min) / span) * (height - 4)).toFixed(1)}`);
  return (
    <svg className={cn('ak-sparkline', className)} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={`0,${height} ${points.join(' ')} ${width},${height}`} className="ak-sparkline-fill" />
      <polyline points={points.join(' ')} className="ak-sparkline-line" />
    </svg>
  );
}

export interface StatTileProps {
  label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode;
  /** Relative change in percent (e.g. +12.5). */
  delta?: number | null; deltaLabel?: string; spark?: number[];
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success';
  loading?: boolean; onClick?: () => void; testId?: string;
}

export function StatTile({ label, value, hint, icon, delta, deltaLabel, spark, tone = 'default', loading, onClick, testId }: StatTileProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cn('ak-stat', onClick && 'is-clickable')} data-tone={tone} onClick={onClick} type={onClick ? 'button' : undefined} data-testid={testId}>
      <span className="ak-stat-label">{icon && <span className="ak-stat-icon" aria-hidden>{icon}</span>}{label}</span>
      {loading ? <Skeleton style={{ width: '60%', height: 26, marginTop: 6 }} /> : <strong className="ak-stat-value">{value}</strong>}
      <span className="ak-stat-foot">
        {!loading && typeof delta === 'number' && Number.isFinite(delta) && (
          <span className="ak-delta" data-dir={delta >= 0 ? 'up' : 'down'}>
            {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0)}%{deltaLabel && <em>{deltaLabel}</em>}
          </span>
        )}
        {hint && <span className="ak-stat-hint">{hint}</span>}
        {spark && !loading && <Sparkline values={spark} />}
      </span>
    </Tag>
  );
}

/** Row of KPI tiles; 2 columns on phones, up to `columns` on desktop. */
export function KpiRow({ children, columns = 4, className }: { children: ReactNode; columns?: 3 | 4 | 5 | 6; className?: string }) {
  return <div className={cn('ak-kpi-row', className)} data-cols={columns}>{children}</div>;
}

/** Percent change helper; returns null when the base is zero. */
export const pctChange = (current: number, previous: number) => (previous > 0 ? ((current - previous) / previous) * 100 : null);
