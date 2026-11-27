// Ported from: src/pages/Index.tsx (useUserStore / useAuth / useAppSetting reads), src/components/BottomNav.tsx
//              (useUnreadMessages, useUnreadCommunityPosts, useAppSetting('bottom_nav_style'), profile avatar),
//              src/hooks/useChatChrome.ts (useFullScreenChat lease → nav hidden)
//
// Read-only inputs the shell needs from auth / user store / settings. They throw until the orchestrator
// overrides them with the real auth + user-store providers (tests override them with fixtures):
//
//   ProviderScope(overrides: [
//     shellUserProvider.overrideWith((ref) => ShellUser(...from auth + userStore...)),
//     unreadMessagesCountProvider.overrideWith((ref) => ...),
//     unreadCommunityPostsCountProvider.overrideWith((ref) => ...),
//     bottomNavStyleProvider.overrideWith((ref) => ...app_settings.bottom_nav_style...),
//     gateInputsProvider.overrideWith((ref) => GateInputs(...)),
//     gateActionsProvider.overrideWithValue(...userStore setters...),
//   ])
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/i18n/language_controller.dart' show appLanguageProvider;
import 'gates/gate_sequence.dart';
import 'nav/ids.dart';

export 'gates/gate_sequence.dart' show GateInputs, EmailGateStatus, ConsentGateStatus;

/// The signed-in user as the shell sees it (`useUserStore` + `useAuth` + profile fields).
@immutable
class ShellUser {
  const ShellUser({
    required this.isAuthenticated,
    required this.authLoading,
    required this.profileLoaded,
    required this.language,
    required this.backendUrl,
    this.userId,
    this.role,
    this.lifeStage,
    this.isAdmin = false,
    this.isModerator = false,
    this.profileCountryCode,
    this.storedCountryCode,
    this.linkedPartnerId,
    this.avatarUrl,
    this.displayName,
  });

  /// `userStore.isAuthenticated`.
  final bool isAuthenticated;

  /// `useAuth().loading`.
  final bool authLoading;

  /// `useAuth().profileLoaded`.
  final bool profileLoaded;

  /// `useAuth().user?.id`.
  final String? userId;

  /// `userStore.role` (`woman`, `partner`, …).
  final String? role;

  /// `userStore.lifeStage` (`flow`, `bump`, `mommy`, `partner`).
  final String? lifeStage;
  final bool isAdmin;
  final bool isModerator;

  /// `userStore.language` (app language code).
  final String language;

  /// `profile.country_code`.
  final String? profileCountryCode;

  /// `userStore.countryCode`.
  final String? storedCountryCode;

  /// `profile.linked_partner_id` (Messages, AlertReceiver).
  final String? linkedPartnerId;

  /// `profile.avatar_url` (capsule nav profile tab).
  final String? avatarUrl;

  /// `profile.name` (capsule nav initial).
  final String? displayName;

  /// `getBackendConfig().url` (scope keys, trusted push origin, admin web host).
  final String backendUrl;

  /// Push intents apply only when signed in, not loading, profile loaded.
  bool get isReady => isAuthenticated && !authLoading && profileLoaded;

  /// `profile.country_code || countryCode` (JS `||`).
  String? get effectiveCountryCode =>
      (profileCountryCode != null && profileCountryCode!.isNotEmpty) ? profileCountryCode : storedCountryCode;

  /// `<backendUrl>:<userId>` (BlogLinkHost scope).
  String get scope => '$backendUrl:${userId ?? ''}';

  ShellGuardContext get guard => ShellGuardContext(
        role: role,
        lifeStage: lifeStage,
        isAdmin: isAdmin,
        language: language,
        cakesAvailable: isCakesAvailable(effectiveCountryCode, language),
      );

  /// BottomNav `isPartner` (role only, not life stage).
  bool get isPartnerRole => role == 'partner';

  ShellUser copyWith({
    bool? isAuthenticated,
    bool? authLoading,
    bool? profileLoaded,
    String? userId,
    String? role,
    String? lifeStage,
    bool? isAdmin,
    String? language,
    String? profileCountryCode,
    String? avatarUrl,
    String? displayName,
  }) =>
      ShellUser(
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        authLoading: authLoading ?? this.authLoading,
        profileLoaded: profileLoaded ?? this.profileLoaded,
        language: language ?? this.language,
        backendUrl: backendUrl,
        userId: userId ?? this.userId,
        role: role ?? this.role,
        lifeStage: lifeStage ?? this.lifeStage,
        isAdmin: isAdmin ?? this.isAdmin,
        isModerator: isModerator,
        profileCountryCode: profileCountryCode ?? this.profileCountryCode,
        storedCountryCode: storedCountryCode,
        linkedPartnerId: linkedPartnerId,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        displayName: displayName ?? this.displayName,
      );

  @override
  bool operator ==(Object other) =>
      other is ShellUser &&
      other.isAuthenticated == isAuthenticated &&
      other.authLoading == authLoading &&
      other.profileLoaded == profileLoaded &&
      other.userId == userId &&
      other.role == role &&
      other.lifeStage == lifeStage &&
      other.isAdmin == isAdmin &&
      other.isModerator == isModerator &&
      other.language == language &&
      other.profileCountryCode == profileCountryCode &&
      other.storedCountryCode == storedCountryCode &&
      other.linkedPartnerId == linkedPartnerId &&
      other.avatarUrl == avatarUrl &&
      other.displayName == displayName &&
      other.backendUrl == backendUrl;

  @override
  int get hashCode => Object.hash(isAuthenticated, authLoading, profileLoaded, userId, role, lifeStage, isAdmin,
      isModerator, language, profileCountryCode, storedCountryCode, linkedPartnerId, avatarUrl, displayName, backendUrl);
}

Never _unwired(String name) =>
    throw UnimplementedError('$name is not wired yet: override it in ProviderScope (see app/lib/shell/shell_inputs.dart).');

/// Auth + user store facts. **Orchestrator must override.**
final shellUserProvider = Provider<ShellUser>((ref) => _unwired('shellUserProvider'));

/// `useUnreadMessages().unreadCount` (home badge for women, chat badge for partners). **Override.**
final unreadMessagesCountProvider = Provider<int>((ref) => _unwired('unreadMessagesCountProvider'));

/// `useUnreadCommunityPosts().unreadCount` (community badge, women only). **Override.**
final unreadCommunityPostsCountProvider = Provider<int>((ref) => _unwired('unreadCommunityPostsCountProvider'));

/// `app_settings.bottom_nav_style`: `capsule` → glass capsule, anything else (also while loading) → classic.
enum BottomNavStyle { classic, capsule }

/// `useAppSetting('bottom_nav_style') === 'capsule'`. **Override.**
final bottomNavStyleProvider = Provider<BottomNavStyle>((ref) => _unwired('bottomNavStyleProvider'));

/// Gate flags (store, auth, update centre, block, e-mail gate, consent gate, onboarding). **Override.**
final gateInputsProvider = Provider<GateInputs>((ref) => _unwired('gateInputsProvider'));

/// User-store setters the gates call.
abstract interface class GateActions {
  /// `setHasSelectedLanguage(true)` (existing users bypass the language screen).
  void setHasSelectedLanguage(bool value);

  /// `setHasSeenIntro(true)` (AppIntroduction completed).
  void setHasSeenIntro(bool value);

  /// `setFunnelCompleted(true)` (shell reached, or onboarding completed).
  void setFunnelCompleted(bool value);
}

/// **Orchestrator must override** with the user store's setters.
final gateActionsProvider = Provider<GateActions>((ref) => _unwired('gateActionsProvider'));

/// Platform side effects of navigation. The default works in the app; tests override it.
abstract interface class ShellPlatform {
  /// `ensureLanguageReady(code)` then `setLanguage(code)` (deeplink `?language=`).
  Future<void> changeLanguage(String code);

  /// Opens [uri] outside the app (web admin, website links). Returns false when it could not.
  Future<bool> openExternalUrl(Uri uri);

  /// A trusted https page a push linked to that the in-app router does not know (the WebView used to
  /// navigate to it). Returns false when it could not be opened (the push `type` is applied instead).
  Future<bool> openWebPage(Uri uri);

  /// `analytics.logScreenView(name, class)`.
  void logScreenView(String name, String screenClass);

  /// `App.exitApp()` (second back press within 2 s).
  void exitApp();
}

/// Default [ShellPlatform]: i18n language controller, url_launcher, SystemNavigator; analytics is a no-op
/// until the analytics port wires `logScreenView`.
class DefaultShellPlatform implements ShellPlatform {
  DefaultShellPlatform(this.ref);
  final Ref ref;

  @override
  Future<void> changeLanguage(String code) async {
    try {
      await ref.read(appLanguageProvider.notifier).changeLanguage(code);
    } catch (_) {
      // Like the React `.catch(() => {})`: a failed switch keeps the current language.
    }
  }

  @override
  Future<bool> openExternalUrl(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> openWebPage(Uri uri) => openExternalUrl(uri);

  @override
  void logScreenView(String name, String screenClass) {}

  @override
  void exitApp() => SystemNavigator.pop();
}

final shellPlatformProvider = Provider<ShellPlatform>((ref) => DefaultShellPlatform(ref));
