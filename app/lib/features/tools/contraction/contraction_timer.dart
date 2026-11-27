// Ported from: src/components/tools/ContractionTimer.tsx
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/labor/labor_utils.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../legal/medical_disclaimer.dart' show emergencyNumberProvider;
import '../../settings/ui/settings_ui.dart' show px, todayInfoEyebrow, showShadDialog, ShadDialogFrame, shadTitle, shadDescription;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ports.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import '../pregnancy_common/tool_live_timer.dart';
import 'contractions.dart';

class ContractionTimer extends ConsumerStatefulWidget {
  const ContractionTimer({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<ContractionTimer> createState() => _ContractionTimerState();
}

class _ContractionTimerState extends ConsumerState<ContractionTimer> {
  late ContractionTimerState _timer;
  int _now = DomainClock.nowMs();
  bool _stopping = false;
  Timer? _tick;
  String? _userId;
  late final ContractionLiveTimerSync _live = ContractionLiveTimerSync(ref.read(toolLiveTimerProvider));

  @override
  void initState() {
    super.initState();
    _userId = ref.read(authUserProvider)?.id;
    _timer = loadContractionTimerState(ref.read(localStoreProvider), _userId);
    _syncTick();
  }

  @override
  void dispose() {
    _tick?.cancel();
    _live.dispose();
    super.dispose();
  }

  bool get _isActive => _timer.activeStart != null;

  void _syncTick() {
    if (_isActive && _tick == null) {
      _now = DomainClock.nowMs();
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _now = DomainClock.nowMs());
      });
    } else if (!_isActive && _tick != null) {
      _tick!.cancel();
      _tick = null;
    }
  }

  void _setTimer(ContractionTimerState next) {
    setState(() => _timer = next);
    saveContractionTimerState(ref.read(localStoreProvider), _userId, next);
    _syncTick();
  }

  static String _formatTime(num seconds) {
    final s = seconds.toInt();
    return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  }

  ContractionToast _toast(BuildContext context) {
    final host = AToastHost.of(context);
    return ({required title, description, destructive = false}) => host.show(title: title, description: description, destructive: destructive);
  }

  void _handleStart() {
    unawaited(ref.read(pregnancyHapticsProvider).medium());
    final at = DomainClock.nowMs();
    _now = at;
    _setTimer(ContractionTimerState(activeStart: at, lastStart: _timer.lastStart, lastEnd: _timer.lastEnd));
  }

  Future<void> _handleStop(List<Contraction> contractions) async {
    final startedAt = _timer.activeStart;
    if (startedAt == null || _stopping) return;
    unawaited(ref.read(pregnancyHapticsProvider).heavy());
    final endedAt = DomainClock.nowMs();
    final duration = jsRoundInt((endedAt - startedAt) / 1000).clamp(0, 1 << 31);
    // Previous start: the persisted one or the newest saved/queued contraction.
    final newestListed = contractions.isNotEmpty ? jsDateParseMs(contractions[0].startTime) : null;
    final candidates = [?_timer.lastStart, ?newestListed];
    final previousStart = candidates.isEmpty ? null : candidates.reduce((a, b) => a > b ? a : b);
    final interval = startToStartSeconds(previousStart, startedAt);
    _setTimer(ContractionTimerState(lastStart: startedAt, lastEnd: endedAt));
    _stopping = true;
    final toast = _toast(context);
    try {
      await ref.read(contractionsProvider.notifier).addContraction(duration, interval, startedAt: startedAt, toast: toast);
    } finally {
      _stopping = false;
    }
  }

  Future<void> _confirmClear() async {
    final toast = _toast(context);
    final ok = await showShadDialog<bool>(
      context,
      builder: (ctx) {
        final s = ctx.tokens.shadcn;
        return ShadDialogFrame(maxWidth: 384, inset: 16, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(tr('contraction_clear_title', 'Bütün sancılar silinsin?'), style: shadTitle(ctx)),
            const SizedBox(height: 8),
            Text(tr('contraction_clear_desc', 'Bütün sancı tarixçəsi silinəcək. Bunu geri qaytarmaq olmur.'), style: shadDescription(ctx)),
          ]),
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            GestureDetector(
              key: const ValueKey('contraction-clear-confirm'),
              onTap: () => Navigator.of(ctx).pop(true),
              child: Container(
                height: 40,
                alignment: Alignment.center,
                // `className="bg-red-500"` (Tailwind red-500)
                decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(12)),
                child: Text(tr('common_sil', 'Sil'), style: px(14, weight: FontWeight.w500, color: const Color(0xFFFFFFFF))),
              ),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => Navigator.of(ctx).pop(false),
              child: Container(
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: s.background, borderRadius: BorderRadius.circular(12), border: Border.all(color: s.input)),
                child: Text(tr('common_legv_et', 'Ləğv et'), style: px(14, weight: FontWeight.w500, color: s.foreground)),
              ),
            ),
          ]),
        ]);
      },
    );
    if (ok != true || !mounted) return;
    _setTimer(ContractionTimerState(activeStart: _timer.activeStart));
    await ref.read(contractionsProvider.notifier).clearAll(toast: toast);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final userId = ref.watch(authUserProvider)?.id;
    if (userId != _userId) {
      _userId = userId;
      _timer = loadContractionTimerState(ref.read(localStoreProvider), userId);
      _syncTick();
    }
    final emergency = ref.watch(emergencyNumberProvider);
    ref.watch(contractionsProvider);
    final controller = ref.read(contractionsProvider.notifier);
    final contractions = controller.contractions;
    final stats = controller.stats(contractions);
    controller.maybeNotify511(stats.is511);
    _live.update(activeStart: _timer.activeStart, lastEnd: _timer.lastEnd, enabled: userId != null);
    final currentDuration = _isActive ? ((_now - _timer.activeStart!) ~/ 1000).clamp(0, 1 << 31) : 0;

    TextSpan bold(String s) => TextSpan(text: s, style: const TextStyle(fontWeight: FontWeight.w800));

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: tr('contractiontimer_5_1_1_qaydasi_a3c5d3', '5-1-1 Qaydası'),
          title: tr('contractiontimer_sanci_olcen_67d681', 'Sancı Ölçən'),
          actions: [
            if (contractions.isNotEmpty)
              PTap(
                scale: 0.9,
                semanticLabel: tr('contraction_clear_title', 'Bütün sancılar silinsin?'),
                onTap: _confirmClear,
                child: Container(
                  key: const ValueKey('contraction-clear'),
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(12)),
                  child: AIcon(AIcons.trash2, size: 15, strokeWidth: 2, color: a.pinkInk),
                ),
              ),
          ],
        ),
        if (stats.is511)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: PAlertCard(
              eyebrow: tr('contractiontimer_xestexanaya_getme_vaxti_780dba', 'Xəstəxanaya getmə vaxtı!'),
              text: tr('contractiontimer_5_1_1_qaydasi_sancilar_5_deqiqeden_bir_1_c1c5ce', '5-1-1 qaydası: Sancılar 5 dəqiqədən bir, 1 dəqiqə davam edir'),
            ),
          ),
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                      upperCss(_isActive ? tr('contractiontimer_sanci_muddeti_0d04f4', 'Sancı müddəti') : tr('contractiontimer_hazir_3ae38e', 'Hazır')),
                      style: todayInfoEyebrow(context)),
                ),
                Text(
                  _formatTime(currentDuration),
                  key: const ValueKey('contraction-duration'),
                  style: x
                      .heading(px(44, weight: FontWeight.w800, color: _isActive ? a.peach2 : a.ink, height: 1.3))
                      .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                ),
              ]),
            ),
            if (!_isActive)
              PCtaButton(
                key: const ValueKey('contraction-start'),
                height: 48,
                leading: AIcons.play,
                onTap: _handleStart,
                child: Text(tr('contractiontimer_sanci_basladi_d99102', 'Sancı başladı')),
              )
            else
              PCtaButton(
                key: const ValueKey('contraction-stop'),
                height: 48,
                background: a.pink2,
                leading: AIcons.square,
                onTap: () => _handleStop(contractions),
                child: Text(tr('contractiontimer_sanci_bitdi_c1b3e1', 'Sancı bitdi')),
              ),
          ]),
        ),
        const SizedBox(height: 12),
        IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(
              child: _StatTile(
                background: a.blue1,
                labelColor: a.blueInk,
                label: tr('contractiontimer_ort_muddet_b77c4e', 'Ort. Müddət'),
                value: _formatTime(stats.avgDuration),
                hint: tr('contractiontimer_hedef_1_deq_6ce02e', 'Hədəf: ~1 dəq'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _StatTile(
                background: a.lav1,
                labelColor: a.lavInk,
                label: tr('contractiontimer_ort_araliq_711af3', 'Ort. Aralıq'),
                value: _formatTime(stats.avgInterval),
                hint: tr('contractiontimer_hedef_5_deq_b2dc81', 'Hədəf: ~5 dəq'),
              ),
            ),
          ]),
        ),
        PInfoTip(
          marginTop: 12,
          leading: const Text('💡', style: TextStyle(fontSize: 15, height: 1)),
          child: Text.rich(TextSpan(children: [
            bold('${tr('contractiontimer_5_1_1_qaydasi_a3c5d3', '5-1-1 Qaydası')}:'),
            TextSpan(text: ' ${tr('contractiontimer_sancilar_9b16c7', 'Sancılar')} '),
            bold(tr('contractiontimer_5_deqiqe_ad05bb', '5 dəqiqə')),
            TextSpan(text: ' ${tr('contractiontimer_araliginda_24710a', 'aralığında,')} '),
            bold(tr('contractiontimer_1_deqiqe_a187ac', '1 dəqiqə')),
            TextSpan(text: ' ${tr('contractiontimer_davam_ederse_ve_bu_7029f5', 'davam edərsə və bu')} '),
            bold(tr('contractiontimer_1_saat_hardcoded', '1 saat')),
            TextSpan(text: ' ${tr('contractiontimer_boyunca_davam_ederse_xestexana_2b067a', 'boyunca davam edərsə, xəstəxanaya getmə vaxtıdır.')}'),
          ])),
        ),
        Container(
          margin: const EdgeInsets.only(top: 12),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(a.radiusLg), boxShadow: a.cardShadow),
          child: Row(children: [
            Expanded(
              child: Text(
                tr('contraction_call_now_guidance',
                    'Suyunuz gəlsə, qanaxma olsa, sancılar 37 həftədən əvvəl başlasa, körpə az hərəkət etsə və ya daimi şiddətli ağrı olsa, dərhal doğum evinizə zəng edin.'),
                style: x.aListSub.copyWith(color: a.pinkInk),
              ),
            ),
            const SizedBox(width: 10),
            Semantics(
              label: formatTr('weaning_call_emergency', 'Təcili yardım: {emergency}', {'emergency': emergency}),
              child: PCtaButton(
                block: false,
                height: 34,
                background: a.pink2,
                leading: AIcons.phone,
                onTap: () => ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
                child: Text(emergency, style: const TextStyle(fontSize: 12)),
              ),
            ),
          ]),
        ),
        if (contractions.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 22, bottom: 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('${tr('contractiontimer_sancilar_6f1b69', 'Sancılar (')}${contractions.length})', style: x.aSectionTitle.copyWith(fontSize: 15)),
              ),
              ACard(
                variant: ACardVariant.list,
                child: Column(children: [
                  for (var i = 0; i < contractions.length && i < 10; i++) _row(context, contractions, i),
                ]),
              ),
            ]),
          ),
      ]),
    );
  }

  Widget _row(BuildContext context, List<Contraction> list, int index) {
    final a = context.a;
    final x = context.aText;
    final c = list[index];
    final interval = c.intervalSeconds;
    return PListRow(
      first: index == 0,
      leading: PListIcon(
        background: a.surfaceSoft,
        child: Text('#${list.length - index}', style: px(12, weight: FontWeight.w800, color: a.inkSoft)),
      ),
      body: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, children: [
          Text('${_formatTime(c.durationSeconds)} ${tr('contractiontimer_muddet_a5b45d', 'müddət')}', style: x.aListTitle),
          if (c.pending)
            PTag(
              background: a.yellow1,
              color: a.warnInk,
              fontSize: 10,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                AIcon(AIcons.cloudOff, size: 10, strokeWidth: 2.4, color: a.warnInk),
                const SizedBox(width: 3),
                Flexible(child: Text(tr('contraction_pending_sync', 'Sinxronlaşma gözlənilir'), overflow: TextOverflow.ellipsis)),
              ]),
            ),
        ]),
        const SizedBox(height: 2),
        Text('${formatDateAz(c.startTime)}, ${formatTimeAz(c.startTime)}', style: x.aListSub),
      ]),
      trailing: interval != null && interval != 0
          ? Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
              Text(_formatTime(interval), style: x.aListValue),
              Text(tr('contractiontimer_araliq_05bea1', 'aralıq'), style: x.aListTime),
            ])
          : null,
    );
  }
}

/// `.a-stat-tile` with an inline background: label (inline colour), value, hint.
class _StatTile extends StatelessWidget {
  const _StatTile({required this.background, required this.labelColor, required this.label, required this.value, required this.hint});
  final Color background;
  final Color labelColor;
  final String label;
  final String value;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final labelStyle = px(10, weight: FontWeight.w700, color: a.inkSoft);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: labelStyle.copyWith(color: labelColor)),
        Padding(padding: const EdgeInsets.only(top: 1), child: Text(value, style: px(14, weight: FontWeight.w800, color: a.ink))),
        Text(hint, style: labelStyle),
      ]),
    );
  }
}
