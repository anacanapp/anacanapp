// Ported from: src/lib/ads/cadence.ts

import '../js_compat.dart';

class AdCadence {
  const AdCadence({required this.count, required this.seen});
  final int count;
  final List<String> seen;

  Map<String, Object?> toJson() => {'count': count, 'seen': seen};
}

/// Counts a finished round once per key (keeps the last 100 keys); due when the count reaches [every].
({AdCadence state, bool due, bool counted}) advanceAdCadence(AdCadence previous, String key, num every) {
  if (key.isEmpty || !jsIsInteger(every) || every < 1) return (state: previous, due: false, counted: false);
  if (previous.seen.contains(key)) return (state: previous, due: false, counted: false);
  final seen = previous.seen.length > 99 ? previous.seen.sublist(previous.seen.length - 99) : previous.seen;
  final count = previous.count + 1 < every ? previous.count + 1 : every.toInt();
  final state = AdCadence(count: count, seen: [...seen, key]);
  return (state: state, due: state.count >= every, counted: true);
}

AdCadence consumeAdCadence(AdCadence state) => AdCadence(count: 0, seen: state.seen);
