// Ported from: src/hooks/useShoppingItems.ts, src/hooks/useDefaultShoppingItems.ts (useDefaultShoppingItems)
//
// The shared shopping list (rows of the user or shared with them as partner, live updates on both columns), the
// once-a-day push to the partner when an item is added, and the platform's recommended items for the stage.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/data/data.dart' show Row, Rows, mapRowsTranslation;
import '../../../core/i18n/tr.dart';
import '../../../domain/dates/local_date.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/user_store.dart';
import '../../chat/data/chat_push.dart' show SendPushPayload, chatPushSenderProvider;
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';

@immutable
class ShoppingState {
  const ShoppingState({this.items = const [], this.loading = true});
  final Rows items;
  final bool loading;

  int get uncheckedCount => items.where((i) => i['is_checked'] != true).length;
  int get checkedCount => items.where((i) => i['is_checked'] == true).length;
}

final shoppingItemsProvider = NotifierProvider.autoDispose<ShoppingItemsController, ShoppingState>(ShoppingItemsController.new);

class ShoppingItemsController extends Notifier<ShoppingState> {
  String? _userId;

  @override
  ShoppingState build() {
    final userId = ref.watch(healthUserIdProvider);
    _userId = userId;
    if (userId != null) {
      Future.microtask(fetchItems);
      // The list is shared by user_id OR partner_id (RLS uses the same OR): one handler per column, so changes are
      // only broadcast to this couple.
      final rt = ref.read(healthRealtimeProvider);
      void changed() {
        if (ref.mounted) unawaited(fetchItems());
      }

      rt.subscribe(ref, channelPrefix: 'shopping_items_changes', table: 'shopping_items', filter: 'user_id=eq.$userId', onChange: changed);
      rt.subscribe(ref, channelPrefix: 'shopping_items_changes', table: 'shopping_items', filter: 'partner_id=eq.$userId', onChange: changed);
    }
    return const ShoppingState();
  }

  Future<void> fetchItems() async {
    if (_userId == null || !ref.mounted) return;
    try {
      // Naturally small (the user's + the partner's list); a safety cap against years of unchecked items.
      final data = await ref.read(healthDbProvider).select(const HQuery('shopping_items', order: [(column: 'created_at', ascending: false)], limit: 300));
      if (ref.mounted) state = ShoppingState(items: data, loading: false);
    } catch (_) {
      if (ref.mounted) state = ShoppingState(items: state.items, loading: false);
    }
  }

  /// `addItem({name, quantity, priority})`: `{data, error}`.
  Future<({Row? data, Object? error})> addItem({required String name, int? quantity, String? priority}) async {
    final userId = _userId;
    if (userId == null) return (data: null, error: 'No user logged in');
    try {
      final profile = ref.read(authProfileProvider);
      final isPartner = profile?.lifeStage == 'partner';
      final db = ref.read(healthDbProvider);
      String? partnerUserId;
      final linked = profile?.linkedPartnerId;
      if (linked != null && linked.isNotEmpty) {
        try {
          final partner = await db.maybeSingle(HQuery('profiles', columns: 'user_id', filters: [eqF('id', linked)]));
          partnerUserId = partner?['user_id'] as String?;
        } catch (_) {
          partnerUserId = null;
        }
      }
      final data = await db.insert('shopping_items', {
        'name': name,
        'quantity': quantity == null || quantity == 0 ? 1 : quantity,
        'priority': priority ?? 'medium',
        'user_id': userId,
        'partner_id': partnerUserId,
        'added_by': isPartner ? 'partner' : 'woman',
      });
      // Push to the partner (max 1 a day), bound to the inserted row.
      if (partnerUserId != null) await _notifyPartner(partnerUserId, '${data['name']}', '${data['id']}');
      await fetchItems();
      return (data: data, error: null);
    } catch (error) {
      return (data: null, error: error);
    }
  }

  Future<void> _notifyPartner(String partnerUserId, String itemName, String interactionId) async {
    try {
      final store = ref.read(localStoreProvider);
      final key = 'shopping_notif_${todayKey()}';
      if ((store.getItem(key) ?? '').isNotEmpty) return; // already notified today
      final profileName = ref.read(authProfileProvider)?.name ?? '';
      final adder = profileName.isNotEmpty ? profileName : 'Partnyorun';
      await ref.read(chatPushSenderProvider).send(SendPushPayload(
            userId: partnerUserId,
            title: tr('useshoppingitems_alisveris_siyahisina_elave_5d9c87', '🛒 Alışveriş siyahısına əlavə'),
            body: '$adder "$itemName" ${tr('useshoppingitems_elave_etdi_siyahini_yoxla', 'əlavə etdi. Siyahını yoxla!')}',
            data: {'type': 'shopping_list', 'context': 'partner', 'interactionId': interactionId},
            kind: 'shopping_list',
          ));
      store.setItem(key, '1');
    } catch (_) {
      // a failed push never blocks the item
    }
  }

  Future<void> toggleItem(String id) async {
    final item = state.items.where((i) => i['id'] == id).firstOrNull;
    if (item == null) return;
    try {
      await ref.read(healthDbProvider).update('shopping_items', {'is_checked': item['is_checked'] != true}, [eqF('id', id)]);
      await fetchItems();
    } catch (_) {}
  }

  Future<void> deleteItem(String id) async {
    try {
      await ref.read(healthDbProvider).delete('shopping_items', [eqF('id', id)]);
      await fetchItems();
    } catch (_) {}
  }
}

/// `useDefaultShoppingItems()`: active recommendations for the profile's stage (or `all`), translated.
final defaultShoppingItemsProvider = FutureProvider.autoDispose<Rows>((ref) async {
  final lifeStage = ref.watch(authProfileProvider.select((p) => p?.lifeStage));
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  try {
    final data = await ref.read(healthDbProvider).select(const HQuery('default_shopping_items',
        filters: [(column: 'is_active', op: 'eq', value: true)], order: [(column: 'sort_order', ascending: true)]));
    final mapped = mapRowsTranslation(data, language, const ['name']);
    if (lifeStage == null || lifeStage.isEmpty) return mapped;
    return mapped.where((i) => i['life_stage'] == 'all' || i['life_stage'] == lifeStage).toList();
  } catch (_) {
    return <Row>[];
  }
});
