// Ported from: src/hooks/useAuth.ts (selectors), src/hooks/useUserBlock.ts (useActiveBlock),
// src/hooks/usePremiumEntitlement.ts (monitor inputs: backend, actor, partner).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show Session, User;

import '../cache/providers.dart';
import '../cache/query_client.dart';
import '../net/backend_client.dart' show BootstrapOpened;
import '../net/backend_providers.dart';
import 'auth_controller.dart';
import 'auth_models.dart';

/// `useAuth().user`.
final authUserProvider = Provider<User?>((ref) => ref.watch(authControllerProvider.select((s) => s.user)));

/// `useAuth().session`.
final authSessionProvider = Provider<Session?>((ref) => ref.watch(authControllerProvider.select((s) => s.session)));

/// `useAuth().profile`.
final authProfileProvider = Provider<Profile?>((ref) => ref.watch(authControllerProvider.select((s) => s.profile)));

final isAdminProvider = Provider<bool>((ref) => ref.watch(authControllerProvider.select((s) => s.isAdmin)));
final isModeratorProvider = Provider<bool>((ref) => ref.watch(authControllerProvider.select((s) => s.isModerator)));

/// `ActiveBlock` (`user_blocks` row of the signed-in user).
class ActiveBlock {
  const ActiveBlock({required this.id, required this.blockType, this.reason, this.expiresAt, required this.createdAt});
  final String id;

  /// 'community' | 'full' | …
  final String blockType;
  final String? reason;
  final String? expiresAt;
  final String createdAt;

  static ActiveBlock fromRow(Map<String, dynamic> row) => ActiveBlock(
        id: row['id'] as String,
        blockType: row['block_type'] as String? ?? '',
        reason: row['reason'] as String?,
        expiresAt: row['expires_at'] as String?,
        createdAt: row['created_at'] as String? ?? '',
      );
}

/// The active block among [rows] (`full` wins over others; expired ones ignored).
ActiveBlock? pickActiveBlock(List<Map<String, dynamic>> rows, {DateTime? now}) {
  final t = (now ?? DateTime.now()).millisecondsSinceEpoch;
  bool live(Map<String, dynamic> b) {
    final expires = b['expires_at'];
    if (expires == null) return true;
    final at = DateTime.tryParse('$expires');
    return at == null ? false : at.millisecondsSinceEpoch > t;
  }

  final active = rows.where(live).firstOrNull;
  final full = rows.where((b) => b['block_type'] == 'full' && live(b)).firstOrNull;
  final chosen = full ?? active;
  return chosen == null ? null : ActiveBlock.fromRow(chosen);
}

/// `useActiveBlock()`: queryKey `['my-active-block', userId]`, staleTime 60 s, fail-open.
final activeBlockQuery = queryProvider<ActiveBlock?>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions<ActiveBlock?>(
    queryKey: ['my-active-block', userId],
    enabled: userId != null,
    staleTime: const Duration(seconds: 60),
    refetchOnWindowFocus: RefetchOn.ifStale,
    queryFn: (_) async {
      try {
        final rows = await ref
            .read(supabaseClientProvider)
            .from('user_blocks')
            .select('id, block_type, reason, expires_at, created_at')
            .eq('user_id', userId!)
            .eq('is_active', true)
            .order('created_at', ascending: false);
        return pickActiveBlock(rows);
      } catch (_) {
        // Table unavailable: never count the user as blocked (fail-open).
        return null;
      }
    },
  );
}, name: 'activeBlockQuery');

/// Inputs of the premium entitlement query/monitor: `['premium-access-v1', backend, actor, partner]`.
class PremiumEntitlementInputs {
  const PremiumEntitlementInputs({required this.backend, this.actor, this.partner});
  final String backend;
  final String? actor;
  final String? partner;

  List<Object?> get queryKey => ['premium-access-v1', backend, actor, partner];

  @override
  bool operator ==(Object other) =>
      other is PremiumEntitlementInputs && other.backend == backend && other.actor == actor && other.partner == partner;
  @override
  int get hashCode => Object.hash(backend, actor, partner);
}

final premiumEntitlementInputsProvider = Provider<PremiumEntitlementInputs>((ref) {
  final result = ref.watch(backendBootstrapProvider).value;
  final backend = result is BootstrapOpened ? result.backend.url : '';
  final state = ref.watch(authControllerProvider);
  final actor = state.user?.id;
  final profile = state.profile;
  final partner = profile != null && profile.userId == actor ? profile.linkedPartnerId : null;
  return PremiumEntitlementInputs(backend: backend, actor: actor, partner: partner);
});
