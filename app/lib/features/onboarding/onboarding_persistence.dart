// Ported from: src/lib/onboarding-persistence.ts
//
// Existing CDC-enrolled relations only. Children and preferences are written before the profile's completion
// marker; stable child UUIDs make interrupted retries safe; no successful UI transition happens until every
// write is read back. Journey changes are compare-and-set on `onboarding_answers.journey.revision`.

import 'package:supabase_flutter/supabase_flutter.dart' show SupabaseClient;

import '../../core/content_packs/content_key.dart' show canonicalContent;
import '../../core/i18n/app_languages.dart' show isAppLanguage;
import '../../core/offline/offline_outbox.dart' show newClientId;
import '../../domain/js_compat.dart' show DomainClock;
import 'onboarding_model.dart';

class OnboardingPersistenceError implements Exception {
  const OnboardingPersistenceError(this.message);
  final String message;
  @override
  String toString() => message;
}

void _assert(bool condition, String code) {
  if (!condition) throw OnboardingPersistenceError(code);
}

/// `{ data, error }` of a supabase-js call.
class DbOutcome {
  const DbOutcome({this.data, this.error});
  final Object? data;
  final Object? error;
}

/// The supabase calls the persistence makes (one method per query shape), replaceable in tests.
abstract interface class OnboardingDataPort {
  /// `auth.getSession()` user id; null when there is no session; throws on error.
  Future<String?> sessionUserId();

  /// `getBackendConfig().url`.
  String realm();

  /// `profiles.select('*').eq('user_id', actor).single()`.
  Future<DbOutcome> selectProfile(String actor);

  /// `user_children.select('*').eq('user_id').eq('id').maybeSingle()`.
  Future<DbOutcome> selectChild(String actor, String id);
  Future<DbOutcome> updateChild(String actor, String id, Map<String, Object?> values);
  Future<DbOutcome> insertChild(Map<String, Object?> values);

  /// `user_preferences.upsert(values, { onConflict: 'user_id' }).select().single()`.
  Future<DbOutcome> upsertPreferences(Map<String, Object?> values);

  /// `profiles.update(fields).eq('user_id', actor).is('life_stage', null).select().maybeSingle()`.
  Future<DbOutcome> updateProfileIfUnconfigured(String actor, Map<String, Object?> fields);

  /// `profiles.update({onboarding_answers}).eq('user_id').eq('onboarding_answers->journey->>revision', revision)`.
  Future<DbOutcome> updateJourneyIfRevision(String actor, Map<String, Object?> answers, String revision);

  /// `profiles.update({onboarding_answers}).eq('user_id').is('onboarding_answers->journey', null)`.
  Future<DbOutcome> updateJourneyIfMissing(String actor, Map<String, Object?> answers);
}

class SupabaseOnboardingDataPort implements OnboardingDataPort {
  SupabaseOnboardingDataPort(this.client, this.backendUrl);
  final SupabaseClient client;
  final String Function() backendUrl;

  Future<DbOutcome> _run(Future<Object?> Function() call) async {
    try {
      return DbOutcome(data: await call());
    } catch (error) {
      return DbOutcome(error: error);
    }
  }

  @override
  Future<String?> sessionUserId() async => client.auth.currentSession?.user.id;
  @override
  String realm() => backendUrl();
  @override
  Future<DbOutcome> selectProfile(String actor) => _run(() => client.from('profiles').select().eq('user_id', actor).single());
  @override
  Future<DbOutcome> selectChild(String actor, String id) =>
      _run(() => client.from('user_children').select().eq('user_id', actor).eq('id', id).maybeSingle());
  @override
  Future<DbOutcome> updateChild(String actor, String id, Map<String, Object?> values) =>
      _run(() => client.from('user_children').update(values).eq('user_id', actor).eq('id', id).select().single());
  @override
  Future<DbOutcome> insertChild(Map<String, Object?> values) => _run(() => client.from('user_children').insert(values).select().single());
  @override
  Future<DbOutcome> upsertPreferences(Map<String, Object?> values) =>
      _run(() => client.from('user_preferences').upsert(values, onConflict: 'user_id').select().single());
  @override
  Future<DbOutcome> updateProfileIfUnconfigured(String actor, Map<String, Object?> fields) =>
      _run(() => client.from('profiles').update(fields).eq('user_id', actor).isFilter('life_stage', null).select().maybeSingle());
  @override
  Future<DbOutcome> updateJourneyIfRevision(String actor, Map<String, Object?> answers, String revision) => _run(() => client
      .from('profiles')
      .update({'onboarding_answers': answers})
      .eq('user_id', actor)
      .eq('onboarding_answers->journey->>revision', revision)
      .select()
      .maybeSingle());
  @override
  Future<DbOutcome> updateJourneyIfMissing(String actor, Map<String, Object?> answers) => _run(() => client
      .from('profiles')
      .update({'onboarding_answers': answers})
      .eq('user_id', actor)
      .isFilter('onboarding_answers->journey', null)
      .select()
      .maybeSingle());
}

Map<String, Object?> _object(Object? value) => value is Map ? value.cast<String, Object?>() : <String, Object?>{};

/// `new Date().toISOString()` (millisecond precision, `Z`).
String isoNow() {
  final t = DomainClock.now().toUtc();
  String p(int v, [int w = 2]) => v.toString().padLeft(w, '0');
  return '${p(t.year, 4)}-${p(t.month)}-${p(t.day)}T${p(t.hour)}:${p(t.minute)}:${p(t.second)}.${p(t.millisecond, 3)}Z';
}

Future<void> _checkActor(String actor, String backend, OnboardingDataPort port) async {
  String? id;
  try {
    id = await port.sessionUserId();
  } catch (_) {
    id = null;
  }
  _assert(id == actor && port.realm() == backend, 'ONBOARDING_ACCOUNT_CHANGED');
}

Future<Map<String, Object?>> _readProfile(String actor, String backend, OnboardingDataPort port) async {
  await _checkActor(actor, backend, port);
  final res = await port.selectProfile(actor);
  final data = res.data;
  _assert(res.error == null && data is Map && data['user_id'] == actor, 'ONBOARDING_PROFILE_READ_FAILED');
  await _checkActor(actor, backend, port);
  return (data as Map).cast<String, Object?>();
}

bool _sameValues(Object? row, Map<String, Object?> expected) => row is Map && expected.entries.every((e) => row[e.key] == e.value);

/// Saves the setup; [onProgress] gets 15 / children / 65 / 90 / 100. Returns the confirmed profile row.
Future<Map<String, Object?>> saveOnboardingSetup(
  OnboardingDraft draft,
  String language,
  OnboardingDataPort port, {
  void Function(int percent)? onProgress,
  String Function()? uuid,
}) async {
  final progress = onProgress ?? (_) {};
  final newId = uuid ?? newClientId;
  _assert(onboardingDataError(draft) == null, 'ONBOARDING_INVALID_DATA');
  _assert(isAppLanguage(language), 'ONBOARDING_INVALID_LANGUAGE');
  final actor = draft.actor, backend = draft.backend;
  final before = await _readProfile(actor, backend, port);
  final existingJourney = journeyRecord(before['onboarding_answers']);
  // A timed-out successful commit is acknowledged, not repeated; another journey's dates are never overwritten.
  if (existingJourney != null && existingJourney.id == draft.id && existingJourney.setupCompletedAt != null) return before;
  _assert(before['life_stage'] == null && existingJourney == null, 'ONBOARDING_PROFILE_ALREADY_CONFIGURED');
  progress(15);

  if (draft.stage == 'mommy') {
    for (var index = 0; index < draft.children.length; index++) {
      final child = draft.children[index];
      await _checkActor(actor, backend, port);
      final expected = <String, Object?>{
        'user_id': actor,
        'name': child.name.trim(),
        'birth_date': child.birthDate,
        'gender': child.gender,
        'due_date': childDueDate(child),
        'avatar_emoji': child.gender == 'girl' ? '👧' : '👦',
        'is_active': true,
        'sort_order': index,
      };
      final lookup = await port.selectChild(actor, child.id);
      _assert(lookup.error == null, 'ONBOARDING_CHILD_READ_FAILED');
      final write = lookup.data != null ? await port.updateChild(actor, child.id, expected) : await port.insertChild({'id': child.id, ...expected});
      _assert(write.error == null && write.data is Map && (write.data as Map)['id'] == child.id && _sameValues(write.data, expected),
          'ONBOARDING_CHILD_SAVE_FAILED');
      await _checkActor(actor, backend, port);
      progress(15 + ((index + 1) / draft.children.length * 35).round());
    }
  }

  await _checkActor(actor, backend, port);
  final granted = draft.notifications == 'granted';
  final preferences = <String, Object?>{
    'user_id': actor,
    'language': language,
    if (draft.notifications != 'skipped') ...{'notifications_enabled': granted, 'push_enabled': granted, 'daily_push_enabled': granted},
  };
  final savedPreferences = await port.upsertPreferences(preferences);
  _assert(savedPreferences.error == null && savedPreferences.data != null && _sameValues(savedPreferences.data, preferences),
      'ONBOARDING_PREFERENCES_SAVE_FAILED');
  progress(65);
  await _checkActor(actor, backend, port);

  final journey = <String, Object?>{
    'version': 3,
    'id': draft.id,
    'revision': newId(),
    'setupCompletedAt': isoNow(),
    'completedAt': null,
    'offerSeenAt': null,
    'outcome': null,
    'plan': recommendedOnboardingPlan(draft.answers),
  };
  final answers = <String, Object?>{
    ..._object(before['onboarding_answers']),
    ...validatedOnboardingAnswers(draft),
    'notifications': draft.notifications,
    'v': 3,
    'journey': journey,
    if (draft.stage == 'mommy')
      'children': [
        for (final child in draft.children)
          {'id': child.id, 'term': child.term.isEmpty ? null : child.term, 'gestational_weeks': child.term == 'preterm' ? child.gestationalWeeks : null},
      ],
  };
  var fields = <String, Object?>{'name': draft.name.trim(), 'life_stage': draft.stage, 'onboarding_answers': answers};
  if (draft.stage == 'bump') {
    final dates = pregnancyDates(pregnancyDate: draft.pregnancyDate, dateMode: draft.dateMode);
    fields = {
      ...fields,
      'last_period_date': dates.lastPeriod,
      'due_date': dates.due,
      'baby_count': draft.babyCount,
      'multiples_type': multiplesType(draft.babyCount),
    };
  } else if (draft.stage == 'mommy') {
    final first = draft.children.first;
    fields = {
      ...fields,
      'baby_name': first.name.trim(),
      'baby_birth_date': first.birthDate,
      'baby_gender': first.gender,
      'baby_count': draft.babyCount,
      'multiples_type': multiplesType(draft.babyCount),
      'delivery_type': draft.deliveryType.isEmpty ? null : draft.deliveryType,
    };
  } else {
    fields = {...fields, 'last_period_date': draft.lastPeriodDate, 'cycle_length': draft.cycleLength, 'period_length': draft.periodLength};
  }

  // The conditional update also refuses a parallel setup on another device.
  final result = await port.updateProfileIfUnconfigured(actor, fields);
  _assert(result.error == null, 'ONBOARDING_PROFILE_SAVE_FAILED');
  await _checkActor(actor, backend, port);
  final saved = result.data;
  _assert(
      saved is Map &&
          saved['user_id'] == actor &&
          journeyRecord(saved['onboarding_answers'])?.id == draft.id &&
          fields.entries.where((e) => e.key != 'onboarding_answers').every((e) => saved[e.key] == e.value),
      'ONBOARDING_PROFILE_SAVE_UNCONFIRMED');
  progress(90);
  final confirmed = await _readProfile(actor, backend, port);
  _assert(
      journeyRecord(confirmed['onboarding_answers'])?.revision == journey['revision'] &&
          canonicalContent(confirmed['onboarding_answers']) == canonicalContent(answers),
      'ONBOARDING_PROFILE_SAVE_UNCONFIRMED');
  progress(100);
  return confirmed;
}

class JourneyChange {
  const JourneyChange({required this.profile, required this.changed});
  final Map<String, Object?> profile;
  final bool changed;
}

Future<JourneyChange> _changeJourney(
  String actor,
  String backend,
  Map<String, Object?>? Function(OnboardingJourneyRecord record) update,
  OnboardingDataPort port,
  String Function() uuid,
) async {
  for (var attempt = 0; attempt < 3; attempt++) {
    final profile = await _readProfile(actor, backend, port);
    final record = journeyRecord(profile['onboarding_answers']);
    _assert(record != null && profile['life_stage'] != null && record.setupCompletedAt != null, 'ONBOARDING_SETUP_REQUIRED');
    final next = update(record!);
    if (next == null) return JourneyChange(profile: profile, changed: false);
    await _checkActor(actor, backend, port);
    final revision = uuid();
    final answers = <String, Object?>{..._object(profile['onboarding_answers']), 'journey': {...next, 'revision': revision}};
    final result = await port.updateJourneyIfRevision(actor, answers, record.revision);
    _assert(result.error == null, 'ONBOARDING_PROGRESS_SAVE_FAILED');
    await _checkActor(actor, backend, port);
    final saved = result.data;
    if (saved is Map) {
      _assert(journeyRecord(saved['onboarding_answers'])?.revision == revision, 'ONBOARDING_PROGRESS_SAVE_UNCONFIRMED');
      return JourneyChange(profile: saved.cast<String, Object?>(), changed: true);
    }
  }
  throw const OnboardingPersistenceError('ONBOARDING_PROGRESS_CHANGED');
}

/// Compare-and-set: concurrent clients cannot both present the one-time monthly offer. Presentation only,
/// never entitlement.
Future<JourneyChange> claimOnboardingOffer(String actor, String backend, OnboardingDataPort port, {String Function()? uuid}) =>
    _changeJourney(
      actor,
      backend,
      (record) => record.completedAt != null || record.offerSeenAt != null
          ? null
          : {...record.raw, 'offerSeenAt': isoNow(), 'offerKind': 'monthly-coffee'},
      port,
      uuid ?? newClientId,
    );

Future<JourneyChange> completeOnboarding(String actor, String backend, OnboardingOutcome outcome, OnboardingDataPort port,
        {String? selectedPlan, String Function()? uuid}) =>
    _changeJourney(
      actor,
      backend,
      (record) => record.completedAt != null
          ? null
          : {...record.raw, 'completedAt': isoNow(), 'outcome': outcome, 'plan': selectedPlan ?? record.plan},
      port,
      uuid ?? newClientId,
    );

/// Resume only the old, locally pending funnel; established accounts are not enrolled and no profile/medical
/// field is rewritten.
Future<Map<String, Object?>> adoptLegacyOnboarding(String actor, String backend, OnboardingDataPort port, {String Function()? uuid}) async {
  final id = uuid ?? newClientId;
  final profile = await _readProfile(actor, backend, port);
  if (journeyRecord(profile['onboarding_answers']) != null) return profile;
  _assert(const ['bump', 'mommy', 'flow'].contains(profile['life_stage']), 'ONBOARDING_SETUP_REQUIRED');
  final journey = {
    'version': 3,
    'id': id(),
    'revision': id(),
    'setupCompletedAt': isoNow(),
    'completedAt': null,
    'offerSeenAt': null,
    'outcome': null,
    'plan': 'yearly',
  };
  final result = await port.updateJourneyIfMissing(actor, {..._object(profile['onboarding_answers']), 'journey': journey});
  _assert(result.error == null, 'ONBOARDING_PROGRESS_SAVE_FAILED');
  return _readProfile(actor, backend, port);
}
