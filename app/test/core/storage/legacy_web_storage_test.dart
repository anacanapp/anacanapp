// Ported from: (Flutter-only) Dart half of the hidden-WebView migration fallback (channel az.anacan/legacy_web_storage).

import 'dart:convert';

import 'package:anacan/core/storage/legacy_web_storage.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannelLegacyWebStorageReader.defaultChannel;
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  test('a fresh install answers None without creating a WebView', () async {
    final calls = <String>[];
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call.method);
      return call.method == 'hasLegacyData' ? false : null;
    });
    expect(await const MethodChannelLegacyWebStorageReader().read(), isA<LegacyWebStorageNone>());
    expect(calls, ['hasLegacyData']);
  });

  test('reads with the rule script and returns the filtered entries', () async {
    Map<Object?, Object?>? readArgs;
    messenger.setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'hasLegacyData') return true;
      readArgs = call.arguments as Map<Object?, Object?>;
      return jsonEncode({'length': 3, 'entries': {'anacan_lock_enabled': '1', 'sb-a-auth-token': 't'}});
    });
    final result = await const MethodChannelLegacyWebStorageReader(timeout: Duration(seconds: 2)).read();
    expect(result, isA<LegacyWebStorageEntries>().having((r) => r.entries, 'entries', {'anacan_lock_enabled': '1'}));
    expect(readArgs!['timeoutMs'], 2000);
    expect(readArgs!['script'], contains('localStorage'));
  });

  test('failures never throw and never carry the native message', () async {
    expect(await const MethodChannelLegacyWebStorageReader().read(),
        isA<LegacyWebStorageFailed>().having((r) => r.reason, 'reason', 'unavailable'));
    messenger.setMockMethodCallHandler(channel, (call) async {
      if (call.method == 'hasLegacyData') return true;
      throw PlatformException(code: 'TIMEOUT', message: 'value: secret');
    });
    expect(await const MethodChannelLegacyWebStorageReader().read(),
        isA<LegacyWebStorageFailed>().having((r) => r.reason, 'reason', 'TIMEOUT'));
    messenger.setMockMethodCallHandler(channel, (call) async => call.method == 'hasLegacyData' ? true : 'garbage');
    expect(await const MethodChannelLegacyWebStorageReader().read(),
        isA<LegacyWebStorageFailed>().having((r) => r.reason, 'reason', 'malformed'));
  });
}
