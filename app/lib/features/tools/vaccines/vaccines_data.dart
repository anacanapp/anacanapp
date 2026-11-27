// Ported from: src/hooks/useVaccines.ts, the `user_children` write of src/components/tools/VaccineCalendar.tsx
//              (handleChangeCountry)
//
// React Query hooks → query providers with the same keys:
//   useVaccineCountries()                 → vaccineCountriesQuery          ['vaccine-countries', lang, backend]
//   useVaccineScheduleForCountry(code)    → vaccineScheduleQuery(code)     ['vaccine-schedule', code, lang, backend]
//   useChildVaccinations(childId)         → childVaccinationsQuery(childId) ['child-vaccinations', childId, uid, backend]
//   useUpsertChildVaccination / useDeleteChildVaccination → VaccinesActions (invalidate ['child-vaccinations', childId])
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/language_controller.dart';
import '../../../core/net/backend_providers.dart';
import '../../entry/language/initial_language_screen.dart' show localizedCountryName;
import '../../home_mommy/mommy_dashboard.dart' show babyInsightBackendProvider;
import 'vaccine_models.dart';

export 'vaccine_models.dart';

/// Every network access of the vaccine calendar (tests override it with a fake).
abstract interface class VaccinesRepository {
  Future<List<VRow>> countries();
  Future<List<VRow>> vaccines(String countryCode);
  Future<List<VRow>> schedules(String countryCode);
  Future<List<VRow>> childVaccinations(String childId, String userId);
  Future<VRow?> upsertChildVaccination(VRow payload);
  Future<void> deleteChildVaccination(String id);

  /// `update({ vaccine_country_code }).eq('id').eq('user_id').select('id,vaccine_country_code').maybeSingle()`.
  Future<VRow?> updateChildVaccineCountry(String childId, String userId, String code);
}

class SupabaseVaccinesRepository implements VaccinesRepository {
  SupabaseVaccinesRepository(this._client);
  final SupabaseClient Function() _client;
  SupabaseClient get client => _client();

  List<VRow> _rows(Object? data) => [for (final r in (data as List? ?? const [])) Map<String, dynamic>.from(r as Map)];

  @override
  Future<List<VRow>> countries() async =>
      _rows(await client.from('vaccine_countries').select().eq('is_active', true).order('sort_order'));
  @override
  Future<List<VRow>> vaccines(String countryCode) async =>
      _rows(await client.from('vaccines').select().eq('country_code', countryCode).order('sort_order'));
  @override
  Future<List<VRow>> schedules(String countryCode) async =>
      _rows(await client.from('vaccine_schedules').select().eq('country_code', countryCode).order('recommended_age_days'));
  @override
  Future<List<VRow>> childVaccinations(String childId, String userId) async =>
      _rows(await client.from('child_vaccinations').select().eq('child_id', childId).eq('user_id', userId));
  @override
  Future<VRow?> upsertChildVaccination(VRow payload) =>
      client.from('child_vaccinations').upsert(payload, onConflict: 'child_id,vaccine_schedule_id').select().maybeSingle();
  @override
  Future<void> deleteChildVaccination(String id) => client.from('child_vaccinations').delete().eq('id', id);
  @override
  Future<VRow?> updateChildVaccineCountry(String childId, String userId, String code) => client
      .from('user_children')
      .update({'vaccine_country_code': code})
      .eq('id', childId)
      .eq('user_id', userId)
      .select('id,vaccine_country_code')
      .maybeSingle();
}

final vaccinesRepositoryProvider =
    Provider<VaccinesRepository>((ref) => SupabaseVaccinesRepository(() => ref.read(supabaseClientProvider)), name: 'vaccinesRepositoryProvider');

final vaccineCountriesQuery = queryProvider<List<VaccineCountry>>((ref) {
  final language = ref.watch(appLanguageProvider);
  final backend = ref.watch(babyInsightBackendProvider);
  final repo = ref.watch(vaccinesRepositoryProvider);
  return QueryOptions(
    queryKey: ['vaccine-countries', language, backend],
    queryFn: (_) async {
      final rows = mapRowsTranslation(await repo.countries(), language, const ['name']);
      return [
        for (final row in rows)
          VaccineCountry({
            ...row,
            'name': _truthy(row['name_$language']) ??
                localizedCountryName('${row['code']}', language, _truthy(row['name']) ?? _truthy(row['name_en']) ?? '${row['code']}'),
          }),
      ];
    },
  );
}, name: 'vaccineCountriesQuery');

String? _truthy(Object? v) => v is String && v.isNotEmpty ? v : null;

final vaccineScheduleQuery = queryProviderFamily<List<VaccineScheduleRow>, String?>((ref, countryCode) {
  final language = ref.watch(appLanguageProvider);
  final backend = ref.watch(babyInsightBackendProvider);
  final repo = ref.watch(vaccinesRepositoryProvider);
  return QueryOptions(
    queryKey: ['vaccine-schedule', countryCode, language, backend],
    enabled: countryCode != null && countryCode.isNotEmpty,
    queryFn: (_) async {
      final vaccines = await repo.vaccines(countryCode!);
      final schedules = await repo.schedules(countryCode);
      final mappedVaccines = mapRowsTranslation(vaccines, language,
          const ['name', 'short_description', 'full_description', 'disease', 'route', 'side_effects', 'contraindications']);
      final mappedSchedules = mapRowsTranslation(schedules, language, const ['dose_label', 'age_label', 'notes']);
      final vMap = {for (final v in mappedVaccines) '${v['id']}': v};
      return [
        for (final s in mappedSchedules)
          if (vMap.containsKey('${s['vaccine_id']}'))
            () {
              final vaccine = vMap['${s['vaccine_id']}']!;
              final draft = VaccineScheduleRow(s, Vaccine(vaccine));
              final names = draft.timing?.raw['display_name'];
              final name = names is Map ? names[language] : null;
              // A reviewed MR programme must not inherit old MMR/mumps prose from a legacy catalogue label.
              final v = name is String && name.isNotEmpty
                  ? <String, dynamic>{
                      ...vaccine,
                      'name': name,
                      'disease': null,
                      'short_description': null,
                      'full_description': null,
                      'route': null,
                      'side_effects': null,
                      'contraindications': null,
                    }
                  : vaccine;
              return VaccineScheduleRow({...s, 'vaccine': v}, Vaccine(v));
            }(),
      ];
    },
  );
}, name: 'vaccineScheduleQuery');

final childVaccinationsQuery = queryProviderFamily<List<ChildVaccination>, String?>((ref, childId) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(babyInsightBackendProvider);
  final repo = ref.watch(vaccinesRepositoryProvider);
  return QueryOptions(
    queryKey: ['child-vaccinations', childId, userId, backend],
    enabled: childId != null && userId != null,
    meta: const {'persist': false},
    queryFn: (_) async => [for (final r in await repo.childVaccinations(childId!, userId!)) ChildVaccination(r)],
  );
}, name: 'childVaccinationsQuery');

class VaccinesActions {
  VaccinesActions(this._ref);
  final Ref _ref;

  Future<VRow?> upsert(VRow input) async {
    final user = _ref.read(authUserProvider);
    if (user == null) throw StateError('unauthenticated');
    final data = await _ref.read(vaccinesRepositoryProvider).upsertChildVaccination({...input, 'user_id': user.id});
    await _ref.read(queryClientProvider).invalidateQueries(queryKey: ['child-vaccinations', input['child_id']]);
    return data;
  }

  Future<void> delete({required String id, required String childId}) async {
    await _ref.read(vaccinesRepositoryProvider).deleteChildVaccination(id);
    await _ref.read(queryClientProvider).invalidateQueries(queryKey: ['child-vaccinations', childId]);
  }
}

final vaccinesActionsProvider = Provider<VaccinesActions>(VaccinesActions.new, name: 'vaccinesActionsProvider');
