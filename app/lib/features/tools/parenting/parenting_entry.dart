// Ported from: src/components/tools/parenting/ParentingEntry.tsx, src/styles/anacan-design.css (.a-par-ai)
//
// Anacan.AI: a suggestion card under the answer when the question was about a parenting topic — the best matching
// SOS card or article in the app language; it opens the tool directly on that item (the mother's tool, or the
// partner's screen for the partner role).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../domain/parenting/parenting.dart' show isParentingPartnerVisible, isParentingTileVisible;
import '../../../shell/shell.dart' show ParentingTarget;
import 'parenting_content.dart';
import 'parenting_copy.dart';
import 'parenting_search.dart';
import 'programme_ports.dart';
import 'programme_ui.dart';

/// The woman's context as the partner (Ata AI) sees it.
class ParentingPartnerContext {
  const ParentingPartnerContext({required this.lifeStage, this.babyBirthDate, this.birthDates});
  final String? lifeStage;
  final String? babyBirthDate;

  /// Her children he can see (a younger sibling keeps the tool when the current child is 13+).
  final List<String?>? birthDates;
}

/// Whether Tərbiyə is available to this user: the mother in the Ana module (tile rules + the per-language tool
/// switch), or the partner of a woman in the Ana module (partner rules).
bool parentingAvailable(ProgrammeInputs inputs, ParentingPartnerContext? partner, [DateTime? now]) {
  if (partner != null) {
    return isParentingPartnerVisible(
        womanLifeStage: partner.lifeStage, language: inputs.language, setting: inputs.parentingSetting, birthDate: partner.babyBirthDate, birthDates: partner.birthDates, now: now);
  }
  return !inputs.isToolDisabled('parenting') &&
      isParentingTileVisible(
        lifeStage: inputs.lifeStage,
        language: inputs.language,
        setting: inputs.parentingSetting,
        birthDate: inputs.child?.birthDate,
        birthDates: [for (final c in inputs.children) c.birthDate],
        now: now,
      );
}

class ParentingAiCard extends ConsumerWidget {
  const ParentingAiCard({super.key, required this.question, this.partner});
  final String question;
  final ParentingPartnerContext? partner;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inputs = ref.watch(programmeInputsProvider);
    final available = parentingAvailable(inputs, partner);
    if (!available) return const SizedBox.shrink();
    final content = ref.watch(parentingContentProvider(inputs.language)).value;
    final match = matchParentingTopic(content, question);
    if (match == null) return const SizedBox.shrink();
    final a = context.a;
    void open() {
      ref.read(programmeTrackProvider)('parenting', 'ai_card_${match.kind}');
      ref.read(programmeNavProvider).openParenting(ParentingTarget(match.kind, match.id));
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 34, bottom: 14),
      child: Transform.translate(
        offset: const Offset(0, -4),
        child: Semantics(
          button: true,
          child: PressScale(
            key: const ValueKey('parenting-ai-card'),
            scale: 0.98,
            onTap: open,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
              child: Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(13)),
                  child: Text(match.emoji, style: css(20, height: 1.2)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Gap(gap: 2, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(pt(match.kind == 'sos' ? 'par_ai_kind_sos' : 'par_ai_kind_article').toUpperCase(), style: css(10.5, weight: FontWeight.w800, em: 0.04, color: a.coralText)),
                    Text(match.title, style: css(14, weight: FontWeight.w700, height: 1.3, color: a.ink)),
                    Text(pt('par_ai_text'), style: css(12, color: a.inkSoft)),
                  ]),
                ),
                const SizedBox(width: 12),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(pt('par_ai_open'), style: css(12.5, weight: FontWeight.w800, color: a.coralText)),
                  const SizedBox(width: 2),
                  AIcon(AIcons.chevronRight, size: 14, color: a.coralText, mirrorInRtl: true),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
