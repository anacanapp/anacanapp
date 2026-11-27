// Ported from: src/hooks/useBabyInsight.ts
//
// Per-tracker AI insight (Edge Function `baby-insight`), requested only when the user taps a tracker's button.
// The hook's state machine is a [ChangeNotifier]: the owning widget keeps one [BabyInsightController] and calls
// [BabyInsightController.update] on every build (a re-render); results that arrive after the scope
// (backend, user, child, language) changed are dropped. Results are cached on the device under
// `anacan-baby-insight-v2:<scope>:<section>` (cleared on logout by OfflineCache.clearAllCaches).
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../../domain/js_compat.dart';
import '../../../state/local_store.dart';
import '../data/baby_repository.dart';

/// 'sleep' | 'feeding' | 'diaper'.
const List<String> insightSections = ['sleep', 'feeding', 'diaper'];

const Map<String, List<String>> _fields = {
  'sleep': ['sleepMinutes', 'sleepCount'],
  'feeding': ['feedingCount', 'breastCount', 'formulaCount', 'formulaMl', 'solidCount'],
  'diaper': ['diaperCount', 'wetCount', 'dirtyCount', 'mixedCount'],
};

/// `BabyInsightStats`.
class BabyInsightStats {
  const BabyInsightStats({
    required this.sleepMinutes,
    required this.sleepCount,
    required this.feedingCount,
    required this.breastCount,
    required this.formulaCount,
    required this.formulaMl,
    required this.solidCount,
    required this.diaperCount,
    required this.wetCount,
    required this.dirtyCount,
    required this.mixedCount,
  });
  final num sleepMinutes, sleepCount, feedingCount, breastCount, formulaCount, formulaMl, solidCount;
  final num diaperCount, wetCount, dirtyCount, mixedCount;

  Map<String, num> toMap() => {
        'sleepMinutes': sleepMinutes,
        'sleepCount': sleepCount,
        'feedingCount': feedingCount,
        'breastCount': breastCount,
        'formulaCount': formulaCount,
        'formulaMl': formulaMl,
        'solidCount': solidCount,
        'diaperCount': diaperCount,
        'wetCount': wetCount,
        'dirtyCount': dirtyCount,
        'mixedCount': mixedCount,
      };

  BabyInsightStats copyWith({num? sleepMinutes, num? feedingCount}) => BabyInsightStats(
        sleepMinutes: sleepMinutes ?? this.sleepMinutes,
        sleepCount: sleepCount,
        feedingCount: feedingCount ?? this.feedingCount,
        breastCount: breastCount,
        formulaCount: formulaCount,
        formulaMl: formulaMl,
        solidCount: solidCount,
        diaperCount: diaperCount,
        wetCount: wetCount,
        dirtyCount: dirtyCount,
        mixedCount: mixedCount,
      );
}

/// `BabyInsightChild`.
class BabyInsightChild {
  const BabyInsightChild({required this.id, required this.ageMonths, required this.ageDays, this.gender});
  final String id;
  final int ageMonths;
  final int ageDays;
  final String? gender;
}

/// `SectionInsight` (`status`: normal | low | high | watch).
class SectionInsight {
  const SectionInsight(this.status, this.note);
  final String status;
  final String note;
  Map<String, String> toJson() => {'status': status, 'note': note};

  static SectionInsight? tryParse(Object? v) {
    if (v is! Map) return null;
    final status = v['status'], note = v['note'];
    if (status is! String || !const ['normal', 'low', 'high', 'watch'].contains(status)) return null;
    if (note is! String || note.trim().isEmpty || note.length > 1000) return null;
    return SectionInsight(status, note);
  }
}

/// Section state + `stale` + `request()`.
class SectionInsightState {
  const SectionInsightState({this.insight, this.hash, this.loading = false, this.error = false, this.limitReached = false, this.stale = false});
  final SectionInsight? insight;
  final String? hash;
  final bool loading;
  final bool error;
  final bool limitReached;
  final bool stale;

  SectionInsightState copyWith({SectionInsight? insight, String? hash, bool? loading, bool? error, bool? limitReached}) =>
      SectionInsightState(
        insight: insight ?? this.insight,
        hash: hash ?? this.hash,
        loading: loading ?? this.loading,
        error: error ?? this.error,
        limitReached: limitReached ?? this.limitReached,
      );
}

/// Inputs that change the scope.
class BabyInsightScope {
  const BabyInsightScope({required this.backend, this.userId, required this.language});
  final String backend;
  final String? userId;
  final String language;
}

typedef PeekRemaining = Future<({num remaining, num limit})> Function(String feature);

class BabyInsightController extends ChangeNotifier {
  BabyInsightController({required this.store, required this.repository, required this.peekRemainingDaily});

  final LocalStore store;
  final BabyRepository repository;
  PeekRemaining peekRemainingDaily;

  BabyInsightStats? _stats;
  BabyInsightChild? _child;
  String _language = 'az';
  String? _scope;
  String? _stateScope;
  bool _initialized = false;
  bool _alive = true;
  final Set<String> _pending = <String>{};
  Map<String, SectionInsightState> _state = _fresh();

  static Map<String, SectionInsightState> _fresh() => {for (final s in insightSections) s: const SectionInsightState()};

  String? get scope => _scope;

  /// Re-render with the latest props (stats may be null while no child is known).
  void update(BabyInsightStats? stats, BabyInsightChild? child, BabyInsightScope scope) {
    _stats = stats;
    _child = child;
    _language = scope.language;
    final next = scope.userId != null && child != null ? jsonEncode([scope.backend, scope.userId, child.id, scope.language]) : null;
    if (!_initialized || next != _scope) {
      _initialized = true;
      _scope = next;
      _loadScope(next);
    }
  }

  void _loadScope(String? scope) {
    final next = _fresh();
    if (scope != null) {
      for (final section in insightSections) {
        try {
          final raw = store.getItem('anacan-baby-insight-v2:$scope:$section');
          if (raw == null) continue;
          final stored = jsonDecode(raw);
          final insight = stored is Map ? SectionInsight.tryParse(stored['insight']) : null;
          if (insight != null && stored['hash'] is String) {
            next[section] = SectionInsightState(hash: stored['hash'] as String, insight: insight);
          }
        } catch (_) {
          // optional private cache
        }
      }
    }
    _stateScope = scope;
    _state = next;
  }

  Map<String, Object?>? _selectedStats(String section) {
    final stats = _stats;
    if (stats == null) return null;
    final map = stats.toMap();
    return {for (final k in _fields[section]!) k: map[k], 'localHour': DomainClock.now().hour};
  }

  String _hashFor(String section) => jsonEncode([
        _scope,
        formatYmd(DomainClock.now()),
        _child?.ageMonths,
        _child?.ageDays,
        _child?.gender,
        _selectedStats(section),
      ]);

  /// The section as the widget sees it (`stale` computed now).
  SectionInsightState section(String section) {
    if (_stateScope != _scope) return const SectionInsightState();
    final s = _state[section]!;
    final stale = s.insight != null && s.hash != _hashFor(section);
    return SectionInsightState(
      insight: s.insight,
      hash: s.hash,
      loading: s.loading,
      error: s.error,
      limitReached: s.limitReached,
      stale: stale,
    );
  }

  /// `request(section)`.
  Future<void> request(String section) async {
    final scope = _scope, stats = _stats, child = _child;
    if (scope == null || stats == null || child == null) return;
    final lock = '$scope:$section';
    final hash = _hashFor(section);
    final current = _state[section]!;
    if (_pending.contains(lock) || (current.hash == hash && current.insight != null)) return;
    _pending.add(lock);
    void patch(SectionInsightState Function(SectionInsightState s) f) {
      if (_alive && _scope == scope) {
        _state = {..._state, section: f(_state[section]!)};
        notifyListeners();
      }
    }

    patch((s) => SectionInsightState(insight: s.insight, hash: s.hash, loading: true));
    try {
      final peek = await peekRemainingDaily('baby_insight');
      if (peek.remaining <= 0) {
        patch((s) => s.copyWith(limitReached: true));
        return;
      }
      if (_scope != scope) return;
      final res = await repository.invokeBabyInsight({
        'section': section,
        'language': _language,
        'child': {'ageMonths': child.ageMonths, 'ageDays': child.ageDays, 'gender': child.gender},
        'stats': _selectedStats(section),
      });
      final data = res.error == null && res.data is Map ? res.data as Map : null;
      if ((res.error != null && res.status == 429) || data?['error'] == 'daily_limit_exceeded') {
        patch((s) => s.copyWith(limitReached: true));
        return;
      }
      final insightMap = data?['insight'];
      final insight = insightMap is Map ? SectionInsight.tryParse(insightMap[section]) : null;
      if (res.error != null || data?['success'] != true || insight == null) throw StateError('BABY_INSIGHT_UNAVAILABLE');
      if (_scope != scope || !_alive) return;
      patch((s) => s.copyWith(insight: insight, hash: hash));
      try {
        store.setItem('anacan-baby-insight-v2:$scope:$section', jsonEncode({'hash': hash, 'insight': insight.toJson()}));
      } catch (_) {}
    } catch (_) {
      patch((s) => s.copyWith(error: true));
    } finally {
      _pending.remove(lock);
      patch((s) => s.copyWith(loading: false));
    }
  }

  @override
  void dispose() {
    _alive = false;
    super.dispose();
  }
}
