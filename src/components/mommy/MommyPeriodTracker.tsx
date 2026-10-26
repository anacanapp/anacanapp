import { ArrowLeft, CalendarDays, Droplets } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { usePeriodDayLogs } from '@/hooks/usePeriodDayLogs';
import { hasPeriodFlow } from '@/lib/period-flow';
import { feature37Text } from '@/lib/feature37-i18n';
import FlowPeriodCalendar from '@/components/flow/FlowPeriodCalendar';

export function MommyPeriodBanner({ onOpen }: { onOpen: () => void }) {
  const language = useUserStore(state => state.language);
  return <button type="button" data-mommy-period-banner onClick={onOpen} className="a-card w-full flex items-center gap-3 text-start my-4" style={{ background: 'var(--a-pink-1)' }}>
    <span className="a-list-icon"><CalendarDays size={22} /></span><span className="flex-1"><span className="a-list-title block">{feature37Text('period_banner_title', language)}</span><span className="a-list-sub block">{feature37Text('period_banner_body', language)}</span></span>
  </button>;
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
