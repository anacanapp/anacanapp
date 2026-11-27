// Ported from: src/hooks/useAuth.ts (the actions the entry screens call), src/lib/geoLanguage.ts (fetchGeoCountry
//              wiring), src/lib/email-verification.ts (send/confirm wiring), src/components/CountryGate.tsx (profile
//              update), src/lib/partner-link.ts (linkPartnerByCode wiring), src/integrations/supabase/client.ts (rpc)
//
// Seams between the entry screens and the backend/auth layer. Every provider has a working default over the
// foundation (AuthController, supabase client); tests override them with fakes.
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/geo_language.dart';
import '../../core/net/backend_client.dart' show BootstrapOpened;
import '../../core/net/backend_providers.dart';
import '../../core/net/build_config.dart';
import '../../core/offline/connectivity.dart';

/// The `useAuth()` actions used by the entry screens.
abstract interface class EntryAuthActions {
  Future<AuthResult<Object?>> signIn(String email, String password);

  /// Returns the new user's id in `data` (or null when the backend gave none).
  Future<AuthResult<String?>> signUp(String email, String password, String name, String? countryCode);
  Future<AuthResult<Object?>> signInWithGoogle();
  Future<AuthResult<Object?>> signInWithApple();
  Future<AuthResult<void>> resetPassword(String email);
  Future<AuthResult<Object?>> updatePassword(String password);
  Future<void> signOut();

  /// `supabase.auth.getSession()` → the session user's id, or null without a session.
  Future<String?> sessionUserId();

  /// `linkPartnerByCode(code)` (throws [PartnerLinkError] / PostgREST errors).
  Future<void> linkPartnerByCode(String code);

  /// `isAzurePartnerPairingEnabled()`.
  bool get partnerPairingEnabled;

  /// `refreshProfile()`.
  Future<void> refreshProfile();
}

class AuthControllerEntryActions implements EntryAuthActions {
  AuthControllerEntryActions(this.ref);
  final Ref ref;
  AuthController get _c => ref.read(authControllerProvider.notifier);

  @override
  Future<AuthResult<Object?>> signIn(String email, String password) async {
    final r = await _c.signIn(email, password);
    return AuthResult(data: r.data, error: r.error);
  }

  @override
  Future<AuthResult<String?>> signUp(String email, String password, String name, String? countryCode) async {
    final r = await _c.signUp(email, password, name, countryCode);
    return AuthResult(data: r.data?.user?.id, error: r.error);
  }

  @override
  Future<AuthResult<Object?>> signInWithGoogle() async {
    final r = await _c.signInWithGoogle();
    return AuthResult(data: r.data, error: r.error);
  }

  @override
  Future<AuthResult<Object?>> signInWithApple() async {
    final r = await _c.signInWithApple();
    return AuthResult(data: r.data, error: r.error);
  }

  @override
  Future<AuthResult<void>> resetPassword(String email) => _c.resetPassword(email);

  @override
  Future<AuthResult<Object?>> updatePassword(String password) async {
    final r = await _c.updatePassword(password);
    return AuthResult(data: r.data, error: r.error);
  }

  @override
  Future<void> signOut() => _c.signOut();

  @override
  Future<String?> sessionUserId() async => _c.environment.currentSession()?.user.id;

  @override
  Future<void> linkPartnerByCode(String code) => PartnerLink(
        pairingEnabled: _c.environment.partnerPairingEnabled,
        rpc: (fn, [params]) => _c.environment.client.rpc<Object?>(fn, params: params),
      ).linkPartnerByCode(code);

  @override
  bool get partnerPairingEnabled => _c.environment.partnerPairingEnabled;

  @override
  Future<void> refreshProfile() => _c.refreshProfile();
}

final entryAuthActionsProvider = Provider<EntryAuthActions>((ref) => AuthControllerEntryActions(ref));

/// `supabase.rpc(fn, params)` → data; throws the PostgREST error.
final entryRpcProvider = Provider<RpcCall>((ref) {
  return (fn, [params]) => ref.read(supabaseClientProvider).rpc<Object?>(fn, params: params);
});

/// `fetchGeoCountry()` (2.5 s, never throws).
final geoCountryFetcherProvider = Provider<Future<String?> Function()>((ref) {
  return () async {
    try {
      final rpc = ref.read(entryRpcProvider);
      return await fetchGeoCountry(() => rpc('request_geo_country'));
    } catch (_) {
      return null;
    }
  };
});

/// `navigator.languages` (device locales, most preferred first).
final deviceLocalesProvider = Provider<List<Locale>>((ref) => WidgetsBinding.instance.platformDispatcher.locales);

/// E-mail code calls (`sendVerificationCode`, `confirmVerificationCode`).
class EmailVerificationApi {
  const EmailVerificationApi({required this.send, required this.confirm});
  final Future<VerificationResult> Function(String language) send;
  final Future<VerificationResult> Function(String code, String language) confirm;
}

final emailVerificationApiProvider = Provider<EmailVerificationApi>((ref) => EmailVerificationApi(
      send: (language) => sendVerificationCode(ref.read(supabaseClientProvider), language),
      confirm: (code, language) => confirmVerificationCode(ref.read(supabaseClientProvider), code, language),
    ));

/// CountryGate: `profiles.update({country_code}).eq('user_id', userId)` (throws on error).
final profileCountryWriterProvider = Provider<Future<void> Function(String userId, String code)>((ref) {
  return (userId, code) async {
    await ref.read(supabaseClientProvider).from('profiles').update({'country_code': code}).eq('user_id', userId);
  };
});

/// AuthScreen build/backend flags: `isAzureBackend()`, `VITE_AZURE_GOOGLE_OAUTH_ENABLED`, `VITE_AZURE_APPLE_OAUTH_ENABLED`.
class AuthScreenConfig {
  const AuthScreenConfig({this.azureBackend = false, this.azureGoogleOAuthEnabled = false, this.azureAppleOAuthEnabled = false});
  final bool azureBackend;
  final bool azureGoogleOAuthEnabled;
  final bool azureAppleOAuthEnabled;

  /// `!isAzureBackend() || VITE_AZURE_GOOGLE_OAUTH_ENABLED === 'true'`.
  bool get googleLoginReady => !azureBackend || azureGoogleOAuthEnabled;

  /// `!isAzureBackend() || VITE_AZURE_APPLE_OAUTH_ENABLED === 'true'`. Natively the Azure Apple *web* flow
  /// (`usesAzureAppleWebFlow`) never applies, so this is also `appleLoginReady`.
  bool get appleConfigured => !azureBackend || azureAppleOAuthEnabled;
}

final authScreenConfigProvider = Provider<AuthScreenConfig>((ref) {
  const config = BuildConfig.fromEnvironment;
  var azure = false;
  try {
    final opened = ref.watch(backendBootstrapProvider).value;
    azure = opened is BootstrapOpened && opened.backend.azure;
  } catch (_) {}
  return AuthScreenConfig(
    azureBackend: azure,
    azureGoogleOAuthEnabled: config.azureGoogleOAuthEnabled == 'true',
    azureAppleOAuthEnabled: config.azureAppleOAuthEnabled == 'true',
  );
});

/// `getBrandingUrl(useAppBranding().data, 'login_logo')` (`app_branding`, 5 min stale; error → none).
final loginLogoUrlProvider = FutureProvider<String?>((ref) async {
  try {
    final rows = await ref.read(supabaseClientProvider).from('app_branding').select().order('key');
    for (final row in rows) {
      if (row['key'] == 'login_logo') {
        final url = row['image_url'];
        return url is String && url.isNotEmpty ? url : null;
      }
    }
  } catch (_) {}
  return null;
});

/// `consentSource()` / `consentAppVersion()` of consentGate.ts.
class ConsentPlatform {
  const ConsentPlatform({required this.source, required this.appVersion});

  /// 'ios' | 'android' | 'web'.
  final String source;
  final Future<String?> Function() appVersion;
}

final consentPlatformProvider = Provider<ConsentPlatform>((ref) {
  String source = 'web';
  if (!kIsWeb) {
    if (Platform.isIOS) source = 'ios';
    if (Platform.isAndroid) source = 'android';
  }
  return ConsentPlatform(
    source: source,
    appVersion: () async {
      try {
        if (source != 'web') {
          final v = (await PackageInfo.fromPlatform()).version;
          if (v.isNotEmpty) return v;
        }
      } catch (_) {}
      const env = BuildConfig.fromEnvironment;
      return env.appVersion.isEmpty ? null : (env.appVersion.length > 32 ? env.appVersion.substring(0, 32) : env.appVersion);
    },
  );
});

/// `navigator.onLine === false` (the consent "saved offline" message).
final deviceOfflineProvider = Provider<bool Function()>((ref) {
  return () {
    try {
      return !ref.read(connectivitySourceProvider).isOnline;
    } catch (_) {
      return false;
    }
  };
});
