// Ported from: src/lib/redFlags.ts
//
// Danger signs in pregnancy and after birth that need urgent care (WHO/ACOG based, not medical advice).
// The catalogue is generated from the TypeScript (data/health_data.g.dart).

import '../js_compat.dart';
import 'data/health_data.g.dart';

/// 'urgent' | 'soon'
typedef DangerSeverity = String;

/// 'bump' | 'mommy'
typedef DangerStage = String;

class DangerSign {
  const DangerSign({
    required this.id,
    required this.emoji,
    required this.title,
    required this.desc,
    required this.severity,
    required this.stages,
    this.multiplesOnly = false,
  });
  final String id;
  final String emoji;
  final String title;
  final String desc;
  final DangerSeverity severity;
  final List<DangerStage> stages;

  /// Shown only for multiples (profiles.multiples_type !== 'single').
  final bool multiplesOnly;
}

/// DANGER_SIGNS in source order, translated with [tr].
List<DangerSign> dangerSigns({Tr tr = azTr}) => [
      for (final d in dangerSignsData)
        DangerSign(
          id: d['id']! as String,
          emoji: d['emoji']! as String,
          title: tr((d['title']! as Map)['key'] as String, (d['title']! as Map)['az'] as String),
          desc: tr((d['desc']! as Map)['key'] as String, (d['desc']! as Map)['az'] as String),
          severity: d['severity']! as String,
          stages: (d['stages']! as List).cast<String>(),
          multiplesOnly: d['multiplesOnly'] == true,
        ),
    ];

/// Signs for a stage (anything but 'mommy' counts as pregnancy), urgent first (stable sort).
List<DangerSign> getDangerSignsForStage(String? stage, {bool isMultiplesPregnancy = false, Tr tr = azTr}) {
  final s = stage == 'mommy' ? 'mommy' : 'bump';
  return jsSorted(
    dangerSigns(tr: tr).where((d) => d.stages.contains(s)).where((d) => !d.multiplesOnly || isMultiplesPregnancy),
    (DangerSign a, DangerSign b) => a.severity == b.severity ? 0 : (a.severity == 'urgent' ? -1 : 1),
  );
}
