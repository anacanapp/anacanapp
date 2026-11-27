// Ported from: src/lib/onboarding-model.ts
//
// The v3 onboarding draft (account + backend scoped, localStorage key `anacan-onboarding-v3:<host>:<actor>`,
// JSON shape unchanged), the step machine, answer validation and the server journey record.

import 'dart:convert';

import '../../core/offline/offline_outbox.dart' show newClientId;
import '../../domain/js_compat.dart' show DomainClock;

const String onboardingSchema = 'anacan-onboarding-v3';
const List<String> onboardingStages = ['bump', 'mommy', 'flow'];

/// 'free' | 'purchased' | 'restored' | 'existing'
typedef OnboardingOutcome = String;

/// 'granted' | 'denied' | 'skipped'
typedef NotificationChoice = String;

/// Step id: welcome, stage, name, data, support, privacy, value, notifications, analysis, results, features,
/// paywall, offer, free, success, or a question id.
typedef OnboardingStep = String;

const Map<String, List<String>> questionOptions = {
  'firstPregnancy': ['first', 'second'],
  'bumpSymptoms': ['nausea', 'fatigue', 'backpain', 'insomnia', 'heartburn', 'swelling', 'none'],
  'bumpInterests': ['development', 'nutrition', 'exercise', 'birth_prep', 'names', 'shopping'],
  'feeding': ['breast', 'formula', 'mixed', 'solid'],
  'nightWakes': ['rare', 'sometimes', 'often', 'varies'],
  'mommyInterests': ['sleep', 'feeding', 'milestones', 'vaccines', 'teething', 'games'],
  'flowGoal': ['track', 'conceive', 'health', 'symptoms'],
  'regularity': ['regular', 'irregular', 'unsure'],
  'flowSymptoms': ['cramps', 'mood', 'bloating', 'headache', 'acne', 'none'],
  'sleep': ['rested', 'interrupted', 'poor'],
  'supportLevel': ['supported', 'some', 'little'],
  'duration': ['months', 'year', 'unsure'],
  'budget': ['value', 'flexible', 'undecided'],
};

const Map<String, List<String>> concerns = {
  'bump': ['birth', 'baby_health', 'body', 'finances'],
  'mommy': ['rest', 'loneliness', 'feeding', 'own_time'],
  'flow': ['irregular', 'pain', 'pms', 'fertility'],
};

const Set<String> multiQuestions = {'bumpSymptoms', 'bumpInterests', 'mommyInterests', 'flowSymptoms'};

const Map<String, List<String>> branchQuestions = {
  'bump': ['firstPregnancy', 'bumpSymptoms', 'bumpInterests'],
  'mommy': ['feeding', 'nightWakes', 'mommyInterests'],
  'flow': ['flowGoal', 'regularity', 'flowSymptoms'],
};

bool isOnboardingStage(Object? stage) => stage is String && onboardingStages.contains(stage);
bool isQuestion(String step) => step == 'concern' || questionOptions.containsKey(step);

class OnboardingChild {
  const OnboardingChild({required this.id, this.name = '', this.gender = '', this.birthDate = '', this.term = '', this.gestationalWeeks = 34});
  final String id;
  final String name;

  /// 'boy' | 'girl' | ''
  final String gender;
  final String birthDate;

  /// 'term' | 'preterm' | ''
  final String term;
  final int gestationalWeeks;

  OnboardingChild copyWith({String? name, String? gender, String? birthDate, String? term, int? gestationalWeeks}) => OnboardingChild(
        id: id,
        name: name ?? this.name,
        gender: gender ?? this.gender,
        birthDate: birthDate ?? this.birthDate,
        term: term ?? this.term,
        gestationalWeeks: gestationalWeeks ?? this.gestationalWeeks,
      );

  Map<String, Object?> toJson() => {'id': id, 'name': name, 'gender': gender, 'birthDate': birthDate, 'term': term, 'gestationalWeeks': gestationalWeeks};

  @override
  bool operator ==(Object other) =>
      other is OnboardingChild &&
      other.id == id &&
      other.name == name &&
      other.gender == gender &&
      other.birthDate == birthDate &&
      other.term == term &&
      other.gestationalWeeks == gestationalWeeks;
  @override
  int get hashCode => Object.hash(id, name, gender, birthDate, term, gestationalWeeks);
}

/// The answer of a question: a [String] or a `List<String>` (multi questions).
typedef OnboardingAnswer = Object;

class OnboardingDraft {
  const OnboardingDraft({
    this.schema = onboardingSchema,
    required this.actor,
    required this.backend,
    required this.id,
    this.step = 'welcome',
    this.stage,
    this.name = '',
    this.dateMode = 'lmp',
    this.pregnancyDate = '',
    this.lastPeriodDate = '',
    this.cycleLength = 28,
    this.periodLength = 5,
    this.babyCount = 1,
    required this.children,
    this.deliveryType = '',
    this.answers = const {},
    this.notifications = 'skipped',
    this.setupComplete = false,
    this.saveStarted = false,
    this.offerSeen = false,
    this.purchasePending = false,
    this.plan = 'yearly',
    this.outcome,
  });

  final String schema;
  final String actor;
  final String backend;
  final String id;
  final OnboardingStep step;
  final String? stage;
  final String name;

  /// 'lmp' | 'due'
  final String dateMode;
  final String pregnancyDate;
  final String lastPeriodDate;
  final int cycleLength;
  final int periodLength;
  final int babyCount;
  final List<OnboardingChild> children;

  /// 'natural' | 'cesarean' | 'assisted' | ''
  final String deliveryType;
  final Map<String, OnboardingAnswer> answers;
  final NotificationChoice notifications;
  final bool setupComplete;
  final bool saveStarted;
  final bool offerSeen;
  final bool purchasePending;

  /// 'yearly' | 'monthly'
  final String plan;
  final OnboardingOutcome? outcome;

  static const Object _keep = Object();

  OnboardingDraft copyWith({
    String? id,
    OnboardingStep? step,
    Object? stage = _keep,
    String? name,
    String? dateMode,
    String? pregnancyDate,
    String? lastPeriodDate,
    int? cycleLength,
    int? periodLength,
    int? babyCount,
    List<OnboardingChild>? children,
    String? deliveryType,
    Map<String, OnboardingAnswer>? answers,
    NotificationChoice? notifications,
    bool? setupComplete,
    bool? saveStarted,
    bool? offerSeen,
    bool? purchasePending,
    String? plan,
    Object? outcome = _keep,
  }) =>
      OnboardingDraft(
        schema: schema,
        actor: actor,
        backend: backend,
        id: id ?? this.id,
        step: step ?? this.step,
        stage: identical(stage, _keep) ? this.stage : stage as String?,
        name: name ?? this.name,
        dateMode: dateMode ?? this.dateMode,
        pregnancyDate: pregnancyDate ?? this.pregnancyDate,
        lastPeriodDate: lastPeriodDate ?? this.lastPeriodDate,
        cycleLength: cycleLength ?? this.cycleLength,
        periodLength: periodLength ?? this.periodLength,
        babyCount: babyCount ?? this.babyCount,
        children: children ?? this.children,
        deliveryType: deliveryType ?? this.deliveryType,
        answers: answers ?? this.answers,
        notifications: notifications ?? this.notifications,
        setupComplete: setupComplete ?? this.setupComplete,
        saveStarted: saveStarted ?? this.saveStarted,
        offerSeen: offerSeen ?? this.offerSeen,
        purchasePending: purchasePending ?? this.purchasePending,
        plan: plan ?? this.plan,
        outcome: identical(outcome, _keep) ? this.outcome : outcome as String?,
      );

  Map<String, Object?> toJson() => {
        'schema': schema,
        'actor': actor,
        'backend': backend,
        'id': id,
        'step': step,
        'stage': stage,
        'name': name,
        'dateMode': dateMode,
        'pregnancyDate': pregnancyDate,
        'lastPeriodDate': lastPeriodDate,
        'cycleLength': cycleLength,
        'periodLength': periodLength,
        'babyCount': babyCount,
        'children': [for (final c in children) c.toJson()],
        'deliveryType': deliveryType,
        'answers': answers,
        'notifications': notifications,
        'setupComplete': setupComplete,
        'saveStarted': saveStarted,
        'offerSeen': offerSeen,
        'purchasePending': purchasePending,
        'plan': plan,
        'outcome': outcome,
      };

  @override
  bool operator ==(Object other) => other is OnboardingDraft && jsonEncode(other.toJson()) == jsonEncode(toJson());
  @override
  int get hashCode => jsonEncode(toJson()).hashCode;
}

class OnboardingJourneyRecord {
  const OnboardingJourneyRecord(this.raw);
  final Map<String, Object?> raw;
  String get id => raw['id'] as String;
  String get revision => raw['revision'] as String;
  String? get setupCompletedAt => raw['setupCompletedAt'] as String?;
  String? get completedAt => raw['completedAt'] as String?;
  String? get offerSeenAt => raw['offerSeenAt'] as String?;
  String? get outcome => raw['outcome'] as String?;
  String get plan => raw['plan'] == 'monthly' ? 'monthly' : 'yearly';
}

/// `onboardingQuestionOptions(draft, question)`.
List<String> onboardingQuestionOptions(OnboardingDraft draft, String question) {
  if (question != 'concern') return questionOptions[question] ?? const [];
  final stage = draft.stage;
  if (stage == null) return const [];
  return concerns[stage]!.where((option) => !(stage == 'flow' && draft.answers['regularity'] == 'regular' && option == 'irregular')).toList();
}

/// The step order. 'duration'/'budget' (purchase intent) were dropped to shorten setup.
List<OnboardingStep> onboardingSteps(String? stage, bool native) {
  const base = ['welcome', 'stage', 'name', 'data'];
  if (stage == null) return base;
  final branch = branchQuestions[stage]!;
  return [
    ...base, branch[0], 'support', branch[1], branch[2], 'privacy', 'concern', 'sleep', 'supportLevel', //
    'value', if (native) 'notifications', 'analysis', 'results', 'features', 'paywall',
  ];
}

OnboardingChild newOnboardingChild([String Function()? uuid]) => OnboardingChild(id: (uuid ?? newClientId)());

OnboardingDraft newOnboardingDraft(String actor, String backend, [String? name, String Function()? uuid]) {
  final n = name ?? '';
  return OnboardingDraft(
    actor: actor,
    backend: backend,
    id: (uuid ?? newClientId)(),
    name: n == 'İstifadəçi' ? '' : n,
    children: [newOnboardingChild(uuid)],
  );
}

/// Health answers and dates never leak between branches. The personal name remains.
OnboardingDraft selectOnboardingStage(OnboardingDraft draft, String stage) {
  if (draft.stage == stage) return draft.copyWith(step: 'name');
  return newOnboardingDraft(draft.actor, draft.backend, draft.name).copyWith(id: draft.id, stage: stage, step: 'name');
}

List<String> toggleOnboardingAnswer(OnboardingAnswer? current, String value) {
  final selected = current is List ? current.cast<String>() : const <String>[];
  if (value == 'none') return selected.contains('none') ? [] : ['none'];
  return selected.contains(value) ? selected.where((i) => i != value).toList() : [...selected.where((i) => i != 'none'), value];
}

/// 'yearly' | 'monthly'
String recommendedOnboardingPlan(Map<String, Object?> answers) =>
    answers['budget'] == 'flexible' || (answers['duration'] == 'months' && answers['budget'] != 'value') ? 'monthly' : 'yearly';

const int _day = 86400000;

/// Days since the epoch of a valid `YYYY-MM-DD`, else null.
int? calendarDay(String value) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  if (m == null) return null;
  final y = int.parse(m[1]!), mo = int.parse(m[2]!), d = int.parse(m[3]!);
  final t = DateTime.utc(y, mo, d);
  if (t.year != y || t.month != mo || t.day != d) return null;
  return (t.millisecondsSinceEpoch / _day).floor();
}

String _pad(int v, [int w = 2]) => v.toString().padLeft(w, '0');

String todayCalendarDate([DateTime? now]) {
  final n = now ?? DomainClock.now();
  return '${_pad(n.year, 4)}-${_pad(n.month)}-${_pad(n.day)}';
}

String _isoDay(int day) {
  final t = DateTime.fromMillisecondsSinceEpoch(day * _day, isUtc: true);
  return '${_pad(t.year, 4)}-${_pad(t.month)}-${_pad(t.day)}';
}

String addCalendarDays(String date, int days) {
  final day = calendarDay(date);
  if (day == null) throw StateError('ONBOARDING_INVALID_DATE');
  return _isoDay(day + days);
}

({String lastPeriod, String due}) pregnancyDates({required String pregnancyDate, required String dateMode}) {
  final lastPeriod = dateMode == 'due' ? addCalendarDays(pregnancyDate, -280) : pregnancyDate;
  return (lastPeriod: lastPeriod, due: addCalendarDays(lastPeriod, 280));
}

String? childDueDate(OnboardingChild child) => child.term == 'preterm'
    ? addCalendarDays(child.birthDate, 280 - child.gestationalWeeks * 7)
    : child.term == 'term'
        ? child.birthDate
        : null;

String multiplesType(int count) => const ['single', 'twins', 'triplets', 'quadruplets'][count - 1];

/// The copy key of the first invalid input, or null.
String? onboardingDataError(OnboardingDraft draft, [String? today]) {
  final now = calendarDay(today ?? todayCalendarDate())!;
  if (!isOnboardingStage(draft.stage)) return 'choose_stage';
  final name = draft.name.trim();
  if (name.isEmpty || name.length > 80) return 'name_required';
  if (draft.stage == 'bump') {
    final date = calendarDay(draft.pregnancyDate);
    if (date == null) return 'date_required';
    final lmp = draft.dateMode == 'due' ? date - 280 : date;
    if (lmp > now || now - lmp > 308) return 'pregnancy_date_invalid';
    if (draft.babyCount < 1 || draft.babyCount > 4) return 'baby_count_invalid';
  } else if (draft.stage == 'mommy') {
    if (draft.babyCount < 1 || draft.babyCount > 4 || draft.children.length != draft.babyCount) return 'baby_count_invalid';
    final identities = <String>{};
    for (final child in draft.children) {
      final childName = child.name.trim();
      if (childName.isEmpty || childName.length > 80) return 'child_name_required';
      if (!const ['boy', 'girl'].contains(child.gender)) return 'child_gender_required';
      final birth = calendarDay(child.birthDate);
      if (birth == null || birth > now || now - birth > 36525) return 'birth_date_invalid';
      if (child.term == 'preterm' && (child.gestationalWeeks < 22 || child.gestationalWeeks > 36)) return 'gestation_invalid';
      final key = '${childName.toLowerCase()}|${child.birthDate}';
      if (identities.contains(key)) return 'duplicate_child';
      identities.add(key);
    }
  } else {
    final date = calendarDay(draft.lastPeriodDate);
    if (date == null || date > now || now - date > 36525) return 'period_date_invalid';
    if (draft.cycleLength < 10 ||
        draft.cycleLength > 50 ||
        draft.periodLength < 2 ||
        draft.periodLength > 10 ||
        draft.periodLength > draft.cycleLength) {
      return 'cycle_length_invalid';
    }
  }
  return null;
}

/// Only known options of the branch; skipped questions are null (never invented).
Map<String, Object?> validatedOnboardingAnswers(OnboardingDraft draft) {
  final stage = draft.stage;
  if (stage == null) throw StateError('ONBOARDING_STAGE_REQUIRED');
  final allowed = [...branchQuestions[stage]!, 'concern', 'sleep', 'supportLevel', 'duration', 'budget'];
  final answers = <String, Object?>{};
  for (final question in allowed) {
    final options = onboardingQuestionOptions(draft, question);
    final value = draft.answers[question];
    if (multiQuestions.contains(question)) {
      final values = value is List ? <String>{...value.whereType<String>().where(options.contains)}.toList() : <String>[];
      answers[question] = values.contains('none') ? ['none'] : values;
    } else {
      answers[question] = value is String && options.contains(value) ? value : null;
    }
  }
  if (stage != 'flow') answers['multiples'] = multiplesType(draft.babyCount);
  return answers;
}

/// The v3 journey record inside `profiles.onboarding_answers.journey`.
OnboardingJourneyRecord? journeyRecord(Object? answers) {
  if (answers is! Map) return null;
  final journey = answers['journey'];
  if (journey is! Map || journey['version'] != 3 || journey['id'] is! String || journey['revision'] is! String) return null;
  return OnboardingJourneyRecord(journey.cast<String, Object?>());
}

/// `new URL(backend).host` (port only when not the scheme default).
String _host(String backend) {
  final uri = Uri.parse(backend);
  final defaultPort = uri.scheme == 'https' ? 443 : uri.scheme == 'http' ? 80 : 0;
  return uri.hasPort && uri.port != defaultPort ? '${uri.host}:${uri.port}' : uri.host;
}

String onboardingDraftKey(String actor, String backend) => '$onboardingSchema:${_host(backend)}:$actor';

/// localStorage surface for drafts (the app passes the LocalStore; tests pass a failing one).
abstract interface class DraftStorage {
  String? getItem(String key);

  /// May throw (React's quota-managed write); the journey shows `storage_failed`.
  void setItem(String key, String value);
  void removeItem(String key);
}

class MemoryDraftStorage implements DraftStorage {
  final Map<String, String> values = {};
  @override
  String? getItem(String key) => values[key];
  @override
  void setItem(String key, String value) => values[key] = value;
  @override
  void removeItem(String key) => values.remove(key);
}

final RegExp _uuid = RegExp(r'^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$', caseSensitive: false);

OnboardingDraft? readOnboardingDraft(String actor, String backend, DraftStorage storage) {
  try {
    final raw = storage.getItem(onboardingDraftKey(actor, backend));
    if (raw == null || raw.isEmpty || raw.length > 32768) return null;
    final v = jsonDecode(raw);
    if (v is! Map) return null;
    final stage = v['stage'];
    final children = v['children'];
    final answers = v['answers'];
    bool isInt(Object? x) => x is int || (x is double && x == x.roundToDouble() && x.isFinite);
    if (v['schema'] != onboardingSchema ||
        v['actor'] != actor ||
        v['backend'] != backend ||
        v['id'] is! String ||
        !_uuid.hasMatch(v['id'] as String) ||
        !(stage == null || isOnboardingStage(stage)) ||
        v['name'] is! String ||
        children is! List ||
        children.length > 4 ||
        !children.every((c) =>
            c is Map &&
            c['id'] is String &&
            _uuid.hasMatch(c['id'] as String) &&
            c['name'] is String &&
            c['birthDate'] is String &&
            const ['', 'boy', 'girl'].contains(c['gender']) &&
            const ['', 'term', 'preterm'].contains(c['term']) &&
            isInt(c['gestationalWeeks'])) ||
        answers is! Map ||
        !const ['lmp', 'due'].contains(v['dateMode']) ||
        v['pregnancyDate'] is! String ||
        v['lastPeriodDate'] is! String ||
        !isInt(v['cycleLength']) ||
        !isInt(v['periodLength']) ||
        !isInt(v['babyCount']) ||
        !const ['granted', 'denied', 'skipped'].contains(v['notifications']) ||
        !const ['yearly', 'monthly'].contains(v['plan']) ||
        !const ['', 'natural', 'cesarean', 'assisted'].contains(v['deliveryType']) ||
        !['setupComplete', 'saveStarted', 'offerSeen', 'purchasePending'].every((k) => v[k] is bool) ||
        ![...onboardingSteps(stage as String?, true), 'offer', 'free', 'success'].contains(v['step'])) {
      return null;
    }
    return OnboardingDraft(
      schema: onboardingSchema,
      actor: actor,
      backend: backend,
      id: v['id'] as String,
      step: v['step'] as String,
      stage: stage,
      name: v['name'] as String,
      dateMode: v['dateMode'] as String,
      pregnancyDate: v['pregnancyDate'] as String,
      lastPeriodDate: v['lastPeriodDate'] as String,
      cycleLength: (v['cycleLength'] as num).toInt(),
      periodLength: (v['periodLength'] as num).toInt(),
      babyCount: (v['babyCount'] as num).toInt(),
      children: [
        for (final c in children.cast<Map>())
          OnboardingChild(
            id: c['id'] as String,
            name: c['name'] as String,
            gender: c['gender'] as String,
            birthDate: c['birthDate'] as String,
            term: c['term'] as String,
            gestationalWeeks: (c['gestationalWeeks'] as num).toInt(),
          ),
      ],
      deliveryType: v['deliveryType'] as String,
      answers: {
        for (final e in answers.entries)
          if (e.value is String) '${e.key}': e.value as String else if (e.value is List) '${e.key}': List<String>.from((e.value as List).whereType<String>()),
      },
      notifications: v['notifications'] as String,
      setupComplete: v['setupComplete'] as bool,
      saveStarted: v['saveStarted'] as bool,
      offerSeen: v['offerSeen'] as bool,
      purchasePending: v['purchasePending'] as bool,
      plan: v['plan'] as String,
      outcome: v['outcome'] as String?,
    );
  } catch (_) {
    return null;
  }
}

/// Throws when the storage refuses the write (never swallowed silently).
void writeOnboardingDraft(OnboardingDraft draft, DraftStorage storage) =>
    storage.setItem(onboardingDraftKey(draft.actor, draft.backend), jsonEncode(draft.toJson()));

/// `hasPendingOnboarding(actor, backend, answers)` (feeds the onboarding gate).
bool hasPendingOnboarding(String actor, String backend, Object? answers, DraftStorage storage) {
  final journey = journeyRecord(answers);
  if (journey?.completedAt != null) return false;
  return journey != null || readOnboardingDraft(actor, backend, storage) != null;
}
