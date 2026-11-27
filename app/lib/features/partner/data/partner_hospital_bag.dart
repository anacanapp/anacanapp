// Ported from: src/hooks/usePartnerHospitalBag.ts
//
// The linked mother's hospital bag as seen and edited by the partner, updated live (the tools feature's
// useHospitalBagSync port with role 'partner').
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../tools/hospital_bag/hospital_bag_logic.dart' show BagCategory, BagItem;
import '../../tools/hospital_bag/hospital_bag_sync.dart';
import 'partner_backend.dart';

/// The linked profile's `user_id` (`profiles.select('user_id').eq('id', linked_partner_id).single()`), null when not
/// linked or not readable. Loading = the AsyncValue is loading (`resolving`).
final linkedPartnerUserIdProvider = FutureProvider.autoDispose<String?>((ref) async {
  final signedIn = ref.watch(authUserProvider.select((u) => u != null));
  final linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
  if (!signedIn || linked == null || linked.isEmpty) return null;
  return ref.read(partnerBackendProvider).profileUserId(linked);
});

/// `PartnerHospitalBagItem`: 'partner' items are reported as 'mom' so the three-tab partner screen lists them;
/// [bagCategory] keeps the real group.
@immutable
class PartnerHospitalBagItem {
  const PartnerHospitalBagItem(this.item);
  final BagItem item;

  /// 'mom' | 'baby' | 'documents'.
  BagCategory get category => item.category == 'partner' ? 'mom' : item.category;
  BagCategory get bagCategory => item.category;
}

@immutable
class PartnerHospitalBag {
  const PartnerHospitalBag({
    required this.items,
    required this.hiddenItems,
    required this.loading,
    required this.checkedCount,
    required this.totalCount,
    required this.progress,
    this.controller,
  });
  final List<PartnerHospitalBagItem> items;

  /// Hidden default items, so the partner can show them again.
  final List<PartnerHospitalBagItem> hiddenItems;
  final bool loading;
  final int checkedCount;
  final int totalCount;

  /// `getProgress()` (0–100).
  final double progress;

  /// toggleItem / addItem / deleteItem / setHidden / fetch (null while the mother's id is unknown).
  final HospitalBagController? controller;
}

/// `usePartnerHospitalBag()`.
final partnerHospitalBagProvider = Provider.autoDispose<PartnerHospitalBag>((ref) {
  final resolved = ref.watch(linkedPartnerUserIdProvider);
  final resolving = resolved.isLoading;
  final owner = resolved.value;
  final args = (owner: resolving ? null : owner, role: 'partner');
  final bag = ref.watch(hospitalBagSyncProvider(args));
  final items = bag.items;
  return PartnerHospitalBag(
    items: [for (final i in items) if (!i.hidden) PartnerHospitalBagItem(i)],
    hiddenItems: [for (final i in items) if (i.hidden) PartnerHospitalBagItem(i)],
    loading: resolving || (owner != null && bag.loading),
    checkedCount: bag.counts.checked,
    totalCount: bag.counts.total,
    progress: bag.counts.progress,
    controller: owner == null ? null : ref.read(hospitalBagSyncProvider(args).notifier),
  );
});
