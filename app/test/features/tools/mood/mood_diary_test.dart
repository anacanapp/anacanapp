// Ported from: src/components/tools/MoodDiary.test.tsx
import 'package:anacan/domain/dates/local_date.dart';
import 'package:anacan/features/home/data/daily_logs.dart';
import 'package:anacan/features/tools/health_common/health_common.dart';
import 'package:anacan/features/tools/mood/mood_diary.dart';
import 'package:anacan/features/tools/mood/mood_diary_form.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show TextField;

import '../health_support/health_harness.dart';

class _RecordingActions extends DailyLogActions {
  _RecordingActions(super.ref);
  final List<Map<String, Object?>> patches = [];
  @override
  Future<DailyLogSaveResult> addLog(Map<String, Object?> patch) async {
    patches.add(patch);
    return const DailyLogSaveResult(data: {});
  }
}

Map<String, dynamic> _saved() => {
      'id': 'l1',
      'user_id': testUserId,
      'log_date': todayKey(),
      'mood': 2,
      'symptoms': ['nausea'],
      'water_intake': 750,
      'temperature': null,
      'bleeding': 'spotting',
      'notes': 'Səhər ürəkbulanma',
      'created_at': '2026-11-08T00:00:00Z',
      'sleep_hours': 7,
      'sleep_quality': 3,
    };

String _notesText(WidgetTester tester) => tester.widget<TextField>(find.byKey(const ValueKey('mood-notes'))).controller!.text;

void main() {
  late _RecordingActions actions;

  Future<HealthHarness> pump(WidgetTester tester) async {
    final h = HealthHarness(user: {'lifeStage': 'bump'});
    await h.pump(tester, MoodDiary(onBack: () {}), extra: [
      dailyLogActionsProvider.overrideWith((ref) => actions = _RecordingActions(ref)),
    ]);
    return h;
  }

  /// `publish(saved())`: today's entry arrives after the first render (reload of the daily logs).
  Future<void> publish(WidgetTester tester, HealthHarness h) async {
    h.db.tables['daily_logs'] = [_saved()];
    final container = ProviderScope.containerOf(tester.element(find.byType(MoodDiary)));
    await container.read(dailyLogsProvider.notifier).fetchLogs();
    await settle(tester);
  }

  group('MoodDiary', () {
    toolTest("fills the form when today's entry loads after the first render, and saves a merge patch", (tester) async {
      final h = await pump(tester);
      expect(_notesText(tester), '');

      await publish(tester, h);
      expect(_notesText(tester), 'Səhər ürəkbulanma');

      await tester.tap(find.text('Yadda saxla'));
      await settle(tester);
      expect(actions.patches, hasLength(1));
      final patch = actions.patches.single;
      expect(patch, {'log_date': todayKey(), 'mood': 2, 'symptoms': ['nausea'], 'notes': 'Səhər ürəkbulanma', 'bleeding': 'spotting'});
      expect(patch.containsKey('water_intake'), isFalse);
      expect(patch.containsKey('sleep_hours'), isFalse);
    });

    toolTest('does not overwrite what the user is typing when the entry arrives later', (tester) async {
      final h = await pump(tester);
      await tester.enterText(find.byKey(const ValueKey('mood-notes')), 'yeni qeyd');
      await publish(tester, h);
      expect(_notesText(tester), 'yeni qeyd');
    });
  });

  test('moodDiaryPatch leaves bleeding out when its card is hidden', () {
    expect(moodDiaryPatch(const MoodDiaryForm(mood: 3, notes: '  '), '2026-11-27', false), {'log_date': '2026-11-27', 'mood': 3, 'symptoms': const <String>[], 'notes': null});
  });
}
