import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Moon, Minus, Plus, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerData } from '@/hooks/usePartnerData';
import { addDays, isoDay, useNightShifts, type NightAssignee } from '@/hooks/usePartnerFamily';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { feature37Text } from '@/lib/feature37-i18n';
import { tr } from '@/lib/tr';

/** Gecə növbəsi — mother and partner plan who gets up with the baby, and log the night. */
const NightShiftScreen = ({ onBack }: { onBack: () => void }) => {
  useScrollToTop();
  const { profile } = useAuth();
  const { partnerProfile } = usePartnerData();
  const language = useUserStore((s) => s.language) || 'az';
  const { toast } = useToast();
  const me: NightAssignee = profile?.life_stage === 'partner' ? 'partner' : 'mother';
  const other: NightAssignee = me === 'mother' ? 'partner' : 'mother';
  const otherName = partnerProfile?.name || (other === 'mother' ? tr('common_ana', 'Ana') : tr('common_partnyor', 'Partnyor'));

  const today = useMemo(() => new Date(), []);
  const { shifts, loading, error, set } = useNightShifts(addDays(today, -7), addDays(today, 6));
  const byDate = useMemo(() => new Map(shifts.map((s) => [s.shift_date, s])), [shifts]);
  const todayKey = isoDay(today);
  const yesterdayKey = isoDay(addDays(today, -1));
  const tonight = byDate.get(todayKey);
  const lastNight = byDate.get(yesterdayKey);

  const [wakeups, setWakeups] = useState(lastNight?.wakeups ?? 0);
  const [note, setNote] = useState(lastNight?.note ?? '');
  useEffect(() => { setWakeups(lastNight?.wakeups ?? 0); setNote(lastNight?.note ?? ''); }, [lastNight?.updated_at]);

  const nameOf = (who: NightAssignee) => (who === me ? feature37Text('ns_me') : otherName);
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' });

  const assign = (date: string, assignee: NightAssignee | null) =>
    set.mutate({ date, assignee }, { onError: () => toast({ title: feature37Text('bp_error'), variant: 'destructive' }) });
  const cycle = (date: string) => {
    const current = byDate.get(date)?.assignee ?? null;
    assign(date, current === null ? me : current === me ? other : null);
  };
  const finishLastNight = () => {
    if (!lastNight) return;
    set.mutate({ date: yesterdayKey, assignee: lastNight.assignee, isDone: true, wakeups, note: note.trim() || null }, {
      onError: () => toast({ title: feature37Text('bp_error'), variant: 'destructive' }),
    });
  };

  const stats = useMemo(() => {
    const past = shifts.filter((s) => s.shift_date < todayKey);
    return {
      mine: past.filter((s) => s.assignee === me).length,
      theirs: past.filter((s) => s.assignee === other).length,
      wakeups: past.reduce((sum, s) => sum + (s.wakeups || 0), 0),
    };
  }, [shifts, todayKey, me, other]);

  const noFamily = !!error && String((error as any)?.message || '').includes('NIGHT_SHIFT_NO_FAMILY');
  const card = { background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)', padding: 16 } as const;

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{feature37Text('ns_eyebrow')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{feature37Text('pm_night_shift')} 🌙</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--a-ink-faint)' }} /></div>
        ) : error ? (
          <div className="a-card text-center" style={{ padding: 22 }}>
            <p style={{ fontSize: 13.5, color: 'var(--a-body-text)' }}>{noFamily ? feature37Text('family_no_link') : feature37Text('family_error')}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <section style={card}>
              <div className="flex items-center gap-2.5" style={{ marginBottom: 12 }}>
                <span className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-lav-1)' }}>
                  <Moon size={18} style={{ color: 'var(--a-lav-ink)' }} />
                </span>
                <div>
                  <h2 style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--a-ink)' }}>{feature37Text('pm_night_shift_sub')}</h2>
                  <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>{tonight ? nameOf(tonight.assignee) : feature37Text('ns_unassigned')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([me, other] as NightAssignee[]).map((who) => {
                  const active = tonight?.assignee === who;
                  return (
                    <motion.button key={who} type="button" whileTap={{ scale: 0.97 }} aria-pressed={active}
                      onClick={() => assign(todayKey, active ? null : who)}
                      className="flex items-center justify-center gap-1.5"
                      style={{ height: 48, borderRadius: 16, fontSize: 14, fontWeight: 800,
                        background: active ? 'var(--a-lav-ink)' : 'var(--a-surface-soft)', color: active ? 'var(--a-surface)' : 'var(--a-ink)' }}>
                      {active && <Check size={16} />}{nameOf(who)}
                    </motion.button>);
                })}
              </div>
            </section>

            {lastNight &&
              <section style={card}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--a-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {feature37Text('ns_last_night')} · {nameOf(lastNight.assignee)}
                </p>
                {lastNight.is_done ?
                  <p className="flex items-center gap-1.5" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-green-ink)', marginTop: 6 }}>
                    <Check size={15} /> {feature37Text('ns_done')} · {lastNight.wakeups ?? 0} {feature37Text('ns_total_wakeups')}
                    {lastNight.note && <span style={{ fontWeight: 500, color: 'var(--a-ink-soft)' }}> · {lastNight.note}</span>}
                  </p> :
                  <>
                    <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-ink)', margin: '6px 0 10px' }}>{feature37Text('ns_how_night')}</p>
                    <div className="flex items-center justify-between" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '8px 10px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-ink)' }}>{feature37Text('ns_wakeups')}</span>
                      <div className="flex items-center gap-3">
                        <button type="button" className="a-icon-btn" style={{ width: 32, height: 32 }} aria-label="−" onClick={() => setWakeups(Math.max(0, wakeups - 1))}><Minus size={14} /></button>
                        <span style={{ fontSize: 18, fontWeight: 900, minWidth: 22, textAlign: 'center', color: 'var(--a-ink)' }}>{wakeups}</span>
                        <button type="button" className="a-icon-btn" style={{ width: 32, height: 32 }} aria-label="+" onClick={() => setWakeups(Math.min(20, wakeups + 1))}><Plus size={14} /></button>
                      </div>
                    </div>
                    <input className="a-input" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)}
                      placeholder={feature37Text('ns_note_ph')} style={{ width: '100%', marginTop: 8 }} />
                    <button type="button" onClick={finishLastNight} disabled={set.isPending} className="a-btn-solid w-full" style={{ marginTop: 10 }}>
                      {feature37Text('ns_mark_done')}
                    </button>
                  </>}
              </section>}

            <section style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)' }}>{feature37Text('ns_week')}</h3>
              <p style={{ fontSize: 11, color: 'var(--a-ink-soft)', margin: '2px 0 10px' }}>{feature37Text('ns_week_hint').replace('{name}', otherName)}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((day) => {
                  const key = isoDay(day);
                  const shift = byDate.get(key);
                  const mine = shift?.assignee === me;
                  return (
                    <motion.button key={key} type="button" whileTap={{ scale: 0.93 }} onClick={() => cycle(key)}
                      aria-label={`${weekday.format(day)}: ${shift ? nameOf(shift.assignee) : feature37Text('ns_unassigned')}`}
                      className="flex flex-col items-center gap-1"
                      style={{ borderRadius: 14, padding: '8px 0', background: shift ? (mine ? 'var(--a-lav-1)' : 'var(--a-blue-1)') : 'var(--a-surface-soft)' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--a-ink-soft)' }}>{weekday.format(day)}</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--a-ink)' }}>{day.getDate()}</span>
                      <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden>{shift ? (mine ? '🙋' : '💙') : '·'}</span>
                    </motion.button>);
                })}
              </div>
            </section>

            <section style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)', marginBottom: 10 }}>{feature37Text('ns_stats')}</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[{ v: stats.mine, l: `${feature37Text('ns_me')} · ${feature37Text('ns_nights')}` },
                  { v: stats.theirs, l: `${otherName} · ${feature37Text('ns_nights')}` },
                  { v: stats.wakeups, l: feature37Text('ns_total_wakeups') }].map((s) =>
                  <div key={s.l} style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '10px 4px' }}>
                    <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--a-ink)' }}>{s.v}</p>
                    <p className="truncate" style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{s.l}</p>
                  </div>)}
              </div>
            </section>

            <p style={{ fontSize: 12, color: 'var(--a-ink-soft)', textAlign: 'center', padding: '0 12px', lineHeight: 1.5 }}>{feature37Text('ns_tip')}</p>
          </div>
        )}
      </div>
    </div>);
};

export default NightShiftScreen;
