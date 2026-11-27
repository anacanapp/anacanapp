// Ported from: (no React test) — behaviour of src/components/baby-chat/BabyChatScreen.tsx, BabyChatCard.tsx,
//              src/hooks/useBabyChat.ts, src/lib/baby-chat-ai.ts and src/lib/baby-chat-notifications.ts
import 'dart:async';

import 'package:anacan/core/data/db.dart' show DbResult;
import 'package:anacan/features/baby_chat/baby_chat.dart';
import 'package:anacan/features/baby_chat/baby_chat_ai.dart';
import 'package:anacan/features/baby_chat/baby_chat_card.dart';
import 'package:anacan/features/baby_chat/baby_chat_notifications.dart';
import 'package:anacan/features/baby_chat/baby_chat_screen.dart';
import 'package:anacan/features/baby_chat/baby_chat_share.dart';
import 'package:anacan/features/baby_chat/use_baby_chat.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

Future<void> _type(WidgetTester tester, String text) async {
  await tester.enterText(find.byKey(const ValueKey('bc-input')), text);
  await tester.pump();
}

Future<void> _settle(WidgetTester tester, [int ms = 2000]) async {
  for (var i = 0; i < ms ~/ 100; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  group('useBabyChat', () {
    test('week facts, arrival and the pending daily messages; delivered once saved', () {
      final env = BabyChatEnv();
      addTearDown(env.container.dispose);
      final chat = env.container.read(babyChatProvider);
      expect(chat.facts.week, 23);
      expect(chat.userId, 'user-1');
      expect(chat.arrived, isTrue);
      expect(chat.unread, isTrue);
      expect(chat.pendingDaily.map((m) => m.id), ['2026-11-27-open', '2026-11-27-daily']);
      expect(chat.pendingDaily.last.text, chat.dailyMessage);
      env.container.read(babyChatThreadsProvider.notifier).setThread(chat.today, chat.pendingDaily);
      expect(env.container.read(babyChatProvider).unread, isFalse);
      expect(env.store.getItem('anacan_baby_chat_v1:user-1'), contains('2026-11-27-daily'));
    });

    test('before the arrival time nothing is pending and the previous day is shown', () {
      final env = BabyChatEnv(now: DateTime(2026, 11, 27, 8));
      addTearDown(env.container.dispose);
      saveThread(env.store, 'user-1', '2026-11-26', const [BabyChatMessage(id: 'y', from: 'baby', text: 'dünən', at: 1)]);
      env.container.invalidate(babyChatThreadsProvider);
      final chat = env.container.read(babyChatProvider);
      expect(chat.arrived, isFalse);
      expect(chat.unread, isFalse);
      expect(chat.previousThread.single.text, 'dünən');
    });
  });

  group('BabyChatScreen', () {
    testWidgets("delivers today's messages with a typing pause, then answers the mother with a curated line", (tester) async {
      final env = BabyChatEnv();
      await env.pump(tester, BabyChatScreen(onBack: () {}));
      expect(find.text('yazır…'), findsOneWidget); // header subtitle while typing
      await _settle(tester, 4000);
      final chat = env.container.read(babyChatProvider);
      expect(chat.thread.map((m) => m.id), ['2026-11-27-open', '2026-11-27-daily']);
      expect(find.text(chat.dailyMessage!), findsOneWidget);
      expect(find.byKey(const ValueKey('bc-share')), findsNothing); // the mother has not written yet

      await _type(tester, 'Səni çox sevirəm 💛');
      await tester.tap(find.byKey(const ValueKey('bc-send')));
      await _settle(tester, 600);
      final thread = env.container.read(babyChatProvider).thread;
      expect(thread[2].from, 'mom');
      expect(thread[3].from, 'baby');
      expect(loadBabyChatText('az').reply('love').map((t) => t.replaceAll('{week}', '23')), contains(thread[3].text));
      expect(env.aiCalls.single['message'], 'Səni çox sevirəm 💛');
      expect(env.aiCalls.single['week'], 23);
      expect(find.byKey(const ValueKey('bc-share')), findsOneWidget);
      expect(find.byKey(const ValueKey('bc-care')), findsNothing);
      await env.finish(tester);
    });

    testWidgets('a health worry gets a care line and the doctor card without asking the AI', (tester) async {
      final env = BabyChatEnv();
      var assistant = 0;
      await env.pump(tester, BabyChatScreen(onBack: () {}, onOpenAssistant: () => assistant++));
      await _settle(tester, 4000);
      await _type(tester, 'Bu gün qarnımda ağrı var');
      await tester.tap(find.byKey(const ValueKey('bc-send')));
      await _settle(tester, 600);
      expect(env.aiCalls, isEmpty);
      final text = loadBabyChatText('az');
      expect(text.reply('care'), contains(env.container.read(babyChatProvider).thread.last.text));
      expect(find.byKey(const ValueKey('bc-care')), findsOneWidget);
      await tester.tap(find.text(text.u('care_cta')));
      expect(assistant, 1);
      await env.finish(tester);
    });

    testWidgets('uses the AI reply when the function answers, and its care label', (tester) async {
      final env = BabyChatEnv(aiReply: 'Salam ana, mən buradayam 💛');
      await env.pump(tester, BabyChatScreen(onBack: () {}));
      await _settle(tester, 4000);
      await _type(tester, 'Necəsən balaca?');
      await tester.tap(find.byKey(const ValueKey('bc-send')));
      await _settle(tester, 600);
      expect(env.container.read(babyChatProvider).thread.last.text, 'Salam ana, mən buradayam 💛');
      await env.finish(tester);
    });

    testWidgets('photo share: render first, then share from the preview sheet', (tester) async {
      final env = BabyChatEnv();
      await env.pump(tester, BabyChatScreen(onBack: () {}));
      await _settle(tester, 4000);
      await _type(tester, 'Salam');
      await tester.tap(find.byKey(const ValueKey('bc-send')));
      await _settle(tester, 600);
      await tester.ensureVisible(find.byKey(const ValueKey('bc-share-photo')));
      await tester.tap(find.byKey(const ValueKey('bc-share-photo')));
      await _settle(tester, 300);
      expect(env.rendered.single.messages.length, 4);
      expect(env.rendered.single.dayLabel, '23. həftə · Bu gün');
      expect(find.byKey(const ValueKey('bc-sheet')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('bc-share-now')));
      await _settle(tester, 300);
      expect(env.sharer.shared, ['anacan-korpem-2026-11-27.png']);
      await tester.tapAt(const Offset(20, 20)); // backdrop closes the sheet
      await tester.pump();
      expect(find.byKey(const ValueKey('bc-sheet')), findsNothing);
      await env.finish(tester);
    });

    testWidgets('the send button is disabled without text', (tester) async {
      final env = BabyChatEnv(now: DateTime(2026, 11, 27, 8));
      await env.pump(tester, BabyChatScreen(onBack: () {}));
      await tester.tap(find.byKey(const ValueKey('bc-send')));
      await tester.pump();
      expect(env.container.read(babyChatProvider).thread, isEmpty);
      expect(find.text(loadBabyChatText('az').u('card_wait')), findsOneWidget);
      await env.finish(tester);
    });
  });

  group('BabyChatCard', () {
    testWidgets('unread: the new-message line and the reply button; opens the chat', (tester) async {
      final env = BabyChatEnv();
      var opened = 0;
      await env.pump(tester, Center(child: BabyChatCard(onOpen: () => opened++)));
      await _settle(tester, 400);
      final text = loadBabyChatText('az');
      expect(find.text(text.u('card_new')), findsOneWidget);
      expect(find.byKey(const ValueKey('bc-unread-dot')), findsOneWidget);
      expect(find.text(text.u('card_cta')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('baby-chat-card')));
      expect(opened, 1);
      await env.finish(tester);
    });

    testWidgets('before the arrival: the week and the waiting line, no button', (tester) async {
      final env = BabyChatEnv(now: DateTime(2026, 11, 27, 8));
      await env.pump(tester, Center(child: BabyChatCard(onOpen: () {})));
      await _settle(tester, 400);
      final text = loadBabyChatText('az');
      expect(find.text('23. həftə'), findsOneWidget);
      expect(find.text(text.u('card_wait')), findsOneWidget);
      expect(find.text(text.u('card_cta')), findsNothing);
      await env.finish(tester);
    });
  });

  group('askBabyAi', () {
    const facts = BabyWeekFacts(week: 20, fruit: 'banan', cm: 25.6, weeksLeft: 20);

    test('returns the trimmed reply and the care label', () async {
      final r = await askBabyAi((name, body) async => const DbResult<Object?>(data: {'reply': '  Salam  ', 'care': true}), 'hi', facts, 'az');
      expect(r.reply, 'Salam');
      expect(r.care, isTrue);
    });

    test('null on errors, long replies and timeouts', () async {
      expect((await askBabyAi((n, b) async => const DbResult<Object?>(error: 'x'), 'hi', facts, 'az')).reply, isNull);
      expect((await askBabyAi((n, b) async => DbResult<Object?>(data: {'reply': 'x' * 161}), 'hi', facts, 'az')).reply, isNull);
      final never = Completer<DbResult<Object?>>();
      final r = await askBabyAi((n, b) => never.future, 'hi', facts, 'az', timeout: const Duration(milliseconds: 20));
      expect(r.reply, isNull);
      expect(r.care, isFalse);
    });
  });

  group('baby chat share', () {
    test('wraps by measured width and keeps paragraphs', () {
      double m(String s) => s.length.toDouble();
      expect(wrapText('bir iki üç dörd', 7, m), ['bir iki', 'üç dörd']);
      expect(wrapText('uzunsözbirdən', 4, m), ['uzunsözbirdən']);
      expect(wrapText('a\nb', 10, m), ['a', 'b']);
      expect(wrapText('', 10, m), ['']);
    });

    testWidgets('renders a 1080×1920 PNG of the last messages', (tester) async {
      final text = loadBabyChatText('az');
      final bytes = await tester.runAsync(() => renderChatPhoto(ShareChatInput(
            messages: const [
              BabyChatMessage(id: 'a', from: 'baby', text: 'Salam ana', at: 1),
              BabyChatMessage(id: 'b', from: 'mom', text: 'Salam balam', at: 2),
            ],
            text: text,
            subtitle: '23. həftə',
            chip: '28.9 sm',
            dayLabel: '23. həftə · Bu gün',
            rtl: false,
          )));
      expect(bytes!.sublist(0, 4), [137, 80, 78, 71]);
      // IHDR width / height (big endian).
      expect(bytes.buffer.asByteData().getUint32(16), 1080);
      expect(bytes.buffer.asByteData().getUint32(20), 1920);
      expect(videoRecordingSupported(), isFalse);
    });
  });

  group('baby chat notifications', () {
    test('the next week of arrivals, ids 7300+, only those more than a minute ahead', () {
      final text = loadBabyChatText('az');
      final now = DateTime(2026, 11, 27, 21);
      final plan = planBabyChatNotifications(text, 'user-1', now);
      expect(plan.length, 6); // today's arrival (≤ 20:29) has passed
      expect(plan.map((n) => n.id), [7301, 7302, 7303, 7304, 7305, 7306]);
      for (final n in plan) {
        expect(n.title, text.u('notif_title'));
        expect(text.notifications, contains(n.body));
        expect(n.extra, {'type': 'baby_chat'});
        expect(n.at, greaterThan(now.millisecondsSinceEpoch + 60000));
      }
      expect(planBabyChatNotifications(text, 'user-1', DateTime(2026, 11, 27, 6)).length, 7);
    });
  });
}
