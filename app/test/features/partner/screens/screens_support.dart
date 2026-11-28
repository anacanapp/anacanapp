// Ported from: (test support) — the vi.mock setups of the partner screen tests: an in-memory PartnerScreensBackend
// next to the core FakePartnerBackend.
import 'package:anacan/features/partner/screens/data/screens_backend.dart';
import 'package:flutter_test/flutter_test.dart';

export '../support.dart';

/// Records the reads; answers from [rows] per method.
class FakeScreensBackend implements PartnerScreensBackend {
  final Map<String, List<Map<String, dynamic>>> rows = {};
  final List<(String, List<Object?>)> calls = [];
  final Set<String> failing = {};

  Future<List<Map<String, dynamic>>> _answer(String op, List<Object?> args) async {
    calls.add((op, args));
    if (failing.contains(op)) throw Exception('$op failed');
    return [...?rows[op]];
  }

  @override
  Future<List<Map<String, dynamic>>> appointmentsFrom(String userId, String fromDay) => _answer('appointments', [userId, fromDay]);

  @override
  Future<List<Map<String, dynamic>>> babyLogsSince(String userId, String fromIso) => _answer('babyLogs', [userId, fromIso]);

  @override
  Future<List<Map<String, dynamic>>> contractionsSince(String userId, String fromIso) => _answer('contractions', [userId, fromIso]);

  @override
  Future<List<Map<String, dynamic>>> exerciseLogs(String userId, String fromIso, String toIso) => _answer('exercise', [userId, fromIso, toIso]);

  @override
  Future<List<Map<String, dynamic>>> favoriteNames(String userId) => _answer('favoriteNames', [userId]);
}

/// Pumps a few frames (FadeRise timers, microtasks, fake backend futures).
Future<void> pumpFrames(WidgetTester tester, [int frames = 8]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// Scrolls [finder] into view (horizontal chip rows, long pages), then taps it.
Future<void> tapOn(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
}
