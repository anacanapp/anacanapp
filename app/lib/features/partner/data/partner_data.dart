// Ported from: src/hooks/usePartnerData.ts
//
// The partner's view of the woman: her profile, today's daily log (masked by her sharing settings on the server
// and again here), her active children. Offline: the last successful fetch from the offline cache. Refreshed every
// 5 minutes while open and when the app returns to the foreground (daily_logs cannot be delivered by realtime).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/offline/offline_providers.dart' show appResumeEventsProvider, offlineCacheProvider;
import '../../../domain/cycle/cycle_utils.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart' as pu;
import 'partner_backend.dart';
import 'partner_sharing.dart';

const String kPartnerProfileCache = 'partner_profile';
const String kPartnerDailyLogCache = 'partner_dailylog';

/// `PartnerWomanData`: the `profiles` row the partner reads (raw row + typed getters).
@immutable
class PartnerWomanData {
  PartnerWomanData(Map<String, dynamic> row) : row = Map.unmodifiable(row);
  final Map<String, dynamic> row;

  String? _s(String k) => row[k] is String ? row[k] as String : null;
  String get id => _s('id') ?? '';
  String get userId => _s('user_id') ?? '';
  String get name => _s('name') ?? '';

  /// 'flow' | 'bump' | 'mommy' | null.
  String? get lifeStage => _s('life_stage');
  String? get lastPeriodDate => _s('last_period_date');
  String? get dueDate => _s('due_date');
  String? get babyBirthDate => _s('baby_birth_date');
  String? get babyName => _s('baby_name');

  /// 'boy' | 'girl' | null.
  String? get babyGender => _s('baby_gender');
  int? get cycleLength => row['cycle_length'] is num ? (row['cycle_length'] as num).toInt() : null;
  int? get periodLength => row['period_length'] is num ? (row['period_length'] as num).toInt() : null;

  /// Twins/triplets: "körpəniz" → "körpələriniz" on the partner screens.
  String? get multiplesType => _s('multiples_type');
  String? get avatarUrl => _s('avatar_url');
  String? get pregnancyLossDate => _s('pregnancy_loss_date');
  bool get lossRecoveryActive => row['loss_recovery_active'] == true;
  bool get lossSharePartner => row['loss_share_partner'] == true;
}

/// One of her ACTIVE children (`partner_children_v1`, masked by share_baby_logs).
@immutable
class PartnerChild {
  const PartnerChild({required this.id, required this.name, this.birthDate, this.gender, this.avatarEmoji, this.isCurrent = false, this.dueDate});
  final String id;
  final String name;
  final String? birthDate;

  /// 'boy' | 'girl' | null.
  final String? gender;
  final String? avatarEmoji;
  final bool isCurrent;

  /// Original due date: a preterm baby's milestone check uses the corrected age.
  final String? dueDate;

  Map<String, Object?> toRow() =>
      {'id': id, 'name': name, 'birth_date': birthDate, 'gender': gender, 'avatar_emoji': avatarEmoji, 'is_current': isCurrent, 'due_date': dueDate};

  @override
  bool operator ==(Object other) => other is PartnerChild && mapEquals(other.toRow(), toRow());
  @override
  int get hashCode => Object.hashAll(toRow().values);
}

final RegExp _ymdPrefix = RegExp(r'^\d{4}-\d{2}-\d{2}');

/// `normalizePartnerChildren(rows)`: rows with a string id; `due_date` kept only as a calendar day (an older
/// function without the column gives null).
List<PartnerChild> normalizePartnerChildren(List<Object?> rows) => [
      for (final r in rows)
        if (r is Map && r['id'] is String)
          PartnerChild(
            id: r['id'] as String,
            name: r['name'] is String ? r['name'] as String : '',
            birthDate: r['birth_date'] is String ? r['birth_date'] as String : null,
            gender: r['gender'] is String ? r['gender'] as String : null,
            avatarEmoji: r['avatar_emoji'] is String ? r['avatar_emoji'] as String : null,
            isCurrent: r['is_current'] == true,
            dueDate: r['due_date'] is String && _ymdPrefix.hasMatch(r['due_date'] as String) ? (r['due_date'] as String).substring(0, 10) : null,
          ),
    ];

/// `PartnerDailyLog`.
@immutable
class PartnerDailyLog {
  const PartnerDailyLog({this.mood, this.symptoms, this.waterIntake, required this.logDate});
  final int? mood;
  final List<String>? symptoms;
  final num? waterIntake;
  final String logDate;

  factory PartnerDailyLog.fromRow(Map<String, dynamic> r) => PartnerDailyLog(
        mood: r['mood'] is num ? (r['mood'] as num).toInt() : null,
        symptoms: r['symptoms'] is List ? [for (final s in r['symptoms'] as List) if (s is String) s] : null,
        waterIntake: r['water_intake'] is num ? r['water_intake'] as num : null,
        logDate: r['log_date'] is String ? r['log_date'] as String : '',
      );

  Map<String, Object?> toRow() => {'mood': mood, 'symptoms': symptoms, 'water_intake': waterIntake, 'log_date': logDate};
}

@immutable
class PartnerDataState {
  const PartnerDataState({this.partnerProfile, this.dailyLog, this.children = const [], this.loading = true, this.error});
  final PartnerWomanData? partnerProfile;

  /// Unmasked log (the view masks it).
  final PartnerDailyLog? dailyLog;
  final List<PartnerChild> children;
  final bool loading;
  final String? error;

  PartnerDataState copyWith({
    Object? partnerProfile = _keep,
    Object? dailyLog = _keep,
    List<PartnerChild>? children,
    bool? loading,
    Object? error = _keep,
  }) =>
      PartnerDataState(
        partnerProfile: identical(partnerProfile, _keep) ? this.partnerProfile : partnerProfile as PartnerWomanData?,
        dailyLog: identical(dailyLog, _keep) ? this.dailyLog : dailyLog as PartnerDailyLog?,
        children: children ?? this.children,
        loading: loading ?? this.loading,
        error: identical(error, _keep) ? this.error : error as String?,
      );
}

const Object _keep = Object();

/// The background refresh interval (gentle: an open-but-idle app does not hit the RPC every minute).
const Duration kPartnerDataPoll = Duration(minutes: 5);

/// The fetch half of `usePartnerData()`; read [partnerDataProvider] for the masked view.
final partnerDataSourceProvider = NotifierProvider.autoDispose<PartnerDataController, PartnerDataState>(PartnerDataController.new);

class PartnerDataController extends Notifier<PartnerDataState> {
  String? _linked;
  String? _ownUserId;
  Timer? _poll;
  int _seq = 0;

  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  PartnerDataState build() {
    // Effect deps of the hook: the link (and the own user id the cache is bound to), not every profile change.
    _linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
    _ownUserId = ref.watch(authProfileProvider.select((p) => p?.userId));
    ref.onDispose(() {
      _poll?.cancel();
      _poll = null;
    });
    final linked = _linked;
    if (linked != null && linked.isNotEmpty) {
      final sub = ref.watch(appResumeEventsProvider).listen((_) => unawaited(fetchPartnerData()));
      ref.onDispose(sub.cancel);
    }
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchPartnerData());
    });
    return const PartnerDataState();
  }

  void _startPolling() {
    if (_poll != null) return;
    _poll = Timer.periodic(kPartnerDataPoll, (_) {
      if (ref.mounted) unawaited(fetchPartnerData());
    });
  }

  /// Offline fallback: the last successful fetch. Today's log only when it is today's (yesterday's mood must not
  /// show as "today").
  bool _restoreFromCache() {
    final uid = _ownUserId;
    if (uid == null || uid.isEmpty) return false;
    final cache = ref.read(offlineCacheProvider);
    final cachedProfile = cache.readCache<Map<String, dynamic>>(kPartnerProfileCache, uid);
    if (cachedProfile == null) return false;
    var next = state.copyWith(partnerProfile: PartnerWomanData(cachedProfile));
    final cachedLog = cache.readCache<Map<String, dynamic>>(kPartnerDailyLogCache, uid);
    if (cachedLog != null && cachedLog['log_date'] == todayKey()) next = next.copyWith(dailyLog: PartnerDailyLog.fromRow(cachedLog));
    state = next;
    return true;
  }

  /// `fetchPartnerData()` (`refetch`).
  Future<void> fetchPartnerData() async {
    final linked = _linked;
    if (linked == null || linked.isEmpty) {
      state = state.copyWith(loading: false);
      return;
    }
    final run = ++_seq;
    bool current() => ref.mounted && run == _seq;
    try {
      Map<String, dynamic>? partnerRow;
      try {
        partnerRow = await _backend.womanProfile(linked);
      } catch (error) {
        debugPrint('Error fetching partner profile: $error');
        if (!current()) return;
        // Offline / server error → the last state from the cache.
        if (!_restoreFromCache()) {
          state = state.copyWith(error: tr('usepartnerdata_partner_melumatlari_yuklene_bi_430423', 'Partner məlumatları yüklənə bilmədi'));
        }
        state = state.copyWith(loading: false);
        return;
      }
      if (!current()) return;
      if (partnerRow != null) {
        state = state.copyWith(partnerProfile: PartnerWomanData(partnerRow));
        final uid = _ownUserId;
        if (uid != null && uid.isNotEmpty) ref.read(offlineCacheProvider).writeCache(kPartnerProfileCache, uid, partnerRow);

        // Masked by her sharing settings on the server; no direct daily_logs access.
        final today = todayKey();
        try {
          final logRows = await _backend.rpc('partner_daily_logs_v1', {'p_from': today, 'p_to': today});
          if (!current()) return;
          final first = logRows is List && logRows.isNotEmpty && logRows.first is Map ? Map<String, dynamic>.from(logRows.first as Map) : null;
          if (first != null) {
            state = state.copyWith(dailyLog: PartnerDailyLog.fromRow(first));
            if (uid != null && uid.isNotEmpty) ref.read(offlineCacheProvider).writeCache(kPartnerDailyLogCache, uid, first);
          }
        } catch (_) {
          // `logError` → keep the previous log.
        }

        // All of her active children (a missing RPC on an older backend leaves the list empty).
        try {
          final kids = await _backend.rpc('partner_children_v1');
          if (!current()) return;
          if (kids is List) state = state.copyWith(children: normalizePartnerChildren(kids));
        } catch (_) {}
        _startPolling();
      }
    } catch (error) {
      debugPrint('Error in fetchPartnerData: $error');
      if (current() && !_restoreFromCache()) state = state.copyWith(error: tr('usepartnerdata_xeta_bas_verdi_f22fba', 'Xəta baş verdi'));
    } finally {
      if (current()) state = state.copyWith(loading: false);
    }
  }
}

/// `usePartnerData()`: the fetched data with her sharing mask and the derived values.
@immutable
class PartnerData {
  const PartnerData({required this.source, required this.sharing, this.refetch});
  final PartnerDataState source;
  final PartnerSharing sharing;
  final Future<void> Function()? refetch;

  PartnerWomanData? get partnerProfile => source.partnerProfile;
  List<PartnerChild> get partnerChildren => source.children;
  bool get loading => source.loading;
  String? get error => source.error;

  /// The log with the fields she does not share cleared.
  PartnerDailyLog? get partnerDailyLog {
    final l = source.dailyLog;
    if (l == null) return null;
    return PartnerDailyLog(
      mood: sharing.shareMood ? l.mood : null,
      symptoms: sharing.shareSymptoms ? l.symptoms : null,
      waterIntake: sharing.shareWater ? l.waterIntake : null,
      logDate: l.logDate,
    );
  }

  static int _int(num v) => v.isNaN ? 0 : v.toInt();

  /// Pregnancy week while she is in `bump` (0 otherwise).
  int getPregnancyWeek() {
    final p = partnerProfile;
    if (p?.lastPeriodDate == null || p!.lifeStage != 'bump') return 0;
    return _int(pu.getPregnancyWeek(p.lastPeriodDate));
  }

  /// Days until the due date (0 without dates).
  int getDaysUntilDue() {
    final p = partnerProfile;
    if (p?.lastPeriodDate == null && p?.dueDate == null) return 0;
    return _int(pu.getDaysUntilDue(p!.lastPeriodDate, p.dueDate));
  }

  /// Baby age in days while she is in `mommy` (0 otherwise).
  int getBabyAgeDays() {
    final p = partnerProfile;
    if (p?.babyBirthDate == null || p!.lifeStage != 'mommy') return 0;
    return pu.getRealCalendarAge(p.babyBirthDate).totalDays;
  }

  /// Cycle phase while she is in `flow` and shares her cycle.
  CyclePhaseInfo? getCyclePhaseInfo() {
    if (!sharing.shareCycle) return null;
    final p = partnerProfile;
    if (p?.lastPeriodDate == null || p!.lifeStage != 'flow') return null;
    final lmp = storedCalendarDate(p.lastPeriodDate) ?? jsDate(p.lastPeriodDate);
    if (lmp == null) return null;
    final cl = p.cycleLength ?? 0;
    final pl = p.periodLength ?? 0;
    return getPhaseInfoForDate(DomainClock.now(), lmp, cl == 0 ? 28 : cl, pl == 0 ? 5 : pl);
  }

  /// Days until her next period (`flow`, shared cycle).
  int getDaysUntilNextPeriod() {
    if (!sharing.shareCycle) return 0;
    final p = partnerProfile;
    if (p?.lastPeriodDate == null || p!.lifeStage != 'flow') return 0;
    final cl = p.cycleLength ?? 0;
    final cycleLength = cl == 0 ? 28 : cl;
    final lmp = storedCalendarDate(p.lastPeriodDate) ?? jsDate(p.lastPeriodDate);
    if (lmp == null) return 0;
    final daysSince = differenceInCalendarDays(DomainClock.now(), lmp);
    final daysIntoCycle = (daysSince % cycleLength + cycleLength) % cycleLength;
    final left = cycleLength - daysIntoCycle;
    return left < 0 ? 0 : left;
  }
}

/// `usePartnerData()`.
final partnerDataProvider = Provider.autoDispose<PartnerData>((ref) {
  final source = ref.watch(partnerDataSourceProvider);
  final sharing = ref.watch(partnerSharedSettingsProvider.select((s) => s.sharing));
  return PartnerData(source: source, sharing: sharing, refetch: () => ref.read(partnerDataSourceProvider.notifier).fetchPartnerData());
});
