// Ported from: src/components/CustomerIoSession.tsx, the CUSTOMER_IO_CONSENT_EVENT of src/lib/customerio.ts
//
// Mounted after admission/session restoration. Identifies the signed-in account with Customer.io only after its
// `user_preferences.privacy_share_analytics` is loaded and true; a live opt-out (Settings → Privacy) clears the
// identity at once and an older in-flight preference read cannot undo it.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/data/data.dart';
import '../../state/shell_bindings.dart' show backendUrlProvider;
import '../../state/user_store.dart';
import 'customerio.dart';

/// `{ userId, backend, allowed }` of the consent event.
typedef CustomerIoConsentChange = ({String userId, String backend, bool allowed});

/// `window` event bus for `anacan:analytics-consent-changed`.
class CustomerIoConsentEvents {
  final StreamController<CustomerIoConsentChange> _controller = StreamController<CustomerIoConsentChange>.broadcast(sync: true);
  Stream<CustomerIoConsentChange> get stream => _controller.stream;
  void dispatch(CustomerIoConsentChange change) => _controller.add(change);
}

final customerIoConsentEventsProvider = Provider<CustomerIoConsentEvents>((ref) => CustomerIoConsentEvents());

/// The settings feature's `analyticsConsentNotifierProvider` value: dispatches the event for the current backend.
/// App root: `analyticsConsentNotifierProvider.overrideWith(customerIoConsentNotifier)`.
void Function({required String userId, required bool allowed}) customerIoConsentNotifier(Ref ref) =>
    ({required userId, required allowed}) =>
        ref.read(customerIoConsentEventsProvider).dispatch((userId: userId, backend: ref.read(backendUrlProvider), allowed: allowed));

/// `supabase.from('user_preferences').select('privacy_share_analytics').eq('user_id', id).maybeSingle()` → true
/// only for an explicit `true`; throws on a read error.
final customerIoPreferenceReaderProvider = Provider<Future<bool> Function(String userId)>((ref) => (userId) async {
      try {
        final row = await ref.read(dbProvider).from('user_preferences').select('privacy_share_analytics').eq('user_id', userId).maybeSingle();
        return row?['privacy_share_analytics'] == true;
      } catch (_) {
        throw StateError('CUSTOMERIO_CONSENT_UNAVAILABLE');
      }
    });

/// The inputs of the session (overridable in tests).
typedef CustomerIoSessionInputs = ({String? userId, String backend, String language});

final customerIoSessionInputsProvider = Provider<CustomerIoSessionInputs>((ref) => (
      userId: ref.watch(authUserProvider.select((u) => u?.id)),
      backend: ref.watch(backendUrlProvider),
      language: ref.watch(userStoreProvider.select((s) => s.language)),
    ));

List<Object?> customerIoConsentKey(String backend, String? userId) => ['customerio-consent', backend, userId];

final customerIoConsentQuery = queryProvider<bool>((ref) {
  final inputs = ref.watch(customerIoSessionInputsProvider);
  final enabled = ref.watch(customerIoConfigProvider) != null;
  final userId = inputs.userId;
  return QueryOptions<bool>(
    queryKey: customerIoConsentKey(inputs.backend, userId),
    enabled: enabled && userId != null,
    meta: const {'persist': false},
    staleTime: const Duration(seconds: 30),
    retry: retryTimes(1),
    queryFn: (_) => ref.read(customerIoPreferenceReaderProvider)(userId!),
  );
}, name: 'customerIoConsentQuery');

/// `<CustomerIoSession/>` (renders nothing).
class CustomerIoSessionHost extends ConsumerStatefulWidget {
  const CustomerIoSessionHost({super.key});
  @override
  ConsumerState<CustomerIoSessionHost> createState() => _CustomerIoSessionHostState();
}

class _CustomerIoSessionHostState extends ConsumerState<CustomerIoSessionHost> {
  late final CustomerIoTracking _tracker = ref.read(customerIoProvider);
  StreamSubscription<CustomerIoConsentChange>? _events;
  Object? _applied = const Object();

  @override
  void initState() {
    super.initState();
    _events = ref.read(customerIoConsentEventsProvider).stream.listen(_changed);
  }

  void _changed(CustomerIoConsentChange detail) {
    final inputs = ref.read(customerIoSessionInputsProvider);
    final userId = inputs.userId;
    if (detail.userId != userId || detail.backend != inputs.backend) return;
    if (!detail.allowed) unawaited(_tracker.setIdentity(null));
    final key = customerIoConsentKey(inputs.backend, userId);
    final client = ref.read(queryClientProvider);
    // An older in-flight preference read must not undo an explicit opt-out.
    unawaited(client.cancelQueries(QueryFilters(queryKey: key, exact: true)).then((_) => client.setQueryDataValue(key, detail.allowed)));
  }

  @override
  void dispose() {
    unawaited(_events?.cancel());
    unawaited(_tracker.setIdentity(null));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inputs = ref.watch(customerIoSessionInputsProvider);
    final allowed = ref.watch(customerIoConsentQuery).data;
    final userId = inputs.userId;
    final identity = userId != null && allowed == true
        ? CustomerIoIdentity(userId: userId, backend: inputs.backend, language: inputs.language, consent: true)
        : null;
    if (identity != _applied) {
      _applied = identity;
      unawaited(_tracker.setIdentity(identity));
    }
    return const SizedBox.shrink();
  }
}
