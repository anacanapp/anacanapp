// Ported from: src/hooks/useCakeCart.ts
//
// Persisted under `cake-cart` (zustand persist without partialize: every JSON field of the state,
// i.e. `{"state":{"items":[…],"totalItems":n,"totalPrice":n},"version":0}`).

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'local_store.dart';
import 'persisted_store.dart';

class CakeCartItem {
  const CakeCartItem({required this.cake, required this.quantity, required this.customFields, this.extraPrice});

  /// The `Cake` row as loaded by useCakes (kept as JSON).
  final Map<String, dynamic> cake;
  final int quantity;
  final Map<String, String> customFields;

  /// Add-ons chosen on the cake page (e.g. the photo box); older saved carts have none.
  final num? extraPrice;

  CakeCartItem copyWith({int? quantity}) =>
      CakeCartItem(cake: cake, quantity: quantity ?? this.quantity, customFields: customFields, extraPrice: extraPrice);

  Map<String, Object?> toJson() => {
        'cake': cake,
        'quantity': quantity,
        'customFields': customFields,
        if (extraPrice != null) 'extraPrice': extraPrice,
      };

  static CakeCartItem? tryParse(Object? value) {
    if (value is! Map || value['cake'] is! Map || value['quantity'] is! num) return null;
    final fields = value['customFields'];
    final extra = value['extraPrice'];
    return CakeCartItem(
      cake: Map<String, dynamic>.from(value['cake'] as Map),
      quantity: (value['quantity'] as num).toInt(),
      customFields: fields is Map ? {for (final e in fields.entries) '${e.key}': '${e.value}'} : const {},
      extraPrice: extra is num ? extra : null,
    );
  }
}

/// JS `Number(x)` for the price column (string or number); NaN → 0 is not JS, but keeps totals finite.
double _number(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value.trim()) ?? (value.trim().isEmpty ? 0 : double.nan);
  if (value == null) return 0;
  return double.nan;
}

/// `cakeUnitPrice(item)`: price of one cake, add-ons included.
double cakeUnitPrice(CakeCartItem item) {
  final extra = _number(item.extraPrice);
  return _number(item.cake['price']) + (extra.isNaN ? 0 : extra);
}

double _sumPrice(List<CakeCartItem> items) => items.fold(0, (sum, i) => sum + cakeUnitPrice(i) * i.quantity);
int _sumItems(List<CakeCartItem> items) => items.fold(0, (sum, i) => sum + i.quantity);

class CakeCartState {
  const CakeCartState({this.items = const [], this.totalItems = 0, this.totalPrice = 0});
  final List<CakeCartItem> items;
  final int totalItems;
  final num totalPrice;
}

const PersistedEnvelope cakeCartEnvelope = PersistedEnvelope(name: 'cake-cart');

/// `useCakeCart`.
final cakeCartProvider = NotifierProvider<CakeCart, CakeCartState>(CakeCart.new);

class CakeCart extends Notifier<CakeCartState> {
  late LocalStore _store;

  @override
  CakeCartState build() {
    _store = ref.watch(localStoreProvider);
    return _hydrate();
  }

  CakeCartState _hydrate() {
    final persisted = cakeCartEnvelope.read(_store).state;
    if (persisted == null) return const CakeCartState();
    final list = persisted['items'];
    final items = list is List ? [for (final i in list) ?CakeCartItem.tryParse(i)] : <CakeCartItem>[];
    final totalItems = persisted['totalItems'], totalPrice = persisted['totalPrice'];
    return CakeCartState(
      items: items,
      totalItems: totalItems is num ? totalItems.toInt() : 0,
      totalPrice: totalPrice is num ? totalPrice : 0,
    );
  }

  void rehydrate() => state = _hydrate();

  void _set(List<CakeCartItem> items) {
    state = CakeCartState(items: List.unmodifiable(items), totalItems: _sumItems(items), totalPrice: _sumPrice(items));
    cakeCartEnvelope.write(_store, {
      'items': [for (final i in items) i.toJson()],
      'totalItems': state.totalItems,
      'totalPrice': state.totalPrice,
    });
  }

  void addToCart(Map<String, dynamic> cake, int quantity, Map<String, String> customFields, [num extraPrice = 0]) =>
      _set([...state.items, CakeCartItem(cake: cake, quantity: quantity, customFields: customFields, extraPrice: extraPrice)]);

  void removeItem(int index) => _set([
        for (var i = 0; i < state.items.length; i++)
          if (i != index) state.items[i],
      ]);

  void updateQuantity(int index, int quantity) {
    if (quantity < 1 || index < 0 || index >= state.items.length) return;
    final items = [...state.items];
    items[index] = items[index].copyWith(quantity: quantity);
    _set(items);
  }

  void clearCart() => _set(const []);
}
