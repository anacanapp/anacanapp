// Ported from: (test support) — fixture data for the mommy home widget tests and goldens.
import 'package:anacan/domain/js_compat.dart';

import 'mommy_harness.dart';

/// Fixed "now": 2026-11-27 10:30 local.
final fixtureNow = DateTime(2026, 11, 27, 10, 30);

String iso(DateTime d) => jsToIsoString(d);

/// Fills [h] with two children (Aylin 6 months, Elif 2 months), today's logs and content rows.
void seedMommyFixture(MommyHarness h, {bool withDueDate = true}) {
  DomainClock.setSystemTime(fixtureNow);
  h.nowMs = fixtureNow.millisecondsSinceEpoch;
  h.repo.children = [
    childRow('c1', name: 'Aylin', birth: '2026-05-20', due: withDueDate ? '2026-05-20' : null, gender: 'girl'),
    childRow('c2', name: 'Elif', birth: '2026-09-25', due: '2026-09-25', gender: 'girl', sort: 1),
  ];
  final day = DateTime(2026, 11, 27);
  h.repo.logs.addAll([
    {'id': 'l1', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'sleep', 'start_time': iso(day.add(const Duration(hours: 1))), 'end_time': iso(day.add(const Duration(hours: 3, minutes: 20))), 'created_at': ''},
    {'id': 'l2', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'feeding', 'feed_type': 'breast_left', 'start_time': iso(day.add(const Duration(hours: 6))), 'end_time': iso(day.add(const Duration(hours: 6, minutes: 12))), 'created_at': ''},
    {'id': 'l3', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'feeding', 'feed_type': 'formula', 'notes': '90 ml', 'start_time': iso(day.add(const Duration(hours: 8))), 'created_at': ''},
    {'id': 'l4', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'diaper', 'diaper_type': 'wet', 'start_time': iso(day.add(const Duration(hours: 7))), 'created_at': ''},
    {'id': 'l5', 'user_id': 'u1', 'child_id': 'c1', 'log_type': 'diaper', 'diaper_type': 'mixed', 'start_time': iso(day.add(const Duration(hours: 9))), 'created_at': ''},
  ]);
  h.repo.dailyInfo = {
    192: {'id': 'd1', 'day_number': 192, 'info': 'Körpəniz artıq əşyaları bir əlindən digərinə ötürür.\nOyuncaqları müxtəlif fakturalarla təklif edin.', 'is_active': true},
    64: {'id': 'd2', 'day_number': 64, 'info': 'Körpə səslərə başını çevirir.', 'is_active': true},
  };
  h.repo.messages = {
    192: {'id': 'm1', 'day_number': 192, 'message': 'Özünüzə də vaxt ayırın — yorğun ana da yaxşı anadır.', 'is_active': true},
  };
  h.repo.crisis = [
    {'id': 'k1', 'week_start': 26, 'week_end': 29, 'title': 'Məsafələr', 'description': 'Körpə məsafəni anlamağa başlayır, sizdən ayrılmaq onu narahat edir.', 'symptoms': ['Yapışqanlıq', 'Yuxu pozulması', 'İştahsızlıq', 'Ağlama'], 'tips': ['Yaxın olun'], 'severity': 'intense', 'emoji': '📏', 'is_active': true},
    {'id': 'k2', 'week_start': 36, 'week_end': 40, 'title': 'Kateqoriyalar', 'description': '', 'symptoms': <String>[], 'tips': <String>[], 'severity': 'medium', 'emoji': '🧩', 'is_active': true},
    {'id': 'k3', 'week_start': 44, 'week_end': 48, 'title': 'Ardıcıllıq', 'description': '', 'symptoms': <String>[], 'tips': <String>[], 'severity': 'mild', 'emoji': '🔗', 'is_active': true},
  ];
  h.repo.tips = [
    {'id': 't1', 'age_group': 'older', 'emoji': '🧸', 'title': 'Qarın üstə oyun', 'content': 'Gündə bir neçə dəfə qarın üstə oynamaq boyun əzələlərini gücləndirir.'},
    {'id': 't2', 'age_group': 'older', 'emoji': '📚', 'title': 'Kitab oxuyun', 'content': 'Şəkilli kitablar söz ehtiyatını artırır.'},
    {'id': 't3', 'age_group': 'newborn', 'emoji': '🤱', 'title': 'Dəri təması', 'content': 'Dəri-dəriyə təmas körpəni sakitləşdirir.'},
  ];
  h.repo.milestoneDefs = [
    for (final (i, m) in [('smile', '😊', 'İlk təbəssüm'), ('head', '💪', 'Başını tutur'), ('roll', '🔄', 'Çevrilir'), ('sit', '🪑', 'Oturur'), ('crawl', '🐛', 'Sürünür'), ('stand', '🧍', 'Ayaq üstə')].indexed)
      {'id': 'md$i', 'milestone_key': m.$1, 'week_number': i * 4, 'emoji': m.$2, 'label': m.$3, 'description': null},
  ];
  h.repo.milestones = [
    {'id': 'ms1', 'user_id': 'u1', 'child_id': 'c1', 'milestone_id': 'smile', 'achieved_at': '2026-07-01T10:00:00Z'},
    {'id': 'ms2', 'user_id': 'u1', 'child_id': 'c1', 'milestone_id': 'head', 'achieved_at': '2026-08-01T10:00:00Z'},
  ];
  h.repo.teethRows = [for (var i = 0; i < 20; i++) {'id': 'tooth$i', 'sort_order': i}];
  h.repo.teethLogs = [
    {'id': 'tl1', 'child_id': 'c1', 'tooth_id': 'tooth0'},
  ];
  h.repo.growth = [
    {'id': 'g3', 'child_id': 'c1', 'weight_kg': 7.4, 'height_cm': 66, 'head_cm': 42.5, 'entry_date': '2026-11-20'},
    {'id': 'g2', 'child_id': 'c1', 'weight_kg': 6.9, 'height_cm': 64, 'head_cm': 41.8, 'entry_date': '2026-10-20'},
    {'id': 'g1', 'child_id': 'c1', 'weight_kg': 6.1, 'height_cm': 61.5, 'head_cm': 40.9, 'entry_date': '2026-09-20'},
  ];
}
