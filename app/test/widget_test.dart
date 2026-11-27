// Ported from: src/main.tsx (smoke test of the native consumer entry; replaces the template counter test)
import 'dart:async';

import 'package:anacan/app/anacan_app.dart';
import 'package:anacan/core/app_bootstrap.dart';
import 'package:anacan/features/startup/startup.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'app/app_test_support.dart';
import 'support/i18n_fakes.dart';

void main() {
  setUp(() {
    installTestI18n();
    GateHost.brandSplashShown = false;
  });

  testWidgets('cold start: splash first, then the routed app with the shell', (tester) async {
    final startup = Completer<StartupResult>();
    await tester.pumpWidget(AnacanApp(
      createContainer: () => testAppContainer(),
      runStartup: FakeStartup([startup.future]).call,
      prepare: noPrepare,
      watchAdmission: false,
    ));
    expect(find.byType(StartupScreen), findsOneWidget);

    startup.complete(fakeReady());
    await tester.pump();
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(SplashScreen), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
    expect(find.byType(ShellScaffold), findsOneWidget);

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  });
}
