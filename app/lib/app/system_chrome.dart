// Ported from: src/components/ThemeStatusBarSync.tsx, src/lib/native.ts (initializeNativeFeatures → statusBar),
//              capacitor.config.json (ios.contentInset "never", backgroundColor #FAF7F4), index.html
//              (viewport-fit=cover, user-scalable=no), android/app/src/main/java/.../MainActivity.java (no textZoom)
//
// Text scale (WebView equivalence, docs/flutter/APP_ROOT.md §4):
//   iOS     — WKWebView ignores Dynamic Type for CSS px text (the app never uses `-apple-system-body`), and
//             `user-scalable=no` blocks pinch zoom → no text scaling, bold-text off.
//   Android — Chromium WebView initialises `WebSettings.textZoom` from the system font scale (linear:
//             100 × fontScale %), and MainActivity / Capacitor never reset it. The manifest does not list
//             `fontScale` in configChanges, so a font-size change recreates the activity and the WebView picks
//             up the new value → linear scaling by the live system font scale (not Android 14's non-linear
//             curve), bold-text off.
//   other   — the platform default.
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// The text scaler the WebView would have applied on [platform].
TextScaler webViewTextScaler(TargetPlatform platform, {required double systemFontScale, required TextScaler fallback}) =>
    switch (platform) {
      TargetPlatform.iOS => TextScaler.noScaling,
      TargetPlatform.android => TextScaler.linear(systemFontScale),
      _ => fallback,
    };

/// Replaces the platform text scaling with [webViewTextScaler].
class WebViewTextScale extends StatelessWidget {
  const WebViewTextScale({super.key, required this.child, this.platform});
  final Widget child;

  /// Defaults to [defaultTargetPlatform].
  final TargetPlatform? platform;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final p = platform ?? defaultTargetPlatform;
    if (p != TargetPlatform.iOS && p != TargetPlatform.android) return child;
    final scale = View.maybeOf(context)?.platformDispatcher.textScaleFactor ?? 1.0;
    return MediaQuery(
      data: mq.copyWith(
        textScaler: webViewTextScaler(p, systemFontScale: scale, fallback: mq.textScaler),
        boldText: false,
      ),
      child: child,
    );
  }
}

/// Status bar style for the resolved theme: `StatusBar.setStyle(dark ? Style.Dark : Style.Light)` — light icons
/// on the dark theme, dark icons otherwise. Bars are transparent (edge-to-edge, `contentInset: never`).
SystemUiOverlayStyle statusBarStyleFor({required bool dark}) => SystemUiOverlayStyle(
      statusBarColor: const Color(0x00000000),
      systemNavigationBarColor: const Color(0x00000000),
      systemNavigationBarDividerColor: const Color(0x00000000),
      systemNavigationBarContrastEnforced: false,
      statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
      // iOS: brightness of the *bar* (dark bar → light content).
      statusBarBrightness: dark ? Brightness.dark : Brightness.light,
      systemNavigationBarIconBrightness: dark ? Brightness.light : Brightness.dark,
    );

/// `<ThemeStatusBarSync />`: keeps the status bar icons readable on the in-app theme.
class ThemeStatusBarSync extends StatelessWidget {
  const ThemeStatusBarSync({super.key, required this.dark, required this.child});
  final bool dark;
  final Widget child;

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(value: statusBarStyleFor(dark: dark), child: child);
}

/// Edge-to-edge drawing under the status and navigation bars (the WebView's `viewport-fit=cover`; insets come
/// through `MediaQuery.viewPadding` like `env(safe-area-inset-*)`). Before the first frame:
/// `initializeNativeFeatures` sets `Style.Dark` (light icons) only after the backend opened; the native splash
/// is cream, so the boot screens use dark icons.
Future<void> configureSystemChrome() async {
  try {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setSystemUIOverlayStyle(statusBarStyleFor(dark: false));
  } catch (_) {
    // no platform channel (tests / desktop)
  }
}
