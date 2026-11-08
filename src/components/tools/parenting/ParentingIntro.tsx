import { useEffect, useRef, useState } from 'react';
import type { AgeBandId } from '@/data/parenting/types';
import { AGE_BANDS } from '@/data/parenting/types';
import { bandKey, pf, pt, type ParentingKey } from '@/lib/parenting-copy';
import { pushBackHandler } from '@/lib/backButton';

/** First-run intro, once per device and account. */
export const introKey = (uid: string | null) => `anacan.parenting.intro.v1.${uid || 'guest'}`;
export function introSeen(uid: string | null): boolean {
  try { return localStorage.getItem(introKey(uid)) === '1'; } catch { return true; }
}
export function markIntroSeen(uid: string | null) {
  try { localStorage.setItem(introKey(uid), '1'); } catch { /* storage blocked: the intro may show again */ }
}

const STEPS: { emoji: string; title: ParentingKey; text: ParentingKey }[] = [
  { emoji: '🧭', title: 'par_intro_title_1', text: 'par_intro_text_1' },
  { emoji: '🆘', title: 'par_intro_title_2', text: 'par_intro_text_2' },
  { emoji: '📅', title: 'par_intro_title_3', text: 'par_intro_text_3' },
];

/**
 * Short 3-step intro (age guide, SOS, programmes and quizzes). Without a birth date it ends with the age-band
 * question instead of silently defaulting to 1–3. Skippable at every step.
 */
export function ParentingIntro({ askBand, onDone }: { askBand: boolean; onDone: (band: AgeBandId | null) => void }) {
  const [step, setStep] = useState(0);
  const total = STEPS.length + (askBand ? 1 : 0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, [step]);
  // Android back closes the intro like "Skip".
  useEffect(() => pushBackHandler(() => { onDone(null); return true; }), [onDone]);

  const info = STEPS[step];
  const last = step === total - 1;
  return (
    <>
      <div className="a3-sheet-overlay" aria-hidden onClick={() => onDone(null)} />
      <div className="a3-sheet a-scope a-par-intro" role="dialog" aria-modal="true" aria-labelledby="par-intro-title" data-testid="parenting-intro">
        <div className="a3-grabber" aria-hidden="true" />
        <div className="a-par-intro-body">
          <div className="a-par-intro-top">
            <small>{pf('par_intro_step', { n: step + 1, total })}</small>
            <button type="button" className="a-par-intro-skip" onClick={() => onDone(null)}>{pt('par_intro_skip')}</button>
          </div>
          {info ? (
            <>
              <span className="a-par-intro-emoji" aria-hidden>{info.emoji}</span>
              <h2 id="par-intro-title" ref={titleRef} tabIndex={-1}>{pt(info.title)}</h2>
              <p>{pt(info.text)}</p>
            </>
          ) : (
            <>
              <span className="a-par-intro-emoji" aria-hidden>🧒</span>
              <h2 id="par-intro-title" ref={titleRef} tabIndex={-1}>{pt('par_intro_band_title')}</h2>
              <p>{pt('par_intro_band_text')}</p>
              <div className="a-par-intro-bands" role="group" aria-label={pt('par_band_pick')}>
                {AGE_BANDS.map((b) => <button key={b} type="button" onClick={() => onDone(b)}>{pt(bandKey(b))}</button>)}
              </div>
            </>
          )}
          <div className="a-par-intro-dots" aria-hidden>{Array.from({ length: total }, (_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
          {info && (
            <button type="button" className="a-par-btn" onClick={() => (last ? onDone(null) : setStep(step + 1))}>
              {pt(last ? 'par_intro_start' : 'par_intro_next')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
