// Ported from: src/lib/session-persistence.ts
//
// Native session backup in the Capacitor Preferences store, byte-compatible with the
// Capacitor app so an upgrade keeps users signed in and a rollback finds the session:
//
//   anacan.auth.session.v2:<encodeURIComponent(realm)> = {"realm":<realm>,"session":{"access_token":…,"refresh_token":…}}
//   … same key with "session":null                       = logout tombstone (blocks the v1 fallback)
//   anacan.auth.session.v1                                = {"access_token":…,"refresh_token":…} (Source realm only)
//   anacan.auth.adoption.v1:<encodeURIComponent(https://api.anacan.az)>
//                                                         = {"schema":"anacan-auth-adoption-v1","state":"pending"|"complete","handoff":<sha256>,"userId":<uuid|null>}
//
// React monkey-patches `supabase.auth.signOut`; Dart cannot, so every caller signs out
// through [NativeSessionPersistence.signOut].

import 'dart:async';
import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart' show AuthApiException, AuthRetryableFetchException;

import '../admission/backend_admission.dart';
import '../admission/backend_config.dart';
import '../storage/js_compat.dart';
import '../storage/key_value_store.dart';
import 'auth_gateway.dart';
import 'auth_storage_key.dart';

const String legacySessionBackupKey = 'anacan.auth.session.v1';

String sessionBackupKey(String realm) => 'anacan.auth.session.v2:${encodeUriComponent(realm)}';

final String adoptionReceiptKey = 'anacan.auth.adoption.v1:${encodeUriComponent(azureApiOrigin)}';

const String adoptionSchema = 'anacan-auth-adoption-v1';

const Set<String> terminalAuthCodes = {
  'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found',
  'session_expired', 'user_banned', 'user_not_found',
};

/// `{access_token, refresh_token}`: the only part of a session the backup keeps.
class PersistedSession {
  const PersistedSession({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  Map<String, String> toJson() => {'access_token': accessToken, 'refresh_token': refreshToken};

  @override
  bool operator ==(Object other) =>
      other is PersistedSession && other.accessToken == accessToken && other.refreshToken == refreshToken;

  @override
  int get hashCode => Object.hash(accessToken, refreshToken);
}

class NativeSessionRecoveryPendingException implements Exception {
  const NativeSessionRecoveryPendingException();

  @override
  String toString() => 'NATIVE_SESSION_RECOVERY_PENDING';
}

/// A non-empty access/refresh token pair from an SDK session or a decoded backup.
PersistedSession? tokenPairFromView(AuthSessionView? session) {
  final access = session?.accessToken, refresh = session?.refreshToken;
  return access != null && access.isNotEmpty && refresh != null && refresh.isNotEmpty
      ? PersistedSession(accessToken: access, refreshToken: refresh)
      : null;
}

PersistedSession? tokenPairFromJson(Object? value) {
  if (value is! Map) return null;
  final access = value['access_token'], refresh = value['refresh_token'];
  return access is String && access.isNotEmpty && refresh is String && refresh.isNotEmpty
      ? PersistedSession(accessToken: access, refreshToken: refresh)
      : null;
}

/// Only a real Auth rejection of the grant ends the session.
bool isTerminalAuthError(Object? error) {
  if (error is AuthRetryableFetchException) return false;
  // Code-less AuthSessionMissingException also occurs for malformed success responses.
  // Retained candidates still require a successful server refresh before recovery.
  return error is AuthApiException &&
      const ['400', '401', '403', '404', '422'].contains(error.statusCode) &&
      terminalAuthCodes.contains(error.code ?? '');
}

/// Observes the backup value Flutter has written or is about to consume, so the
/// SDK-side store can tell its own last state from one another build wrote.
typedef BackupObserver = Future<void> Function(String? rawBackup);

/// Native session backup, restore-with-refresh, logout tombstone and adoption receipt.
/// One instance per process (React: module state).
class NativeSessionPersistence {
  NativeSessionPersistence({
    required this.auth,
    required this.preferences,
    required this.authStorage,
    this.isNativePlatform = true,
    this.removeLocalAuthItem,
    this.onBackupObserved,
    void Function(String message)? warn,
  }) : warn = warn ?? _defaultWarn;

  final SessionAuthGateway auth;
  final KeyValueStore preferences;
  final AuthStorageSelection authStorage;
  final bool isNativePlatform;

  /// `authStorage.storage.removeItem` of the SDK-side store.
  final Future<void> Function(String key)? removeLocalAuthItem;
  final BackupObserver? onBackupObserved;

  /// Never receives credentials.
  final void Function(String message) warn;

  static void _defaultWarn(String message) {
    // ignore: avoid_print
    print(message);
  }

  String get backupKey => sessionBackupKey(authStorage.realm);

  Future<void> _writes = Future.value();
  Future<void>? _restoring;
  Future<void>? _adopting;
  bool _subscribed = false;
  int _revision = 0;
  bool _loggedOut = false;
  int _pendingLogouts = 0;

  bool get subscribed => _subscribed;

  Future<void> saveSession(PersistedSession? session) {
    final value = jsonEncode({'realm': authStorage.realm, 'session': session?.toJson()});
    _writes = _writes.then((_) async {
      try {
        // A null tombstone, unlike removing the key, also blocks the v1 fallback.
        await preferences.set(backupKey, value);
      } catch (_) {
        if (session == null) await preferences.remove(backupKey);
        rethrow;
      } finally {
        if (session == null && authStorage.allowLegacyFallback) {
          await preferences.remove(legacySessionBackupKey);
        }
      }
      await onBackupObserved?.call(value);
      if (session != null && authStorage.allowLegacyFallback) {
        await preferences.remove(legacySessionBackupKey);
      }
    }).catchError((Object _) {
      // Errors can contain credentials; never log the payload or error object.
      warn('[session-persistence] backup write failed');
    });
    return _writes;
  }

  Future<PersistedSession?> loadSession() async => (await _loadSessionRecord()).$1;

  /// The usable pair and the raw v2 value it came from (null when the v1 key was used).
  Future<(PersistedSession?, String?)> _loadSessionRecord() async {
    await _writes;
    final value = await preferences.get(backupKey);
    if (value != null) {
      final backup = jsonDecode(value);
      return (
        backup is Map && backup['realm'] == authStorage.realm ? tokenPairFromJson(backup['session']) : null,
        value,
      );
    }
    if (!authStorage.allowLegacyFallback) return (null, null);
    final legacy = await preferences.get(legacySessionBackupKey);
    return (legacy == null ? null : tokenPairFromJson(jsonDecode(legacy)), null);
  }

  /// Native-only, idempotent.
  void startNativeSessionSync() {
    if (!isNativePlatform || _subscribed) return;
    _subscribed = true;
    auth.onAuthStateChange((event, session) {
      // SIGNED_OUT has no cause: the SDK also emits it for some server failures.
      // Retain that backup as a candidate only; recovery always checks refresh.
      if (session == null || event == AuthEventKind.signedOut) return;
      if (!const [
        AuthEventKind.signedIn, AuthEventKind.tokenRefreshed, AuthEventKind.userUpdated, AuthEventKind.initialSession,
      ].contains(event)) {
        return;
      }
      if (_loggedOut && (event != AuthEventKind.signedIn || _pendingLogouts > 0)) return;
      final pair = tokenPairFromView(session);
      if (pair == null) return;
      _loggedOut = false;
      _revision++;
      // Do not await SDK calls inside its auth callback.
      unawaited(saveSession(pair));
    });
  }

  /// The one sign-out entry point (React wraps `supabase.auth.signOut`).
  /// Rethrows the SDK error after the local cleanup, like the wrapped call.
  Future<void> signOut({bool others = false}) async {
    if (others || !_subscribed) return auth.signOut(others: others);
    _loggedOut = true;
    _pendingLogouts++;
    _revision++;
    final cleared = saveSession(null);
    try {
      return await auth.signOut();
    } finally {
      // The SDK can leave local credentials behind when remote logout fails.
      // Honor this explicit device logout without claiming server revocation.
      for (final suffix in const ['', '-user', '-code-verifier']) {
        try {
          await removeLocalAuthItem?.call(authStorage.storageKey + suffix);
        } catch (_) {
          warn('[session-persistence] local logout cleanup failed');
        }
      }
      await cleared;
      _pendingLogouts--;
    }
  }

  /// Call before rendering. Backup-only recovery requires the real refresh grant.
  Future<void> restoreNativeSession({bool requireRecovery = false, bool preserveOnTerminal = false}) async {
    if (!isNativePlatform) return;
    startNativeSessionSync();
    final pending = _restoring;
    if (pending != null) return pending;
    if (_loggedOut) return;

    final restoring = _restoring = () async {
      final startedAt = _revision;
      try {
        final current = await auth.getSession();
        if (_revision != startedAt || _loggedOut) return;
        if (current.error != null) throw current.error!;
        final existing = tokenPairFromView(current.session);
        if (existing != null) {
          await saveSession(existing);
          return;
        }

        final (persisted, raw) = await _loadSessionRecord();
        if (persisted == null || _revision != startedAt || _loggedOut) return;
        // Recorded before the grant: the SDK copy that follows derives from this backup.
        await onBackupObserved?.call(raw);
        final result = await auth.refreshSession(persisted.refreshToken);
        if (_revision != startedAt || _loggedOut) return;
        if (result.error != null) throw result.error!;
        final refreshed = tokenPairFromView(result.session);
        if (refreshed != null) {
          await saveSession(refreshed);
        } else if (requireRecovery) {
          throw const NativeSessionRecoveryPendingException();
        }
      } catch (error) {
        if (_revision == startedAt && !_loggedOut && isTerminalAuthError(error) && !preserveOnTerminal) {
          _loggedOut = true;
          _revision++;
          await saveSession(null);
        } else if (requireRecovery && _revision == startedAt && !_loggedOut) {
          // A retained backup is not a signed-out user. Transition builds show a
          // retry screen instead of asking for a password after network/config errors.
          throw const NativeSessionRecoveryPendingException();
        }
        // Network, maintenance, malformed storage and unknown errors never erase a backup.
      } finally {
        await _writes;
      }
    }();
    try {
      await restoring;
    } finally {
      _restoring = null;
    }
  }

  /// Native 29+: obtain a real target JWT before ANY application API call, even
  /// when the cached Source JWT has not expired. The migration receipt survives
  /// logout/restart, like the one-way authority pin; subsequent logins use this same
  /// immutable target client. Source writers must already be frozen at admission.
  Future<void> restoreAdmittedNativeSession(BackendConfig backend) {
    if (!isNativePlatform || !backend.sourceFirst || !backend.azure) {
      return restoreNativeSession(requireRecovery: backend.sourceFirst);
    }
    final pending = _adopting;
    if (pending != null) return pending;
    final adopting = _adopting = () async {
      try {
        final handoff = backend.admission?.policy.handoffSha256;
        if (backend.url != azureApiOrigin || handoff == null || !RegExp(r'^[a-f0-9]{64}$').hasMatch(handoff)) {
          throw const FormatException();
        }
        final value = await preferences.get(adoptionReceiptKey);
        final receipt = value == null ? null : jsonDecode(value);
        if (receipt != null &&
            (receipt is! Map ||
                receipt['schema'] != adoptionSchema ||
                !const ['pending', 'complete'].contains(receipt['state']) ||
                receipt['handoff'] is! String)) {
          throw const FormatException();
        }
        final receiptMap = receipt as Map?;
        if (receiptMap?['handoff'] == handoff && receiptMap?['state'] == 'complete') {
          await restoreNativeSession(requireRecovery: true);
          return;
        }
        // During first adoption, a missing target row can also mean an incomplete
        // migration. Keep that untrusted candidate and block the app, rather than
        // erasing a potentially valid Source session. No fallback to Source occurs.
        await restoreNativeSession(requireRecovery: true, preserveOnTerminal: true);
        final current = await auth.getSession();
        if (current.error != null) throw current.error!;
        final session = current.session;
        final Object? expectedUserId = receiptMap?['handoff'] == handoff && receiptMap?['state'] == 'pending'
            ? receiptMap!['userId']
            : session?.userId;
        if (session != null && expectedUserId != session.userId) throw const FormatException();
        await preferences.set(adoptionReceiptKey, jsonEncode({
          'schema': adoptionSchema, 'state': 'pending', 'handoff': handoff, 'userId': expectedUserId,
        }));
        if (session != null) {
          // No argument: refresh the SDK's latest session, avoiding a race with a
          // just-completed automatic refresh.
          final result = await auth.refreshSession();
          final pair = tokenPairFromView(result.session);
          if (result.error != null || pair == null || result.session!.userId != expectedUserId) {
            throw const FormatException();
          }
          await saveSession(pair);
          final durable = await loadSession();
          if (durable?.accessToken != pair.accessToken || durable?.refreshToken != pair.refreshToken) {
            throw const FormatException();
          }
        } else if (expectedUserId != null) {
          // A previous pending attempt must not become a new anonymous installation.
          throw const FormatException();
        }
        await preferences.set(adoptionReceiptKey, jsonEncode({
          'schema': adoptionSchema, 'state': 'complete', 'handoff': handoff, 'userId': expectedUserId,
        }));
      } catch (_) {
        throw const NativeSessionRecoveryPendingException();
      }
    }();
    return () async {
      try {
        await adopting;
      } finally {
        _adopting = null;
      }
    }();
  }
}
