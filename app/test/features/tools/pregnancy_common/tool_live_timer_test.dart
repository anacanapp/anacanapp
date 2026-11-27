// Ported from: src/lib/tool-live-timer.test.ts
import 'package:anacan/domain/labor/labor_utils.dart';
import 'package:anacan/features/baby/live_timer/live_timer.dart';
import 'package:anacan/features/tools/kick/kick_session.dart';
import 'package:anacan/features/tools/pregnancy_common/tool_live_timer.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';

class FakeBridge implements LiveTimerBridge {
  bool native = true;
  final List<LiveActivityStart> starts = [];
  final List<String?> stops = [];

  /// Global call order: `start:ID` / `stop:ID`.
  final List<String> order = [];
  int rejectNextStarts = 0;

  @override
  bool get isNative => native;

  @override
  Future<void> startActivity(LiveActivityStart options) async {
    if (rejectNextStarts > 0) {
      rejectNextStarts--;
      throw StateError('Live Activities disabled by user');
    }
    starts.add(options);
    order.add('start:${options.id}');
  }

  @override
  Future<void> stopActivity({String? timerId}) async {
    stops.add(timerId);
    order.add('stop:$timerId');
  }

  @override
  Future<List<PendingTimerStop>> getPendingStops() async => const [];
  @override
  Future<void> clearPendingStops() async {}
  @override
  Future<void Function()> addTimerStoppedListener(void Function(PendingTimerStop stop) listener) async => () {};
}

ToolLiveTimerView view(String label, [int startTime = 1000]) =>
    ToolLiveTimerView(type: 'kick', label: label, subLabel: 'sub', startTime: startTime);

Future<void> flush() => Future<void>.delayed(const Duration(milliseconds: 20));

void main() {
  late FakeBridge h;
  late LocalStore store;
  late ToolLiveTimer timer;
  var android = false;

  ToolLiveTimer build() => ToolLiveTimer(bridge: h, store: store, isAndroid: android);

  setUp(() {
    installTestI18n();
    android = false;
    h = FakeBridge();
    store = LocalStore.memory();
    timer = build();
  });

  group('tool live timer bridge', () {
    test('starts with the shared plugin payload and skips identical updates', () async {
      await timer.show('kick', view('Hərəkət · 1'));
      expect(h.starts, hasLength(1));
      final payload = h.starts[0];
      expect(payload.type, 'kick');
      expect(payload.label, 'Hərəkət · 1');
      expect(payload.subLabel, 'sub');
      expect(payload.startTime, 1000);
      expect(payload.stopLabel, 'Gizlət');
      expect(payload.id, startsWith('kick-1000-'));
      expect(payload.channelName, 'Taymerlər');

      await timer.show('kick', view('Hərəkət · 1'));
      expect(h.starts, hasLength(1));
    });

    test('iOS: an update starts a new activity first, then ends the old one', () async {
      await timer.show('kick', view('Hərəkət · 1'));
      final firstId = h.starts[0].id;
      await timer.show('kick', view('Hərəkət · 2'));
      expect(h.starts, hasLength(2));
      final secondId = h.starts[1].id;
      expect(secondId, isNot(firstId));
      expect(h.stops, contains(firstId));
      expect(h.order.indexOf('start:$secondId'), lessThan(h.order.indexOf('stop:$firstId')));
    });

    test('Android: an update reuses the id (in-place notification update), no stop', () async {
      android = true;
      timer = build();
      await timer.show('kick', view('Hərəkət · 1'));
      await timer.show('kick', view('Hərəkət · 2'));
      expect(h.starts.map((s) => s.id).toList(), ['kick-1000', 'kick-1000']);
      expect(h.stops, isEmpty);
    });

    test('Android: a new phase (new start time) stops the previous notification after starting', () async {
      android = true;
      timer = build();
      await timer.show('contraction', const ToolLiveTimerView(type: 'contraction', label: 'Sancı', subLabel: 's', startTime: 1));
      await timer.show('contraction', const ToolLiveTimerView(type: 'contraction', label: 'Son sancıdan bəri', subLabel: 's', startTime: 2));
      expect(h.stops, contains('contraction-1'));
    });

    test('hide stops the shown timer once and is a no-op afterwards', () async {
      await timer.show('kick', view('Hərəkət · 1'));
      final id = h.starts[0].id;
      await timer.hide('kick');
      expect(h.stops, [id]);
      await timer.hide('kick');
      expect(h.stops, hasLength(1));
    });

    test('ends a leftover timer from before an app restart (persisted id)', () async {
      await timer.show('kick', view('Hərəkət · 1'));
      final id = h.starts[0].id;
      timer.resetForTests(); // memory gone, LocalStore kept
      await timer.hide('kick');
      expect(h.stops, contains(id));
    });

    test('fast updates are coalesced to the newest one', () async {
      final p1 = timer.show('kick', view('Hərəkət · 1'));
      timer.show('kick', view('Hərəkət · 2')).ignore();
      timer.show('kick', view('Hərəkət · 3')).ignore();
      await p1;
      expect(h.starts.map((s) => s.label).toList(), ['Hərəkət · 3']);
    });

    test('a hide followed by the same show in one render keeps the timer (no flicker)', () async {
      await timer.show('kick', view('Hərəkət · 1'));
      timer.hide('kick').ignore();
      await timer.show('kick', view('Hərəkət · 1'));
      expect(h.starts, hasLength(1));
      expect(h.stops, isEmpty);
    });

    test('when Live Activities are off (start rejects) nothing is remembered as shown', () async {
      h.rejectNextStarts = 1;
      await timer.show('kick', view('Hərəkət · 1'));
      await timer.hide('kick');
      expect(h.stops, isEmpty);
    });

    test('slots are independent', () async {
      await timer.show('kick', view('Hərəkət · 1'));
      await timer.show('contraction', const ToolLiveTimerView(type: 'contraction', label: 'Sancı', subLabel: 's', startTime: 5));
      await timer.hide('contraction');
      expect(h.stops, hasLength(1));
      expect(h.stops[0], startsWith('contraction-5-'));
    });

    test('web: no native calls', () async {
      h.native = false;
      await timer.show('kick', view('Hərəkət · 1'));
      await timer.hide('kick');
      expect(h.starts, isEmpty);
      expect(h.stops, isEmpty);
    });
  });

  group('contractionLivePhase', () {
    test('running contraction counts from its start', () {
      final p = contractionLivePhase(activeStart: 500, lastEnd: 100, now: 1000)!;
      expect((p.phase, p.startTime), ('active', 500));
    });
    test('between contractions counts from the last end, up to an hour', () {
      const end = 10000;
      final p = contractionLivePhase(activeStart: null, lastEnd: end, now: end + 1000)!;
      expect((p.phase, p.startTime, p.until), ('rest', end, end + maxIntervalSeconds * 1000));
      expect(contractionLivePhase(activeStart: null, lastEnd: end, now: end + maxIntervalSeconds * 1000), isNull);
    });
    test('nothing after clearing', () {
      expect(contractionLivePhase(activeStart: null, lastEnd: null, now: 1000), isNull);
    });
  });

  group('kickLiveTimerState', () {
    test('maps a running session and idle', () {
      expect(kickLiveTimerState(const ActiveKickSession(startedAt: 42, kicks: 3)), (startTime: 42, count: 3));
      expect(kickLiveTimerState(null), isNull);
    });
  });

  group('live timer hooks', () {
    test('kick: start, count update on tap, stop on Dayandır', () async {
      android = true;
      timer = build();
      final sync = KickLiveTimerSync(timer);
      sync.update(startTime: 7000, count: 0);
      await flush();
      expect(h.starts.last.id, 'kick-7000');
      expect(h.starts.last.type, 'kick');
      expect(h.starts.last.label, 'Hərəkət · 0');
      expect(h.starts.last.startTime, 7000);
      sync.update(startTime: 7000, count: 1);
      await flush();
      expect(h.starts.last.id, 'kick-7000');
      expect(h.starts.last.label, 'Hərəkət · 1');
      sync.update(startTime: null, count: 0);
      await flush();
      expect(h.stops, contains('kick-7000'));
    });

    test('kick: disabled until the user is known', () async {
      KickLiveTimerSync(timer).update(startTime: null, count: 0, enabled: false);
      await flush();
      expect(h.starts, isEmpty);
      expect(h.stops, isEmpty);
    });

    test('contraction: running, then since-last, then cleared', () async {
      android = true;
      timer = build();
      final now = DateTime.now().millisecondsSinceEpoch;
      final sync = ContractionLiveTimerSync(timer);
      sync.update(activeStart: now - 5000, lastEnd: null);
      await flush();
      expect(h.starts.last.id, 'contraction-${now - 5000}');
      expect(h.starts.last.type, 'contraction');
      expect(h.starts.last.label, 'Sancı');
      expect(h.starts.last.startTime, now - 5000);
      sync.update(activeStart: null, lastEnd: now);
      await flush();
      expect(h.starts.last.id, 'contraction-$now');
      expect(h.starts.last.label, 'Son sancıdan bəri');
      expect(h.starts.last.startTime, now);
      expect(h.stops, contains('contraction-${now - 5000}'));
      sync.update(activeStart: null, lastEnd: null);
      await flush();
      expect(h.stops.last, 'contraction-$now');
      sync.dispose();
    });
  });
}
