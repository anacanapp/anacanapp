// Ported from: src/lib/vitaminZones.test.ts (slices; the zone offsets the Node job reads from Intl are given as
// fixed offsets here — Dart has no IANA zone database) + the VitaminTracker / useVitaminSchedules helpers.

import 'package:anacan/domain/vitamins/vitamins.dart';
import 'package:flutter_test/flutter_test.dart';

List<Map<String, Object?>> slices(String iso, [ZoneOffsetAt offset = bakuOffset]) =>
    [for (final s in vitaminSlicesForZone(DateTime.parse(iso), offset)) s.toJson()];
int berlinSummer(DateTime _) => 120;
int berlinWinter(DateTime _) => 60;
int kathmandu(DateTime _) => 345;
int newYorkWinter(DateTime _) => -300;

void main() {
  group('vitamin reminder slices per time zone', () {
    test('matches the existing Baku window (UTC+4, 3-7 minutes ahead)', () {
      expect(defaultVitaminTimeZone, 'Asia/Baku');
      expect(slices('2026-10-27T10:55:00Z'), [{'from': '14:58:00', 'to': '15:03:00', 'date': '2026-10-27', 'dow': 2}]);
      expect(slices('2026-10-27T10:55:20Z'), slices('2026-10-27T10:55:00Z'));
    });
    test('splits at local midnight with each part on its own local date', () {
      expect(slices('2026-10-27T19:55:00Z'), [
        {'from': '23:58:00', 'to': '24:00:00', 'date': '2026-10-27', 'dow': 2},
        {'from': '00:00:00', 'to': '00:03:00', 'date': '2026-10-28', 'dow': 3},
      ]);
    });
    test('uses the user zone, including daylight saving time and quarter-hour offsets', () {
      expect(slices('2026-07-01T10:55:00Z', berlinSummer).first['from'], '12:58:00');
      expect(slices('2026-10-27T10:55:00Z', berlinWinter).first['from'], '11:58:00');
      final k = slices('2026-10-27T10:55:00Z', kathmandu).first;
      expect([k['from'], k['to']], ['16:43:00', '16:48:00']);
    });
    test('takes the "today" day in the user zone (taken-today check)', () {
      expect(slices('2026-11-08T03:55:00Z', newYorkWinter), [{'from': '22:58:00', 'to': '23:03:00', 'date': '2026-11-07', 'dow': 6}]);
      expect(slices('2026-11-08T03:55:00Z').first['date'], '2026-11-08');
    });
  });

  group('vitamin tracker helpers', () {
    const s = [
      VitaminSchedule(id: 'a', userId: 'u', vitaminName: 'D', iconEmoji: '☀️', scheduledTime: '08:00:00', daysOfWeek: [1], isActive: true, notificationEnabled: true),
      VitaminSchedule(id: 'b', userId: 'u', vitaminName: 'Fe', iconEmoji: '🔴', scheduledTime: '20:30:00', daysOfWeek: [1], isActive: true, notificationEnabled: false),
      VitaminSchedule(id: 'c', userId: 'u', vitaminName: 'x', iconEmoji: '', scheduledTime: '10:00:00', daysOfWeek: [], isActive: false, notificationEnabled: false),
    ];
    const logs = [VitaminIntakeLog(id: 'l', userId: 'u', scheduleId: 'a', vitaminName: 'D', takenAt: '', logDate: '2026-11-27')];
    test('progress counts active schedules taken today', () {
      expect(vitaminProgress(s, logs), (taken: 1, total: 2, progress: 50.0));
      expect(vitaminProgress(const [], logs).progress, 0);
      expect(isVitaminTakenToday(logs, 'b'), false);
      expect(intakeLogFor(logs, 'a')?.id, 'l');
    });
    test('day toggles, time display and JSON field names', () {
      expect(toggleVitaminDay([0, 1, 2], 1), [0, 2]);
      expect(toggleVitaminDay([3, 0], 1), [0, 1, 3]);
      expect(formatVitaminTime('08:05:00'), '08:05');
      expect(VitaminSchedule.fromJson(s[0].toJson()).toJson(), s[0].toJson());
      expect(s[0].toJson().keys, contains('days_of_week'));
    });
  });
}
