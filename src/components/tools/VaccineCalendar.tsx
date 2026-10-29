import { tr, getPersistedLanguage } from "@/lib/tr";
import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { getLocaleTag } from '@/lib/i18n';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { localizedCountryName } from '@/lib/app-languages';
import { regionalText } from '@/lib/regional-i18n';
import { regionalCountry, vaccineEligible, vaccineStatus, vaccineTiming } from '@/lib/vaccine-schedule';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Syringe, CheckCircle2, Clock, AlertTriangle, Ban,
  Info, Globe, ExternalLink, X, Calendar as CalendarIcon, Sparkles, ChevronDown } from
'lucide-react';
import { useChildren } from '@/hooks/useChildren';
import {
  useVaccineCountries, useVaccineScheduleForCountry, useChildVaccinations,
  useUpsertChildVaccination, useDeleteChildVaccination,
  type VaccineScheduleRow, type ChildVaccination } from
'@/hooks/useVaccines';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onBack: () => void;
}

type TabKey = 'upcoming' | 'all' | 'done';

const STATUS = {
  done: { label: () => tr("vaccinecalendar_vuruldu", "Vuruldu"), icon: CheckCircle2, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  pending: { label: () => tr("vaccinecalendar_gozlemede_80f70e", "G\xF6zl\u0259m\u0259d\u0259"), icon: Clock, bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
  overdue: { label: () => tr("vaccinecalendar_gecikdi", "Gecikdi"), icon: AlertTriangle, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' },
  skipped: { label: () => tr("vaccinecalendar_buraxildi_61c6a0", "Burax\u0131ld\u0131"), icon: Ban, bg: 'var(--a-surface-soft)', ink: 'var(--a-ink-soft)' },
  future: { label: () => tr("vaccinecalendar_novbede_b7ecbc", "N\xF6vb\u0259d\u0259"), icon: Clock, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  conditional: { label: () => regionalText('conditional', getPersistedLanguage()), icon: Info, bg: 'var(--a-surface-soft)', ink: 'var(--a-ink-soft)' },
  seasonal: { label: () => regionalText('seasonal', getPersistedLanguage()), icon: CalendarIcon, bg: 'var(--a-surface-soft)', ink: 'var(--a-ink-soft)' },
  interval: { label: () => regionalText('interval', getPersistedLanguage()), icon: Info, bg: 'var(--a-surface-soft)', ink: 'var(--a-ink-soft)' }
} as const;

type StatusKey = keyof typeof STATUS;

const formatVaccineDate = (iso: string) => {
  const d = parseISO(iso);
  const locale = getLocaleTag();
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric', calendar: 'gregory' });
};

const translateVaccineLabel = (text: string | undefined | null, lang: string): string => {
  if (!text) return '';
  if (lang !== 'en') return text;

  const dict: Record<string, string> = {
    // Ages
    "Doğulanda": "At birth",
    "2 aylıq": "2 months",
    "3 aylıq": "3 months",
    "4 aylıq": "4 months",
    "6 aylıq": "6 months",
    "12 aylıq": "12 months",
    "18 aylıq": "18 months",
    "24 aylıq": "24 months",
    "6 yaş": "6 years",
    
    // Doses
    "1-ci doza": "1st dose",
    "2-ci doza": "2nd dose",
    "3-cü doza": "3rd dose",
    "4-cü doza": "4th dose",
    "Bustər": "Booster",
    "Bustər (revaksinasiya)": "Booster (revaccination)",
    "İkinci bustər": "Second booster",
    "1-ci doza (doğulanda)": "1st dose (at birth)",

    // Vaccine Names & Diseases (AZ)
    "Hepatit B": "Hepatitis B",
    "Vərəm (BCG)": "Tuberculosis (BCG)",
    "Poliomielit (OPV)": "Poliomyelitis (OPV)",
    "Poliomielit (İPV)": "Poliomyelitis (IPV)",
    "GDT (Göyöskürək, difteriya, tetanoz)": "DTP (Pertussis, Diphtheria, Tetanus)",
    "Hib (B tipli hemofil infeksiya)": "Hib (Haemophilus influenzae type B)",
    "Pnevmokokk (Poliovalent)": "Pneumococcal (Polyvalent)",
    "QPM (Qızılca, parotit, məxmərək)": "MMR (Measles, Mumps, Rubella)",
    "Difteriya və tetanoz (DT)": "Diphtheria and Tetanus (DT)",
    "Vərəm": "Tuberculosis",
    "Poliomielit": "Poliomyelitis",
    "Göyöskürək, difteriya, tetanoz": "Pertussis, Diphtheria, Tetanus",
    "B tipli hemofil infeksiya": "Haemophilus influenzae type B",
    "Pnevmokokk infeksiyaları": "Pneumococcal infections",
    "Qızılca, parotit, məxmərək": "Measles, Mumps, Rubella",
    "Əzələdaxili": "Intramuscular",
    "Ağızdan (oral)": "Oral",
    "Dərialtı": "Subcutaneous",
    "Dəridaxili": "Intradermal"
  };

  // If there's an exact match
  if (dict[text]) return dict[text];

  // Try to replace parts of the string
  let translated = text;
  for (const [az, en] of Object.entries(dict)) {
    if (translated.includes(az)) {
      translated = translated.split(az).join(en);
    }
  }

  return translated;
};

const groupByAge = (rows: VaccineScheduleRow[], lang: string) => {
  const groups = new Map<string, {label: string;days: number;rows: VaccineScheduleRow[];}>();
  rows.forEach((r) => {
    const key = r.age_label || '';
    const translatedKey = translateVaccineLabel(key, lang);
    if (!groups.has(translatedKey)) groups.set(translatedKey, { label: translatedKey, days: r.recommended_age_days, rows: [] });
    groups.get(translatedKey)!.rows.push(r);
  });
  return Array.from(groups.values()).sort((a, b) => a.days - b.days);
};

export default function VaccineCalendar({ onBack }: Props) {
  const { children, selectedChild, setSelectedChild, getChildAge, refetch: refetchChildren } = useChildren();
  const { user, profile } = useAuth();
  const { data: countries = [] } = useVaccineCountries();
  const { toast } = useToast();
  const lang = useUserStore(state => state.language);
  const storedCountry = useUserStore(state => state.countryCode);
  const accountCountry = regionalCountry(lang, profile?.country_code, storedCountry);
  const orderedCountries = useMemo(() => [...countries].sort((a, b) => Number(b.code === accountCountry) - Number(a.code === accountCountry)), [countries, accountCountry]);
  const [countryOverride, setCountryOverride] = useState<{ childId: string; code: string } | null>(null);
  const [savingCountry, setSavingCountry] = useState(false);
  const effectiveCountry = countryOverride && countryOverride.childId === selectedChild?.id ? countryOverride.code
    : regionalCountry(lang, selectedChild?.vaccine_country_code, profile?.country_code, storedCountry, selectedChild?.country_code);

  const { data: schedule = [], isLoading: schedLoading, error: scheduleError, refetch: refetchSchedule } = useVaccineScheduleForCountry(effectiveCountry);
  const { data: logs = [] } = useChildVaccinations(selectedChild?.id || null);
  const upsert = useUpsertChildVaccination();
  const del = useDeleteChildVaccination();

  const [tab, setTab] = useState<TabKey>('upcoming');
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const setDetailRow = (row: VaccineScheduleRow | null) => setDetailRowId(row?.id || null);
  const [actionRow, setActionRow] = useState<VaccineScheduleRow | null>(null);
  const [actionChildId, setActionChildId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'done' | 'skip' | null>(null);
  const actionScope = useRef('');
  actionScope.current = `${selectedChild?.id}:${effectiveCountry}:${actionRow?.id}`;
  useEffect(() => {
    setDetailRowId(null); setActionRow(null); setActionChildId(null); setActionMode(null);
  }, [selectedChild?.id, effectiveCountry]);

  const rowsWithStatus = useMemo(() => {
    const logMap = new Map(logs.map((l) => [l.vaccine_schedule_id, l]));
    return schedule.filter(r => {
      const log = logMap.get(r.id);
      return selectedChild && (r.vaccine.is_active || !!log)
        && vaccineEligible(r, selectedChild.birth_date, selectedChild.gender, log);
    }).map((r) => {
      const log = logMap.get(r.id) || null;
      return { row: r, log, status: vaccineStatus(r, selectedChild!.birth_date, logMap) };
    });
  }, [schedule, logs, selectedChild]);
  const detailRow = rowsWithStatus.find(item => item.row.id === detailRowId)?.row || null;

  const stats = useMemo(() => {
    const routine = rowsWithStatus.filter(x => !vaccineTiming(x.row) || vaccineTiming(x.row)?.kind === 'routine');
    const total = routine.length;
    const done = routine.filter((x) => x.status === 'done').length;
    const overdue = routine.filter((x) => x.status === 'overdue').length;
    const upcoming = routine.filter((x) => ['pending', 'overdue', 'interval'].includes(x.status)).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    return { total, done, overdue, upcoming, pct };
  }, [rowsWithStatus]);

  const upcomingRows = rowsWithStatus.
   filter((x) => ['overdue', 'pending', 'future', 'interval'].includes(x.status)).
  sort((a, b) => a.row.recommended_age_days - b.row.recommended_age_days).
  slice(0, 30);

  const doneRows = rowsWithStatus.
  filter((x) => x.status === 'done').
  sort((a, b) => (b.log?.administered_at || '').localeCompare(a.log?.administered_at || ''));

  const groupedAll = useMemo(() => groupByAge(rowsWithStatus.map(item => item.row), lang), [rowsWithStatus, lang]);
  const country = countries.find((c) => c.code === effectiveCountry);

  const handleChangeCountry = async (code: string) => {
    if (!selectedChild || !user || savingCountry || !countries.some(country => country.code === code)) return;
    const childId = selectedChild.id;
    setSavingCountry(true);
    try {
      const { data, error } = await (supabase as any).from('user_children').update({ vaccine_country_code: code })
        .eq('id', childId).eq('user_id', user.id).select('id,vaccine_country_code').maybeSingle();
      if (error || data?.id !== childId || data?.vaccine_country_code !== code) throw new Error('VACCINE_COUNTRY_WRITE_UNCONFIRMED');
      setCountryOverride({ childId, code });
      await refetchChildren();
      window.dispatchEvent(new Event('anacan:children-updated'));
    } catch {
      toast({ title: regionalText('countrySaveFailed', lang), variant: 'destructive' });
    } finally { setSavingCountry(false); }
  };

  const renderStatusBadge = (s: StatusKey) => {
    const meta = STATUS[s];
    const Icon = meta.icon;
    return (
      <span
        className="inline-flex items-center gap-1"
        style={{ padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: meta.bg, color: meta.ink }}>
        <Icon size={11} strokeWidth={2.2} />
        {meta.label()}
      </span>);

  };

  const renderCard = (item: {row: VaccineScheduleRow;log: ChildVaccination | null;status: StatusKey;}) => {
    const { row, log, status } = item;
    return (
      <motion.button
        key={row.id}
        whileTap={{ scale: 0.98 }}
        onClick={() => setDetailRow(row)}
        className="a-card w-full text-start"
        style={{ padding: '14px 16px', cursor: 'pointer' }}>
        
        <div className="flex items-start gap-3">
          <span
            className="a-list-icon"
            style={{ background: `${row.vaccine.color_hex || 'var(--a-peach-2)'}1f`, color: row.vaccine.color_hex || 'var(--a-peach-2)' }}>
            
            <Syringe size={17} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="a-list-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{translateVaccineLabel(row.vaccine.name, lang)}</h4>
              {!vaccineTiming(row) && !row.vaccine.is_mandatory &&
              <span className="a-tag" style={{ cursor: 'default', padding: '3px 8px', fontSize: 9.5 }}>{tr("vaccinecalendar_konullu_6b1c0e", "k\xF6n\xFCll\xFC")}</span>
              }
            </div>
            <p className="a-list-sub">
              {translateVaccineLabel(row.age_label, lang)} · {translateVaccineLabel(row.dose_label, lang)}
            </p>
            <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
              {renderStatusBadge(status)}
              {log?.administered_at &&
              <span className="a-list-time">{formatVaccineDate(log.administered_at)}</span>
              }
            </div>
          </div>
        </div>
      </motion.button>);

  };

  if (!selectedChild) {
    return (
      <div className="a-scope flex flex-col" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
        <Header onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Syringe size={44} style={{ color: 'var(--a-ink-faint)', marginBottom: 12 }} />
          <h3 className="a-list-title" style={{ fontSize: 15 }}>{tr("vaccinecalendar_usaq_secilmeyib_a26423", "U\u015Faq se\xE7ilm\u0259yib")}</h3>
          <p className="a-list-sub" style={{ whiteSpace: 'normal', marginTop: 4 }}>{tr("vaccinecalendar_peyvend_teqvimini_gormek_ucun__8ce451", "Peyv\u0259nd t\u0259qvimini g\xF6rm\u0259k \xFC\xE7\xFCn \u0259vv\u0259lc\u0259 u\u015Faq profili yarad\u0131n.")}</p>
        </div>
      </div>);

  }

  return (
    <div className="a-scope pb-24" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <Header onBack={onBack} />

      {/* Child + Country selector */}
      <div className="a-shell">
        <div className="a-card">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="a-rank-avatar" style={{ background: 'var(--a-surface-soft)', fontSize: 19 }}>
                {selectedChild.avatar_emoji}
              </span>
              <div className="min-w-0">
                {children.length > 1 ?
                <DropdownMenu>
                    <DropdownMenuTrigger className="a-list-title flex items-center gap-1" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      {selectedChild.name} <ChevronDown size={12} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {children.map((c) =>
                    <DropdownMenuItem key={c.id} onClick={() => setSelectedChild(c)}>
                          {c.avatar_emoji} {c.name}
                        </DropdownMenuItem>
                    )}
                    </DropdownMenuContent>
                  </DropdownMenu> :

                <h2 className="a-list-title truncate">{selectedChild.name}</h2>
                }
                <p className="a-list-sub">{getChildAge(selectedChild).displayText}</p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="a-tag" data-testid="vaccine-country" disabled={savingCountry} style={{ cursor: 'pointer', flexShrink: 0, maxWidth: '60%' }}>
                  {country?.flag_emoji && !country.flag_emoji.startsWith('data:') && country.flag_emoji.length > 10 ? (
                    <img src={`data:image/png;base64,${country.flag_emoji}`} alt="" loading="lazy" decoding="async" style={{ width: 15, height: 11, objectFit: 'cover', borderRadius: 2 }} />
                  ) : (
                    <span>{country?.flag_emoji || '🌍'}</span>
                  )}
                  <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{country?.name || localizedCountryName(effectiveCountry, lang)}</span>
                  <ChevronDown size={11} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {orderedCountries.map((c) =>
                <DropdownMenuItem key={c.code} disabled={savingCountry} onClick={() => handleChangeCountry(c.code)}>
                  <span className="flex items-center gap-2">
                    {c.flag_emoji && !c.flag_emoji.startsWith('data:') && c.flag_emoji.length > 10 ? (
                      <img src={`data:image/png;base64,${c.flag_emoji}`} alt="" loading="lazy" decoding="async" className="w-4 h-3 object-cover rounded-sm" />
                    ) : (
                      <span>{c.flag_emoji || '🌍'}</span>
                    )}
                    <span>{c.name}</span>
                  </span>
                </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats */}
          <div className="a-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            <Stat label={tr("vaccinecalendar_cemi_84214a", "C\u0259mi")} value={stats.total} />
            <Stat label={tr("vaccine_stat_done", "Tamam")} value={stats.done} color="var(--a-green-ink)" />
            <Stat label={tr("vaccine_stat_pending", "Qalan")} value={stats.upcoming} color="var(--a-warn-ink)" />
            <Stat label={tr("vaccinecalendar_geciken_c7adb0", "Gecik\u0259n")} value={stats.overdue} color="var(--a-pink-ink)" />
          </div>

          {/* Progress */}
          <div style={{ marginTop: 12 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
              <span className="a-list-sub" style={{ margin: 0 }}>{tr("vaccinecalendar_tereqqi_9cf2fe", "T\u0259r\u0259qqi")}</span>
              <span className="a-list-value" style={{ color: 'var(--a-accent-ink)' }}>{stats.pct}%</span>
            </div>
            <div className="a-inline-bar" style={{ marginTop: 0 }}>
              <motion.div
                className="a-inline-bar-fill"
                style={{ background: 'var(--a-grad-green)' }}
                animate={{ width: `${stats.pct}%` }}
                transition={{ duration: 0.6 }} />
            </div>
          </div>

            {/* PREMATURE QEYDİ: peyvəndlər korreksiya olunmuş yaşla YOX, real
              (xronoloji) yaşla vurulur — WHO/AAP standartı. İstifadəçi
              çaşqınlığının qarşısını almaq üçün premature körpələrdə göstərilir. */}
          {getChildAge(selectedChild).isPremature &&
          <p style={{ marginTop: 10, fontSize: 11, color: 'var(--a-ink-soft)', background: 'var(--a-surface-soft)', borderRadius: 10, padding: '8px 10px' }}>
              ℹ️ {tr('vaccine_preemie_note', 'Vaxtından əvvəl doğulan körpələrdə peyvəndlər korreksiya olunmuş yaşa görə DEYİL, real doğum tarixinə görə vurulur (beynəlxalq standart). Təqvim dəyişməz qalır.')}
            </p>
          }
          {country?.schedule_meta?.notes?.[lang] &&
            <p className="a-list-sub" style={{ marginTop: 10, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }} data-testid="vaccine-programme-note">
              {country.schedule_meta.notes[lang]}
            </p>
          }
        </div>

        {/* Tabs */}
        <div className="a-tabs" style={{ display: 'flex', width: '100%', marginTop: 14 }}>
          {([
          { k: 'upcoming', l: tr("vaccinecalendar_yaxinlasan_773e16", "Yax\u0131nla\u015Fan") },
          { k: 'all', l: tr("vaccinecalendar_tam_qrafik", "Tam qrafik") },
          { k: 'done', l: tr("vaccinecalendar_tamamlanmis_e36252", "Tamamlanm\u0131\u015F") }] as
          {k: TabKey;l: string;}[]).map((t) =>
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`a-tab${tab === t.k ? ' active' : ''}`}
            style={{ flex: 1 }}>
            
              {t.l}
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2.5">
          {schedLoading && <p className="a-list-sub text-center" style={{ padding: '24px 0', margin: 0 }}>{tr("vaccinecalendar_yuklenir_5557de", "Y\xFCkl\u0259nir...")}</p>}
          {scheduleError && <div className="a-card" role="alert">
            <p className="a-list-sub">{regionalText('scheduleError', lang)}</p>
            <Button variant="outline" onClick={() => void refetchSchedule()}>{regionalText('retry', lang)}</Button>
          </div>}

          {!schedLoading && !scheduleError && schedule.length === 0 &&
          <div className="a-card" style={{ textAlign: 'center', padding: '28px 18px' }}>
              <Globe size={36} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 8px' }} />
              <p className="a-list-title" style={{ marginBottom: 3 }}>{tr("vaccinecalendar_bu_olke_ucun_qrafik_hele_hazir_726119", "Bu \xF6lk\u0259 \xFC\xE7\xFCn qrafik h\u0259l\u0259 haz\u0131rlanmay\u0131b")}</p>
              <p className="a-list-sub" style={{ margin: 0 }}>{tr("vaccinecalendar_tezlikle_elave_olunacaq_da1414", "Tezlikl\u0259 \u0259lav\u0259 olunacaq.")}</p>
            </div>
          }

          {tab === 'upcoming' && upcomingRows.map(renderCard)}
          {tab === 'done' && (
          doneRows.length === 0 ?
          <p className="a-list-sub text-center" style={{ padding: '24px 0', margin: 0 }}>{tr("vaccinecalendar_hele_tamamlanmis_peyvend_yoxdu_c76148", "H\u0259l\u0259 tamamlanm\u0131\u015F peyv\u0259nd yoxdur.")}</p> :
          doneRows.map(renderCard))
          }
          {tab === 'all' && groupedAll.map((g) => {
            const groupRows = rowsWithStatus.filter((x) => translateVaccineLabel(x.row.age_label, lang) === g.label);
            return (
              <div key={g.label} className="mt-4 first:mt-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--a-peach-2)', flexShrink: 0 }} />
                  <h3 className="a-today-info-eyebrow" style={{ margin: 0 }}>{g.label}</h3>
                  <div style={{ flex: 1, height: 1, background: 'var(--a-line-strong)' }} />
                </div>
                <div className="space-y-2.5">{groupRows.map(renderCard)}</div>
              </div>);

          })}
        </div>

        {/* Source */}
        {country?.source_url &&
        <div className="mt-5">
            <a
            href={country.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="a-legend-item justify-center"
            style={{ display: 'flex' }}>
            
              <Info size={11} />
              <span>
                {tr("vaccinecalendar_menbe_87d8be", "M\u0259nb\u0259:")}{" "}
                {lang === 'en' && (country.source_label || '').includes('Səhiyyə Nazirliyi')
                  ? 'Ministry of Health of the Republic of Azerbaijan — National Immunization Schedule'
                  : country.source_label || country.source_url}
              </span>
              <ExternalLink size={9} />
            </a>
          </div>
        }
      </div>

      {/* Detail sheet */}
      <Sheet open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-3xl">
          {detailRow &&
          <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: `${detailRow.vaccine.color_hex || '#F28155'}1a`, color: detailRow.vaccine.color_hex || '#F28155' }}>
                  
                    <Syringe className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-start">
                    <SheetTitle className="text-base">{translateVaccineLabel(detailRow.vaccine.name, lang)}</SheetTitle>
                    <p className="text-[11px] text-muted-foreground">{translateVaccineLabel(detailRow.age_label, lang)} • {translateVaccineLabel(detailRow.dose_label, lang)}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-3 text-sm">
                {detailRow.vaccine.short_description &&
              <p className="text-[13px] text-foreground leading-relaxed">{translateVaccineLabel(detailRow.vaccine.short_description, lang)}</p>
              }
                {detailRow.vaccine.full_description &&
              <div style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: 12 }}>
                    <p className="text-[12px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--a-ink)' }}>
                      {translateVaccineLabel(detailRow.vaccine.full_description, lang)}
                    </p>
                  </div>
              }
                {detailRow.vaccine.disease &&
              <DetailRow label={tr("vaccinecalendar_qarsisi_alinan_xestelik_862a71", "Qarşısı alınan xəstəlik")} value={translateVaccineLabel(detailRow.vaccine.disease, lang)} />
              }
                {detailRow.vaccine.route &&
              <DetailRow label={tr("vaccinecalendar_vurma_usulu_689cd3", "Vurma üsulu")} value={translateVaccineLabel(detailRow.vaccine.route, lang)} />
              }
                {detailRow.vaccine.side_effects &&
              <DetailRow label={tr("vaccinecalendar_mumkun_yan_tesirler_fc6796", "Mümkün yan təsirlər")} value={translateVaccineLabel(detailRow.vaccine.side_effects, lang)} />
              }
                {detailRow.vaccine.contraindications &&
              <DetailRow label={tr("vaccinecalendar_eks_gosterisler_f34875", "Əks-göstərişlər")} value={translateVaccineLabel(detailRow.vaccine.contraindications, lang)} />
              }
                {detailRow.notes && <DetailRow label={tr("untranslated_qeyd_z0999u", "Qeyd")} value={translateVaccineLabel(detailRow.notes, lang)} />}
                {vaccineTiming(detailRow)?.source_url && <a href={vaccineTiming(detailRow)!.source_url} target="_blank" rel="noopener noreferrer"
                  className="a-list-sub" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', overflowWrap: 'anywhere' }}>
                  <ExternalLink size={12} />{regionalText('source', lang)}: {vaccineTiming(detailRow)!.source_label}
                </a>}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                  className="a-cta-btn"
                  style={{ justifyContent: 'center', background: 'var(--a-green-2)' }}
                  onClick={() => {setActionRow(detailRow);setActionChildId(selectedChild.id);setActionMode('done');setDetailRow(null);}}>
                  
                    <CheckCircle2 size={15} strokeWidth={2.2} /> {tr("vaccinecalendar_vuruldu", "Vuruldu")}
                  </button>
                  <button
                  className="a-btn-soft"
                  style={{ justifyContent: 'center' }}
                  onClick={() => {setActionRow(detailRow);setActionChildId(selectedChild.id);setActionMode('skip');setDetailRow(null);}}>
                  
                    <Ban size={15} strokeWidth={2.2} /> {tr("vaccinecalendar_buraxildi_61c6a0", "Burax\u0131ld\u0131")}
                  </button>
                </div>

                {logs.find((l) => l.vaccine_schedule_id === detailRow.id) &&
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-red-500"
                onClick={async () => {
                  const log = logs.find((l) => l.vaccine_schedule_id === detailRow.id);
                  if (log && selectedChild) {
                    await del.mutateAsync({ id: log.id, child_id: selectedChild.id });
                    toast({ title: tr("vaccinecalendar_status_sifirlandi_77a21e", "Status s\u0131f\u0131rland\u0131") });
                    setDetailRow(null);
                  }
                }}>
                    {tr("vaccinecalendar_statusu_sifirla_dce807", "Statusu s\u0131f\u0131rla")}
                  
              </Button>
              }
              </div>
            </>
          }
        </SheetContent>
      </Sheet>

      {/* Action dialog */}
      <ActionDialog
        key={`${selectedChild.id}:${effectiveCountry}:${actionRow?.id}:${actionMode}`}
        open={!!actionRow && !!actionMode}
        mode={actionMode}
        row={actionRow}
        onClose={() => {setActionRow(null);setActionMode(null);}}
        onSubmit={async (payload) => {
          if (!actionRow || !selectedChild || actionChildId !== selectedChild.id || actionRow.country_code !== effectiveCountry) return;
          const scope = actionScope.current;
          await upsert.mutateAsync({
            child_id: selectedChild.id,
            vaccine_schedule_id: actionRow.id,
            country_code: effectiveCountry,
            ...payload
          });
          if (actionScope.current !== scope) return;
          toast({ title: tr("vaccinecalendar_yadda_saxlandi_f72ffd", "Yadda saxland\u0131"), description: actionRow.vaccine.name });
          setActionRow(null);
          setActionMode(null);
        }} />
      
    </div>);

}

function Header({ onBack }: {onBack: () => void;}) {
  return (
    <div className="a-shell">
      <header className="a-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }}>
            <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
          </motion.button>
          <div>
            <p className="a-eyebrow">{tr("vaccine_national_schedule", "Milli İmmunizasiya Qrafiki")}</p>
            <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("vaccinecalendar_peyvend_teqvimi_d84c87", "Peyv\u0259nd T\u0259qvimi")}</p>
          </div>
        </div>
        <Sparkles size={16} style={{ color: 'var(--a-peach-2)' }} />
      </header>
    </div>);

}

function Stat({ label, value, color = 'var(--a-ink)' }: {label: string;value: number;color?: string;}) {
  return (
    <div className="a-stat-tile" style={{ flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
      <div className="a-stat-tile-label">{label}</div>
    </div>);

}

function DetailRow({ label, value }: {label: string;value: string;}) {
  return (
    <div style={{ borderLeft: '2px solid var(--a-peach-2)', paddingInlineStart: 12 }}>
      <p className="a-today-info-eyebrow" style={{ margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 2, whiteSpace: 'pre-line', color: 'var(--a-ink)' }}>{value}</p>
    </div>);

}

function ActionDialog({
  open, mode, row, onClose, onSubmit
}: {open: boolean;mode: 'done' | 'skip' | null;row: VaccineScheduleRow | null;onClose: () => void;onSubmit: (payload: any) => Promise<void>;}) {
  const lang = getPersistedLanguage();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState('');
  const [batch, setBatch] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const submit = async (payload: Record<string, unknown>) => {
    if (saving) return;
    setSaving(true);
    try { await onSubmit(payload); }
    catch { toast({ title: tr('usecommunity_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'done' ? tr("vaccinecalendar_peyvend_vuruldu_22c2e5", "Peyv\u0259nd vuruldu") : tr("vaccinecalendar_peyvendi_buraxildi_kimi_qeyd_e_64265a", "Peyv\u0259ndi burax\u0131ld\u0131 kimi qeyd et")}
          </DialogTitle>
        </DialogHeader>
        {row && <p className="text-xs text-muted-foreground -mt-2">{translateVaccineLabel(row.vaccine.name, lang)} • {translateVaccineLabel(row.dose_label, getPersistedLanguage())}</p>}
        {mode === 'done' ?
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">{tr("untranslated_tarix_6hhkyx", "Tarix")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} />
            </div>
            <div>
              <Label className="text-xs">{tr("vaccinecalendar_yer_xestexana_klinika_d8c111", "Yer (xəstəxana/klinika)")}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tr("vaccinecalendar_yer_ph", "məs. Bakı Uşaq Klinik Xəstəxanası")} />
            </div>
            <div>
              <Label className="text-xs">{tr("vaccinecalendar_partiya_nomresi_isteye_bagli_4b290a", "Partiya n\xF6mr\u0259si (ist\u0259y\u0259 ba\u011Fl\u0131)")}</Label>
              <Input value={batch} onChange={(e) => setBatch(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{tr("untranslated_qeyd_z0999u", "Qeyd")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <Button
            className="w-full bg-emerald-500 hover:bg-emerald-600"
            disabled={saving || !date || date > today}
            onClick={() => void submit({
              administered_at: date, is_skipped: false, skip_reason: null,
              location_az: location || null, batch_number: batch || null, notes: notes || null
            })}>{tr("untranslated_yadda_saxla_bpdu9v", "Yadda saxla")}</Button>
          </div> :

        <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">{tr("vaccinecalendar_sebeb_7b51f1", "Səbəb")}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={tr("vaccinecalendar_sebeb_ph", "məs. Tibbi əks-göstəriş")} />
            </div>
            <Button
            variant="outline"
            className="w-full"
            disabled={saving}
            onClick={() => void submit({
              administered_at: null, is_skipped: true, skip_reason: reason || null
            })}>
              {tr("vaccinecalendar_tesdiq_et_87b1a4", "T\u0259sdiq et")}
            
          </Button>
          </div>
        }
      </DialogContent>
    </Dialog>);

}
