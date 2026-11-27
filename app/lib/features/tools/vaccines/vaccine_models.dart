// Ported from: src/hooks/useVaccines.ts (VaccineCountry, Vaccine, VaccineSchedule, ChildVaccination,
//              VaccineScheduleRow)
//
// Rows stay snake_case maps (CONTRACT: rows at the edges); these wrappers read them like the TypeScript interfaces.
import '../../../domain/vaccines/vaccine_schedule.dart';

typedef VRow = Map<String, dynamic>;

String? _s(Object? v) => v is String ? v : null;
num? _n(Object? v) => v is num ? v : null;

/// `vaccine_countries` row (+ localized `name`).
class VaccineCountry {
  const VaccineCountry(this.row);
  final VRow row;
  String get id => '${row['id']}';
  String get code => _s(row['code']) ?? '';
  String? get name => _s(row['name']);
  String? get flagEmoji => _s(row['flag_emoji']);
  String? get sourceUrl => _s(row['source_url']);
  String? get sourceLabel => _s(row['source_label']);

  /// `schedule_meta.notes[lang]`.
  String? note(String lang) {
    final meta = row['schedule_meta'];
    final notes = meta is Map ? meta['notes'] : null;
    final v = notes is Map ? notes[lang] : null;
    return v is String && v.isNotEmpty ? v : null;
  }
}

/// `vaccines` row (localized fields already mapped).
class Vaccine {
  const Vaccine(this.row);
  final VRow row;
  String get id => '${row['id']}';
  String? get code => _s(row['code']);
  String? get name => _s(row['name']);
  String? get nameAz => _s(row['name_az']);
  String? get shortDescription => _s(row['short_description']);
  String? get fullDescription => _s(row['full_description']);
  String? get disease => _s(row['disease']);
  String? get route => _s(row['route']);
  String? get routeAz => _s(row['route_az']);
  String? get sideEffects => _s(row['side_effects']);
  String? get contraindications => _s(row['contraindications']);
  bool get isMandatory => row['is_mandatory'] == true;
  bool get isActive => row['is_active'] == true;
  String? get colorHex => _s(row['color_hex']);
}

/// `VaccineScheduleRow` (schedule row + its vaccine).
class VaccineScheduleRow {
  const VaccineScheduleRow(this.row, this.vaccine);
  factory VaccineScheduleRow.fromMap(VRow row) =>
      VaccineScheduleRow(row, Vaccine(Map<String, dynamic>.from((row['vaccine'] as Map?) ?? const {})));

  final VRow row;
  final Vaccine vaccine;

  String get id => '${row['id']}';
  String? get countryCode => _s(row['country_code']);
  num get doseNumber => _n(row['dose_number']) ?? 0;
  num get recommendedAgeDays => _n(row['recommended_age_days']) ?? 0;
  num? get minAgeDays => _n(row['min_age_days']);
  num? get maxAgeDays => _n(row['max_age_days']);
  String? get ageLabel => _s(row['age_label']);
  String? get ageLabelAz => _s(row['age_label_az']);
  String? get doseLabel => _s(row['dose_label']);
  String? get doseLabelAz => _s(row['dose_label_az']);
  String? get notes => _s(row['notes']);
  Object? get scheduleMeta => row['schedule_meta'];

  ScheduleLike get schedule => ScheduleLike(
        id: id,
        doseNumber: doseNumber,
        recommendedAgeDays: recommendedAgeDays,
        minAgeDays: minAgeDays,
        maxAgeDays: maxAgeDays,
        scheduleMeta: scheduleMeta,
      );

  VaccineTiming? get timing => vaccineTiming(schedule);

  /// `vaccineTiming(row)?.source_url` / `source_label`.
  String? get timingSourceUrl => _s(timing?.raw['source_url']);
  String? get timingSourceLabel => _s(timing?.raw['source_label']);
}

/// `child_vaccinations` row.
class ChildVaccination {
  const ChildVaccination(this.row);
  final VRow row;
  String get id => '${row['id']}';
  String? get vaccineScheduleId => _s(row['vaccine_schedule_id']);
  String? get administeredAt => _s(row['administered_at']);
  bool get isSkipped => row['is_skipped'] == true;

  VaccinationLike get like => VaccinationLike(administeredAt: administeredAt, isSkipped: isSkipped);
}
