import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Pause, Play, Square } from 'lucide-react';
import { fill } from '@/lib/feature-text';
import { hapticFeedback } from '@/lib/native';
import { KEGEL_DAILY_GOAL, type KegelLevel } from '@/lib/recovery';
import type { RecoveryText } from '@/data/recovery';

type Phase = 'idle' | 'squeeze' | 'relax' | 'done';

/** Guided pelvic-floor session: the orb grows while squeezing and shrinks while relaxing. */
export function KegelTrainer({ t, level, locked, onUpgrade, cesarean, done, onComplete }: {
  t: RecoveryText; level: KegelLevel; locked: boolean; onUpgrade?: () => void; cesarean: boolean; done: number; onComplete: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rep, setRep] = useState(0);
  const [left, setLeft] = useState(level.hold);
  const [paused, setPaused] = useState(false);
  const completing = useRef(false);

  useEffect(() => {
    if (phase === 'idle' || phase === 'done' || paused) return;
    const id = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, paused]);

  useEffect(() => {
    if (left > 0 || phase === 'idle' || phase === 'done') return;
    if (phase === 'squeeze') {setPhase('relax');setLeft(level.rest);void hapticFeedback.light();return;}
    const next = rep + 1;
    if (next >= level.reps) {
      setPhase('done');setRep(next);
      if (!completing.current) {completing.current = true;void onComplete().finally(() => {completing.current = false;});}
      void hapticFeedback.heavy();
      return;
    }
    setRep(next);setPhase('squeeze');setLeft(level.hold);void hapticFeedback.medium();
  }, [left, phase, rep, level, onComplete]);

  const start = () => {setRep(0);setPhase('squeeze');setLeft(level.hold);setPaused(false);void hapticFeedback.medium();};
  const squeezing = phase === 'squeeze';
  const size = phase === 'idle' || phase === 'done' ? 150 : squeezing ? 196 : 120;
  const duration = squeezing ? level.hold : level.rest;

  return (
    <div className="cx-kegel">
      <div style={{ textAlign: 'center' }}>
        <p className="cx-eyebrow">{t.kegel_level[level.level]}</p>
        <b style={{ fontSize: 17, color: 'var(--a-ink)' }}>{t.kegel_title}</b>
        <p className="cx-sub">{fill(t.rhythm, { hold: level.hold, rest: level.rest })} · {fill(t.kegel_today, { done, goal: KEGEL_DAILY_GOAL, min: Math.max(1, Math.round(level.reps * (level.hold + level.rest) / 60)) })}</p>
      </div>
      <div className="cx-orb">
        <motion.div className="cx-orb-halo" animate={{ scale: squeezing ? 1 : .86, opacity: squeezing ? 1 : .7 }} transition={{ duration: paused ? 0 : Math.min(duration, 1.2) }} />
        <motion.div className="cx-orb-core" animate={{ width: size, height: size }} transition={{ duration: paused ? 0 : phase === 'idle' || phase === 'done' ? .4 : duration, ease: 'easeInOut' }} />
        <div className="cx-orb-text">
          {phase === 'idle' && <strong style={{ fontSize: 64 }}>🌸</strong>}
          {phase === 'done' && <><strong>✓</strong><b>{fill(t.kegel_done, { n: done || 1 })}</b></>}
          {(squeezing || phase === 'relax') && <><b>{squeezing ? t.squeeze : t.relax}</b><strong>{Math.max(0, left)}</strong><span style={{ fontSize: 12, opacity: .85 }}>{t.seconds}</span></>}
        </div>
      </div>
      <div className="cx-reps" aria-label={fill(t.rep, { n: rep, total: level.reps })}>
        {Array.from({ length: level.reps }, (_, i) => <i key={i} className={i < rep || phase === 'done' ? 'on' : ''} />)}
      </div>
      <p className="cx-sub" style={{ textAlign: 'center' }}>{phase === 'idle' ? t.kegel_howto : fill(t.rep, { n: Math.min(rep + 1, level.reps), total: level.reps })}</p>
      {locked ?
      <button type="button" className="a3-btn accent cx-wide" onClick={onUpgrade}><Lock size={16} />{t.kegel_premium}</button> :
      phase === 'idle' || phase === 'done' ?
      <button type="button" className="a3-btn accent cx-wide" onClick={start}><Play size={17} />{t.kegel_start}</button> :
      <div className="cx-grid2" style={{ width: '100%' }}>
          <button type="button" className="a3-btn ghost" onClick={() => setPaused((p) => !p)}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? t.resume : t.pause}</button>
          <button type="button" className="a3-btn ghost" onClick={() => {setPhase('idle');setPaused(false);}}><Square size={15} />{t.finish}</button>
        </div>
      }
      <p className="cx-disc" style={{ marginTop: 0 }}>{cesarean ? t.kegel_note_cesarean : t.kegel_note}</p>
    </div>);
}
