import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, ChevronRight, FileText, Phone, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useChildren } from '@/hooks/useChildren';
import { usePartnerData } from '@/hooks/usePartnerData';
import { useSubscription } from '@/hooks/useSubscription';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useIllnessActions, useIllnessEntries, useIllnessEpisodes } from '@/hooks/useIllness';
import { useIllnessText, type IllnessText } from '@/data/illness';
import { fill } from '@/lib/feature-text';
import { getEmergencyNumber } from '@/lib/emergency';
import { getLocaleTag } from '@/lib/i18n';
import { hapticFeedback } from '@/lib/native';
import { sendPartnerMessage } from '@/lib/chat';
import {
  BAND_COLOR, ILLNESS_KINDS, KIND_EMOJI, episodeDay, formatTemp, illnessAlerts, localizeTempText, medStatuses, syncDoseReminders, tempBand, tempTemplate,
  type IllnessEntry, type IllnessEpisode, type IllnessKind, type TempUnit } from
'@/lib/illness';
import { TempSheet, MedSheet, SymptomSheet, FlagsSheet, TempUnitToggle } from './IllnessSheets';
import { useTempUnit } from './useTempUnit';
import { TempChart } from './TempChart';
import { buildIllnessReport } from './illness-report';
import PremiumModal from '@/components/PremiumModal';
import '@/styles/care.css';

interface Props {
  onBack: () => void;
}

const monthsBetween = (birth: string | null | undefined): number | null => {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth() - (now.getDate() < b.getDate() ? 1 : 0));
};

export default function IllnessScreen({ onBack }: Props) {
  useScrollToTop();
  const language = useUserStore((s) => s.language);
  const t = useIllnessText(language);
  if (!t) return <div className="a-scope cx-page" />;
  return <IllnessContent t={t} onBack={onBack} />;
}

function IllnessContent({ t, onBack }: { t: IllnessText; onBack: () => void }) {
  const { user, profile } = useAuth();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const isPartner = lifeStage === 'partner';
  const { children, selectedChild } = useChildren();
  const { partnerProfile } = usePartnerData();
  const { isPremium } = useSubscription();
  const locale = getLocaleTag();
  const [unit, setUnit] = useTempUnit();
  const emergency = getEmergencyNumber((profile as { country_code?: string | null } | null)?.country_code ?? null);

  const episodesQuery = useIllnessEpisodes();
  const episodes = episodesQuery.data ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const active = episodes.find((e) => e.id === openId) ?? episodes.find((e) => !e.ended_at) ?? null;
  const viewing = openId ? episodes.find((e) => e.id === openId) ?? null : active;
  const entriesQuery = useIllnessEntries(viewing?.id ?? null);
  const entries = entriesQuery.data ?? [];
  const actions = useIllnessActions();

  const [sheet, setSheet] = useState<'temp' | 'med' | 'symptom' | 'flags' | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [kind, setKind] = useState<IllnessKind>('fever');
  const [childId, setChildId] = useState<string | null>(selectedChild?.id ?? null);
  useEffect(() => {if (!childId && selectedChild?.id) setChildId(selectedChild.id);}, [selectedChild?.id, childId]);

  const child = isPartner ? null : children.find((c) => c.id === (viewing?.child_id ?? childId)) ?? selectedChild ?? null;
  const childName = viewing?.child_name || child?.name || (isPartner ? partnerProfile?.baby_name : profile?.baby_name) || '';
  const ageMonths = monthsBetween(child?.birth_date ?? (isPartner ? partnerProfile?.baby_birth_date : profile?.baby_birth_date));
  const otherUserId = partnerProfile?.user_id ?? null;

  const time = (iso: string | Date) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dayTime = (iso: string | Date) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // Reminders on this phone for the next doses of the open episode.
  const reminderKey = useRef('');
  useEffect(() => {
    if (!viewing || entriesQuery.isLoading) return;
    const key = `${viewing.id}:${viewing.ended_at}:${entries.map((e) => e.id).join(',')}`;
    if (key === reminderKey.current) return;
    reminderKey.current = key;
    void syncDoseReminders(viewing, entries, {
      title: (med) => fill(t.notif_title, { med }),
      body: fill(t.notif_body, { child: childName || '👶' })
    });
  }, [viewing, entries, entriesQuery.isLoading, t, childName]);

  const notifyOther = (message: string) => {
    if (!user?.id || !otherUserId) return;
    void sendPartnerMessage(user.id, otherUserId, message).catch(() => {});
  };

  const start = async () => {
    try {
      const id = await actions.start.mutateAsync({ kind, childId: isPartner ? null : child?.id ?? null, childName: childName || null });
      setOpenId(id);
      void hapticFeedback.medium();
      notifyOther(fill(t.partner_start_msg, { child: childName || '👶', kind: t.kinds[kind] }));
    } catch {
      toast.error(t.error);
    }
  };

  const alerts = viewing ? illnessAlerts(viewing, entries, ageMonths) : [];
  const temps = entries.filter((e) => e.kind === 'temp' && e.temp_c != null);
  const latestTemp = temps[0] ?? null;
  const meds = medStatuses(entries);
  const history = episodes.filter((e) => e.id !== viewing?.id);

  const sharePdf = async () => {
    if (!viewing) return;
    if (!isPremium) {setPaywall(true);return;}
    try {
      const { generateDoctorReportPdf, deliverPdf } = await import('@/lib/pdfReport');
      const doc = await generateDoctorReportPdf(buildIllnessReport(t, viewing, entries, { childName, locale, userName: profile?.name || '', unit }));
      await deliverPdf(doc, `anacan-${viewing.kind}-${viewing.started_at.slice(0, 10)}.pdf`, 'share');
    } catch {
      toast.error(t.error);
    }
  };

  return (
    <div className="a-scope cx-page safe-top">
      <div className="a-sky" aria-hidden><span className="a-cloud c1" /><span className="a-cloud c2" /></div>
      <div className="cx-wrap">
        <div className="cx-head">
          <button type="button" onClick={openId && viewing?.ended_at ? () => setOpenId(null) : onBack} className="a-icon-btn" style={{ width: 44, height: 44 }} aria-label="‹">
            <ArrowLeft className="rtl:rotate-180" size={18} />
          </button>
          <div className="cx-titles">
            <p className="cx-eyebrow">{childName ? `${t.title} · ${childName}` : t.eyebrow}</p>
            <h1 className="cx-title">{viewing ? `${t.kinds[viewing.kind]} · ${fill(t.day_n, { n: episodeDay(viewing.started_at, viewing.ended_at ? new Date(viewing.ended_at) : new Date()) })}` : t.title}</h1>
          </div>
          {viewing && <span className="cx-pill" style={viewing.ended_at ? undefined : { background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' }}><i />{viewing.ended_at ? t.ended : t.active}</span>}
        </div>

        {episodesQuery.isLoading ?
        <div className="cx-card animate-pulse" style={{ height: 220 }} /> :

        !viewing ?
        <StartCard t={t} kind={kind} onKind={setKind} childrenList={isPartner ? [] : children} childId={child?.id ?? null} onChild={setChildId} onStart={start} busy={actions.start.isPending} onFlags={() => setSheet('flags')} /> :

        <>
            {alerts.map((alert, i) =>
          <motion.div key={i} className="cx-alert" style={{ marginBottom: 12 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <b>🚨 {alert.kind === 'infant' ? fill(tempTemplate(t.alert_infant), { months: alert.months, temp: formatTemp(alert.temp, unit, locale) }) :
              alert.kind === 'high' ? fill(tempTemplate(t.alert_high), { temp: formatTemp(alert.temp, unit, locale), number: emergency }) :
              alert.kind === 'breathing' ? fill(t.alert_breathing, { number: emergency }) : t.alert_long}</b>
                {alert.kind !== 'long' && <a className="cx-call" href={`tel:${emergency}`}><Phone size={17} />{fill(t.call, { number: emergency })}</a>}
              </motion.div>
          )}

            <motion.div className="cx-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="cx-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p className="cx-eyebrow">{latestTemp ? fill(t.last_reading, { time: dayTime(latestTemp.at) }) : t.no_reading}</p>
                  {latestTemp ?
                <div className="cx-row" style={{ gap: 10, marginTop: 6 }}>
                      <span className="cx-temp" style={{ color: BAND_COLOR[tempBand(latestTemp.temp_c!)] }}>{formatTemp(latestTemp.temp_c!, unit, locale)}</span>
                      <span className="cx-pill" style={{ background: `${BAND_COLOR[tempBand(latestTemp.temp_c!)]}1f`, color: BAND_COLOR[tempBand(latestTemp.temp_c!)] }}>{t.bands[tempBand(latestTemp.temp_c!)]}</span>
                    </div> :
                <div className="cx-temp" style={{ color: 'var(--a-ink-faint)', marginTop: 6 }}>—</div>}
                </div>
                <TempUnitToggle unit={unit} onChange={setUnit} />
              </div>
              <TempChart entries={entries} locale={locale} unit={unit} feverLabel={localizeTempText(t.fever_line, unit, locale)} emptyLabel={t.chart_empty} />
            </motion.div>

            {!viewing.ended_at &&
          <div className="cx-grid3 cx-gap">
                <button type="button" className="cx-action" style={{ background: 'var(--a-peach-1)' }} onClick={() => setSheet('temp')}><span>🌡️</span>{t.add_temp}</button>
                <button type="button" className="cx-action" style={{ background: 'var(--a-green-1)' }} onClick={() => setSheet('med')}><span>💊</span>{t.add_med}</button>
                <button type="button" className="cx-action" style={{ background: 'var(--a-blue-1)' }} onClick={() => setSheet('symptom')}><span>🤧</span>{t.add_symptom}</button>
              </div>
          }

            {meds.map((m) => <DoseCard key={m.name} t={t} med={m} time={time} done={!!viewing.ended_at} />)}

            <p className="cx-section">{t.recent}</p>
            <div className="cx-card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {entries.length === 0 ?
            <p className="cx-sub" style={{ padding: '12px 0' }}>{t.no_entries}</p> :
            <div className="cx-list">
                  {entries.slice(0, showAll ? 60 : 6).map((entry) => <EntryRow key={entry.id} t={t} entry={entry} when={dayTime(entry.at)} locale={locale} unit={unit}
              onDelete={() => actions.removeEntry.mutate(entry.id)} canDelete={!viewing.ended_at} />)}
                  {!showAll && entries.length > 6 &&
              <button type="button" className="cx-li" style={{ width: '100%', justifyContent: 'center', border: 0, background: 'none', cursor: 'pointer', color: 'var(--a-accent-ink)', fontWeight: 800 }} onClick={() => setShowAll(true)}>
                      +{entries.length - 6} ⌄
                    </button>
              }
                </div>
            }
            </div>

            <div className="cx-grid2 cx-gap">
              <button type="button" className="cx-card cx-row" style={{ border: 0, cursor: 'pointer', textAlign: 'start', margin: 0, background: 'var(--a-alert-bg)' }} onClick={() => setSheet('flags')}>
                <ShieldAlert size={20} style={{ color: '#c92a2a', flex: 'none' }} />
                <b style={{ fontSize: 13.5, color: 'var(--a-alert-ink)' }}>{t.flags_btn}</b>
              </button>
              <button type="button" className="cx-card cx-row" style={{ border: 0, cursor: 'pointer', textAlign: 'start', margin: 0, background: 'var(--a-blue-1)' }} onClick={() => void sharePdf()}>
                <FileText size={20} style={{ color: 'var(--a-blue-ink)', flex: 'none' }} />
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13.5, color: 'var(--a-blue-ink)' }}>{t.report_title}{!isPremium && ' ✨'}</b>
                  <small style={{ fontSize: 11.5, color: 'var(--a-blue-ink)', opacity: .8 }}>{fill(t.report_desc, { days: episodeDay(viewing.started_at), temps: temps.length, meds: entries.filter((e) => e.kind === 'med').length })}</small>
                </span>
              </button>
            </div>

            <div className="cx-card cx-gap" style={{ padding: 0, overflow: 'hidden' }}>
              {viewing.ended_at ?
            <button type="button" className="cx-link" onClick={() => actions.close.mutate({ id: viewing.id, ended: false })}>
                  <span className="cx-icon" style={{ background: 'var(--a-yellow-1)' }}>↩️</span><b style={{ fontSize: 14 }}>{t.reopen}</b>
                </button> :
            <button type="button" className="cx-link" onClick={() => {actions.close.mutate({ id: viewing.id, ended: true });toast.success(t.healed_toast);void hapticFeedback.medium();}}>
                  <span className="cx-icon" style={{ background: 'var(--a-green-1)' }}>✅</span>
                  <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 14 }}>{t.healed}</b><span className="cx-sub">{t.healed_desc}</span></span>
                  <ChevronRight size={18} style={{ color: 'var(--a-ink-faint)' }} className="rtl:rotate-180" />
                </button>
            }
              <button type="button" className="cx-link" style={{ borderTop: '1px solid var(--a-line)' }} onClick={() => {
              if (window.confirm(t.delete_confirm)) {actions.remove.mutate(viewing.id);setOpenId(null);}
            }}>
                <span className="cx-icon" style={{ background: 'var(--a-pink-1)' }}><Trash2 size={17} style={{ color: 'var(--a-pink-ink)' }} /></span>
                <b style={{ fontSize: 14, color: 'var(--a-pink-ink)' }}>{t.delete}</b>
              </button>
            </div>
          </>
        }

        {history.length > 0 &&
        <>
            <p className="cx-section">{t.history}</p>
            <div className="cx-card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              <div className="cx-list">
                {history.map((e) => <HistoryRow key={e.id} t={t} episode={e} locale={locale} unit={unit} onOpen={() => setOpenId(e.id)} />)}
              </div>
            </div>
          </>
        }

        <p className="cx-disc">{t.disclaimer}</p>
      </div>

      {viewing && !viewing.ended_at &&
      <>
          <TempSheet t={t} open={sheet === 'temp'} onClose={() => setSheet(null)} locale={locale}
          onSave={async (entry) => {await actions.add.mutateAsync({ episodeId: viewing.id, entry });toast.success(t.saved);}} />
          <MedSheet t={t} open={sheet === 'med'} onClose={() => setSheet(null)} entries={entries} time={time}
          onSave={async (entry) => {
            await actions.add.mutateAsync({ episodeId: viewing.id, entry });
            toast.success(t.saved);
            notifyOther(fill(t.partner_med_msg, { child: childName || '👶', med: entry.med_name, dose: entry.dose, time: time(entry.at) }));
          }} />
          <SymptomSheet t={t} open={sheet === 'symptom'} onClose={() => setSheet(null)}
          onSave={async (entry) => {await actions.add.mutateAsync({ episodeId: viewing.id, entry });toast.success(t.saved);}} />
        </>
      }
      <FlagsSheet t={t} open={sheet === 'flags'} onClose={() => setSheet(null)} emergency={emergency} locale={locale} />
      <PremiumModal isOpen={paywall} onClose={() => setPaywall(false)} feature={t.premium_pdf} />
    </div>);
}

function StartCard({ t, kind, onKind, childrenList, childId, onChild, onStart, busy, onFlags }: {
  t: IllnessText; kind: IllnessKind; onKind: (k: IllnessKind) => void;
  childrenList: { id: string; name: string; avatar_emoji?: string }[]; childId: string | null; onChild: (id: string) => void;
  onStart: () => void; busy: boolean; onFlags: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="cx-card" style={{ background: 'linear-gradient(160deg, var(--a-surface), var(--a-surface-soft))' }}>
        <div className="cx-row" style={{ alignItems: 'flex-start' }}>
          <span className="cx-icon" style={{ background: 'var(--a-peach-1)', width: 52, height: 52, fontSize: 26 }}>🤒</span>
          <div>
            <h2 className="cx-title" style={{ fontSize: 18 }}>{t.start_title}</h2>
            <p className="cx-sub" style={{ marginTop: 4 }}>{t.start_desc}</p>
          </div>
        </div>
        {childrenList.length > 1 &&
        <div className="cx-chips" style={{ marginTop: 14 }}>
            {childrenList.map((c) => <button key={c.id} type="button" className="cx-chip" aria-pressed={c.id === childId} onClick={() => onChild(c.id)}>{c.avatar_emoji || '👶'} {c.name}</button>)}
          </div>
        }
        <p className="cx-field" style={{ marginTop: 16 }}>{t.choose_kind}</p>
        <div className="cx-grid4">
          {ILLNESS_KINDS.map((k) =>
          <button key={k} type="button" className="cx-tile" aria-pressed={k === kind} style={{ background: k === kind ? 'var(--a-peach-1)' : 'var(--a-surface-soft)', minHeight: 78 }} onClick={() => {onKind(k);void hapticFeedback.light();}}>
              <span className="cx-tile-emoji">{KIND_EMOJI[k]}</span>{t.kinds[k]}
            </button>
          )}
        </div>
        <button type="button" className="a3-btn accent cx-wide" style={{ marginTop: 16 }} onClick={onStart} disabled={busy}>{t.start_btn}</button>
      </div>
      <button type="button" className="cx-card cx-row cx-gap" style={{ width: '100%', border: 0, cursor: 'pointer', textAlign: 'start', background: 'var(--a-alert-bg)' }} onClick={onFlags}>
        <ShieldAlert size={20} style={{ color: '#c92a2a' }} /><b style={{ flex: 1, fontSize: 14, color: 'var(--a-alert-ink)' }}>{t.flags_btn}</b>
        <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-alert-ink)' }} />
      </button>
    </motion.div>);
}

function DoseCard({ t, med, time, done }: { t: IllnessText; med: ReturnType<typeof medStatuses>[number]; time: (d: Date) => string; done: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {const id = window.setInterval(() => setNow(Date.now()), 30_000);return () => window.clearInterval(id);}, []);
  const total = med.nextAt.getTime() - med.lastAt.getTime();
  const progress = Math.min(1, Math.max(0, (now - med.lastAt.getTime()) / total));
  const ready = progress >= 1;
  const r = 27, c = 2 * Math.PI * r;
  return (
    <motion.div className="cx-card cx-gap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ background: ready ? 'var(--a-green-1)' : 'var(--a-surface)' }}>
      <div className="cx-dose">
        <div className="cx-dose-ring">
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--a-surface-soft)" strokeWidth="7" />
            <circle cx="32" cy="32" r={r} fill="none" stroke={ready ? 'var(--a-green-2)' : 'var(--a-peach-2)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
          </svg>
          <span>💊</span>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 15, color: 'var(--a-ink)' }}>{med.name}{med.dose ? ` · ${med.dose}` : ''}</b>
          <p className="cx-sub">{fill(t.med_card_last, { time: time(med.lastAt), h: med.intervalHours })}</p>
          {!done &&
          <div className="cx-row" style={{ marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 17, color: ready ? 'var(--a-green-ink)' : 'var(--a-ink)' }}>{ready ? t.can_give_now : `${t.next_dose}: ${fill(t.next_dose_at, { time: time(med.nextAt) })}`}</strong>
              {med.remind && !ready && <span className="cx-pill" style={{ background: 'var(--a-surface-soft)' }}><Bell size={12} />{t.reminder_on}</span>}
            </div>
          }
        </div>
      </div>
    </motion.div>);
}

function EntryRow({ t, entry, when, locale, unit, onDelete, canDelete }: { t: IllnessText; entry: IllnessEntry; when: string; locale: string; unit: TempUnit; onDelete: () => void; canDelete: boolean }) {
  const who = entry.by_me ? t.by_me : entry.by === 'mother' ? t.by_mother : entry.by === 'partner' ? t.by_partner : '';
  let icon = '🌡️', bg = 'var(--a-peach-1)', title = '', sub = when;
  if (entry.kind === 'temp') {
    title = formatTemp(entry.temp_c!, unit, locale);
    if (entry.temp_method) sub += ` · ${t.methods[entry.temp_method]}`;
  } else if (entry.kind === 'med') {
    icon = '💊';bg = 'var(--a-green-1)';
    title = `${entry.med_name}${entry.dose ? ` ${entry.dose}` : ''}`;
  } else {
    icon = '🤧';bg = 'var(--a-blue-1)';
    title = (entry.symptoms ?? []).map((s) => (t.symptoms as Record<string, string>)[s] ?? s).join(', ') || entry.note || '—';
  }
  if (who) sub += ` · ${who}`;
  return (
    <div className="cx-li">
      <span className="cx-icon" style={{ background: bg }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <b style={entry.kind === 'temp' ? { color: BAND_COLOR[tempBand(entry.temp_c!)] } : undefined}>{title}</b>
        <small>{sub}</small>
        {entry.note && entry.kind !== 'symptom' && <small>{entry.note}</small>}
      </div>
      {canDelete && entry.by_me && <button type="button" className="cx-x" aria-label={t.delete} onClick={onDelete}><Trash2 size={15} /></button>}
    </div>);
}

function HistoryRow({ t, episode, locale, unit, onOpen }: { t: IllnessText; episode: IllnessEpisode; locale: string; unit: TempUnit; onOpen: () => void }) {
  const range = useMemo(() => {
    const s = new Date(episode.started_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return episode.ended_at ? `${s} – ${new Date(episode.ended_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}` : s;
  }, [episode, locale]);
  return (
    <button type="button" className="cx-li" style={{ width: '100%', border: 0, background: 'none', textAlign: 'start', cursor: 'pointer' }} onClick={onOpen}>
      <span className="cx-icon" style={{ background: 'var(--a-surface-soft)' }}>{KIND_EMOJI[episode.kind]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{t.kinds[episode.kind]}{episode.child_name ? ` · ${episode.child_name}` : ''}</b>
        <small>{range}{episode.max_temp ? ` · ${formatTemp(Number(episode.max_temp), unit, locale)}` : ''}</small>
      </div>
      <span className="cx-pill">{episode.ended_at ? t.ended : t.active}</span>
    </button>);
}
