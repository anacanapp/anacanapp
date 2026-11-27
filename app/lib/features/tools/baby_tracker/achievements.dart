// Ported from: src/hooks/useAchievements.ts
//
// `useAchievements()`:
//   achievements / loading / hasAchievement / getAchievementsByType / getTotalPoints → ref.watch(achievementsProvider)
//   unlockAchievement(id, type)                                                      → ref.read(achievementsActionsProvider)
//   realtime INSERT on user_achievements → refetch + "🎉 Nailiyyət: …" toast         → [AchievementToasts] (wraps a screen)
//   ACHIEVEMENTS                                                                      → [achievementDefinitions]
// [AchievementsBabyCareServices] plugs unlockAchievement into the baby care actions (`BabyCareServices`); the app
// root overrides `babyCareServicesProvider` with it (WIRING.md).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/realtime.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/net/backend_providers.dart';
import '../../../design/design.dart';
import '../../baby/hooks/baby_services.dart';

class AchievementDefinition {
  const AchievementDefinition(this.id, this._nameKey, this._nameAz, this._descKey, this._descAz, this.emoji, this.points);
  final String id;
  final String _nameKey, _nameAz, _descKey, _descAz;
  final String emoji;
  final int points;
  String get name => tr(_nameKey, _nameAz);
  String get description => tr(_descKey, _descAz);
}

/// `ACHIEVEMENTS` (names / descriptions translated on read).
const Map<String, List<AchievementDefinition>> achievementDefinitions = {
  'flow': [
    AchievementDefinition('first_log', 'useachievements_ilk_qeyd_9ffe17', 'İlk qeyd', 'useachievements_ilk_gundelik_qeydinizi_etdiniz_5668b4', 'İlk gündəlik qeydinizi etdiniz', '📝', 10),
    AchievementDefinition('water_champion', 'useachievements_su_cempionu_dbdd89', 'Su çempionu', 'useachievements_7_gun_ardicil_8_stekan_su_icdiniz_4a8763', '7 gün ardıcıl 8 stəkan su içdiniz', '💧', 50),
    AchievementDefinition('symptom_tracker', 'useachievements_simptom_izleyicisi_f87e97', 'Simptom izləyicisi', 'useachievements_30_gun_simptom_qeyd_etdiniz_4ebd0c', '30 gün simptom qeyd etdiniz', '📊', 100),
    AchievementDefinition('cycle_expert', 'useachievements_dovr_eksperti_a59aef', 'Dövr eksperti', 'useachievements_3_ay_dovr_izlediniz_0c7214', '3 ay dövr izlədiniz', '🔄', 150),
  ],
  'bump': [
    AchievementDefinition('first_kick', 'useachievements_ilk_tepik_c4991e', 'İlk təpik', 'useachievements_ilk_tepiki_qeyd_etdiniz_6cb5de', 'İlk təpiki qeyd etdiniz', '👣', 10),
    AchievementDefinition('kick_master', 'useachievements_tepik_ustasi_8d8ddd', 'Təpik ustası', 'useachievements_100_tepik_qeyd_etdiniz_7cff23', '100 təpik qeyd etdiniz', '🦶', 50),
    AchievementDefinition('weight_tracker', 'useachievements_ceki_izleyicisi_a28936', 'Çəki izləyicisi', 'useachievements_10_ceki_qeydi_etdiniz_15ea30', '10 çəki qeydi etdiniz', '⚖️', 30),
    AchievementDefinition('trimester_1', 'useachievements_1_ci_trimester_12345', '1-ci trimester', 'useachievements_1_ci_trimestri_tamamladiniz_82953e', '1-ci trimestri tamamladınız', '🌱', 100),
    AchievementDefinition('trimester_2', 'useachievements_2_ci_trimester_23456', '2-ci trimester', 'useachievements_2_ci_trimestri_tamamladiniz_bd7d13', '2-ci trimestri tamamladınız', '🌿', 150),
    AchievementDefinition('trimester_3', 'useachievements_3_cu_trimester_03fa4b', '3-cü trimester', 'useachievements_3_cu_trimestri_tamamladiniz_7a26a5', '3-cü trimestri tamamladınız', '🌳', 200),
    AchievementDefinition('hospital_bag_ready', 'useachievements_xestexana_cantasi_hazir_71cd1a', 'Xəstəxana çantası hazır', 'useachievements_xestexana_cantasini_tamamladiniz_7825f8', 'Xəstəxana çantasını tamamladınız', '🎒', 75),
  ],
  'mommy': [
    AchievementDefinition('first_feed', 'useachievements_ilk_qidalanma_d5b330', 'İlk qidalanma', 'useachievements_ilk_qidalanmani_qeyd_etdiniz_d2ba0b', 'İlk qidalanmanı qeyd etdiniz', '🍼', 10),
    AchievementDefinition('feeding_pro', 'useachievements_qidalanma_ustasi_7ee87c', 'Qidalanma ustası', 'useachievements_100_qidalanma_qeyd_etdiniz_34567', '100 qidalanma qeyd etdiniz', '🤱', 100),
    AchievementDefinition('sleep_tracker', 'useachievements_yuxu_izleyicisi_1ed3f5', 'Yuxu izləyicisi', 'useachievements_50_yuxu_qeyd_etdiniz_45678', '50 yuxu qeyd etdiniz', '😴', 50),
    AchievementDefinition('diaper_hero', 'useachievements_bez_qehremani_72c596', 'Bez qəhrəmanı', 'useachievements_100_bez_deyisme_qeyd_etdiniz_5fd4f5', '100 bez dəyişmə qeyd etdiniz', '👶', 75),
    AchievementDefinition('milestone_first', 'useachievements_ilk_merhele_a06a58', 'İlk mərhələ', 'useachievements_ilk_inkisaf_merhelesini_qeyd_etdiniz_50d5c9', 'İlk inkişaf mərhələsini qeyd etdiniz', '⭐', 25),
    AchievementDefinition('milestone_5', 'useachievements_5_merhele_aaa997', '5 mərhələ', 'useachievements_5_inkisaf_merhelesini_qeyd_etdiniz_831f29', '5 inkişaf mərhələsini qeyd etdiniz', '🏆', 100),
  ],
  'partner': [
    AchievementDefinition('first_message', 'useachievements_ilk_mesaj_c2af7d', 'İlk mesaj', 'useachievements_ilk_mesaji_gonderdiniz_cb17f2', 'İlk mesajı göndərdiniz', '💬', 10),
    AchievementDefinition('support_star', 'useachievements_destek_ulduzu_843f2b', 'Dəstək ulduzu', 'useachievements_10_sevgi_gonderdiniz_daf5b1', '10 sevgi göndərdiniz', '❤️', 30),
    AchievementDefinition('shopping_helper', 'useachievements_alis_veris_komekcisi_429aaa', 'Alış-veriş köməkçisi', 'useachievements_10_mehsul_elave_etdiniz_269710', '10 məhsul əlavə etdiniz', '🛒', 50),
    AchievementDefinition('active_partner', 'useachievements_aktiv_partner_56789', 'Aktiv partner', 'useachievements_7_gun_ardicil_tetbiqi_istifade_etdiniz_74a7d5', '7 gün ardıcıl tətbiqi istifadə etdiniz', '🌟', 100),
  ],
  'general': [
    AchievementDefinition('profile_complete', 'useachievements_profil_tamamlandi_a64e06', 'Profil tamamlandı', 'useachievements_profilinizi_tamamladiniz_546cdb', 'Profilinizi tamamladınız', '✅', 20),
    AchievementDefinition('first_week', 'useachievements_ilk_hefte_7228fd', 'İlk həftə', 'useachievements_tetbiqi_1_hefte_istifade_etdiniz_5dff17', 'Tətbiqi 1 həftə istifadə etdiniz', '📅', 25),
    AchievementDefinition('first_month', 'useachievements_ilk_ay_de1d29', 'İlk ay', 'useachievements_tetbiqi_1_ay_istifade_etdiniz_18a5b8', 'Tətbiqi 1 ay istifadə etdiniz', '🗓️', 100),
    AchievementDefinition('community_member', 'useachievements_icma_uzvu_7f7890', 'İcma üzvü', 'useachievements_ilk_paylasiminizi_etdiniz_10b9f8', 'İlk paylaşımınızı etdiniz', '👥', 30),
  ],
};

AchievementDefinition? achievementDefinition(String id) {
  for (final list in achievementDefinitions.values) {
    for (final d in list) {
      if (d.id == id) return d;
    }
  }
  return null;
}

/// A `user_achievements` row.
class Achievement {
  const Achievement(this.row);
  final Map<String, dynamic> row;
  String get id => '${row['id']}';
  String get achievementId => '${row['achievement_id']}';
  String get achievementType => '${row['achievement_type']}';
  bool get notified => row['notified'] == true;
}

/// Thrown by [AchievementsRepository.insert] for a Postgres error (code `23505` = already unlocked).
class AchievementWriteError implements Exception {
  const AchievementWriteError(this.code, [this.message]);
  final String? code;
  final String? message;
}

abstract interface class AchievementsRepository {
  Future<List<Map<String, dynamic>>> load(String userId);
  Future<void> insert(Map<String, dynamic> row);
  Future<void> markNotified(String userId, String achievementId);

  /// INSERT events on the user's rows; removed when [ref] is disposed.
  void watchInserts(Ref ref, String userId, void Function(Map<String, dynamic> row) onInsert);
}

class SupabaseAchievementsRepository implements AchievementsRepository {
  SupabaseAchievementsRepository(this._client);
  final SupabaseClient Function() _client;
  SupabaseClient get client => _client();

  @override
  Future<List<Map<String, dynamic>>> load(String userId) async {
    final data = await client.from('user_achievements').select().eq('user_id', userId).order('achieved_at', ascending: false);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<void> insert(Map<String, dynamic> row) async {
    try {
      await client.from('user_achievements').insert(row);
    } on PostgrestException catch (e) {
      throw AchievementWriteError(e.code, e.message);
    }
  }

  @override
  Future<void> markNotified(String userId, String achievementId) =>
      client.from('user_achievements').update({'notified': true}).eq('user_id', userId).eq('achievement_id', achievementId);

  @override
  void watchInserts(Ref ref, String userId, void Function(Map<String, dynamic> row) onInsert) {
    subscribePostgresChanges(ref, client,
        channelPrefix: 'achievements-channel',
        table: 'user_achievements',
        event: 'INSERT',
        filter: 'user_id=eq.$userId',
        onChange: (payload) => onInsert(Map<String, dynamic>.from(payload.newRecord)));
  }
}

final achievementsRepositoryProvider = Provider<AchievementsRepository>(
    (ref) => SupabaseAchievementsRepository(() => ref.read(supabaseClientProvider)),
    name: 'achievementsRepositoryProvider');

/// `fetchAchievements` (`['user-achievements', uid]`, never persisted).
final achievementsQuery = queryProvider<List<Achievement>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final repo = ref.watch(achievementsRepositoryProvider);
  return QueryOptions(
    queryKey: ['user-achievements', userId],
    enabled: userId != null,
    retry: noRetry,
    meta: const {'persist': false},
    queryFn: (_) async {
      try {
        return [for (final r in await repo.load(userId!)) Achievement(r)];
      } catch (e) {
        debugPrint('Error fetching achievements: $e');
        return const <Achievement>[];
      }
    },
  );
}, name: 'achievementsQuery');

class AchievementsView {
  const AchievementsView({required this.achievements, required this.loading});
  final List<Achievement> achievements;
  final bool loading;

  bool hasAchievement(String id) => achievements.any((a) => a.achievementId == id);
  List<Achievement> getAchievementsByType(String type) => achievements.where((a) => a.achievementType == type).toList();
  int getTotalPoints() => achievements.fold(0, (sum, a) => sum + (achievementDefinition(a.achievementId)?.points ?? 0));
}

final achievementsProvider = Provider.autoDispose<AchievementsView>((ref) {
  final q = ref.watch(achievementsQuery);
  return AchievementsView(achievements: q.data ?? const [], loading: q.isLoading);
}, name: 'achievementsProvider');

class AchievementsActions {
  AchievementsActions(this._ref);
  final Ref _ref;

  /// `unlockAchievement(id, type)`: true when it was newly unlocked.
  Future<bool> unlockAchievement(String achievementId, String achievementType) async {
    final userId = _ref.read(authUserProvider)?.id;
    if (userId == null) return false;
    final client = _ref.read(queryClientProvider);
    final key = ['user-achievements', userId];
    var known = client.getQueryData<List<Achievement>>(key);
    known ??= await client.fetchQuery<List<Achievement>>(
      QueryOptions(queryKey: key, queryFn: (_) async => [for (final r in await _ref.read(achievementsRepositoryProvider).load(userId)) Achievement(r)]),
    ).catchError((Object _) => const <Achievement>[]);
    if (known.any((a) => a.achievementId == achievementId)) return false;
    final repo = _ref.read(achievementsRepositoryProvider);
    try {
      try {
        await repo.insert({'user_id': userId, 'achievement_id': achievementId, 'achievement_type': achievementType, 'notified': false});
      } on AchievementWriteError catch (e) {
        // Ignore duplicate key errors.
        if (e.code == '23505') return false;
        rethrow;
      }
      // Mark as notified after showing the toast.
      await repo.markNotified(userId, achievementId);
      unawaited(client.invalidateQueries(queryKey: key));
      return true;
    } catch (e) {
      debugPrint('Error unlocking achievement: $e');
      return false;
    }
  }
}

final achievementsActionsProvider = Provider<AchievementsActions>(AchievementsActions.new, name: 'achievementsActionsProvider');

/// Realtime INSERT stream of the signed-in user's achievements (one channel while watched).
final achievementInsertsProvider = StreamProvider.autoDispose<Map<String, dynamic>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  if (userId == null) return const Stream.empty();
  final controller = StreamController<Map<String, dynamic>>();
  ref.read(achievementsRepositoryProvider).watchInserts(ref, userId, (row) {
    if (!controller.isClosed) controller.add(row);
  });
  ref.onDispose(controller.close);
  return controller.stream;
}, name: 'achievementInsertsProvider');

/// The hook's realtime effect while [child] is mounted: a new row joins the list and, when not yet notified,
/// shows "🎉 Nailiyyət: {name}" with its description.
class AchievementToasts extends ConsumerWidget {
  const AchievementToasts({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<AsyncValue<Map<String, dynamic>>>(achievementInsertsProvider, (_, next) {
      final row = next.value;
      if (row == null) return;
      final a = Achievement(row);
      final userId = ref.read(authUserProvider)?.id;
      ref.read(queryClientProvider).setQueryData<List<Achievement>>(['user-achievements', userId], (prev) => [a, ...?prev]);
      final details = achievementDefinition(a.achievementId);
      if (details != null && !a.notified) {
        AToastHost.of(context).show(title: '${tr('useachievements_nailiyyet', '🎉 Nailiyyət:')} ${details.name}', description: details.description);
      }
    });
    return child;
  }
}

/// `BabyCareServices` with real achievements (`useAchievements().unlockAchievement`); the rest as [base].
class AchievementsBabyCareServices implements BabyCareServices {
  AchievementsBabyCareServices(this._ref, [this.base = const DefaultBabyCareServices()]);
  final Ref _ref;
  final BabyCareServices base;

  @override
  Future<void> hapticLight() => base.hapticLight();
  @override
  Future<void> hapticMedium() => base.hapticMedium();
  @override
  Future<({num remaining, num limit})> peekRemainingDaily(String feature) => base.peekRemainingDaily(feature);
  @override
  Future<void> unlockAchievement(String key, String stage) async {
    await _ref.read(achievementsActionsProvider).unlockAchievement(key, stage);
  }
}
