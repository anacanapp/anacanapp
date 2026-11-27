// Ported from: (no React test) — getWelcomeMessage, the request body and the suggested questions of
//              src/components/AIChatScreen.tsx; partnerContext of PartnerAIPremiumGate.tsx
import 'dart:convert';

import 'package:anacan/features/ai_chat/ai_chat_inputs.dart';
import 'package:anacan/features/ai_chat/ai_chat_logic.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';

const _profile = AiProfileInput(name: 'Leyla', dueDate: '2027-03-01', lastPeriodDate: '2026-05-25', cycleLength: 28, periodLength: 5);

void main() {
  setUp(installTestI18n);

  group('welcome message', () {
    test('per stage, with the week and fruit for a known pregnancy and the plural for multiples', () {
      expect(aiWelcomeMessage(name: 'Leyla', partner: false, lifeStage: 'flow', language: 'az', isMultiple: false),
          'Salam, Leyla. Mən Anacan.AI. Menstrual tsikl, simptomlar və ümumi sağlamlıq üzrə suallarınıza peşəkar cavab verməyə hazıram.');
      expect(aiWelcomeMessage(name: null, partner: false, lifeStage: 'bump', language: 'az', isMultiple: false, currentWeek: 23, fruit: 'Qarpız'),
          'Salam. Mən Anacan.AI. Hazırda hamiləliyin 23-ci həftəsindəsiniz; körpəniz təxminən Qarpız böyüklüyündədir. Hamiləlik dövrü ilə bağlı suallarınızı verə bilərsiniz.');
      expect(aiWelcomeMessage(name: 'A', partner: false, lifeStage: 'bump', language: 'az', isMultiple: true, currentWeek: 10, fruit: 'X'), contains('körpələriniz'));
      expect(aiWelcomeMessage(name: 'A', partner: false, lifeStage: 'bump', language: 'en', isMultiple: false, currentWeek: 10, fruit: 'lime'),
          "Hello, A. I'm Anacan.AI. You're currently in week 10 of pregnancy; your baby is about the size of a lime. You can ask any questions about your pregnancy.");
      expect(aiWelcomeMessage(name: 'A', partner: false, lifeStage: null, language: 'az', isMultiple: false), 'Salam, A. Mən Anacan.AI. Sizə necə kömək edə bilərəm?');
      expect(aiWelcomeMessage(name: 'Elvin', partner: true, lifeStage: 'bump', language: 'az', isMultiple: false), startsWith('Salam, Elvin! Mən Ata AI.'));
    });
  });

  group('suggested questions', () {
    test('the admin list wins; else partner keys or the stage fallback', () {
      expect(aiSuggestedQuestions(dynamicQuestions: const ['Q1'], partner: null, lifeStage: 'bump'), ['Q1']);
      expect(aiSuggestedQuestions(dynamicQuestions: const [], partner: const AiPartnerContext(lifeStage: 'mommy'), lifeStage: 'mommy'),
          ['Körpə ağlayır, nə edim?', 'Gecə qidalanmasında necə kömək edim?', 'Doğuşdan sonra onun əhvalını necə izləyim?']);
      expect(aiSuggestedQuestions(dynamicQuestions: const [], partner: null, lifeStage: 'mommy').first, 'Körpəmi necə düzgün əmizdirməliyəm?');
      expect(aiSuggestedQuestions(dynamicQuestions: const [], partner: null, lifeStage: 'flow').last, 'Fertil pəncərəm nə vaxtdır?');
    });
  });

  group('request body', () {
    test('woman: stage, week, language, profile and the day context; undefined keys are left out', () {
      final body = buildDrAnacanBody(
        conversation: const [{'role': 'user', 'content': 'Salam'}],
        lifeStage: 'bump',
        pregnancyWeek: 23,
        partner: null,
        language: 'az',
        profile: _profile,
        woman: const AiWomanContext(
          motherTodayLog: {'mood': 4, 'water_intake': 6, 'symptoms': ['nausea']},
          babyTodayLogs: [{'log_type': 'feeding', 'feed_type': 'breast_left', 'diaper_type': null, 'notes': null, 'start_time': '2026-11-27T08:00:00Z'}],
          weightEntries: [{'weight': 61.5}, {'weight': 60}],
          kickSessions: [{'kick_count': 10, 'duration_seconds': 600}],
        ),
      );
      expect(jsonEncode(body), jsonEncode({
        'messages': [{'role': 'user', 'content': 'Salam'}],
        'lifeStage': 'bump',
        'pregnancyWeek': 23,
        'isPartner': false,
        'stream': true,
        'language': 'az',
        'userProfile': {
          'name': 'Leyla',
          'dueDate': '2027-03-01',
          'lastPeriodDate': '2026-05-25',
          'cycleLength': 28,
          'selectedChildDetails': null,
          'recentMotherLog': {'mood': 4, 'waterIntake': 6, 'symptoms': ['nausea']},
          'recentBabyLogs': [
            {'type': 'feeding', 'feedType': 'breast_left', 'diaperType': null, 'notes': null, 'startTime': '2026-11-27T08:00:00Z'},
          ],
          'recentMotherMeals': [],
          'latestWeight': 61.5,
          'todayKickSessions': [{'kicks': 10, 'duration': 600}],
        },
      }));
    });

    test('flow adds the cycle phase and day; a photo adds base64 + mime; no stage defaults to bump', () {
      final flow = buildDrAnacanBody(
        conversation: const [],
        lifeStage: 'flow',
        pregnancyWeek: null,
        partner: null,
        language: '',
        profile: const AiProfileInput(lastPeriodDate: '2026-11-20', cycleLength: 28, periodLength: 5),
        imageBase64: 'AQID',
        now: DateTime(2026, 11, 27, 12),
      );
      expect(flow['cycleDay'], 8);
      expect(flow['cyclePhase'], isA<String>());
      expect(flow['imageBase64'], 'AQID');
      expect(flow['imageMime'], 'image/jpeg');
      expect(flow['language'], 'az');
      expect(flow.containsKey('pregnancyWeek'), isFalse);
      expect(buildDrAnacanBody(conversation: const [], lifeStage: null, pregnancyWeek: null, partner: null, language: 'en', profile: _profile)['lifeStage'], 'bump');
    });

    test('partner: the woman\'s stage, week and only the shared profile fields', () {
      final body = buildDrAnacanBody(
        conversation: const [],
        lifeStage: 'bump',
        pregnancyWeek: 99,
        partner: const AiPartnerContext(lifeStage: 'bump', pregnancyWeek: 20, womanName: 'Aysel', dueDate: '2027-04-01'),
        language: 'az',
        profile: const AiProfileInput(name: 'Elvin', cycleLength: 28, periodLength: 5),
      );
      expect(body['pregnancyWeek'], 20);
      expect(body['isPartner'], true);
      expect(body['userProfile'], {'name': 'Elvin', 'partnerName': 'Aysel', 'dueDate': '2027-04-01'});
    });

    test('partner context: unshared cycle dates are dropped, unknown stages talk about bump', () {
      final flow = partnerContextFrom(const AiPartnerSource(lifeStage: 'flow', lastPeriodDate: '2026-10-01', shareCycle: false, name: 'A'));
      expect(flow.lifeStage, 'flow');
      expect(flow.lastPeriodDate, isNull);
      expect(partnerContextFrom(const AiPartnerSource(lifeStage: 'flow', lastPeriodDate: '2026-10-01', shareCycle: true)).lastPeriodDate, '2026-10-01');
      final bump = partnerContextFrom(const AiPartnerSource(lifeStage: 'bump', pregnancyWeek: 12));
      expect(bump.pregnancyWeek, 12);
      expect(partnerContextFrom(const AiPartnerSource()).lifeStage, 'bump');
      expect(partnerContextFrom(const AiPartnerSource(lifeStage: 'bump')).pregnancyWeek, isNull);
    });
  });
}
