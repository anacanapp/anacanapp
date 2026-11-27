// Ported from: (test support) — the vi.mock setup of src/components/onboarding/OnboardingJourney.test.tsx and
// src/components/paywall/PaywallCore.*.test.tsx: fake store SDK, fake server sync, in-memory onboarding database,
// frozen clock, in-memory stores; a disk asset bundle for the mascot images (not yet declared in pubspec.yaml).
import 'dart:async';
import 'dart:io';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/onboarding/onboarding_journey.dart';
import 'package:anacan/features/onboarding/onboarding_model.dart';
import 'package:anacan/features/onboarding/onboarding_ports.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../support/i18n_fakes.dart';
import 'onboarding_persistence_test.dart' show FakeDb;

export '../../design/harness.dart';
export 'onboarding_persistence_test.dart' show FakeDb;

const actor = '11111111-1111-4111-8111-111111111111', backend = 'https://api.anacan.az';

class NoPlatform implements UserStorePlatform {
  @override
  void languageChanged(String language) {}
  @override
  void writePreference(String key, String value) {}
}

/// Reads `assets/…` straight from the app directory (the onboarding images are not in pubspec.yaml yet).
class DiskAssetBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async {
    final file = File(key);
    if (file.existsSync()) return ByteData.sublistView(file.readAsBytesSync());
    return rootBundle.load(key);
  }
}

/// iOS store packages: annual 29.99 with a paid 19.99 first-year intro, monthly 3.99.
Map<String, Object?> annualPackage({double intro = 19.99}) => {
      'identifier': r'$rc_annual',
      'packageType': 'ANNUAL',
      'product': {
        'identifier': 'com.atlasoon.anacan.premium.yearly',
        'price': 29.99,
        'priceString': r'$29.99',
        'currencyCode': 'USD',
        'subscriptionPeriod': 'P1Y',
        'introPrice': {'price': intro, 'priceString': '\$${intro.toStringAsFixed(2)}', 'period': 'P1Y', 'cycles': 1},
      },
    };
Map<String, Object?> monthlyPackage() => {
      'identifier': r'$rc_monthly',
      'packageType': 'MONTHLY',
      'product': {'identifier': 'com.atlasoon.anacan.premium.monthly', 'price': 3.99, 'priceString': r'$3.99', 'currencyCode': 'USD', 'subscriptionPeriod': 'P1M'},
    };

class _Session extends Notifier<OnboardingSession> {
  _Session(this.initial);
  final OnboardingSession initial;
  @override
  OnboardingSession build() => initial;
  void set(OnboardingSession s) => state = s;
}

class _Sub extends Notifier<SubscriptionState> {
  @override
  SubscriptionState build() => const SubscriptionState();
  void set(SubscriptionState s) => state = s;
}

class _Ent extends Notifier<PremiumEntitlement> {
  @override
  PremiumEntitlement build() => const PremiumEntitlement(ready: true);
  void set(PremiumEntitlement s) => state = s;
}

/// The permission answers of the fake push plugin.
class FakePermission implements NotificationPermissionPort {
  String checkResult = 'prompt';
  String requestResult = 'granted';
  int requests = 0;
  @override
  Future<String> check() async => checkResult;
  @override
  Future<String> request() async {
    requests++;
    return requestResult;
  }
}

class OnboardingTestEnv {
  OnboardingTestEnv({this.language = 'az', this.native = false, this.platform, Map<String, Object?>? profile, List<Override> extra = const []}) {
    installTestI18n();
    I18nRuntime.instance.setLanguageInMemory(language);
    DomainClock.setSystemTime(DateTime(2026, 9, 22, 12));
    onboardingCachedTranslationReset();
    db.tables['profiles']!.first.addAll(profile ?? {});
    sdk.onGetAppUserId = () => actor;
    sdk.onGetOfferings = () => {
          'all': {
            'pricing_2026': {'availablePackages': [annualPackage(intro: intro), monthlyPackage()]},
          },
          'current': null,
        };
    sdk.onEligibility = (ids) => {for (final id in ids) id: eligibility};
    sdk.onPurchasePackage = (_) => customerInfoWith(entitlement: const {'periodType': 'NORMAL'});
    final plat = platform ?? (native ? 'ios' : 'web');
    env = RevenueCatEnvironment(platform: plat, isNative: native, config: const RevenueCatConfig(iosApiKey: 'appl_fixture', androidApiKey: 'goog_fixture', apiKey: 'x'));
    rc = RevenueCatService(sdk: sdk, env: env);
    final sessionProvider = NotifierProvider<_Session, OnboardingSession>(() => _Session(OnboardingSession(actor: actor, backend: backend, profile: _profileRow())));
    container = ProviderContainer(overrides: [
      localStoreProvider.overrideWithValue(LocalStore.memory()),
      userStorePlatformProvider.overrideWithValue(NoPlatform()),
      queryClientProvider.overrideWithValue(QueryClient(defaults: const QueryDefaults(retry: noRetry))),
      appSettingProvider.overrideWith((ref, key) => settings[key]),
      revenueCatEnvironmentProvider.overrideWithValue(env),
      purchasesUserIdProvider.overrideWithValue(actor),
      backendUrlProvider.overrideWithValue(backend),
      revenueCatServiceProvider.overrideWithValue(rc),
      premiumFunnelProvider.overrideWithValue(PremiumFunnel(rpc: (name, args) async => funnel.add(name), platform: () => plat, lifeStage: () => null)),
      analyticsSinkProvider.overrideWithValue(analytics),
      subscriptionProvider.overrideWith((ref) => ref.watch(_subProvider)),
      premiumEntitlementProvider.overrideWith((ref) => ref.watch(_entProvider)),
      inAppPurchaseDepsProvider.overrideWithValue(InAppPurchaseDeps(
        rc: rc,
        syncEntitlement: () async {
          syncCalls++;
          return EntitlementSyncResponse(data: {'isPro': serverPro});
        },
        refreshProfile: () async {},
        invalidateRoots: (_) {},
        analytics: analytics,
      )),
      onboardingSessionProvider.overrideWith((ref) => ref.watch(sessionProvider)),
      onboardingDraftStorageProvider.overrideWithValue(drafts),
      onboardingDataPortProvider.overrideWithValue(db),
      notificationPermissionProvider.overrideWithValue(permission),
      onboardingEffectsProvider.overrideWithValue(OnboardingEffects(
        syncSavedProfile: (saved) => synced.add(saved),
        setFunnelCompleted: (v) => funnelCompleted.add(v),
        selectChild: (_) {},
        childrenUpdated: () {},
        refreshProfile: () async {
          refreshes++;
          await (refreshGate?.future ?? Future<void>.value());
          container.read(sessionProvider.notifier).set(OnboardingSession(actor: actor, backend: backend, profile: _profileRow()));
        },
        updateName: (name) async {
          final row = db.tables['profiles']!.first..['name'] = name;
          return (data: Map<String, Object?>.of(row), error: null);
        },
        hasSeenIntro: () => hasSeenIntro,
      )),
      ...extra,
    ]);
    container.read(userStoreProvider.notifier).setLanguage(language);
  }

  static void onboardingCachedTranslationReset() {}

  final String language;
  final bool native;
  final String? platform;
  late final RevenueCatEnvironment env;
  late final RevenueCatService rc;
  late final ProviderContainer container;
  final FakePurchasesSdk sdk = FakePurchasesSdk();
  final FakeDb db = FakeDb();
  final MemoryDraftStorage drafts = MemoryDraftStorage();
  final FakePermission permission = FakePermission();
  final RecordingAnalyticsSink analytics = RecordingAnalyticsSink();
  final Map<String, Object?> settings = {};
  final List<String> funnel = [];
  final List<Map<String, Object?>> synced = [];
  final List<bool> funnelCompleted = [];
  bool hasSeenIntro = false, serverPro = true;
  double intro = 19.99;
  int eligibility = 2;
  int syncCalls = 0, refreshes = 0;
  Completer<void>? refreshGate;
  final _subProvider = NotifierProvider<_Sub, SubscriptionState>(_Sub.new);
  final _entProvider = NotifierProvider<_Ent, PremiumEntitlement>(_Ent.new);

  void setSubscription(SubscriptionState s) => container.read(_subProvider.notifier).set(s);
  void setEntitlement(PremiumEntitlement e) => container.read(_entProvider.notifier).set(e);

  Map<String, Object?> _profileRow() => Map<String, Object?>.of(db.tables['profiles']!.first);

  void dispose() {
    container.dispose();
    DomainClock.reset();
  }

  Widget wrap(Widget child, {bool dark = false, bool rtl = false}) => UncontrolledProviderScope(
        container: container,
        child: DefaultAssetBundle(
          bundle: DiskAssetBundle(),
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            home: GalleryFrame(dark: dark, rtl: rtl, child: child),
          ),
        ),
      );
}

/// Decodes every visible [Image] for real (outside the fake-async zone), then pumps.
Future<void> settleImages(WidgetTester tester) async {
  final images = tester.widgetList<Image>(find.byType(Image)).toList();
  final elements = find.byType(Image).evaluate().toList();
  await tester.runAsync(() async {
    for (var i = 0; i < images.length; i++) {
      try {
        await precacheImage(images[i].image, elements[i]);
      } catch (_) {}
    }
  });
  await tester.pump();
}
