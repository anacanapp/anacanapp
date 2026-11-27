// Ported from: src/hooks/useAppSettings.ts (useAppSetting, useLifeStageEnabled)
//
// app/lib/core has no app-settings port yet; the paywall, onboarding and freemium limits need it, so the
// public read lives here until a shared one exists (the app root may override [appSettingProvider] with it).
// Query key `['app-setting-public', key]`, staleTime 5 min, rpc `get_public_app_setting(p_key)`.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/cache/cache.dart';
import '../../core/data/data.dart';

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

/// `useAppSetting(key)`. Overridable (tests, or a shared app-settings source).
final appSettingProvider = Provider.family<Object?, String>((ref, key) => parseAppSetting(ref.watch(appSettingQuery(key)).data),
    name: 'appSettingProvider');

/// `useLifeStageEnabled(stage)`: `<stage>_mode_enabled !== false`.
final lifeStageEnabledProvider = Provider.family<bool, String>((ref, stage) => ref.watch(appSettingProvider('${stage}_mode_enabled')) != false);
