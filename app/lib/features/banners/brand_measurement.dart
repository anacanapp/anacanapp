// Ported from: src/lib/ads/brandMeasurement.ts
//
// One account-bound receipt per rendered brand creative; nothing is persisted locally. An impression is
// recorded after one continuous visible second (counted from the server receipt), a click completes even after
// the slot unmounted (SQL re-checks the captured actor).
import 'dart:async';

import '../../core/offline/offline_outbox.dart' show newClientId;

/// supabase-js `{ data, error }`.
typedef BrandRpcResult = ({Object? data, Object? error});
typedef BrandRpc = Future<BrandRpcResult> Function(String name, Map<String, Object?> args);

class BrandExposure {
  BrandExposure({
    required this.rpc,
    required this.actor,
    required this.banner,
    required this.language,
    required this.platform,
    this.version = 2,
    int Function()? now,
    String Function()? newId,
  })  : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch),
        _newId = newId ?? newClientId {
    _id = _newId();
  }

  final BrandRpc rpc;
  final String actor;
  final String banner;
  final String language;
  final String platform;

  /// 2 or 3 (v3 creatives use the v2 receipt RPCs).
  final int version;
  final int Function() _now;
  final String Function() _newId;

  String get _issueRpc => version == 3 ? 'issue_brand_ad_delivery_v2' : 'issue_brand_ad_delivery_v1';
  String get _eventRpc => version == 3 ? 'record_brand_ad_event_v2' : 'record_brand_ad_event_v1';

  late String _id;
  Future<String?>? _pending;
  String? _ticket;
  bool _blocked = false, _visible = false, _disposed = false, _measured = false;
  int _expires = 0, _since = 0;
  Timer? _timer;

  void _clear() {
    _timer?.cancel();
    _timer = null;
  }

  Future<String?> _issue() {
    if (_blocked) return Future<String?>.value();
    final ticket = _ticket;
    if (ticket != null && _expires > _now()) return Future<String?>.value(ticket);
    final pending = _pending;
    if (pending != null) return pending;
    if (ticket != null) {
      _ticket = null;
      _measured = false;
      _id = _newId();
    }
    final exposure = _id;
    final future = () async {
      try {
        final result = await rpc(_issueRpc, {'p_actor': actor, 'p_banner': banner, 'p_exposure': exposure, 'p_platform': platform, 'p_language': language});
        if (result.error != null) return null;
        final data = result.data;
        if (data == null || data == false) {
          _blocked = true;
          return null;
        }
        if (data is! Map) return null;
        final expires = data['expires_at'] is String ? DateTime.tryParse(data['expires_at'] as String) : null;
        if (data['id'] != exposure || expires == null) return null;
        _ticket = exposure;
        _expires = expires.millisecondsSinceEpoch;
        return _ticket;
      } catch (_) {
        return null;
      } finally {
        _pending = null;
      }
    }();
    _pending = future;
    return future;
  }

  Future<void> _schedule() async {
    final issued = await _issue();
    if (issued == null || _disposed || !_visible || _measured) return;
    _clear();
    // Start after the server receipt exists so both the visibility assertion and the server's minimum
    // elapsed-time check pass without trusting the client clock.
    _timer = Timer(const Duration(milliseconds: 1100), () async {
      if (_disposed || !_visible || _measured || _now() - _since < 1000) return;
      BrandRpcResult result;
      try {
        result = await rpc(_eventRpc, {'p_actor': actor, 'p_delivery': issued, 'p_event': 'impression', 'p_visible_ms': (_now() - _since).clamp(0, 3600000)});
      } catch (_) {
        result = (data: false, error: true);
      }
      if (result.error == null && result.data == true) _measured = true;
    });
  }

  void visible(bool value) {
    if (_disposed || value == _visible) return;
    _visible = value;
    _clear();
    _since = value ? _now() : 0;
    if (value && !_measured) unawaited(_schedule());
  }

  /// The delivery id (lead attribution) when the receipt exists.
  Future<String?> click() async {
    final issued = await _issue();
    if (issued == null) return null;
    try {
      await rpc(_eventRpc, {'p_actor': actor, 'p_delivery': issued, 'p_event': 'click', 'p_visible_ms': 0});
    } catch (_) {}
    return issued;
  }

  void dispose() {
    _disposed = true;
    _visible = false;
    _clear();
  }
}
