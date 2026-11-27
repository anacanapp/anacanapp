// Ported from: src/components/mommy/BabyCrisisWidget.tsx, src/lib/count-plural.ts (weekOrdinal)
//
// "Kriz Təqvimi" (wonder weeks): active crisis card with progress, or the next two upcoming crises; tap opens the
// full timeline sheet; a timeline item opens the detail sheet. Hidden while loading or without data. The home
// only mounts it while `floor(ageInDays / 7) <= 75`.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../baby/hooks/baby_services.dart';
import '../../baby/hooks/use_content_queries.dart';
import 'mommy_ui.dart';

/// `weekOrdinal(week)`.
String weekOrdinal(int week) => formatTr('ordinal_week_label', '{week}. həftə', {'week': week});

class _Severity {
  const _Severity(this.gradient, this.bg, this.bgDark, this.border, this.borderDark, this.text, this.textDark, this.label);
  final List<Color> gradient;
  final Color bg, bgDark, border, borderDark, text, textDark;
  final String label;
}

/// `severityConfig` (Tailwind palette: amber / orange / rose).
_Severity _severity(String severity) => switch (severity) {
      'medium' => _Severity([TwColors.orange400, TwColors.amber500], TwColors.orange50, TwColors.orange500.withValues(alpha: 0.1),
          TwColors.orange200, TwColors.orange500.withValues(alpha: 0.3), TwColors.orange700, TwColors.orange400, tr('babycrisiswidget_medium', 'Orta')),
      'intense' => _Severity([TwColors.rose400, TwColors.red500], TwColors.rose50, TwColors.rose500.withValues(alpha: 0.1), TwColors.rose200,
          TwColors.rose500.withValues(alpha: 0.3), TwColors.rose700, TwColors.rose400, tr('babycrisiswidget_i_ntensiv_45a63b', 'İntensiv')),
      _ => _Severity([TwColors.amber400, TwColors.yellow500], TwColors.amber50, TwColors.amber500.withValues(alpha: 0.1), TwColors.amber200,
          TwColors.amber500.withValues(alpha: 0.3), TwColors.amber700, TwColors.amber400, tr('babycrisiswidget_yungul_2a8010', 'Yüngül')),
    };

String severityTagClass(String severity) => severity == 'intense' ? 'intensive' : (severity == 'medium' ? 'medium' : 'mild');

String _weeksRange(BabyCrisisPeriod c) =>
    tr('babycrisiswidget_weeks_range', 'Həftə {s}-{e}').replaceFirst('{s}', '${c.weekStart}').replaceFirst('{e}', '${c.weekEnd}');

/// `getProgressInCrisis()`.
double crisisProgress(BabyCrisisPeriod c, int babyAgeWeeks) {
  final total = c.weekEnd - c.weekStart + 1;
  final current = babyAgeWeeks - c.weekStart + 1;
  final p = current / total * 100;
  return p > 100 ? 100 : p;
}

class BabyCrisisWidget extends ConsumerWidget {
  const BabyCrisisWidget({super.key, required this.babyAgeWeeks, required this.babyName});
  final int babyAgeWeeks;
  final String babyName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appLanguageProvider);
    final q = ref.watch(babyCrisisPeriodsQuery);
    final all = q.data ?? const <BabyCrisisPeriod>[];
    if (q.isLoading || all.isEmpty) return const SizedBox.shrink();
    final current = currentBabyCrises(all, babyAgeWeeks);
    final upcoming = upcomingBabyCrises(all, babyAgeWeeks, 2);
    final inCrisis = current.isNotEmpty;
    final t = context.a;
    final services = ref.read(babyCareServicesProvider);

    Future<void> openCalendar() async {
      await services.hapticLight();
      if (!context.mounted) return;
      await Navigator.of(context).push(_SheetRoute(
        builder: (_) => _CrisisCalendarSheet(all: all, babyAgeWeeks: babyAgeWeeks, babyName: babyName, services: services),
        maxHeightFactor: 0.9,
      ));
    }

    final link = inCrisis
        ? tr('babycrisiswidget_active_crisis', 'Aktiv Kriz Dövrü')
        : upcoming.isNotEmpty
            ? tr('babycrisiswidget_next_week', 'Növbəti: {n}. həftə').replaceFirst('{n}', '${upcoming.first.weekStart}')
            : tr('babycrisiswidget_no_upcoming', 'Yaxınlaşan kriz yoxdur');

    Widget body;
    if (inCrisis) {
      final c = current.first;
      final progress = crisisProgress(c, babyAgeWeeks);
      body = GestureDetector(
        onTap: openCalendar,
        child: AFadeIn(
          child: ACard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ARankRow(first: true, padding: const EdgeInsets.only(bottom: 4), children: [
                _Breathing(child: ARankAvatar(background: t.peach1, fontSize: 20, child: Text(c.emoji))),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      AIcon(AIcons.triangleAlert, size: 11, color: t.peach2),
                      const SizedBox(width: 5),
                      Flexible(child: Text(upper(tr('babycrisiswidget_active_crisis', 'Aktiv Kriz Dövrü')), style: aTodayInfoEyebrow(t))),
                    ]),
                    Padding(padding: const EdgeInsets.only(top: 3), child: Text(c.title, style: ARankText.title(t))),
                  ]),
                ),
                ARankTag(label: _severity(c.severity).label, severityClass: severityTagClass(c.severity)),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 5),
                    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text(_weeksRange(c), style: context.aText.aListSub),
                      Text('${progress.round()}${tr('babycrisiswidget_pct_done', '% keçdi')}',
                          style: context.aText.aListValue.copyWith(color: t.accentInk)),
                    ]),
                  ),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: progress),
                    duration: const Duration(seconds: 1),
                    curve: ACurves.cssEaseOut,
                    builder: (context, v, _) => AInlineBar(percent: v, marginTop: 0),
                  ),
                ]),
              ),
              if (c.description != null)
                Text(c.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.aText.aCtaText),
              if (c.symptoms != null && c.symptoms!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final s in c.symptoms!.take(3)) ATag(child: Text(s)),
                    if (c.symptoms!.length > 3) ATag(background: const Color(0x00000000), child: Text('+${c.symptoms!.length - 3}')),
                  ]),
                ),
            ]),
          ),
        ),
      );
    } else {
      body = GestureDetector(
        onTap: openCalendar,
        child: AFadeIn(
          child: ACard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
            child: Column(
              children: upcoming.isNotEmpty
                  ? [
                      for (var i = 0; i < upcoming.length; i++)
                        ARankRow(first: i == 0, children: [
                          ARankAvatar(background: t.peach1, foreground: t.accentInk, child: const AIcon(AIcons.calendar, size: 17)),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${upcoming[i].emoji} ${upcoming[i].title}',
                                  maxLines: 1, overflow: TextOverflow.ellipsis, softWrap: false, style: ARankText.title(t)),
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  '${_weeksRange(upcoming[i])} · ${upcoming[i].weekStart - babyAgeWeeks} ${tr('babycrisiswidget_week_unit_later', 'həftə sonra')}',
                                  style: ARankText.sub(t),
                                ),
                              ),
                            ]),
                          ),
                          ARankTag(label: _severity(upcoming[i].severity).label, severityClass: severityTagClass(upcoming[i].severity)),
                        ]),
                    ]
                  : [
                      ARankRow(first: true, children: [
                        ARankAvatar(background: t.green1, foreground: t.green2, child: const AIcon(AIcons.calendar, size: 17)),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(tr('babycrisiswidget_kriz_teqvimi_aa2ea5', 'Kriz Təqvimi'), style: ARankText.title(t)),
                            Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(tr('babycrisiswidget_no_upcoming', 'Yaxınlaşan kriz yoxdur'), style: ARankText.sub(t))),
                          ]),
                        ),
                        AIcon(AIcons.chevronRight, size: 16, color: t.inkFaint, mirrorInRtl: true),
                      ]),
                    ],
            ),
          ),
        ),
      );
    }

    return FramerEnter(
      delay: const Duration(milliseconds: 350),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ASectionHead(title: tr('babycrisiswidget_kriz_teqvimi_aa2ea5', 'Kriz Təqvimi'), link: ASectionLinkText(link)),
        body,
      ]),
    );
  }
}

/// framer `animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: 2 }}`.
class _Breathing extends StatefulWidget {
  const _Breathing({required this.child});
  final Widget child;
  @override
  State<_Breathing> createState() => _BreathingState();
}

class _BreathingState extends State<_Breathing> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(count: 3);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) {
          final v = _c.value < 0.5 ? _c.value * 2 : (1 - _c.value) * 2;
          return Transform.scale(scale: 1 + 0.08 * ACurves.framerDefault.transform(v), child: child);
        },
      );
}

/// Bottom sheet: black/60 backdrop fading 300 ms, panel `y: 100% → 0` spring (stiffness 300, damping 25).
class _SheetRoute extends PopupRoute<void> {
  _SheetRoute({required this.builder, required this.maxHeightFactor, this.bottomMargin = 0});
  final WidgetBuilder builder;
  final double maxHeightFactor;
  final double bottomMargin;

  @override
  Color? get barrierColor => const Color(0x99000000);
  @override
  bool get barrierDismissible => true;
  @override
  String? get barrierLabel => 'close';
  @override
  Duration get transitionDuration => const Duration(milliseconds: 450);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) {
    final h = MediaQuery.sizeOf(context).height;
    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomMargin),
        child: ConstrainedBox(constraints: BoxConstraints(maxHeight: h * maxHeightFactor), child: Builder(builder: builder)),
      ),
    );
  }

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    final curved = CurvedAnimation(parent: animation, curve: ACurves.spring, reverseCurve: ACurves.cssEase);
    return SlideTransition(position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(curved), child: child);
  }
}

class _CrisisCalendarSheet extends StatelessWidget {
  const _CrisisCalendarSheet({required this.all, required this.babyAgeWeeks, required this.babyName, required this.services});
  final List<BabyCrisisPeriod> all;
  final int babyAgeWeeks;
  final String babyName;
  final BabyCareServices services;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final s = tokens.shadcn;
    final dark = tokens.isDark;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: s.background, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
      clipBehavior: Clip.antiAlias,
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: s.background, border: Border(bottom: BorderSide(color: s.border.withValues(alpha: 0.5)))),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr('babycrisiswidget_kriz_teqvimi_aa2ea5', 'Kriz Təqvimi'),
                    style: TextStyle(fontSize: 20, height: 1.4, fontWeight: FontWeight.w700, color: s.foreground)),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text('$babyName • ${weekOrdinal(babyAgeWeeks)}', style: TextStyle(fontSize: 12, height: 1.33, color: s.mutedForeground)),
                ),
              ]),
            ),
            PressScale(
              scale: 0.9,
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: s.muted, shape: BoxShape.circle),
                child: Center(child: AIcon(AIcons.x, size: 20, color: s.foreground)),
              ),
            ),
          ]),
        ),
        Flexible(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset + 96),
            child: Stack(children: [
              PositionedDirectional(start: 19, top: 0, bottom: 0, child: Container(width: 2, color: s.border)),
              Column(children: [
                for (var i = 0; i < all.length; i++) ...[
                  if (i > 0) const SizedBox(height: 16),
                  FramerEnter(
                    y: 0,
                    delay: Duration(milliseconds: (i * 50).clamp(0, 300)),
                    child: _TimelineItem(
                      crisis: all[i],
                      babyAgeWeeks: babyAgeWeeks,
                      dark: dark,
                      onTap: () async {
                        await services.hapticLight();
                        if (!context.mounted) return;
                        await Navigator.of(context).push(_SheetRoute(
                          builder: (_) => _CrisisDetailSheet(crisis: all[i]),
                          maxHeightFactor: 0.85,
                          bottomMargin: MediaQuery.paddingOf(context).bottom + 72,
                        ));
                      },
                    ),
                  ),
                ],
              ]),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({required this.crisis, required this.babyAgeWeeks, required this.dark, required this.onTap});
  final BabyCrisisPeriod crisis;
  final int babyAgeWeeks;
  final bool dark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final sev = _severity(crisis.severity);
    final past = babyAgeWeeks > crisis.weekEnd;
    final current = babyAgeWeeks >= crisis.weekStart && babyAgeWeeks <= crisis.weekEnd;
    final textColor = dark ? sev.textDark : sev.text;
    return Stack(children: [
      PositionedDirectional(
        start: 12,
        top: 0,
        child: Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: current ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: sev.gradient) : null,
            color: current ? null : (past ? s.muted : s.muted.withValues(alpha: 0.5)),
            border: !current && !past ? Border.all(color: s.mutedForeground.withValues(alpha: 0.3), width: 2) : null,
            boxShadow: current ? [BoxShadow(color: s.primary.withValues(alpha: 0.2), spreadRadius: 4)] : null,
          ),
          child: past ? Center(child: AIcon(AIcons.check, size: 12, color: s.mutedForeground)) : null,
        ),
      ),
      Padding(
        padding: const EdgeInsetsDirectional.only(start: 48),
        child: Opacity(
          opacity: past && !current ? 0.6 : 1,
          child: PressScale(
            scale: 0.98,
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: current ? (dark ? sev.bgDark : sev.bg) : (past ? s.muted.withValues(alpha: 0.3) : s.card),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: current ? (dark ? sev.borderDark : sev.border) : (past ? s.border.withValues(alpha: 0.3) : s.border.withValues(alpha: 0.5)),
                ),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(crisis.emoji, style: const TextStyle(fontSize: 24, height: 1.33)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(children: [
                        Flexible(
                          child: Text(crisis.title,
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: current ? textColor : s.foreground)),
                        ),
                        if (current) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: dark ? const Color(0x33000000) : const Color(0x80FFFFFF),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(tr('babycrisiswidget_indi', 'İNDİ'), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: textColor)),
                          ),
                        ],
                      ]),
                    ),
                    DefaultTextStyle.merge(
                      style: TextStyle(fontSize: 12, height: 1.33, color: s.mutedForeground),
                      child: Row(children: [
                        AIcon(AIcons.clock, size: 12, color: s.mutedForeground),
                        const SizedBox(width: 8),
                        Text(_weeksRange(crisis)),
                        const SizedBox(width: 8),
                        const Text('•'),
                        const SizedBox(width: 8),
                        Text(sev.label, style: TextStyle(fontWeight: FontWeight.w500, color: textColor)),
                      ]),
                    ),
                    if (current && crisis.description != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(crisis.description!,
                            maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, height: 1.33, color: s.mutedForeground)),
                      ),
                  ]),
                ),
                AIcon(AIcons.chevronRight, size: 20, color: s.mutedForeground, mirrorInRtl: true),
              ]),
            ),
          ),
        ),
      ),
    ]);
  }
}

class _CrisisDetailSheet extends StatelessWidget {
  const _CrisisDetailSheet({required this.crisis});
  final BabyCrisisPeriod crisis;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final s = tokens.shadcn;
    final dark = tokens.isDark;
    final sev = _severity(crisis.severity);
    final textColor = dark ? sev.textDark : sev.text;
    const white = Color(0xFFFFFFFF);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: s.background, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
      clipBehavior: Clip.antiAlias,
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: sev.gradient)),
          child: Stack(children: [
            Row(children: [
              Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(16)),
                child: Text(crisis.emoji, style: const TextStyle(fontSize: 36)),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(crisis.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: white)),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(children: [
                      AIcon(AIcons.clock, size: 14, color: white.withValues(alpha: 0.8)),
                      const SizedBox(width: 8),
                      Text(_weeksRange(crisis), style: TextStyle(fontSize: 14, color: white.withValues(alpha: 0.9))),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(999)),
                        child: Text(sev.label, style: const TextStyle(fontSize: 12, color: white, fontWeight: FontWeight.w500)),
                      ),
                    ]),
                  ),
                ]),
              ),
            ]),
            PositionedDirectional(
              top: 0,
              end: 0,
              child: PressScale(
                scale: 0.9,
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: white.withValues(alpha: 0.3), shape: BoxShape.circle),
                  child: const Center(child: AIcon(AIcons.x, size: 20, color: white)),
                ),
              ),
            ),
          ]),
        ),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (crisis.description != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: s.muted.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(12)),
                  child: Text(crisis.description!, style: TextStyle(fontSize: 14, height: 1.625, color: s.foreground)),
                ),
              if (crisis.symptoms != null && crisis.symptoms!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: dark ? sev.bgDark : sev.bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: dark ? sev.borderDark : sev.border),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(children: [
                        AIcon(AIcons.triangleAlert, size: 16, color: textColor),
                        const SizedBox(width: 8),
                        Text(tr('babycrisiswidget_elamtler', 'Əlamətlər'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor)),
                      ]),
                    ),
                    for (var i = 0; i < crisis.symptoms!.length; i++)
                      Padding(
                        padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Container(
                            margin: const EdgeInsets.only(top: 6),
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(color: textColor, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 8),
                          Expanded(child: Text(crisis.symptoms![i], style: TextStyle(fontSize: 14, color: s.foreground))),
                        ]),
                      ),
                  ]),
                ),
              ],
              if (crisis.tips != null && crisis.tips!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: s.primary.withValues(alpha: dark ? 0.1 : 0.05),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: s.primary.withValues(alpha: 0.2)),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(children: [
                        AIcon(AIcons.lightbulb, size: 16, color: s.primary),
                        const SizedBox(width: 8),
                        Text(tr('babycrisiswidget_tovsiyeler_17a8f7', 'Tövsiyələr'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: s.primary)),
                      ]),
                    ),
                    for (var i = 0; i < crisis.tips!.length; i++)
                      Padding(
                        padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.sparkles, size: 14, color: s.primary)),
                          const SizedBox(width: 8),
                          Expanded(child: Text(crisis.tips![i], style: TextStyle(fontSize: 14, color: s.foreground))),
                        ]),
                      ),
                  ]),
                ),
              ],
            ]),
          ),
        ),
      ]),
    );
  }
}
