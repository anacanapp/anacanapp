// Ported from: node_modules/@capacitor-firebase/analytics (FirebaseAnalyticsPlugin: logEvent, setUserId,
//              setUserProperty, setCurrentScreen → `screen_view` with screen_name / screen_class, setConsent,
//              setEnabled), the calls of src/lib/analytics.ts and src/lib/privacyConsent.ts
//
// [FirebaseAnalyticsPlatform] on firebase_analytics. Firebase reads the committed native config (google-services.json
// / GoogleService-Info.plist) and starts with collection off and every consent denied (manifest / Info.plist keys);
// `applyPrivacyConsent` turns it on only after the person agrees. Firebase is initialised once per process through
// the push runtime ([FirebaseRuntime]); when that fails (no native config) every call throws and the analytics
// service swallows it, React's "not configured" branch.
import 'package:firebase_analytics/firebase_analytics.dart';

import '../push/firebase_push_platform.dart' show FirebaseRuntime;
import 'analytics.dart';

/// Bundle values the SDK accepts: strings and numbers. A boolean becomes 1 / 0 (what the iOS SDK records for the
/// NSNumber the Capacitor plugin passed), anything else its string form.
Map<String, Object> firebaseEventParameters(Map<String, Object> params) => {
      for (final e in params.entries)
        e.key: switch (e.value) {
          final String v => v,
          final num v => v,
          final bool v => v ? 1 : 0,
          final Object v => '$v',
        },
    };

class FlutterFireAnalytics implements FirebaseAnalyticsPlatform {
  FlutterFireAnalytics({Future<void> Function()? ensureInitialized, FirebaseAnalytics Function()? instance})
      : _ensureInitialized = ensureInitialized ?? FirebaseRuntime.instance.ensureInitialized,
        _instance = instance ?? (() => FirebaseAnalytics.instance);

  final Future<void> Function() _ensureInitialized;
  final FirebaseAnalytics Function() _instance;

  Future<FirebaseAnalytics> _analytics() async {
    await _ensureInitialized();
    return _instance();
  }

  @override
  Future<void> logEvent(String name, Map<String, Object> params) async =>
      (await _analytics()).logEvent(name: name, parameters: firebaseEventParameters(params));

  /// React passes '' on sign-out; that clears the id.
  @override
  Future<void> setUserId(String? userId) async =>
      (await _analytics()).setUserId(id: userId == null || userId.isEmpty ? null : userId);

  @override
  Future<void> setUserProperty(String key, String value) async => (await _analytics()).setUserProperty(name: key, value: value);

  /// `setCurrentScreen({screenName, screenClassOverride})`: the plugin logs `screen_view` with both parameters.
  @override
  Future<void> setCurrentScreen(String screenName, String screenClass) async =>
      (await _analytics()).logScreenView(screenName: screenName, screenClass: screenClass);

  @override
  Future<void> setConsent({required bool analyticsStorage, required bool adStorage, required bool adUserData, required bool adPersonalization}) async =>
      (await _analytics()).setConsent(
        analyticsStorageConsentGranted: analyticsStorage,
        adStorageConsentGranted: adStorage,
        adUserDataConsentGranted: adUserData,
        adPersonalizationSignalsConsentGranted: adPersonalization,
      );

  @override
  Future<void> setEnabled(bool enabled) async => (await _analytics()).setAnalyticsCollectionEnabled(enabled);
}
