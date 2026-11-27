// Ported from: src/lib/weaning.ts
//
// Gradual weaning (child 12+ months): pure plan / readiness / check-in logic. The decision is the mother's; there
// is no one-day option; a step lasts at least MIN_DAYS; red flags pause the plan. Dates are 'YYYY-MM-DD' local
// calendar days so plans survive JSON, storage and time zones. Plan JSON keeps the TypeScript field names.

import 'dart:math' as math;

import '../js_compat.dart';

/// 'day' | 'nap' | 'morning' | 'night' | 'bedtime'
typedef FeedType = String;

/// 'gentle' | 'medium'
typedef Pace = String;

/// 'last' | 'separate'
typedef NightMode = String;

/// 'active' | 'paused' | 'finished' | 'cancelled'
typedef PlanStatus = String;

/// 'doctor' | 'manual'
typedef PauseReason = String;

const Map<FeedType, String> feedIcons = {'day': '☀️', 'nap': '🌤️', 'morning': '🌅', 'night': '🌙', 'bedtime': '🛏️'};

/// Step length per pace. There is deliberately no one-day pace.
const Map<Pace, int> paceDays = {'gentle': 7, 'medium': 4};
final List<Pace> paces = paceDays.keys.toList();
const int minDays = 3;
const int tileMinMonths = 9;
const int planMinMonths = 12;
const int delaySickDays = 10;
const int delayChangeDays = 14;
const int extendStepDays = 3;
const int fullExtendDays = 2;
const int slowExtendDays = 3;
const int cupMl = 120;
const int milkMinMl = 470;
const int milkMaxMl = 710;
const int maxCups = 7;

class Feeds {
  const Feeds({required this.morning, required this.day, required this.nap, required this.bedtime, required this.night});
  final bool morning;
  final num day;
  final bool nap;
  final bool bedtime;
  final num night;

  Map<String, Object?> toJson() => {'morning': morning, 'day': day, 'nap': nap, 'bedtime': bedtime, 'night': night};
}

const Feeds defaultFeeds = Feeds(morning: true, day: 2, nap: true, bedtime: true, night: 1);
const Map<String, int> feedMax = {'day': 4, 'night': 3};

class WeaningStep {
  const WeaningStep({required this.id, required this.type, required this.n, required this.start, required this.len, required this.status});
  final String id;
  final FeedType type;

  /// 1-based number when the plan has several feeds of this type, else 0.
  final int n;
  final String start;
  final int len;

  /// 'todo' | 'done'
  final String status;

  WeaningStep copyWith({String? start, int? len, String? status}) =>
      WeaningStep(id: id, type: type, n: n, start: start ?? this.start, len: len ?? this.len, status: status ?? this.status);

  factory WeaningStep.fromJson(Map<String, Object?> j) => WeaningStep(
        id: j['id']! as String,
        type: j['type']! as String,
        n: (j['n']! as num).toInt(),
        start: j['start']! as String,
        len: (j['len']! as num).toInt(),
        status: j['status']! as String,
      );

  Map<String, Object?> toJson() => {'id': id, 'type': type, 'n': n, 'start': start, 'len': len, 'status': status};
}

class WeaningPlan {
  const WeaningPlan({
    required this.id,
    required this.childId,
    required this.pace,
    required this.nightMode,
    required this.steps,
    required this.status,
    required this.pauseReason,
    required this.startedAt,
    required this.createdAt,
    required this.updatedAt,
  });
  final String id;
  final String? childId;
  final Pace pace;
  final NightMode nightMode;
  final List<WeaningStep> steps;
  final PlanStatus status;
  final PauseReason? pauseReason;
  final String startedAt;
  final String createdAt;
  final String updatedAt;

  WeaningPlan _touch(List<WeaningStep> steps, {PlanStatus? status, Object? pauseReason = _keep}) => WeaningPlan(
        id: id,
        childId: childId,
        pace: pace,
        nightMode: nightMode,
        steps: steps,
        status: status ?? this.status,
        pauseReason: identical(pauseReason, _keep) ? this.pauseReason : pauseReason as String?,
        startedAt: startedAt,
        createdAt: createdAt,
        updatedAt: jsToIsoString(DomainClock.now()),
      );

  factory WeaningPlan.fromJson(Map<String, Object?> j) => WeaningPlan(
        id: j['id']! as String,
        childId: j['childId'] as String?,
        pace: j['pace']! as String,
        nightMode: j['nightMode']! as String,
        steps: [for (final s in j['steps']! as List) WeaningStep.fromJson((s as Map).cast<String, Object?>())],
        status: j['status']! as String,
        pauseReason: j['pauseReason'] as String?,
        startedAt: j['startedAt']! as String,
        createdAt: j['createdAt']! as String,
        updatedAt: j['updatedAt']! as String,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'childId': childId,
        'pace': pace,
        'nightMode': nightMode,
        'steps': [for (final s in steps) s.toJson()],
        'status': status,
        'pauseReason': pauseReason,
        'startedAt': startedAt,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

const Object _keep = Object();

class WeaningError implements Exception {
  const WeaningError(this.code);
  final String code;
  @override
  String toString() => code;
}

// ── Dates ──────────────────────────────────────────────────────────────────────────────────────
String isoDay(DateTime d) => '${d.year}-${pad2(d.month)}-${pad2(d.day)}';

List<int?> _ymd(String day) {
  final parts = (day.length > 10 ? day.substring(0, 10) : day).split('-');
  int? p(int i) => i < parts.length ? int.tryParse(parts[i]) : null;
  return [p(0), p(1), p(2)];
}

DateTime parseDay(String day) {
  final [y, m, d] = _ymd(day);
  return DateTime(y ?? 0, (m == null || m == 0 ? 1 : m), (d == null || d == 0 ? 1 : d));
}

String addDaysToDay(String day, int n) {
  final d = parseDay(day);
  return isoDay(DateTime(d.year, d.month, d.day + n));
}

/// Whole calendar days from a to b (DST-safe).
int daysBetween(String a, String b) {
  final [ay, am, ad] = _ymd(a);
  final [by, bm, bd] = _ymd(b);
  return jsRoundInt((jsDateUtc(by!, bm! - 1, bd!) - jsDateUtc(ay!, am! - 1, ad!)) / 86400000);
}

/// Whole months between a birth date and now; null when unknown or in the future.
int? ageInMonths(String? birthDate, [DateTime? now]) {
  final n = now ?? DomainClock.now();
  if (birthDate == null || birthDate.isEmpty || !RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(birthDate)) return null;
  final b = parseDay(birthDate);
  if (b.isAfter(n)) return null;
  var months = (n.year - b.year) * 12 + (n.month - b.month);
  if (n.day < b.day) months -= 1;
  return math.max(0, months);
}

/// Tile: Ana module, active child at least 9 months, admin switch on.
bool isWeaningTileVisible({required String? lifeStage, required String? birthDate, required Object? setting, DateTime? now}) {
  if (lifeStage != 'mommy' || setting != 'on') return false;
  final months = ageInMonths(birthDate, now);
  return months != null && months >= tileMinMonths;
}

// ── Plan building ──────────────────────────────────────────────────────────────────────────────
num planStepCount(Feeds f, NightMode nightMode) =>
    (f.morning ? 1 : 0) + f.day + (f.nap ? 1 : 0) + (f.bedtime ? 1 : 0) + (nightMode == 'last' ? f.night : 0);

int planWeeks(Feeds feeds, NightMode nightMode, Pace pace) => (planStepCount(feeds, nightMode) * paceDays[pace]! / 7).ceil();

Feeds clampFeeds(Feeds f) {
  int n(num v, int max) {
    final x = v.isNaN ? 0 : jsRoundInt(v);
    return math.max(0, math.min(max, x));
  }

  return Feeds(morning: f.morning, day: n(f.day, feedMax['day']!), nap: f.nap, bedtime: f.bedtime, night: n(f.night, feedMax['night']!));
}

/// Order: daytime → nap → morning → night (only when 'last') → bedtime last.
List<WeaningStep> buildSteps(Feeds feedsIn, Pace pace, NightMode nightMode, String start) {
  final len = paceDays[pace];
  if (len == null) throw const WeaningError('WEANING_PACE');
  final f = clampFeeds(feedsIn);
  final order = <({FeedType type, int n})>[];
  for (var i = 0; i < f.day; i++) {
    order.add((type: 'day', n: f.day > 1 ? i + 1 : 0));
  }
  if (f.nap) order.add((type: 'nap', n: 0));
  if (f.morning) order.add((type: 'morning', n: 0));
  if (nightMode == 'last') {
    for (var i = 0; i < f.night; i++) {
      order.add((type: 'night', n: f.night > 1 ? i + 1 : 0));
    }
  }
  if (f.bedtime) order.add((type: 'bedtime', n: 0));
  var s = start;
  final out = <WeaningStep>[];
  for (var i = 0; i < order.length; i++) {
    out.add(WeaningStep(id: 's$i', type: order[i].type, n: order[i].n, start: s, len: len, status: 'todo'));
    s = addDaysToDay(s, len);
  }
  return out;
}

/// Plan ids are UUIDs; the generator is injectable so tests are deterministic.
String Function() weaningIdGenerator = _uuidV4;

String _uuidV4() {
  final r = math.Random.secure();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAllMapped(RegExp('[xy]'), (m) {
    final v = r.nextInt(16);
    return (m[0] == 'x' ? v : (v & 0x3) | 0x8).toRadixString(16);
  });
}

WeaningPlan createPlan({required Feeds feeds, required Pace pace, required NightMode nightMode, required String start, required String? childId, DateTime? now}) {
  final f = clampFeeds(feeds);
  final mode = f.night > 0 ? nightMode : 'last';
  final steps = buildSteps(f, pace, mode, start);
  if (steps.isEmpty) throw const WeaningError('WEANING_EMPTY_PLAN');
  final at = jsToIsoString(now ?? DomainClock.now());
  return WeaningPlan(
    id: weaningIdGenerator(),
    childId: childId,
    pace: pace,
    nightMode: mode,
    steps: steps,
    status: 'active',
    pauseReason: null,
    startedAt: start,
    createdAt: at,
    updatedAt: at,
  );
}

/// Keep later steps contiguous after step [index] moved or changed length.
List<WeaningStep> recomputeFrom(List<WeaningStep> steps, int index) {
  final out = [...steps];
  for (var i = math.max(1, index + 1); i < out.length; i++) {
    out[i] = out[i].copyWith(start: addDaysToDay(out[i - 1].start, out[i - 1].len));
  }
  return out;
}

int currentStepIndex(WeaningPlan plan) => plan.steps.indexWhere((s) => s.status != 'done');

WeaningStep? currentStep(WeaningPlan plan) {
  final i = currentStepIndex(plan);
  return i < 0 ? null : plan.steps[i];
}

/// 'done' | 'future' | 'cur'
String stepState(WeaningStep step, String today) {
  if (step.status == 'done') return 'done';
  return daysBetween(step.start, today) < 0 ? 'future' : 'cur';
}

int doneCount(WeaningPlan plan) => plan.steps.where((s) => s.status == 'done').length;

/// Last day of the plan (inclusive).
String planLastDay(WeaningPlan plan) {
  final last = plan.steps.last;
  return addDaysToDay(last.start, last.len - 1);
}

int stepDay(WeaningStep step, String today) => daysBetween(step.start, today) + 1;
bool canComplete(WeaningStep step, String today) => step.status != 'done' && stepDay(step, today) >= minDays;
String nextUnlockDay(WeaningStep step) => addDaysToDay(step.start, minDays);

bool canStartNow(WeaningPlan plan, String today) {
  if (plan.status != 'active') return false;
  final i = currentStepIndex(plan);
  if (i <= 0) return false;
  if (stepState(plan.steps[i], today) != 'future') return false;
  return daysBetween(plan.steps[i - 1].start, today) >= minDays;
}

/// Mark the running step done; an overdue next step starts today, a future one keeps its date.
WeaningPlan completeCurrent(WeaningPlan plan, String today) {
  final i = currentStepIndex(plan);
  if (i < 0 || !canComplete(plan.steps[i], today)) return plan;
  var steps = [for (var k = 0; k < plan.steps.length; k++) k == i ? plan.steps[k].copyWith(status: 'done') : plan.steps[k]];
  final next = i + 1 < steps.length ? steps[i + 1] : null;
  if (next != null && daysBetween(next.start, today) > 0) {
    steps = [for (var k = 0; k < steps.length; k++) k == i + 1 ? steps[k].copyWith(start: today) : steps[k]];
    steps = recomputeFrom(steps, i + 1);
  }
  return next == null ? plan._touch(steps, status: 'finished', pauseReason: null) : plan._touch(steps);
}

WeaningPlan startNow(WeaningPlan plan, String today) {
  if (!canStartNow(plan, today)) return plan;
  final i = currentStepIndex(plan);
  return plan._touch(recomputeFrom([for (var k = 0; k < plan.steps.length; k++) k == i ? plan.steps[k].copyWith(start: today) : plan.steps[k]], i));
}

WeaningPlan extendStep(WeaningPlan plan, String stepId, int days) {
  final i = plan.steps.indexWhere((s) => s.id == stepId);
  if (i < 0 || plan.steps[i].status == 'done' || days <= 0) return plan;
  return plan._touch(recomputeFrom(
      [for (var k = 0; k < plan.steps.length; k++) k == i ? plan.steps[k].copyWith(len: plan.steps[k].len + days) : plan.steps[k]], i));
}

WeaningPlan pausePlan(WeaningPlan plan, PauseReason reason) {
  if (plan.status != 'active' && plan.status != 'paused') return plan;
  return plan._touch(plan.steps, status: 'paused', pauseReason: reason);
}

/// Resume; a running step that started before today restarts today.
({WeaningPlan plan, bool shifted}) resumePlan(WeaningPlan plan, String today) {
  if (plan.status != 'paused') return (plan: plan, shifted: false);
  final i = currentStepIndex(plan);
  var steps = plan.steps;
  var shifted = false;
  if (i >= 0 && daysBetween(steps[i].start, today) > 0) {
    steps = recomputeFrom([for (var k = 0; k < steps.length; k++) k == i ? steps[k].copyWith(start: today) : steps[k]], i);
    shifted = true;
  }
  return (plan: plan._touch(steps, status: 'active', pauseReason: null), shifted: shifted);
}

WeaningPlan cancelPlan(WeaningPlan plan) => plan._touch(plan.steps, status: 'cancelled', pauseReason: null);

// ── Readiness ──────────────────────────────────────────────────────────────────────────────────
/// 'mint' | 'amber' | 'red' | 'sky'
typedef Tone = String;
const List<String> reasons = ['work', 'tired', 'pregnant', 'doctor', 'ready'];

class Readiness {
  const Readiness({this.sick, this.change, this.allergy, this.reasons = const []});
  final bool? sick;
  final bool? change;
  final bool? allergy;
  final List<String> reasons;
}

const Readiness emptyReadiness = Readiness();
bool readinessAnswered(Readiness r) => r.sick != null && r.change != null && r.allergy != null;

class Verdict {
  const Verdict({required this.tone, required this.title, required this.text, required this.canPlan, required this.delay});
  final Tone tone;

  /// WEANING_COPY key.
  final String title;
  final String text;
  final bool canPlan;
  final int delay;
}

Verdict readinessVerdict(int? ageMonths, Readiness r) {
  if (ageMonths == null) {
    return const Verdict(tone: 'amber', title: 'weaning_verdict_nochild_title', text: 'weaning_verdict_nochild_text', canPlan: false, delay: 0);
  }
  if (ageMonths < planMinMonths) {
    return const Verdict(tone: 'red', title: 'weaning_verdict_young_title', text: 'weaning_verdict_young_text', canPlan: false, delay: 0);
  }
  if (r.sick == true) {
    return const Verdict(tone: 'amber', title: 'weaning_verdict_sick_title', text: 'weaning_verdict_sick_text', canPlan: true, delay: delaySickDays);
  }
  if (r.change == true) {
    return const Verdict(tone: 'amber', title: 'weaning_verdict_change_title', text: 'weaning_verdict_change_text', canPlan: true, delay: delayChangeDays);
  }
  return const Verdict(tone: 'mint', title: 'weaning_verdict_ok_title', text: 'weaning_verdict_ok_text', canPlan: true, delay: 0);
}

// ── Daily check-in (red flags) ────────────────────────────────────────────────────────────────
class CheckinAnswers {
  const CheckinAnswers({
    this.childMood,
    this.diapers,
    this.childSick = false,
    this.fullness,
    this.lump = false,
    this.red = false,
    this.fever = false,
    this.motherMood,
  });

  /// 'happy' | 'ok' | 'sad'
  final String? childMood;

  /// 'ok' | 'few'
  final String? diapers;
  final bool childSick;

  /// 'none' | 'some' | 'much'
  final String? fullness;
  final bool lump;
  final bool red;
  final bool fever;

  /// 'good' | 'mixed' | 'low'
  final String? motherMood;

  CheckinAnswers copyWith({String? childMood, String? diapers, bool? childSick, String? fullness, bool? lump, bool? red, bool? fever, String? motherMood}) =>
      CheckinAnswers(
        childMood: childMood ?? this.childMood,
        diapers: diapers ?? this.diapers,
        childSick: childSick ?? this.childSick,
        fullness: fullness ?? this.fullness,
        lump: lump ?? this.lump,
        red: red ?? this.red,
        fever: fever ?? this.fever,
        motherMood: motherMood ?? this.motherMood,
      );
}

const CheckinAnswers emptyCheckin = CheckinAnswers();
bool checkinComplete(CheckinAnswers c) => c.childMood != null && c.fullness != null && c.motherMood != null && c.diapers != null;

/// 'pause' | 'slow' | 'extend' | 'offerPause' | null
typedef CheckinAction = String?;

class CheckinResult {
  CheckinResult({required this.tone, required this.title, required this.items, required this.action, required this.moodLink, required this.emergency});
  Tone tone;
  String title;
  final List<String> items;
  CheckinAction action;
  final bool moodLink;
  final bool emergency;
}

CheckinResult evaluateCheckin(CheckinAnswers c) {
  final moodLink = c.motherMood == 'low';
  if ((c.lump || c.red) && c.fever) {
    return CheckinResult(
        tone: 'red',
        title: 'weaning_res_mastitis_title',
        items: ['weaning_res_mastitis_1', 'weaning_res_mastitis_2', 'weaning_res_mastitis_3'],
        action: 'pause',
        moodLink: moodLink,
        emergency: false);
  }
  if (c.diapers == 'few' && c.childSick) {
    return CheckinResult(
        tone: 'red',
        title: 'weaning_res_dehyd_title',
        items: ['weaning_res_dehyd_1', 'weaning_res_dehyd_2', 'weaning_res_dehyd_3'],
        action: 'pause',
        moodLink: moodLink,
        emergency: true);
  }
  final out = CheckinResult(tone: 'mint', title: 'weaning_res_ok_title', items: [], action: null, moodLink: moodLink, emergency: false);
  if (c.lump || c.red) {
    out
      ..tone = 'amber'
      ..title = 'weaning_res_clog_title'
      ..action = 'slow';
    out.items.addAll(['weaning_res_clog_1', 'weaning_res_clog_2', 'weaning_res_clog_3']);
  } else if (c.fullness == 'much') {
    out
      ..tone = 'amber'
      ..title = 'weaning_res_full_title'
      ..action = 'extend';
    out.items.addAll(['weaning_res_full_1', 'weaning_res_full_2']);
  }
  if (c.childSick) {
    if (out.tone == 'mint') {
      out
        ..tone = 'sky'
        ..title = 'weaning_res_sick_title';
    }
    out.items.add('weaning_res_sick_item');
    out.action = out.action ?? 'offerPause';
  }
  if (c.childMood == 'sad') out.items.add('weaning_res_child_sad');
  if (c.motherMood == 'low') out.items.add('weaning_res_mother_low');
  if (out.items.isEmpty) out.items.add('weaning_res_ok_item');
  return out;
}

/// Pause (doctor), slow down (+3 days) or extend (+2 days) the running step.
WeaningPlan applyCheckin(WeaningPlan plan, CheckinResult res) {
  if (plan.status != 'active' && plan.status != 'paused') return plan;
  if (res.action == 'pause') return pausePlan(plan, 'doctor');
  final cur = currentStep(plan);
  if (cur == null) return plan;
  if (res.action == 'slow') return extendStep(plan, cur.id, slowExtendDays);
  if (res.action == 'extend') return extendStep(plan, cur.id, fullExtendDays);
  return plan;
}

// ── Nutrition ──────────────────────────────────────────────────────────────────────────────────
/// 'low' | 'good' | 'over'
String milkStatus(num cups) {
  final ml = cups * cupMl;
  if (ml > milkMaxMl) return 'over';
  if (ml >= milkMinMl) return 'good';
  return 'low';
}

/// Steps whose start-day reminder (09:00) is still ahead.
List<({WeaningStep step, DateTime at})> reminderDays(WeaningPlan plan, DateTime now) {
  if (plan.status != 'active') return [];
  return [
    for (final s in plan.steps)
      if (s.status != 'done') (step: s, at: () {
        final d = parseDay(s.start);
        return DateTime(d.year, d.month, d.day, 9);
      }()),
  ].where((r) => r.at.millisecondsSinceEpoch > now.millisecondsSinceEpoch + 60000).toList();
}
