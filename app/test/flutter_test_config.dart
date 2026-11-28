// Ported from: (test configuration, no React counterpart)
//
// The golden PNGs under test/**/goldens were rendered on Linux. Text rasterisation differs on macOS (Codemagic's
// mac_mini_m2) and Windows, so a pixel comparison there fails on every golden that contains text (1–2 % of the
// pixels). On those hosts a pixel mismatch is reported but does not fail the test; the widget tree is still
// built, laid out and painted, so overflow and exceptions still fail. Linux, or ANACAN_STRICT_GOLDENS=1,
// compares strictly. Regenerate goldens on Linux only (`flutter test --update-goldens`).
//
// flutter_test paints BoxShadows without blur by default (`debugDisableShadows`), which hides the CSS-style soft
// and negative-spread shadows. Test files that sit next to a goldens/ directory run with real shadows instead:
// the binding below reports `disableShadows == false`, so the per-test invariant check expects shadows on too.
// (The flag cannot be flipped per test: the invariant check runs before any setUp-registered tear-down.)
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

class _ShadowTestBinding extends AutomatedTestWidgetsFlutterBinding {
  @override
  bool get disableShadows => false;
}

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  final current = goldenFileComparator;
  // Initialised before any test so TestWidgetsFlutterBinding.ensureInitialized() (testWidgets) returns it. Only
  // next to a goldens/ directory (every golden lives in `<test dir>/goldens/`): a binding also changes pure-Dart
  // tests (rootBundle and platform channels start answering), which elsewhere keep running without one.
  if (current is LocalFileComparator && Directory.fromUri(current.basedir.resolve('goldens/')).existsSync()) {
    _ShadowTestBinding();
  }
  if (!_strictGoldens && !autoUpdateGoldenFiles && current is LocalFileComparator) {
    goldenFileComparator = _HostTolerantComparator(current.basedir.resolve('flutter_test_config.dart'));
  }
  await testMain();
}
