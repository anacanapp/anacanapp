// Ported from: src/components/recovery/RecoveryHomeCard.tsx, src/styles/care.css (.cx-card, .cx-row, .cx-icon,
//              .cx-eyebrow, .cx-sub, .cx-weeks)
//
// Mother's recovery card on the mommy home during the first 8 weeks after birth (profile.baby_birth_date,
// profile.birth_type, default vaginal); tap → screen `recovery`.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/i18n/language_controller.dart';
import '../../design/design.dart';
import '../home_mommy/widgets/mommy_ui.dart' show upper;
import 'recovery.dart';

class RecoveryHomeCard extends ConsumerWidget {
  const RecoveryHomeCard({super.key, required this.onOpen});
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(appLanguageProvider);
    final profile = ref.watch(authProfileProvider);
    final week = weekAfterBirth(profile?.babyBirthDate);
    if (week == null || week > homeCardWeeks) return const SizedBox.shrink();
    final text = recoveryText(language);
    final birthType = profile?.row['birth_type'] as String? ?? 'vaginal';
    final weeks = ((text['weeks'] as Map)[birthType] ?? (text['weeks'] as Map)['vaginal']) as List;
    final content = weeks[(week < programWeeks ? week : programWeeks) - 1] as Map;
    final after = week > programWeeks;
    final t = context.a;
    final title = after ? text['after_title'] as String : fill(text['week_title'] as String, {'n': week});
    final desc = fill(text['home_card_desc'] as String, {'focus': after ? text['kegel_title'] : content['title']});
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: PressScale(
        scale: 0.98,
        onTap: onOpen,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [t.surface, t.lav1]),
            borderRadius: BorderRadius.circular(t.radiusLg),
            border: Border.all(color: t.line),
            boxShadow: t.cardShadow,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(14)),
                child: const Text('🌸', style: TextStyle(fontSize: 20)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(upper(text['title'] as String, language),
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: em(0.07, 11), color: t.inkSoft, height: 1.5)),
                  Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: t.ink, height: 1.5)),
                  Text(desc, style: TextStyle(fontSize: 13, height: 1.45, color: t.inkSoft)),
                ]),
              ),
              const SizedBox(width: 12),
              AIcon(AIcons.chevronRight, size: 18, color: t.inkFaint, mirrorInRtl: true),
            ]),
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: ExcludeSemantics(
                child: Row(children: [
                  for (var i = 0; i < programWeeks; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    Expanded(
                      child: Container(
                        height: 8,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(99),
                          color: i + 1 < week ? t.peach2 : (i + 1 == week ? null : t.peach1),
                          gradient: i + 1 == week
                              ? LinearGradient(colors: [t.peach2, t.peach2, t.peach1, t.peach1], stops: const [0, 0.5, 0.5, 1])
                              : null,
                        ),
                      ),
                    ),
                  ],
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
