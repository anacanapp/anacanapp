// Redesign v3 home building blocks shared by the bump / mommy / flow dashboards.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { ArrowRight, Bell, Check, Footprints, Pill, Plus, Search, Smile, Droplets, Baby, MessageCircle } from 'lucide-react';
import { rd, shortMonth } from '@/lib/redesign-i18n';
import { toolIcon, toolTone } from '@/lib/tool-icons';
import { waterTarget } from '@/lib/water-target';
import { confetti } from '@/lib/celebrate';
import { hapticFeedback } from '@/lib/native';
import { useToolConfigs } from '@/hooks/useDynamicTools';
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useVitaminSchedules } from '@/hooks/useVitaminSchedules';
import { useKickSessions } from '@/hooks/useKickSessions';
import { useAppointments } from '@/hooks/useAppointments';
import { useHomePlanStore, type ManualPlanItem } from '@/store/homePlanStore';
import { MiniRing } from '@/components/anacan/Ring';
import { Mascot } from '@/components/anacan/Mascot';
import { Section } from '@/components/anacan/Section';
import type { OnboardingStage } from '@/lib/onboarding-model';

type Stage = OnboardingStage;

/* ---------------- Top bar ---------------- */
export function HomeTopbar({ name, avatarUrl, onSearch, onChat, chatUnread = 0, onNotifications, notificationCount = 0, onProfile, extra }: {
  name: string; avatarUrl?: string | null; onSearch?: () => void; onChat?: () => void; chatUnread?: number;
  onNotifications?: () => void; notificationCount?: number; onProfile?: () => void; extra?: ReactNode;
}) {
  const initial = (name || 'A').trim().charAt(0).toUpperCase();
  return (
    <header className="a3-topbar">
      <p className="a3-wordmark a3-grow">anacan.</p>
      {onSearch && <button type="button" className="a3-icon-btn" onClick={onSearch} aria-label={rd('search')}><Search size={22} /></button>}
      {extra}
      {onChat && (
        <button type="button" className="a3-icon-btn" onClick={onChat} aria-label={rd('messages')}>
          <MessageCircle size={22} />
          {chatUnread > 0 && <span className="a3-count a3-num">{chatUnread > 9 ? '9+' : chatUnread}</span>}
        </button>
      )}
      {onNotifications && (
        <button type="button" className="a3-icon-btn" onClick={onNotifications} aria-label={rd('notifications')}>
          <Bell size={22} />{notificationCount > 0 && <span className="a3-dot" />}
        </button>
      )}
      {onProfile && (
        <button type="button" className="a3-avatar" onClick={onProfile} aria-label={rd('profile')}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : initial}
        </button>
      )}
    </header>
  );
}

/* ---------------- Ask bar (opens Anacan.AI) ---------------- */
export function AskBar({ placeholder, onAsk }: { placeholder: string; onAsk?: () => void }) {
  if (!onAsk) return null;
  return (
    <button type="button" className="a3-ask" style={{ marginTop: 14 }} onClick={onAsk}>
      <span>{placeholder}</span>
      <span className="a3-go" aria-hidden="true"><ArrowRight size={18} className="rtl:rotate-180" /></span>
    </button>
  );
}

/* ---------------- Day plan ---------------- */
interface PlanItem { id: string; label: string; sub?: string; done: boolean; icon: typeof Pill; tone: string; onTap: () => void }

export function DayPlan({ stage, week = 0, babyMonths = 0, onNavigateToTool }: {
  stage: Stage; week?: number; babyMonths?: number; onNavigateToTool?: (tool: string) => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { todayLog, updateWaterIntake } = useDailyLogs();
  const { schedules, todayLogs: vitaminLogs } = useVitaminSchedules();
  const { getTodayStats } = useKickSessions();
  const manual = useHomePlanStore((s) => s.manual[today]) || [];
  const toggleManual = useHomePlanStore((s) => s.toggleManual);
  const water = todayLog?.water_intake || 0;
  const target = waterTarget(stage);
  const tool = (id: string) => () => onNavigateToTool?.(id);
  const manualItem = (id: ManualPlanItem, label: string, icon: typeof Pill, tone: string): PlanItem =>
    ({ id, label, done: manual.includes(id), icon, tone, onTap: () => toggleManual(today, id) });

  const items: PlanItem[] = [];
  if (schedules.length) items.push({ id: 'vit', label: rd('plan_vit'), done: vitaminLogs.length > 0, icon: Pill, tone: 'c-yellow', onTap: tool('vitamin-tracker') });
  items.push({ id: 'water', label: rd('plan_water', { n: target }), sub: `${water}/${target}`, done: water >= target, icon: Droplets, tone: 'c-blue', onTap: () => { void updateWaterIntake(1); } });
  if (stage === 'bump' && week >= 28) items.push({ id: 'kick', label: rd('plan_kicks'), sub: rd('plan_kicks_sub'), done: getTodayStats().sessionCount > 0, icon: Footprints, tone: 'c-peach', onTap: tool('kick') });
  if (stage === 'mommy' && babyMonths <= 6) items.push(manualItem('tummy', rd('plan_tummy'), Baby, 'c-peach'));
  items.push(manualItem('walk', stage === 'mommy' ? rd('plan_walk_baby') : rd('plan_walk'), Footprints, 'c-green'));
  items.push({ id: 'mood', label: rd('plan_mood'), done: (todayLog?.mood || 0) > 0, icon: Smile, tone: 'c-pink', onTap: tool('mood') });

  const done = items.filter((x) => x.done).length;
  const allDone = done === items.length;
  const [cheer, setCheer] = useState(false);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (previous.current !== null && previous.current < items.length && allDone) { confetti(); setCheer(true); }
    previous.current = done;
  }, [done, allDone, items.length]);

  return (
    <section className="a3-sec">
      <div className="a3-card a3-pad" style={{ gap: 4 }}>
        <div className="a3-plan-head">
          <MiniRing done={done} total={items.length} />
          <div><p style={{ margin: 0, fontWeight: 600 }}>{rd('plan_title')}</p><p className="a3-meta">{allDone ? rd('plan_done') : rd('plan_left', { n: items.length - done })}</p></div>
        </div>
        <div className="a3-list">
          {items.map((x) => {
            const Icon = x.icon;
            return (
              <button key={x.id} type="button" className={`a3-li${x.done ? ' done' : ''}`} onClick={() => { void hapticFeedback.light(); x.onTap(); }} aria-pressed={x.done}>
                <span className={`a3-check${x.done ? ' on' : ''}`}><Check size={14} strokeWidth={3} /></span>
                <span className="grow"><span className="t" style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{x.label}</span>{x.sub && <span className="a3-meta a3-num">{x.sub}</span>}</span>
                <span className={`a3-ico-sq sm ${x.tone}`}><Icon size={16} /></span>
              </button>
            );
          })}
        </div>
      </div>
      {cheer && <Cheer stage={stage} onClose={() => setCheer(false)} />}
    </section>
  );
}

export function Cheer({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div className={`a3-cheer a-scope${show ? ' show' : ''}`} role="dialog" aria-modal="true" aria-label={rd('cheer_title')} onClick={onClose}>
      <div className="a3-cheer-card" onClick={(e) => e.stopPropagation()}>
        <Mascot stage={stage} pose="success" width={140} bob />
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.035em' }}>{rd('cheer_title')}</p>
        <p className="a3-meta" style={{ fontSize: 15 }}>{rd('cheer_text')}</p>
        <button type="button" className="a3-btn accent block" style={{ marginTop: 8 }} onClick={onClose}>{rd('cheer_ok')}</button>
      </div>
    </div>
  );
}

/* ---------------- Upcoming timeline ---------------- */
export interface UpcomingEvent { date: Date; title: string; sub?: string; onTap?: () => void }

export function Upcoming({ events, onAddAppointment, onOpenCalendar }: { events: UpcomingEvent[]; onAddAppointment?: () => void; onOpenCalendar?: () => void }) {
  const { appointments } = useAppointments();
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const list = useMemo(() => {
    const appts: UpcomingEvent[] = (appointments || []).map((a) => ({
      date: new Date(`${a.event_date}T00:00:00`), title: a.title,
      sub: [a.event_time?.slice(0, 5), a.description].filter(Boolean).join(' · '), onTap: onOpenCalendar,
    }));
    return [...appts, ...events].filter((e) => e.date >= today).sort((a, b) => +a.date - +b.date).slice(0, 3);
  }, [appointments, events, today, onOpenCalendar]);

  return (
    <Section title={rd('upcoming_title')} meta={onAddAppointment ? <button type="button" className="a3-link" onClick={onAddAppointment}><Plus size={14} />{rd('upcoming_add')}</button> : undefined}>
      <div className="a3-card a3-pad" style={{ paddingBlock: 4 }}>
        {list.length ? list.map((e, i) => {
          const days = differenceInCalendarDays(e.date, today);
          return (
            <button key={i} type="button" className="a3-tl-row" onClick={e.onTap} disabled={!e.onTap}>
              <span className="a3-tl-date a3-num"><b>{e.date.getDate()}</b><span>{shortMonth(e.date)}</span></span>
              <span className="grow">
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                {e.sub && <span className="a3-meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.sub}</span>}
              </span>
              <span className={`a3-chip${days <= 7 ? ' ac' : ''}`} style={{ alignSelf: 'center' }}>{days === 0 ? rd('today') : days === 1 ? rd('tomorrow') : rd('in_days', { n: days })}</span>
            </button>
          );
        }) : <p className="a3-meta" style={{ padding: '12px 0', fontSize: 14 }}>{rd('upcoming_empty')}</p>}
      </div>
    </Section>
  );
}

/* ---------------- Quick tools (from tool_configs, respects disabled tools) ---------------- */
export function QuickTools({ stage, ids, onNavigateToTool, onSeeAll }: { stage: Stage; ids: string[]; onNavigateToTool?: (tool: string) => void; onSeeAll?: () => void }) {
  const { data: configs = [] } = useToolConfigs(stage);
  const { isToolDisabled } = useDisabledTools();
  const tools = ids
    .map((id) => configs.find((c) => c.tool_id === id))
    .filter((c): c is NonNullable<typeof c> => !!c && !isToolDisabled(c.tool_id) && (!c.life_stages || c.life_stages.includes(stage)))
    .slice(0, 8);
  if (!tools.length || !onNavigateToTool) return null;
  return (
    <Section title={rd('tools_title')} link={onSeeAll ? rd('see_all') : undefined} onLink={onSeeAll}>
      <div className="a3-qgrid">
        {tools.map((t) => {
          const Icon = toolIcon(t.icon);
          return (
            <button key={t.tool_id} type="button" className="a3-q" onClick={() => onNavigateToTool(t.tool_id)}>
              <span className={`sq ${toolTone(t.tool_id)}`}><Icon size={22} /></span>
              <span>{t.name}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------------- Small helpers ---------------- */
export const greetingKey = (hour = new Date().getHours()) =>
  hour < 12 ? (['dashboard_good_morning_xeyir', 'Sabahınız xeyir'] as const) : hour < 18 ? (['dashboard_good_afternoon_xeyir', 'Günortanız xeyir'] as const) : (['dashboard_good_evening_xeyir', 'Axşamınız xeyir'] as const);

