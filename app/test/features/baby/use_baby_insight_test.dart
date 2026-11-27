// Ported from: src/hooks/useBabyInsight.test.tsx
import 'dart:async';

import 'package:anacan/features/baby/data/baby_repository.dart';
import 'package:anacan/features/baby/hooks/use_baby_insight.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import '../home_mommy/support/mommy_harness.dart';

const stats = BabyInsightStats(
  sleepMinutes: 400, sleepCount: 3, feedingCount: 7, breastCount: 4, formulaCount: 2, formulaMl: 160,
  solidCount: 1, diaperCount: 6, wetCount: 4, dirtyCount: 1, mixedCount: 1,
);
const child = BabyInsightChild(id: 'child-a', ageMonths: 7, ageDays: 220, gender: 'girl');

FunctionResult success(String section) =>
    FunctionResult(data: {'success': true, 'insight': {section: {'status': 'normal', 'note': '$section result'}}}, status: 200);

Future<void> flush() => Future<void>.delayed(Duration.zero);

void main() {
  late FakeBabyRepository repo;
  late LocalStore store;
  late List<Map<String, Object?>> bodies;
  late int consumed;
  late num remaining;
  var actor = 'user-a', language = 'en', backend = 'https://api.anacan.az';

  BabyInsightController make() => BabyInsightController(
        store: store,
        repository: repo,
        peekRemainingDaily: (_) async {
          consumed++;
          return (remaining: remaining, limit: 2);
        },
      );
  BabyInsightScope scope() => BabyInsightScope(backend: backend, userId: actor, language: language);

  setUp(() {
    repo = FakeBabyRepository();
    store = LocalStore.memory();
    bodies = [];
    consumed = 0;
    remaining = 2;
    actor = 'user-a';
    language = 'en';
    backend = 'https://api.anacan.az';
    repo.insight = (body) {
      bodies.add(body);
      return Future.value(success(body['section'] as String));
    };
  });

  test('does not run automatically and sends only the section explicitly requested', () async {
    final c = make()..update(stats, child, scope());
    expect(bodies, isEmpty);
    expect(consumed, 0);
    await c.request('sleep');
    expect(c.section('sleep').insight?.note, 'sleep result');
    expect(bodies, hasLength(1));
    final s = bodies[0]['stats'] as Map;
    expect(s.keys, ['sleepMinutes', 'sleepCount', 'localHour']);
    expect((s['sleepMinutes'], s['sleepCount']), (400, 3));
    expect(c.section('feeding').insight, isNull);
    expect(c.section('diaper').insight, isNull);
    await c.request('feeding');
    expect(c.section('feeding').insight?.note, 'feeding result');
    expect((bodies[1]['stats'] as Map).containsKey('sleepMinutes'), isFalse);
    expect((bodies[1]['stats'] as Map).containsKey('diaperCount'), isFalse);
    expect(c.section('sleep').insight?.note, 'sleep result');
    expect(consumed, 2);
  });

  test('deduplicates repeated taps but allows independent sections to load concurrently', () async {
    final resolvers = <String, Completer<FunctionResult>>{};
    repo.insight = (body) {
      bodies.add(body);
      return (resolvers[body['section'] as String] = Completer()).future;
    };
    final c = make()..update(stats, child, scope());
    unawaited(c.request('sleep'));
    unawaited(c.request('sleep'));
    unawaited(c.request('diaper'));
    await flush();
    await flush();
    expect(bodies, hasLength(2));
    expect(c.section('sleep').loading, isTrue);
    expect(c.section('diaper').loading, isTrue);
    expect(c.section('feeding').loading, isFalse);
    resolvers['sleep']!.complete(success('sleep'));
    await flush();
    expect(c.section('sleep').loading, isFalse);
    expect(c.section('diaper').loading, isTrue);
    resolvers['diaper']!.complete(success('diaper'));
    await flush();
  });

  test('changing feeding does not stale a sleep analysis, and a failed retry never fabricates a result', () async {
    final c = make()..update(stats, child, scope());
    await c.request('sleep');
    expect(c.section('sleep').insight, isNotNull);
    c.update(stats.copyWith(feedingCount: 8), child, scope());
    expect(c.section('sleep').stale, isFalse);
    c.update(stats.copyWith(sleepMinutes: 450), child, scope());
    expect(c.section('sleep').stale, isTrue);
    repo.insight = (_) async => const FunctionResult(error: 'x', status: 500);
    await c.request('diaper');
    expect(c.section('diaper').error, isTrue);
    expect(c.section('diaper').insight, isNull);
    expect(c.section('sleep').insight?.note, 'sleep result');
  });

  for (final boundary in ['child', 'actor', 'language', 'backend']) {
    test('drops delayed results across a $boundary boundary', () async {
      final finish = Completer<FunctionResult>();
      repo.insight = (body) {
        bodies.add(body);
        return finish.future;
      };
      final c = make()..update(stats, child, scope());
      unawaited(c.request('sleep'));
      await flush();
      await flush();
      expect(bodies, hasLength(1));
      if (boundary == 'actor') actor = 'user-b';
      if (boundary == 'language') language = 'ja';
      if (boundary == 'backend') backend = 'https://source.example';
      c.update(stats, boundary == 'child' ? const BabyInsightChild(id: 'child-b', ageMonths: 7, ageDays: 220, gender: 'girl') : child, scope());
      finish.complete(success('sleep'));
      await flush();
      await flush();
      expect(c.section('sleep').insight, isNull);
      expect(c.section('sleep').loading, isFalse);
      expect(store.keys, isEmpty);
    });
  }

  test('stops at the usage limit before invoking a model', () async {
    remaining = 0;
    final c = make()..update(stats, child, scope());
    await c.request('feeding');
    expect(c.section('feeding').limitReached, isTrue);
    expect(bodies, isEmpty);
    expect(c.section('feeding').insight, isNull);
    expect(c.section('sleep').limitReached, isFalse);
  });

  test('shows a server-side allowance rejection on only the requested section', () async {
    repo.insight = (_) async => const FunctionResult(error: 'limit', status: 429);
    final c = make()..update(stats, child, scope());
    await c.request('diaper');
    expect(c.section('diaper').limitReached, isTrue);
    expect(c.section('diaper').error, isFalse);
    expect(c.section('feeding').limitReached, isFalse);
  });

  test('restores a cached result of the same scope after a restart', () async {
    final c = make()..update(stats, child, scope());
    await c.request('sleep');
    final again = make()..update(stats, child, scope());
    expect(again.section('sleep').insight?.note, 'sleep result');
    expect(again.section('sleep').stale, isFalse);
  });
}
