// Ported from: src/integrations/supabase/backend-config.ts, src/integrations/supabase/client.ts,
// src/integrations/supabase/backend-bootstrap.ts (the import.meta.env.VITE_* inputs they read).
//
// Every compile-time input of the backend layer, in one place. Values arrive with
// `flutter build ... --dart-define=NAME=value` (Codemagic environment groups); see
// docs/flutter/BACKEND_CLIENT.md for the VITE_* variable each one replaces.
// String values are kept as strings ('true'/'false') so the comparisons stay exactly
// those of the React code (`=== 'true'`, `=== 'source-first-v1'`).

/// Compile-time configuration of the backend client.
class BuildConfig {
  const BuildConfig({
    this.apiUrl = '',
    this.anonKey = '',
    this.sourceAnonKey = '',
    this.appVersion = '',
    this.initialManagedAdmission = '',
    this.backendBootstrap = '',
    this.authCutover = '',
    this.buildMode = 'google',
    this.azurePartnerPairing = '',
    this.azureRevenueCatEnabled = '',
    this.azureAppleOAuthEnabled = '',
    this.azureGoogleOAuthEnabled = '',
  });

  /// Values baked in with `--dart-define`.
  static const BuildConfig fromEnvironment = BuildConfig(
    apiUrl: String.fromEnvironment('ANACAN_API_URL'),
    anonKey: String.fromEnvironment('ANACAN_ANON_KEY'),
    sourceAnonKey: String.fromEnvironment('ANACAN_SOURCE_ANON_KEY'),
    appVersion: String.fromEnvironment('ANACAN_APP_VERSION'),
    initialManagedAdmission: String.fromEnvironment('ANACAN_INITIAL_MANAGED_ADMISSION'),
    backendBootstrap: String.fromEnvironment('ANACAN_BACKEND_BOOTSTRAP'),
    authCutover: String.fromEnvironment('ANACAN_AUTH_CUTOVER'),
    buildMode: String.fromEnvironment('ANACAN_BUILD_MODE', defaultValue: 'google'),
    azurePartnerPairing: String.fromEnvironment('ANACAN_AZURE_PARTNER_PAIRING'),
    azureRevenueCatEnabled: String.fromEnvironment('ANACAN_AZURE_REVENUECAT_ENABLED'),
    azureAppleOAuthEnabled: String.fromEnvironment('ANACAN_AZURE_APPLE_OAUTH_ENABLED'),
    azureGoogleOAuthEnabled: String.fromEnvironment('ANACAN_AZURE_GOOGLE_OAUTH_ENABLED'),
  );

  /// `ANACAN_API_URL` ← `VITE_SUPABASE_URL` (`https://api.anacan.az`).
  final String apiUrl;

  /// `ANACAN_ANON_KEY` ← `VITE_SUPABASE_PUBLISHABLE_KEY` (managed backend anon key).
  final String anonKey;

  /// `ANACAN_SOURCE_ANON_KEY` ← `VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY` (sealed Source anon key).
  final String sourceAnonKey;

  /// `ANACAN_APP_VERSION` ← `VITE_APP_VERSION` (e.g. `60.0`); min-native-version gate and
  /// `X-Anacan-Version` header.
  final String appVersion;

  /// `ANACAN_INITIAL_MANAGED_ADMISSION` ← `VITE_INITIAL_MANAGED_ADMISSION`: the live
  /// admission JSON on one line, bundled as the offline authority floor.
  final String initialManagedAdmission;

  /// `ANACAN_BACKEND_BOOTSTRAP` ← `VITE_BACKEND_BOOTSTRAP` (`source-first-v1` for store builds).
  final String backendBootstrap;

  /// `ANACAN_AUTH_CUTOVER` ← `VITE_AUTH_CUTOVER` (`false` for store builds).
  final String authCutover;

  /// `ANACAN_BUILD_MODE` ← the `vite build --mode` value (`google` for store builds).
  final String buildMode;

  /// `ANACAN_AZURE_PARTNER_PAIRING` ← `VITE_AZURE_PARTNER_PAIRING`.
  final String azurePartnerPairing;

  /// `ANACAN_AZURE_REVENUECAT_ENABLED` ← `VITE_AZURE_REVENUECAT_ENABLED`.
  final String azureRevenueCatEnabled;

  /// `ANACAN_AZURE_APPLE_OAUTH_ENABLED` ← `VITE_AZURE_APPLE_OAUTH_ENABLED`.
  final String azureAppleOAuthEnabled;

  /// `ANACAN_AZURE_GOOGLE_OAUTH_ENABLED` ← `VITE_AZURE_GOOGLE_OAUTH_ENABLED`.
  final String azureGoogleOAuthEnabled;

  /// `usesSourceFirstBootstrap()`.
  bool get usesSourceFirstBootstrap => backendBootstrap == 'source-first-v1';

  BuildConfig copyWith({
    String? apiUrl,
    String? anonKey,
    String? sourceAnonKey,
    String? appVersion,
    String? initialManagedAdmission,
    String? backendBootstrap,
    String? authCutover,
    String? buildMode,
    String? azurePartnerPairing,
    String? azureRevenueCatEnabled,
    String? azureAppleOAuthEnabled,
    String? azureGoogleOAuthEnabled,
  }) =>
      BuildConfig(
        apiUrl: apiUrl ?? this.apiUrl,
        anonKey: anonKey ?? this.anonKey,
        sourceAnonKey: sourceAnonKey ?? this.sourceAnonKey,
        appVersion: appVersion ?? this.appVersion,
        initialManagedAdmission: initialManagedAdmission ?? this.initialManagedAdmission,
        backendBootstrap: backendBootstrap ?? this.backendBootstrap,
        authCutover: authCutover ?? this.authCutover,
        buildMode: buildMode ?? this.buildMode,
        azurePartnerPairing: azurePartnerPairing ?? this.azurePartnerPairing,
        azureRevenueCatEnabled: azureRevenueCatEnabled ?? this.azureRevenueCatEnabled,
        azureAppleOAuthEnabled: azureAppleOAuthEnabled ?? this.azureAppleOAuthEnabled,
        azureGoogleOAuthEnabled: azureGoogleOAuthEnabled ?? this.azureGoogleOAuthEnabled,
      );
}
