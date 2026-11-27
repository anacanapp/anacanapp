// Ported from: src/components/partner/PartnerAIPremiumGate.test.tsx
import 'package:anacan/features/ai_chat/ai_chat_inputs.dart';
import 'package:anacan/features/ai_chat/ai_chat_screen.dart';
import 'package:anacan/features/ai_chat/ai_premium_gate.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

class _Premium extends Notifier<AiPremiumState> {
  @override
  AiPremiumState build() => const AiPremiumState(isPremium: false, loading: false);
  void set(AiPremiumState s) => state = s;
}

final _premium = NotifierProvider<_Premium, AiPremiumState>(_Premium.new);

AiChatEnv _env() => AiChatEnv(extra: [
      aiPremiumStateProvider.overrideWith((ref) => ref.watch(_premium)),
      aiPartnerSourceProvider.overrideWithValue(
        const AiPartnerSource(name: 'Fixture', lifeStage: 'flow', lastPeriodDate: '2026-10-01', cycleLength: 28, shareCycle: false),
      ),
    ]);

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void _set(AiChatEnv env, AiPremiumState s) => env.container.read(_premium.notifier).set(s);

void main() {
  testWidgets('opens the standard paywall for a free partner without mounting the paid chat', (tester) async {
    final env = _env();
    await env.pump(tester, const AiPremiumGate());
    await tester.pump();
    expect(find.byType(AIChatScreen), findsNothing);
    expect(find.text('Standard Premium paywall'), findsNothing); // the partner is not auto-prompted
    await tester.ensureVisible(find.byKey(const ValueKey('ai-gate-upgrade')));
    await tester.tap(find.byKey(const ValueKey('ai-gate-upgrade')));
    await tester.pump();
    await _settle(tester);
    expect(find.text('Standard Premium paywall'), findsOneWidget);
    expect(env.paywalls, ['partner_ai_tab']);
    await env.finish(tester);
  });

  testWidgets('stops an open partner chat and opens the standard paywall when its household grant ends', (tester) async {
    final env = _env();
    _set(env, const AiPremiumState(isPremium: true, loading: false));
    await env.pump(tester, const AiPremiumGate());
    await tester.pump();
    expect(find.byType(AIChatScreen), findsOneWidget);
    _set(env, const AiPremiumState(isPremium: false, loading: false));
    await tester.pump();
    await _settle(tester);
    expect(find.byType(AIChatScreen), findsNothing);
    expect(env.paywalls, ['partner_ai_tab']);
    expect(find.text('Standard Premium paywall'), findsOneWidget);
    await tester.tap(find.text('Standard Premium paywall'));
    await tester.pump();
    await _settle(tester);
    expect(find.text('Standard Premium paywall'), findsNothing);
    expect(find.byType(AIChatScreen), findsNothing);
    await env.finish(tester);
  });

  testWidgets("gives Ata AI the woman's stage but not unshared cycle dates", (tester) async {
    final env = _env();
    _set(env, const AiPremiumState(isPremium: true, loading: false));
    await env.pump(tester, const AiPremiumGate());
    await tester.pump();
    final chat = tester.widget<AIChatScreen>(find.byType(AIChatScreen));
    expect(chat.partner!.lifeStage, 'flow');
    expect(chat.partner!.lastPeriodDate, isNull);
    expect(chat.partner!.womanName, 'Fixture');
    await env.finish(tester);
  });

  testWidgets("woman's Anacan.AI: a free user gets the paywall on entry and never the chat", (tester) async {
    final env = _env();
    _set(env, const AiPremiumState(isPremium: false, loading: false, entitlementReady: true));
    await env.pump(tester, const AiPremiumGate(self: true, child: Text('Own chat')));
    await tester.pump();
    await _settle(tester);
    expect(find.text('Own chat'), findsNothing);
    expect(find.text('Standard Premium paywall'), findsOneWidget);
    expect(env.paywalls, ['ai_tab']);
    await tester.tap(find.text('Standard Premium paywall'));
    await tester.pump();
    await _settle(tester);
    expect(find.text('Standard Premium paywall'), findsNothing);
    expect(find.text('Own chat'), findsNothing);
    await env.finish(tester);
  });

  testWidgets("woman's Anacan.AI: a Premium user goes straight to the chat", (tester) async {
    final env = _env();
    _set(env, const AiPremiumState(isPremium: true, loading: false, entitlementReady: true));
    await env.pump(tester, const AiPremiumGate(self: true, child: Text('Own chat')));
    await tester.pump();
    expect(find.text('Own chat'), findsOneWidget);
    expect(find.text('Standard Premium paywall'), findsNothing);
    await env.finish(tester);
  });

  testWidgets('shows a retry state instead of a spinner or paywall when the Premium check failed', (tester) async {
    final env = _env();
    var refetched = 0;
    _set(env, AiPremiumState(isPremium: false, loading: false, entitlementReady: false, entitlementError: true, refetch: (ref) async => refetched++));
    await env.pump(tester, const AiPremiumGate(self: true));
    await tester.pump();
    expect(find.byKey(const ValueKey('ai-gate-alert')), findsOneWidget);
    expect(find.text('Premium statusu yoxlanmadı'), findsOneWidget);
    expect(find.text('Standard Premium paywall'), findsNothing);
    await tester.tap(find.text('Yenidən cəhd et'));
    await tester.pump();
    expect(refetched, 1);
    await env.finish(tester);
  });

  testWidgets('stops spinning after a bounded wait and offers a retry', (tester) async {
    final env = _env();
    _set(env, const AiPremiumState(isPremium: false, loading: true));
    await env.pump(tester, const AiPremiumGate(self: true));
    expect(find.byKey(const ValueKey('ai-gate-alert')), findsNothing);
    expect(find.byKey(const ValueKey('ai-gate-loading')), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 15001));
    expect(find.byKey(const ValueKey('ai-gate-alert')), findsOneWidget);
    await env.finish(tester);
  });
}
