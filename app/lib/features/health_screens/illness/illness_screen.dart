// Ported from: src/components/illness/IllnessScreen.tsx (IllnessScreen, StartCard, DoseCard, EntryRow, HistoryRow),
//              src/styles/care.css (.cx-temp, .cx-action, .cx-dose, .cx-dose-ring)
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/health/emergency.dart' show getEmergencyNumber;
import '../../../domain/js_compat.dart';
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../baby/models/child.dart' show Child;
import '../../partner/data/partner_data.dart' show partnerDataProvider;
import '../../partner/partner_ports.dart' show partnerChatSenderProvider;
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, px, shadTitle, showShadDialog, toasts;
import '../../tools/health_common/health_common.dart' show healthLinkLauncherProvider, healthPaywallProvider;
import '../../tools/pregnancy_common/pregnancy_ports.dart' show pregnancyHapticsProvider;
import '../common/care_ui.dart';
import '../common/feature_text.dart';
import '../common/health_format.dart';
import '../common/health_ports.dart';
import '../doctor_report/pdf_report.dart';
import 'illness.dart';
import 'illness_data.dart';
import 'illness_report.dart';
import 'illness_sheets.dart';
import 'temp_chart.dart';

/// `usePartnerData().partnerProfile` as the illness screen reads it (the other parent: the mother for a partner,
/// the linked partner for the mother).
typedef IllnessOtherParent = ({String? userId, String? babyName, String? babyBirthDate});

final illnessOtherParentProvider = Provider.autoDispose<IllnessOtherParent>((ref) {
  final p = ref.watch(partnerDataProvider).partnerProfile;
  return (userId: p == null || p.userId.isEmpty ? null : p.userId, babyName: p?.babyName, babyBirthDate: p?.babyBirthDate);
});

class IllnessScreen extends ConsumerStatefulWidget {
  const IllnessScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<IllnessScreen> createState() => _IllnessScreenState();
}

class _IllnessScreenState extends ConsumerState<IllnessScreen> {
  String? _openId;
  bool _showAll = false;
  IllnessKind _kind = 'fever';
  String? _childId;
  bool _starting = false;
  String _reminderKey = '';

  FeatureText get t => ref.read(illnessTextProvider);

  void _notifyOther(String? actor, String? other, String message) {
    if (actor == null || other == null) return;
    unawaited(ref.read(partnerChatSenderProvider)(actor, other, message).catchError((Object _) {}));
  }

  void _syncReminders(IllnessEpisode viewing, List<IllnessEntry> entries, String childName) {
    final key = '${viewing.id}:${viewing.endedAt}:${entries.map((e) => e.id).join(',')}';
    if (key == _reminderKey) return;
    _reminderKey = key;
    final text = t;
    unawaited(syncDoseReminders(
      ref.read(illnessReminderPlannerProvider),
      viewing,
      entries,
      title: (med) => fill(text.s('notif_title'), {'med': med}),
      body: fill(text.s('notif_body'), {'child': childName.isEmpty ? '👶' : childName}),
    ));
  }

  Future<void> _confirmDelete(IllnessEpisode viewing) async {
    final ok = await showShadDialog<bool>(
      context,
      builder: (ctx) => ShadDialogFrame(radius: 16, inset: 16, children: [
        Text(t.s('delete_confirm'), style: shadTitle(ctx)),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          ShadButton(variant: ShadButtonVariant.outline, onPressed: () => Navigator.of(ctx).pop(false), child: Text(t.s('cancel'))),
          const SizedBox(width: 8),
          ShadButton(variant: ShadButtonVariant.destructive, onPressed: () => Navigator.of(ctx).pop(true), child: Text(t.s('delete'))),
        ]),
      ]),
    );
    if (ok != true) return;
    unawaited(ref.read(illnessActionsProvider).remove(viewing.id).catchError((Object _) {}));
    setState(() => _openId = null);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(illnessTextProvider);
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final isPartner = ref.watch(userStoreProvider.select((s) => s.lifeStage)) == 'partner';
    final childrenView = ref.watch(childrenProvider);
    final other = ref.watch(illnessOtherParentProvider);
    final isPremium = ref.watch(healthScreensIsPremiumProvider);
    final language = ref.watch(appLanguageProvider);
    final locale = getLocaleTag();
    final unit = ref.watch(tempUnitProvider);
    final emergency = getEmergencyNumber(profile?.countryCode);
    final a = context.a;

    final episodesQ = ref.watch(illnessEpisodesQuery);
    final episodes = episodesQ.data ?? const <IllnessEpisode>[];
    IllnessEpisode? byId(String? id) => id == null ? null : episodes.where((e) => e.id == id).firstOrNull;
    final active = byId(_openId) ?? episodes.where((e) => e.endedAt == null || e.endedAt!.isEmpty).firstOrNull;
    final viewing = _openId != null ? byId(_openId) : active;
    final entriesQ = ref.watch(illnessEntriesQuery(viewing?.id));
    final entries = entriesQ.data ?? const <IllnessEntry>[];
    final actions = ref.read(illnessActionsProvider);

    final selectedChild = childrenView.selectedChild;
    _childId ??= selectedChild?.id;
    final children = childrenView.children;
    Child? child;
    if (!isPartner) {
      final wanted = viewing?.childId ?? _childId;
      child = children.where((c) => c.id == wanted).firstOrNull ?? selectedChild;
    }
    final viewingName = viewing?.childName ?? '';
    final childName = viewingName.isNotEmpty
        ? viewingName
        : (child?.name.isNotEmpty ?? false)
            ? child!.name
            : ((isPartner ? other.babyName : profile?.babyName) ?? '');
    final ageMonths = monthsBetween(child?.birthDate ?? (isPartner ? other.babyBirthDate : profile?.babyBirthDate));
    String time(DateTime d) => fmtTime(d, language);
    String dayTime(String iso) => fmtDayMonthShortTime(jsParseDate(iso) ?? DateTime.now(), language);

    // Reminders on this phone for the next doses of the open episode.
    if (viewing != null && !entriesQ.isLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _syncReminders(viewing, entries, childName);
      });
    }

    Future<void> start() async {
      setState(() => _starting = true);
      try {
        final id = await actions.start(_kind, isPartner ? null : child?.id, childName.isEmpty ? null : childName);
        if (!mounted) return;
        setState(() => _openId = id);
        unawaited(ref.read(pregnancyHapticsProvider).medium());
        _notifyOther(user?.id, other.userId,
            fill(t.s('partner_start_msg'), {'child': childName.isEmpty ? '👶' : childName, 'kind': t.at('kinds', _kind) ?? _kind}));
      } catch (_) {
        if (mounted) toasts(this.context).error(t.s('error'));
      } finally {
        if (mounted) setState(() => _starting = false);
      }
    }

    Future<void> sharePdf() async {
      final v = viewing;
      if (v == null) return;
      if (!isPremium) {
        await ref.read(healthPaywallProvider)(context, t.s('premium_pdf'));
        return;
      }
      final toast = toasts(context);
      try {
        final data = buildIllnessReport(t, v, entries,
            childName: childName, language: language, locale: locale, userName: profile?.name ?? '', unit: unit);
        final bytes = await ref.read(doctorReportPdfRendererProvider).render(data);
        await deliverPdf(ref.read(pdfDeliveryPlatformProvider), bytes, 'anacan-${v.kind}-${v.startedAt.length >= 10 ? v.startedAt.substring(0, 10) : v.startedAt}.pdf', 'share');
      } catch (_) {
        toast.error(t.s('error'));
      }
    }

    void call() => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: emergency));

    final ended = viewing != null && viewing.endedAt != null && viewing.endedAt!.isNotEmpty;
    final alerts = viewing != null ? illnessAlerts(viewing.endedAt, entries, ageMonths) : const <IllnessAlert>[];
    final temps = entries.where((e) => e.kind == 'temp' && e.tempC != null).toList();
    final latestTemp = temps.firstOrNull;
    final meds = medStatuses(entries);
    final history = episodes.where((e) => e.id != viewing?.id).toList();

    final body = <Widget>[
      CxHead(
        onBack: _openId != null && ended ? () => setState(() => _openId = null) : widget.onBack,
        eyebrow: childName.isNotEmpty ? '${t.s('title')} · $childName' : t.s('eyebrow'),
        title: viewing != null
            ? '${t.at('kinds', viewing.kind) ?? viewing.kind} · ${fill(t.s('day_n'), {'n': episodeDay(viewing.startedAt, ended ? jsParseDate(viewing.endedAt!) : DateTime.now())})}'
            : t.s('title'),
        trailing: viewing == null
            ? null
            : CxPill(label: ended ? t.s('ended') : t.s('active'), dot: true, background: ended ? null : a.pink1, color: ended ? null : a.pinkInk),
      ),
    ];

    if (episodesQ.isLoading) {
      body.add(Container(height: 220, decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line))));
    } else if (viewing == null) {
      body.add(_StartCard(
        t: t,
        kind: _kind,
        onKind: (k) {
          setState(() => _kind = k);
          unawaited(ref.read(pregnancyHapticsProvider).light());
        },
        childrenList: isPartner ? const [] : children,
        childId: child?.id,
        onChild: (id) => setState(() => _childId = id),
        onStart: start,
        busy: _starting,
        onFlags: () => showCareSheet<void>(context, (_) => FlagsSheet(t: t, emergency: emergency, locale: locale)),
      ));
    } else {
      final v = viewing;
      for (final alert in alerts) {
        final text = switch (alert.kind) {
          'infant' => fill(tempTemplate(t.s('alert_infant')), {'months': alert.months, 'temp': formatTemp(alert.temp!, unit, locale)}),
          'high' => fill(tempTemplate(t.s('alert_high')), {'temp': formatTemp(alert.temp!, unit, locale), 'number': emergency}),
          'breathing' => fill(t.s('alert_breathing'), {'number': emergency}),
          _ => t.s('alert_long'),
        };
        body.add(Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: CxEnter(
            dy: 8,
            child: CxAlert(title: '🚨 $text', children: [
              if (alert.kind != 'long') CxCallButton(label: fill(t.s('call'), {'number': emergency}), onTap: call),
            ]),
          ),
        ));
      }
      final band = latestTemp == null ? null : tempBand(latestTemp.tempC!);
      body.add(CxEnter(
        child: CxCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CxEyebrow(latestTemp != null ? fill(t.s('last_reading'), {'time': dayTime(latestTemp.at)}) : t.s('no_reading')),
                  const SizedBox(height: 6),
                  if (latestTemp != null)
                    Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 10, runSpacing: 6, children: [
                      Text(formatTemp(latestTemp.tempC!, unit, locale), style: px(40, weight: FontWeight.w800, color: bandColor[band], ls: -0.03, height: 1)),
                      CxPill(label: t.at('bands', band!) ?? band, background: bandColor[band]!.withValues(alpha: 0x1F / 255), color: bandColor[band]),
                    ])
                  else
                    Text('—', style: px(40, weight: FontWeight.w800, color: a.inkFaint, ls: -0.03, height: 1)),
                ]),
              ),
              const TempUnitToggle(),
            ]),
            TempChart(
              entries: entries,
              locale: locale,
              language: language,
              unit: unit,
              feverLabel: localizeTempText(t.s('fever_line'), unit, locale),
              emptyLabel: t.s('chart_empty'),
            ),
          ]),
        ),
      ));
      if (!ended) {
        Widget action(String emoji, String label, Color bg, Widget Function() sheet) => Semantics(
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => showCareSheet<void>(context, (_) => sheet()),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
                  child: Column(children: [
                    Container(
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: const Color(0xB3FFFFFF), borderRadius: BorderRadius.circular(14)), // rgba(255,255,255,.7)
                      child: Text(emoji, style: const TextStyle(fontSize: 20, height: 1.2)),
                    ),
                    const SizedBox(height: 6),
                    Text(label, textAlign: TextAlign.center, style: px(13, weight: FontWeight.w800, color: a.ink, height: 1.25)),
                  ]),
                ),
              ),
            );
        Future<void> save(Map<String, Object?> entry) async {
          await actions.add(v.id, entry);
          if (mounted) toasts(this.context).success(t.s('saved'));
        }

        body.add(Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CxGrid(columns: 3, children: [
            action('🌡️', t.s('add_temp'), a.peach1, () => TempSheet(t: t, language: language, locale: locale, onSave: save)),
            action('💊', t.s('add_med'), a.green1, () => MedSheet(
                  t: t,
                  entries: entries,
                  language: language,
                  onSave: (entry) async {
                    await save(entry);
                    final at = jsParseDate('${entry['at']}') ?? DateTime.now();
                    _notifyOther(user?.id, other.userId, fill(t.s('partner_med_msg'), {
                      'child': childName.isEmpty ? '👶' : childName,
                      'med': entry['med_name'],
                      'dose': entry['dose'],
                      'time': time(at),
                    }));
                  },
                )),
            action('🤧', t.s('add_symptom'), a.blue1, () => SymptomSheet(t: t, onSave: save)),
          ]),
        ));
      }
      for (final m in meds) {
        body.add(_DoseCard(key: ValueKey('dose:${m.name}'), t: t, med: m, time: time, done: ended));
      }
      body.add(CxSection(t.s('recent')));
      body.add(CxCard(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
        child: entries.isEmpty
            ? Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(t.s('no_entries'), style: cxSub(context)))
            : CxList(children: [
                for (final e in entries.take(_showAll ? 60 : 6))
                  _EntryRow(
                    t: t,
                    entry: e,
                    when: dayTime(e.at),
                    locale: locale,
                    unit: unit,
                    canDelete: !ended,
                    onDelete: () => unawaited(actions.removeEntry(e.id).catchError((Object _) {})),
                  ),
                if (!_showAll && entries.length > 6)
                  Semantics(
                    button: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _showAll = true),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text('+${entries.length - 6} ⌄', textAlign: TextAlign.center, style: px(14, weight: FontWeight.w800, color: a.accentInk)),
                      ),
                    ),
                  ),
              ]),
      ));
      body.add(Padding(
        padding: const EdgeInsets.only(top: 12),
        child: IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(
              child: _ActionCard(
                gradient: a.alertBg,
                onTap: () => showCareSheet<void>(context, (_) => FlagsSheet(t: t, emergency: emergency, locale: locale)),
                icon: const AIcon(AIcons.shieldAlert, size: 20, color: Color(0xFFC92A2A)), // IllnessScreen inline #c92a2a
                child: Text(t.s('flags_btn'), style: px(13.5, weight: FontWeight.w700, color: a.alertInk, height: 1.3)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ActionCard(
                color: a.blue1,
                onTap: sharePdf,
                icon: AIcon(AIcons.fileText, size: 20, color: a.blueInk),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${t.s('report_title')}${isPremium ? '' : ' ✨'}', style: px(13.5, weight: FontWeight.w700, color: a.blueInk, height: 1.3)),
                  Opacity(
                    opacity: 0.8,
                    child: Text(
                      fill(t.s('report_desc'), {
                        'days': episodeDay(v.startedAt),
                        'temps': temps.length,
                        'meds': entries.where((e) => e.kind == 'med').length,
                      }),
                      style: px(11.5, color: a.blueInk, height: 1.3),
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        ),
      ));
      body.add(CxCard(
        gap: true,
        padding: EdgeInsets.zero,
        clip: true,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (ended)
            CxLink(
              onTap: () => unawaited(actions.close(v.id, false).catchError((Object _) {})),
              children: [CxIcon(emoji: '↩️', color: a.yellow1), Text(t.s('reopen'))],
            )
          else
            CxLink(
              onTap: () {
                unawaited(actions.close(v.id, true).catchError((Object _) {}));
                toasts(context).success(t.s('healed_toast'));
                unawaited(ref.read(pregnancyHapticsProvider).medium());
              },
              children: [
                CxIcon(emoji: '✅', color: a.green1),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t.s('healed')),
                    Text(t.s('healed_desc'), style: cxSub(context)),
                  ]),
                ),
                AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
              ],
            ),
          CxLink(
            topBorder: true,
            onTap: () => _confirmDelete(v),
            children: [
              CxIcon(icon: AIcon(AIcons.trash2, size: 17, color: a.pinkInk), color: a.pink1),
              Text(t.s('delete'), style: px(14, weight: FontWeight.w700, color: a.pinkInk)),
            ],
          ),
        ]),
      ));
    }

    if (history.isNotEmpty) {
      body.add(CxSection(t.s('history')));
      body.add(CxCard(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
        child: CxList(children: [
          for (final e in history) _HistoryRow(t: t, episode: e, language: language, locale: locale, unit: unit, onOpen: () => setState(() => _openId = e.id)),
        ]),
      ));
    }
    body.add(CxDisc(t.s('disclaimer')));
    return CxPage(children: body);
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.icon, required this.child, required this.onTap, this.color, this.gradient});
  final Widget icon;
  final Widget child;
  final VoidCallback onTap;
  final Color? color;
  final Gradient? gradient;
  @override
  Widget build(BuildContext context) => CxCard(
        border: false,
        color: color,
        gradient: gradient,
        onTap: onTap,
        child: Row(children: [icon, const SizedBox(width: 12), Expanded(child: child)]),
      );
}

class _StartCard extends StatelessWidget {
  const _StartCard({
    required this.t,
    required this.kind,
    required this.onKind,
    required this.childrenList,
    required this.childId,
    required this.onChild,
    required this.onStart,
    required this.busy,
    required this.onFlags,
  });
  final FeatureText t;
  final IllnessKind kind;
  final ValueChanged<IllnessKind> onKind;
  final List<Child> childrenList;
  final String? childId;
  final ValueChanged<String> onChild;
  final VoidCallback onStart;
  final bool busy;
  final VoidCallback onFlags;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return CxEnter(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CxCard(
          gradient: LinearGradient(begin: const Alignment(-0.34, -0.94), end: const Alignment(0.34, 0.94), colors: [a.surface, a.surfaceSoft]), // 160deg
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CxIcon(emoji: '🤒', color: a.peach1, size: 52, fontSize: 26),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t.s('start_title'), style: cxTitle(context, 18)),
                  const SizedBox(height: 4),
                  Text(t.s('start_desc'), style: cxSub(context)),
                ]),
              ),
            ]),
            if (childrenList.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: CxChips(children: [
                  for (final c in childrenList)
                    CxChip(label: '${c.avatarEmoji.isEmpty ? '👶' : c.avatarEmoji} ${c.name}', pressed: c.id == childId, onTap: () => onChild(c.id)),
                ]),
              ),
            const SizedBox(height: 16),
            CxField(t.s('choose_kind')),
            CxGrid(columns: 4, children: [
              for (final k in illnessKinds)
                CxTile(
                  emoji: kindEmoji[k]!,
                  label: t.at('kinds', k) ?? k,
                  minHeight: 78,
                  pressed: k == kind,
                  background: k == kind ? a.peach1 : a.surfaceSoft,
                  onTap: () => onKind(k),
                ),
            ]),
            const SizedBox(height: 16),
            AButton(variant: AButtonVariant.accent, block: true, onPressed: busy ? null : onStart, child: Text(t.s('start_btn'))),
          ]),
        ),
        CxCard(
          gap: true,
          border: false,
          gradient: a.alertBg,
          onTap: onFlags,
          child: Row(children: [
            const AIcon(AIcons.shieldAlert, size: 20, color: Color(0xFFC92A2A)), // IllnessScreen inline #c92a2a
            const SizedBox(width: 12),
            Expanded(child: Text(t.s('flags_btn'), style: px(14, weight: FontWeight.w700, color: a.alertInk))),
            AIcon(AIcons.chevronRight, size: 18, color: a.alertInk, mirrorInRtl: true),
          ]),
        ),
      ]),
    );
  }
}

class _DoseCard extends StatefulWidget {
  const _DoseCard({super.key, required this.t, required this.med, required this.time, required this.done});
  final FeatureText t;
  final MedStatus med;
  final String Function(DateTime) time;
  final bool done;
  @override
  State<_DoseCard> createState() => _DoseCardState();
}

class _DoseCardState extends State<_DoseCard> {
  late final Timer _tick = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));

  @override
  void initState() {
    super.initState();
    _tick;
  }

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final med = widget.med;
    final a = context.a;
    final now = DateTime.now().millisecondsSinceEpoch;
    final total = med.nextAt.millisecondsSinceEpoch - med.lastAt.millisecondsSinceEpoch;
    final progress = total <= 0 ? 1.0 : ((now - med.lastAt.millisecondsSinceEpoch) / total).clamp(0.0, 1.0);
    final ready = progress >= 1;
    return CxEnter(
      dy: 10,
      child: CxCard(
        gap: true,
        color: ready ? a.green1 : a.surface,
        child: Row(children: [
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(alignment: Alignment.center, children: [
              CustomPaint(size: const Size(64, 64), painter: _RingPainter(progress: progress, track: a.surfaceSoft, color: ready ? a.green2 : a.peach2)),
              const Text('💊', style: TextStyle(fontSize: 20)),
            ]),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${med.name}${(med.dose ?? '').isNotEmpty ? ' · ${med.dose}' : ''}', style: px(15, weight: FontWeight.w700, color: a.ink)),
              Text(fill(t.s('med_card_last'), {'time': widget.time(med.lastAt), 'h': jsNumberToString(med.intervalHours)}), style: cxSub(context)),
              if (!widget.done)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    Text(
                      ready ? t.s('can_give_now') : '${t.s('next_dose')}: ${fill(t.s('next_dose_at'), {'time': widget.time(med.nextAt)})}',
                      style: px(17, weight: FontWeight.w700, color: ready ? a.greenInk : a.ink, height: 1.3),
                    ),
                    if (med.remind && !ready) CxPill(label: t.s('reminder_on'), leading: const AIcon(AIcons.bell, size: 12)),
                  ]),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// The dose ring (r 27, stroke 7, round cap, starts at 12 o'clock).
class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.track, required this.color});
  final double progress;
  final Color track;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7;
    canvas.drawCircle(c, 27, stroke..color = track);
    if (progress > 0) {
      canvas.drawArc(Rect.fromCircle(center: c, radius: 27), -math.pi / 2, 2 * math.pi * progress, false, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7
        ..strokeCap = StrokeCap.round
        ..color = color);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color || old.track != track;
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({required this.t, required this.entry, required this.when, required this.locale, required this.unit, required this.onDelete, required this.canDelete});
  final FeatureText t;
  final IllnessEntry entry;
  final String when;
  final String locale;
  final TempUnit unit;
  final VoidCallback onDelete;
  final bool canDelete;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final who = entry.byMe ? t.s('by_me') : entry.by == 'mother' ? t.s('by_mother') : entry.by == 'partner' ? t.s('by_partner') : '';
    var icon = '🌡️';
    var bg = a.peach1;
    var title = '';
    var sub = when;
    if (entry.kind == 'temp') {
      title = formatTemp(entry.tempC ?? 0, unit, locale);
      if (entry.tempMethod != null) sub += ' · ${t.at('methods', entry.tempMethod!) ?? entry.tempMethod}';
    } else if (entry.kind == 'med') {
      icon = '💊';
      bg = a.green1;
      title = '${entry.medName}${(entry.dose ?? '').isNotEmpty ? ' ${entry.dose}' : ''}';
    } else {
      icon = '🤧';
      bg = a.blue1;
      final joined = (entry.symptoms ?? const []).map((s) => t.at('symptoms', s) ?? s).join(', ');
      title = joined.isNotEmpty ? joined : ((entry.note ?? '').isNotEmpty ? entry.note! : '—');
    }
    if (who.isNotEmpty) sub += ' · $who';
    return CxLi(
      leading: CxIcon(emoji: icon, color: bg),
      title: title,
      titleColor: entry.kind == 'temp' ? bandColor[tempBand(entry.tempC ?? 0)] : null,
      subs: [sub, if ((entry.note ?? '').isNotEmpty && entry.kind != 'symptom') entry.note!],
      trailing: canDelete && entry.byMe
          ? Semantics(
              button: true,
              label: t.s('delete'),
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onDelete,
                child: SizedBox(width: 32, height: 32, child: Center(child: AIcon(AIcons.trash2, size: 15, color: a.inkFaint))),
              ),
            )
          : null,
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.t, required this.episode, required this.language, required this.locale, required this.unit, required this.onOpen});
  final FeatureText t;
  final IllnessEpisode episode;
  final String language;
  final String locale;
  final TempUnit unit;
  final VoidCallback onOpen;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = fmtDayMonthShort(jsParseDate(episode.startedAt) ?? DateTime.now(), language);
    final ended = episode.endedAt != null && episode.endedAt!.isNotEmpty;
    final range = ended ? '$s – ${fmtDayMonthShort(jsParseDate(episode.endedAt!) ?? DateTime.now(), language)}' : s;
    final maxTemp = episode.maxTemp;
    return CxLi(
      onTap: onOpen,
      leading: CxIcon(emoji: kindEmoji[episode.kind], color: a.surfaceSoft),
      title: '${t.at('kinds', episode.kind) ?? episode.kind}${(episode.childName ?? '').isNotEmpty ? ' · ${episode.childName}' : ''}',
      subs: ['$range${maxTemp != null && maxTemp != 0 ? ' · ${formatTemp(maxTemp, unit, locale)}' : ''}'],
      trailing: CxPill(label: ended ? t.s('ended') : t.s('active')),
    );
  }
}
