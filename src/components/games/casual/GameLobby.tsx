import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, LockKeyhole, Play, Star } from 'lucide-react';
import type { CasualText } from './useCasualText';
import type { CasualProfile } from './storage';

export default function GameLobby({ title, description, image, count, profile, savedLevel, t, number, onPlay }: {
  title: string; description: string; image: string; count: number; profile: CasualProfile<unknown>; savedLevel: number | null;
  t: CasualText; number: (value: number) => string; onPlay: (level: number) => void;
}) {
  const [page, setPage] = useState(() => Math.floor((profile.unlocked - 1) / 10));
  const current = savedLevel || profile.unlocked;
  return <div className="cg-lobby"><section className="cg-hero"><div className="cg-hero-art"><img src={image} width="512" height="512" alt="" /></div>
    <h2>{title}</h2><p>{description}</p><button type="button" className="cg-primary cg-play" onClick={() => onPlay(current)}><Play size={17} fill="currentColor" /><span>{t(savedLevel ? 'resume' : 'play')}</span><small>{t('level', { level: current })}<ArrowRight size={16} /></small></button></section>
    <section className="cg-level-panel"><div className="cg-page"><button type="button" className="cg-icon" disabled={page === 0} aria-label={t('back')} onClick={() => setPage(value => value - 1)}><ChevronLeft className="rtl:rotate-180" size={18} /></button>
      <h3>{number(page * 10 + 1)} – {number(Math.min(count, page * 10 + 10))}</h3><button type="button" className="cg-icon" disabled={(page + 1) * 10 >= count} aria-label={t('next')} onClick={() => setPage(value => value + 1)}><ChevronRight className="rtl:rotate-180" size={18} /></button></div>
      <div className="cg-levels">{Array.from({ length: Math.min(10, count - page * 10) }, (_, i) => i + page * 10 + 1).map(level => {
        const result = profile.levels[String(level)];
        return <button type="button" key={level} data-casual-level={level} aria-label={t('level', { level })} disabled={level > profile.unlocked} className={result ? 'is-complete' : level === profile.unlocked ? 'is-current' : ''} onClick={() => onPlay(level)}>
          {level <= profile.unlocked ? <strong>{number(level)}</strong> : <LockKeyhole size={18} />}<span>{result && [1, 2, 3].map(star => <Star key={star} size={9} fill={star <= result.stars ? 'currentColor' : 'none'} />)}</span>
        </button>;
      })}</div>
    </section><p className="cg-save-note">{t('saved')}</p></div>;
}
