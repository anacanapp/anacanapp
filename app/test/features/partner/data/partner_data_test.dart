// Ported from: src/hooks/usePartnerData.ts (normalizePartnerChildren, sharing mask, derived values, offline cache),
//              src/hooks/useDailySummary.ts, src/hooks/usePartnerStats.ts, src/hooks/useSurprises.ts
import 'dart:convert';

import 'package:anacan/core/offline/offline_cache.dart' show offlineCachePrefix;
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/partner/data/daily_summary.dart';
import 'package:anacan/features/partner/data/partner_backend.dart';
import 'package:anacan/features/partner/data/partner_cards_data.dart';
import 'package:anacan/features/partner/data/partner_data.dart';
import 'package:anacan/features/partner/data/partner_progress.dart';
import 'package:anacan/features/partner/data/partner_sharing.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../support.dart';

Map<String, dynamic> woman(Map<String, dynamic> extra) => {
      'id': kLinkedProfileId,
      'user_id': kPartnerUserId,
      'name': 'Leyla',
      'life_stage': 'bump',
      'last_period_date': '2026-06-01',
      'due_date': null,
      'cycle_length': 28,
      'period_length': 5,
      ...extra,
    };

void main() {
  tearDown(DomainClock.reset);

  group('normalizePartnerChildren', () {
    test('keeps rows with a string id and a calendar due date only', () {
      final kids = normalizePartnerChildren([
        {'id': 'c1', 'name': 'Aylin', 'birth_date': '2026-01-02', 'gender': 'girl', 'is_current': true, 'due_date': '2026-01-20T00:00:00Z'},
        {'id': 'c2', 'name': 'Murad', 'due_date': 'soon'},
        {'name': 'no id'},
        null,
        'x',
      ]);
      expect(kids.map((k) => k.id), ['c1', 'c2']);
      expect(kids[0].dueDate, '2026-01-20');
      expect(kids[0].isCurrent, isTrue);
      expect(kids[1].dueDate, isNull);
    });
  });

  group('usePartnerData', () {
    test('reads her profile, today\'s masked log and children; derived values follow her stage', () async {
      DomainClock.setSystemTime(DateTime(2026, 9, 7, 10));
      final backend = FakePartnerBackend()
        ..womanProfiles[kLinkedProfileId] = woman({})
        ..sharingOfOthers.add({'share_mood': false})
        ..rpcs['partner_daily_logs_v1'] = ((p) => [
              {'mood': 2, 'symptoms': ['nausea'], 'water_intake': 1200, 'log_date': p!['p_from']},
            ])
        ..rpcs['partner_children_v1'] = ((_) => [
              {'id': 'k1', 'name': 'Aylin', 'is_current': true},
            ]);
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(partnerDataProvider, (_, _) {});
      await settle();
      final d = sub.read();
      expect(d.loading, isFalse);
      expect(d.partnerProfile?.name, 'Leyla');
      expect(d.partnerChildren.single.name, 'Aylin');
      // Mood is not shared: masked.
      expect(d.partnerDailyLog?.mood, isNull);
      expect(d.partnerDailyLog?.symptoms, ['nausea']);
      expect(d.partnerDailyLog?.waterIntake, 1200);
      expect(d.getPregnancyWeek(), 14);
      expect(d.getDaysUntilDue(), 182);
      expect(d.getBabyAgeDays(), 0);
      expect(d.getCyclePhaseInfo(), isNull);
      expect((backend.calls.firstWhere((c) => c.op == 'rpc').payload! as Map)['p_from'], '2026-09-07');
    });

    test('flow: phase and next period need her shared cycle', () async {
      DomainClock.setSystemTime(DateTime(2026, 9, 10, 10));
      final backend = FakePartnerBackend()..womanProfiles[kLinkedProfileId] = woman({'life_stage': 'flow', 'last_period_date': '2026-09-01'});
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(partnerDataProvider, (_, _) {});
      await settle();
      expect(sub.read().getCyclePhaseInfo()?.dayInCycle, 10);
      expect(sub.read().getDaysUntilNextPeriod(), 19);
      backend.sharingOfOthers.add({'share_cycle': false});
      await c.read(partnerSharedSettingsProvider.notifier).fetchSharing();
      expect(sub.read().getCyclePhaseInfo(), isNull);
      expect(sub.read().getDaysUntilNextPeriod(), 0);
    });

    test('offline: the last profile from the cache, yesterday\'s log is not today\'s', () async {
      DomainClock.setSystemTime(DateTime(2026, 9, 7, 10));
      final now = DateTime.now().millisecondsSinceEpoch;
      final store = seededStore(user: {'userId': kUserId, 'role': 'partner'}, extra: {
        '${offlineCachePrefix}partner_profile': jsonEncode({'userId': kUserId, 'savedAt': now, 'data': woman({'name': 'Cached'})}),
        '${offlineCachePrefix}partner_dailylog': jsonEncode({'userId': kUserId, 'savedAt': now, 'data': {'mood': 4, 'log_date': '2026-09-06'}}),
      });
      final backend = FakePartnerBackend()..errors['select:profiles'] = const PostgrestException(message: 'offline');
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner', store: store));
      final sub = c.listen(partnerDataProvider, (_, _) {});
      await settle();
      expect(sub.read().partnerProfile?.name, 'Cached');
      expect(sub.read().partnerDailyLog, isNull);
      expect(sub.read().error, isNull);
    });

    test('offline without a cache: the error text', () async {
      final backend = FakePartnerBackend()..errors['select:profiles'] = const PostgrestException(message: 'offline');
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(partnerDataProvider, (_, _) {});
      await settle();
      expect(sub.read().error, 'Partner məlumatları yüklənə bilmədi');
      expect(sub.read().loading, isFalse);
    });

    test('not linked: done at once, nothing read', () async {
      final backend = FakePartnerBackend();
      final c = partnerContainer(partnerOverrides(backend: backend, linked: null));
      final sub = c.listen(partnerDataProvider, (_, _) {});
      await settle();
      expect(sub.read().loading, isFalse);
      expect(sub.read().partnerProfile, isNull);
      expect(backend.callsOf('womanProfile'), isEmpty);
    });
  });

  group('useDailySummary', () {
    test('mother: send builds today\'s summary and the partner message', () async {
      DomainClock.setSystemTime(DateTime(2026, 9, 7, 10));
      final backend = FakePartnerBackend()
        ..profileUserIds[kLinkedProfileId] = kPartnerUserId
        ..tables['daily_logs'] = [
          {'user_id': kUserId, 'log_date': '2026-09-07', 'mood': 4, 'water_intake': 1500, 'symptoms': ['back_pain']},
        ]
        ..tables['kick_sessions'] = [
          {'kick_count': 7},
          {'kick_count': 5},
        ]
        ..tables['contractions'] = [
          {'id': 'x'},
        ];
      final c = partnerContainer(partnerOverrides(backend: backend));
      c.listen(dailySummaryProvider, (_, _) {});
      await settle();
      final r = await c.read(dailySummaryProvider.notifier).generateAndSendSummary();
      expect(r.error, isNull);
      final row = backend.callsOf('upsertReturning', 'daily_summaries').single.payload! as Map;
      expect(row['mood'], 4);
      expect(row['water_intake'], 1500);
      expect(row['kick_count'], 12);
      expect(row['contraction_count'], 1);
      expect(row['is_sent'], isTrue);
      expect(row['partner_user_id'], kPartnerUserId);
      final msg = backend.callsOf('insert', 'partner_messages').single.payload! as Map;
      expect(msg['message_type'], 'daily_summary');
      expect((jsonDecode(msg['content'] as String) as Map)['body'], 'Əhval: 🙂 | Su: 1500ml | Təpiklər: 12');
    });

    testWidgets('a change of her sources updates the summary silently after 1.5 s', (tester) async {
      final backend = FakePartnerBackend()..profileUserIds[kLinkedProfileId] = kPartnerUserId;
      final c = partnerContainer(partnerOverrides(backend: backend));
      c.listen(dailySummaryProvider, (_, _) {});
      await tester.pump();
      const change = PartnerChange(eventType: 'INSERT');
      backend.emit('kick_sessions', 'user_id=eq.$kUserId', change);
      await tester.pump(const Duration(milliseconds: 1000));
      backend.emit('daily_logs', 'user_id=eq.$kUserId', change);
      await tester.pump(const Duration(milliseconds: 1499));
      expect(backend.callsOf('upsert', 'daily_summaries'), isEmpty);
      await tester.pump(const Duration(milliseconds: 2));
      await tester.pump();
      final row = backend.callsOf('upsert', 'daily_summaries').single.payload! as Map;
      expect(row['is_sent'], isFalse);
      expect(row['water_intake'], 0);
    });

    test('partner: reads the masked RPC and cannot send', () async {
      DomainClock.setSystemTime(DateTime(2026, 9, 7, 10));
      final backend = FakePartnerBackend()
        ..rpcs['partner_daily_summaries_v1'] = ((_) => [
              {'id': 's1', 'summary_date': '2026-09-07', 'is_sent': true, 'mood': 5},
            ]);
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(dailySummaryProvider, (_, _) {});
      await settle();
      expect(sub.read().todaySummary?.isSent, isTrue);
      expect((await c.read(dailySummaryProvider.notifier).generateAndSendSummary()).error, 'Only woman can send summary');
    });
  });

  group('usePartnerStats / useSurprises', () {
    test('stats count completed missions and sent messages', () async {
      final backend = FakePartnerBackend()
        ..tables['partner_missions'] = [
          {'user_id': kUserId, 'is_completed': true, 'points_earned': 30},
          {'user_id': kUserId, 'is_completed': true, 'points_earned': 30},
        ]
        ..sentCounts['love'] = 4
        ..sentCounts['text,image,audio'] = 9;
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(partnerStatsProvider, (_, _) {});
      await settle();
      final s = sub.read().stats;
      expect((s.totalPoints, s.completedMissions, s.level, s.lovesSent, s.messagesSent), (60, 2, 2, 4, 9));
    });

    test('surprises: planned / completed, points, chart and top category', () async {
      final backend = FakePartnerBackend()
        ..tables['partner_surprises'] = [
          {'id': '1', 'user_id': kUserId, 'status': 'planned', 'surprise_points': 10, 'surprise_category': 'care'},
          {'id': '2', 'user_id': kUserId, 'status': 'completed', 'surprise_points': 20, 'surprise_category': 'gift', 'completed_date': '2026-09-02T10:00:00Z'},
          {'id': '3', 'user_id': kUserId, 'status': 'completed', 'surprise_points': 15, 'surprise_category': 'gift', 'completed_date': '2026-08-02T10:00:00Z'},
        ];
      final c = partnerContainer(partnerOverrides(backend: backend, role: 'partner', lifeStage: 'partner'));
      final sub = c.listen(surprisesProvider, (_, _) {});
      await settle();
      final s = sub.read();
      expect(s.plannedSurprises, hasLength(1));
      expect(s.totalPoints, 35);
      expect(s.topCategory, (category: 'gift', count: 2));
      final chart = s.monthlyChartData(DateTime(2026, 9, 15));
      expect(chart.map((m) => m.month), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
      expect(chart.map((m) => m.points), [0, 0, 0, 0, 15, 20]);
      expect(await c.read(surprisesProvider.notifier).completeSurprise('1'), isTrue);
      expect(sub.read().totalPoints, 45);
    });
  });

  group('partner home card data', () {
    test('baby day totals', () {
      final agg = aggregateBabyDay([
        {'log_type': 'feeding', 'amount_ml': 120},
        {'log_type': 'feeding', 'amount_ml': null},
        {'log_type': 'sleep', 'start_time': '2026-09-07T08:00:00Z', 'end_time': '2026-09-07T09:30:00Z'},
        {'log_type': 'sleep', 'start_time': '2026-09-07T12:00:00Z', 'end_time': null},
        {'log_type': 'diaper'},
      ]);
      expect((agg.feeds, agg.totalMl, agg.sleepMin, agg.sleepOngoing, agg.diapers), (2, 120, 90.0, true, 1));
    });
  });
}
