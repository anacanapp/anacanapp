// Ported from: src/lib/onboarding-persistence.test.ts
import 'dart:convert';

import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/onboarding/onboarding_model.dart';
import 'package:anacan/features/onboarding/onboarding_persistence.dart';
import 'package:flutter_test/flutter_test.dart';

const actor = '11111111-1111-4111-8111-111111111111', backend = 'https://api.anacan.az';

Map<String, Object?> clone(Map<String, Object?> v) => (jsonDecode(jsonEncode(v)) as Map).cast<String, Object?>();

/// In-memory profiles / user_children / user_preferences with the persistence's query shapes.
class FakeDb implements OnboardingDataPort {
  final Map<String, List<Map<String, Object?>>> tables = {
    'profiles': [
      {'user_id': actor, 'life_stage': null, 'name': 'Aysel', 'country_code': 'AZ', 'avatar_url': 'preserved', 'onboarding_answers': {'retained': 'yes'}},
    ],
    'user_children': [],
    'user_preferences': [],
  };
  final List<({String table, Map<String, Object?> body})> writes = [];
  String account = actor, realmUrl = backend;

  /// (table, body, after) → fail the write before (false) or lose its response after (true).
  bool Function(String table, Map<String, Object?> body, bool after)? fail;

  DbOutcome _write(String table, Map<String, Object?> body, List<Map<String, Object?>> Function() apply) {
    if (fail?.call(table, body, false) ?? false) return const DbOutcome(error: {'code': 'TEST_FAILURE'});
    final rows = apply();
    writes.add((table: table, body: body));
    if (fail?.call(table, body, true) ?? false) return const DbOutcome(error: {'code': 'LOST_RESPONSE'});
    return DbOutcome(data: rows.isEmpty ? null : clone(rows.first));
  }

  Map<String, Object?>? _profile(String user) => tables['profiles']!.where((r) => r['user_id'] == user).firstOrNull;

  @override
  Future<String?> sessionUserId() async => account;
  @override
  String realm() => realmUrl;
  @override
  Future<DbOutcome> selectProfile(String a) async => DbOutcome(data: _profile(a) == null ? null : clone(_profile(a)!));
  @override
  Future<DbOutcome> selectChild(String a, String id) async {
    final row = tables['user_children']!.where((r) => r['user_id'] == a && r['id'] == id).firstOrNull;
    return DbOutcome(data: row == null ? null : clone(row));
  }

  @override
  Future<DbOutcome> updateChild(String a, String id, Map<String, Object?> values) async => _write('user_children', values, () {
        final rows = tables['user_children']!.where((r) => r['user_id'] == a && r['id'] == id).toList();
        for (final r in rows) {
          r.addAll(clone(values));
        }
        return rows;
      });
  @override
  Future<DbOutcome> insertChild(Map<String, Object?> values) async {
    if (tables['user_children']!.any((r) => r['id'] == values['id'])) return const DbOutcome(error: {'code': '23505'});
    return _write('user_children', values, () {
      final row = clone(values);
      tables['user_children']!.add(row);
      return [row];
    });
  }

  @override
  Future<DbOutcome> upsertPreferences(Map<String, Object?> values) async => _write('user_preferences', values, () {
        final found = tables['user_preferences']!.where((r) => r['user_id'] == values['user_id']).firstOrNull;
        if (found != null) {
          found.addAll(clone(values));
          return [found];
        }
        final row = clone(values);
        tables['user_preferences']!.add(row);
        return [row];
      });
  @override
  Future<DbOutcome> updateProfileIfUnconfigured(String a, Map<String, Object?> fields) async => _write('profiles', fields, () {
        final rows = tables['profiles']!.where((r) => r['user_id'] == a && r['life_stage'] == null).toList();
        for (final r in rows) {
          r.addAll(clone(fields));
        }
        return rows;
      });
  @override
  Future<DbOutcome> updateJourneyIfRevision(String a, Map<String, Object?> answers, String revision) async =>
      _write('profiles', {'onboarding_answers': answers}, () {
        final rows = tables['profiles']!.where((r) {
          final journey = (r['onboarding_answers'] as Map?)?['journey'] as Map?;
          return r['user_id'] == a && journey?['revision'] == revision;
        }).toList();
        for (final r in rows) {
          r['onboarding_answers'] = clone(answers);
        }
        return rows;
      });
  @override
  Future<DbOutcome> updateJourneyIfMissing(String a, Map<String, Object?> answers) async => _write('profiles', {'onboarding_answers': answers}, () {
        final rows = tables['profiles']!.where((r) => r['user_id'] == a && (r['onboarding_answers'] as Map?)?['journey'] == null).toList();
        for (final r in rows) {
          r['onboarding_answers'] = clone(answers);
        }
        return rows;
      });
}

OnboardingDraft fixture(String stage) {
  final draft = newOnboardingDraft(actor, backend, 'Aysel').copyWith(stage: stage, pregnancyDate: '2026-06-01', lastPeriodDate: '2026-09-01', saveStarted: true);
  return draft.copyWith(
    children: [draft.children[0].copyWith(name: 'Leyla', birthDate: '2026-08-01', gender: 'girl', term: 'preterm', gestationalWeeks: 34)],
    answers: {'budget': 'value', 'sleep': 'poor', 'supportLevel': 'some', 'duration': 'year', 'bumpSymptoms': ['nausea'], 'feeding': 'mixed', 'regularity': 'irregular'},
  );
}

Matcher throwsCode(String code) => throwsA(isA<OnboardingPersistenceError>().having((e) => e.message, 'message', code));

void main() {
  setUp(() => DomainClock.setSystemTime(DateTime.utc(2026, 9, 22, 12)));
  tearDown(DomainClock.reset);

  group('confirmed, resumable data writes', () {
    for (final stage in ['bump', 'mommy', 'flow']) {
      test('$stage writes all applicable values and preserves unrelated profile fields', () async {
        final db = FakeDb(), draft = fixture(stage);
        final result = await saveOnboardingSetup(draft, 'ka', db);
        expect(result['user_id'], actor);
        expect(result['life_stage'], stage);
        expect(result['country_code'], 'AZ');
        expect(result['avatar_url'], 'preserved');
        final answers = result['onboarding_answers'] as Map;
        expect([answers['retained'], answers['sleep'], answers['budget'], answers['notifications']], ['yes', 'poor', 'value', 'skipped']);
        final journey = answers['journey'] as Map;
        expect([journey['version'], journey['id'], journey['completedAt']], [3, draft.id, null]);
        expect(db.tables['user_preferences']!.first, {'user_id': actor, 'language': 'ka'});
        expect(db.writes.last.table, 'profiles');
        if (stage == 'mommy') {
          expect(db.tables['user_children'], hasLength(1));
          final child = db.tables['user_children']!.first;
          expect([child['id'], child['birth_date'], child['due_date'], child['gender']], [draft.children[0].id, '2026-08-01', '2026-09-12', 'girl']);
          expect([result['baby_name'], result['baby_count']], ['Leyla', 1]);
        } else if (stage == 'bump') {
          expect([result['last_period_date'], result['due_date']], ['2026-06-01', '2027-03-08']);
        } else {
          expect([result['last_period_date'], result['cycle_length'], result['period_length']], ['2026-09-01', 28, 5]);
        }
      });
    }

    test('never completes after a child error and retries with the same child IDs', () async {
      final db = FakeDb(), draft = fixture('mommy');
      var once = true;
      db.fail = (table, _, after) {
        if (table == 'user_children' && !after && once) {
          once = false;
          return true;
        }
        return false;
      };
      await expectLater(saveOnboardingSetup(draft, 'az', db), throwsCode('ONBOARDING_CHILD_SAVE_FAILED'));
      expect(db.tables['profiles']!.first['life_stage'], isNull);
      await saveOnboardingSetup(draft, 'az', db);
      expect(db.tables['user_children']!.map((c) => c['id']), [draft.children[0].id]);
    });

    test('recovers a lost profile commit response without duplicate children or date changes', () async {
      final db = FakeDb(), draft = fixture('mommy');
      var once = true;
      db.fail = (table, body, after) {
        if (table == 'profiles' && after && once && body.containsKey('life_stage')) {
          once = false;
          return true;
        }
        return false;
      };
      await expectLater(saveOnboardingSetup(draft, 'az', db), throwsCode('ONBOARDING_PROFILE_SAVE_FAILED'));
      final writes = db.writes.length;
      final saved = await saveOnboardingSetup(draft, 'az', db);
      expect(db.writes.length, writes, reason: 'the committed setup is acknowledged, not repeated');
      expect(db.tables['user_children'], hasLength(1));
      expect(saved['baby_birth_date'], '2026-08-01');
    });

    test('stops on preference failures, account changes or backend changes', () async {
      final db = FakeDb();
      db.fail = (table, _, after) => table == 'user_preferences' && !after;
      await expectLater(saveOnboardingSetup(fixture('flow'), 'az', db), throwsCode('ONBOARDING_PREFERENCES_SAVE_FAILED'));
      db.fail = null;
      db.account = 'someone-else';
      await expectLater(saveOnboardingSetup(fixture('flow'), 'az', db), throwsCode('ONBOARDING_ACCOUNT_CHANGED'));
      db.account = actor;
      db.realmUrl = 'https://source.example';
      await expectLater(saveOnboardingSetup(fixture('flow'), 'az', db), throwsCode('ONBOARDING_ACCOUNT_CHANGED'));
      expect(db.tables['profiles']!.first['life_stage'], isNull);
    });

    test('only explicit notification permission grants enable push preferences', () async {
      for (final (choice, expected) in [('granted', true), ('denied', false)]) {
        final db = FakeDb();
        await saveOnboardingSetup(fixture('flow').copyWith(notifications: choice), 'az', db);
        final prefs = db.tables['user_preferences']!.first;
        expect([prefs['notifications_enabled'], prefs['push_enabled'], prefs['daily_push_enabled']], [expected, expected, expected]);
      }
      final skipped = FakeDb();
      await saveOnboardingSetup(fixture('flow'), 'az', skipped);
      expect(skipped.tables['user_preferences']!.first.containsKey('push_enabled'), isFalse);
    });

    test('does not overwrite an established profile during a repeated setup', () async {
      final db = FakeDb();
      db.tables['profiles']!.first['life_stage'] = 'bump';
      await expectLater(saveOnboardingSetup(fixture('flow'), 'az', db), throwsCode('ONBOARDING_PROFILE_ALREADY_CONFIGURED'));
      expect(db.writes, isEmpty);
    });

    test('claims the offer once across concurrent clients and preserves answers on completion', () async {
      final db = FakeDb();
      await saveOnboardingSetup(fixture('bump'), 'az', db);
      final results = await Future.wait([claimOnboardingOffer(actor, backend, db), claimOnboardingOffer(actor, backend, db)]);
      expect(results.where((r) => r.changed), hasLength(1));
      final journey = (db.tables['profiles']!.first['onboarding_answers'] as Map)['journey'] as Map;
      expect(journey['offerKind'], 'monthly-coffee');
      expect(journey['offerSeenAt'], '2026-09-22T12:00:00.000Z');
      final done = await completeOnboarding(actor, backend, 'purchased', db, selectedPlan: 'monthly');
      final answers = done.profile['onboarding_answers'] as Map;
      expect(answers['sleep'], 'poor');
      expect((answers['journey'] as Map)['outcome'], 'purchased');
      expect((answers['journey'] as Map)['plan'], 'monthly');
      expect((await claimOnboardingOffer(actor, backend, db)).changed, isFalse, reason: 'a completed journey never shows the offer again');
    });
  });

  test('adopts only a locally pending legacy funnel, without rewriting profile fields', () async {
    final db = FakeDb();
    db.tables['profiles']!.first['life_stage'] = 'flow';
    final saved = await adoptLegacyOnboarding(actor, backend, db);
    final journey = (saved['onboarding_answers'] as Map)['journey'] as Map;
    expect([journey['version'], journey['plan'], journey['completedAt']], [3, 'yearly', null]);
    expect(saved['life_stage'], 'flow');
    expect((saved['onboarding_answers'] as Map)['retained'], 'yes');
  });
}
