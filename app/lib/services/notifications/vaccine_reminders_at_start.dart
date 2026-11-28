// Ported from: src/hooks/useVaccineRemindersAtStart.ts (ReminderChild, VaccineRefreshDeps, runVaccineReminderRefresh,
//              supabaseDeps, START_DELAY_MS, useVaccineRemindersAtStart)
//
// App-start refresh of the vaccine reminders for ALL of the signed-in user's children (native only, at most once a
// day per device, account and language). It never asks for notification permission; it only schedules when the
// permission is already granted and the per-device switch is on (VaccineReminders.refreshAll).
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/data/data.dart' show Db, mapRowsTranslation;
import '../../domain/js_compat.dart' show formatYmd;
import '../../domain/vaccines/vaccine_schedule.dart';
import '../../features/tools/vaccines/vaccine_labels.dart' show vaccineReminderText;
import '../../features/tools/vaccines/vaccine_models.dart';
import '../../features/tools/vaccines/vaccine_reminders.dart';

/// A `user_children` row as the refresh reads it.
@immutable
class ReminderChild {
  const ReminderChild({required this.id, required this.name, required this.birthDate, required this.gender, this.countryCode, this.vaccineCountryCode});
  factory ReminderChild.fromRow(Map<String, dynamic> r) => ReminderChild(
        id: '${r['id']}',
        name: r['name'] as String? ?? '',
        birthDate: r['birth_date'] as String? ?? '',
        gender: r['gender'] as String? ?? '',
        countryCode: r['country_code'] as String?,
        vaccineCountryCode: r['vaccine_country_code'] as String?,
      );
  final String id;
  final String name;
  final String birthDate;
  final String gender;
  final String? countryCode;
  final String? vaccineCountryCode;
}

/// A `child_vaccinations` row (child_id, vaccine_schedule_id, administered_at, is_skipped).
@immutable
class ReminderVaccinationLog {
  const ReminderVaccinationLog({required this.childId, required this.vaccineScheduleId, this.administeredAt, this.isSkipped = false});
  factory ReminderVaccinationLog.fromRow(Map<String, dynamic> r) => ReminderVaccinationLog(
        childId: '${r['child_id']}',
        vaccineScheduleId: '${r['vaccine_schedule_id']}',
        administeredAt: r['administered_at'] as String?,
        isSkipped: r['is_skipped'] == true,
      );
  final String childId;
  final String vaccineScheduleId;
  final String? administeredAt;
  final bool isSkipped;

  VaccinationLike get like => VaccinationLike(administeredAt: administeredAt, isSkipped: isSkipped);
}

abstract interface class VaccineRefreshDeps {
  Future<List<ReminderChild>> loadChildren(String userId);
  Future<List<VaccineScheduleRow>> loadSchedule(String country, String language);
  Future<List<ReminderVaccinationLog>> loadLogs(String userId, List<String> childIds);
}

/// Builds every child's plan exactly like the calendar does and hands it to [VaccineReminders.refreshAll].
Future<VaccineReminderResult> runVaccineReminderRefresh(
  VaccineReminders reminders,
  VaccineRefreshDeps deps, {
  required String userId,
  required String language,
  String? profileCountry,
  String? storedCountry,
  DateTime? now,
}) async {
  final at = now ?? DateTime.now();
  final children = await deps.loadChildren(userId);
  String countryOf(ReminderChild c) => regionalCountry(language, [c.vaccineCountryCode, profileCountry, storedCountry, c.countryCode]);
  final countries = <String>{for (final c in children) countryOf(c)};
  final schedules = <String, List<VaccineScheduleRow>>{};
  for (final country in countries) {
    schedules[country] = await deps.loadSchedule(country, language);
  }
  final logs = children.isNotEmpty ? await deps.loadLogs(userId, [for (final c in children) c.id]) : const <ReminderVaccinationLog>[];

  final plans = [
    for (final child in children)
      () {
        final logMap = <String, VaccinationLike>{for (final l in logs) if (l.childId == child.id) l.vaccineScheduleId: l.like};
        final rows = (schedules[countryOf(child)] ?? const <VaccineScheduleRow>[]).where((r) {
          final log = logMap[r.id];
          return (r.vaccine.isActive || log != null) && vaccineEligible(r.schedule, child.birthDate, child.gender, log);
        }).toList();
        final byId = {for (final r in rows) r.id: r};
        return ChildReminderPlan(
          childId: child.id,
          doses: [
            for (final r in rows)
              ReminderDose(
                id: r.id,
                status: vaccineStatus(r.schedule, child.birthDate, logMap, at),
                due: vaccineDueDate(r.schedule, child.birthDate, logMap),
              ),
          ],
          text: (slot) => vaccineReminderText(slot.kind, child.name, byId[slot.doseId], language),
        );
      }(),
  ];
  return reminders.refreshAll(plans, at);
}

List<Map<String, dynamic>> _rows(Object? data) => [for (final r in (data as List? ?? const [])) Map<String, dynamic>.from(r as Map)];

/// The Supabase queries of `supabaseDeps()` (same shape as useVaccineScheduleForCountry, kept small: names come
/// from vaccine-labels).
class SupabaseVaccineRefreshDeps implements VaccineRefreshDeps {
  SupabaseVaccineRefreshDeps(this.db);
  final Db db;

  @override
  Future<List<ReminderChild>> loadChildren(String userId) async => [
        for (final r in _rows(await db
            .from('user_children')
            .select('id,name,birth_date,gender,country_code,vaccine_country_code')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('sort_order', ascending: true)))
          ReminderChild.fromRow(r),
      ];

  @override
  Future<List<VaccineScheduleRow>> loadSchedule(String country, String language) async {
    final results = await Future.wait([
      db.from('vaccines').select().eq('country_code', country).order('sort_order', ascending: true),
      db.from('vaccine_schedules').select().eq('country_code', country).order('recommended_age_days', ascending: true),
    ]);
    final vaccines = mapRowsTranslation(_rows(results[0]), language, const ['name', 'route']);
    final vMap = {for (final v in vaccines) '${v['id']}': v};
    return [
      for (final s in mapRowsTranslation(_rows(results[1]), language, const ['dose_label', 'age_label']))
        if (vMap.containsKey('${s['vaccine_id']}'))
          () {
            final draft = VaccineScheduleRow(s, Vaccine(vMap['${s['vaccine_id']}']!));
            final names = draft.timing?.raw['display_name'];
            final name = names is Map ? names[language] : null;
            final vaccine = name is String && name.isNotEmpty ? <String, dynamic>{...vMap['${s['vaccine_id']}']!, 'name': name} : vMap['${s['vaccine_id']}']!;
            return VaccineScheduleRow({...s, 'vaccine': vaccine}, Vaccine(vaccine));
          }(),
    ];
  }

  @override
  Future<List<ReminderVaccinationLog>> loadLogs(String userId, List<String> childIds) async => [
        for (final r in _rows(await db
            .from('child_vaccinations')
            .select('child_id,vaccine_schedule_id,administered_at,is_skipped')
            .eq('user_id', userId)
            .inFilter('child_id', childIds)))
          ReminderVaccinationLog.fromRow(r),
      ];
}

/// `START_DELAY_MS`: after the first screens settle; this is background housekeeping.
const Duration vaccineRefreshStartDelay = Duration(milliseconds: 5000);

/// Inputs of `useVaccineRemindersAtStart`.
@immutable
class VaccineRefreshInputs {
  const VaccineRefreshInputs({this.userId, required this.ready, required this.language, this.profileCountry, this.storedCountry});
  final String? userId;
  final bool ready;
  final String language;
  final String? profileCountry;
  final String? storedCountry;

  @override
  bool operator ==(Object other) =>
      other is VaccineRefreshInputs &&
      other.userId == userId &&
      other.ready == ready &&
      other.language == language &&
      other.profileCountry == profileCountry &&
      other.storedCountry == storedCountry;
  @override
  int get hashCode => Object.hash(userId, ready, language, profileCountry, storedCountry);
}

typedef StartTimer = Timer Function(Duration delay, void Function() callback);

/// The hook's effect: re-armed whenever an input changes, cancelled on dispose.
class VaccineRemindersAtStart {
  VaccineRemindersAtStart({
    required this.isNative,
    required this.reminders,
    required this.deps,
    DateTime Function()? clock,
    StartTimer? timer,
    this.startDelay = vaccineRefreshStartDelay,
  })  : _clock = clock ?? DateTime.now,
        _timer = timer ?? Timer.new;

  /// `Capacitor.isNativePlatform()`.
  final bool Function() isNative;
  final VaccineReminders Function() reminders;
  final VaccineRefreshDeps Function() deps;
  final Duration startDelay;
  final DateTime Function() _clock;
  final StartTimer _timer;

  VaccineRefreshInputs? _inputs;
  Timer? _pending;

  /// The current effect run; a newer run (or dispose) cancels the older one.
  Object? _run;

  /// Runs the effect for [inputs] (no-op when unchanged).
  void update(VaccineRefreshInputs inputs) {
    if (inputs == _inputs) return;
    _inputs = inputs;
    _cleanup();
    final userId = inputs.userId;
    if (userId == null || userId.isEmpty || !inputs.ready || !isNative()) return;
    final stamp = '$userId:${formatYmd(_clock())}:${inputs.language}';
    final r = reminders();
    if (!r.refreshDue(stamp)) return;
    final run = Object();
    _run = run;
    _pending = _timer(startDelay, () => unawaited(_refresh(run, r, userId, inputs, stamp)));
  }

  Future<void> _refresh(Object run, VaccineReminders r, String userId, VaccineRefreshInputs inputs, String stamp) async {
    if (!identical(_run, run)) return;
    try {
      await runVaccineReminderRefresh(r, deps(),
          userId: userId, language: inputs.language, profileCountry: inputs.profileCountry, storedCountry: inputs.storedCountry, now: _clock());
      if (identical(_run, run)) r.markRefresh(stamp);
    } catch (_) {
      // offline or not ready: the next start (or opening the calendar) retries
    }
  }

  void _cleanup() {
    _run = null;
    _pending?.cancel();
    _pending = null;
  }

  void dispose() => _cleanup();
}
