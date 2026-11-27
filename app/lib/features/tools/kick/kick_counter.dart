// Ported from: src/components/tools/KickCounter.tsx
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../legal/medical_disclaimer.dart' show emergencyNumberProvider;
import '../../settings/ui/settings_ui.dart' show px, todayInfoEyebrow;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ports.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import '../pregnancy_common/tool_live_timer.dart';
import 'kick_session.dart';
import 'kick_sessions.dart';

class KickCounter extends ConsumerStatefulWidget {
  const KickCounter({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<KickCounter> createState() => _KickCounterState();
}

class _KickCounterState extends ConsumerState<KickCounter> {
  ActiveKickSession? _session;
  int _now = DomainClock.nowMs();
  bool _saving = false;
  bool _trackPosition = false;
  String? _selectedPosition;
  Timer? _tick;
  String? _userId;
  late final KickLiveTimerSync _live = KickLiveTimerSync(ref.read(toolLiveTimerProvider));

  @override
  void initState() {
    super.initState();
    _userId = ref.read(authUserProvider)?.id;
    _restore();
  }

  /// Restore the unfinished session once the signed-in user is known.
  void _restore() {
    final restored = loadActiveKickSession(ref.read(localStoreProvider), _userId);
    _session = restored;
    if (restored?.position != null) {
      _trackPosition = true;
      _selectedPosition = restored!.position;
    }
    _syncTick();
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  void _syncTick() {
    final active = _session != null;
    if (active && _tick == null) {
      _now = DomainClock.nowMs();
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _now = DomainClock.nowMs());
      });
    } else if (!active && _tick != null) {
      _tick!.cancel();
      _tick = null;
    }
  }

  void _setSession(ActiveKickSession? next) {
    setState(() => _session = next);
    saveActiveKickSession(ref.read(localStoreProvider), _userId, next);
    _syncTick();
  }

  /// Keep the chosen side with the stored session.
  void _syncPosition() {
    final s = _session;
    final want = _trackPosition ? _selectedPosition : null;
    if (s != null && s.position != want) _setSession(s.copyWith(position: want));
  }

  static String _formatTime(int seconds) => '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';

  void _handleKick() {
    unawaited(ref.read(pregnancyHapticsProvider).medium());
    final at = DomainClock.nowMs();
    final position = _trackPosition ? _selectedPosition : null;
    // Tapping while idle starts a NEW session with this first kick.
    final base = _session ?? ActiveKickSession(startedAt: newKickSession(at).startedAt, kicks: 0, position: position);
    _now = at;
    _setSession(base.copyWith(kicks: base.kicks + 1));
  }

  void _handleStart() {
    final at = DomainClock.nowMs();
    _now = at;
    _setSession(ActiveKickSession(startedAt: newKickSession(at).startedAt, kicks: 0, position: _trackPosition ? _selectedPosition : null));
  }

  Future<void> _handleStop() async {
    final finished = _session;
    if (finished == null || _saving) return;
    final duration = kickElapsedSeconds(finished, DomainClock.nowMs());
    if (finished.kicks == 0) {
      _setSession(null);
      setState(() => _selectedPosition = null);
      return;
    }
    _saving = true;
    final toast = AToastHost.of(context);
    try {
      // The persisted session is cleared only after the write is confirmed or safely queued offline.
      final result = await ref.read(kickSessionsActionsProvider).addSession(
            finished.kicks,
            duration,
            position: _trackPosition ? finished.position : null,
            startedAt: finished.startedAt,
            toast: ({required title, description, destructive = false}) =>
                toast.show(title: title, description: description, destructive: destructive),
          );
      if (!mounted) return;
      if (result != null && result.status.name != 'error') {
        // Clear only this session: the next start can never continue from (and re-save) this count.
        final current = _session;
        if (current == null || current.startedAt == finished.startedAt) _setSession(null);
        setState(() => _selectedPosition = null);
      }
    } finally {
      _saving = false;
    }
  }

  void _handleReset() {
    _setSession(null);
    setState(() => _selectedPosition = null);
  }

  String _kickMessage(int kicks, bool isMultiple) {
    if (kicks == 0) return tr('kickcounter_baslamaq_ucun_duymeye_toxunun_38b541', 'Başlamaq üçün düyməyə toxunun');
    if (kicks < 5) return tr('kickcounter_davam_edin_izleyirsiniz_815868', 'Davam edin, izləyirsiniz! 👶');
    if (kicks < 10) {
      return isMultiple
          ? tr('kickcounter_ela_gedir_korpeleriniz_aktivdir', 'Əla gedir! Körpələriniz aktivdir 💪')
          : tr('kickcounter_ela_gedir_korpeniz_aktivdir_b54853', 'Əla gedir! Körpəniz aktivdir 💪');
    }
    return tr('kickcounter_super_10_tepike_catdiniz_22fdc0', 'Super! 10 təpikə çatdınız! 🎉');
  }

  String _dateLabel(String dateStr) {
    final parts = dateStr.split('-').map((p) => int.tryParse(p) ?? 0).toList();
    final y = parts.isNotEmpty ? parts[0] : 0;
    final m = parts.length > 1 && parts[1] != 0 ? parts[1] : 1;
    final d = parts.length > 2 && parts[2] != 0 ? parts[2] : 1;
    if (dateStr == todayKey()) return tr('kickcounter_bu_gun_786fd4', 'Bu gün');
    if (dateStr == daysAgoKey(1)) return tr('kickcounter_dunen_52b701', 'Dünən');
    return formatDateAz(DateTime(y, m, d));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final userId = ref.watch(authUserProvider)?.id;
    if (userId != _userId) {
      _userId = userId;
      _restore();
    }
    final profile = ref.watch(authProfileProvider);
    final isMultiple = profile?.multiplesType != null && profile!.multiplesType!.isNotEmpty && profile.multiplesType != 'single';
    final emergency = ref.watch(emergencyNumberProvider);
    final kickData = ref.watch(kickSessionsProvider);
    final todayStats = kickData.todayStats;
    final isActive = _session != null;
    final kicks = _session?.kicks ?? 0;
    final time = kickElapsedSeconds(_session, _now);
    final liveState = kickLiveTimerState(_session);
    _live.update(startTime: liveState?.startTime, count: liveState?.count ?? 0, enabled: userId != null);

    final tepik = tr('kickcounter_tepik_6483fe', 'təpik');
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: '${tr('kickcounter_bugunku_umumi_bc878f', 'Bugünkü ümumi')}: ${todayStats.totalKicks} $tepik',
          title: tr('kickcounter_tepik_saygaci_85e455', 'Təpik Sayğacı'),
        ),
        if (isMultiple)
          ACard(
            color: a.blue1,
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.info, size: 16, color: a.blueInk)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(upperCss(tr('kickcounter_multiples_info_title', 'Əkiz/üçüz hamiləlikdə təpiklər')),
                      style: todayInfoEyebrow(context).copyWith(color: a.blueInk)),
                  const SizedBox(height: 4),
                  Text(
                    tr('kickcounter_multiples_info_desc',
                        'Hansı körpənin təpik atdığını dəqiq ayırmaq həmişə mümkün deyil. Buna görə ÜMUMİ hərəkət nümunənizə fikir verin — adi vəziyyətinizlə müqayisədə azalma hiss etsəniz, hansı tərəfdən asılı olmayaraq dərhal həkiminizlə əlaqə saxlayın.'),
                    style: x.aListSub,
                  ),
                ]),
              ),
            ]),
          ),
        SizedBox(height: isMultiple ? 10 : 0),
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (isMultiple) _positionPicker(context),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(upperCss(tr('kickcounter_kecen_vaxt_0258bf', 'Keçən vaxt')), style: todayInfoEyebrow(context)),
                ),
                Text(_formatTime(time),
                    key: const ValueKey('kick-elapsed'),
                    style: x.heading(px(30, color: a.ink)).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              ]),
            ),
            Center(child: _KickButton(kicks: kicks, active: isActive, onTap: _handleKick)),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(_kickMessage(kicks, isMultiple), textAlign: TextAlign.center, style: x.aListSub),
            ),
            Row(children: [
              Expanded(
                child: isActive
                    ? PCtaButton(
                        key: const ValueKey('kick-stop'),
                        height: 46,
                        background: a.pink2,
                        leading: AIcons.pause,
                        onTap: _handleStop,
                        child: Text(tr('kickcounter_dayandir_b2ea06', 'Dayandır')),
                      )
                    : PCtaButton(
                        key: const ValueKey('kick-start'),
                        height: 46,
                        leading: AIcons.play,
                        onTap: _handleStart,
                        child: Text(tr('kickcounter_basla_4820bc', 'Başla')),
                      ),
              ),
              const SizedBox(width: 10),
              ToolIconButton(
                size: 46,
                semanticLabel: tr('livetimer_kick_reset_aria', 'Sayğacı sıfırla'),
                icon: const AIcon(AIcons.rotateCcw, size: 16, strokeWidth: 2),
                onTap: _handleReset,
              ),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Flexible(child: Text(tr('kickcounter_bugunku_umumi_bc878f', 'Bugünkü ümumi'), style: x.heading(x.aCardTitle))),
                Text('${todayStats.totalKicks} $tepik', key: const ValueKey('kick-today-total'), style: x.aSectionLink.copyWith(color: a.accentInk)),
              ]),
            ),
            Text(
              tr('kick_guidance_pattern',
                  'Körpənizin adi hərəkət ritmini tanıyın. Hərəkətlər azalsa, dəyişsə və ya dayansa, növbəti günü gözləməyin: dərhal doğum evinizlə və ya həkiminizlə əlaqə saxlayın.'),
              style: px(12, color: a.inkSoft, height: 1.55),
            ),
            const SizedBox(height: 8),
            PTap(
              onTap: () => ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
              child: Container(
                height: 34,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.phone, size: 13, strokeWidth: 2.2, color: a.accentInk),
                  const SizedBox(width: 6),
                  Text(formatTr('weaning_call_emergency', 'Təcili yardım: {emergency}', {'emergency': emergency}),
                      style: px(11.5, weight: FontWeight.w700, color: a.accentInk)),
                ]),
              ),
            ),
          ]),
        ),
        if (kickData.sessions.isNotEmpty) _recentSessions(context, kickData.sessions),
      ]),
    );
  }

  Widget _positionPicker(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    Widget side(String value, String label) {
      final on = _selectedPosition == value;
      return Expanded(
        child: GestureDetector(
          onTap: () {
            setState(() => _selectedPosition = value);
            _syncPosition();
          },
          child: Container(
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: on ? a.peach1 : a.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: on ? a.peach2 : a.lineStrong, width: on ? 2 : 1),
            ),
            child: Text(label, style: px(13, weight: FontWeight.w700, color: on ? a.accentInk : a.inkSoft)),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: () {
            setState(() {
              _trackPosition = !_trackPosition;
              _selectedPosition = null;
            });
            _syncPosition();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _trackPosition ? a.peach2 : null,
                  border: Border.all(color: _trackPosition ? a.peach2 : a.inkFaint),
                ),
              ),
              const SizedBox(width: 6),
              Text(tr('kickcounter_position_toggle_label', 'Mövqeyə görə qeyd et'), style: px(11.5, weight: FontWeight.w600, color: a.inkSoft)),
            ]),
          ),
        ),
        const SizedBox(height: 4),
        Text(tr('kickcounter_position_toggle_desc', 'Hansı tərəfdən hiss etdiyinizi ayıra bilirsinizsə'), style: x.aListSub),
        if (_trackPosition)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(children: [
              side('left', tr('kickcounter_position_left', 'Sol tərəf')),
              const SizedBox(width: 8),
              side('right', tr('kickcounter_position_right', 'Sağ tərəf')),
            ]),
          ),
      ]),
    );
  }

  Widget _recentSessions(BuildContext context, List<KickSession> sessions) {
    final a = context.a;
    final x = context.aText;
    final grouped = <String, List<KickSession>>{};
    for (final s in sessions) {
      grouped.putIfAbsent(s.dayKey, () => []).add(s);
    }
    final tepik = tr('kickcounter_tepik_6483fe', 'təpik');
    return Padding(
      padding: const EdgeInsets.only(top: 22, bottom: 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(tr('kick_recent_sessions', 'Son sessiyalar'), style: x.aSectionTitle),
        ),
        for (final entry in grouped.entries.take(5))
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
                child: Row(children: [
                  Text(upperCss(_dateLabel(entry.key)), style: todayInfoEyebrow(context)),
                  const SizedBox(width: 8),
                  Text('(${entry.value.fold<int>(0, (s, k) => s + k.kickCount)} ${tr('kickcounter_tepik_c35745', 'təpik)')}', style: x.aListTime),
                  const SizedBox(width: 8),
                  Expanded(child: Container(height: 1, color: a.lineStrong)),
                ]),
              ),
              ACard(
                variant: ACardVariant.list,
                child: Column(children: [
                  for (var i = 0; i < entry.value.length; i++)
                    PListRow(
                      first: i == 0,
                      leading: PListIcon(background: a.peach1, color: a.accentInk, child: AIcon(AIcons.footprints, size: 17, strokeWidth: 2, color: a.accentInk)),
                      body: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Text('${entry.value[i].kickCount} $tepik', style: x.aListTitle),
                          if (entry.value[i].position != null) ...[
                            const SizedBox(width: 6),
                            PTag(
                              background: a.blue1,
                              color: a.blueInk,
                              fontSize: 10,
                              child: Text(entry.value[i].position == 'left'
                                  ? tr('kickcounter_position_chip_left', '◀ Sol')
                                  : tr('kickcounter_position_chip_right', 'Sağ ▶')),
                            ),
                          ],
                        ]),
                        const SizedBox(height: 2),
                        Text(formatTimeAz(entry.value[i].createdAt), style: x.aListSub),
                      ]),
                      trailing: Text(_formatTime(entry.value[i].durationSeconds),
                          style: x.aListValue.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                    ),
                ]),
              ),
            ]),
          ),
      ]),
    );
  }
}

/// The 144px peach kick button (`w-36 h-36 rounded-full`, `--a-grad-peach`, footprints + count) with the
/// `animate-ping` ring while a session runs.
class _KickButton extends StatefulWidget {
  const _KickButton({required this.kicks, required this.active, required this.onTap});
  final int kicks;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_KickButton> createState() => _KickButtonState();
}

class _KickButtonState extends State<_KickButton> with SingleTickerProviderStateMixin {
  late final AnimationController _ping = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncPing();
  }

  @override
  void didUpdateWidget(_KickButton old) {
    super.didUpdateWidget(old);
    _syncPing();
  }

  void _syncPing() {
    if (widget.active && infiniteAnimationsAllowed(context)) {
      if (!_ping.isAnimating) _ping.repeat();
    } else {
      _ping.stop();
      _ping.value = 0;
    }
  }

  @override
  void dispose() {
    _ping.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      label: formatTr('livetimer_kick_tap_aria', 'Hərəkəti qeyd et, indiyədək {count}', {'count': widget.kicks}),
      excludeSemantics: true,
      child: PressScale(
        onTap: widget.onTap,
        child: Container(
          key: const ValueKey('kick-button'),
          width: 144,
          height: 144,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: a.gradPeach,
            // `boxShadow: '0 18px 32px -14px rgba(255, 157, 99, 0.7)'` (KickCounter.tsx inline literal)
            boxShadow: const [BoxShadow(color: Color(0xB3FF9D63), offset: Offset(0, 18), blurRadius: 32, spreadRadius: -14)],
          ),
          child: Stack(alignment: Alignment.center, children: [
            if (widget.active)
              AnimatedBuilder(
                animation: _ping,
                builder: (context, _) => Transform.scale(
                  scale: 1 + _ping.value,
                  child: Opacity(
                    opacity: 1 - _ping.value,
                    // `background: rgba(255,255,255,0.3)` (inline literal)
                    child: Container(decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x4DFFFFFF))),
                  ),
                ),
              ),
            Column(mainAxisSize: MainAxisSize.min, children: [
              Padding(padding: const EdgeInsets.only(bottom: 2), child: AIcon(AIcons.footprints, size: 44, strokeWidth: 1.8, color: a.accentInk)),
              Text('${widget.kicks}',
                  key: const ValueKey('kick-count'),
                  style: context.aText.heading(px(44, weight: FontWeight.w800, color: a.accentInk, height: 1.1))),
            ]),
          ]),
        ),
      ),
    );
  }
}
