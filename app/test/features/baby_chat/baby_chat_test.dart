// Ported from: src/lib/baby-chat.test.ts
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/baby_chat/baby_chat.dart';
import 'package:anacan/features/baby_chat/baby_chat_safety.dart';
import 'package:anacan/features/baby_chat/data/baby_chat_text.g.dart';
import 'package:flutter_test/flutter_test.dart';

final _dir = Directory('../src/data/baby-chat');
final List<String> languages = (_dir.listSync().whereType<File>().map((f) => f.uri.pathSegments.last).where((n) => n.endsWith('.json')).map((n) => n.replaceAll('.json', '')).toList()..sort());
Map<String, Object?> _json(String lang) => jsonDecode(File('${_dir.path}/$lang.json').readAsStringSync()) as Map<String, Object?>;
BabyChatText read(String lang) => BabyChatText(lang, Map<String, Object>.from(_json(lang)));
final BabyChatText az = read('az');
List<String> allReplies(BabyChatText t) => t.replies.values.expand((v) => v).toList();
List<String> _sortedKeys(Map<String, Object?> m) => m.keys.toList()..sort();

void main() {
  group('baby chat content', () {
    test('has every reply group, keyword group and UI text in all 21 languages', () {
      expect(languages, hasLength(25));
      for (final lang in languages) {
        final t = read(lang);
        expect(_sortedKeys(t.ui), _sortedKeys(az.ui), reason: lang);
        expect(_sortedKeys(t.replies), _sortedKeys(az.replies), reason: lang);
        expect(_sortedKeys(t.keywords), _sortedKeys(az.keywords), reason: lang);
        for (final e in t.replies.entries) {
          expect(e.value.length, az.replies[e.key]!.length, reason: '$lang.${e.key}');
        }
        expect(t.openers.isNotEmpty && t.notifications.isNotEmpty, isTrue, reason: lang);
      }
    });

    test('the compiled packs match the JSON files', () {
      expect(kBabyChatText.keys.toSet(), languages.toSet());
      for (final lang in languages) {
        expect(jsonEncode(kBabyChatText[lang]), jsonEncode(_json(lang)), reason: lang);
      }
      expect(loadBabyChatText('xx').language, 'en');
      expect(loadBabyChatText('ru').language, 'ru');
    });
  });

  group('baby replies', () {
    const facts = BabyWeekFacts(week: 8, fruit: 'Noxud', cm: 1.6, weeksLeft: 32);

    test("matches the mother's topic in Azerbaijani and other scripts", () {
      expect(detectIntent('Səni çox sevirəm 💛', az.keywords, 'az'), 'love');
      expect(detectIntent('Sən hələ noxud boydasan 😂', az.keywords, 'az'), 'size');
      expect(detectIntent('Atana salam de', az.keywords, 'az'), 'dad');
      expect(detectIntent('Necəsən balaca?', az.keywords, 'az'), isNotNull);
      expect(detectIntent('Я тебя люблю', read('ru').keywords, 'ru'), 'love');
      expect(detectIntent('大好きだよ', read('ja').keywords, 'ja'), 'love');
      expect(detectIntent('qwerty', az.keywords, 'az'), isNull);
    });

    test('answers with week facts and never leaves a placeholder', () {
      final size = babyReply('Nə boydasan?', az, facts, 'az', 's1');
      expect(az.replies['size']!.map((t) => t.replaceFirst('{fruit}', 'Noxud').replaceFirst('{cm}', '1.6').replaceFirst('{week}', '8')), contains(size));
      for (final lang in languages) {
        final t = read(lang);
        for (var i = 0; i < 30; i++) {
          final reply = babyReply(['love', 'kick', 'hello', 'zzz', 'meet', 'size'][i % 6], t, BabyWeekFacts(week: 10 + i, fruit: null, cm: 0.5, weeksLeft: 1), lang, 'x$i');
          expect(reply, isNot(matches(RegExp(r'\{\w+\}'))), reason: lang);
          expect(reply.trim().length, greaterThan(0), reason: lang);
        }
      }
    });

    test('keeps early-pregnancy answers realistic', () {
      final early = babyReply('təpik atdın?', az, const BabyWeekFacts(week: 10), 'az', 'a');
      expect(az.replies['kick_early'], contains(early));
      final late = babyReply('təpik atdın?', az, const BabyWeekFacts(week: 26), 'az', 'a');
      expect(az.replies['kick'], contains(late));
    });

    test('only uses curated lines', () {
      final reply = babyReply('random words here', az, facts, 'az', 'z');
      expect(allReplies(az).any((t) => t.replaceAll(RegExp(r'\{\w+\}'), '').isNotEmpty), isTrue);
      expect(az.replies['generic'], contains(reply));
    });
  });

  group('daily arrival', () {
    test('is between 09:00 and 20:30, stable for a user and day, and varies across days', () {
      final times = <String>{};
      for (var d = 1; d <= 20; d++) {
        final at = dailyArrival(DateTime(2026, 10, d, 3), 'user-1');
        expect(at.hour * 60 + at.minute, greaterThanOrEqualTo(9 * 60));
        expect(at.hour * 60 + at.minute, lessThanOrEqualTo(20 * 60 + 30));
        expect(dailyArrival(DateTime(2026, 10, d, 22), 'user-1').millisecondsSinceEpoch, at.millisecondsSinceEpoch);
        times.add('${at.hour}:${at.minute}');
      }
      expect(times.length, greaterThan(10));
    });

    test("builds the day's opener and content message", () {
      final msgs = dailyBabyMessages(az, 'Bu gün barmaqlarım çıxdı 🖐', DateTime(2026, 10, 30), 'u');
      expect(msgs.map((m) => m.from).toList(), ['baby', 'baby']);
      expect(az.openers, contains(msgs[0].text));
      expect(msgs[1].text, 'Bu gün barmaqlarım çıxdı 🖐');
    });
  });

  group('daily baby lines', () {
    test('are short, complete and in every language', () {
      for (final lang in languages) {
        final t = read(lang);
        expect((t.weekly.keys.map(int.parse).toList()..sort()), List.generate(38, (i) => i + 4), reason: lang);
        expect(t.daily, hasLength(az.daily.length), reason: lang);
        for (final line in [...t.weekly.values, ...t.daily]) {
          expect(line.length, lessThanOrEqualTo(110), reason: '$lang: $line');
        }
      }
    });

    test('uses the week line twice a week and the daily pool otherwise, without placeholders', () {
      expect(babyDailyLine(az, const BabyWeekFacts(week: 8, fruit: 'Noxud'), 56, 'u'), az.weekly['8']);
      expect(babyDailyLine(az, const BabyWeekFacts(week: 8, fruit: 'Noxud'), 59, 'u'), az.weekly['8']);
      for (var day = 1; day < 290; day++) {
        final line = babyDailyLine(az, BabyWeekFacts(week: day ~/ 7, fruit: day.isOdd ? 'Noxud' : null), day, 'u');
        expect(line, isNot(matches(RegExp(r'\{\w+\}'))));
        expect(line.length, greaterThan(0));
      }
    });
  });

  group('baby chat safety', () {
    final server = File('../supabase/functions/baby-chat-reply/index.ts').readAsStringSync();

    test('uses the same care lists as the server function', () {
      final start = server.indexOf('export const CARE_STEMS');
      final block = server.substring(start, server.indexOf('};', start));
      final serverStems = RegExp("'([^']+)'").allMatches(block).map((m) => m.group(1)!).toList()..sort();
      expect(serverStems, (kCareStems.values.expand((v) => v).toList()..sort()));
    });

    test('server function has no unpinned remote type references (they broke the worker boot on 2026-11-12)', () {
      expect(server, isNot(matches(RegExp(r'///\s*<reference types="https?:'))));
    });

    test('spots health and worry topics without false alarms', () {
      expect(hasCareTopic('Bu gün qarnımda ağrı var', 'az'), isTrue);
      expect(hasCareTopic('Körpə bu gün tərpənmir', 'az'), isTrue);
      expect(hasCareTopic('I am so worried about you', 'en'), isTrue);
      expect(hasCareTopic('У меня кровь', 'ru'), isTrue);
      expect(hasCareTopic('Səni çox sevirəm 💛', 'az'), isFalse);
      expect(hasCareTopic('I love the paint colour', 'en'), isFalse);
      expect(hasCareTopic('Die Sonne scheint', 'de'), isFalse);
    });
  });
}
