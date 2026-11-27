// Ported from: src/pages/Index.tsx (`case 'ai'` for the woman: PartnerAIPremiumGate self → AiConsentGate →
//              AIChatScreen; for the partner: AiConsentGate → PartnerAIPremiumGate (Ata AI); consentBackend /
//              consentKvkk; `onDecline={() => setActiveTab('home')}`), src/components/flow/PeriodDelayBanner.tsx
//              (`navigate('/ai-chat?prompt=…')`)
//
// Overrides for the app root (app/lib/app/app_wiring.dart):
//   flowOpenAiChatProvider.overrideWith(aiChatFlowOpener),
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart' show shellProvider;
import '../../state/shell_bindings.dart' show backendUrlProvider;
import '../../state/user_store.dart';
import '../entry/consent/consent_gate.dart' show isKvkkUser;
import 'ai_chat_inputs.dart';
import 'ai_chat_screen.dart';
import 'ai_consent_gate.dart';
import 'ai_premium_gate.dart';

export 'ai_chat_inputs.dart'
    show
        aiAnswerCardProvider,
        aiChatPendingPromptProvider,
        aiKickSessionsProvider,
        aiMotherMealsProvider,
        aiPartnerSourceProvider,
        aiWeightEntriesProvider,
        AiAnswerCardBuilder,
        AiPartnerSource;
export 'ai_chat_screen.dart' show AIChatScreen;
export 'chat_media.dart' show chatMediaObjectPath, signChatMediaUrl, clearChatMediaSignedCache, chatMediaSrcProvider;

/// Value for `flowOpenAiChatProvider`: the AI tab with [prompt] in the input.
void Function(String prompt) aiChatFlowOpener(Ref ref) => (prompt) {
      ref.read(aiChatPendingPromptProvider.notifier).set(prompt);
      ref.read(shellProvider.notifier).setTab(ShellTab.ai);
    };

/// The AI tab of the woman (`partner: false`) or the partner.
class AiTab extends ConsumerWidget {
  const AiTab({super.key, required this.partner});
  final bool partner;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(authUserProvider.select((u) => u?.id));
    String backend = '';
    try {
      backend = ref.watch(backendUrlProvider);
    } catch (_) {}
    final profileCountry = ref.watch(authProfileProvider.select((p) => p?.countryCode));
    final store = ref.watch(userStoreProvider.select((s) => (country: s.countryCode, language: s.language)));
    final kvkk = isKvkkUser((profileCountry != null && profileCountry.isNotEmpty) ? profileCountry : store.country, store.language);
    void decline() => ref.read(shellProvider.notifier).setTab(ShellTab.home);
    if (partner) {
      return AiConsentGate(userId: userId, backend: backend, kvkk: kvkk, onDecline: decline, child: const AiPremiumGate());
    }
    // Anacan.AI is Premium only: the paywall comes first, the AI consent only for Premium users.
    return AiPremiumGate(
      self: true,
      child: AiConsentGate(userId: userId, backend: backend, kvkk: kvkk, onDecline: decline, child: const AIChatScreen()),
    );
  }
}

void registerAiChatFeature(FeatureRegistry r) {
  r.registerTab(ShellTab.ai, (context, a) => const AiTab(partner: false), fillsViewport: true);
  r.registerTab(ShellTab.ai, (context, a) => const AiTab(partner: true), partner: true, fillsViewport: true);
}
