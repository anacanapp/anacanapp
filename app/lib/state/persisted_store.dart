// Ported from: node_modules/zustand v5 middleware/persist.ts (createJSONStorage + persist hydrate/setItem)
// as used by src/store/userStore.ts, childStore.ts, timerStore.ts, src/hooks/useCakeCart.ts.
//
// Envelope `{"state":{…},"version":n}` under the store's `name` in the LocalStore (same key as
// localStorage). Hydration = shallow merge of the persisted state over the initial state; a
// different stored version without a migrate function is ignored (zustand logs an error and keeps
// the initial state); a migrated state is written back at once.

import 'dart:convert';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'local_store.dart';

/// The app's LocalStore. The bootstrap loads it before any store is read.
final localStoreProvider = Provider<LocalStore>((ref) {
  final store = LocalStore(FileLocalStoreBackend(), onWriteError: (_) => debugPrint('[local-store] write failed'));
  ref.onDispose(() => store.dispose());
  return store;
});

typedef PersistMigrate = Map<String, Object?> Function(Object? persistedState, int version);

class PersistedEnvelope {
  const PersistedEnvelope({required this.name, this.version = 0, this.migrate});

  final String name;
  final int version;
  final PersistMigrate? migrate;

  /// The persisted state to merge over the initial one, or null (absent, corrupt, unmigratable).
  /// `migrated` is true when [migrate] ran (the caller then writes the result back).
  ({Map<String, Object?>? state, bool migrated}) read(LocalStore store) {
    final raw = store.getItem(name);
    if (raw == null) return (state: null, migrated: false);
    Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      return (state: null, migrated: false);
    }
    if (decoded is! Map) return (state: null, migrated: false);
    final storedVersion = decoded['version'];
    if (storedVersion is num && storedVersion != version) {
      final m = migrate;
      if (m != null) return (state: m(decoded['state'], storedVersion.toInt()), migrated: true);
      debugPrint("State loaded from storage couldn't be migrated since no migrate function was provided");
      return (state: null, migrated: false);
    }
    final state = decoded['state'];
    return (state: state is Map ? Map<String, Object?>.from(state) : null, migrated: false);
  }

  /// `setItem(name, JSON.stringify({state, version}))`. Never throws (best effort, like the
  /// quota-managed zustand storage).
  void write(LocalStore store, Map<String, Object?> state) {
    try {
      store.setItem(name, jsonEncode({'state': state, 'version': version}));
    } catch (_) {
      debugPrint('[persist] $name could not be written');
    }
  }
}
