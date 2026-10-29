import { useEffect, useMemo, useState } from 'react';
import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, ChevronRight, Droplets } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { usePeriodDayLogs, useRecordPeriodDays } from '@/hooks/usePeriodDayLogs';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { mommyPeriodStatus, recentDays } from '@/lib/mommy-period';
import { hasPeriodFlow } from '@/lib/period-flow';
import { feature37Text } from '@/lib/feature37-i18n';
import FlowPeriodCalendar from '@/components/flow/FlowPeriodCalendar';

const endedKey = (userId: string) => `anacan.mommyPeriod.endedOn.${userId}`;
const readEnded = (userId?: string) => {
  if (!userId) return null;
  try { return localStorage.getItem(endedKey(userId)); } catch { return null; }
};

/**
 * Mommy home card. Before anything is recorded it invites the user to start tracking;
 * afterwards it is a minimal period tracker: status, last 14 days (tap to toggle) and
 * started / still on / ended actions. The full calendar opens with `onOpen`.
 */
export function MommyPeriodBanner({ onOpen }: { onOpen: () => void }) {
  const language = useUserStore(state => state.language), { user, profile } = useAuth();
  const { data: logs = [] } = usePeriodDayLogs();
  const record = useRecordPeriodDays();
  const [endedOn, setEndedOn] = useState<string | null>(() => readEnded(user?.id));
  useEffect(() => { setEndedOn(readEnded(user?.id)); }, [user?.id]);

  const since = profile?.baby_birth_date?.slice(0, 10) || null;
  const flowDays = useMemo(() => logs.filter(row => (!since || row.log_date >= since) && hasPeriodFlow(row.flow_intensity)).map(row => row.log_date), [logs, since]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const status = mommyPeriodStatus(flowDays, today, endedOn);
  const t = (key: Parameters<typeof feature37Text>[0]) => feature37Text(key, language);

  const save = (input: Parameters<typeof record.mutate>[0], ended?: string) => record.mutate(input, {
    onSuccess: () => {
      if (ended && user?.id) {
        try { localStorage.setItem(endedKey(user.id), ended); } catch { /* device-only marker */ }
        setEndedOn(ended);
      }
      toast.success(t('period_saved'));
    },
    onError: () => toast.error(t('period_failed')),
  });
  const logToday = () => save({ dates: [today], flow: 'unspecified', preserveExisting: true });
  const endOn = (last: string) => save({ dates: eachDayOfInterval({ start: parseISO(status.start!), end: parseISO(last) }), flow: 'unspecified', complete: true, preserveExisting: true }, last);
  const toggleDay = (day: string) => {
    if (since && day < since) return;
    save({ dates: [day], flow: flowDays.includes(day) ? 'clear' : 'unspecified' });
  };

  if (status.state === 'none') {
    return <div data-mommy-period-banner className="a-card w-full flex items-center gap-3 my-4" style={{ background: 'var(--a-pink-1)' }}>
      <button type="button" onClick={onOpen} className="flex flex-1 items-center gap-3 text-start min-w-0">
        <span className="a-list-icon"><CalendarDays size={22} /></span>
        <span className="flex-1 min-w-0"><span className="a-list-title block">{t('period_banner_title')}</span><span className="a-list-sub block" style={{ whiteSpace: 'normal' }}>{t('period_banner_body')}</span></span>
      </button>
      <button type="button" className="a-btn-soft shrink-0" onClick={logToday} disabled={record.isPending}>{t('period_start')}</button>
    </div>;
  }

  const ongoing = status.state === 'today' || status.state === 'askToday';
  const strip = recentDays(today);
  return <section data-mommy-period-card className="a-card my-4" style={{ padding: '14px 14px 12px' }}>
    <div className="flex items-center gap-3">
      <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)', color: 'var(--a-berry-ink)' }}><Droplets size={17} /></span>
      <div className="flex-1 min-w-0">
        <p className="a-list-title">{t('period_card_title')}</p>
        <p className="a-list-sub">{ongoing
          ? t('period_day_n').replace('{n}', String(status.dayNumber))
          : t('period_last_short').replace('{date}', format(parseISO(status.lastDay!), 'd MMM', { locale: getCurrentDateLocale() }))}</p>
      </div>
      <button type="button" className="a-section-link inline-flex items-center gap-1" onClick={onOpen}>
        {t('period_calendar')} <ChevronRight size={13} className="rtl:rotate-180" />
      </button>
    </div>
    <div className="a-period-strip" role="group" aria-label={t('period_card_title')}>
      {strip.map(day => {
        const on = flowDays.includes(day), locked = !!since && day < since;
        return <button key={day} type="button" disabled={locked || record.isPending} onClick={() => toggleDay(day)}
          className={`a-period-day${on ? ' on' : ''}${day === today ? ' today' : ''}`} aria-pressed={on}
          aria-label={format(parseISO(day), 'd MMMM', { locale: getCurrentDateLocale() })}>
          {format(parseISO(day), 'd')}
        </button>;
      })}
    </div>
    {status.state === 'askToday' && <p className="a-list-sub" style={{ marginTop: 10 }}>{t('period_ask_today')}</p>}
    <div className="flex gap-2" style={{ marginTop: 10 }}>
      {status.state === 'idle' && <button type="button" className="a-btn-soft flex-1 justify-center" disabled={record.isPending} onClick={logToday}>{t('period_start')}</button>}
      {status.state === 'askToday' && <button type="button" className="a-btn-soft flex-1 justify-center" disabled={record.isPending} onClick={logToday}>{t('period_continue')}</button>}
      {status.state === 'askToday' && <button type="button" className="a-btn-solid flex-1 justify-center" disabled={record.isPending} onClick={() => endOn(status.lastDay!)}>{t('period_end')}</button>}
      {status.state === 'today' && <button type="button" className="a-btn-solid flex-1 justify-center" disabled={record.isPending} onClick={() => endOn(today)}>{t('period_end')}</button>}
    </div>
  </section>;
}

export default function MommyPeriodTracker({ onBack }: { onBack: () => void }) {
  const language = useUserStore(state => state.language), { profile } = useAuth(), { data: logs = [] } = usePeriodDayLogs();
  const since = profile?.baby_birth_date?.slice(0,10) || null;
  const observed = logs.filter(row => (!since || row.log_date >= since) && hasPeriodFlow(row.flow_intensity));
  const latest = observed.map(row => row.log_date).sort().at(-1);
  return <div className="a-scope min-h-screen pb-24" data-mommy-period-tracker style={{ background: 'var(--a-bg)' }}><div className="a-shell space-y-4">
    <header className="a-topbar"><button className="a-icon-btn" onClick={onBack} aria-label={feature37Text('back_mommy', language)}><ArrowLeft size={18} className="rtl:rotate-180" /></button><h1 className="a-wordmark text-base">{feature37Text('period_title', language)}</h1></header>
    <p className="a-list-sub">{feature37Text('period_body', language)}</p>
    <div className="a-card flex items-center gap-3"><Droplets size={24} /><div><p className="a-list-title">{feature37Text('period_days', language)}: {observed.length}</p><p className="a-list-sub">{latest ? `${feature37Text('period_last', language)}: ${latest}` : feature37Text('period_empty', language)}</p></div></div>
    <FlowPeriodCalendar trackingOnly fromDate={since} />
    <p className="a-list-sub">{feature37Text('period_tracking_note', language)}</p>
  </div></div>;
}
