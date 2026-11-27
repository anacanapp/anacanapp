// Ported from: src/hooks/useHoroscope.ts
//
// Zodiac signs (`zodiac_signs`, name / characteristics translated), saved readings (`horoscope_readings`) and the
// pure helpers (sign of a date, pair compatibility, element compatibility).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../state/user_store.dart';
import '../health_common/health_db.dart' show HQuery, eqF;
import '../media_common/media_ports.dart';

/// `useZodiacSigns()` → `['zodiac-signs', language]` (1 h).
final zodiacSignsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final db = ref.watch(mediaDbProvider);
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['zodiac-signs', language],
    staleTime: const Duration(hours: 1),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await db.select(const HQuery('zodiac_signs', order: [(column: 'sort_order', ascending: true)])), language, const [
      'name',
      'characteristics',
    ]),
  );
}, name: 'zodiacSignsQuery');

/// `useZodiacCompatibility()` → `['zodiac-compatibility', language]` (1 h).
final zodiacCompatibilityQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final db = ref.watch(mediaDbProvider);
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['zodiac-compatibility', language],
    staleTime: const Duration(hours: 1),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await db.select(const HQuery('zodiac_compatibility')), language, const ['description']),
  );
}, name: 'zodiacCompatibilityQuery');

/// `useHoroscopeReadings()` → `['horoscope-readings', userId]`.
final horoscopeReadingsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final userId = ref.watch(mediaAuthUserIdProvider);
  final db = ref.watch(mediaDbProvider);
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['horoscope-readings', userId],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => userId == null
        ? <Map<String, dynamic>>[]
        : await db.select(HQuery('horoscope_readings', filters: [eqF('user_id', userId)], order: const [(column: 'created_at', ascending: false)])),
  );
}, name: 'horoscopeReadingsQuery');

/// `useSaveHoroscopeReading().mutateAsync(reading)`: inserts the reading, refreshes the list.
final saveHoroscopeReadingProvider = Provider<Future<Map<String, dynamic>> Function(Map<String, Object?> reading)>(
  (ref) => (reading) async {
    final userId = ref.read(mediaAuthUserIdProvider);
    if (userId == null) throw StateError('User not authenticated');
    final row = await ref.read(mediaDbProvider).insert('horoscope_readings', {'user_id': userId, ...reading});
    unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: ['horoscope-readings']));
    return row;
  },
);

String _two(int v) => v.toString().padLeft(2, '0');

/// `format(date, 'MM-dd')`.
String monthDayKey(DateTime date) => '${_two(date.month)}-${_two(date.day)}';

/// `format(date, 'yyyy-MM-dd')`.
String isoDay(DateTime date) => '${date.year.toString().padLeft(4, '0')}-${_two(date.month)}-${_two(date.day)}';

/// `getZodiacSign(date, signs)`: signs crossing the year end (`start_date > end_date`) match either side.
Map<String, dynamic>? getZodiacSign(DateTime? date, List<Map<String, dynamic>> signs) {
  if (date == null || signs.isEmpty) return null;
  final md = monthDayKey(date);
  for (final sign in signs) {
    final start = '${sign['start_date'] ?? ''}';
    final end = '${sign['end_date'] ?? ''}';
    if (start.compareTo(end) > 0) {
      if (md.compareTo(start) >= 0 || md.compareTo(end) <= 0) return sign;
    } else if (md.compareTo(start) >= 0 && md.compareTo(end) <= 0) {
      return sign;
    }
  }
  return null;
}

/// `calculateCompatibility(sign1, sign2, compatibilities, relationshipType)`: either order.
Map<String, dynamic>? calculateCompatibility(
  String sign1,
  String sign2,
  List<Map<String, dynamic>> compatibilities, [
  String relationshipType = 'parent_child',
]) {
  for (final c in compatibilities) {
    final pair = (c['sign1'] == sign1 && c['sign2'] == sign2) || (c['sign1'] == sign2 && c['sign2'] == sign1);
    if (pair && c['relationship_type'] == relationshipType) return c;
  }
  return null;
}

/// `getElementCompatibility(element1, element2)` (70 / "unique" for unknown elements).
({int score, String descriptionAz}) getElementCompatibility(String element1, String element2) {
  final fireAir = tr('usehoroscope_mukemmel_harmoniya_hava_odu_da_75f2b0', 'Mükəmməl harmoniya! Hava odu daha da alovlandırır.');
  final fireEarth = tr('usehoroscope_ferqli_yanasmalar_amma_bir_bir_ba25d5', 'Fərqli yanaşmalar, amma bir-birinizi tamamlaya bilərsiniz.');
  final fireWater = tr('usehoroscope_bezen_cetin_olsa_da_derin_emos_8f19ff', 'Bəzən çətin olsa da, dərin emosional bağ qura bilərsiniz.');
  final earthAir = tr('usehoroscope_praktik_ve_nezeri_dusuncenin_m_99c118', 'Praktik və nəzəri düşüncənin maraqlı birləşməsi.');
  final earthWater = tr('usehoroscope_gozel_harmoniya_su_torpagi_can_abb534', 'Gözəl harmoniya! Su torpağı canlandırır.');
  final airWater = tr('usehoroscope_emosional_derinlik_ve_intellek_065e73', 'Emosional dərinlik və intellektual ünsiyyətin birləşməsi.');
  final map = <String, Map<String, ({int score, String descriptionAz})>>{
    'fire': {
      'fire': (
        score: 85,
        descriptionAz: tr('usehoroscope_cox_enerjili_ve_dinamik_bir_el_dfec07', 'Çox enerjili və dinamik bir əlaqə! Birlikdə hər şeyi bacararsınız.'),
      ),
      'air': (score: 90, descriptionAz: fireAir),
      'earth': (score: 60, descriptionAz: fireEarth),
      'water': (score: 50, descriptionAz: fireWater),
    },
    'earth': {
      'fire': (score: 60, descriptionAz: fireEarth),
      'air': (score: 55, descriptionAz: earthAir),
      'earth': (
        score: 95,
        descriptionAz: tr('usehoroscope_cox_sabit_ve_etibarli_elaqe_bi_e3baaf', 'Çox sabit və etibarlı əlaqə! Birlikdə dağları yerindən tərpədərsiniz.'),
      ),
      'water': (score: 85, descriptionAz: earthWater),
    },
    'air': {
      'fire': (score: 90, descriptionAz: fireAir),
      'air': (score: 80, descriptionAz: tr('usehoroscope_cox_unsiyyetcil_ve_yaradici_el_3ae25c', 'Çox ünsiyyətcil və yaradıcı əlaqə!')),
      'earth': (score: 55, descriptionAz: earthAir),
      'water': (score: 65, descriptionAz: airWater),
    },
    'water': {
      'fire': (score: 50, descriptionAz: fireWater),
      'air': (score: 65, descriptionAz: airWater),
      'earth': (score: 85, descriptionAz: earthWater),
      'water': (score: 90, descriptionAz: tr('usehoroscope_derin_emosional_bag_bir_birini_dc3f52', 'Dərin emosional bağ! Bir-birinizi mükəmməl anlayırsınız.')),
    },
  };
  return map[element1]?[element2] ?? (score: 70, descriptionAz: tr('usehoroscope_unikal_ve_maraqli_elaqe_48843d', 'Unikal və maraqlı əlaqə!'));
}
