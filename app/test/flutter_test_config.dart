// Ported from: (test configuration, no React counterpart)
//
// The golden PNGs under test/**/goldens were rendered on Linux. Text rasterisation differs on macOS (Codemagic's
// mac_mini_m2) and Windows, so a pixel comparison there fails on every golden that contains text (1–2 % of the
// pixels). On those hosts a pixel mismatch is reported but does not fail the test; the widget tree is still
// built, laid out and painted, so overflow and exceptions still fail. Linux, or ANACAN_STRICT_GOLDENS=1,
// compares strictly. Regenerate goldens on Linux only (`flutter test --update-goldens`).
import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

bool get _strictGoldens => Platform.isLinux || Platform.environment['ANACAN_STRICT_GOLDENS'] == '1';

class _HostTolerantComparator extends LocalFileComparator {
  _HostTolerantComparator(super.testFile);

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(imageBytes, await getGoldenBytes(golden));
    if (!result.passed) {
      // ignore: avoid_print
      print('golden (not strict on ${Platform.operatingSystem}): $golden differs by '
          '${(result.diffPercent * 100).toStringAsFixed(2)} %; compared strictly on Linux');
    }
    result.dispose();
    return true;
  }
}

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  final current = goldenFileComparator;
  if (!_strictGoldens && !autoUpdateGoldenFiles && current is LocalFileComparator) {
    goldenFileComparator = _HostTolerantComparator(current.basedir.resolve('flutter_test_config.dart'));
  }
  await testMain();
}
