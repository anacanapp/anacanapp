// Ported from: src/App.tsx (provider tree: AuthProvider, Theme, Direction, MotionConfig …) — the Riverpod
//              overrides that wire the shell, the design layer and the startup feature together.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../core/auth/auth_controller.dart' show AuthSideEffects, authSideEffectsProvider;
import '../design/device_tier.dart' show liteModeProvider;
import '../features/startup/app_update/app_update.dart' show legacyForceUpdateGateProvider, updateCentreForceGateProvider;
import '../shell/feature_registry.dart';
import '../state/shell_bindings.dart';
import 'crash_reporter.dart';
import 'device_tier.dart';
import 'feature_registrations.dart';

/// Every override the root [ProviderContainer] is created with (docs/flutter/APP_ROOT.md §2).
///
/// [includeShellState] = false leaves the shell inputs (`shellUserProvider`, `gateInputsProvider`, …) to the
/// caller (tests pass fixtures in [extra]). [extra] goes last.
List<Override> appRootOverrides({
  bool includeShellState = true,
  FeatureRegistry? registry,
  List<Override> extra = const [],
}) =>
    [
      if (includeShellState) ...shellStateOverrides(),
      featureRegistryProvider.overrideWithValue(registry ?? buildFeatureRegistry()),
      // html.a-lite / MotionConfig reducedMotion: the design layer reads lite from the probed device tier.
      liteModeProvider.overrideWith((ref) => ref.watch(appLiteModeProvider)),
      // Index's update-centre and legacy force-update inputs (useAppUpdate / useForceUpdate).
      updateCentreForceProvider.overrideWith((ref) => ref.watch(updateCentreForceGateProvider)),
      legacyForceUpdateProvider.overrideWith((ref) => ref.watch(legacyForceUpdateGateProvider)),
      // AuthContext → reportAuthError (crash reports for sign-in failures).
      authSideEffectsProvider.overrideWithValue(
        AuthSideEffects(reportAuthError: (provider, error) => CrashReporting.reportAuthError(provider, error)),
      ),
      ...extra,
    ];

/// The production container.
ProviderContainer createAppContainer() => ProviderContainer(overrides: appRootOverrides());
