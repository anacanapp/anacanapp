// Ported from: (JavaScript / date-fns runtime semantics used by src/lib/**; no single source file)
//
// Small helpers that reproduce JavaScript and date-fns behaviour where Dart differs. Every domain port
// uses these instead of the Dart built-ins so results match the React app bit for bit.
//
// Dates: a JS `Date` is represented by a Dart local [DateTime] (or `null` for an Invalid Date). Local-time
// getters (`getHours`, `getDate`, ...) are the Dart local fields; `getTime()` is `millisecondsSinceEpoch`.
// Like V8, Dart reads the process time zone (TZ) through the C library, so DST rules match on the same zone.

/// Translation hook: `(key, azDefault) -> text`. The i18n runtime passes `tr`; tests pass [azTr].
typedef Tr = String Function(String key, String azDefault);

/// Returns the Azerbaijani default (what `tr` returns for the source language).
String azTr(String key, String azDefault) => azDefault;

/// Injectable "now" (the React app reads `new Date()` / `Date.now()`; vitest fakes it with `vi.setSystemTime`).
class DomainClock {
  DomainClock._();
  static DateTime Function() _now = DateTime.now;

  /// Current time as a local [DateTime].
  static DateTime now() => _now();

  /// `Date.now()`.
  static int nowMs() => _now().millisecondsSinceEpoch;

  /// `vi.setSystemTime(t)`: freezes the clock at the instant of [t].
  static void setSystemTime(DateTime t) {
    final ms = t.millisecondsSinceEpoch;
    _now = () => DateTime.fromMillisecondsSinceEpoch(ms);
  }

  /// `vi.useRealTimers()`.
  static void reset() => _now = DateTime.now;
}

// ── Numbers ─────────────────────────────────────────────────────────────────────────────────────────

/// `Math.round`: rounds .5 towards +Infinity (`Math.round(-2.5) == -2`, Dart's `round()` gives -3).
double jsRound(num x) {
  final v = x.toDouble();
  if (v.isNaN || v.isInfinite) return v;
  final f = v.floorToDouble();
  return (v - f) >= 0.5 ? f + 1 : f;
}

/// `Math.round` for finite values, as an int.
int jsRoundInt(num x) => jsRound(x).toInt();

/// JS `a % b` (sign of the dividend). Dart's `%` is always non-negative for a positive divisor.
num jsRem(num a, num b) => a.remainder(b);

/// `Math.trunc`-free integer check: `Number.isInteger(v)`.
bool jsIsInteger(Object? v) => v is num && v.isFinite && v == v.truncateToDouble();

/// `Number.isFinite(v)` (no coercion).
bool jsIsFinite(Object? v) => v is num && v.isFinite;

/// `Number(v)` coercion.
double jsNumber(Object? v) {
  if (v == null) return 0;
  if (v is bool) return v ? 1 : 0;
  if (v is num) return v.toDouble();
  if (v is String) {
    final s = v.trim();
    if (s.isEmpty) return 0;
    if (s == 'Infinity' || s == '+Infinity') return double.infinity;
    if (s == '-Infinity') return double.negativeInfinity;
    final hex = RegExp(r'^0[xX]([0-9a-fA-F]+)$').firstMatch(s);
    if (hex != null) return int.parse(hex.group(1)!, radix: 16).toDouble();
    if (!RegExp(r'^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$').hasMatch(s)) return double.nan;
    return double.parse(s);
  }
  return double.nan; // objects / arrays (not used by the ports)
}

/// `String(n)` for a number: integers without ".0", otherwise the shortest round-trip form.
String jsNumberToString(num n) {
  if (n is int) return n.toString();
  if (n.isNaN) return 'NaN';
  if (n.isInfinite) return n > 0 ? 'Infinity' : '-Infinity';
  if (n == n.truncateToDouble() && n.abs() < 1e21) return n.toInt().toString();
  return n.toString();
}

/// `Math.imul(a, b)` as an unsigned 32-bit result (callers use `>>> 0`).
int jsImulU32(int a, int b) => ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF;

/// FNV-1a over UTF-16 code units, as the React app writes it (`h ^= charCodeAt; h = Math.imul(h, 16777619)`,
/// result `>>> 0`). Used for the deterministic "today's picks" and recap seeds.
int fnv1a32(String text) {
  var h = 2166136261;
  for (final c in text.codeUnits) {
    h = (h ^ c) & 0xFFFFFFFF;
    h = jsImulU32(h, 16777619);
  }
  return h;
}

/// Stable sort (JS `Array.prototype.sort` is stable since ES2019; Dart's `List.sort` is not guaranteed to be).
/// The comparator may return any number; NaN counts as 0 like in JS.
List<T> jsSorted<T>(Iterable<T> items, num Function(T a, T b) compare) {
  final list = items.toList();
  _mergeSort(list, compare);
  return list;
}

/// In-place stable sort, returns [list] (JS `sort` mutates and returns the array).
List<T> jsSortInPlace<T>(List<T> list, num Function(T a, T b) compare) {
  _mergeSort(list, compare);
  return list;
}

void _mergeSort<T>(List<T> list, num Function(T a, T b) compare) {
  if (list.length < 2) return;
  final tmp = List<T>.of(list);
  _split(tmp, list, 0, list.length, compare);
}

void _split<T>(List<T> src, List<T> dst, int lo, int hi, num Function(T a, T b) cmp) {
  if (hi - lo < 2) return;
  final mid = (lo + hi) >> 1;
  _split(dst, src, lo, mid, cmp);
  _split(dst, src, mid, hi, cmp);
  var i = lo, j = mid, k = lo;
  while (i < mid && j < hi) {
    final c = cmp(src[j], src[i]);
    // Take from the right only when strictly smaller: keeps equal elements in order.
    if (!c.isNaN && c < 0) {
      dst[k++] = src[j++];
    } else {
      dst[k++] = src[i++];
    }
  }
  while (i < mid) {
    dst[k++] = src[i++];
  }
  while (j < hi) {
    dst[k++] = src[j++];
  }
}

/// `String(n).padStart(2, '0')`.
String pad2(num n) => jsNumberToString(n).padLeft(2, '0');

// ── Dates (JS `Date` semantics) ────────────────────────────────────────────────────────────────────

/// `new Date(ms)` as a local DateTime.
DateTime jsDateFromMs(num ms) => DateTime.fromMillisecondsSinceEpoch(ms.toInt());

/// `new Date(y, monthIndex, d, h, mi, s, ms)` (local, overflowing fields roll over like in JS).
DateTime jsLocalDate(int y, int monthIndex, [int d = 1, int h = 0, int mi = 0, int s = 0, int ms = 0]) =>
    DateTime(y, monthIndex + 1, d, h, mi, s, ms);

/// `Date.UTC(y, monthIndex, d)` in milliseconds.
int jsDateUtc(int y, int monthIndex, [int d = 1, int h = 0, int mi = 0, int s = 0, int ms = 0]) =>
    DateTime.utc(y, monthIndex + 1, d, h, mi, s, ms).millisecondsSinceEpoch;

/// `date.toISOString()` (always UTC, milliseconds, `Z`).
String jsToIsoString(DateTime d) {
  final u = d.toUtc();
  String p(int n, int w) => n.toString().padLeft(w, '0');
  return '${p(u.year, 4)}-${p(u.month, 2)}-${p(u.day, 2)}T${p(u.hour, 2)}:${p(u.minute, 2)}:${p(u.second, 2)}.'
      '${p(u.millisecond, 3)}Z';
}

/// `new Date(value)` / `Date.parse(value)` for the string shapes the app stores. Returns null for an Invalid Date.
///
/// Like V8: a date-only ISO string (`2026-03-01`, `2026-03`, `2026`) is UTC midnight; a date-time without an
/// offset (`T` or space separator) is local time; `Z` / `±HH:MM` / `±HHMM` give that instant. V8 lets the day
/// overflow up to 31 (`2026-02-30` is 2 March) and accepts the non-padded `2026-3-1` as local midnight.
/// Other free-form strings V8's legacy parser understands ("Mar 1 2026") are not supported and return null.
DateTime? jsParseDate(String value) {
  final s = value.trim();
  final iso = RegExp(r'^([+-]\d{6}|\d{4})(?:-(\d{2})(?:-(\d{2}))?)?'
          r'(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|z|[+-]\d{2}:?\d{2})?$')
      .firstMatch(s);
  if (iso != null) {
    final year = int.parse(iso.group(1)!);
    final month = iso.group(2) != null ? int.parse(iso.group(2)!) : 1;
    final day = iso.group(3) != null ? int.parse(iso.group(3)!) : 1;
    final hasTime = iso.group(4) != null;
    final hour = hasTime ? int.parse(iso.group(4)!) : 0;
    final minute = hasTime ? int.parse(iso.group(5)!) : 0;
    final second = iso.group(6) != null ? int.parse(iso.group(6)!) : 0;
    final frac = iso.group(7);
    final ms = frac != null ? int.parse(frac.padRight(3, '0').substring(0, 3)) : 0;
    final tz = iso.group(8);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (hour > 24 || minute > 59 || second > 59) return null;
    if (hour == 24 && (minute != 0 || second != 0 || ms != 0)) return null;
    if (tz != null || !hasTime) {
      var offsetMin = 0;
      if (tz != null && tz.toUpperCase() != 'Z') {
        final sign = tz.startsWith('-') ? -1 : 1;
        final digits = tz.substring(1).replaceAll(':', '');
        offsetMin = sign * (int.parse(digits.substring(0, 2)) * 60 + int.parse(digits.substring(2, 4)));
      }
      final utc = DateTime.utc(year, month, day, hour, minute, second, ms).millisecondsSinceEpoch;
      return DateTime.fromMillisecondsSinceEpoch(utc - offsetMin * 60000);
    }
    return DateTime(year, month, day, hour, minute, second, ms);
  }
  final loose = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})$').firstMatch(s);
  if (loose != null) {
    final m = int.parse(loose.group(2)!), d = int.parse(loose.group(3)!);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return DateTime(int.parse(loose.group(1)!), m, d);
  }
  return null;
}

/// `new Date(value)` for the values the ports accept: a DateTime, epoch milliseconds or a string.
DateTime? jsDate(Object? value) {
  if (value is DateTime) return value.isUtc ? value.toLocal() : value;
  if (value is num) return value.isFinite ? jsDateFromMs(value) : null;
  if (value is String) return jsParseDate(value);
  return null;
}

/// `Date.parse(value)` in ms, or null for NaN.
int? jsDateParseMs(String value) => jsParseDate(value)?.millisecondsSinceEpoch;

// ── date-fns (v3.6) helpers, local time ─────────────────────────────────────────────────────────────

/// date-fns `startOfDay`.
DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

/// date-fns `differenceInCalendarDays(left, right)`: calendar days, DST-safe.
int differenceInCalendarDays(DateTime left, DateTime right) =>
    DateTime.utc(left.year, left.month, left.day).difference(DateTime.utc(right.year, right.month, right.day)).inDays;

/// date-fns `addDays` (keeps the wall-clock time across DST).
DateTime addDays(DateTime d, int amount) =>
    DateTime(d.year, d.month, d.day + amount, d.hour, d.minute, d.second, d.millisecond);

/// date-fns `subDays`.
DateTime subDays(DateTime d, int amount) => addDays(d, -amount);

/// date-fns `addMonths`: a day that does not exist in the target month clamps to its last day.
DateTime addMonths(DateTime d, int amount) {
  final endOfDesired = DateTime(d.year, d.month + amount + 1, 0, d.hour, d.minute, d.second, d.millisecond);
  if (d.day >= endOfDesired.day) return endOfDesired;
  return DateTime(endOfDesired.year, endOfDesired.month, d.day, d.hour, d.minute, d.second, d.millisecond);
}

/// date-fns `subMonths`.
DateTime subMonths(DateTime d, int amount) => addMonths(d, -amount);

/// date-fns `format(d, 'yyyy-MM-dd')`.
String formatYmd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${pad2(d.month)}-${pad2(d.day)}';

int _daysInMonth(int y, int m) => DateTime.utc(y, m + 1, 0).day;

/// date-fns `parseISO` for calendar dates (`yyyy`, `yyyy-MM`, `yyyy-MM-dd`, `yyyyMMdd`) with an optional time
/// (`HH`, `HH:mm`, `HH:mm:ss(.sss)`) and zone (`Z`, `±HH`, `±HH:mm`, `±HHmm`). Without a zone the result is local
/// time (a date-only string is local midnight, unlike `new Date`). Unlike `new Date`, impossible days such as
/// `2026-02-30` are invalid. Week dates and ordinal dates are not supported (not used by the app). Null = invalid.
DateTime? parseIsoDateFns(String value) {
  final m = RegExp(r'^(\d{4})(?:-?(\d{2})(?:-?(\d{2}))?)?'
          r'(?:[T ](\d{2})(?::?(\d{2}))?(?::?(\d{2})(?:[.,](\d+))?)?)?(Z|z|[+-]\d{2}(?::?\d{2})?)?$')
      .firstMatch(value);
  if (m == null) return null;
  final y = int.parse(m.group(1)!);
  final mo = m.group(2) != null ? int.parse(m.group(2)!) : 1;
  final d = m.group(3) != null ? int.parse(m.group(3)!) : 1;
  if (mo < 1 || mo > 12 || d < 1 || d > _daysInMonth(y, mo)) return null;
  final h = m.group(4) != null ? int.parse(m.group(4)!) : 0;
  final mi = m.group(5) != null ? int.parse(m.group(5)!) : 0;
  final s = m.group(6) != null ? int.parse(m.group(6)!) : 0;
  final ms = m.group(7) != null ? int.parse(m.group(7)!.padRight(3, '0').substring(0, 3)) : 0;
  if (h > 24 || mi > 59 || s > 59 || (h == 24 && (mi != 0 || s != 0))) return null;
  final tz = m.group(8);
  if (tz == null) return DateTime(y, mo, d, h, mi, s, ms);
  var offset = 0;
  if (tz.toUpperCase() != 'Z') {
    final sign = tz.startsWith('-') ? -1 : 1;
    final digits = tz.substring(1).replaceAll(':', '');
    final hh = int.parse(digits.substring(0, 2));
    final mm = digits.length >= 4 ? int.parse(digits.substring(2, 4)) : 0;
    if (hh > 23 || mm > 59) return null;
    offset = sign * (hh * 60 + mm);
  }
  final utc = DateTime.utc(y, mo, d, h, mi, s, ms).millisecondsSinceEpoch - offset * 60000;
  return DateTime.fromMillisecondsSinceEpoch(utc);
}

/// Same calendar day in local time.
bool isSameLocalDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
