// Baby home: feeding and sleep widgets. They log through the same actions as the Baby tracker
// tool (useBabyCareActions); the full history and analysis stay in the tool.
import '@/styles/babycare.css';
import { memo, useEffect, useState } from 'react';
import { ChevronRight, Moon, Plus } from 'lucide-react';
import { bc } from '@/lib/babycare-i18n';
import { rd } from '@/lib/redesign-i18n';
import { formatClockSeconds } from '@/lib/baby-logs-range';
import { useBabyCareActions, FORMULA_PRESETS_ML } from '@/hooks/useBabyCareActions';
import { agoLabel, hoursMinutes } from './MommyHome';

const Elapsed = memo(function Elapsed({ since }: { since: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(id); }, []);
  return <>{formatClockSeconds(Math.max(0, Math.floor((Date.now() - since) / 1000)))}</>;
});

function Head({ title, meta, onOpen }: { title: string; meta?: string | null; onOpen?: () => void }) {
  return (
    <div className="a3-entry-head">
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="a3-entry-title">{title}</span>
        {meta && <span className="a3-meta">{meta}</span>}
      </span>
      {onOpen && <button type="button" className="a3-link" onClick={onOpen}>{rd('see_all')}<ChevronRight size={16} className="rtl:rotate-180" /></button>}
    </div>
  );
}

type Extra = null | 'formula' | 'solid';

export function FeedingWidget({ feedingsToday, lastFeedIso, onOpenTracker }: { feedingsToday: number; lastFeedIso?: string | null; onOpenTracker?: () => void }) {
  const { busy, leftTimer, rightTimer, toggleBreast, saveFormula, saveSolid } = useBabyCareActions({ feedingsToday });
  const [extra, setExtra] = useState<Extra>(null);
  const [ml, setMl] = useState('');
  const [food, setFood] = useState('');
  const last = agoLabel(lastFeedIso);
  const meta = `${rd('today')}: ${feedingsToday} ${bc('babytracker_times')}${last ? ` · ${bc('babytracker_last').toLowerCase()} ${last}` : ''}`;
  const toggle = (next: Extra) => setExtra((cur) => (cur === next ? null : next));

  return (
    <section className="a3-sec" data-blog-module-section="feeding" tabIndex={-1}>
      <div className="a3-card a3-pad bt-widget">
        <Head title={bc('babytracker_tab_feeding')} meta={meta} onOpen={onOpenTracker} />
        <div className="bt-two">
          {(['left', 'right'] as const).map((side) => {
            const timer = side === 'left' ? leftTimer : rightTimer;
            return (
              <button key={side} type="button" className={`bt-breast${timer ? ' live' : ''}`} onClick={() => void toggleBreast(side)} disabled={busy} aria-pressed={!!timer}>
                <b>{side === 'left' ? bc('babytracker_breast_left') : bc('babytracker_breast_right')}</b>
                <span className="a3-num">{timer ? <>{bc('babytracker_running')} · <Elapsed since={timer.startTime} /></> : bc('babytracker_start')}</span>
              </button>
            );
          })}
        </div>
        <div className="bt-options" role="group" aria-label={bc('babytracker_bottle')}>
          <button type="button" className={`a3-chip-btn${extra === 'formula' ? ' on' : ''}`} aria-expanded={extra === 'formula'} onClick={() => toggle('formula')}>🍼 {bc('home_formula')}</button>
          <button type="button" className={`a3-chip-btn${extra === 'solid' ? ' on' : ''}`} aria-expanded={extra === 'solid'} onClick={() => toggle('solid')}>🥣 {bc('home_solid')}</button>
        </div>
        {extra === 'formula' && (
          <div className="bt-extra">
            <div className="bt-presets">
              {FORMULA_PRESETS_ML.map((v) => (
                <button key={v} type="button" className="bt-preset a3-num" disabled={busy} onClick={() => void saveFormula(v).then((ok) => ok && setExtra(null))}>{v} ml</button>
              ))}
            </div>
            <form className="bt-inline" onSubmit={(e) => { e.preventDefault(); void saveFormula(Number(ml.replace(',', '.'))).then((ok) => { if (ok) { setMl(''); setExtra(null); } }); }}>
              <input className="bt-input" inputMode="decimal" value={ml} onChange={(e) => setMl(e.target.value)} placeholder={bc('home_other_ml')} aria-label={bc('babytracker_ml_label')} />
              <button type="submit" className="a3-btn soft sm" disabled={busy || !ml.trim()}><Plus size={14} />ml</button>
            </form>
          </div>
        )}
        {extra === 'solid' && (
          <form className="bt-inline bt-extra" onSubmit={(e) => { e.preventDefault(); void saveSolid(food).then((ok) => { if (ok) { setFood(''); setExtra(null); } }); }}>
            <input className="bt-input" maxLength={80} value={food} onChange={(e) => setFood(e.target.value)} placeholder={bc('babytracker_solid_label')} aria-label={bc('babytracker_solid_label')} />
            <button type="submit" className="a3-btn soft sm" disabled={busy || !food.trim()}><Plus size={14} />{bc('babytracker_solid_save')}</button>
          </form>
        )}
      </div>
    </section>
  );
}

export function SleepWidget({ sleepMinutesToday, onOpenTracker }: { sleepMinutesToday: number; onOpenTracker?: () => void }) {
  const { busy, sleepTimer, toggleSleep } = useBabyCareActions();
  return (
    <section className="a3-sec" data-blog-module-section="sleep" tabIndex={-1}>
      <div className="a3-card a3-pad bt-widget">
        <Head title={bc('babytracker_tab_sleep')} meta={`${rd('today')}: ${hoursMinutes(sleepMinutesToday)}`} onOpen={onOpenTracker} />
        <div className="bt-sleep-row">
          <span className="a3-ico-sq c-lav" aria-hidden="true"><Moon size={20} /></span>
          <span className="grow">
            <span className="a3-entry-title">{sleepTimer ? bc('babytracker_sleep_running') : bc('babytracker_sleep_idle')}</span>
            {sleepTimer && <span className="bt-sleep-live a3-num"><Elapsed since={sleepTimer.startTime} /></span>}
          </span>
          <button type="button" className={`a3-btn sm ${sleepTimer ? 'accent' : 'soft'}`} onClick={() => void toggleSleep()} disabled={busy}>
            {sleepTimer ? bc('babytracker_sleep_stop') : bc('babytracker_sleep_start')}
          </button>
        </div>
      </div>
    </section>
  );
}
