// Ported from: packages/customerio-data-in/index.d.ts (the CustomerIoDataIn plugin surface)
//
// [CustomerIoDataInPlugin] over the `anacan/customerio` method channel. Native side: Android `CustomerIoPlugin.kt`
// (Data Pipelines SDK; rejects initialize without the anacan_customerio_* build configuration), iOS
// `CustomerIoChannel.swift` (rejects initialize unless CioDataPipelines is in the build and configured). The CDP write key never
// crosses the channel: initialize sends only the region and environment this build expects, and the native side
// compares them with its own configuration.
import 'package:flutter/services.dart';

import 'customerio.dart';

class MethodChannelCustomerIo implements CustomerIoDataInPlugin {
  const MethodChannelCustomerIo({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/customerio';
  final MethodChannel _channel;

  @override
  Future<void> initialize(CustomerIoConfig config) => _channel.invokeMethod<void>('initialize', config.toJson());

  @override
  Future<void> identify({required String userId, required Map<String, Object> traits}) =>
      _channel.invokeMethod<void>('identify', <String, Object?>{'userId': userId, 'traits': traits});

  @override
  Future<void> track({required String name, required Map<String, Object> properties}) =>
      _channel.invokeMethod<void>('track', <String, Object?>{'name': name, 'properties': properties});

  @override
  Future<void> screen({required String title, required Map<String, Object> properties}) =>
      _channel.invokeMethod<void>('screen', <String, Object?>{'title': title, 'properties': properties});

  @override
  Future<void> reset() => _channel.invokeMethod<void>('reset');
}
