// Ported from: src/hooks/useMentalHealth.ts, src/hooks/useMentalHealthData.ts
//
// Mood check-ins, EPDS assessments, help-line resources and the DB content (EPDS questions, mood levels, breathing
// exercises) with the React query keys, filters and stale times; the EPDS result builder and the prompt rule.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Row, Rows, mapRowsTranslation;
import '../../../core/i18n/generated/app_languages.g.dart' show kNewLanguageCodes;
import '../../../core/i18n/tr.dart';
import '../../../domain/dates/local_date.dart';
import '../../../state/user_store.dart';
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';
import 'epds_scoring.dart';

// ── EPDS result ──

@immutable
class EpdsResult {
  const EpdsResult({required this.totalScore, required this.riskLevel, required this.recommendation, required this.selfHarm});
  final num totalScore;
  final String riskLevel;
  final String recommendation;
  final bool selfHarm;
}

/// `buildEPDSResult(answers)`: score + recommendation copy; a self-harm answer always gives the urgent text.
EpdsResult buildEpdsResult(Map<Object, Object?> answers) {
  final s = scoreEpds(answers);
  final String recommendation;
  if (s.selfHarm) {
    recommendation = tr('epds_self_harm_recommendation',
        'Özünüzə zərər vermək fikirlərini qeyd etdiniz. Bu barədə bu gün həkiminizlə və ya yardım xətti ilə danışın. Təhlükədəsinizsə, indi təcili yardıma zəng edin.');
  } else if (s.riskLevel == 'high') {
    recommendation = tr('usementalhealth_neticeleriniz_yuksek_risk_gost_55d3a7', 'Nəticələriniz yüksək risk göstərir. Zəhmət olmasa mütəxəssislə əlaqə saxlayın.');
  } else if (s.riskLevel == 'moderate') {
    recommendation = tr('usementalhealth_neticeleriniz_orta_seviyyede_r_c3cd4c', 'Nəticələriniz orta səviyyədə risk göstərir. Həkiminizlə danışmağı tövsiyə edirik.');
  } else {
    recommendation = tr('usementalhealth_neticeleriniz_normal_seviyyede_cc8dde', 'Nəticələriniz normal səviyyədədir. Özünüzə qayğı göstərməyə davam edin.');
  }
  return EpdsResult(totalScore: s.totalScore, riskLevel: s.riskLevel, recommendation: recommendation, selfHarm: s.selfHarm);
}

/// `isEPDSSelfHarm(a)`: the client flag of a fresh result, else derived from the stored answers.
bool isEpdsSelfHarm(Row a) {
  if (a['self_harm'] == true) return true;
  final answers = a['answers'];
  return answers is Map && hasEpdsSelfHarm(Map<Object, Object?>.from(answers));
}

// ── EPDS questions (fallback) ──

@immutable
class EpdsQuestion {
  const EpdsQuestion(this.id, this.question, this.options);
  final int id;
  final String question;
  final List<({num value, String label})> options;
}

List<EpdsQuestion> fallbackEpdsQuestions() => [
      EpdsQuestion(1, tr('usementalhealth_son_7_gun_erzinde_gulmek_ve_gulmeli_tere_69e031', 'Son 7 gün ərzində gülmək və gülməli tərəfləri görmək mümkün oldu:'), [
        (value: 0, label: tr('usementalhealth_hemiseki_kimi_e708ee', 'Həmişəki kimi')),
        (value: 1, label: tr('usementalhealth_indi_o_qeder_de_yox_91ad4a', 'İndi o qədər də yox')),
        (value: 2, label: tr('usementalhealth_evvelki_kimi_deyil_e73285', 'Əvvəlki kimi deyil')),
        (value: 3, label: tr('usementalhealth_umumiyyetle_yox_6e0c1c', 'Ümumiyyətlə yox')),
      ]),
      EpdsQuestion(2, tr('usementalhealth_son_7_gun_erzinde_geleceye_hevesle_baxdi_191d48', 'Son 7 gün ərzində gələcəyə həvəslə baxdım:'), [
        (value: 0, label: tr('usementalhealth_hemiseki_qeder_be9ff8', 'Həmişəki qədər')),
        (value: 1, label: tr('usementalhealth_evvelkinden_bir_az_az_aa492a', 'Əvvəlkindən bir az az')),
        (value: 2, label: tr('usementalhealth_evvelkinden_xeyli_az_b06dd4', 'Əvvəlkindən xeyli az')),
        (value: 3, label: tr('usementalhealth_demek_olar_ki_hec_7d8e43', 'Demək olar ki, heç')),
      ]),
      EpdsQuestion(3, tr('usementalhealth_son_7_gun_erzinde_nese_sehv_getdikde_ozu_7020d6', 'Son 7 gün ərzində nəsə səhv getdikdə özümü əsassız yerə günahlandırdım:'), [
        (value: 3, label: tr('usementalhealth_beli_cox_vaxt_b3c387', 'Bəli, çox vaxt')),
        (value: 2, label: tr('usementalhealth_beli_bezen_3972c9', 'Bəli, bəzən')),
        (value: 1, label: tr('mentalhealth_tez_tez_deyil', 'Tez-tez deyil')),
        (value: 0, label: tr('usementalhealth_xeyr_hec_vaxt_b57661', 'Xeyr, heç vaxt')),
      ]),
      EpdsQuestion(4, tr('usementalhealth_son_7_gun_erzinde_hec_bir_sebeb_olmadan__d8ad78', 'Son 7 gün ərzində heç bir səbəb olmadan narahat və həyəcanlı oldum:'), [
        (value: 0, label: tr('usementalhealth_xeyr_umumiyyetle_yox_e2352c', 'Xeyr, ümumiyyətlə yox')),
        (value: 1, label: tr('usementalhealth_demek_olar_ki_hec_7d8e43', 'Demək olar ki, heç')),
        (value: 2, label: tr('usementalhealth_beli_bezen_3972c9', 'Bəli, bəzən')),
        (value: 3, label: tr('usementalhealth_beli_cox_tez_tez_39ed8b', 'Bəli, çox tez-tez')),
      ]),
      EpdsQuestion(5, tr('usementalhealth_son_7_gun_erzinde_hec_bir_sebeb_olmadan__ae94a6', 'Son 7 gün ərzində heç bir səbəb olmadan qorxdum və ya panikaya düşdüm:'), [
        (value: 3, label: tr('usementalhealth_beli_kifayet_qeder_cox_b2f3c8', 'Bəli, kifayət qədər çox')),
        (value: 2, label: tr('usementalhealth_beli_bezen_3972c9', 'Bəli, bəzən')),
        (value: 1, label: tr('usementalhealth_xeyr_cox_deyil_eb8671', 'Xeyr, çox deyil')),
        (value: 0, label: tr('usementalhealth_xeyr_umumiyyetle_yox_e2352c', 'Xeyr, ümumiyyətlə yox')),
      ]),
      EpdsQuestion(6, tr('usementalhealth_son_7_gun_erzinde_isler_meni_cox_yukledi_ee4b49', 'Son 7 gün ərzində işlər məni çox yüklədi:'), [
        (value: 3, label: tr('usementalhealth_beli_cox_vaxt_bacarmirdim_fe6629', 'Bəli, çox vaxt bacarmırdım')),
        (value: 2, label: tr('usementalhealth_beli_bezen_evvelki_kimi_bacarmirdim_b5945c', 'Bəli, bəzən əvvəlki kimi bacarmırdım')),
        (value: 1, label: tr('usementalhealth_xeyr_ekser_vaxt_yaxsi_idare_edirdim_e2b859', 'Xeyr, əksər vaxt yaxşı idarə edirdim')),
        (value: 0, label: tr('usementalhealth_xeyr_hemiseki_kimi_idare_edirdim_02a4c9', 'Xeyr, həmişəki kimi idarə edirdim')),
      ]),
      EpdsQuestion(7, tr('usementalhealth_son_7_gun_erzinde_o_qeder_bedbext_idim_k_1f093c', 'Son 7 gün ərzində o qədər bədbəxt idim ki, yuxuya getməkdə çətinlik çəkirdim:'), [
        (value: 3, label: tr('usementalhealth_beli_cox_vaxt_b3c387', 'Bəli, çox vaxt')),
        (value: 2, label: tr('usementalhealth_beli_bezen_3972c9', 'Bəli, bəzən')),
        (value: 1, label: tr('mentalhealth_tez_tez_deyil', 'Tez-tez deyil')),
        (value: 0, label: tr('usementalhealth_xeyr_umumiyyetle_yox_e2352c', 'Xeyr, ümumiyyətlə yox')),
      ]),
      EpdsQuestion(8, tr('usementalhealth_son_7_gun_erzinde_ozumu_kederli_ve_ya_be_e00f93', 'Son 7 gün ərzində özümü kədərli və ya bədbəxt hiss etdim:'), [
        (value: 3, label: tr('usementalhealth_beli_cox_vaxt_b3c387', 'Bəli, çox vaxt')),
        (value: 2, label: tr('usementalhealth_beli_kifayet_qeder_tez_tez_784be6', 'Bəli, kifayət qədər tez-tez')),
        (value: 1, label: tr('mentalhealth_tez_tez_deyil', 'Tez-tez deyil')),
        (value: 0, label: tr('usementalhealth_xeyr_umumiyyetle_yox_e2352c', 'Xeyr, ümumiyyətlə yox')),
      ]),
      EpdsQuestion(9, tr('usementalhealth_son_7_gun_erzinde_o_qeder_bedbext_idim_k_4a4ad7', 'Son 7 gün ərzində o qədər bədbəxt idim ki, ağlayırdım:'), [
        (value: 3, label: tr('usementalhealth_beli_cox_vaxt_b3c387', 'Bəli, çox vaxt')),
        (value: 2, label: tr('usementalhealth_beli_kifayet_qeder_tez_tez_784be6', 'Bəli, kifayət qədər tez-tez')),
        (value: 1, label: tr('usementalhealth_yalniz_bezen_5e5a2a', 'Yalnız bəzən')),
        (value: 0, label: tr('usementalhealth_xeyr_hec_vaxt_b57661', 'Xeyr, heç vaxt')),
      ]),
      EpdsQuestion(10, tr('usementalhealth_son_7_gun_erzinde_ozume_zerer_vermek_fik_fabedb', 'Son 7 gün ərzində özümə zərər vermək fikri ağlıma gəldi:'), [
        (value: 3, label: tr('usementalhealth_beli_kifayet_qeder_tez_tez_784be6', 'Bəli, kifayət qədər tez-tez')),
        (value: 2, label: tr('usementalhealth_bezen_6f3d8f', 'Bəzən')),
        (value: 1, label: tr('usementalhealth_demek_olar_ki_hec_7d8e43', 'Demək olar ki, heç')),
        (value: 0, label: tr('usementalhealth_hec_vaxt_7a641b', 'Heç vaxt')),
      ]),
    ];

// ── fallback DB content (useMentalHealthData) ──

List<Row> fallbackMoodLevels() => [
      {'id': '1', 'mood_value': 1, 'label': tr('usementalhealthdata_cox_pis_e041c5', 'Çox pis'), 'emoji': '😢', 'color': '#ef4444'},
      {'id': '2', 'mood_value': 2, 'label': tr('usementalhealthdata_pis_e041c6', 'Pis'), 'emoji': '😔', 'color': '#f97316'},
      {'id': '3', 'mood_value': 3, 'label': tr('usementalhealthdata_normal_e041c7', 'Normal'), 'emoji': '😐', 'color': '#eab308'},
      {'id': '4', 'mood_value': 4, 'label': tr('usementalhealthdata_yaxsi_9d8595', 'Yaxşı'), 'emoji': '😊', 'color': '#22c55e'},
      {'id': '5', 'mood_value': 5, 'label': tr('usementalhealthdata_ela_720a0e', 'Əla'), 'emoji': '🥰', 'color': '#10b981'},
    ];

List<Row> fallbackBreathingExercises() => [
      {
        'id': '1',
        'name': tr('usementalhealthdata_4_7_8_nefes_3ae243', '4-7-8 Nəfəs'),
        'description': tr('usementalhealthdata_sakitlik_ve_yuxuya_komek_eden__f1b25c', 'Sakitlik və yuxuya kömək edən relaksasiya texnikası'),
        'icon': 'Wind',
        'color': '#8b5cf6',
        'inhale_seconds': 4,
        'hold_seconds': 7,
        'exhale_seconds': 8,
        'hold_after_exhale_seconds': 0,
        'total_cycles': 4,
      },
      {
        'id': '2',
        'name': tr('usementalhealthdata_qutu_nefesi_7667cf', 'Qutu Nəfəsi'),
        'description': tr('usementalhealthdata_stress_nezareti_ucun_texnika_83964c', 'Stress nəzarəti üçün texnika'),
        'icon': 'Square',
        'color': '#3b82f6',
        'inhale_seconds': 4,
        'hold_seconds': 4,
        'exhale_seconds': 4,
        'hold_after_exhale_seconds': 4,
        'total_cycles': 4,
      },
    ];

// ── queries ──

String _language(Ref ref) => ref.watch(userStoreProvider.select((s) => s.language));
const _bySort = [(column: 'sort_order', ascending: true)];

/// `useMoodCheckins(days)` → `['mood-checkins', userId, days]`, since `days` ago (local day), newest first.
final moodCheckinsQuery = queryProviderFamily<Rows, int>((ref, days) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['mood-checkins', userId, days],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return <Row>[];
      return db.select(HQuery('mood_checkins',
          filters: [eqF('user_id', userId), gteF('checked_at', daysAgoKey(days))], order: const [(column: 'checked_at', ascending: false)]));
    },
  );
}, name: 'moodCheckinsQuery');

/// `useTodayMoodCheckin()` → `['mood-checkin-today', userId, today]`.
final todayMoodCheckinQuery = queryProvider<Row?>((ref) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  final today = todayKey();
  return QueryOptions<Row?>(
    queryKey: ['mood-checkin-today', userId, today],
    enabled: userId != null,
    codec: QueryCodecs.maybeRow,
    queryFn: (_) async {
      if (userId == null) return null;
      return db.maybeSingle(HQuery('mood_checkins', filters: [eqF('user_id', userId), eqF('checked_at', today)]));
    },
  );
}, name: 'todayMoodCheckinQuery');

/// `useEPDSAssessments()` → `['epds-assessments', userId]`, newest first.
final epdsAssessmentsQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['epds-assessments', userId],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return <Row>[];
      return db.select(HQuery('epds_assessments', filters: [eqF('user_id', userId)], order: const [(column: 'completed_at', ascending: false)]));
    },
  );
}, name: 'epdsAssessmentsQuery');

/// The country whose help lines are shown: store country, else the profile's, else guessed from the language.
String mentalHealthCountry(String language, String? storeCountry, String? profileCountry) {
  if (storeCountry != null && storeCountry.isNotEmpty) return storeCountry;
  if (profileCountry != null && profileCountry.isNotEmpty) return profileCountry;
  return switch (language) {
    'uz' => 'UZ',
    'ka' => 'GE',
    'kk' => 'KZ',
    'tr' => 'TR',
    'ru' => 'RU',
    'de' => 'DE',
    'ar' => 'SA',
    _ => 'AZ',
  };
}

/// Help lines of the user's country only when the rows carry a country (a wrong country's emergency number is
/// dangerous: an empty list beats a wrong number); the old schema without the column shows every row.
Rows filterResourcesByCountry(Rows rows, String country) {
  final hasCountryInfo = rows.any((r) => r['country_code'] is String && (r['country_code'] as String).isNotEmpty);
  if (!hasCountryInfo) return rows;
  return rows.where((r) {
    final c = r['country_code'];
    return (c is String && c.isNotEmpty ? c : 'AZ') == country;
  }).toList();
}

/// `useMentalHealthResources()` → `['mental-health-resources', language, storeCountry, userId]` (30 min).
final mentalHealthResourcesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final storeCountry = ref.watch(userStoreProvider.select((s) => s.countryCode));
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['mental-health-resources', language, storeCountry, userId],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final data = await db.select(const HQuery('mental_health_resources', filters: [(column: 'is_active', op: 'eq', value: true)], order: [(column: 'sort_order', ascending: true)]));
      String? profileCountry;
      if ((storeCountry == null || storeCountry.isEmpty) && userId != null) {
        try {
          final prof = await db.maybeSingle(HQuery('profiles', columns: 'country_code', filters: [eqF('user_id', userId)]));
          profileCountry = prof?['country_code'] as String?;
        } catch (_) {}
      }
      final country = mentalHealthCountry(language, storeCountry, profileCountry);
      return mapRowsTranslation(filterResourcesByCountry(data, country), language, const ['name', 'description', 'address']);
    },
  );
}, name: 'mentalHealthResourcesQuery');

/// The option text of an EPDS question in [language] (de/ar bridge through English, kk/uz/ka through Russian).
String epdsOptionText(Map<String, dynamic> o, String language) {
  String? s(String k) {
    final v = o[k];
    return v is String ? v : null;
  }

  final expanded = kNewLanguageCodes.contains(language);
  if (expanded) return s('text_$language') ?? s('text') ?? s('text_az') ?? '';
  return switch (language) {
        'az' => s('text_az') ?? s('text'),
        'de' => s('text_de') ?? s('text') ?? s('text_az'),
        'ar' => s('text_ar') ?? s('text') ?? s('text_az'),
        'kk' => s('text_kk') ?? s('text_ru') ?? s('text_az') ?? s('text'),
        'uz' => s('text_uz') ?? s('text_ru') ?? s('text_az') ?? s('text'),
        'ka' => s('text_ka') ?? s('text_ru') ?? s('text_az') ?? s('text'),
        _ => s('text_$language') ?? s('text_az') ?? s('text'),
      } ??
      '';
}

/// `useEPDSQuestionsDB()` → `['epds-questions', language]` (5 min).
final epdsQuestionsDbQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['epds-questions', language],
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final data = await db.select(const HQuery('epds_questions', filters: [(column: 'is_active', op: 'eq', value: true)], order: _bySort));
      final expanded = kNewLanguageCodes.contains(language);
      final mapped = mapRowsTranslation(data, language, expanded ? const ['question_text', 'options'] : const ['question_text']);
      return [
        for (final q in mapped)
          {
            ...q,
            'options': [
              for (final o in (q['options'] is List ? q['options'] as List : const []))
                if (o is Map) {'value': o['value'], 'text': epdsOptionText(Map<String, dynamic>.from(o), language), 'text_az': o['text_az']},
            ],
          },
      ];
    },
  );
}, name: 'epdsQuestionsDbQuery');

/// `useMoodLevelsDB()` → `['mood-levels', language]` (30 min).
final moodLevelsDbQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['mood-levels', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async =>
        mapRowsTranslation(await db.select(const HQuery('mood_levels', filters: [(column: 'is_active', op: 'eq', value: true)], order: _bySort)), language, const ['label']),
  );
}, name: 'moodLevelsDbQuery');

/// `useBreathingExercisesDB()` → `['breathing-exercises', language]` (30 min).
final breathingExercisesDbQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['breathing-exercises', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
        await db.select(const HQuery('breathing_exercises', filters: [(column: 'is_active', op: 'eq', value: true)], order: _bySort)), language, const ['name', 'description']),
  );
}, name: 'breathingExercisesDbQuery');

// ── mutations ──

class MentalHealthActions {
  MentalHealthActions(this._ref);
  final Ref _ref;

  /// `useAddMoodCheckin().mutateAsync`: upsert of today's check-in (user_id, checked_at).
  Future<Row> addMoodCheckin({required int moodLevel, String? moodType, String? notes}) async {
    final userId = _ref.read(authUserProvider)?.id;
    if (userId == null) throw StateError('User not authenticated');
    final data = await _ref.read(healthDbProvider).upsert(
          'mood_checkins',
          {'user_id': userId, 'checked_at': todayKey(), 'mood_level': moodLevel, 'mood_type': ?moodType, 'notes': ?notes},
          onConflict: 'user_id,checked_at',
        );
    final qc = _ref.read(queryClientProvider);
    unawaited(qc.invalidateQueries(queryKey: const ['mood-checkins']));
    unawaited(qc.invalidateQueries(queryKey: const ['mood-checkin-today']));
    return data;
  }

  /// `useSubmitEPDS().mutateAsync`: stores the assessment and returns it with the client-only `self_harm` flag.
  Future<Row> submitEpds(Map<String, num> answers) async {
    final userId = _ref.read(authUserProvider)?.id;
    if (userId == null) throw StateError('User not authenticated');
    final r = buildEpdsResult(answers);
    final data = await _ref.read(healthDbProvider).insert('epds_assessments', {
      'user_id': userId,
      'total_score': r.totalScore,
      'answers': answers,
      'risk_level': r.riskLevel,
      'recommendation': r.recommendation,
    });
    unawaited(_ref.read(queryClientProvider).invalidateQueries(queryKey: const ['epds-assessments']));
    return {...data, 'self_harm': r.selfHarm};
  }
}

final mentalHealthActionsProvider = Provider<MentalHealthActions>(MentalHealthActions.new);

// ── EPDS prompt ──

/// `mergeMoodSignals`: mood_checkins and daily_logs.mood share the 1-5 scale; the same day prefers the check-in.
List<({String checkedAt, num moodLevel})> mergeMoodSignals(Rows checkins, Rows dailyLogs, {DateTime? now}) {
  final byDate = <String, num>{};
  final cutoff = daysAgoKey(14, now);
  for (final log in dailyLogs) {
    final mood = log['mood'];
    final date = log['log_date'];
    if (mood is num && date is String && date.compareTo(cutoff) >= 0) byDate[date] = mood;
  }
  for (final c in checkins) {
    final date = c['checked_at'];
    final level = c['mood_level'];
    if (date is String && level is num) byDate[date] = level;
  }
  return [for (final e in byDate.entries) (checkedAt: e.key, moodLevel: e.value)];
}

int _consecutiveLowMoodDays(List<({String checkedAt, num moodLevel})> checkins) {
  var max = 0, current = 0;
  final sorted = [...checkins]..sort((a, b) => b.checkedAt.compareTo(a.checkedAt));
  for (final c in sorted) {
    if (c.moodLevel <= 2) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

/// `useShouldShowEPDSPrompt(dailyLogs)`: 7+ low days in 14, or 5+ consecutive low days.
bool shouldShowEpdsPrompt(Rows checkins, Rows dailyLogs, {DateTime? now}) {
  final merged = mergeMoodSignals(checkins, dailyLogs, now: now);
  if (merged.isEmpty) return false;
  final low = merged.where((c) => c.moodLevel <= 2).length;
  return low >= 7 || _consecutiveLowMoodDays(merged) >= 5;
}
