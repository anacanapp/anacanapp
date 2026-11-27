// Ported from: src/data/postpartum-partner/postpartum-partner.test.ts, src/lib/dates-group.test.ts ('dayKey / isoDay
//              use the local day', isoDay part), src/hooks/usePartnerDailyTips.ts (useDailyTip pick)
import 'dart:convert';
import 'dart:io';

import 'package:anacan/features/partner/data/partner_content.dart';
import 'package:anacan/features/partner/data/partner_family.dart';
import 'package:anacan/features/partner/generated/postpartum_partner_text.g.dart';
import 'package:flutter_test/flutter_test.dart';

Object? _shape(Object? x) => x is List
    ? [for (final e in x) _shape(e)]
    : x is Map
        ? {for (final e in x.entries) e.key: _shape(e.value)}
        : x.runtimeType.toString();

List<String> _strings(Object? x) => x is List
    ? [for (final e in x) ..._strings(e)]
    : x is Map
        ? [for (final v in x.values) ..._strings(v)]
        : ['$x'];

void main() {
  final dir = Directory('../src/data/postpartum-partner');
  final languages = dir.listSync().whereType<File>().where((f) => f.path.endsWith('.json')).map((f) => f.uri.pathSegments.last.replaceAll('.json', '')).toList();
  Map<String, dynamic> read(String lang) => jsonDecode(File('${dir.path}/$lang.json').readAsStringSync()) as Map<String, dynamic>;

  group('postpartum partner guide', () {
    test('has the same complete text in all 21 languages', () {
      expect(languages, hasLength(25));
      final az = read('az');
      expect(az['weeks'], hasLength(kPostpartumWeeks));
      for (final lang in languages) {
        final text = read(lang);
        expect(_shape(text), _shape(az), reason: lang);
        expect(_strings(text).every((s) => s.trim().isNotEmpty), isTrue, reason: lang);
        final t = PostpartumPartnerText(text);
        expect(t.ui('tasks_message'), contains('{list}'), reason: lang);
        expect(t.ui('mood_low_body'), contains('{n}'), reason: lang);
        // The urgent-sign result carries the local emergency number used by the call button.
        expect(RegExp(r'\b\d{3}\b').hasMatch(t.ui('signs_urgent')), isTrue, reason: lang);
        // The generated table is the JSON (app/tool/partner/gen_partner_data.mjs).
        expect(kPostpartumPartnerText[lang], text, reason: 'generated $lang');
      }
    });

    test("maps the baby's age to weeks 1–8 and ends after 8 weeks", () {
      expect(postpartumWeek(0), 1);
      expect(postpartumWeek(6), 1);
      expect(postpartumWeek(7), 2);
      expect(postpartumWeek(55), 8);
      expect(postpartumWeek(56), isNull);
      expect(postpartumWeek(-1), isNull);
    });

    test('typed access to the guide', () {
      final t = postpartumPartnerText('az');
      expect(t.weeks, hasLength(8));
      expect(t.weeks.first.doList, hasLength(4));
      expect(t.weeks.first.say, hasLength(2));
      expect(t.phrases, hasLength(8));
      expect(t.tasks, hasLength(10));
      expect(postpartumPartnerText('xx').raw, kPostpartumPartnerText['en']);
    });
  });

  group('local calendar days (dates group)', () {
    test('dayKey / isoDay use the local day', () {
      final lateNight = DateTime(2026, 11, 8, 1, 15);
      expect(isoDay(lateNight), '2026-11-08');
      expect(isoDay(addDays(lateNight, -6)), '2026-11-02');
    });
  });

  group('useDailyTip', () {
    final tips = [
      {'id': 'a', 'tip_text': 'general A', 'tip_emoji': '💕', 'week_number': null},
      {'id': 'b', 'tip_text': 'general B', 'tip_emoji': '🍫', 'week_number': null},
      {'id': 'w', 'tip_text': 'week 20', 'tip_emoji': '👶', 'week_number': 20},
    ];

    test('prefers the week, then the general tips, the same tip all day', () {
      final day = DateTime(2026, 1, 3); // day of year 3
      expect(pickDailyTip(tips, 20, day)?['id'], 'w');
      expect(pickDailyTip(tips, 21, day)?['id'], 'b'); // 3 % 2
      expect(pickDailyTip(tips, null, day)?['id'], 'a'); // 3 % 3
      expect(pickDailyTip(tips, 0, DateTime(2026, 1, 4))?['id'], 'b');
      expect(pickDailyTip(const [], 20, day), isNull);
    });
  });
}
