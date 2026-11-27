// Ported from: tools/reference-shots/fixtures/bump-week24 (persona Leyla, week 24 day 2, appointments) and the
// content the reference shots show (trimester tips, daily cards) — fixture data for widget tests and goldens.
import 'package:anacan/domain/dates/local_date.dart';

import 'home_test_support.dart';

/// Frozen "now": 20 Nov 2026 10:00 (pregnancy day 171 = week 24, day 2).
final DateTime fixtureNow = DateTime(2026, 11, 20, 10);
final DateTime fixtureLmp = DateTime(2026, 6, 3);
String get fixtureToday => localDateKey(fixtureNow);

void seedBumpFixtures(FakeHomeRepository r) {
  r.trimesterTipRows = [
    {'id': 't1', 'trimester': 2, 'icon': '💧', 'tip_text': 'Gündə ən azı 2 litr su için', 'sort_order': 1},
    {'id': 't2', 'trimester': 2, 'icon': '🥦', 'tip_text': 'Fol turşusu və dəmirlə zəngin qidalanın', 'sort_order': 2},
    {'id': 't3', 'trimester': 2, 'icon': '🚶‍♀️', 'tip_text': 'Hər gün 30 dəqiqə yüngül gəzinti edin', 'sort_order': 3},
    {'id': 't4', 'trimester': 2, 'icon': '😴', 'tip_text': 'Sol böyrü üstə yatın', 'sort_order': 4},
  ];
  r.pregnancyContent = {
    171: {
      'id': 'c171',
      'pregnancy_day': 171,
      'week_number': 25,
      'baby_size_fruit': 'qarğıdalı',
      'baby_size_cm': 30,
      'baby_weight_gram': 830,
      'body_changes': 'Bel ağrısı və ayaqlarda yüngül şişkinlik ola bilər.',
      'baby_development': 'Körpənin eşitmə qabiliyyəti inkişaf edir: o, sizin səsinizi və ürək döyüntülərinizi eşidir.',
      'daily_tip': 'Ayaqlarınızı qaldırıb dincəlin.',
    },
  };
  r.appointmentRows = [
    {
      'id': 'a1',
      'user_id': 'u1',
      'title': 'Həkim müayinəsi',
      'event_date': '2026-11-23',
      'event_time': '10:30:00',
      'event_type': 'appointment',
      'reminder_enabled': true,
      'created_at': '2026-11-01T00:00:00Z',
    },
    {
      'id': 'a2',
      'user_id': 'u1',
      'title': 'Qlükoza testi (OGTT)',
      'event_date': '2026-11-30',
      'event_time': '09:00:00',
      'event_type': 'test',
      'reminder_enabled': true,
      'created_at': '2026-11-01T00:00:00Z',
    },
    {
      'id': 'a3',
      'user_id': 'u1',
      'title': 'USM — 28 həftə',
      'event_date': '2026-12-17',
      'event_time': '11:15:00',
      'event_type': 'ultrasound',
      'reminder_enabled': true,
      'created_at': '2026-11-01T00:00:00Z',
    },
  ];
  r.weeklyTipRows = [
    {
      'id': 'w24',
      'week_number': 24,
      'life_stage': 'bump',
      'title': 'Qlükoza testinə hazırlıq',
      'content': 'Bu həftələrdə qlükoza testi təyin olunur. Həkiminizlə vaxtı razılaşdırın.',
    },
  ];
  r.blogRows = [
    for (var i = 1; i <= 3; i++)
      {
        'id': 'b$i',
        'slug': 'post-$i',
        'title': 'Hamiləlikdə yuxu: $i rahat poza',
        'excerpt': 'Sol böyrü üstə yatmaq qan dövranını yaxşılaşdırır.',
        'cover_image_url': null,
        'reading_time': 4,
        'life_stage': 'bump',
      },
  ];
}
