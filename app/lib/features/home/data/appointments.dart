// Ported from: src/hooks/useAppointments.ts (appointmentsKey, sortAppointments, query, add via the offline outbox,
//              update, delete, getUpcoming, getByDate, outbox flush subscription)
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/row.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/offline/offline_outbox.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../design/design.dart' show AToastController;
import '../../../domain/dates/local_date.dart';
import '../home_inputs.dart';
import 'home_repository.dart';

@immutable
class Appointment {
  const Appointment({
    required this.id,
    required this.userId,
    required this.title,
    required this.description,
    required this.eventDate,
    required this.eventTime,
    required this.eventType,
    required this.reminderEnabled,
    required this.createdAt,
  });

  factory Appointment.fromRow(Row r) => Appointment(
    id: r.str('id') ?? '',
    userId: r.str('user_id') ?? '',
    title: r.str('title') ?? '',
    description: r.str('description'),
    eventDate: r.str('event_date') ?? '',
    eventTime: r.str('event_time'),
    eventType: r.str('event_type') ?? 'appointment',
    reminderEnabled: r.boolean('reminder_enabled') ?? true,
    createdAt: r.str('created_at') ?? '',
  );

  final String id;
  final String userId;
  final String title;
  final String? description;
  final String eventDate;
  final String? eventTime;
  final String eventType;
  final bool reminderEnabled;
  final String createdAt;

  Row toRow() => {
    'id': id,
    'user_id': userId,
    'title': title,
    'description': description,
    'event_date': eventDate,
    'event_time': eventTime,
    'event_type': eventType,
    'reminder_enabled': reminderEnabled,
    'created_at': createdAt,
  };
}

/// `appointmentsKey(userId)`.
List<Object?> appointmentsKey(String? userId) => ['appointments', userId];

/// Upcoming first; same day ordered by time (untimed last).
List<Appointment> sortAppointments(List<Appointment> list) {
  final out = [...list];
  // Array.prototype.sort is stable; mergeSort keeps that.
  mergeSort(
    out,
    compare: (a, b) {
      final d = a.eventDate.compareTo(b.eventDate);
      if (d != 0) return d;
      return (a.eventTime ?? '99').compareTo(b.eventTime ?? '99');
    },
  );
  return out;
}

/// `useAppointments()` list query — key `['appointments', userId]`, 60 s stale.
final appointmentsQuery = queryProvider<List<Appointment>>((ref) {
  final userId = ref.watch(homeUserIdProvider);
  if (userId != null) {
    // Offline outbox: flush queued appointments and refresh once a background flush delivered them.
    final outbox = ref.watch(offlineOutboxProvider);
    final client = ref.read(queryClientProvider);
    final unsubscribe = outbox.subscribe((change) {
      if (change.userId == userId && change.sentTables.contains('appointments')) {
        unawaited(client.invalidateQueries(queryKey: appointmentsKey(userId)));
      }
    });
    final release = outbox.retainUser(userId);
    ref.onDispose(() {
      unsubscribe();
      release();
    });
  }
  return QueryOptions<List<Appointment>>(
    queryKey: appointmentsKey(userId),
    enabled: userId != null,
    staleTime: const Duration(seconds: 60),
    codec: QueryCodecs.models<Appointment>((a) => a.toRow(), Appointment.fromRow),
    queryFn: (_) async => sortAppointments([for (final r in await ref.read(homeRepositoryProvider).appointments(userId!)) Appointment.fromRow(r)]),
  );
});

/// `getUpcoming(days)`: event_date is a local calendar day, compare day keys.
List<Appointment> upcomingAppointments(List<Appointment> list, [int days = 7]) {
  final from = todayKey();
  final to = daysAgoKey(-days);
  return list.where((a) => a.eventDate.compareTo(from) >= 0 && a.eventDate.compareTo(to) <= 0).toList();
}

/// `getByDate(date)`.
List<Appointment> appointmentsOn(List<Appointment> list, DateTime date) {
  final key = localDateKey(date);
  return list.where((a) => a.eventDate == key).toList();
}

/// Fields of an add / update (`AppointmentInput`).
typedef AppointmentFields = Map<String, Object?>;

/// Mutations of `useAppointments()`; returns null / false after a failure (the hook toasts the error).
abstract interface class AppointmentsApi {
  Future<Appointment?> add(AppointmentFields input, {AToastController? toast});
  Future<Appointment?> update(String id, AppointmentFields updates, {AToastController? toast});
  Future<bool> delete(String id, {AToastController? toast});
}

/// `saving` = any mutation pending.
final appointmentsSavingProvider = NotifierProvider<_Saving, int>(_Saving.new);

class _Saving extends Notifier<int> {
  @override
  int build() => 0;
  void inc() => state++;
  void dec() => state = state > 0 ? state - 1 : 0;
}

class _AppointmentsApi implements AppointmentsApi {
  _AppointmentsApi(this.ref);
  final Ref ref;

  String? get _userId => ref.read(homeUserIdProvider);

  void _setList(List<Appointment> Function(List<Appointment>) fn) {
    ref.read(queryClientProvider).setQueryData<List<Appointment>>(appointmentsKey(_userId), (old) => sortAppointments(fn(old ?? const [])));
  }

  void _fail(Object error, AToastController? toast) {
    debugPrint('Appointment change failed: $error');
    toast?.show(
      title: tr('useappointments_xeta_bas_verdi_f22fba', 'Xəta baş verdi'),
      description: error is Exception ? '$error' : null,
      destructive: true,
    );
  }

  Future<T> _pending<T>(Future<T> Function() run) async {
    final s = ref.read(appointmentsSavingProvider.notifier);
    s.inc();
    try {
      return await run();
    } finally {
      if (ref.mounted) s.dec();
    }
  }

  @override
  Future<Appointment?> add(AppointmentFields input, {AToastController? toast}) async {
    final userId = _userId;
    if (userId == null) return null;
    try {
      final row = await _pending(() async {
        // Queued in the offline outbox first (client UUID id, idempotent replay).
        final outcome = await ref.read(offlineOutboxProvider).saveWithOutbox(userId, 'appointments', {
          'user_id': userId,
          'reminder_enabled': true,
          'event_type': 'appointment',
          ...input,
        });
        if (outcome.status == SaveStatus.error) throw outcome.error ?? 'error';
        return Appointment.fromRow(Map<String, dynamic>.from(outcome.data ?? const {}));
      });
      _setList((list) => [...list.where((a) => a.id != row.id), row]);
      toast?.show(title: tr('useappointments_randevu_elave_edildi_dc2666', 'Randevu əlavə edildi! 📅'), description: row.title);
      return row;
    } catch (e) {
      _fail(e, toast);
      return null;
    }
  }

  @override
  Future<Appointment?> update(String id, AppointmentFields updates, {AToastController? toast}) async {
    final userId = _userId;
    if (userId == null) return null;
    try {
      final row = await _pending(() async => Appointment.fromRow(await ref.read(homeRepositoryProvider).updateAppointment(userId, id, updates)));
      _setList((list) => [for (final a in list) a.id == row.id ? row : a]);
      return row;
    } catch (e) {
      _fail(e, toast);
      return null;
    }
  }

  @override
  Future<bool> delete(String id, {AToastController? toast}) async {
    final userId = _userId;
    if (userId == null) return false;
    try {
      await _pending(() => ref.read(homeRepositoryProvider).deleteAppointment(userId, id));
      _setList((list) => list.where((a) => a.id != id).toList());
      toast?.show(title: tr('appointments_randevu_silindi', 'Randevu silindi'));
      return true;
    } catch (e) {
      _fail(e, toast);
      return false;
    }
  }
}

final appointmentsApiProvider = Provider<AppointmentsApi>((ref) => _AppointmentsApi(ref));
