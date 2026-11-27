// Ported from: src/hooks/useAppSettings.ts (useAppSetting, useLifeStageEnabled) — the public read through the
//              allow-listed `get_public_app_setting(p_key)` RPC (app_settings SELECT is admin-only since
//              20260514093759, so the old `['app-settings']` full-table read is not used by the app).
//
// The ONE app-settings source of the app. Every feature reads `useAppSetting(key)` through [appSettingProvider]
// (query key `['app-setting-public', key]`, staleTime 5 min, error → null), so two features asking for the same
// key share one cache entry, exactly like TanStack Query did. Feature-local inputs (home, profile, bottom-nav
// style …) are pointed here by the app root (app/lib/app/app_overrides.dart).
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../cache/cache.dart';
import 'db.dart';

/// The raw `get_public_app_setting` answer (null on error).
final appSettingQuery = queryProviderFamily<Object?, String>((ref, key) => QueryOptions<Object?>(
      queryKey: ['app-setting-public', key],
      staleTime: const Duration(minutes: 5),
      queryFn: (_) async {
        final result = await ref.read(dbProvider).rpcResult('get_public_app_setting', params: {'p_key': key});
        return result.error != null ? null : result.data;
      },
    ), name: 'appSettingQuery');

/// `useAppSetting(key)`: boolean strings and JSON-encoded values parsed; undefined → null.
Object? parseAppSetting(Object? data) {
  if (data == 'true') return true;
  if (data == 'false') return false;
  if (data is String) {
    try {
      return jsonDecode(data);
    } catch (_) {
      return data;
    }
  }
  return data;
}

/// `useAppSetting(key)`. Overridable in tests.
final appSettingProvider = Provider.family<Object?, String>((ref, key) => parseAppSetting(ref.watch(appSettingQuery(key)).data),
    name: 'appSettingProvider');

/// `useLifeStageEnabled(stage)`: `<stage>_mode_enabled !== false`.
final lifeStageEnabledProvider = Provider.family<bool, String>((ref, stage) => ref.watch(appSettingProvider('${stage}_mode_enabled')) != false);
