// Ported from: the environment reads of the community hooks: `useAuth().loading`, `getBackendConfig().url`,
//              `useUserStore(s => s.language)`, `crypto.randomUUID()`, src/lib/native.ts (hapticFeedback, nativeShare)
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../state/shell_bindings.dart' show backendUrlProvider;

/// `getBackendConfig().url` ('' before the backend opened).
final communityBackendUrlProvider = Provider<String>((ref) {
  try {
    return ref.watch(backendUrlProvider);
  } catch (_) {
    return '';
  }
});

/// `useAuth().loading`.
final communityAuthLoadingProvider = Provider<bool>((ref) => ref.watch(authControllerProvider.select((s) => s.loading)));

/// `normalizeAppLanguage(useUserStore(s => s.language))`.
final communityLanguageProvider = Provider<String>((ref) => normalizeAppLanguage(ref.watch(appLanguageProvider)));

/// `crypto.randomUUID()` (replaceable in tests).
final communityUuidProvider = Provider<String Function()>((ref) => randomUuidV4);

final math.Random _random = math.Random.secure();

String randomUuidV4() {
  final b = List<int>.generate(16, (_) => _random.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

final RegExp _uuid = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', caseSensitive: false);

/// `validate(value)` of the `uuid` package (versions 1-8 plus nil / max).
bool isUuid(Object? value) =>
    value is String &&
    (_uuid.hasMatch(value) || value == '00000000-0000-0000-0000-000000000000' || value.toLowerCase() == 'ffffffff-ffff-ffff-ffff-ffffffffffff');

/// `hapticFeedback.light / medium` (Capacitor Haptics impact).
class CommunityHaptics {
  const CommunityHaptics();
  void light() => HapticFeedback.lightImpact();
  void medium() => HapticFeedback.mediumImpact();
}

final communityHapticsProvider = Provider<CommunityHaptics>((ref) => const CommunityHaptics());
