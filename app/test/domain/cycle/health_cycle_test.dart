// Ported from: src/lib/healthCycle.test.ts (the Capacitor plugin mock becomes a fake HealthCycleBridge)

import 'package:anacan/domain/cycle/health_cycle.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeBridge implements HealthCycleBridge {
  _FakeBridge({this.apiVersion = 2});
  int? apiVersion;
  final writes = <Map<String, Object?>>[];
  @override
  Future<({bool available, int? apiVersion})> isAvailable() async => (available: true, apiVersion: apiVersion);
  @override
  Future<void> writeMenstruation(MenstruationWrite write) async => writes.add(write.toJson());
}

void main() {
  final now = DateTime(2026, 9, 14, 12);

  test('writes only observed local dates and preserves per-day intensity and cycle start', () async {
    final bridge = _FakeBridge();
    expect(
      await syncPeriodDaysToHealth(const [
        PeriodDay(date: '2026-09-10', flow: 'unspecified', cycleStart: true),
        PeriodDay(date: '2026-09-11', flow: 'heavy', cycleStart: false),
        PeriodDay(date: '2026-09-12', flow: 'none', cycleStart: false),
      ], enabled: true, isNative: true, bridge: bridge, now: now),
      true,
    );
    expect(bridge.writes, [
      {'startDate': '2026-09-10', 'endDate': '2026-09-10', 'flow': 'unspecified', 'cycleStart': true},
      {'startDate': '2026-09-11', 'endDate': '2026-09-11', 'flow': 'heavy', 'cycleStart': false},
      {'startDate': '2026-09-12', 'endDate': '2026-09-12', 'flow': 'none', 'cycleStart': false},
    ]);
  });

  test('does not send unsupported semantics to the old bridge or export predictions', () async {
    final bridge = _FakeBridge(apiVersion: null);
    expect(
      await syncPeriodDaysToHealth(const [PeriodDay(date: '2026-09-14', flow: 'unspecified', cycleStart: true)],
          enabled: true, isNative: true, bridge: bridge, now: now),
      false,
    );
    expect(bridge.writes, isEmpty);
    bridge.apiVersion = 2;
    await syncPeriodDaysToHealth(const [PeriodDay(date: '2026-09-15', flow: 'heavy', cycleStart: false)],
        enabled: true, isNative: true, bridge: bridge, now: now);
    expect(bridge.writes, isEmpty);
  });

  test('keeps spotting separate from menstrual flow and clears only the app period record', () async {
    final bridge = _FakeBridge();
    await syncPeriodDaysToHealth(const [PeriodDay(date: '2026-09-14', flow: 'spotting', cycleStart: false)],
        enabled: true, isNative: true, bridge: bridge, now: now);
    expect(bridge.writes, [
      {'startDate': '2026-09-14', 'endDate': '2026-09-14', 'flow': 'clear', 'cycleStart': false},
    ]);
  });

  test('export switch value and bridge version gate', () {
    expect(isCycleWriteEnabledValue('1'), true);
    expect(isCycleWriteEnabledValue(null), false);
    expect(isCycleWriteSupported(available: true, apiVersion: 2), true);
    expect(isCycleWriteSupported(available: true), false);
    expect(isCycleWriteSupported(available: false, apiVersion: 3), false);
  });
}
