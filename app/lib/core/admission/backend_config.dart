// Ported from: src/integrations/supabase/backend-config.ts

import '../net/build_config.dart';
import '../session/auth_storage_key.dart';
import 'backend_admission.dart';

/// The backend the SDK is bound to for this process lifetime.
class BackendConfig {
  const BackendConfig({
    required this.url,
    required this.publishableKey,
    required this.azure,
    required this.sourceFirst,
    this.admission,
  });

  final String url;
  final String publishableKey;

  /// The managed (`azure`-named) realm. Retains the native protocol name.
  final bool azure;
  final bool sourceFirst;
  final AdmissionPin? admission;

  @override
  String toString() => 'BackendConfig($url, azure: $azure, sourceFirst: $sourceFirst)';
}

/// Holds the one admitted backend. React keeps this as a module singleton; here it
/// is an object so a full restart (new [BackendSelector]) can select again.
class BackendSelector {
  BackendSelector(this.config);

  final BuildConfig config;
  BackendConfig? _selected;

  bool get usesSourceFirstBootstrap => config.usesSourceFirstBootstrap;

  BackendConfig selectAdmittedBackend(AdmissionPin pin) {
    if (!usesSourceFirstBootstrap ||
        _selected != null ||
        pin.policy.phase == AdmissionPhase.maintenance ||
        config.authCutover == 'true' ||
        config.apiUrl != azureApiOrigin ||
        config.anonKey.isEmpty ||
        config.sourceAnonKey.isEmpty ||
        config.anonKey == config.sourceAnonKey) {
      throw const BackendAdmissionException(BackendAdmissionCode.admissionConfiguration);
    }
    final source = pin.authority == AdmissionAuthority.source;
    return _selected = BackendConfig(
      url: source ? sourceAuthRealm : azureApiOrigin,
      publishableKey: source ? config.sourceAnonKey : config.anonKey,
      azure: pin.authority == AdmissionAuthority.azure,
      sourceFirst: true,
      admission: pin,
    );
  }

  /// No SDK here. A premature client construction fails before it can refresh tokens.
  BackendConfig getBackendConfig() {
    final selected = _selected;
    if (selected != null) return selected;
    if (usesSourceFirstBootstrap) {
      throw const BackendAdmissionException(BackendAdmissionCode.admissionConfiguration);
    }
    return BackendConfig(
      url: config.apiUrl,
      publishableKey: config.anonKey,
      azure: config.buildMode == 'azure' || config.buildMode == 'google',
      sourceFirst: false,
    );
  }

  bool isAzureBackend() => getBackendConfig().azure;

  /// Google builds (mode 'google') always pair through link_partner_by_code / ensure_secure_partner_code.
  bool isAzurePairingBackend() =>
      config.buildMode == 'google' ||
      (config.azurePartnerPairing == 'true' && (!usesSourceFirstBootstrap || isAzureBackend()));
}
