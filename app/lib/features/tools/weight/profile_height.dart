// Ported from: src/lib/profileHeight.ts
//
// Mother's height for the pregnancy weight tracker. It lives in profiles.height_cm with a device copy as fallback.
// The profile is read with select('*'), so the column is "available" exactly when the loaded profile row carries the
// height_cm key; before the migration nothing is sent to the server. A height that exists only on the device is
// uploaded once (a per-user flag records the upload). Keys are the WebView's localStorage keys.
import 'package:flutter/foundation.dart';

import '../../../domain/js_compat.dart';
import '../../../domain/pregnancy/pregnancy_weight.dart';
import '../../../state/local_store.dart';

String heightStorageKey(String? userId) => 'anacan:weight-tracker:height-cm:${userId ?? 'anon'}';
String heightSyncedKey(String? userId) => 'anacan:weight-tracker:height-cm-synced:${userId ?? 'anon'}';

/// `Pick<Storage, 'getItem' | 'setItem'>`.
abstract interface class HeightStorage {
  String? getItem(String key);
  void setItem(String key, String value);
}

class LocalStoreHeightStorage implements HeightStorage {
  LocalStoreHeightStorage(this.store);
  final LocalStore store;
  @override
  String? getItem(String key) => store.getItem(key);
  @override
  void setItem(String key, String value) => store.setItem(key, value);
}

num? _asHeight(Object? value) {
  if (value == null || value == '') return null;
  final h = value is num ? value : jsNumber(value);
  return isValidHeightCm(h) ? h : null;
}

num? readLocalHeight(String? userId, HeightStorage? storage) {
  try {
    return _asHeight(storage?.getItem(heightStorageKey(userId)));
  } catch (_) {
    return null;
  }
}

void writeLocalHeight(String? userId, num h, HeightStorage? storage) {
  try {
    storage?.setItem(heightStorageKey(userId), jsNumberToString(h));
  } catch (_) {
    // used for this session only
  }
}

bool isHeightSynced(String? userId, HeightStorage? storage) {
  try {
    return storage?.getItem(heightSyncedKey(userId)) == '1';
  } catch (_) {
    return false;
  }
}

void markHeightSynced(String? userId, HeightStorage? storage) {
  try {
    storage?.setItem(heightSyncedKey(userId), '1');
  } catch (_) {
    // retried next time
  }
}

/// True when the loaded profile row has the height_cm column (migration applied).
bool profileHasHeightColumn(Map<String, Object?>? profile) => profile != null && profile.containsKey('height_cm');

@immutable
class HeightPlan {
  const HeightPlan({this.height, this.writeLocal, this.upload});

  /// Height to use for the BMI range.
  final num? height;

  /// Server value to copy onto the device.
  final num? writeLocal;

  /// Device value to upload once.
  final num? upload;

  @override
  bool operator ==(Object other) => other is HeightPlan && other.height == height && other.writeLocal == writeLocal && other.upload == upload;
  @override
  int get hashCode => Object.hash(height, writeLocal, upload);
  @override
  String toString() => 'HeightPlan(height: $height, writeLocal: $writeLocal, upload: $upload)';
}

/// The profile value wins; otherwise the device copy, uploaded once when the column exists and is empty.
HeightPlan planHeight(Map<String, Object?>? profile, num? local, bool synced) {
  final available = profileHasHeightColumn(profile);
  final remote = available ? _asHeight(profile!['height_cm']) : null;
  if (remote != null) return HeightPlan(height: remote, writeLocal: remote != local ? remote : null);
  final dev = _asHeight(local);
  if (dev == null) return const HeightPlan();
  return HeightPlan(height: dev, upload: available && !synced ? dev : null);
}

/// `client.from('profiles').update({ height_cm }).eq('user_id', userId)` → the PostgREST error (null = saved).
typedef ProfileHeightUpdate = Future<Object?> Function(String table, Map<String, Object?> values, String column, String value);

/// Saves profiles.height_cm; false (quietly) when the column is missing, offline or refused.
Future<bool> saveProfileHeight(ProfileHeightUpdate update, String? userId, num h) async {
  if (userId == null || userId.isEmpty || !isValidHeightCm(h)) return false;
  try {
    final error = await update('profiles', {'height_cm': h}, 'user_id', userId);
    return error == null;
  } catch (_) {
    return false;
  }
}
