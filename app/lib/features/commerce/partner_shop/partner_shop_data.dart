// Ported from: src/hooks/usePartnerShop.ts
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../commerce_backend.dart';
import 'partner_shop.dart';

const Map<String, Object?> _emptyRaw = {'partners': <Object?>[], 'products': <Object?>[]};

/// Partner products the server lets this user see (shop_storefront_v1): live partners for everyone,
/// admin_only/paused partners for admins and the partner's own members. Missing RPC → empty storefront.
/// The cached value is the plain RPC JSON (persistable); the [Storefront] is built in [partnerStorefrontProvider].
/// 'v2' in the key drops caches written by the earlier Map-valued version.
final partnerStorefrontRawQuery = queryProvider<Object?>((ref) {
  final uid = ref.watch(authUserProvider.select((u) => u?.id));
  return QueryOptions<Object?>(
    queryKey: ['partner-storefront', 'v2', ref.watch(commerceBackendUrlProvider), uid],
    enabled: uid != null,
    staleTime: const Duration(minutes: 5),
    queryFn: (_) async {
      final res = await ref.read(commerceBackendProvider).rpc('shop_storefront_v1');
      return res.error != null ? _emptyRaw : (res.data ?? _emptyRaw);
    },
  );
}, name: 'partnerStorefrontRawQuery');

/// `usePartnerStorefront()` (`select: storefrontFromRpc`).
class StorefrontView {
  const StorefrontView({this.data, this.isLoading = false});
  final Storefront? data;
  final bool isLoading;
}

final partnerStorefrontProvider = Provider.autoDispose<StorefrontView>((ref) {
  final q = ref.watch(partnerStorefrontRawQuery);
  return StorefrontView(data: q.data == null ? null : storefrontFromRpc(q.data), isLoading: q.isLoading);
}, name: 'partnerStorefrontProvider');

/// Measurements for the partner panel. Impressions are batched (the server also dedups them per day).
class ShopTracker {
  ShopTracker(this._backend);
  final CommerceBackend Function() _backend;
  final Map<String, Set<String>> _pending = {};
  Timer? _timer;

  void _send(List<String> ids, String event, String placement) {
    if (ids.isEmpty) return;
    try {
      unawaited(
        _backend()
            .rpc('shop_partner_track_v1', {'p_products': ids.length > 60 ? ids.sublist(0, 60) : ids, 'p_event': event, 'p_placement': placement})
            .then((_) {}, onError: (Object _) {}),
      );
    } catch (_) {
      // never blocks
    }
  }

  void impressions(List<String> ids, String placement) {
    if (ids.isEmpty) return;
    (_pending[placement] ??= <String>{}).addAll(ids);
    if (_timer != null) return;
    _timer = Timer(const Duration(milliseconds: 1500), () {
      _timer = null;
      _pending.forEach((place, s) => _send(s.toList(), 'impression', place));
      _pending.clear();
    });
  }

  /// 'open' | 'add' | 'site' | 'bundle'.
  void event(List<String> ids, String event, String placement) => _send(ids, event, placement);

  /// Outbound visit to a partner's site: records the 'site' event, registers a click token for sales tracking
  /// (the partner's Anacan SDK reports the order with it) and returns the link to open. Opening is not delayed by
  /// the registration.
  String visitLink(String productId, String url, String placement, String campaign) {
    final click = newClickToken();
    _send([productId], 'site', placement);
    try {
      unawaited(
        _backend().rpc('shop_partner_click_v1', {'p_product': productId, 'p_token': click, 'p_placement': placement}).then((_) {}, onError: (Object _) {}),
      );
    } catch (_) {}
    return partnerLink(url, campaign, click);
  }

  void dispose() => _timer?.cancel();
}

final shopTrackerProvider = Provider<ShopTracker>((ref) {
  final tracker = ShopTracker(() => ref.read(commerceBackendProvider));
  ref.onDispose(tracker.dispose);
  return tracker;
});

/* Basket: kept on the device (phase 1 checks out on the partner's site, nothing is ordered through Anacan yet). */
const String kPartnerBasketKey = 'anacan_partner_basket_v1';
const String kLegacyOliviaBasketKey = 'anacan_olivia_basket_v1';

class PartnerBasket extends Notifier<Map<String, int>> {
  late LocalStore _store;

  @override
  Map<String, int> build() {
    _store = ref.watch(localStoreProvider);
    try {
      final raw = _store.readJson(kPartnerBasketKey) ?? _store.readJson(kLegacyOliviaBasketKey);
      if (raw is Map) {
        return {
          for (final e in raw.entries)
            if (e.value is num) '${e.key}': (e.value as num).toInt(),
        };
      }
    } catch (_) {}
    return const {};
  }

  void _set(Map<String, int> next) {
    state = Map.unmodifiable(next);
    try {
      _store.writeJson(kPartnerBasketKey, next);
      _store.removeItem(kLegacyOliviaBasketKey);
    } catch (_) {}
  }

  int get count => state.values.fold(0, (a, b) => a + b);
  int qty(String id) => state[id] ?? 0;

  void set(String id, num n) {
    final next = {...state};
    final q = n.round().clamp(0, 20);
    if (q != 0) {
      next[id] = q;
    } else {
      next.remove(id);
    }
    _set(next);
  }

  void addMany(List<String> ids) {
    final next = {...state};
    for (final id in ids) {
      if ((next[id] ?? 0) == 0) next[id] = 1;
    }
    _set(next);
  }

  void clear() => _set(const {});
}

final partnerBasketProvider = NotifierProvider<PartnerBasket, Map<String, int>>(PartnerBasket.new);

/// Which collection the shop opens on, set by a home promo right before it navigates to the shop
/// (`requestShopCollection` / `takeShopCollection`).
class ShopCollectionHandoff {
  ShopCollection? _pending;
  void request(ShopCollection? c) => _pending = c;
  ShopCollection? take() {
    final c = _pending;
    _pending = null;
    return c;
  }
}

final shopCollectionHandoffProvider = Provider<ShopCollectionHandoff>((ref) => ShopCollectionHandoff());
