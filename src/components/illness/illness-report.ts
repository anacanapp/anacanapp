import type { DoctorReportData } from '@/lib/pdfReport';
import type { IllnessText } from '@/data/illness';
import type { IllnessEntry, IllnessEpisode } from '@/lib/illness';

/** Doctor summary of one illness episode, rendered by the shared PDF report. */
export function buildIllnessReport(t: IllnessText, episode: IllnessEpisode, entries: IllnessEntry[], opts: { childName: string; locale: string; userName: string }): DoctorReportData {
  const when = (iso: string) => new Date(iso).toLocaleString(opts.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const chronological = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const temps = chronological.filter((e) => e.kind === 'temp');
  const meds = chronological.filter((e) => e.kind === 'med');
  const symptoms = chronological.filter((e) => e.kind === 'symptom');
  const who = (e: IllnessEntry) => e.by === 'mother' ? t.by_mother : e.by === 'partner' ? t.by_partner : '—';
  const maxTemp = temps.reduce((m, e) => Math.max(m, e.temp_c ?? 0), 0);
  const start = new Date(episode.started_at).toLocaleDateString(opts.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const end = episode.ended_at ? new Date(episode.ended_at).toLocaleDateString(opts.locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const historyTables: DoctorReportData['historyTables'] = [];
  if (temps.length) historyTables.push({
    title: t.report_tables.temps,
    headers: [t.report_headers.time, t.report_headers.value, t.report_headers.method],
    rows: temps.map((e) => [when(e.at), `${e.temp_c?.toFixed(1)} °C`, e.temp_method ? t.methods[e.temp_method] : '—'])
  });
  if (meds.length) historyTables.push({
    title: t.report_tables.meds,
    headers: [t.report_headers.time, t.report_headers.med, t.report_headers.dose, t.report_headers.by],
    rows: meds.map((e) => [when(e.at), e.med_name ?? '', `${e.dose ?? ''}${e.interval_hours ? ` / ${e.interval_hours}h` : ''}`, who(e)])
  });
  if (symptoms.length) historyTables.push({
    title: t.report_tables.symptoms,
    headers: [t.report_headers.time, t.report_headers.symptoms, t.report_headers.note],
    rows: symptoms.map((e) => [when(e.at), (e.symptoms ?? []).map((s) => (t.symptoms as Record<string, string>)[s] ?? s).join(', '), e.note ?? ''])
  });
  return {
    userName: opts.userName,
    stageTitle: t.report_pdf_title,
    periodLabel: end ? `${start} – ${end}` : start,
    stageRows: [
      { label: t.report_rows.child, value: opts.childName || '—' },
      { label: t.report_rows.illness, value: t.kinds[episode.kind] },
      { label: t.report_rows.started, value: when(episode.started_at) },
      { label: t.report_rows.max_temp, value: maxTemp ? `${maxTemp.toFixed(1)} °C` : '—' },
      { label: t.report_rows.status, value: end ? `${t.ended} · ${end}` : t.active }
    ],
    trends: [],
    historyTables,
    coverage: { records: entries.length, recordedDays: new Set(entries.map((e) => e.at.slice(0, 10))).size },
    notes: `${t.no_dose_calc} ${t.disclaimer}`
  };
}
