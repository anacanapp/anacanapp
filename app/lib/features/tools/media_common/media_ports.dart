// Ported from: the hook / platform calls shared by the AI & media tools — src/hooks/use-toast.ts (toast), sonner
//              (toast.success / toast.error), src/components/PremiumModal.tsx, src/hooks/useSubscription.ts
//              (isPremium, checkAndConsume, peekRemainingDaily, canUseWhiteNoise, trackWhiteNoiseUsage,
//              canUseBabyPhotoshoot), src/integrations/supabase/client.ts (from / functions.invoke / storage),
//              src/lib/permissions.ts (takePhoto, pickFromGallery, readImageFileAsDataUrl, getCurrentPosition,
//              CAMERA_PERMISSION_DENIED, isCameraPermissionError), @capacitor/haptics, src/lib/native.ts
//              (nativeShare), src/lib/pregnancy-utils.ts (getRealCalendarAge for the AI baby context)
//
// One seam per platform / backend call so each tool's tests replace a provider instead of a plugin.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart' show BuildContext;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:share_plus/share_plus.dart';

import '../../../core/auth/auth.dart';
import '../../../core/data/data.dart';
import '../../../core/i18n/app_languages.dart' show appLanguage;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/billing/usage_limits.dart' show UsageDecision;
import '../../../domain/pregnancy/pregnancy_utils.dart' show getRealCalendarAge;
import '../../../native/purchases/subscription.dart' show subscriptionProvider, subscriptionUsageProvider, SubscriptionUsage;
import '../../../services/native/mobile_host.dart' show isMobileHost;
import '../../../services/native/permissions.dart' show nativePermissionsProvider;
import '../../premium/premium_modal.dart' show showPremiumModal;
import '../health_common/health_db.dart';

// ── Toasts ──

/// `toast({ title, description, variant })` (Radix, [sonner] null) or sonner `toast.success / toast.error`.
class MediaToastData {
  const MediaToastData({this.title, this.description, this.destructive = false, this.sonner});
  final String? title;
  final String? description;
  final bool destructive;

  /// 'success' | 'error' for sonner toasts.
  final String? sonner;

  @override
  bool operator ==(Object other) =>
      other is MediaToastData && other.title == title && other.description == description && other.destructive == destructive && other.sonner == sonner;

  @override
  int get hashCode => Object.hash(title, description, destructive, sonner);

  @override
  String toString() => 'MediaToastData(title: $title, description: $description, destructive: $destructive, sonner: $sonner)';
}

typedef MediaToast = void Function(BuildContext context, MediaToastData toast);

final mediaToastProvider = Provider<MediaToast>(
  (ref) => (context, t) {
    final host = AToastHost.of(context);
    switch (t.sonner) {
      case 'success':
        host.success(t.title ?? '', description: t.description);
      case 'error':
        host.error(t.title ?? '', description: t.description);
      default:
        host.show(title: t.title, description: t.description, destructive: t.destructive);
    }
  },
);

// ── Premium ──

/// `<PremiumModal isOpen feature />`.
final mediaPremiumModalProvider = Provider<Future<void> Function(BuildContext context, String feature)>(
  (ref) =>
      (context, feature) => showPremiumModal(context, feature: feature),
);

/// The `useSubscription()` members these tools read.
abstract interface class MediaUsage {
  bool get isPremium;
  Future<UsageDecision> checkAndConsume(String feature);
  Future<({double remaining, double limit})> peekRemainingDaily(String feature);
  ({bool allowed, double remainingSeconds}) canUseWhiteNoise();
  Future<void> trackWhiteNoiseUsage(num seconds);
  Future<({bool allowed, double remainingCount})> canUseBabyPhotoshoot();
}

class SubscriptionMediaUsage implements MediaUsage {
  SubscriptionMediaUsage(this.usage);
  final SubscriptionUsage usage;
  @override
  bool get isPremium => usage.isPremium;
  @override
  Future<UsageDecision> checkAndConsume(String feature) => usage.checkAndConsume(feature);
  @override
  Future<({double remaining, double limit})> peekRemainingDaily(String feature) => usage.peekRemainingDaily(feature);
  @override
  ({bool allowed, double remainingSeconds}) canUseWhiteNoise() => usage.canUseWhiteNoiseNow();
  @override
  Future<void> trackWhiteNoiseUsage(num seconds) => usage.trackWhiteNoiseUsage(seconds);
  @override
  Future<({bool allowed, double remainingCount})> canUseBabyPhotoshoot() => usage.canUseBabyPhotoshootNow();
}

final mediaUsageProvider = Provider<MediaUsage>((ref) {
  ref.watch(subscriptionProvider);
  return SubscriptionMediaUsage(ref.watch(subscriptionUsageProvider));
});

// ── Backend ──

/// The PostgREST / Functions / Storage calls of these tools.
abstract interface class MediaDb {
  /// Rows; throws the PostgREST error.
  Future<Rows> select(HQuery query);

  /// `.insert(row).select().single()`.
  Future<Row> insert(String table, Row row);

  /// `.upsert(row, { onConflict }).select().maybeSingle()`.
  Future<Row?> upsert(String table, Row row, {required String onConflict});

  /// `.update(patch)` + filters (`.select().maybeSingle()` when [returning]).
  Future<Row?> update(String table, Row patch, List<HFilter> filters, {bool returning = false});

  /// `.delete()` + filters.
  Future<void> delete(String table, List<HFilter> filters);

  /// `functions.invoke(name, { body })` as `{data, error}`.
  Future<DbResult<Object?>> invoke(String name, {Object? body});

  /// `storage.from(bucket).createSignedUrl(path, seconds)`, null on error.
  Future<String?> signedUrl(String bucket, String path, int seconds);
}

class SupabaseMediaDb implements MediaDb {
  SupabaseMediaDb(this._db, this._health);
  final Db _db;
  final HealthDb _health;

  @override
  Future<Rows> select(HQuery query) => _health.select(query);
  @override
  Future<Row> insert(String table, Row row) => _health.insert(table, row);
  @override
  Future<Row?> upsert(String table, Row row, {required String onConflict}) => _health.upsert(table, row, onConflict: onConflict);
  @override
  Future<Row?> update(String table, Row patch, List<HFilter> filters, {bool returning = false}) => _health.update(table, patch, filters, single: returning);
  @override
  Future<void> delete(String table, List<HFilter> filters) => _health.delete(table, filters);
  @override
  Future<DbResult<Object?>> invoke(String name, {Object? body}) => _db.invoke(name, body: body);
  @override
  Future<String?> signedUrl(String bucket, String path, int seconds) async {
    try {
      return await _db.signedUrl(bucket, path, seconds);
    } catch (_) {
      return null;
    }
  }
}

final mediaDbProvider = Provider<MediaDb>((ref) => SupabaseMediaDb(ref.watch(dbProvider), ref.watch(healthDbProvider)));

/// `profile?.user_id` (null signed out).
final mediaUserIdProvider = Provider<String?>((ref) {
  final id = ref.watch(authProfileProvider)?.userId;
  return id == null || id.isEmpty ? null : id;
});

/// `user?.id` of useAuth (the auth user, available before the profile loads).
final mediaAuthUserIdProvider = Provider<String?>((ref) => ref.watch(authUserProvider)?.id);

// ── Haptics / share ──

/// `Haptics.impact({ style })`.
class MediaHaptics {
  const MediaHaptics({required this.medium, required this.heavy, required this.light});
  final Future<void> Function() medium;
  final Future<void> Function() heavy;
  final Future<void> Function() light;
}

final mediaHapticsProvider = Provider<MediaHaptics>(
  (ref) => const MediaHaptics(light: HapticFeedback.lightImpact, medium: HapticFeedback.mediumImpact, heavy: HapticFeedback.heavyImpact),
);

/// `nativeShare({ text })` → shared.
final mediaShareProvider = Provider<Future<bool> Function({String? text, String? title, String? url})>(
  (ref) => ({text, title, url}) async {
    try {
      final body = [?text, ?url].join('\n');
      final result = await SharePlus.instance.share(ShareParams(text: body, title: title, subject: title));
      return result.status == ShareResultStatus.success;
    } catch (_) {
      return false;
    }
  },
);

// ── Camera / gallery ──

/// `CAMERA_PERMISSION_DENIED`.
const String cameraPermissionDenied = 'CAMERA_PERMISSION_DENIED';

/// A picker failure with the plugin's message (`error.message`).
class MediaPickError implements Exception {
  const MediaPickError(this.message);
  final String message;
  @override
  String toString() => message;
}

/// `isCameraPermissionError(error)`.
bool isCameraPermissionError(Object? error) {
  final message = (error is MediaPickError ? error.message : '${error ?? ''}').toLowerCase();
  return message.contains(cameraPermissionDenied.toLowerCase()) || message.contains('permission') && message.contains('deni');
}

/// A picked image (JPEG data the way Camera.getPhoto / readImageFileAsDataUrl return it).
class PickedImage {
  const PickedImage({required this.bytes, this.mimeType = 'image/jpeg'});
  final Uint8List bytes;
  final String mimeType;
  int get size => bytes.length;

  /// `data:<mime>;base64,<…>`.
  String get dataUrl => 'data:$mimeType;base64,${base64Encode(bytes)}';
}

enum MediaImageSource { camera, gallery, file }

/// `takePhoto()` (camera, 1024 px, quality 85), `pickFromGallery()` (1024 px, quality 85) and the hidden file input
/// + `readImageFileAsDataUrl` (1280 px, quality 85). Null = cancelled. Permission denials throw a [MediaPickError]
/// whose message contains [cameraPermissionDenied].
final mediaImagePickerProvider = Provider<Future<PickedImage?> Function(MediaImageSource source)>(
  (ref) => (source) async {
    final side = source == MediaImageSource.file ? 1280.0 : 1024.0;
    try {
      final file = await ImagePicker().pickImage(
        source: source == MediaImageSource.camera ? ImageSource.camera : ImageSource.gallery,
        maxWidth: side,
        maxHeight: side,
        imageQuality: 85,
      );
      if (file == null) return null;
      return PickedImage(bytes: await file.readAsBytes(), mimeType: file.mimeType ?? 'image/jpeg');
    } on PlatformException catch (e) {
      final code = e.code.toLowerCase();
      if (code.contains('denied') || code.contains('permission')) throw const MediaPickError(cameraPermissionDenied);
      throw MediaPickError(e.message ?? e.code);
    }
  },
);

// ── Location ──

/// `GeolocationPosition.coords`.
class GeoPosition {
  const GeoPosition(this.latitude, this.longitude);
  final double latitude;
  final double longitude;
}

/// `getCurrentPosition()` (coarse, 10 s timeout, 60 s maximum age). Inside the app: the permission flow of
/// permissions.ts on geolocator; elsewhere it always fails, which is the React path when geolocation is unavailable
/// (the weather tool falls back to Baku).
final geolocationProvider = Provider<Future<GeoPosition> Function()>(
  (ref) => isMobileHost
      ? () async {
          final p = await ref.read(nativePermissionsProvider).getCurrentPosition();
          return GeoPosition(p.latitude, p.longitude);
        }
      : () async => throw UnsupportedError('Geolocation is unavailable'),
);

// ── AI context ──

/// The `userContext` the AI analysis functions get: name, age in months and days, gender (empty without a birth date).
Map<String, Object?> babyAnalysisContext(Profile? profile) {
  final birth = profile?.babyBirthDate;
  if (birth == null || birth.isEmpty) return {};
  final age = getRealCalendarAge(birth, tr: tr);
  final name = profile?.babyName;
  return {
    'babyName': name == null || name.isEmpty ? tr('crytranslator_korpe_fa2b51', 'Körpə') : name,
    'babyAgeMonths': age.months,
    'babyAgeDays': age.totalDays,
    'babyGender': profile?.babyGender,
  };
}

/// `date.toLocaleDateString(getLocaleTag())`.
String localeDateString(DateTime date) {
  try {
    return DateFormat.yMd(appLanguage(currentLanguage()).intlLocale).format(date);
  } catch (_) {
    return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}';
  }
}

/// `date.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })`.
String localeTimeString(DateTime date) {
  try {
    return DateFormat.Hm(appLanguage(currentLanguage()).intlLocale).format(date);
  } catch (_) {
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}

/// `getPersistedLanguage()`.
final mediaLanguageProvider = Provider<String Function()>((ref) => currentLanguage);
