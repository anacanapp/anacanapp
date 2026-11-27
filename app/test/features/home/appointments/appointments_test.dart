// Ported from: src/components/home/AppointmentSheet.test.tsx, src/components/home/UpcomingAppointments.test.tsx
import 'package:anacan/design/design.dart';
import 'package:anacan/domain/dates/local_date.dart';
import 'package:anacan/features/home/appointments/appointment_sheet.dart';
import 'package:anacan/features/home/appointments/upcoming_appointments.dart';
import 'package:anacan/features/home/data/appointments.dart';
import 'package:anacan/core/i18n/i18n.dart' show ensureDateLocales;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../home_test_support.dart';

class FakeAppointmentsApi implements AppointmentsApi {
  final List<(String, Object?)> calls = [];

  Appointment _row(Map<String, Object?> input, String id) => Appointment.fromRow({
    'id': id,
    'user_id': 'u',
    'title': 'USM',
    'description': null,
    'event_date': '2099-03-04',
    'event_time': '09:30:00',
    'event_type': 'ultrasound',
    'reminder_enabled': true,
    'created_at': '2026-01-01T00:00:00Z',
    ...input,
  });

  @override
  Future<Appointment?> add(AppointmentFields input, {AToastController? toast}) async {
    calls.add(('add', input));
    return _row(input, 'new');
  }

  @override
  Future<Appointment?> update(String id, AppointmentFields updates, {AToastController? toast}) async {
    calls.add(('update', (id, updates)));
    return _row(updates, id);
  }

  @override
  Future<bool> delete(String id, {AToastController? toast}) async {
    calls.add(('delete', id));
    return true;
  }
}

Appointment row([Map<String, Object?> over = const {}]) => Appointment.fromRow({
  'id': 'a1',
  'user_id': 'u',
  'title': 'USM',
  'description': null,
  'event_date': '2099-03-04',
  'event_time': '09:30:00',
  'event_type': 'ultrasound',
  'reminder_enabled': true,
  'created_at': '2026-01-01T00:00:00Z',
  ...over,
});

void main() {
  late HomeTestEnv env;
  late FakeAppointmentsApi api;

  setUpAll(() async {
    await ensureDateLocales();
  });

  setUp(() async {
    await installRealI18n(active: 'en', languages: const ['az', 'en']);
    api = FakeAppointmentsApi();
    env = HomeTestEnv(extra: [appointmentsApiProvider.overrideWithValue(api)]);
  });
  tearDown(() => env.dispose());

  group('AppointmentSheet', () {
    testWidgets('requires a title, then saves every field for a new appointment', (tester) async {
      phoneSurface(tester);
      var closed = 0;
      final key = GlobalKey<AppointmentSheetState>();
      await tester.pumpWidget(env.wrap(AppointmentSheet(key: key, onClose: () => closed++, defaultDate: DateTime(2099, 1, 15)), scroll: false));
      await tester.pump();
      await tester.tap(find.text('Save'));
      await tester.pump();
      expect(find.byKey(const ValueKey('appt-error')), findsOneWidget);
      expect(find.text('Add a title'), findsOneWidget);
      expect(api.calls, isEmpty);

      await tester.enterText(find.byKey(const ValueKey('appt-title')), '  Doctor visit  ');
      await tester.tap(find.byKey(const ValueKey('appt-type-test')));
      key.currentState!.setTime('14:15');
      await tester.enterText(find.byKey(const ValueKey('appt-note')), 'Room 4');
      await tester.pump();
      expect(tester.widget<Text>(find.byKey(const ValueKey('appt-remind-hint'))).data, contains('2 hours before'));
      await tester.tap(find.text('Save'));
      await tester.pump();

      expect(closed, 1);
      expect(api.calls.single.$1, 'add');
      expect(api.calls.single.$2, {
        'title': 'Doctor visit',
        'event_type': 'test',
        'event_date': '2099-01-15',
        'event_time': '14:15',
        'description': 'Room 4',
        'reminder_enabled': true,
      });
    });

    testWidgets('edits an existing appointment and can switch the reminder off', (tester) async {
      phoneSurface(tester);
      final key = GlobalKey<AppointmentSheetState>();
      await tester.pumpWidget(env.wrap(AppointmentSheet(key: key, onClose: () {}, appointment: row()), scroll: false));
      await tester.pump();
      expect(find.text('Edit appointment'), findsOneWidget);
      expect(find.text('09:30'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('appt-remind')));
      key.currentState!.setTime('');
      await tester.pump();
      await tester.tap(find.text('Save'));
      await tester.pump();
      final (id, fields) = api.calls.single.$2! as (String, Map<String, Object?>);
      expect(id, 'a1');
      expect(fields['event_time'], isNull);
      expect(fields['reminder_enabled'], isFalse);
      expect(fields['event_type'], 'ultrasound');
      expect(fields['description'], isNull);
    });

    testWidgets('asks for a second tap before deleting', (tester) async {
      phoneSurface(tester);
      var closed = 0;
      await tester.pumpWidget(env.wrap(AppointmentSheet(onClose: () => closed++, appointment: row()), scroll: false));
      await tester.pump();
      expect(find.bySemanticsLabel('Delete'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('appt-delete')));
      await tester.pump();
      expect(api.calls, isEmpty);
      expect(find.text('Tap again to delete'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('appt-delete')));
      await tester.pump();
      expect(closed, 1);
      expect(api.calls.single, ('delete', 'a1'));
    });

    testWidgets('warns that past dates get no reminder', (tester) async {
      phoneSurface(tester);
      await tester.pumpWidget(env.wrap(AppointmentSheet(onClose: () {}, appointment: row({'event_date': '2000-01-01'})), scroll: false));
      await tester.pump();
      expect(tester.widget<Text>(find.byKey(const ValueKey('appt-remind-hint'))).data, contains('no reminder will be sent'));
    });
  });

  group('sortAppointments', () {
    test('orders by date, then time, untimed last', () {
      final list = sortAppointments([
        row({'id': 'c', 'event_date': '2099-01-02', 'event_time': null}),
        row({'id': 'b', 'event_date': '2099-01-02', 'event_time': '08:00:00'}),
        row({'id': 'a', 'event_date': '2099-01-01', 'event_time': '23:00:00'}),
      ]);
      expect(list.map((a) => a.id), ['a', 'b', 'c']);
    });
  });

  group('UpcomingAppointments', () {
    String iso(int offset) => localDateKey(DateTime(env.now.year, env.now.month, env.now.day + offset));
    final opened = <String>[];
    Future<void> pump(WidgetTester tester, List<Map<String, Object?>> rows, {String? uid = 'u1'}) async {
      opened.clear();
      env.container.dispose();
      env = HomeTestEnv(
        uid: uid,
        extra: [
          appointmentSheetOpenerProvider.overrideWithValue((context, {appointment, defaultDate}) async {
            opened.add(appointment == null ? 'new' : 'edit:${appointment.title}');
          }),
        ],
      );
      env.repo.appointmentRows = [for (final r in rows) row(r).toRow()];
      phoneSurface(tester);
      await tester.pumpWidget(env.wrap(UpcomingAppointments(now: () => env.now), padded: true));
      await settle(tester);
    }

    testWidgets('lists only future appointments (max 4) and opens the edit sheet on tap', (tester) async {
      await pump(tester, [
        {'id': 'past', 'title': 'Old visit', 'event_date': iso(-2)},
        {'id': 't', 'title': 'Blood test', 'event_date': iso(0)},
        {'id': 'm', 'title': 'USM', 'event_date': iso(1)},
        {'id': 'x', 'title': 'Dentist', 'event_date': iso(10)},
        {'id': 'y', 'title': 'Checkup', 'event_date': iso(20)},
        {'id': 'z', 'title': 'Fifth', 'event_date': iso(30)},
      ]);
      expect(find.text('Old visit'), findsNothing);
      expect(find.text('Fifth'), findsNothing);
      expect(find.text('Blood test'), findsOneWidget);
      expect(find.text('Checkup'), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Tomorrow'), findsOneWidget);
      expect(find.text('10 days'), findsOneWidget);
      await tester.tap(find.text('USM'));
      expect(opened, ['edit:USM']);
    });

    testWidgets('shows the empty state and opens a new appointment sheet from it and from the add link', (tester) async {
      await pump(tester, const []);
      expect(find.text("Nothing coming up. Add a doctor's appointment."), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('upcoming-empty')));
      await tester.tap(find.byKey(const ValueKey('upcoming-add')));
      expect(opened, ['new', 'new']);
    });

    testWidgets('renders nothing when signed out', (tester) async {
      await pump(tester, const [], uid: null);
      expect(find.byKey(const ValueKey('upcoming-add')), findsNothing);
      expect(find.byType(UpcomingAppointments), findsOneWidget);
    });
  });
}
