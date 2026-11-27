// Ported from: src/lib/laborUtils.test.ts

import 'dart:convert';

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/labor/labor_utils.dart';
import 'package:flutter_test/flutter_test.dart';

final int t0 = DateTime.parse('2026-11-08T10:00:00Z').millisecondsSinceEpoch;

List<TimedContraction> series(int n, int gapSec, int durSec, [int? startMs]) => List.generate(
      n,
      (i) => TimedContraction(id: 'c$i', startTime: jsToIsoString(DateTime.fromMillisecondsSinceEpoch((startMs ?? t0) + i * gapSec * 1000)), durationSeconds: durSec),
    );
int lastStart(List<TimedContraction> list) => DateTime.parse(list.last.startTime).millisecondsSinceEpoch;

void main() {
  group('evaluate511', () {
    test('triggers after about an hour of contractions 5 min apart lasting 1 min', () {
      final list = series(13, 300, 60);
      expect(evaluate511(list, lastStart(list) + 90000), true);
    });
    test('counts 55-second contractions as "about a minute"', () {
      final list = series(13, 300, 55);
      expect(evaluate511(list, lastStart(list) + 60000), true);
    });
    test('uses start-to-start intervals: 60 s contractions with 4 min rest (5 min start to start) trigger', () {
      final list = series(13, 300, 60);
      final stats = computeContractionStats(list, lastStart(list) + 30000);
      expect(stats.avgInterval, 300);
      expect(stats.is511, true);
    });
    test('does NOT trigger before about an hour of the pattern (3 contractions used to be enough)', () {
      expect(evaluate511(series(3, 300, 60), t0 + 600000 + 30000), false);
      final list = series(10, 300, 60);
      expect(evaluate511(list, lastStart(list) + 30000), false);
    });
    test('does NOT trigger when contractions are further apart than ~5 minutes', () {
      final list = series(13, 360, 60);
      expect(evaluate511(list, lastStart(list) + 30000), false);
    });
    test('does NOT trigger for short contractions (Braxton Hicks style)', () {
      final list = series(13, 300, 30);
      expect(evaluate511(list, lastStart(list) + 30000), false);
    });
    test('does NOT trigger from old history once the contractions stopped', () {
      final list = series(13, 300, 60);
      expect(evaluate511(list, lastStart(list) + 3 * 60 * 60 * 1000), false);
    });
    test('only counts the current run: a long pause breaks it', () {
      final early = series(8, 300, 60, t0);
      final late = series(6, 300, 60, t0 + 2 * 60 * 60 * 1000);
      expect(evaluate511([...early, ...late], lastStart(late) + 30000), false);
    });
    test('ignores duplicate starts (a queued copy of a synced row)', () {
      final list = series(13, 300, 60);
      final dup = [...list, TimedContraction(id: 'dup', startTime: list[5].startTime, durationSeconds: list[5].durationSeconds)];
      expect(evaluate511(dup, lastStart(list) + 30000), true);
    });
    test('handles empty and single lists', () {
      expect(evaluate511(const [], t0), false);
      expect(evaluate511(series(1, 300, 60), t0), false);
      expect(computeContractionStats(const [], t0).toJson(), {'avgDuration': 0, 'avgInterval': 0, 'is511': false, 'count': 0});
    });
  });

  group('computeContractionStats', () {
    test('leaves pauses over an hour out of the average interval', () {
      final list = [...series(2, 300, 60, t0), ...series(2, 300, 60, t0 + 5 * 60 * 60 * 1000)];
      expect(computeContractionStats(list, t0).avgInterval, 300);
    });
  });

  group('startToStartSeconds', () {
    test('returns null without a recent previous start', () {
      expect(startToStartSeconds(null, t0), isNull);
      expect(startToStartSeconds(t0 - 2 * 60 * 60 * 1000, t0), isNull);
      expect(startToStartSeconds(t0 + 1000, t0), isNull);
      expect(startToStartSeconds(t0 - 299600, t0), 300);
    });
  });

  group('offline queue', () {
    QueuedContraction q(String id, String iso) => QueuedContraction(id: id, startTime: iso, durationSeconds: 60, intervalSeconds: null);

    test('drops queue entries already on the server (by id or by start time) and duplicates', () {
      final queue = [q('a', '2026-11-08T10:00:00.000Z'), q('b', '2026-11-08T10:05:00.000Z'), q('c', '2026-11-08T10:10:00.000Z'), q('c2', '2026-11-08T10:10:00.300Z')];
      final server = [(id: 'a', startTime: '2026-11-08T10:00:00.000Z'), (id: 'srv', startTime: '2026-11-08T10:05:00.400Z')];
      expect(pruneQueue(queue, server).map((x) => x.id), ['c']);
    });
    test('merges pending rows into the list, newest first', () {
      final merged = mergeWithQueue(const [MergedContraction(id: 'srv', startTime: '2026-11-08T10:00:00.000Z', durationSeconds: 50)], [q('p', '2026-11-08T10:06:00.000Z')]);
      expect(merged.map((m) => m.id), ['p', 'srv']);
      expect(merged[0].pending, true);
    });
    test('parses a stored queue defensively', () {
      expect(parseQueue(null), isEmpty);
      expect(parseQueue('not json'), isEmpty);
      expect(parseQueue('{"a":1}'), isEmpty);
      final ok = q('x', '2026-11-08T10:00:00.000Z');
      final parsed = parseQueue(jsonEncode([ok.toJson(), {'id': 1}, {...ok.toJson(), 'start_time': 'bad'}]));
      expect(parsed.map((p) => p.toJson()), [ok.toJson()]);
    });
  });

  group('contractionLivePhase (no vitest case; TypeScript rules)', () {
    test('active, rest within an hour, nothing after a pause', () {
      expect(contractionLivePhase(activeStart: 5, now: 10)!.phase, 'active');
      final rest = contractionLivePhase(lastEnd: t0, now: t0 + 60000)!;
      expect([rest.phase, rest.startTime, rest.until], ['rest', t0, t0 + 3600000]);
      expect(contractionLivePhase(lastEnd: t0, now: t0 + 3600000), isNull);
      expect(contractionLivePhase(lastEnd: t0 + 120000, now: t0), isNull);
    });
  });
}
