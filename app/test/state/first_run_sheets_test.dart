// Ported from: (no vitest suite) — src/pages/Index.tsx `blocked={lockOffer || lockSetup || autoFeedback || …}`
import 'dart:async';

import 'package:anacan/state/first_run_sheets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a sheet counts as open while it is shown, also when showing it fails', () async {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    final sheets = c.read(firstRunSheetsProvider.notifier);
    final done = Completer<bool>();
    final shown = sheets.during(FirstRunSheet.lockOffer, () => done.future);
    expect(c.read(firstRunSheetsProvider), {FirstRunSheet.lockOffer});
    sheets.open(FirstRunSheet.autoFeedback);
    done.complete(true);
    expect(await shown, isTrue);
    expect(c.read(firstRunSheetsProvider), {FirstRunSheet.autoFeedback});
    sheets.close(FirstRunSheet.autoFeedback);
    expect(c.read(firstRunSheetsProvider), isEmpty);

    await expectLater(sheets.during(FirstRunSheet.lockSetup, () async => throw StateError('x')), throwsStateError);
    expect(c.read(firstRunSheetsProvider), isEmpty);
  });
}
