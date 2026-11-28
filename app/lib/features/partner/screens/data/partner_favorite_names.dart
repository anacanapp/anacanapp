// Ported from: src/hooks/usePartnerFavoriteNames.ts
//
// The linked partner's favourite baby names (read-only), refreshed live once her user id is known: the realtime
// channel is filtered to her rows only, not the whole favorite_names table.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth.dart';
import '../../../tools/names/favorite_names.dart' show FavoriteName;
import '../../data/partner_backend.dart';
import 'screens_backend.dart';

@immutable
class PartnerFavoriteNamesState {
  const PartnerFavoriteNamesState({this.partnerFavorites = const [], this.loading = true});
  final List<FavoriteName> partnerFavorites;
  final bool loading;
}

/// `usePartnerFavoriteNames()`.
final partnerFavoriteNamesProvider =
    NotifierProvider.autoDispose<PartnerFavoriteNamesController, PartnerFavoriteNamesState>(PartnerFavoriteNamesController.new);

class PartnerFavoriteNamesController extends Notifier<PartnerFavoriteNamesState> {
  String? _linked;
  String? _partnerUserId;

  @override
  PartnerFavoriteNamesState build() {
    final linked = _linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
    _partnerUserId = null;
    scheduleMicrotask(() async {
      if (!ref.mounted) return;
      await fetch();
      // Only after her user_id is known: a channel filtered to her rows.
      final partnerUserId = _partnerUserId;
      if (!ref.mounted || linked == null || linked.isEmpty || partnerUserId == null || _linked != linked) return;
      ref.read(partnerBackendProvider).subscribe(ref,
          channelPrefix: 'partner_favorite_names_$linked',
          table: 'favorite_names',
          filter: 'user_id=eq.$partnerUserId',
          onChange: (_) => unawaited(fetch()));
    });
    return const PartnerFavoriteNamesState();
  }

  /// `fetch()` (`refetch`).
  Future<void> fetch() async {
    final linked = _linked;
    if (linked == null || linked.isEmpty) {
      state = const PartnerFavoriteNamesState(loading: false);
      return;
    }
    try {
      final partnerUserId = await ref.read(partnerBackendProvider).profileUserId(linked);
      if (!ref.mounted) return;
      if (partnerUserId == null) {
        state = const PartnerFavoriteNamesState(loading: false);
        return;
      }
      _partnerUserId = partnerUserId;
      final rows = await ref.read(partnerScreensBackendProvider).favoriteNames(partnerUserId);
      if (!ref.mounted) return;
      state = PartnerFavoriteNamesState(partnerFavorites: [for (final r in rows) FavoriteName.fromRow(r)], loading: false);
    } catch (error) {
      debugPrint('Partner favorites fetch error: $error');
      if (ref.mounted) state = PartnerFavoriteNamesState(partnerFavorites: state.partnerFavorites, loading: false);
    }
  }
}
