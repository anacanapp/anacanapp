// Ported from: src/components/DoctorReportScreen.tsx
//
// Doctor visit preparation: period tabs, the child for a mommy report, what the PDF will contain, notes, and the
// PDF export (download / share; Premium). Drawing the PDF goes through [doctorReportPdfRendererProvider].
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart' show todayKey;
import '../../../domain/vaccines/vaccine_schedule.dart' show regionalCountry;
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenActionsProvider, childrenProvider;
import '../../baby/models/child.dart' show Child, getChildAge;
import '../../home_mommy/widgets/mommy_ui.dart' show ATabs;
import '../../settings/ui/settings_ui.dart' show ALoader, ATopbar, ShadSelect, px, toasts;
import '../../tools/health_common/health_common.dart' show healthPaywallProvider;
import '../../tools/vaccines/vaccines_data.dart' show childVaccinationsQuery, vaccineScheduleQuery;
import '../common/health_ports.dart';
import 'doctor_report.dart';
import 'doctor_report_extras.dart';
import 'health_report_data.dart';
import 'pdf_report.dart';
import 'report_queries.dart';

class DoctorReportScreen extends ConsumerStatefulWidget {
  const DoctorReportScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<DoctorReportScreen> createState() => _DoctorReportScreenState();
}

class _DoctorReportScreenState extends ConsumerState<DoctorReportScreen> {
  ReportPeriod _period = '1month';
  final TextEditingController _notes = TextEditingController();

  /// EPDS answers are sensitive; the parent decides whether this copy carries them.
  bool _includeEpds = true;
  bool _generating = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  List<ReportRow> _stageRows(String lifeStage, Child? child, UserState store) {
    if (lifeStage == 'mommy' && child != null) {
      final age = getChildAge(child);
      return [
        ReportRow(tr('doctorreportscreen_korpenin_adi_8a4e9e', 'Körpənin adı'), child.name),
        ReportRow(tr('report_chronological_age', 'Xronoloji yaş'), age.displayText),
        ReportRow(tr('doctorreportscreen_dogum_tarixi_d96907', 'Doğum tarixi'), reportDate(child.birthDate)),
        ReportRow(
          tr('doctorreportscreen_cinsiyyet_1526fb', 'Cinsiyyət'),
          child.gender == 'boy'
              ? tr('doctorreportscreen_oglan_e9715e', 'Oğlan')
              : child.gender == 'girl'
                  ? tr('doctorreportscreen_qiz_79bf6b', 'Qız')
                  : tr('report_unspecified', 'Qeyd edilməyib'),
        ),
        if (age.correctionApplied) ...[
          ReportRow(tr('preemie_corrected_label', 'Korreksiya olunmuş yaş'), age.correctedDisplayText),
          ReportRow(tr('report_gestation_at_birth', 'Doğuşda gestasiya'),
              '${age.gestationalWeeksAtBirth}+${age.gestationalExtraDays ?? 0} ${tr('report_weeks', 'həftə')}'),
        ],
      ];
    }
    if (lifeStage == 'bump') {
      final pregnancy = store.getPregnancyData();
      if (pregnancy == null) return const [];
      return [
        ReportRow(tr('doctorreportscreen_hamilelik_heftesi_c9e362', 'Hamiləlik həftəsi'), '${pregnancy.currentWeek}+${pregnancy.currentDay} ${tr('report_weeks', 'həftə')}'),
        ReportRow(tr('report_lmp', 'Son menstruasiyanın ilk günü'), reportDate(pregnancy.lastPeriodDate)),
        ReportRow(tr('doctorreportscreen_texmini_dogus_98eb77', 'Təxmini doğuş'), pregnancy.dueDate == null ? '—' : reportDate(pregnancy.dueDate!)),
        ReportRow(tr('doctorreportscreen_trimester_4dc81e', 'Trimester'), '${pregnancy.trimester}'),
      ];
    }
    final cycle = store.getCycleData();
    if (cycle == null) return const [];
    final phases = {
      'menstrual': tr('report_phase_menstrual', 'Menstruasiya'),
      'follicular': tr('report_phase_follicular', 'Follikulyar'),
      'ovulation': tr('report_phase_ovulation', 'Ovulyasiya'),
      'luteal': tr('report_phase_luteal', 'Luteal'),
    };
    final day = tr('common_gun', 'gün');
    return [
      ReportRow(tr('doctorreportscreen_dovre_uzunlugu_c81215', 'Dövrə uzunluğu'), '${cycle.cycleLength} $day'),
      ReportRow(tr('doctorreportscreen_menstruasiya_1c9b68', 'Menstruasiya'), '${cycle.periodLength} $day'),
      ReportRow(tr('report_estimated_phase', 'Təxmini faza'), phases[cycle.phase] ?? cycle.phase),
      ReportRow(tr('doctorreportscreen_dovrenin_gunu_7549f2', 'Dövrənin günü'), '${cycle.currentDay}'),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(userStoreProvider);
    final lifeStage = (store.lifeStage ?? '').isEmpty ? 'flow' : store.lifeStage!;
    final language = ref.watch(appLanguageProvider);
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final childrenView = ref.watch(childrenProvider);
    final isPremium = ref.watch(healthScreensIsPremiumProvider);
    final selected = childrenView.selectedChild;
    final child = selected != null && selected.userId == user?.id ? selected : null;
    final args = (period: _period, childId: child?.id, lifeStage: lifeStage);
    final report = ref.watch(healthReportQuery(args));
    final extras = ref.watch(doctorReportExtrasQuery(args));
    final vaccineChild = lifeStage == 'mommy' ? child : null;
    final vaccineCountry =
        vaccineChild == null ? null : regionalCountry(language, [vaccineChild.vaccineCountryCode, profile?.countryCode, store.countryCode, vaccineChild.countryCode]);
    final vaccineSchedule = ref.watch(vaccineScheduleQuery(vaccineCountry));
    final vaccineLogs = ref.watch(childVaccinationsQuery(vaccineChild?.id));
    final periods = <(ReportPeriod, String)>[
      ('1week', tr('doctorreportscreen_1_hefte_6d1cb4', '1 Həftə')),
      ('1month', tr('doctorreport_1_ay', '1 Ay')),
      ('3months', tr('doctorreport_3_ay', '3 Ay')),
      ('all', tr('doctorreportscreen_hamisi_c73c4d', 'Hamısı')),
    ];
    final fallbackName = tr('usecommunity_istifadeci_b6bdd6', 'İstifadəçi');
    final metaName = user?.userMetadata?['name'];
    final userName = profile?.userId == user?.id
        ? ((profile?.name ?? '').isNotEmpty ? profile!.name : fallbackName)
        : (metaName is String && metaName.isNotEmpty ? metaName : fallbackName);
    final stageTitle = lifeStage == 'bump'
        ? tr('pdf_stage_bump', 'Hamiləlik dövrü')
        : lifeStage == 'mommy'
            ? tr('pdf_stage_mommy', 'Analıq dövrü')
            : tr('pdf_stage_flow', 'Tsikl izləmə');
    final stageRows = _stageRows(lifeStage, child, store);
    final vaccineData = vaccineChild != null && vaccineSchedule.data != null && vaccineLogs.data != null
        ? (schedule: [for (final s in vaccineSchedule.data!) Map<String, dynamic>.from(s.row)], logs: [for (final l in vaccineLogs.data!) Map<String, dynamic>.from(l.row)])
        : null;
    final presentation = report.data != null && extras.data != null
        ? buildDoctorReportData(
            report.data!,
            userName: userName,
            stage: lifeStage,
            stageTitle: stageTitle,
            stageRows: stageRows,
            notes: _notes.text,
            periodLabel: periods.firstWhere((p) => p.$1 == _period).$2,
            extras: extras.data!.withVaccines(vaccineData),
            child: vaccineChild == null ? null : ReportChild(birthDate: vaccineChild.birthDate, gender: vaccineChild.gender, dueDate: vaccineChild.dueDate),
            includeEpds: _includeEpds,
            language: language,
          )
        : null;
    final vaccinesLoading = vaccineChild != null && (vaccineSchedule.isPending || vaccineLogs.isPending);
    final loading = report.isPending || report.isFetching || extras.isPending || extras.isFetching || vaccinesLoading || (lifeStage == 'mommy' && childrenView.loading);
    // A failed tracker read must not silently produce a report without that section.
    final dataError = report.isError || extras.isError || (vaccineChild != null && (vaccineSchedule.isError || vaccineLogs.isError));
    final hasEpds = (lifeStage == 'bump' || lifeStage == 'mommy') && (extras.data?.epds?.isNotEmpty ?? false);
    final canExport = presentation != null && !loading && !dataError && user != null;
    final a = context.a;

    Future<void> exportReport(String mode) async {
      if (!isPremium) {
        await ref.read(healthPaywallProvider)(context, 'doctor_report');
        return;
      }
      if (!canExport || _generating) return;
      final actor = user.id;
      final toast = toasts(context);
      setState(() => _generating = true);
      try {
        final bytes = await ref.read(doctorReportPdfRendererProvider).render(presentation);
        if (!mounted || actor != ref.read(authUserProvider)?.id) return;
        final fileName = 'anacan-hesabat-${todayKey()}.pdf';
        final result = await deliverPdf(ref.read(pdfDeliveryPlatformProvider), bytes, fileName, mode);
        if (!mounted || actor != ref.read(authUserProvider)?.id || result == 'cancelled') return;
        toast.message(result == 'shared' ? tr('pdf_shared_toast', 'Hesabat paylaşıldı') : tr('pdf_downloaded_toast', 'PDF yükləndi'), description: fileName);
      } catch (error) {
        debugPrint('Doctor report export failed ${error.runtimeType}');
        if (mounted) toast.show(title: tr('pdf_error_toast', 'PDF yaradıla bilmədi'), description: tr('pdf_error_desc', 'Yenidən cəhd edin.'), destructive: true);
      } finally {
        if (mounted) setState(() => _generating = false);
      }
    }

    Widget rows(List<ReportRow> items) => LayoutBuilder(builder: (context, c) {
          final w = (c.maxWidth - 12) / 2;
          return Wrap(spacing: 12, runSpacing: 12, children: [
            for (final item in items)
              Container(
                width: w,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(item.label, style: px(12, color: a.inkSoft, height: 16 / 12))),
                  Text(item.value, style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14)),
                ]),
              ),
          ]);
        });
    Widget card({required Widget child, EdgeInsets padding = const EdgeInsets.all(18), Color? color, Border? border}) => Container(
          width: double.infinity,
          padding: padding,
          decoration: BoxDecoration(
            color: color ?? a.surface,
            border: border ?? Border.all(color: a.line),
            borderRadius: BorderRadius.circular(a.radiusLg),
            boxShadow: a.cardShadow,
          ),
          child: child,
        );
    Widget title(String text, [double bottom = 12]) => Padding(padding: EdgeInsets.only(bottom: bottom), child: Text(text, style: px(14.5, weight: FontWeight.w700, color: a.ink)));
    Widget exportButton({required bool solid, required String label, required Widget icon, required VoidCallback onTap}) => AButton(
          variant: solid ? AButtonVariant.pillSolid : AButtonVariant.pillSoft,
          block: true,
          onPressed: !canExport || _generating ? null : onTap,
          leading: icon,
          child: Text(label),
        );

    final sections = <Widget>[
      card(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              AListIcon(background: a.peach1, child: AIcon(AIcons.fileCheck2, size: 23, color: a.accentInk)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(userName, style: px(18, weight: FontWeight.w800, color: a.ink, height: 28 / 18)),
                  Text(stageTitle, style: px(14, color: a.inkSoft, height: 20 / 14)),
                ]),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Semantics(
              label: tr('report_period', 'Hesabat dövrü'),
              child: IgnorePointer(
                ignoring: _generating,
                child: ATabs(
                  labels: [for (final p in periods) p.$2],
                  active: periods.indexWhere((p) => p.$1 == _period),
                  onSelect: (i) => setState(() => _period = periods[i].$1),
                ),
              ),
            ),
          ),
          if (lifeStage == 'mommy' && childrenView.children.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(tr('report_choose_child', 'Hesabat üçün körpə'), style: px(14, weight: FontWeight.w600, color: a.ink)),
                const SizedBox(height: 8),
                IgnorePointer(
                  ignoring: _generating,
                  child: ShadSelect<String>(
                    value: child?.id,
                    options: [for (final c in childrenView.children) (c.id, Text(c.name))],
                    onChanged: (id) => ref.read(childrenActionsProvider).setSelectedChild(childrenView.children.where((c) => c.id == id).firstOrNull),
                  ),
                ),
              ]),
            ),
          if (presentation?.dateRangeLabel != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                AIcon(AIcons.calendar, size: 14, color: a.inkSoft),
                const SizedBox(width: 8),
                Expanded(child: Text(presentation!.dateRangeLabel!, style: px(12, color: a.inkSoft, height: 16 / 12))),
              ]),
            ),
          Row(children: [
            Expanded(
              child: exportButton(
                solid: true,
                label: tr('report_download_pdf', 'PDF yüklə'),
                icon: _generating ? const ALoader(size: 17, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.download, size: 17),
                onTap: () => unawaited(exportReport('download')),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: exportButton(
                solid: false,
                label: tr('report_share_email', 'Paylaş / e-poçt'),
                icon: const AIcon(AIcons.share2, size: 17),
                onTap: () => unawaited(exportReport('share')),
              ),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: tr('report_export_hint', 'PDF-ni yükləyin və ya paylaşım menyusu ilə həkiminizə göndərin.')),
                if (!isPremium) const TextSpan(text: ' Premium', style: TextStyle(fontWeight: FontWeight.w700)),
              ]),
              style: px(12, color: a.inkSoft, height: 1.625),
            ),
          ),
        ]),
      ),
      if (dataError)
        Semantics(
          liveRegion: true,
          child: card(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('report_data_error', 'Məlumatlar tam yüklənmədi. Natamam hesabat yaratmamaq üçün yenidən yoxlayın.'), style: px(14, color: a.ink, height: 20 / 14)),
              const SizedBox(height: 12),
              AButton(
                variant: AButtonVariant.pillSoft,
                onPressed: () {
                  if (report.isError) unawaited(ref.read(healthReportQuery(args).notifier).refetch());
                  if (extras.isError) unawaited(ref.read(doctorReportExtrasQuery(args).notifier).refetch());
                  if (vaccineSchedule.isError) unawaited(ref.read(vaccineScheduleQuery(vaccineCountry).notifier).refetch());
                  if (vaccineLogs.isError) unawaited(ref.read(childVaccinationsQuery(vaccineChild?.id).notifier).refetch());
                },
                leading: const AIcon(AIcons.refreshCw, size: 16),
                child: Text(tr('community_retry', 'Yenidən yoxla')),
              ),
            ]),
          ),
        ),
      if (loading)
        Semantics(
          liveRegion: true,
          child: card(
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              ALoader(size: 20, color: a.ink),
              const SizedBox(width: 8),
              Flexible(child: Text(tr('report_loading_data', 'Qeydlər hazırlanır...'), style: px(14, color: a.ink))),
            ]),
          ),
        ),
      if (stageRows.isNotEmpty) card(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [title(tr('pdf_section_basics', 'Cari məlumatlar'), 16), rows(stageRows)])),
      if (presentation != null && !dataError) ...[
        card(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            title(tr('pdf_section_trends', 'Sağlamlıq göstəriciləri')),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                '${presentation.coverage?.records} ${tr('report_records', 'qeyd')} · ${presentation.coverage?.recordedDays} ${tr('report_days_recorded', 'qeydli gün')}',
                style: px(12, color: a.inkSoft, height: 16 / 12),
              ),
            ),
            for (var i = 0; i < presentation.trends.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(presentation.trends[i].label, style: px(12, color: a.inkSoft, height: 16 / 12)),
                  const SizedBox(height: 4),
                  Wrap(alignment: WrapAlignment.spaceBetween, spacing: 8, runSpacing: 8, children: [
                    Text(presentation.trends[i].value, style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14)),
                    Text(presentation.trends[i].trend, style: px(12, color: a.inkSoft, height: 16 / 12)),
                  ]),
                ]),
              ),
            ],
          ]),
        ),
        if (presentation.babyCareRows?.isNotEmpty ?? false)
          card(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              title(tr('pdf_section_babycare', 'Körpə qulluğu')),
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  tr('pdf_logged_days_note', 'Ortalamalar yalnız müvafiq qeydin olduğu günlərə əsaslanır. Davam edən yuxu intervalları yuxu müddətinə daxil edilmir.'),
                  style: px(12, color: a.inkSoft, height: 1.625),
                ),
              ),
              rows(presentation.babyCareRows!),
            ]),
          ),
        if (presentation.sections?.any((s) => s.flag != null) ?? false)
          Semantics(
            container: true,
            child: card(
              color: a.pink1,
              border: Border.all(color: a.pinkInk, width: 1.5),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final s in presentation.sections!.where((s) => s.flag != null)) Text(s.flag!, style: px(14, weight: FontWeight.w700, color: a.pinkInk, height: 20 / 14)),
              ]),
            ),
          ),
        card(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            title(tr('report_pdf_contents', 'PDF-yə daxil ediləcək cədvəllər')),
            rows([
              ReportRow(tr('pdf_weight_history', 'Çəki qeydləri'), '${presentation.weightSeries?.length ?? 0}'),
              ReportRow(tr('pdf_section_bp_period', 'Qan təzyiqi'), '${presentation.bpRows?.length ?? 0}'),
              for (final s in presentation.sections ?? const <ReportSection>[])
                ReportRow(s.title, '${(s.table?.rows.length ?? 0) != 0 ? s.table!.rows.length : (s.rows?.length ?? 0)}'),
              for (final h in presentation.historyTables ?? const <ReportTable>[])
                if (h.rows.isNotEmpty) ReportRow(h.title, '${h.rows.length}'),
            ]),
            if (hasEpds)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Semantics(
                  checked: _includeEpds,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _generating ? null : () => setState(() => _includeEpds = !_includeEpds),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: Checkbox(value: _includeEpds, onChanged: _generating ? null : (v) => setState(() => _includeEpds = v ?? false)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(tr('report_include_epds', 'EPDS (əhval skrininqi) nəticələrini PDF-ə daxil et'), style: px(14, color: a.ink, height: 20 / 14))),
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      ],
      card(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          title(tr('doctorreportscreen_hekim_ucun_qeydler_052b91', 'Həkim üçün Qeydlər')),
          Container(
            constraints: const BoxConstraints(minHeight: 120),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
            child: Material(
              type: MaterialType.transparency,
              child: TextField(
                controller: _notes,
                enabled: !_generating,
                minLines: 5,
                maxLines: 12,
                onChanged: (_) => setState(() {}),
                style: px(16, color: a.ink, height: 1.4),
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  hintText: tr('pdf_notes_ph', 'Həkiminiz üçün əlavə qeydlər yazın...'),
                  hintStyle: px(16, color: a.inkFaint, height: 1.4),
                  semanticCounterText: tr('doctorreportscreen_hekim_ucun_qeydler_052b91', 'Həkim üçün Qeydlər'),
                ),
              ),
            ),
          ),
        ]),
      ),
      exportButton(
        solid: true,
        label: _generating
            ? tr('doctorreportscreen_hesabat_hazirlanir_37c97d', 'Hesabat hazırlanır...')
            : tr('doctorreportscreen_tam_hesabati_yukle_pdf_108b98', 'Tam Hesabatı Yüklə (PDF)'),
        icon: _generating ? const ALoader(size: 18, color: Color(0xFFFFFFFF)) : const AIcon(AIcons.fileText, size: 18),
        onTap: () => unawaited(exportReport('download')),
      ),
    ];

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 112),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ATopbar(onBack: widget.onBack, eyebrow: tr('report_visit_ready', 'Həkim görüşünə hazırlıq'), title: tr('doctorreportscreen_hekim_hesabati_0525fc', 'Həkim Hesabatı'), titleSize: 18),
            for (var i = 0; i < sections.length; i++) ...[if (i > 0) const SizedBox(height: 16), sections[i]],
          ]),
        ),
      ),
    );
  }
}
