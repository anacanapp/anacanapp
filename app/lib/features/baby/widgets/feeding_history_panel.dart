// Ported from: src/components/baby/FeedingHistoryPanel.tsx
//
// Expandable feeding summary: today's breakdown tiles and the last 3 days of feedings with inline edit
// (start/end HH:mm) and delete confirmation.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../home_mommy/widgets/mommy_ui.dart';
import '../hooks/use_baby_logs.dart';

/// `formatDuration(seconds)`.
String feedingDuration(int seconds) {
  if (seconds <= 0) return '-';
  final h = seconds ~/ 3600, m = (seconds % 3600) ~/ 60, s = seconds % 60;
  if (h > 0) return '$h ${tr('unit_hr', 'saat')} $m ${tr('unit_min', 'dəq')}';
  if (m > 0) return '$m ${tr('unit_min', 'dəq')} $s ${tr('unit_sec', 'san')}';
  return '$s ${tr('unit_sec', 'san')}';
}

String feedTypeLabel(String type) => switch (type) {
      'left' => tr('feedinghistorypanel_sol_sine_64d1ac', 'Sol sinə'),
      'right' => tr('feedinghistorypanel_sag_sine_074475', 'Sağ sinə'),
      'formula' => tr('feedinghistorypanel_suni_qida_fdf267', 'Süni qida'),
      'solid' => tr('feedinghistorypanel_elave_qida_ac1beb', 'Bərk qida'),
      _ => type,
    };

String feedTypeEmoji(String type) => switch (type) {
      'left' => '🤱←',
      'right' => '→🤱',
      'formula' => '🍼',
      'solid' => '🥣',
      _ => '🍼',
    };

/// `getDateLabel(dateStr)`: `new Date('YYYY-MM-DD')` (UTC midnight) checked with isToday / isYesterday.
String feedingDateLabel(String dateStr, [DateTime? now]) {
  final d = jsParseDate(dateStr)?.toLocal();
  if (d == null) return dateStr;
  final today = startOfDay(now ?? DomainClock.now());
  final diff = differenceInCalendarDays(today, d);
  if (diff == 0) return tr('feedinghistorypanel_today', 'Bu gün');
  if (diff == 1) return tr('feedinghistorypanel_yesterday', 'Dünən');
  return formatDatePattern(d, 'd MMMM');
}

String _hm(DateTime d) => '${pad2(d.hour)}:${pad2(d.minute)}';

class FeedingHistoryPanel extends ConsumerStatefulWidget {
  const FeedingHistoryPanel({super.key, this.isExpanded, this.onToggle, this.defaultExpanded = false});
  final bool? isExpanded;
  final VoidCallback? onToggle;
  final bool defaultExpanded;

  @override
  ConsumerState<FeedingHistoryPanel> createState() => _FeedingHistoryPanelState();
}

class _FeedingHistoryPanelState extends ConsumerState<FeedingHistoryPanel> {
  late bool _internal = widget.defaultExpanded;
  String? _editingId;
  String? _deletingId;
  final _start = TextEditingController();
  final _end = TextEditingController();

  @override
  void dispose() {
    _start.dispose();
    _end.dispose();
    super.dispose();
  }

  Future<void> _delete(String id) async {
    final toast = AToastHost.of(context);
    final error = await ref.read(babyLogsActionsProvider).deleteLog(id);
    if (error == null) {
      toast.show(title: tr('feedinghistorypanel_record_deleted', 'Qeyd silindi'));
      if (mounted) setState(() => _deletingId = null);
    } else {
      toast.show(title: tr('feedinghistorypanel_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true);
    }
  }

  DateTime? _at(DateTime base, String hm) {
    final parts = hm.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]), m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return DateTime(base.year, base.month, base.day, h, m);
  }

  Future<void> _saveEdit(FeedingHistoryItem item) async {
    final toast = AToastHost.of(context);
    final start = _at(item.startTime, _start.text) ?? item.startTime;
    final updates = <String, Object?>{'start_time': jsToIsoString(start)};
    if (_end.text.isNotEmpty) {
      final end = _at(item.startTime, _end.text);
      if (end != null) updates['end_time'] = jsToIsoString(end);
    }
    final error = await ref.read(babyLogsActionsProvider).updateLog(item.id, updates);
    if (error == null) {
      toast.show(title: tr('feedinghistorypanel_qeyd_yenilendi_816afb', 'Qeyd yeniləndi'));
      if (mounted) setState(() => _editingId = null);
    } else {
      toast.show(title: tr('feedinghistorypanel_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appLanguageProvider);
    final view = ref.watch(babyLogsProvider);
    final b = view.todayFeedingBreakdown;
    final history = view.feedingHistory(3);
    final total = b.leftCount + b.rightCount + b.formulaCount + b.solidCount;
    final expanded = widget.isExpanded ?? _internal;
    final t = context.a;
    final times = tr('feedinghistorypanel_times', 'dəfə');

    String summary() {
      final parts = <String>[];
      if (b.leftCount > 0 || b.rightCount > 0) parts.add('🤱 ${b.leftCount + b.rightCount}');
      if (b.formulaCount > 0) parts.add('🍼 ${b.formulaCount}');
      if (b.solidCount > 0) parts.add('🥣 ${b.solidCount}');
      return parts.isNotEmpty ? parts.join(' · ') : tr('feedinghistorypanel_no_records', 'Qeyd yoxdur');
    }

    TextStyle xs(Color c, {FontWeight w = FontWeight.w700}) => TextStyle(fontSize: 12, height: 1.33, fontWeight: w, color: c);
    TextStyle tiny(Color c) => TextStyle(fontSize: 10, height: 1.5, color: c);

    Widget tile({required Color bg, required Widget head, required String value, required String sub, required Color ink}) => Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            Padding(padding: const EdgeInsets.only(bottom: 4), child: head),
            Text(value, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 1.43, fontWeight: FontWeight.w700, color: ink)),
            Text(sub, textAlign: TextAlign.center, style: tiny(ink.withValues(alpha: 0.7))),
          ]),
        );

    final tiles = <Widget>[
      if (b.leftCount > 0)
        tile(
          bg: t.peach1,
          ink: t.accentInk,
          head: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            AIcon(AIcons.arrowLeft, size: 12, color: t.accentInk, mirrorInRtl: true),
            const SizedBox(width: 4),
            Text(tr('feedinghistorypanel_sol_sine_64d1ac', 'Sol sinə'), style: xs(t.accentInk)),
          ]),
          value: feedingDuration(b.leftTotalSeconds),
          sub: '${b.leftCount} $times',
        ),
      if (b.rightCount > 0)
        tile(
          bg: t.peach1,
          ink: t.accentInk,
          head: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(tr('feedinghistorypanel_sag_sine_074475', 'Sağ sinə'), style: xs(t.accentInk)),
            const SizedBox(width: 4),
            AIcon(AIcons.arrowRight, size: 12, color: t.accentInk, mirrorInRtl: true),
          ]),
          value: feedingDuration(b.rightTotalSeconds),
          sub: '${b.rightCount} $times',
        ),
      if (b.formulaCount > 0)
        tile(
          bg: t.blue1,
          ink: t.blueInk,
          head: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('🍼', style: TextStyle(fontSize: 18, height: 1.55)),
            const SizedBox(width: 4),
            Text(tr('feedinghistorypanel_suni_qida_fdf267', 'Süni qida'), style: xs(t.blueInk)),
          ]),
          value: '${b.formulaCount} $times',
          sub: tr('feedinghistorypanel_bu_gun_7d7f30', 'bu gün'),
        ),
      if (b.solidCount > 0)
        tile(
          bg: t.green1,
          ink: t.greenInk,
          head: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('🥣', style: TextStyle(fontSize: 18, height: 1.55)),
            const SizedBox(width: 4),
            Text(tr('feedinghistorypanel_elave_qida_ac1beb', 'Əlavə qida'), style: xs(t.greenInk)),
          ]),
          value: '${b.solidCount} $times',
          sub: tr('feedinghistorypanel_bu_gun_7d7f30', 'bu gün'),
        ),
    ];

    Widget roundBtn(AIconData icon, Color bg, Color fg, VoidCallback onTap) => GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: AIcon(icon, size: 12, color: fg),
          ),
        );

    Widget timeField(TextEditingController c) => SizedBox(
          width: 96,
          child: AInput(controller: c, placeholder: 'HH:mm'),
        );

    Widget item(FeedingHistoryItem it) {
      if (_deletingId == it.id) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(color: t.pink1, borderRadius: BorderRadius.circular(8)),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(child: Text(tr('feedinghistorypanel_silmek_isteyirsiniz_77af6b', 'Silmək istəyirsiniz?'), style: xs(t.pinkInk, w: FontWeight.w600))),
            Row(mainAxisSize: MainAxisSize.min, children: [
              roundBtn(AIcons.check, t.pink2, const Color(0xFFFFFFFF), () => _delete(it.id)),
              const SizedBox(width: 6),
              roundBtn(AIcons.x, t.chipOverlay, t.pinkInk, () => setState(() => _deletingId = null)),
            ]),
          ]),
        );
      }
      if (_editingId == it.id) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(color: t.peach1, borderRadius: BorderRadius.circular(8)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Text(feedTypeEmoji(it.feedType), style: const TextStyle(fontSize: 14)),
              const SizedBox(width: 8),
              Text(feedTypeLabel(it.feedType), style: xs(t.accentInk, w: FontWeight.w600)),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              timeField(_start),
              const SizedBox(width: 8),
              Text('-', style: xs(t.accentInk, w: FontWeight.w400)),
              const SizedBox(width: 8),
              timeField(_end),
            ]),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              roundBtn(AIcons.check, t.green2, const Color(0xFFFFFFFF), () => _saveEdit(it)),
              const SizedBox(width: 6),
              roundBtn(AIcons.x, t.chipOverlay, t.accentInk, () => setState(() => _editingId = null)),
            ]),
          ]),
        );
      }
      final name = it.feedType == 'solid' && it.notes != null ? it.notes! : feedTypeLabel(it.feedType);
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(8)),
        child: Row(children: [
          Text(feedTypeEmoji(it.feedType), style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: name),
                  if (it.feedType == 'formula' && it.notes != null && it.notes!.contains('ml'))
                    TextSpan(text: ' (${it.notes})', style: TextStyle(fontWeight: FontWeight.w700, color: t.accentInk)),
                ]),
                style: xs(t.ink, w: FontWeight.w600),
              ),
              Text('${_hm(it.startTime)}${it.endTime != null ? ' - ${_hm(it.endTime!)}' : ''}', style: tiny(t.inkSoft)),
            ]),
          ),
          Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(AIcons.clock, size: 12, color: t.accentInk),
            const SizedBox(width: 4),
            Text(feedingDuration(it.durationSeconds), style: xs(t.accentInk)),
          ]),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => setState(() {
              _editingId = it.id;
              _start.text = _hm(it.startTime);
              _end.text = it.endTime != null ? _hm(it.endTime!) : '';
            }),
            child: Padding(padding: const EdgeInsets.all(4), child: AIcon(AIcons.pencil, size: 12, color: t.inkSoft)),
          ),
          const SizedBox(width: 2),
          GestureDetector(
            onTap: () => setState(() => _deletingId = it.id),
            child: Padding(padding: const EdgeInsets.all(4), child: AIcon(AIcons.trash2, size: 12, color: t.pinkInk)),
          ),
        ]),
      );
    }

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(20), border: Border.all(color: t.line), boxShadow: t.cardShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onToggle ?? () => setState(() => _internal = !_internal),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(gradient: t.gradPeach, borderRadius: BorderRadius.circular(12)),
                child: Center(child: AIcon(AIcons.baby, size: 16, color: t.accentInk)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('feedinghistorypanel_qidalanma_xulasesi_836869', 'Qidalanma xülasəsi'), style: xs(t.ink)),
                  Text(summary(), style: tiny(t.inkSoft)),
                ]),
              ),
              if (total > 0)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text('$total $times', style: xs(t.accentInk)),
                    Text(tr('feedinghistorypanel_bu_gun_7d7f30', 'bu gün'), style: tiny(t.inkSoft)),
                  ]),
                ),
              AIcon(expanded ? AIcons.chevronUp : AIcons.chevronDown, size: 16, color: t.inkFaint),
            ]),
          ),
        ),
        FramerExpand(
          open: expanded,
          duration: const Duration(milliseconds: 200),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (total > 0) ...[
                AGrid(columns: 2, marginTop: 0, children: tiles),
                const SizedBox(height: 12),
              ],
              for (final (i, MapEntry(key: date, value: items)) in history.entries.indexed) ...[
                if (i > 0) const SizedBox(height: 12),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text(feedingDateLabel(date), style: xs(t.ink)),
                  Text('${items.length} ${tr('feedinghistorypanel_feedings_count', 'qidalanma')}', style: tiny(t.inkSoft)),
                ]),
                const SizedBox(height: 6),
                if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(tr('feedinghistorypanel_no_records', 'Qeyd yoxdur'), textAlign: TextAlign.center, style: xs(t.inkSoft, w: FontWeight.w400)),
                  )
                else
                  for (final (j, it) in items.indexed) ...[if (j > 0) const SizedBox(height: 4), KeyedSubtree(key: ValueKey(it.id), child: item(it))],
              ],
            ]),
          ),
        ),
      ]),
    );
  }
}
