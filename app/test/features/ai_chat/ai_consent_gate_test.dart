// Ported from: src/components/consent/AiConsentGate.test.tsx
import 'package:anacan/features/ai_chat/ai_consent_gate.dart';
import 'package:anacan/features/entry/consent/consent_gate.dart';
import 'package:anacan/features/entry/consent/consent_gate_controller.dart' show consentServiceProvider;
import 'package:anacan/state/local_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

const _b = 'https://api.anacan.az';
Map<String, Object?> _state([Map<String, Object?> consents = const {}]) => {
      'gate': {'enabled': true, 'version': '2.0'},
      'consents': consents,
    };
const _granted = {'ai_assistant': {'granted': true, 'document_version': '2.0', 'created_at': 'x'}};

void main() {
  group('AiConsentGate', () {
    late List<(String, Map<String, dynamic>?)> rpc;
    late List<Object?> answers;

    ConsentService service(LocalStore store) => ConsentService(
          store: store,
          rpc: (fn, [params]) async {
            rpc.add((fn, params));
            return answers.length > 1 ? answers.removeAt(0) : answers.first;
          },
        );

    setUp(() {
      rpc = [];
      answers = [];
    });

    testWidgets('asks first; the chat opens only after consent, which is recorded as ai_assistant', (tester) async {
      answers = [_state(), _state(_granted)];
      final store = LocalStore.memory();
      final env = AiChatEnv(extra: [consentServiceProvider.overrideWithValue(service(store))]);
      await env.pump(tester, AiConsentGate(userId: 'u1', backend: _b, onDecline: () {}, child: const Text('chat')));
      await tester.pump();
      expect(find.byKey(const ValueKey('ai-consent-sheet')), findsOneWidget);
      expect(find.textContaining('Google-un Gemini xidmətinə ötürülür'), findsOneWidget);
      expect(find.text('chat'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('ai-consent-accept')));
      await tester.pump();
      await tester.pump();
      expect(find.text('chat'), findsOneWidget);
      final record = rpc.firstWhere((c) => c.$1 == 'record_consents_v1');
      expect(record.$2!['p_items'], [
        {'kind': 'ai_assistant', 'granted': true, 'version': '2.0'},
      ]);
      await env.finish(tester);
    });

    testWidgets('declining keeps the chat closed and calls onDecline; Türkiye users see the KVKK text', (tester) async {
      answers = [_state()];
      final store = LocalStore.memory();
      var declined = 0;
      final env = AiChatEnv(extra: [consentServiceProvider.overrideWithValue(service(store))]);
      await env.pump(tester, AiConsentGate(userId: 'u1', backend: _b, kvkk: true, onDecline: () => declined++, child: const Text('chat')));
      await tester.pump();
      expect(find.textContaining("Google LLC'ye (Gemini)"), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('ai-consent-decline')));
      await tester.pump();
      await tester.pump();
      expect(declined, 1);
      expect(find.text('chat'), findsNothing);
      await env.finish(tester);
    });

    testWidgets('opens straight away when consent was already granted', (tester) async {
      answers = [_state(_granted)];
      final store = LocalStore.memory();
      final env = AiChatEnv(extra: [consentServiceProvider.overrideWithValue(service(store))]);
      await env.pump(tester, AiConsentGate(userId: 'u1', backend: _b, onDecline: () {}, child: const Text('chat')));
      await tester.pump();
      expect(find.text('chat'), findsOneWidget);
      await env.finish(tester);
    });

    testWidgets('a decision already made on this device opens the chat before the server answers', (tester) async {
      answers = [_state(_granted)];
      final store = LocalStore.memory({'anacan_ai_consent_v1:$_b:u1': '{"granted":true,"at":"x"}'});
      final env = AiChatEnv(extra: [consentServiceProvider.overrideWithValue(service(store))]);
      await env.pump(tester, AiConsentGate(userId: 'u1', backend: _b, onDecline: () {}, child: const Text('chat')));
      expect(find.text('chat'), findsOneWidget);
      await env.finish(tester);
    });
  });
}
