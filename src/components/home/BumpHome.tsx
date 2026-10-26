// Redesign v3: pregnancy home pieces (hero with ring + fetus art, month gallery, week sheet, milestones).
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Heart, User, Sparkles } from 'lucide-react';
import { rd } from '@/lib/redesign-i18n';
import { tr } from '@/lib/tr';
import { Ring } from '@/components/anacan/Ring';
import { Sheet } from '@/components/anacan/Sheet';
import { Section } from '@/components/anacan/Section';
import { usePregnancyContentByDay } from '@/hooks/usePregnancyContent';
import { useFetusIllustrationByMonth } from '@/hooks/useFetusIllustrations';
import { useFruitImages, getDynamicFruitData } from '@/hooks/useFruitData';
import { useHomePlanStore } from '@/store/homePlanStore';
import type { UpcomingEvent } from './HomeParts';
import FetusMonth1 from '@/assets/fetus/month-1.svg';
import FetusMonth2 from '@/assets/fetus/month-2.svg';
import FetusMonth3 from '@/assets/fetus/month-3.svg';
import FetusMonth4 from '@/assets/fetus/month-4.svg';
import FetusMonth5 from '@/assets/fetus/month-5.svg';
import FetusMonth6 from '@/assets/fetus/month-6.svg';
import FetusMonth7 from '@/assets/fetus/month-7.svg';
import FetusMonth8 from '@/assets/fetus/month-8.svg';
import FetusMonth9 from '@/assets/fetus/month-9.svg';

export const FETUS_SVGS: Record<number, string> = { 1: FetusMonth1, 2: FetusMonth2, 3: FetusMonth3, 4: FetusMonth4, 5: FetusMonth5, 6: FetusMonth6, 7: FetusMonth7, 8: FetusMonth8, 9: FetusMonth9 };
/** Same month formula as the original dashboard. */
export const fetusMonthOf = (week: number) => Math.max(1, Math.min(Math.ceil(week / 4.4), 9));

/** Fetus image: admin-managed DB image with the bundled SVG as fallback. */
export function FetusImage({ month, src, alt }: { month: number; src?: string | null; alt: string }) {
  const fallback = FETUS_SVGS[month] || FETUS_SVGS[1];
  return (
    <img
      src={src || fallback}
      alt={alt}
      onError={(e) => { if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback; }}
    />
  );
}

const formatSize = (g: number) => (g >= 1000 ? rd('unit_kg', { n: (Math.round(g / 100) / 10).toLocaleString() }) : rd('unit_g', { n: Math.round(g) }));

export function BumpHero({
  greeting, week, dayInWeek, day, trimester, isNow, daysLeft, fruit, lengthCm, weightG, headline, firstLine,
  fetusSrc, onPrevWeek, onNextWeek, onOpenWeek,
}: {
  greeting: string; week: number; dayInWeek: number; day: number; trimester: number; isNow: boolean; daysLeft: number;
  fruit: string; lengthCm: number; weightG: number; headline: React.ReactNode; firstLine?: string;
  fetusSrc?: string | null; onPrevWeek: () => void; onNextWeek: () => void; onOpenWeek: () => void;
}) {
  const month = fetusMonthOf(week);
  const triFill = [[0, 13], [13, 27], [27, 40]].map(([a, b]) => Math.max(0, Math.min(1, (day / 7 - a) / (b - a))) * 100);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  return (
    <section
      className="a3-hero"
      aria-label={rd('week_n', { n: week })}
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button')) swipe.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => { const s = swipe.current; if (s && Math.abs(e.clientX - s.x) > Math.abs(e.clientY - s.y)) setDx((e.clientX - s.x) * 0.4); }}
      onPointerUp={(e) => {
        const s = swipe.current; swipe.current = null; setDx(0);
        if (!s) return;
        const delta = e.clientX - s.x;
        const rtl = document.documentElement.dir === 'rtl';
        if (Math.abs(delta) > 48) ((delta < 0) !== rtl ? onNextWeek : onPrevWeek)();
      }}
      onPointerCancel={() => { swipe.current = null; setDx(0); }}
    >
      <div className="a3-hero-top">
        <span className="a3-chip ac">{isNow ? greeting : rd('week_preview')}</span>
        <span className="a3-stepper">
          <button type="button" onClick={onPrevWeek} disabled={week <= 4} aria-label={rd('prev_week')}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
          <button type="button" onClick={onNextWeek} disabled={week >= 40} aria-label={rd('next_week')}><ChevronRight size={16} className="rtl:rotate-180" /></button>
        </span>
      </div>
      <div className="a3-hero-main" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}>
        <button type="button" className="a3-ring-btn" onClick={onOpenWeek} aria-label={rd('week_details', { n: week })}>
          <Ring value={(day / 280) * 100}>
            <b className="a3-num">{week}</b>
            <span>{isNow ? rd('week_day', { d: dayInWeek }) : rd('week_unit')}</span>
          </Ring>
        </button>
        <button type="button" className="a3-art" onClick={onOpenWeek} aria-label={rd('week_details', { n: week })}>
          <FetusImage month={month} src={fetusSrc} alt={`${week} ${tr('dashboard_week_baby', 'həftəlik körpə')}`} />
        </button>
        <div className="a3-hero-txt">
          <p className="a3-eyebrow">{[rd('tri_1'), rd('tri_2'), rd('tri_3')][trimester - 1] || rd('tri_3')}</p>
          <p className="a3-hero-line">{headline}</p>
          {firstLine && <p className="a3-meta">{firstLine}</p>}
        </div>
      </div>
      <div className="a3-stats a3-num">
        <div><b>{rd('unit_cm', { n: lengthCm })}</b><span>{rd('stat_length')}</span></div>
        <div><b>{formatSize(weightG)}</b><span>{rd('stat_weight')}</span></div>
        <div><b>{daysLeft}</b><span>{rd('stat_days_left')}</span></div>
      </div>
      <div>
        <div className="a3-tri">{triFill.map((f, i) => <i key={i}><b style={{ width: `${f}%` }} /></i>)}</div>
        <div className="a3-tri-l">{[rd('tri_1'), rd('tri_2'), rd('tri_3')].map((l, i) => <span key={l} className={trimester === i + 1 ? 'on' : undefined}>{l}</span>)}</div>
      </div>
      <span className="sr-only">{fruit}</span>
    </section>
  );
}

export function MonthGallery({ currentWeek, onOpenWeek }: { currentWeek: number; onOpenWeek: (week: number) => void }) {
  const current = fetusMonthOf(currentWeek);
  const railRef = useRef<HTMLDivElement>(null);
  return (
    <Section title={rd('months_title')} meta={<span className="a3-meta">{rd('month_n', { n: current })}</span>}>
      <div
        className="a3-rail"
        ref={(el) => {
          (railRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          const on = el?.querySelector<HTMLElement>('.a3-month.on');
          if (el && on && !el.dataset.scrolled) { el.scrollLeft = on.offsetLeft - 20; el.dataset.scrolled = '1'; }
        }}
      >
        {Array.from({ length: 9 }, (_, i) => i + 1).map((m) => {
          const start = Math.floor((m - 1) * 4.4) + 1, end = m === 9 ? 40 : Math.floor(m * 4.4);
          return (
            <button key={m} type="button" className={`a3-month${m === current ? ' on' : m > current ? ' future' : ''}`} onClick={() => onOpenWeek(Math.max(4, start))}>
              <img src={FETUS_SVGS[m]} alt="" loading="lazy" />
              <span>{rd('month_n', { n: m })}</span>
              <small>{rd('weeks_range', { a: start, b: end })}</small>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

const WEEK_LIST: [number, number, string[]][] = [
  [4, 13, ['wl1_1', 'wl1_2', 'wl1_3', 'wl1_4']],
  [14, 27, ['wl2_1', 'wl2_2', 'wl2_3', 'wl2_4']],
  [28, 40, ['wl3_1', 'wl3_2', 'wl3_3', 'wl3_4']],
];

/** Week detail: same daily content source as the home screen, for any week. */
export function WeekSheet({ week, onClose, onChangeWeek }: { week: number | null; onClose: () => void; onChangeWeek: (w: number) => void }) {
  const w = week ?? 4;
  const day = Math.max(1, Math.min(280, (w - 1) * 7 + 1));
  const { data: content } = usePregnancyContentByDay(week ? day : undefined);
  const { data: fruitImages = [] } = useFruitImages();
  const month = fetusMonthOf(w);
  const fetusDb = useFetusIllustrationByMonth(month);
  const sizes = getDynamicFruitData(fruitImages, day, w, content);
  const checks = useHomePlanStore((s) => s.weekChecks[w]) || [];
  const toggle = useHomePlanStore((s) => s.toggleWeekCheck);
  const list = (WEEK_LIST.find(([a, b]) => w >= a && w <= b) || WEEK_LIST[2])[2];
  const blocks = [
    { title: rd('tab_baby'), text: content?.baby_development, icon: Heart, tone: 'c-pink' },
    { title: rd('tab_you'), text: content?.body_changes, icon: User, tone: 'c-lav' },
    { title: rd('tab_tip'), text: content?.daily_tip, icon: Sparkles, tone: 'c-yellow' },
  ].filter((b) => b.text);
  return (
    <Sheet
      open={week !== null}
      onClose={onClose}
      title={rd('week_n', { n: w })}
      actions={(
        <span className="a3-stepper">
          <button type="button" onClick={() => onChangeWeek(w - 1)} disabled={w <= 4} aria-label={rd('prev_week')}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
          <button type="button" onClick={() => onChangeWeek(w + 1)} disabled={w >= 40} aria-label={rd('next_week')}><ChevronRight size={16} className="rtl:rotate-180" /></button>
        </span>
      )}
    >
      <div className="a3-hero" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span className="a3-art" style={{ width: 190, height: 190 }}><FetusImage month={month} src={fetusDb} alt={rd('month_n', { n: month })} /></span>
        <p className="a3-eyebrow">{rd('month_n', { n: month })}</p>
        <p className="a3-hero-line">{rd('baby_size', { fruit: sizes.fruit })}</p>
      </div>
      <div className="a3-stats a3-num" style={{ boxShadow: 'var(--a-card-shadow)' }}>
        <div><b>{rd('unit_cm', { n: sizes.lengthCm })}</b><span>{rd('stat_length')}</span></div>
        <div><b>{formatSize(sizes.weightG)}</b><span>{rd('stat_weight')}</span></div>
        <div><b>{Math.round((w / 40) * 100)}%</b><span>{rd('week_progress')}</span></div>
      </div>
      {blocks.map((b) => {
        const Icon = b.icon;
        return (
          <article key={b.title} className="a3-card a3-pad">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className={`a3-ico-sq sm ${b.tone}`}><Icon size={16} /></span><p style={{ margin: 0, fontWeight: 600 }}>{b.title}</p></div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{b.text}</p>
          </article>
        );
      })}
      <Section title={rd('week_list')} meta={<span className="a3-meta a3-num">{checks.length}/{list.length}</span>}>
        <div className="a3-card a3-pad" style={{ paddingBlock: 4 }}>
          <div className="a3-list">
            {list.map((key, i) => {
              const on = checks.includes(i);
              return (
                <button key={key} type="button" className={`a3-li${on ? ' done' : ''}`} onClick={() => toggle(w, i)} aria-pressed={on}>
                  <span className={`a3-check${on ? ' on' : ''}`}><Check size={14} strokeWidth={3} /></span>
                  <span className="grow"><span className="t" style={{ fontSize: 15 }}>{rd(key as Parameters<typeof rd>[0])}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>
    </Sheet>
  );
}

/** Standard prenatal milestones relative to the last menstrual period. */
export function pregnancyMilestones(lmp: Date, onOpenTool?: (tool: string) => void): UpcomingEvent[] {
  const at = (w: number) => new Date(lmp.getTime() + w * 7 * 86400000);
  return [
    { date: at(24), title: rd('ms_glucose'), sub: rd('ms_glucose_sub') },
    { date: at(28), title: rd('ms_rh'), sub: rd('ms_rh_sub') },
    { date: at(30), title: rd('ms_tdap'), sub: rd('ms_tdap_sub') },
    { date: at(32), title: rd('ms_usm'), sub: rd('ms_usm_sub') },
    { date: at(36), title: rd('ms_bag'), sub: rd('ms_bag_sub'), onTap: onOpenTool ? () => onOpenTool('hospital') : undefined },
    { date: at(40), title: rd('ms_due'), sub: rd('ms_due_sub') },
  ];
}
