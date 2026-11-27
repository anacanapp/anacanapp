// Ported from: src/lib/postpartum-window.ts
//
// Early postpartum window: the first 6 weeks (0-41 days) after birth. Pre-eclampsia can start or worsen then, so the
// pregnancy blood pressure alerts (≥140/90 warning, ≥160/110 urgent) still apply (ACOG / NHS). Days are counted on
// local calendar days; a date-only "YYYY-MM-DD" is a local day, not UTC.
const int postpartumAlertDays = 42;

DateTime? _toLocalDay(Object value) {
  if (value is DateTime) {
    final d = value.isUtc ? value.toLocal() : value;
    return DateTime(d.year, d.month, d.day);
  }
  if (value is String) {
    final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(value);
    if (m != null) return DateTime(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
    final d = DateTime.tryParse(value);
    if (d == null) return null;
    final l = d.toLocal();
    return DateTime(l.year, l.month, l.day);
  }
  return null;
}

/// Days since the YOUNGEST valid birth date (not in the future), or null when none.
int? daysSinceYoungestBirth(List<Object?> births, [DateTime? now]) {
  final n = now ?? DateTime.now();
  final today = DateTime(n.year, n.month, n.day);
  int? best;
  for (final b in births) {
    if (b == null || b == '') continue;
    final day = _toLocalDay(b);
    if (day == null) continue;
    // Calendar days (UTC dates avoid DST hours, like Math.round over local midnights).
    final days = DateTime.utc(today.year, today.month, today.day).difference(DateTime.utc(day.year, day.month, day.day)).inDays;
    if (days < 0) continue;
    if (best == null || days < best) best = days;
  }
  return best;
}

/// True when the youngest baby is under 6 weeks (42 days) old.
bool isEarlyPostpartum(List<Object?> births, [DateTime? now]) {
  final days = daysSinceYoungestBirth(births, now);
  return days != null && days < postpartumAlertDays;
}
