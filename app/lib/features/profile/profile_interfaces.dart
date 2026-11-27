// Ported from: src/components/ProfileScreen.tsx, src/components/PartnerProfileScreen.tsx (dependencies owned by other
//              features, exposed here as overridable providers), src/lib/native.ts (nativeShare),
//              src/lib/partner-link.ts (isAzurePartnerPairingEnabled / getPartnerCodeForSharing / error message),
//              src/hooks/useAuth.ts (signOut / refreshProfile / updateProfile / deleteAccount)
//
// Everything the profile / settings / support screens need from other features. Each provider has a working or
// no-op default; the orchestrator overrides them in the root ProviderScope (see README.md "Interfaces").
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/auth/auth.dart';

/// `<PremiumModal isOpen onClose feature? />` — implemented by the premium feature (`showPremiumModal`).
abstract interface class PremiumPrompt {
  Future<void> show(BuildContext context, {String? feature});
}

class NoopPremiumPrompt implements PremiumPrompt {
  const NoopPremiumPrompt();
  @override
  Future<void> show(BuildContext context, {String? feature}) async {}
}

final premiumPromptProvider = Provider<PremiumPrompt>((ref) => const NoopPremiumPrompt());

/// `useSubscription().isPremium` (purchases feature). Default false.
final subscriptionIsPremiumProvider = Provider<bool>((ref) => false);

/// `useAppSetting('profile_layout')` — `'classic'` selects the long page; anything else the tabs.
final profileLayoutSettingProvider = Provider<String?>((ref) => null);

/// `isAzurePartnerPairingEnabled()` (partner-link).
final partnerPairingEnabledProvider = Provider<bool>((ref) {
  try {
    return ref.watch(authControllerProvider.notifier).environment.partnerPairingEnabled;
  } catch (_) {
    return false;
  }
});

/// App origin used in the partner share text when pairing is enabled (`window.location.origin`).
final appOriginProvider = Provider<String>((ref) => 'https://app.anacan.az');

/// Widgets other features render inside the profile (all optional; null = not shown, like a hidden React block).
class ProfileSlots {
  const ProfileSlots({
    this.bannerSlot,
    this.qaygiCashCard,
    this.pregnancyCard,
    this.partnerLinkForm,
    this.promoDialog,
  });

  /// `<BannerSlot placement="profile_top" onNavigate className="mb-3" />`.
  final Widget Function(BuildContext context, String placement, void Function(String screen) onNavigate)? bannerSlot;

  /// `<QaygiCashProfileCard onOpen />`.
  final Widget Function(BuildContext context, VoidCallback? onOpen)? qaygiCashCard;

  /// `<ProfilePregnancyCard onNavigate />`.
  final Widget Function(BuildContext context, void Function(String screen) onNavigate)? pregnancyCard;

  /// `<PartnerLinkForm />` (partner profile, not linked yet).
  final WidgetBuilder? partnerLinkForm;

  /// `<PromoCodeDialog open onClose />`.
  final Future<void> Function(BuildContext context)? promoDialog;
}

final profileSlotsProvider = Provider<ProfileSlots>((ref) => const ProfileSlots());

/// Optional profile rows contributed by other features.
class ProfileRowData {
  const ProfileRowData({required this.id, required this.label, this.sub, this.badge});
  final String id;
  final String label;
  final String? sub;
  final String? badge;
}

/// `useRecapProfileRow()` (recap feature): `{id, label, sub}` while the server says Recap is available.
final recapProfileRowProvider = Provider<ProfileRowData?>((ref) => null);

/// `useQaygiCashWallet().wallet` → `{label: QC_BRAND, badge: formatQc(available), sub: qf('qc_profile_sub')}`.
final qaygiCashRowProvider = Provider<ProfileRowData?>((ref) => null);

/// `nativeShare({title, text, url})` → true when shared.
abstract interface class ShareService {
  Future<bool> share({String? title, String? text, String? url});
}

class SharePlusService implements ShareService {
  const SharePlusService();
  @override
  Future<bool> share({String? title, String? text, String? url}) async {
    try {
      final body = [text, if (url != null && !(text ?? '').contains(url)) url].whereType<String>().join('\n\n');
      final result = await SharePlus.instance.share(ShareParams(text: body, subject: title, title: title));
      return result.status != ShareResultStatus.dismissed;
    } catch (_) {
      return false;
    }
  }
}

final shareServiceProvider = Provider<ShareService>((ref) => const SharePlusService());

/// The `useAuth()` actions the screens call. Defaults to the real [AuthController].
abstract interface class AccountActions {
  Future<void> signOut();
  Future<AuthResult<void>> deleteAccount();
  Future<void> refreshProfile();
  Future<AuthResult<Profile>> updateProfile(Map<String, dynamic> updates);
  Future<String> partnerCodeForSharing(String currentCode);
}

class AuthAccountActions implements AccountActions {
  AuthAccountActions(this._ref);
  final Ref _ref;
  AuthController get _auth => _ref.read(authControllerProvider.notifier);
  @override
  Future<void> signOut() async => _auth.signOut();
  @override
  Future<AuthResult<void>> deleteAccount() => _auth.deleteAccount();
  @override
  Future<void> refreshProfile() => _auth.refreshProfile();
  @override
  Future<AuthResult<Profile>> updateProfile(Map<String, dynamic> updates) => _auth.updateProfile(updates);
  @override
  Future<String> partnerCodeForSharing(String currentCode) => _auth.partnerCodeForSharing(currentCode);
}

final accountActionsProvider = Provider<AccountActions>((ref) => AuthAccountActions(ref));

/// `getPartnerLinkErrorMessage(error)`.
String partnerLinkErrorText(Object error) => getPartnerLinkErrorMessage(error);

/// Everything PartnerProfileScreen reads from the partner feature (`usePartnerData`, `usePartnerStats`,
/// `usePartnerMissions`, `useSurprises`, `usePartnerAchievements`, `usePartnerMenuItems`).
class PartnerProfileData {
  const PartnerProfileData({
    this.partnerName,
    this.partnerAvatarUrl,
    this.partnerStage,
    this.pregnancyWeek = 0,
    this.babyAgeDays = 0,
    this.totalPoints = 0,
    this.lovesSent = 0,
    this.messagesSent = 0,
    this.completedMissions = 0,
    this.statsLoading = false,
    this.level = 1,
    this.levelProgress = 0,
    this.pointsToNextLevel = 50,
    this.completedSurprises = 0,
    this.surprisePoints = 0,
    this.achievementRows = const <Map<String, dynamic>>[],
    this.menuRows = const <Map<String, dynamic>>[],
  });

  /// `partnerProfile` (null = none loaded).
  final String? partnerName;
  final String? partnerAvatarUrl;
  final String? partnerStage;
  final num pregnancyWeek;
  final int babyAgeDays;
  final int totalPoints;
  final int lovesSent;
  final int messagesSent;
  final int completedMissions;
  final bool statsLoading;
  final int level;
  final double levelProgress;
  final int pointsToNextLevel;
  final int completedSurprises;
  final int surprisePoints;

  /// `partner_achievements_config` rows (empty → FALLBACK_ACHIEVEMENTS).
  final List<Map<String, dynamic>> achievementRows;

  /// `partner_menu_items` rows (empty → FALLBACK_MENU_ITEMS).
  final List<Map<String, dynamic>> menuRows;
}

final partnerProfileDataProvider = Provider<PartnerProfileData>((ref) => const PartnerProfileData());
