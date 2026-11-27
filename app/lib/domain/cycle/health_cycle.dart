// Ported from: src/lib/healthCycle.ts
//
// Pure part of the Apple Health / Health Connect menstruation export: which days are written and with what
// payload, and the bridge-version gate. The platform channel lives in the native layer; it implements
// [HealthCycleBridge]. Never manufactures expected days: only saved daily observations up to today are sent.

import '../js_compat.dart';
import 'period_flow.dart';

const String cycleWriteKey = 'anacan_health_cycle_write';

/// Value stored under [cycleWriteKey] when the user enabled the export ('1'); anything else is off.
bool isCycleWriteEnabledValue(String? stored) => stored == '1';

/// Native bridge answer → usable: available and API version ≥ 2 (version 1 = old bridge without per-day flow).
bool isCycleWriteSupported({required bool available, int? apiVersion}) => available && (apiVersion ?? 1) >= 2;

class PeriodDay {
  const PeriodDay({required this.date, required this.flow, required this.cycleStart});
  final String date;
  final PeriodFlowAction flow;
  final bool cycleStart;
}

class MenstruationWrite {
  const MenstruationWrite({required this.startDate, required this.endDate, required this.flow, required this.cycleStart});
  final String startDate;
  final String endDate;
  final PeriodFlowAction flow;
  final bool cycleStart;

  Map<String, Object?> toJson() => {'startDate': startDate, 'endDate': endDate, 'flow': flow, 'cycleStart': cycleStart};
}

/// The writes `syncPeriodDaysToHealth` hands to the bridge, in order: future days are skipped and spotting is
/// sent as 'clear' (spotting is not menstrual flow).
List<MenstruationWrite> planHealthCycleWrites(List<PeriodDay> days, [DateTime? now]) {
  final today = localPeriodDate(now ?? DomainClock.now());
  final out = <MenstruationWrite>[];
  for (final day in days) {
    final date = localPeriodDate(day.date);
    if (date.compareTo(today) > 0) continue;
    out.add(MenstruationWrite(
      startDate: date,
      endDate: date,
      flow: day.flow == 'spotting' ? 'clear' : day.flow,
      cycleStart: day.cycleStart,
    ));
  }
  return out;
}

/// Native side of the export (implemented by the platform channel).
abstract class HealthCycleBridge {
  Future<({bool available, int? apiVersion})> isAvailable();
  Future<void> writeMenstruation(MenstruationWrite write);
}

/// `syncPeriodDaysToHealth` with the platform pieces injected. Returns false when disabled/unavailable or when
/// any write failed (the remaining days are still attempted).
Future<bool> syncPeriodDaysToHealth(
  List<PeriodDay> days, {
  required bool enabled,
  required bool isNative,
  required HealthCycleBridge bridge,
  DateTime? now,
}) async {
  if (!enabled || !isNative) return false;
  try {
    final a = await bridge.isAvailable();
    if (!isCycleWriteSupported(available: a.available, apiVersion: a.apiVersion)) return false;
  } catch (_) {
    return false;
  }
  var success = true;
  for (final write in planHealthCycleWrites(days, now)) {
    try {
      await bridge.writeMenstruation(write);
    } catch (_) {
      success = false;
    }
  }
  return success;
}
