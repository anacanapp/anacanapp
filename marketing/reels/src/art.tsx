// Flat illustrations for the pancake reel. All drawn here (no stock assets). Each takes a pixel size.
import type { CSSProperties } from 'react';

type P = { size: number; style?: CSSProperties };
const svg = (size: number, vb: string, style: CSSProperties | undefined, children: React.ReactNode) =>
  <svg width={size} height={size} viewBox={vb} style={{ overflow: 'visible', ...style }}>{children}</svg>;

export const Banana = ({ size, style, peeled = 0 }: P & { peeled?: number }) => svg(size, '0 0 200 200', style, <>
  <ellipse cx="104" cy="178" rx="64" ry="9" fill="#000" opacity=".08" />
  <path d="M30 70 C 40 140, 120 175, 178 128 C 184 122, 178 112, 170 116 C 120 140, 66 124, 48 66 Z" fill="#FFD84A" />
  <path d="M48 66 C 66 124, 120 140, 170 116 C 150 136, 98 150, 60 112 C 50 100, 46 84, 48 66 Z" fill="#F2B729" />
  <path d="M30 70 C 28 62, 34 50, 44 52 L 48 66 Z" fill="#7A5A1E" />
  <path d="M178 128 l 10 -4 l -2 10 z" fill="#5C4317" />
  <path d="M58 84 C 76 120, 118 134, 156 122" stroke="#FFF1A6" strokeWidth="6" fill="none" strokeLinecap="round" opacity={0.7 * (1 - peeled)} />
</>);

export const Egg = ({ size, style, crack = 0 }: P & { crack?: number }) => svg(size, '0 0 200 200', style, <>
  <ellipse cx="100" cy="182" rx="46" ry="8" fill="#000" opacity=".08" />
  <g transform={`translate(${-crack * 26} ${crack * 6}) rotate(${-crack * 18} 100 110)`}>
    <path d="M100 26 C 140 26, 160 92, 156 122 L 44 122 C 40 92, 60 26, 100 26 Z" fill="#FFF6EA" />
    <path d="M44 122 L 60 112 L 74 124 L 88 110 L 100 122" fill="none" stroke="#E9D9C2" strokeWidth={crack > 0 ? 3 : 0} />
    <ellipse cx="80" cy="66" rx="12" ry="20" fill="#fff" opacity=".9" />
  </g>
  <g transform={`translate(${crack * 26} ${crack * 6}) rotate(${crack * 18} 100 130)`}>
    <path d="M44 122 C 46 158, 72 176, 100 176 C 128 176, 154 158, 156 122 L 142 112 L 128 124 L 114 110 L 100 122 L 88 110 L 74 124 L 60 112 Z" fill="#F7E9D5" />
  </g>
  {crack > 0.4 && <ellipse cx="100" cy={140 + crack * 40} rx="22" ry="18" fill="#FFB52E" opacity={Math.min(1, (crack - 0.4) * 3)} />}
</>);

export const OatJar = ({ size, style, tilt = 0 }: P & { tilt?: number }) => svg(size, '0 0 200 200', style, <g transform={`rotate(${tilt} 100 110)`}>
  <ellipse cx="100" cy="186" rx="58" ry="8" fill="#000" opacity=".08" />
  <rect x="44" y="52" width="112" height="132" rx="26" fill="#EAF4FF" opacity=".75" stroke="#CFE3F7" strokeWidth="4" />
  <rect x="50" y="96" width="100" height="82" rx="22" fill="#E8C98E" />
  {[[64, 112], [90, 106], [118, 116], [74, 140], [104, 134], [130, 146], [86, 162], [116, 162]].map(([x, y], i) =>
    <ellipse key={i} cx={x} cy={y} rx="9" ry="5.5" fill={i % 2 ? '#D6AF68' : '#F3DDB0'} transform={`rotate(${(i * 37) % 80 - 40} ${x} ${y})`} />)}
  <rect x="52" y="34" width="96" height="24" rx="10" fill="#FF8A8E" />
  <rect x="60" y="40" width="80" height="6" rx="3" fill="#FFB3B6" />
</g>);

export const Bowl = ({ size, style, fill = 0, batter = '#F6D776' }: P & { fill?: number; batter?: string }) => svg(size, '0 0 300 200', style, <>
  <ellipse cx="150" cy="186" rx="110" ry="10" fill="#000" opacity=".08" />
  <ellipse cx="150" cy="70" rx="128" ry="30" fill="#FFD0D2" />
  {fill > 0 && <ellipse cx="150" cy={72 + (1 - fill) * 18} rx={112 - (1 - fill) * 20} ry={22 - (1 - fill) * 6} fill={batter} />}
  <path d="M22 70 C 30 150, 90 182, 150 182 C 210 182, 270 150, 278 70 C 250 96, 50 96, 22 70 Z" fill="#FF6B70" />
  <path d="M40 100 C 70 132, 110 140, 150 140" stroke="#FF9A9E" strokeWidth="8" fill="none" strokeLinecap="round" opacity=".6" />
</>);

export const Pan = ({ size, style, children }: P & { children?: React.ReactNode }) => svg(size, '0 0 400 260', style, <>
  <ellipse cx="190" cy="236" rx="160" ry="14" fill="#000" opacity=".1" />
  <rect x="300" y="118" width="110" height="26" rx="13" fill="#3D3433" transform="rotate(-6 300 130)" />
  <ellipse cx="180" cy="140" rx="168" ry="92" fill="#2F2A29" />
  <ellipse cx="180" cy="132" rx="150" ry="78" fill="#45403F" />
  <ellipse cx="150" cy="104" rx="70" ry="18" fill="#5A5453" opacity=".5" />
  {children}
</>);

export const Pancake = ({ size, style, browned = 1, raw = 0 }: P & { browned?: number; raw?: number }) => svg(size, '0 0 200 120', style, <>
  <ellipse cx="100" cy="66" rx="92" ry="44" fill={raw > 0.5 ? '#F2D27A' : '#D9963E'} />
  <ellipse cx="100" cy="58" rx="88" ry="40" fill={raw > 0.5 ? '#F7DE94' : '#EDB45A'} />
  {browned > 0.3 && [[70, 50], [118, 46], [96, 66], [140, 62], [58, 66]].map(([x, y], i) =>
    <ellipse key={i} cx={x} cy={y} rx="9" ry="5" fill="#C9822F" opacity={browned * 0.55} />)}
  <ellipse cx="80" cy="44" rx="30" ry="8" fill="#fff" opacity=".22" />
</>);

export const PancakeStack = ({ size, style, count = 4, berries = true }: P & { count?: number; berries?: boolean }) => svg(size, '0 0 240 260', style, <>
  <ellipse cx="120" cy="238" rx="104" ry="14" fill="#000" opacity=".1" />
  <ellipse cx="120" cy="226" rx="112" ry="22" fill="#fff" />
  {Array.from({ length: count }, (_, i) => {
    const y = 200 - i * 30;
    return <g key={i}>
      <ellipse cx="120" cy={y + 8} rx="92" ry="26" fill="#D28B36" />
      <ellipse cx="120" cy={y} rx="90" ry="24" fill="#EDB45A" />
    </g>;
  })}
  {berries && <>
    <circle cx="96" cy={200 - (count - 1) * 30 - 12} r="12" fill="#5B6FD6" /><circle cx="122" cy={200 - (count - 1) * 30 - 16} r="12" fill="#E8485D" />
    <circle cx="146" cy={200 - (count - 1) * 30 - 10} r="11" fill="#5B6FD6" />
    <path d={`M100 ${200 - (count - 1) * 30 - 26} q 22 -16 40 0 q -20 8 -40 0`} fill="#56B36B" />
  </>}
</>);

export const Strips = ({ size, style, spread = 1 }: P & { spread?: number }) => svg(size, '0 0 260 160', style, <>
  {[0, 1, 2, 3, 4].map((i) => {
    const x = 34 + i * 40 + (i - 2) * 10 * spread;
    const r = (i - 2) * 6 * spread;
    return <g key={i} transform={`rotate(${r} ${x + 14} 80)`}>
      <rect x={x} y={26} width="30" height="108" rx="13" fill="#D28B36" />
      <rect x={x + 2} y={24} width="26" height="104" rx="12" fill="#EDB45A" />
      <rect x={x + 7} y={36} width="5" height="70" rx="3" fill="#fff" opacity=".22" />
    </g>;
  })}
</>);

export const Plate = ({ size, style, children }: P & { children?: React.ReactNode }) => svg(size, '0 0 300 200', style, <>
  <ellipse cx="150" cy="176" rx="132" ry="16" fill="#000" opacity=".08" />
  <ellipse cx="150" cy="120" rx="140" ry="62" fill="#fff" />
  <ellipse cx="150" cy="116" rx="106" ry="44" fill="#FFF6F2" />
  {children}
</>);

export const Fork = ({ size, style }: P) => svg(size, '0 0 60 200', style, <>
  <rect x="26" y="78" width="9" height="118" rx="4.5" fill="#B9B2AE" />
  <path d="M14 10 v 52 c 0 14 32 14 32 0 v -52" stroke="#CFC9C5" strokeWidth="7" fill="none" strokeLinecap="round" />
  <path d="M24.5 10 v 46 M 35.5 10 v 46" stroke="#CFC9C5" strokeWidth="6" strokeLinecap="round" />
</>);

export const Spoon = ({ size, style }: P) => svg(size, '0 0 60 200', style, <>
  <rect x="26" y="70" width="9" height="126" rx="4.5" fill="#E0A8AB" />
  <ellipse cx="30.5" cy="40" rx="20" ry="32" fill="#FFB3B6" />
</>);

export const Oat = ({ size, style, light }: P & { light?: boolean }) => svg(size, '0 0 20 12', style,
  <ellipse cx="10" cy="6" rx="9" ry="5.5" fill={light ? '#F3DDB0' : '#D6AF68'} />);
