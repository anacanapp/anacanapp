// Ported from: src/main.tsx (SDK-free retry screen of the bootstrap `catch`), src/lib/startup-i18n.ts
//              (startupText, storedStartupLanguage), src/components/RootErrorBoundary.tsx (fallback)
//
// Rendered before (or without) the i18n runtime: copy comes from the generated `kStartupCopy` map through
// `startupText`, never from `tr`.
import 'package:flutter/widgets.dart';

import '../../core/i18n/app_languages.dart' show materialLocaleFor, normalizeAppLanguage, textDirectionFor;
import '../../core/i18n/tr.dart' show startupText;
import '../../design/theme.dart';
import 'startup_screen.dart' show kBrandMarkAsset;

/// Which message the blocking startup screen shows.
enum AdmissionScreenKind {
  /// `ADMISSION_UPDATE_REQUIRED` → `updateRequired`.
  updateRequired,

  /// Maintenance and every other startup failure → `connectionPending`.
  connectionPending,
}

/// The `<main>` that `src/main.tsx` puts into `#root` when the bootstrap throws: title "Anacan", the message,
/// a retry button (`window.location.reload()` → [onRetry]). `lang`/`dir` from the stored language.
class AdmissionScreen extends StatelessWidget {
  const AdmissionScreen({super.key, required this.kind, required this.language, required this.onRetry});

  final AdmissionScreenKind kind;

  /// `storedStartupLanguage()`.
  final String language;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final lang = normalizeAppLanguage(language);
    // No html.dark before React: always the light body (`bg-background text-foreground font-nunito`).
    final theme = buildAnacanTheme(Brightness.light, locale: materialLocaleFor(lang), lite: false);
    final s = AnacanTokens.light.shadcn;
    final body = theme.textTheme.bodyMedium!;
    final message = kind == AdmissionScreenKind.updateRequired
        ? startupText(lang, 'updateRequired', 'Davam etmək üçün Anacan tətbiqini mağazadan yeniləyin.')
        : startupText(lang, 'connectionPending', 'Bağlantı hazırlanır. Bir qədər sonra yenidən cəhd edin.');
    return Directionality(
      textDirection: textDirectionFor(lang),
      child: DefaultTextStyle(
        style: body,
        textAlign: TextAlign.center,
        child: ColoredBox(
          color: s.background,
          child: SafeArea(
            // min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Semantics(
                      header: true,
                      // text-xl font-semibold
                      child: Text('Anacan', style: body.copyWith(fontSize: 20, height: 28 / 20, fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(height: 16),
                    Text(message),
                    const SizedBox(height: 16),
                    // rounded-xl bg-primary px-6 py-3 text-primary-foreground
                    Semantics(
                      button: true,
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: onRetry,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(12)),
                          child: Text(
                            startupText(lang, 'retry', 'Yenidən cəhd et'),
                            style: body.copyWith(color: s.primaryForeground),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// `RootErrorBoundary` fallback: brand mark, "Anacan", a retry button; inline light styles, SDK-free copy.
/// `background: hsl(var(--background))` follows `html.dark` when the theme already applied it.
class RootErrorFallback extends StatelessWidget {
  const RootErrorFallback({super.key, required this.language, required this.onRetry, this.dark = false});

  final String language;
  final VoidCallback onRetry;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final lang = normalizeAppLanguage(language);
    final s = (dark ? AnacanTokens.dark : AnacanTokens.light).shadcn;
    // fontFamily: system-ui (no bundled family).
    final base = TextStyle(color: s.foreground, fontSize: 16, height: 1.5, decoration: TextDecoration.none);
    return Directionality(
      textDirection: textDirectionFor(lang),
      child: DefaultTextStyle(
        style: base,
        textAlign: TextAlign.center,
        child: ColoredBox(
          color: s.background,
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(kBrandMarkAsset, width: 72, height: 72, excludeFromSemantics: true),
                  const SizedBox(height: 16),
                  Semantics(
                    header: true,
                    child: Text('Anacan', style: base.copyWith(fontSize: 20, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    button: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: onRetry,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        // RootErrorBoundary.tsx inline literal #FF5A5F.
                        decoration: BoxDecoration(color: const Color(0xFFFF5A5F), borderRadius: BorderRadius.circular(12)),
                        child: Text(
                          startupText(lang, 'retry', 'Yenidən cəhd et'),
                          style: base.copyWith(color: const Color(0xFFFFFFFF), fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
