// Ported from: src/App.tsx (ThemeProvider, ThemeStatusBarSync, DirectionProvider, Toaster/Sonner,
//              OfflineSyncIndicator, BrowserRouter + Routes), src/lib/rtl.ts (applyDocumentDirection)
//
// The app once startup opened the backend: MaterialApp.router over the shell router, themed from the persisted
// theme choice and the device tier, localised for the active language.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/i18n/app_languages.dart' show appLanguage;
import '../core/i18n/language_controller.dart' show appLanguageProvider;
import '../design/theme.dart';
import '../design/widgets/a_toast.dart';
import '../features/startup/error_boundary.dart';
import '../features/startup/offline_sync_indicator.dart';
import '../shell/router.dart';
import 'device_tier.dart';
import 'localization.dart';
import 'system_chrome.dart';
import 'theme_mode.dart';

/// `<App />` inside the root container.
class RoutedApp extends ConsumerStatefulWidget {
  const RoutedApp({super.key, this.initialLocation = '/'});
  final String initialLocation;

  @override
  ConsumerState<RoutedApp> createState() => _RoutedAppState();
}

class _RoutedAppState extends ConsumerState<RoutedApp> {
  late final GoRouter _router = buildShellRouter(initialLocation: widget.initialLocation);

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // ErrorBoundary "Yenidən cəhd et": render the failing subtrees again (React resets the boundary state).
    ref.listen(errorBoundaryResetProvider, (_, _) => WidgetsBinding.instance.reassembleApplication());
    final language = ref.watch(appLanguageProvider);
    final themeMode = ref.watch(themeModeProvider);
    final tier = ref.watch(deviceTierProvider);
    final locale = appLanguage(language).locale;
    return MaterialApp.router(
      title: 'Anacan',
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: buildAnacanTheme(Brightness.light, locale: locale, lite: tier.lite, noBlur: tier.noBlur),
      darkTheme: buildAnacanTheme(Brightness.dark, locale: locale, lite: tier.lite, noBlur: tier.noBlur),
      themeMode: themeMode,
      // next-themes swaps the `dark` class at once (no cross-fade of the whole palette).
      themeAnimationDuration: Duration.zero,
      locale: locale,
      supportedLocales: kAppSupportedLocales,
      localizationsDelegates: kAppLocalizationsDelegates,
      builder: (context, child) => AppChrome(language: language, child: child ?? const SizedBox.shrink()),
    );
  }
}

/// Everything App.tsx wraps around the router: text scale, `dir`, status bar style, toasters (mounted once),
/// the offline pill.
class AppChrome extends StatelessWidget {
  const AppChrome({super.key, required this.language, required this.child});
  final String language;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return WebViewTextScale(
      child: Directionality(
        textDirection: appDirectionFor(language),
        child: ThemeStatusBarSync(
          dark: dark,
          child: Material(
            type: MaterialType.transparency,
            child: AToastHost(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  child,
                  const OfflineSyncIndicator(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
