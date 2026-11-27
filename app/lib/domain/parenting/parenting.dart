// Ported from: src/lib/parenting.ts (tile/age rules, daily tip, programme progress, quiz navigation and scoring,
// milestone self-check, bookmarks, reading time, effectiveBand). The device store / multi-child slot merge
// (sanitizeParenting, readSlot/writeSlot, normalizeForChild, setProgrammeState…) is not ported yet.

import 'dart:math' as math;

import '../js_compat.dart';
import '../pregnancy/pregnancy_utils.dart' show correctionMaxMonths, prematureGestationLimitDays;
import '../weaning/weaning.dart' show ageInMonths, isoDay;
import 'data/parenting_data.g.dart';

export '../weaning/weaning.dart' show ageInMonths, isoDay;

/// '0-1' | '1-3' | '3-6' | '6-12'
typedef AgeBandId = String;
const List<AgeBandId> ageBands = ['0-1', '1-3', '3-6', '6-12'];

/// Up to and including 12 years.
const int maxMonths = 13 * 12;

/// Content is registered for this app language.
bool isParentingLanguage(String? language) => parentingContentLanguages.contains(language ?? '');

/// Under 13, or no birth date (the parent picks the band).
bool isParentingAge(String? birthDate, [DateTime? now]) {
  final months = ageInMonths(birthDate, now);
  return months == null || months < maxMonths;
}

/// Tile: Ana module, content for the language, app_settings.parenting_tool = 'on', a child under 13 (or unknown).
/// With [birthDates] (multi-child) any child under 13 or without a birth date keeps it.
bool isParentingTileVisible({
  required String? lifeStage,
  required String? language,
  required Object? setting,
  String? birthDate,
  List<String?>? birthDates,
  DateTime? now,
}) {
  if (lifeStage != 'mommy' || setting != 'on' || !isParentingLanguage(language)) return false;
  if (birthDates != null && birthDates.isNotEmpty) return birthDates.any((d) => isParentingAge(d, now));
  return isParentingAge(birthDate, now);
}

/// Children the tool is for, in the given order.
List<T> parentingChildren<T>(List<T> kids, String? Function(T) birthDateOf, [DateTime? now]) =>
    kids.where((k) => isParentingAge(birthDateOf(k), now)).toList();

/// The explicitly picked child, else the preferred one, else the first eligible one.
T? pickParentingChild<T>(List<T> kids, {required String? Function(T) idOf, required String? Function(T) birthDateOf, String? picked, String? preferred, DateTime? now}) {
  final list = parentingChildren(kids, birthDateOf, now);
  T? byId(String? id) {
    if (id == null || id.isEmpty) return null;
    for (final k in list) {
      if (idOf(k) == id) return k;
    }
    return null;
  }

  return byId(picked) ?? byId(preferred) ?? (list.isEmpty ? null : list.first);
}

bool isParentingPartnerVisible({
  required String? womanLifeStage,
  required String? language,
  required Object? setting,
  String? birthDate,
  List<String?>? birthDates,
  DateTime? now,
}) =>
    isParentingTileVisible(lifeStage: womanLifeStage, language: language, setting: setting, birthDate: birthDate, birthDates: birthDates, now: now);

/// Partner mode: her current child he can see, else her profile's baby.
({String? name, String? birthDate})? partnerParentingChild(
    List<({String name, String? birthDate, bool isCurrent})> children, ({String? babyName, String? babyBirthDate})? profile) {
  final current = children.where((c) => c.isCurrent);
  final kid = current.isNotEmpty ? current.first : (children.isNotEmpty ? children.first : null);
  if (kid != null) return (name: kid.name, birthDate: kid.birthDate);
  return profile == null ? null : (name: profile.babyName, birthDate: profile.babyBirthDate);
}

/// The age band for this many months (null when unknown or 13+).
AgeBandId? ageBandFor(num? months) {
  if (months == null || !months.isFinite || months < 0) return null;
  if (months < 12) return '0-1';
  if (months < 36) return '1-3';
  if (months < 72) return '3-6';
  if (months < maxMonths) return '6-12';
  return null;
}

int _dayNumber(String day) {
  final parts = (day.length > 10 ? day.substring(0, 10) : day).split('-');
  int p(int i, int d) {
    final v = i < parts.length ? int.tryParse(parts[i]) : null;
    return v == null || v == 0 ? d : v;
  }

  return (jsDateUtc(p(0, 0), p(1, 1) - 1, p(2, 1)) / 86400000).floor();
}

/// Deterministic tip of the day (-1 when there are no tips).
int dailyTipIndex(String today, int count) {
  if (count <= 0) return -1;
  return ((_dayNumber(today) % count) + count) % count;
}

bool isParentingHomeCardVisible({
  required String? lifeStage,
  required String? language,
  required Object? setting,
  String? birthDate,
  List<String?>? birthDates,
  DateTime? now,
  bool toolDisabled = false,
  bool recovering = false,
}) {
  if (toolDisabled || recovering) return false;
  return isParentingTileVisible(lifeStage: lifeStage, language: language, setting: setting, birthDate: birthDate, birthDates: birthDates, now: now);
}

/// A child's manual band choice: `band` (null = follow the child) and `bandFor` (the child's band when chosen;
/// [bandForUnset] when missing, as in data from before multi-child support).
class BandChoice {
  const BandChoice({this.band, this.bandFor = bandForUnset});
  final AgeBandId? band;
  final Object? bandFor;
}

/// Marker for a missing `bandFor` (TypeScript `undefined`).
const Object bandForUnset = _Unset();

class _Unset {
  const _Unset();
}

/// The parent's manual band while it still fits the child, else the child's band.
AgeBandId? effectiveBand(BandChoice slot, AgeBandId? childBand) {
  if (slot.band == null || slot.band!.isEmpty) return childBand;
  if (identical(slot.bandFor, bandForUnset) || slot.bandFor == childBand) return slot.band;
  return childBand;
}

/// Today's tip as the tool's home shows it: slot band, else chosen band, else the child's band, else 1-3.
({AgeBandId band, int index, T tip})? homeTipFor<T>(Map<AgeBandId, List<T>> tips,
    {String? birthDate, AgeBandId? chosenBand, BandChoice? slot, DateTime? now}) {
  final n = now ?? DomainClock.now();
  final childBand = ageBandFor(ageInMonths(birthDate, n));
  final band = (slot != null ? effectiveBand(slot, childBand) : chosenBand ?? childBand) ?? '1-3';
  final list = tips[band] ?? <T>[];
  final index = dailyTipIndex(isoDay(n), list.length);
  return index < 0 ? null : (band: band, index: index, tip: list[index]);
}

// ── Programmes ─────────────────────────────────────────────────────────────────────────────────
class ProgrammeProgress {
  const ProgrammeProgress({required this.startedAt, required this.done, required this.updatedAt, this.paused});
  final String startedAt;

  /// Calendar day each programme day was checked off, in order.
  final List<String> done;
  final String updatedAt;
  final bool? paused;

  Map<String, Object?> toJson() => {'startedAt': startedAt, 'done': done, 'updatedAt': updatedAt, if (paused == true) 'paused': true};
}

const int freeProgrammeDays = 3;
bool isDayLocked(int dayIndex, bool isPremium) => !isPremium && dayIndex >= freeProgrammeDays;

ProgrammeProgress startProgramme(String today) => ProgrammeProgress(startedAt: today, done: const [], updatedAt: today);

int nextDayIndex(ProgrammeProgress? p) => p == null ? 0 : p.done.length;

/// One step a day: the next day can be checked off once per calendar day.
bool canCompleteToday(ProgrammeProgress? p, int total, String today) {
  if (p == null || p.done.length >= total) return false;
  return p.done.isEmpty || p.done.last != today;
}

ProgrammeProgress completeDay(ProgrammeProgress p, int total, String today) {
  if (!canCompleteToday(p, total, today)) return p;
  return ProgrammeProgress(startedAt: p.startedAt, done: [...p.done, today], updatedAt: today, paused: p.paused);
}

ProgrammeProgress undoLastDay(ProgrammeProgress p, String today) {
  if (p.done.isEmpty) return p;
  return ProgrammeProgress(startedAt: p.startedAt, done: p.done.sublist(0, p.done.length - 1), updatedAt: today, paused: p.paused);
}

bool isFinished(ProgrammeProgress? p, int total) => p != null && p.done.length >= total;

int progressPercent(ProgrammeProgress? p, int total) =>
    p == null || total <= 0 ? 0 : jsRoundInt(math.min(p.done.length, total) / total * 100);

({int days, String from, String to})? programmeSummary(ProgrammeProgress? p, int total) {
  if (p == null || !isFinished(p, total)) return null;
  final days = p.done.take(total).toList();
  return (days: days.length, from: days.isNotEmpty ? days.first : p.startedAt, to: days.isNotEmpty ? days.last : p.startedAt);
}

/// Another programme for the band, not started first, then a running one; outside the band only when nothing
/// in the band is left.
P? suggestNextProgramme<P>(List<P> programmes, Map<String, ProgrammeProgress> progress, AgeBandId band, String currentId,
    {required String Function(P) idOf, required List<AgeBandId> Function(P) bandsOf, required int Function(P) daysOf}) {
  final open = programmes.where((p) => idOf(p) != currentId && !isFinished(progress[idOf(p)], daysOf(p)));
  int rank(P p) => (bandsOf(p).contains(band) ? 0 : 2) + (progress[idOf(p)] != null ? 1 : 0);
  final sorted = jsSorted(open, (P a, P b) => rank(a) - rank(b));
  return sorted.isEmpty ? null : sorted.first;
}

// ── Quiz navigation ────────────────────────────────────────────────────────────────────────────
class QuizNav<T> {
  const QuizNav({required this.pos, required this.answers});
  final int pos;

  /// null = unanswered (TypeScript `undefined` / hole).
  final List<T?> answers;
}

QuizNav<T> startQuiz<T>() => QuizNav<T>(pos: 0, answers: const []);

QuizNav<T> quizAnswer<T>(QuizNav<T> nav, T value, int total) {
  if (nav.pos >= total) return nav;
  final answers = [...nav.answers];
  while (answers.length <= nav.pos) {
    answers.add(null);
  }
  answers[nav.pos] = value;
  return QuizNav(pos: nav.pos + 1, answers: answers);
}

QuizNav<T> quizBack<T>(QuizNav<T> nav) => nav.pos > 0 ? QuizNav(pos: nav.pos - 1, answers: nav.answers) : nav;

bool quizDone<T>(QuizNav<T> nav, int total) =>
    nav.pos >= total && List.generate(total, (i) => i < nav.answers.length ? nav.answers[i] : null).every((a) => a != null);

// ── Quizzes ────────────────────────────────────────────────────────────────────────────────────
/// 'warmth' | 'structure' | 'harsh' | 'giveIn'
typedef StyleDimension = String;

/// 'balanced' | 'gentle' | 'storm' | 'strict' | 'stretched'
typedef StyleResultId = String;

/// Average per dimension for 0…3 answers.
Map<StyleDimension, double> styleScores(List<StyleDimension> itemDims, List<num?> answers) {
  final sum = <String, num>{'warmth': 0, 'structure': 0, 'harsh': 0, 'giveIn': 0};
  final n = <String, int>{'warmth': 0, 'structure': 0, 'harsh': 0, 'giveIn': 0};
  for (var i = 0; i < itemDims.length; i++) {
    final a = i < answers.length ? answers[i] : null;
    if (a == null || a < 0 || a > 3) continue;
    sum[itemDims[i]] = sum[itemDims[i]]! + a;
    n[itemDims[i]] = n[itemDims[i]]! + 1;
  }
  double avg(String d) => n[d]! != 0 ? sum[d]! / n[d]! : 0;
  return {'warmth': avg('warmth'), 'structure': avg('structure'), 'harsh': avg('harsh'), 'giveIn': avg('giveIn')};
}

StyleResultId styleResult(Map<StyleDimension, double> s) {
  final warm = s['warmth']! >= 1.75;
  final clear = s['structure']! >= 1.75 && s['giveIn']! < 1.75;
  final harsh = s['harsh']! >= 1.5;
  if (warm && harsh) return 'storm';
  if (harsh) return 'strict';
  if (warm && clear) return 'balanced';
  if (warm) return 'gentle';
  return clear ? 'strict' : 'stretched';
}

const int _pregnancyDays = 280;
const int _minGestationDays = 140;
const int _maxGestationDays = 310;

/// Age used by the milestone self-check: corrected age for a preterm baby until 24 corrected months.
({int? months, bool corrected}) milestoneAge(String? birthDate, String? dueDate, [DateTime? now]) {
  final n = now ?? DomainClock.now();
  final months = ageInMonths(birthDate, n);
  if (months == null || birthDate == null || birthDate.isEmpty || dueDate == null || !RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(dueDate)) {
    return (months: months, corrected: false);
  }
  final gestation = _pregnancyDays - (_dayNumber(dueDate) - _dayNumber(birthDate));
  if (gestation < _minGestationDays || gestation > _maxGestationDays || gestation >= prematureGestationLimitDays) {
    return (months: months, corrected: false);
  }
  final corrected = ageInMonths(dueDate, n) ?? 0;
  return corrected < correctionMaxMonths ? (months: corrected, corrected: true) : (months: months, corrected: false);
}

const int milestoneAfterLastMonths = 12;
const int _sixYearsMonths = 72;

class MilestoneItem {
  const MilestoneItem({required this.text, this.flag = false, this.support = ''});
  final String text;
  final bool flag;
  final String support;
}

class MilestoneCheckpoint {
  const MilestoneCheckpoint({required this.id, required this.fromMonths, required this.title, required this.items});
  final String id;
  final num fromMonths;
  final String title;
  final List<MilestoneItem> items;
}

num? milestoneCheckEnd(List<MilestoneCheckpoint> checkpoints) =>
    checkpoints.isEmpty ? null : checkpoints.map((c) => c.fromMonths).reduce(math.max) + milestoneAfterLastMonths;

bool milestoneCheckOffered(List<MilestoneCheckpoint> checkpoints, num? months, AgeBandId band) {
  final end = milestoneCheckEnd(checkpoints);
  if (end == null) return false;
  return months == null ? band != '6-12' : months < math.min(end, _sixYearsMonths);
}

num? tooEarlyForMilestones(List<MilestoneCheckpoint> checkpoints, num? months) {
  if (months == null || checkpoints.isEmpty) return null;
  final first = checkpoints.map((c) => c.fromMonths).reduce(math.min);
  return months < first ? first : null;
}

MilestoneCheckpoint? checkpointFor(List<MilestoneCheckpoint> checkpoints, num? months) {
  if (checkpoints.isEmpty) return null;
  final sorted = jsSorted(checkpoints, (MilestoneCheckpoint a, MilestoneCheckpoint b) => a.fromMonths - b.fromMonths);
  if (months == null) return sorted.first;
  var found = sorted.first;
  for (final c in sorted) {
    if (months >= c.fromMonths) found = c;
  }
  return found;
}

/// 'ontrack' | 'watch' | 'talk' with the not-yet and flagged item indexes. Answers: 'yes' | 'no' | 'unsure'.
({String id, List<int> notYet, List<int> flagged}) milestoneResult(MilestoneCheckpoint checkpoint, List<String?> answers, String? regression) {
  final notYet = <int>[], flagged = <int>[];
  for (var i = 0; i < checkpoint.items.length; i++) {
    final a = i < answers.length ? answers[i] : null;
    if (a == 'no' || a == 'unsure') notYet.add(i);
    if (a == 'no' && checkpoint.items[i].flag) flagged.add(i);
  }
  final id = regression == 'yes' || flagged.isNotEmpty ? 'talk' : (notYet.length >= 3 ? 'watch' : 'ontrack');
  return (id: id, notYet: notYet, flagged: flagged);
}

// ── Bookmarks and reading time ─────────────────────────────────────────────────────────────────
const String defaultReminderTime = '20:30';
String parentingStorageKey(String? uid) => 'anacan.parenting.v1.${uid == null || uid.isEmpty ? 'guest' : uid}';

/// Add or remove a bookmark (newest first, at most 200).
List<String> toggleSaved(List<String> saved, String ref) =>
    saved.contains(ref) ? saved.where((x) => x != ref).toList() : [ref, ...saved].take(200).toList();

/// Rough reading time at ~180 words a minute (at least 1 minute).
int readingMinutes(List<String?> parts) {
  final words = parts.where((p) => p != null && p.isNotEmpty).join(' ').split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
  return math.max(1, jsRoundInt(words / 180));
}
