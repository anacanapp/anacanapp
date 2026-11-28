// Ported from: (visual regression baselines of src/components/AIChatScreen.tsx, AiConsentGate.tsx,
//              PartnerAIPremiumGate.tsx — Flutter renders; the welcome screen is compared by eye with the reference
//              shot bump.tabs__ai)
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/features/ai_chat/ai_chat_inputs.dart' show aiChatClockProvider;
import 'package:anacan/features/ai_chat/ai_chat_screen.dart';
import 'package:anacan/features/ai_chat/ai_consent_gate.dart';
import 'package:anacan/features/ai_chat/ai_premium_gate.dart';
import 'package:anacan/features/entry/consent/consent_gate.dart';
import 'package:anacan/features/entry/consent/consent_gate_controller.dart' show consentServiceProvider;
import 'package:anacan/state/local_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import 'support.dart';

Future<void> _golden(WidgetTester tester, String name) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  await settleSvgs(tester);
  await expectLater(find.byType(GalleryFrame), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  setUpAll(loadAnacanFonts);

  for (final dark in [false, true]) {
    testWidgets('chat welcome (${dark ? 'dark' : 'light'})', (tester) async {
      // Frozen clock of the reference shots (welcome timestamp 09:00).
      final env = AiChatEnv(extra: [aiChatClockProvider.overrideWithValue(() => DateTime(2026, 11, 20, 9))]);
      await env.pump(tester, const AIChatScreen(), dark: dark);
      await _golden(tester, 'ai_chat_welcome_${dark ? 'dark' : 'light'}');
      await env.finish(tester);
    });
  }

  testWidgets('consent sheet', (tester) async {
    final env = AiChatEnv(extra: [
      consentServiceProvider.overrideWithValue(ConsentService(
        store: LocalStore.memory(),
        rpc: (fn, [params]) async => {'gate': {'enabled': true, 'version': '2.0'}, 'consents': <String, Object?>{}},
      )),
    ]);
    await env.pump(tester, AiConsentGate(userId: 'u1', backend: 'b', onDecline: () {}, child: const SizedBox()));
    await _golden(tester, 'ai_consent_light');
    await env.finish(tester);
  });

  testWidgets('locked (free user)', (tester) async {
    final env = AiChatEnv(extra: [
      aiPremiumStateProvider.overrideWithValue(const AiPremiumState(isPremium: false, loading: false, entitlementReady: true)),
    ]);
    await env.pump(tester, const AiPremiumGate(), size: const Size(390, 844));
    await _golden(tester, 'ai_locked_light');
    await env.finish(tester);
  });
}
