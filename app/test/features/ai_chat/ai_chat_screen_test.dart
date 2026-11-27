// Ported from: (no React test) — rendering and interactions of src/components/AIChatScreen.tsx
import 'dart:async';

import 'package:anacan/features/ai_chat/ai_chat_inputs.dart';
import 'package:anacan/features/ai_chat/ai_chat_logic.dart';
import 'package:anacan/features/ai_chat/ai_chat_screen.dart';
import 'package:anacan/features/ai_chat/register.dart' show aiChatFlowOpener;
import 'package:anacan/features/home_flow/flow_platform.dart' show flowOpenAiChatProvider;
import 'package:anacan/shell/nav/ids.dart' show ShellTab;
import 'package:anacan/shell/nav/shell_controller.dart' show shellProvider;
import 'package:anacan/shell/shell_inputs.dart' show ShellUser, shellUserProvider;
import 'package:flutter/services.dart' show SystemChannels;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

Future<void> _settle(WidgetTester tester, [int ms = 500]) async {
  for (var i = 0; i < ms ~/ 50; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

EditableText _input(WidgetTester tester) => tester.widget<EditableText>(find.byKey(const ValueKey('ai-input')));

void main() {
  testWidgets('welcome + suggestions; a suggestion streams an answer with Stop, then markdown and the time row', (tester) async {
    final env = AiChatEnv();
    await env.pump(tester, const AIChatScreen());
    await _settle(tester);
    expect(find.textContaining('Mən Anacan.AI. Körpə baxımı'), findsOneWidget);
    expect(find.text('Məsləhət üçün sual seçin:'), findsOneWidget);
    expect(find.text('Körpəmi necə düzgün əmizdirməliyəm?'), findsOneWidget);
    expect(env.suggestedArgs.last, ('mommy', 'mother'));

    late StreamCall call;
    env.client.onCall = (c) {
      call = c;
      c.open();
      c.add(sse('**Əmizdirmə** '));
    };
    await tester.tap(find.text('Körpəmi necə düzgün əmizdirməliyəm?'));
    await _settle(tester, 300);
    expect(env.consumed, 1);
    expect(find.byKey(const ValueKey('ai-stop')), findsOneWidget);
    expect(find.text('Məsləhət üçün sual seçin:'), findsNothing);
    expect(find.textContaining('**Əmizdirmə**'), findsOneWidget); // plain text while streaming
    expect(call.request.headers['Authorization'], 'Bearer jwt-1');
    expect(call.json['lifeStage'], 'mommy');

    call.add(sse('haqqında'));
    unawaited(call.close());
    await _settle(tester, 300);
    expect(find.byKey(const ValueKey('ai-stop')), findsNothing);
    expect(find.byKey(const ValueKey('ai-send')), findsOneWidget);
    expect(find.textContaining('**'), findsNothing); // rendered as markdown
    expect(find.textContaining('Əmizdirmə'), findsWidgets);
    expect(env.history.inserts.map((r) => r['role']), ['user', 'assistant']);
    expect(env.history.inserts.last['content'], '**Əmizdirmə** haqqında');
    await env.finish(tester);
  });

  testWidgets('Stop keeps the partial answer', (tester) async {
    final env = AiChatEnv();
    await env.pump(tester, const AIChatScreen());
    await _settle(tester);
    env.client.onCall = (c) {
      c.open();
      c.add(sse('Yarımçıq'));
    };
    await tester.enterText(find.byKey(const ValueKey('ai-input')), 'Sual');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('ai-send')));
    await _settle(tester, 300);
    await tester.tap(find.byKey(const ValueKey('ai-stop')));
    await _settle(tester, 300);
    expect(find.textContaining('Yarımçıq'), findsOneWidget);
    expect(find.byKey(const ValueKey('ai-send')), findsOneWidget);
    expect(_input(tester).controller.text, isEmpty);
    await env.finish(tester);
  });

  testWidgets('the medical banner expands with the emergency number and can be dismissed for good', (tester) async {
    final env = AiChatEnv();
    await env.pump(tester, const AIChatScreen());
    await _settle(tester);
    expect(find.text('Tibbi məsləhət əvəzi deyil — ətraflı üçün toxunun'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('ai-warn-toggle')));
    await tester.pump();
    expect(find.textContaining('Təcili hallarda 103 nömrəsinə zəng edin.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('ai-warn-close')));
    await tester.pump();
    expect(find.byKey(const ValueKey('ai-warn')), findsNothing);
    expect(env.store.getItem(kAiWarnDismissedKey), '1');
    await env.finish(tester);
  });

  testWidgets('restored history replaces the welcome; copy shows "Kopyalandı"; reset clears the rows', (tester) async {
    final env = AiChatEnv();
    final clipboard = <Object?>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') clipboard.add(call.arguments);
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    env.history.rows.addAll([
      {'id': 'r1', 'user_id': 'user-1', 'chat_type': 'woman', 'role': 'user', 'content': 'Köhnə sual', 'created_at': '2026-11-26T10:00:00Z'},
      {'id': 'r2', 'user_id': 'user-1', 'chat_type': 'woman', 'role': 'assistant', 'content': 'Köhnə cavab', 'created_at': '2026-11-26T10:00:05Z'},
      {'id': 'r3', 'user_id': 'user-1', 'chat_type': 'partner', 'role': 'user', 'content': 'Partnyor', 'created_at': '2026-11-26T10:00:05Z'},
    ]);
    await env.pump(tester, const AIChatScreen());
    await _settle(tester);
    expect(find.text('Köhnə sual'), findsOneWidget);
    expect(find.text('Partnyor'), findsNothing);
    expect(find.textContaining('Mən Anacan.AI'), findsNothing);
    expect(find.text('Məsləhət üçün sual seçin:'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('ai-copy-r2')));
    await tester.pump();
    await tester.pump();
    expect(find.text('Kopyalandı'), findsOneWidget);
    expect(clipboard.single, {'text': 'Köhnə cavab'});
    await tester.pump(const Duration(milliseconds: 1700));
    expect(find.text('Kopyalandı'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('ai-reset')));
    await _settle(tester);
    expect(env.history.clears, 1);
    expect(find.text('Köhnə sual'), findsNothing);
    expect(find.textContaining('Mən Anacan.AI'), findsOneWidget);
    await env.finish(tester);
  });

  testWidgets('Ata AI: partner header, partner questions and the partner history', (tester) async {
    final env = AiChatEnv();
    await env.pump(tester, const AIChatScreen(partner: AiPartnerContext(lifeStage: 'bump', pregnancyWeek: 20)));
    await _settle(tester);
    expect(find.text('Ata AI'), findsOneWidget);
    expect(find.text('Ona necə dəstək olum?'), findsOneWidget);
    expect(env.suggestedArgs.last, ('bump', 'partner'));
    env.client.onCall = (c) {
      c.open();
      unawaited(c.close());
    };
    await tester.tap(find.text('Ona necə dəstək olum?'));
    await _settle(tester, 300);
    expect(env.client.calls.single.json['isPartner'], true);
    expect(env.client.calls.single.json['pregnancyWeek'], 20);
    expect(env.history.inserts.first['chat_type'], 'partner');
    await env.finish(tester);
  });

  testWidgets('the free limit opens the paywall instead of sending', (tester) async {
    final env = AiChatEnv(allowed: false, remaining: 0);
    await env.pump(tester, const AIChatScreen());
    await _settle(tester);
    await tester.enterText(find.byKey(const ValueKey('ai-input')), 'Sual');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('ai-send')));
    await _settle(tester, 600);
    expect(env.paywalls, hasLength(1));
    expect(env.client.calls, isEmpty);
    await env.finish(tester);
  });

  testWidgets('a prompt handed over by the flow home opens the AI tab and fills the input', (tester) async {
    final env = AiChatEnv(extra: [
      flowOpenAiChatProvider.overrideWith(aiChatFlowOpener),
      shellUserProvider.overrideWithValue(
        const ShellUser(isAuthenticated: true, authLoading: false, profileLoaded: true, language: 'az', backendUrl: '', userId: 'user-1', role: 'woman', lifeStage: 'flow'),
      ),
    ]);
    env.container.read(flowOpenAiChatProvider)('Periodum 5 gün gecikib, nə edə bilərəm?');
    expect(env.container.read(shellProvider).activeTab, ShellTab.ai);
    await env.pump(tester, const AIChatScreen());
    await _settle(tester);
    expect(_input(tester).controller.text, 'Periodum 5 gün gecikib, nə edə bilərəm?');
    expect(env.container.read(aiChatPendingPromptProvider), isNull);
    await env.finish(tester);
  });

  testWidgets('offline status in the header', (tester) async {
    final env = AiChatEnv(online: false);
    await env.pump(tester, const AIChatScreen());
    await _settle(tester);
    expect(find.text('Oflayn · Həkim məsləhəti əvəzi deyil'), findsOneWidget);
    await env.finish(tester);
  });
}
