// Ported from: node_modules/@capacitor-community/admob + patches/@capacitor-community+admob+8.1.0.patch (test ids,
//              consent strings, npa extra, native story channel events), src/lib/ads/native.ts (adapter flow)
import 'dart:async';

import 'package:anacan/services/ads/admob_adapter.dart';
import 'package:anacan/services/ads/google_mobile_ads_sdk.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class _FakeConsent implements ConsentInformation {
  ConsentStatus status = ConsentStatus.notRequired;
  bool canRequest = true;
  bool fail = false;

  @override
  void requestConsentInfoUpdate(ConsentRequestParameters params, OnConsentInfoUpdateSuccessListener successListener,
      OnConsentInfoUpdateFailureListener failureListener) {
    if (fail) {
      failureListener(FormError(errorCode: 1, message: 'offline'));
    } else {
      successListener();
    }
  }

  @override
  Future<ConsentStatus> getConsentStatus() async => status;
  @override
  Future<bool> isConsentFormAvailable() async => false;
  @override
  Future<bool> canRequestAds() async => canRequest;
  @override
  Future<PrivacyOptionsRequirementStatus> getPrivacyOptionsRequirementStatus() async => PrivacyOptionsRequirementStatus.required;
  @override
  Future<void> reset() async {}
}

class _FakeMobileAds implements MobileAds {
  final List<String> calls = [];
  RequestConfiguration? configuration;

  @override
  Future<void> updateRequestConfiguration(RequestConfiguration requestConfiguration) async {
    configuration = requestConfiguration;
    calls.add('updateRequestConfiguration');
  }

  @override
  Future<InitializationStatus> initialize() {
    calls.add('initialize');
    return Completer<InitializationStatus>().future; // never completes: initialize must not wait for it
  }

  @override
  Future<void> setAppMuted(bool muted) async => calls.add('setAppMuted:$muted');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel(AdmobNativeChannel.channelName);
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late List<MethodCall> calls;
  Object? Function(MethodCall call)? answer;

  setUp(() {
    calls = [];
    answer = null;
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      return answer?.call(call);
    });
  });
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  Future<void> nativeEvent(String name) async {
    await messenger.handlePlatformMessage(
      AdmobNativeChannel.channelName,
      const StandardMethodCodec().encodeMethodCall(MethodCall('event', <String, Object?>{'name': name})),
      (_) {},
    );
  }

  group('plugin values', () {
    test('isTesting uses the plugin test units (patched iOS ids) and the story video units', () {
      expect(admobTestUnit('ios', 'banner'), 'ca-app-pub-3940256099942544/2934735716');
      expect(admobTestUnit('ios', 'interstitial'), 'ca-app-pub-3940256099942544/4411468910');
      expect(admobTestUnit('ios', 'rewarded'), 'ca-app-pub-3940256099942544/1712485313');
      expect(admobTestUnit('android', 'banner'), 'ca-app-pub-3940256099942544/6300978111');
      expect(admobTestUnit('android', 'interstitial'), 'ca-app-pub-3940256099942544/1033173712');
      expect(admobTestUnit('android', 'rewarded'), 'ca-app-pub-3940256099942544/5224354917');
      expect(admobTestUnit('android', 'native_story'), 'ca-app-pub-3940256099942544/2247696110');
      expect(admobTestUnit('android', 'native_story', videoOnly: true), 'ca-app-pub-3940256099942544/1044960115');
      expect(admobTestUnit('ios', 'native_story', videoOnly: true), 'ca-app-pub-3940256099942544/2521693316');
    });

    test('consent strings, content rating and the npa extra', () {
      expect(admobConsentStatusName(ConsentStatus.required), 'REQUIRED');
      expect(admobConsentStatusName(ConsentStatus.notRequired), 'NOT_REQUIRED');
      expect(admobConsentStatusName(ConsentStatus.obtained), 'OBTAINED');
      expect(admobConsentStatusName(ConsentStatus.unknown), 'UNKNOWN');
      expect(admobPrivacyOptionsName(PrivacyOptionsRequirementStatus.required), 'REQUIRED');
      expect(admobPrivacyOptionsName(PrivacyOptionsRequirementStatus.notRequired), 'NOT_REQUIRED');
      expect(admobMaxContentRating('General'), MaxAdContentRating.g);
      expect(admobMaxContentRating('other'), MaxAdContentRating.unspecified);
      expect(admobRequest(true).extras, {'npa': '1'});
      expect(admobRequest(false).extras, isNull);
    });
  });

  group('AdmobNativeChannel', () {
    test('story calls carry the plugin arguments', () async {
      final native = AdmobNativeChannel();
      await native.prepareNativeStoryAd(adId: 'u', isTesting: true, npa: false, videoOnly: true);
      await native.showNativeStoryAd(adId: 'u');
      await native.removeNativeStoryAd();
      expect(calls.map((c) => c.method), ['prepareNativeStoryAd', 'showNativeStoryAd', 'removeNativeStoryAd']);
      expect(calls.first.arguments, {'adId': 'u', 'isTesting': true, 'npa': false, 'videoOnly': true});
      expect(calls[1].arguments, {'adId': 'u'});
    });

    test('a rejected prepare surfaces as an error', () async {
      answer = (call) => throw PlatformException(code: 'UNAVAILABLE', message: 'Native story ad unavailable');
      await expectLater(AdmobNativeChannel().prepareNativeStoryAd(adId: 'u', isTesting: false, npa: true, videoOnly: false),
          throwsA(isA<PlatformException>()));
    });

    test('NativeAdmobAppId prefers the declared id, falls back otherwise', () async {
      answer = (call) => 'ca-app-pub-1234567890123456~1234567890';
      final id = NativeAdmobAppId(AdmobNativeChannel(), fallback: (p) => 'fallback-$p');
      expect(id.resolve('ios'), 'fallback-ios');
      await pumpEventQueue();
      expect(id.resolve('ios'), 'ca-app-pub-1234567890123456~1234567890');

      answer = (call) => 'not-an-id';
      final bad = NativeAdmobAppId(AdmobNativeChannel(), fallback: (p) => 'fallback-$p');
      await pumpEventQueue();
      expect(bad.resolve('android'), 'fallback-android');

      answer = (call) => throw PlatformException(code: 'x');
      final failed = NativeAdmobAppId(AdmobNativeChannel(), fallback: (p) => 'fallback-$p');
      await pumpEventQueue();
      expect(failed.resolve('android'), 'fallback-android');
    });
  });

  group('GoogleMobileAdsSdk', () {
    test('listeners receive native story events until removed', () async {
      final sdk = GoogleMobileAdsSdk(platform: 'android');
      final seen = <String>[];
      final handle = await sdk.addListener(AdmobEvents.storyShowed, (_) => seen.add('shown'));
      await sdk.addListener(AdmobEvents.storyDismissed, (_) => seen.add('dismissed'));
      await nativeEvent('nativeStoryAdShowed');
      await handle.remove();
      await nativeEvent('nativeStoryAdShowed');
      await nativeEvent('nativeStoryAdDismissed');
      expect(seen, ['shown', 'dismissed']);
    });

    test('consent info, initialize without waiting for adapters, muted', () async {
      final consent = _FakeConsent()..status = ConsentStatus.obtained;
      final ads = _FakeMobileAds();
      final sdk = GoogleMobileAdsSdk(platform: 'ios', consentInformation: consent, mobileAds: ads);
      final info = await sdk.requestConsentInfo();
      expect(info.status, 'OBTAINED');
      expect(info.canRequestAds, isTrue);
      expect(info.isConsentFormAvailable, isFalse);
      expect(info.privacyOptionsRequirementStatus, 'REQUIRED');
      await sdk.initialize(maxAdContentRating: 'General');
      await sdk.setApplicationMuted(true);
      expect(ads.calls, ['updateRequestConfiguration', 'initialize', 'setAppMuted:true']);
      expect(ads.configuration!.maxAdContentRating, MaxAdContentRating.g);
      expect(ads.configuration!.testDeviceIds, isEmpty);
    });

    test('a failed consent update rejects', () async {
      final sdk = GoogleMobileAdsSdk(platform: 'ios', consentInformation: _FakeConsent()..fail = true, mobileAds: _FakeMobileAds());
      await expectLater(sdk.requestConsentInfo(), throwsA(isA<StateError>()));
    });

    test('showing an unprepared interstitial or reward rejects', () async {
      final sdk = GoogleMobileAdsSdk(platform: 'android');
      await expectLater(sdk.showInterstitial(adId: 'x'), throwsA(isA<StateError>()));
      await expectLater(sdk.showRewardVideoAd(adId: 'x'), throwsA(isA<StateError>()));
    });

    testWidgets('no banner renders nothing', (tester) async {
      final sdk = GoogleMobileAdsSdk(platform: 'android');
      await tester.pumpWidget(Directionality(
        textDirection: TextDirection.ltr,
        child: Builder(builder: (context) => sdk.buildBannerView(context)!),
      ));
      expect(find.byType(AdWidget), findsNothing);
      await sdk.removeBanner();
    });

    test('adapter story flow over the channel: prepare, show, showed, dismissed', () async {
      final consent = _FakeConsent();
      final sdk = GoogleMobileAdsSdk(platform: 'android', consentInformation: consent, mobileAds: _FakeMobileAds());
      final adapter = NativeAdmobAdapter(sdk);
      expect((await adapter.consent()).canRequestAds, isTrue);
      answer = (call) => call.method == 'prepareNativeStoryAd' ? {'adUnitId': 'u', 'hasVideo': false} : null;
      expect(await adapter.prepareStory('u', 'live', true, false), isTrue);
      expect(calls.last.arguments, {'adId': 'u', 'isTesting': false, 'npa': true, 'videoOnly': false});
      var shown = 0, impressions = 0;
      final result = adapter.showStory('u', false, () => true,
          FullscreenCallbacks(shown: () => shown++, impression: () => impressions++, rewarded: () {}));
      await pumpEventQueue();
      expect(calls.last.method, 'showNativeStoryAd');
      await nativeEvent('nativeStoryAdShowed');
      await nativeEvent('nativeStoryAdImpression');
      await nativeEvent('nativeStoryAdDismissed');
      expect(await result, (shown: true, rewarded: false));
      expect((shown, impressions), (1, 1));
    });
  });
}
