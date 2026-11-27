// Ported from: src/lib/premium-funnel.ts
//
// Server-side Premium funnel (migration 20261125150000). Two fire-and-forget calls, never awaited, never
// throwing: funnelHit(event, source) → premium_funnel_hit_v1 (anonymous daily counters, no user id);
// purchaseIntent(source, plan) → premium_purchase_intent_v1 (attributes the purchase that follows).

/// 'paywall_shown' | 'paywall_clicked' | 'purchase_started' | 'purchase_cancelled' | 'purchase_failed'
/// | 'purchase_pending' | 'restore_clicked' | 'epoint_started'
typedef FunnelEvent = String;

const List<String> funnelEvents = [
  'paywall_shown', 'paywall_clicked', 'purchase_started', 'purchase_cancelled', //
  'purchase_failed', 'purchase_pending', 'restore_clicked', 'epoint_started',
];
const List<String> _stages = ['flow', 'bump', 'mommy', 'partner'];

/// Same normalisation as public._premium_funnel_source.
String normaliseFunnelSource(Object? source) {
  final raw = (source is String ? source : '').trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_:.-]+'), '_');
  final value = raw.length > 48 ? raw.substring(0, 48) : raw;
  return RegExp(r'^[a-z0-9_:.-]{1,48}$').hasMatch(value) ? value : 'other';
}

/// `supabase.rpc(name, args)` without awaiting; may throw synchronously or fail asynchronously.
typedef FunnelRpc = Future<Object?> Function(String name, Map<String, Object?> args);

class PremiumFunnel {
  PremiumFunnel({required this.rpc, required this.platform, required this.lifeStage, int Function()? now})
      : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final FunnelRpc rpc;

  /// `Capacitor.getPlatform()` (anything but ios/android counts as web).
  final String Function() platform;

  /// `useUserStore.getState().lifeStage`.
  final String? Function() lifeStage;
  final int Function() _now;

  static const int shownGapMs = 10 * 60000;
  static const int otherGapMs = 2000;
  final Map<String, int> _lastSent = {};

  String funnelPlatform() {
    try {
      final p = platform();
      return p == 'ios' || p == 'android' ? p : 'web';
    } catch (_) {
      return 'web';
    }
  }

  String? funnelLifeStage() {
    try {
      final stage = lifeStage();
      return stage != null && _stages.contains(stage) ? stage : null;
    } catch (_) {
      return null;
    }
  }

  bool _due(String key, int gap, int now) {
    final last = _lastSent[key];
    if (last != null && now - last < gap) return false;
    _lastSent[key] = now;
    if (_lastSent.length > 200) _lastSent.removeWhere((_, at) => now - at > shownGapMs);
    return true;
  }

  void _fire(String name, Map<String, Object?> args) {
    try {
      rpc(name, args).then((_) {}, onError: (Object _) {});
    } catch (_) {
      // never block the paywall
    }
  }

  void funnelHit(FunnelEvent event, String? source, [int? now]) {
    try {
      if (!funnelEvents.contains(event)) return;
      final src = normaliseFunnelSource(source);
      if (!_due('$event|$src', event == 'paywall_shown' ? shownGapMs : otherGapMs, now ?? _now())) return;
      _fire('premium_funnel_hit_v1', {'p_event': event, 'p_source': src, 'p_platform': funnelPlatform(), 'p_life_stage': funnelLifeStage()});
    } catch (_) {}
  }

  void purchaseIntent(String? source, String plan, [int? now]) {
    try {
      final src = normaliseFunnelSource(source);
      final value = const ['monthly', 'yearly', 'lifetime', 'offer'].contains(plan) ? plan : 'unknown';
      if (!_due('intent|$src|$value', otherGapMs, now ?? _now())) return;
      _fire('premium_purchase_intent_v1', {'p_source': src, 'p_platform': funnelPlatform(), 'p_plan': value});
    } catch (_) {}
  }

  /// Test helper: forget the client-side throttle.
  void resetFunnelThrottle() => _lastSent.clear();
}
