import { useMemo, useState } from 'react';
import { BAND_COLOR, formatTemp, tempBand, type IllnessEntry, type TempUnit } from '@/lib/illness';

/** Temperature line of the episode with medicine markers; tap a point to see its value and time. */
export function TempChart({ entries, locale, unit = 'C', feverLabel, emptyLabel }: { entries: IllnessEntry[]; locale: string; unit?: TempUnit; feverLabel: string; emptyLabel: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const W = 330, H = 132, padX = 14, top = 14, bottom = 26;
  const temps = useMemo(() => entries.filter((e) => e.kind === 'temp' && e.temp_c != null).slice(0, 24).reverse(), [entries]);
  if (temps.length < 2) return <p className="cx-sub" style={{ marginTop: 12, padding: '18px 0', textAlign: 'center', background: 'var(--a-surface-soft)', borderRadius: 16 }}>{emptyLabel}</p>;

  const t0 = new Date(temps[0].at).getTime();
  const t1 = Math.max(new Date(temps[temps.length - 1].at).getTime(), t0 + 1);
  const values = temps.map((e) => e.temp_c!);
  const lo = Math.min(36, ...values) - 0.3, hi = Math.max(39, ...values) + 0.3;
  const x = (iso: string) => padX + (new Date(iso).getTime() - t0) / (t1 - t0) * (W - padX * 2);
  const y = (v: number) => top + (hi - v) / (hi - lo) * (H - top - bottom);
  const points = temps.map((e) => ({ x: x(e.at), y: y(e.temp_c!), e }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${H - bottom} L${points[0].x.toFixed(1)},${H - bottom} Z`;
  const meds = entries.filter((e) => e.kind === 'med' && new Date(e.at).getTime() >= t0 && new Date(e.at).getTime() <= t1);
  const label = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const sel = picked != null ? points[picked] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg className="cx-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
      onPointerDown={(ev) => {
        const rect = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
        const px = (ev.clientX - rect.left) / rect.width * W;
        let best = 0;
        points.forEach((p, i) => {if (Math.abs(p.x - px) < Math.abs(points[best].x - px)) best = i;});
        setPicked(best);
      }}>
        <defs>
          <linearGradient id="cxTempFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ff5a5f" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ff5a5f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y={top} width={W} height={Math.max(0, y(38) - top)} fill="#ff5a5f" opacity="0.05" />
        <line x1="0" x2={W} y1={y(38)} y2={y(38)} stroke="#ff8a8e" strokeDasharray="4 4" strokeWidth="1" />
        <text x="4" y={y(38) - 4} fontSize="9" fill="#c92a2a">{feverLabel}</text>
        <path d={area} fill="url(#cxTempFill)" />
        <path d={path} fill="none" stroke="#ff5a5f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {meds.map((m) => <g key={m.id}><line x1={x(m.at)} x2={x(m.at)} y1={top} y2={H - bottom} stroke="var(--a-green-2)" strokeWidth="1" strokeDasharray="2 3" /><text x={x(m.at)} y={top + 2} fontSize="11" textAnchor="middle">💊</text></g>)}
        {points.map((p, i) => <circle key={p.e.id} cx={p.x} cy={p.y} r={picked === i ? 5.5 : 3.8} fill="var(--a-surface)" stroke={BAND_COLOR[tempBand(p.e.temp_c!)]} strokeWidth="2.5" />)}
        <text x={padX} y={H - 8} fontSize="9" fill="var(--a-ink-faint)">{label(temps[0].at)}</text>
        <text x={W - padX} y={H - 8} fontSize="9" fill="var(--a-ink-faint)" textAnchor="end">{label(temps[temps.length - 1].at)}</text>
      </svg>
      {sel &&
      <span className="cx-tip" style={{ left: `${sel.x / W * 100}%`, top: `${(sel.y + 10) / H * 100}%` }}>
          {formatTemp(sel.e.temp_c!, unit, locale)} · {new Date(sel.e.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </span>
      }
    </div>);
}
