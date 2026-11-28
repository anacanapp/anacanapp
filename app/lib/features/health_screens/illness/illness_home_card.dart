// Ported from: src/components/illness/IllnessHomeCard.tsx
//
// Home entry to the illness journal. `mode: 'active'` shows only an open episode (top of the home); `'entry'`
// shows the quiet entry row when nothing is open.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px;
import '../common/care_ui.dart';
import '../common/feature_text.dart';
import 'illness.dart';
import 'illness_data.dart';

class IllnessHomeCard extends ConsumerWidget {
  const IllnessHomeCard({super.key, required this.mode, required this.onOpen});

  /// 'active' | 'entry'.
  final String mode;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(illnessTextProvider);
    final q = ref.watch(illnessEpisodesQuery);
    if (q.isLoading) return const SizedBox.shrink();
    final episodes = q.data ?? const <IllnessEpisode>[];
    final active = episodes.where((e) => e.endedAt == null || e.endedAt!.isEmpty).firstOrNull;
    final unit = ref.watch(tempUnitProvider);
    if (mode == 'active' && active == null) return const SizedBox.shrink();
    if (mode == 'entry' && active != null) return const SizedBox.shrink();
    final a = context.a;
    final lastTemp = active?.lastTemp;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: CxCard(
        tapScale: 0.98,
        onTap: onOpen,
        gradient: active != null ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [a.surface, a.pink1]) : null,
        child: Row(children: [
          CxIcon(emoji: active != null ? kindEmoji[active.kind] : '🌡️', color: active != null ? a.surface : a.peach1, fontSize: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                active != null
                    ? fill(t.s('home_card_active'), {'kind': t.at('kinds', active.kind) ?? active.kind, 'n': episodeDay(active.startedAt)})
                    : t.s('home_card_entry'),
                style: px(14.5, weight: FontWeight.w700, color: a.ink),
              ),
              Text(
                active != null ? ((active.childName ?? '').isNotEmpty ? active.childName! : t.s('title')) : t.s('home_card_entry_desc'),
                style: cxSub(context),
              ),
            ]),
          ),
          if (lastTemp != null) ...[
            const SizedBox(width: 12),
            Text('${toUnit(lastTemp, unit).toStringAsFixed(1)}°', style: px(18, weight: FontWeight.w700, color: bandColor[tempBand(lastTemp)])),
          ],
          const SizedBox(width: 12),
          AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
        ]),
      ),
    );
  }
}
