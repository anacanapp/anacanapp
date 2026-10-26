import type { CSSProperties } from 'react';
import { Rocket } from 'lucide-react';
import { itemById } from '../game/cosmetics';
import type { PlayerLook } from '../game/cosmetics';
import { BRAND_PATHS } from '../game/logo-art';

export function Logo({ id, size = 24, color = 'currentColor', look }: { id: string; size?: number; color?: string; look?: PlayerLook }) {
  if (id === 'rocket') return <Rocket size={size} strokeWidth={1.8} style={{ color }} aria-hidden="true" />;
  if (id === 'custom') {
    if (look?.customImage) return <img className="custom-logo-image" src={look.customImage} width={size} height={size} alt="" />;
    return <span className="monogram-logo" style={{ fontSize: size * (look?.monogram.length === 3 ? .38 : .55), width: size, height: size, color }}>{look?.monogram || 'S'}</span>;
  }
  const brand = BRAND_PATHS[id];
  const path = brand || itemById(id)?.path;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={brand ? color : 'none'} fillRule="evenodd" stroke={brand ? 'none' : color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

export function LogoToken({ look, color, size = 86, className = '' }: { look: PlayerLook; color: string; size?: number; className?: string }) {
  return <div className={`logo-token token-frame-${look.frame} token-trail-${look.trail} ${className}`} style={{ '--token-color': color, '--token-size': `${size}px` } as CSSProperties}><div className="token-core"><Logo id={look.logo} size={size * .52} color={color} look={look} /></div><i className="token-satellite satellite-one" /><i className="token-satellite satellite-two" /></div>;
}

export function Coin({ size = 17 }: { size?: number }) {
  return <span className="coin" style={{ width: size, height: size, fontSize: size * .53 } as CSSProperties}>S</span>;
}
