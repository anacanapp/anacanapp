// Ported from: src/lib/customerio-config.ts, src/lib/customerio-tracking.ts, src/lib/customerio.ts,
//              packages/customerio-data-in/index.d.ts (plugin surface)
//
// Customer.io Data In: one selected mobile source per build (environment + EU region), consent-bound identity,
// the `community_post_created` event and screen names. The SDK is a native plugin (packages/customerio-data-in);
// until it exists [customerIoPluginLoaderProvider] fails like React's "CUSTOMERIO_NATIVE_PLUGIN_REQUIRED", so
// nothing is initialised or sent. The CDP write key never crosses into Dart: the native side reads it from its
// shipped configuration.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'analytics_screen.dart';

@immutable
class CustomerIoConfig {
  const CustomerIoConfig({required this.environment}) : region = 'EU';

  /// Always `EU`.
  final String region;

  /// `sandbox` | `production`.
  final String environment;

  Map<String, Object?> toJson() => {'region': region, 'environment': environment};

  @override
  bool operator ==(Object other) => other is CustomerIoConfig && other.region == region && other.environment == environment;
  @override
  int get hashCode => Object.hash(region, environment);
}

/// `readCustomerIoConfig(env)`: each build contains one selected mobile source, never both environments.
CustomerIoConfig? readCustomerIoConfig(Map<String, Object?> env) {
  if (env['VITE_CUSTOMERIO_ENABLED'] != 'true') return null;
  final environment = env['VITE_CUSTOMERIO_ENVIRONMENT'];
  if (!const ['sandbox', 'production'].contains('$environment') || env['VITE_CUSTOMERIO_REGION'] != 'EU') return null;
  return CustomerIoConfig(environment: '$environment');
}

/// The `VITE_CUSTOMERIO_*` build inputs as `--dart-define=ANACAN_CUSTOMERIO_ENABLED|ENVIRONMENT|REGION` (the same
/// Codemagic environment group values; no key is involved).
const Map<String, Object?> kCustomerIoBuildEnv = {
  'VITE_CUSTOMERIO_ENABLED': String.fromEnvironment('ANACAN_CUSTOMERIO_ENABLED'),
  'VITE_CUSTOMERIO_ENVIRONMENT': String.fromEnvironment('ANACAN_CUSTOMERIO_ENVIRONMENT'),
  'VITE_CUSTOMERIO_REGION': String.fromEnvironment('ANACAN_CUSTOMERIO_REGION'),
};

/// `CustomerIoDataInPlugin` (native).
abstract interface class CustomerIoDataInPlugin {
  Future<void> initialize(CustomerIoConfig config);
  Future<void> identify({required String userId, required Map<String, Object> traits});
  Future<void> reset();
  Future<void> track({required String name, required Map<String, Object> properties});
  Future<void> screen({required String title, required Map<String, Object> properties});
}

@immutable
class CustomerIoIdentity {
  const CustomerIoIdentity({required this.userId, required this.backend, required this.language, required this.consent});
  final String userId;
  final String backend;
  final String language;
  final bool consent;

  CustomerIoIdentity copyWith({String? userId, String? backend, bool? consent}) =>
      CustomerIoIdentity(userId: userId ?? this.userId, backend: backend ?? this.backend, language: language, consent: consent ?? this.consent);

  @override
  bool operator ==(Object other) =>
      other is CustomerIoIdentity && other.userId == userId && other.backend == backend && other.language == language && other.consent == consent;
  @override
  int get hashCode => Object.hash(userId, backend, language, consent);
  @override
  String toString() => 'CustomerIoIdentity($userId, $backend, $language, $consent)';
}

final RegExp _screenName = RegExp(r'^[A-Za-z][A-Za-z0-9 _-]{0,79}$');

/// `createCustomerIoTracking(config, load, currentScreen)`: serializes identity changes and events so a delayed
/// login/post cannot track against another account. Only fixed behavioural fields leave the app.
class CustomerIoTracking {
  CustomerIoTracking(this.config, this._load, {AnalyticsScreen? Function()? currentScreen})
      : _currentScreen = currentScreen ?? (() => null);

  final CustomerIoConfig? config;
  final Future<CustomerIoDataInPlugin> Function() _load;
  final AnalyticsScreen? Function() _currentScreen;

  CustomerIoDataInPlugin? _plugin;
  Future<void>? _initialization;
  CustomerIoIdentity? _desired;
  int _revision = 0;
  String? _identified;
  String _identifiedTraits = '';
  int? _lastScreen;
  int _manualScreen = 0;
  Future<void> _pending = Future<void>.value();
  final Set<String> _sentPosts = <String>{};

  static String? _owner(CustomerIoIdentity? identity) => identity == null ? null : '${identity.backend}:${identity.userId}';

  /// Optional analytics must not break auth, navigation, or a completed mutation.
  Future<void> _queue(Future<void> Function() task) {
    _pending = _pending.then((_) => task()).catchError((Object _) {});
    return _pending;
  }

  Future<void> _initialize() {
    final existing = _initialization;
    if (existing != null) return existing;
    final future = () async {
      try {
        final loaded = await _load();
        await loaded.initialize(config!);
        _plugin = loaded;
      } catch (_) {
        throw StateError('CUSTOMERIO_UNAVAILABLE');
      }
    }();
    _initialization = future;
    unawaited(future.catchError((Object _) {
      if (identical(_initialization, future)) _initialization = null;
    }));
    return future;
  }

  Future<void> _sendScreen(CustomerIoDataInPlugin sdk, AnalyticsScreen screen) async {
    if (_lastScreen == screen.id || !_screenName.hasMatch(screen.title)) return;
    final category = screen.category;
    await sdk.screen(title: screen.title, properties: {
      'environment': config!.environment,
      if (category != null && _screenName.hasMatch(category)) 'screen_class': category,
    });
    _lastScreen = screen.id;
  }

  Future<void> setIdentity(CustomerIoIdentity? identity) {
    final next = config != null && identity != null && identity.consent && identity.userId.isNotEmpty && identity.backend.isNotEmpty ? identity : null;
    if (_owner(next) != _owner(_desired)) _revision++;
    _desired = next;
    final version = _revision;
    return _queue(() async {
      if (version != _revision) return;
      if (next == null) {
        final plugin = _plugin;
        if (plugin != null) await plugin.reset();
        _identified = null;
        _identifiedTraits = '';
        _lastScreen = null;
        return;
      }
      await _initialize();
      final sdk = _plugin!;
      if (version != _revision || _owner(next) != _owner(_desired)) return;
      final key = _owner(next)!;
      final language = RegExp(r'^[a-z]{2}$').hasMatch(next.language) ? next.language : 'en';
      final traits = <String, Object>{'language': language, 'environment': config!.environment};
      final serialized = jsonEncode(traits);
      if (_identified == key && _identifiedTraits == serialized) return;
      if (_identified != null && _identified != key) {
        await sdk.reset();
        _identified = null;
        _lastScreen = null;
      }
      if (version != _revision) return;
      await sdk.identify(userId: next.userId, traits: traits);
      _identified = key;
      _identifiedTraits = serialized;
      // The screen may mount before the consent/auth query completes. Emit the screen that is visible now, not
      // a history of pre-consent navigation.
      final active = _currentScreen();
      if (version == _revision && active != null) await _sendScreen(sdk, active);
    });
  }

  Future<void> postCreated(String userId, String backend, String operationId) {
    final key = _owner(_desired), version = _revision;
    if (key == null || key != '$backend:$userId' || operationId.isEmpty) return Future<void>.value();
    final eventKey = '$key:$operationId';
    return _queue(() async {
      final plugin = _plugin;
      if (plugin == null || version != _revision || _identified != key || _sentPosts.contains(eventKey)) return;
      await plugin.track(name: 'community_post_created', properties: {'environment': config!.environment, 'entry_point': 'community'});
      _sentPosts.add(eventKey);
      if (_sentPosts.length > 500) _sentPosts.remove(_sentPosts.first);
    });
  }

  Future<void> screen(String title, [String? category]) {
    final key = _owner(_desired), version = _revision;
    if (key == null || !_screenName.hasMatch(title)) return Future<void>.value();
    final active = _currentScreen();
    final screen = active?.title == title ? active! : AnalyticsScreen(id: --_manualScreen, title: title, category: category);
    return _queue(() async {
      final plugin = _plugin;
      if (plugin == null || version != _revision || _identified != key) return;
      if (screen.id > 0 && _currentScreen()?.id != screen.id) return;
      await _sendScreen(plugin, screen);
    });
  }
}

/// `Capacitor.isPluginAvailable('CustomerIoDataIn') ? plugin : throw`. Default: no plugin in this build.
final customerIoPluginLoaderProvider = Provider<Future<CustomerIoDataInPlugin> Function()>(
    (ref) => () async => throw StateError('CUSTOMERIO_NATIVE_PLUGIN_REQUIRED'));

/// The selected Customer.io source of this build (null = disabled, React `customerIoEnabled === false`).
final customerIoConfigProvider = Provider<CustomerIoConfig?>((ref) => readCustomerIoConfig(kCustomerIoBuildEnv));

/// `customerIo` (module singleton).
final customerIoProvider = Provider<CustomerIoTracking>((ref) {
  final registry = ref.watch(analyticsScreenRegistryProvider);
  return CustomerIoTracking(ref.watch(customerIoConfigProvider), ref.watch(customerIoPluginLoaderProvider), currentScreen: registry.current);
});
