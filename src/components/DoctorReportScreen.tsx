import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Download, FileCheck2, FileText, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useChildren } from '@/hooks/useChildren';
import { useHealthReport } from '@/hooks/useHealthReport';
import { useSubscription } from '@/hooks/useSubscription';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { buildDoctorReportData, reportDate } from '@/lib/doctor-report';
import type { ReportPeriod } from '@/lib/health-report-data';
import type { ReportRow } from '@/lib/pdfReport';
import PremiumModal from '@/components/PremiumModal';
import { tr } from '@/lib/tr';

interface DoctorReportScreenProps { onBack: () => void; }

export default function DoctorReportScreen({ onBack }: DoctorReportScreenProps) {
  useScrollToTop();
  const { lifeStage, getCycleData, getPregnancyData, language } = useUserStore(useShallow(state => ({
    lifeStage: state.lifeStage, getCycleData: state.getCycleData, getPregnancyData: state.getPregnancyData, language: state.language,
  })));
  const { user, profile } = useAuth();
  const { children, selectedChild, setSelectedChild, getChildAge, loading: childrenLoading } = useChildren();
  const { isPremium } = useSubscription();
  const { toast } = useToast();
  const [period, setPeriod] = useState<ReportPeriod>('1month');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const mounted = useRef(true);
  const actorRef = useRef(user?.id);
  actorRef.current = user?.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [showPremium, setShowPremium] = useState(false);
  const child = selectedChild?.user_id === user?.id ? selectedChild : null;
  const report = useHealthReport(period, child?.id ?? null, lifeStage || 'flow');
  const periods: { id: ReportPeriod; label: string }[] = [
    { id: '1week', label: tr('doctorreportscreen_1_hefte_6d1cb4', '1 Həftə') },
    { id: '1month', label: tr('doctorreport_1_ay', '1 Ay') },
    { id: '3months', label: tr('doctorreport_3_ay', '3 Ay') },
    { id: 'all', label: tr('doctorreportscreen_hamisi_c73c4d', 'Hamısı') },
  ];
  const userName = profile?.user_id === user?.id ? profile?.name || tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi') : user?.user_metadata?.name || tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi');
  const stageTitle = lifeStage === 'bump' ? tr('pdf_stage_bump', 'Hamiləlik dövrü') : lifeStage === 'mommy' ? tr('pdf_stage_mommy', 'Analıq dövrü') : tr('pdf_stage_flow', 'Tsikl izləmə');
  const stageRows = useMemo((): ReportRow[] => {
    if (lifeStage === 'mommy' && child) {
      const age = getChildAge(child);
      return [
        { label: tr('doctorreportscreen_korpenin_adi_8a4e9e', 'Körpənin adı'), value: child.name },
        { label: tr('report_chronological_age', 'Xronoloji yaş'), value: age.displayText },
        { label: tr('doctorreportscreen_dogum_tarixi_d96907', 'Doğum tarixi'), value: reportDate(child.birth_date) },
        { label: tr('doctorreportscreen_cinsiyyet_1526fb', 'Cinsiyyət'), value: child.gender === 'boy' ? tr('doctorreportscreen_oglan_e9715e', 'Oğlan') : child.gender === 'girl' ? tr('doctorreportscreen_qiz_79bf6b', 'Qız') : tr('report_unspecified', 'Qeyd edilməyib') },
        ...(age.correctionApplied ? [
          { label: tr('preemie_corrected_label', 'Korreksiya olunmuş yaş'), value: age.correctedDisplayText },
          { label: tr('report_gestation_at_birth', 'Doğuşda gestasiya'), value: `${age.gestationalWeeksAtBirth}+${age.gestationalExtraDays || 0} ${tr('report_weeks', 'həftə')}` },
        ] : []),
      ];
    }
    if (lifeStage === 'bump') {
      const pregnancy = getPregnancyData();
      if (!pregnancy) return [];
      return [
        { label: tr('doctorreportscreen_hamilelik_heftesi_c9e362', 'Hamiləlik həftəsi'), value: `${pregnancy.currentWeek}+${pregnancy.currentDay} ${tr('report_weeks', 'həftə')}` },
        { label: tr('report_lmp', 'Son menstruasiyanın ilk günü'), value: reportDate(pregnancy.lastPeriodDate) },
        { label: tr('doctorreportscreen_texmini_dogus_98eb77', 'Təxmini doğuş'), value: reportDate(pregnancy.dueDate) },
        { label: tr('doctorreportscreen_trimester_4dc81e', 'Trimester'), value: String(pregnancy.trimester) },
      ];
    }
    const cycle = getCycleData();
    if (!cycle) return [];
    const phases: Record<string, string> = {
      menstrual: tr('report_phase_menstrual', 'Menstruasiya'), follicular: tr('report_phase_follicular', 'Follikulyar'),
      ovulation: tr('report_phase_ovulation', 'Ovulyasiya'), luteal: tr('report_phase_luteal', 'Luteal'),
    };
    return [
      { label: tr('doctorreportscreen_dovre_uzunlugu_c81215', 'Dövrə uzunluğu'), value: `${cycle.cycleLength} ${tr('common_gun', 'gün')}` },
      { label: tr('doctorreportscreen_menstruasiya_1c9b68', 'Menstruasiya'), value: `${cycle.periodLength} ${tr('common_gun', 'gün')}` },
      { label: tr('report_estimated_phase', 'Təxmini faza'), value: phases[cycle.phase] || cycle.phase },
      { label: tr('doctorreportscreen_dovrenin_gunu_7549f2', 'Dövrənin günü'), value: String(cycle.currentDay) },
    ];
  }, [lifeStage, child, getChildAge, getPregnancyData, getCycleData, language]);
  const presentation = useMemo(() => report.data ? buildDoctorReportData(report.data, {
    userName, stage: lifeStage || 'flow', stageTitle, stageRows, notes,
    periodLabel: periods.find(item => item.id === period)!.label,
  }) : null, [report.data, userName, lifeStage, stageTitle, stageRows, notes, period, language]);
  const loading = report.isPending || report.isFetching || (lifeStage === 'mommy' && childrenLoading);
  const canExport = !!presentation && !loading && !report.isError && !!user;

  const exportReport = async (mode: 'download' | 'share') => {
    if (!isPremium) { setShowPremium(true); return; }
    if (!canExport || !presentation || generatingRef.current) return;
    const actor = user?.id;
    generatingRef.current = true; setGenerating(true);
    try {
      const { generateDoctorReportPdf, deliverPdf } = await import('@/lib/pdfReport');
      const doc = await generateDoctorReportPdf(presentation);
      if (!mounted.current || actor !== actorRef.current) return;
      const fileName = `anacan-hesabat-${new Date().toISOString().slice(0, 10)}.pdf`;
      const result = await deliverPdf(doc, fileName, mode);
      if (!mounted.current || actor !== actorRef.current || result === 'cancelled') return;
      toast({ title: result === 'shared' ? tr('pdf_shared_toast', 'Hesabat paylaşıldı') : tr('pdf_downloaded_toast', 'PDF yükləndi'), description: fileName });
    } catch (error) {
      console.error('Doctor report export failed', error instanceof Error ? error.name : 'Error');
      if (mounted.current) toast({ title: tr('pdf_error_toast', 'PDF yaradıla bilmədi'), description: tr('pdf_error_desc', 'Yenidən cəhd edin.'), variant: 'destructive' });
    } finally { generatingRef.current = false; if (mounted.current) setGenerating(false); }
  };
  const rows = (items: ReportRow[]) => <div className="grid grid-cols-2 gap-3">{items.map((item, index) => <div key={index} className="min-w-0 rounded-2xl p-3" style={{ background: 'var(--a-surface-soft)' }}>
    <p className="text-xs mb-1.5" style={{ color: 'var(--a-ink-soft)' }}>{item.label}</p><p className="text-sm font-bold break-words">{item.value}</p>
  </div>)}</div>;

  return <div className="a-scope min-h-screen pb-28" style={{ background: 'var(--a-bg)' }} data-doctor-report>
    <div className="a-shell">
      <header className="a-topbar">
        <div className="flex min-w-0 items-center gap-3"><button className="a-icon-btn" onClick={onBack} aria-label={tr('common_geri', 'Geri')}><ArrowLeft size={18} className="rtl:rotate-180" /></button>
          <div className="min-w-0"><p className="a-eyebrow">{tr('report_visit_ready', 'Həkim görüşünə hazırlıq')}</p><h1 className="a-wordmark" style={{ fontSize: 18 }}>{tr('doctorreportscreen_hekim_hesabati_0525fc', 'Həkim Hesabatı')}</h1></div>
        </div>
      </header>
      <div className="space-y-4">
        <section className="a-card" style={{ padding: 20 }}>
          <div className="flex items-start gap-3 mb-4"><div className="a-list-icon" style={{ background: 'var(--a-peach-1)' }}><FileCheck2 size={23} style={{ color: 'var(--a-accent-ink)' }} /></div>
            <div className="min-w-0"><h2 className="font-extrabold text-lg break-words">{userName}</h2><p className="text-sm" style={{ color: 'var(--a-ink-soft)' }}>{stageTitle}</p></div>
          </div>
          <div className="a-tabs mb-4" role="tablist" aria-label={tr('report_period', 'Hesabat dövrü')}>
            {periods.map(item => <button key={item.id} role="tab" aria-selected={period === item.id} disabled={generating} className={`a-tab${period === item.id ? ' active' : ''}`} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
          </div>
          {lifeStage === 'mommy' && children.length > 0 && <label className="block mb-4 text-sm font-semibold">
            {tr('report_choose_child', 'Hesabat üçün körpə')}
            <select className="a-input block w-full mt-2 text-base" aria-label={tr('report_choose_child', 'Hesabat üçün körpə')} disabled={generating} value={child?.id || ''} onChange={event => setSelectedChild(children.find(item => item.id === event.target.value) || null)}>
              {children.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}
          {presentation?.dateRangeLabel && <p className="flex items-start gap-2 text-xs mb-4" style={{ color: 'var(--a-ink-soft)' }}><Calendar size={14} className="shrink-0" />{presentation.dateRangeLabel}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button className="a-btn-solid justify-center" disabled={!canExport || generating} onClick={() => void exportReport('download')}>
              {generating ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}{tr('report_download_pdf', 'PDF yüklə')}
            </button>
            <button className="a-btn-soft justify-center" disabled={!canExport || generating} onClick={() => void exportReport('share')}><Share2 size={17} />{tr('report_share_email', 'Paylaş / e-poçt')}</button>
          </div>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--a-ink-soft)' }}>{tr('report_export_hint', 'PDF-ni yükləyin və ya paylaşım menyusu ilə həkiminizə göndərin.')}{!isPremium && <strong className="ms-1">Premium</strong>}</p>
        </section>
        {report.isError && <section className="a-card" role="alert"><p className="text-sm">{tr('report_data_error', 'Məlumatlar tam yüklənmədi. Natamam hesabat yaratmamaq üçün yenidən yoxlayın.')}</p><button className="a-btn-soft mt-3" onClick={() => void report.refetch()}><RefreshCw size={16} />{tr('community_retry', 'Yenidən yoxla')}</button></section>}
        {loading && <div className="a-card flex justify-center gap-2 text-sm" role="status"><Loader2 size={20} className="animate-spin" />{tr('report_loading_data', 'Qeydlər hazırlanır...')}</div>}
        {!!stageRows.length && <section className="a-card"><h3 className="a-card-title mb-4">{tr('pdf_section_basics', 'Cari məlumatlar')}</h3>{rows(stageRows)}</section>}
        {presentation && !report.isError && <>
          <section className="a-card"><h3 className="a-card-title mb-3">{tr('pdf_section_trends', 'Sağlamlıq göstəriciləri')}</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--a-ink-soft)' }}>{presentation.coverage?.records} {tr('report_records', 'qeyd')} · {presentation.coverage?.recordedDays} {tr('report_days_recorded', 'qeydli gün')}</p>
            <div className="space-y-2">{presentation.trends.map(item => <div key={item.label} className="rounded-xl p-3" style={{ background: 'var(--a-surface-soft)' }}><p className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{item.label}</p><div className="flex flex-wrap justify-between gap-2 mt-1"><strong className="text-sm">{item.value}</strong><span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{item.trend}</span></div></div>)}</div>
          </section>
          {!!presentation.babyCareRows?.length && <section className="a-card"><h3 className="a-card-title mb-3">{tr('pdf_section_babycare', 'Körpə qulluğu')}</h3><p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--a-ink-soft)' }}>{tr('pdf_logged_days_note', 'Ortalamalar yalnız müvafiq qeydin olduğu günlərə əsaslanır. Davam edən yuxu intervalları yuxu müddətinə daxil edilmir.')}</p>{rows(presentation.babyCareRows)}</section>}
          <section className="a-card"><h3 className="a-card-title mb-3">{tr('report_pdf_contents', 'PDF-yə daxil ediləcək cədvəllər')}</h3>
            {rows([
              { label: tr('pdf_weight_history', 'Çəki qeydləri'), value: String(presentation.weightSeries?.length || 0) },
              { label: tr('pdf_section_bp_period', 'Qan təzyiqi'), value: String(presentation.bpRows?.length || 0) },
              ...(presentation.historyTables || []).filter(table => table.rows.length).map(table => ({ label: table.title, value: String(table.rows.length) })),
            ])}
          </section>
        </>}
        <section className="a-card"><h3 className="a-card-title mb-3">{tr('doctorreportscreen_hekim_ucun_qeydler_052b91', 'Həkim üçün Qeydlər')}</h3><textarea className="a-input w-full min-h-[120px] text-base resize-y" value={notes} disabled={generating}
          aria-label={tr('doctorreportscreen_hekim_ucun_qeydler_052b91', 'Həkim üçün Qeydlər')} placeholder={tr('pdf_notes_ph', 'Həkiminiz üçün əlavə qeydlər yazın...')} onChange={event => setNotes(event.target.value)} /></section>
        <button className="a-btn-solid w-full justify-center" disabled={!canExport || generating} onClick={() => void exportReport('download')}>
          {generating ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}{generating ? tr('doctorreportscreen_hesabat_hazirlanir_37c97d', 'Hesabat hazırlanır...') : tr('doctorreportscreen_tam_hesabati_yukle_pdf_108b98', 'Tam Hesabatı Yüklə (PDF)')}
        </button>
      </div>
    </div>
    <PremiumModal isOpen={showPremium} onClose={() => setShowPremium(false)} feature="doctor_report" />
  </div>;
}
