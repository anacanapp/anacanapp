// Ported from: src/components/pregnancy-loss/ProfilePregnancyCard.tsx
//
// Profile → "Hamiləliyim": pregnancy dates, "Körpəm doğuldu" and the calm "Hamiləliyim davam etmir" entry. During
// loss recovery the same card links the recovery guide and the memories instead.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../onboarding/birth_onboarding_modal.dart' show showBirthOnboardingModal;
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../loss/loss_ui.dart';
import '../loss/pregnancy_loss.dart';
import 'pregnancy_loss_sheet.dart';

class ProfilePregnancyCard extends ConsumerWidget {
  const ProfilePregnancyCard({super.key, this.onNavigate});
  final void Function(String screen)? onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final profile = ref.watch(authProfileProvider);
    final t = ref.watch(pregnancyLossTextProvider).sub('ui');
    final recovering = lifeStage == 'flow' && (profile?.lossRecoveryActive ?? false);
    if (lifeStage != 'bump' && !recovering) return const SizedBox.shrink();
    final a = context.a;
    final l = LossTokens.of(context);

    Widget row(String icon, Color tint, String title, String sub, VoidCallback onTap, {bool last = false}) =>
        LossRow(leading: LossRowIcon(emoji: icon, color: tint), title: title, sub: sub, onTap: onTap, last: last);

    return FadeRise(
      delay: const Duration(milliseconds: 260),
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: ACard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 6, 0, 2),
              child: Semantics(
                header: true,
                child: Text(recovering ? t.s('guide_title') : t.s('section_title'), style: px(14.5, weight: FontWeight.w700, color: a.ink, ls: -0.02)),
              ),
            ),
            if (recovering) ...[
              row('🌿', l.soft, t.s('guide_title'), t.s('guide_sub'), () => onNavigate?.call('loss-guide')),
              row('🤍', l.soft, t.s('memories_title'), t.s('memories_sub'), () => onNavigate?.call('loss-memories'), last: true),
            ] else ...[
              row('📅', a.peach1, t.s('dates_row'), t.s('dates_sub'), () => onNavigate?.call('edit-profile')),
              // BirthOnboardingModal onComplete: React reloads the page; the store switch to mommy rebuilds instead.
              row('👶', a.green1, t.s('birth_row'), t.s('birth_sub'), () => showBirthOnboardingModal(context, onComplete: () {})),
              row('🤍', l.soft, t.s('entry_title'), t.s('entry_sub'), () async {
                final done = await showPregnancyLossSheet(context);
                if (done == true) onNavigate?.call('home');
              }),
              Padding(
                padding: const EdgeInsets.fromLTRB(2, 8, 2, 6),
                child: Text(t.s('entry_note'), style: px(11.5, color: a.inkSoft, height: 1.45)),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}
