// Ported from: src/components/ErrorBoundary.tsx (fallback UI), src/components/RootErrorBoundary.tsx
//
// Flutter has no error boundaries: a build/layout exception replaces only the failing widget with
// `ErrorWidget.builder`'s output. The app root installs [ErrorBoundaryFallback] as that builder in release
// builds (debug keeps Flutter's red error box) and reports the error through the crash reporter
// (`reportComponentCrash`, from `FlutterError.onError`). "Retry" asks the root to rebuild the tree
// (`setState({hasError:false})` re-renders the children in React). The chunk-load / offline branch of
// ErrorBoundary is web-only (lazy chunks do not exist natively) and is not ported.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show Theme;

import '../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../core/i18n/tr.dart' show tr;
import '../../design/theme.dart';

/// Rebuild request from an error fallback (the root listens and remounts its subtree).
final errorBoundaryResetProvider = NotifierProvider<ErrorBoundaryReset, int>(ErrorBoundaryReset.new);

class ErrorBoundaryReset extends Notifier<int> {
  @override
  int build() => 0;
  void reset() => state++;
}

/// ErrorBoundary's default fallback: "Xəta baş verdi", the error message (or "Naməlum xəta"), "Yenidən cəhd et".
class ErrorBoundaryFallback extends StatelessWidget {
  const ErrorBoundaryFallback({super.key, this.message, this.onRetry});

  /// `this.state.error?.message`.
  final String? message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final base = (Theme.of(context).textTheme.bodyMedium ?? const TextStyle(fontSize: 16, height: 1.5))
        .copyWith(color: s.foreground, decoration: TextDecoration.none);
    final msg = message;
    return DefaultTextStyle(
      style: base,
      child: ColoredBox(
        color: s.background,
        // flex flex-col items-center justify-center min-h-screen p-6
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // text-lg font-semibold mb-2
                  Text(
                    tr('errorboundary_xeta_bas_verdi_f22fba', 'Xəta baş verdi'),
                    textAlign: TextAlign.center,
                    style: base.copyWith(fontSize: 18, height: 28 / 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  // text-sm text-muted-foreground text-center mb-4
                  Text(
                    msg != null && msg.isNotEmpty ? msg : tr('errorboundary_namelum_xeta_aa30e7', 'Naməlum xəta'),
                    textAlign: TextAlign.center,
                    style: base.copyWith(fontSize: 14, height: 20 / 14, color: s.mutedForeground),
                  ),
                  const SizedBox(height: 16),
                  // px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm
                  Semantics(
                    button: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: onRetry,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(color: s.primary, borderRadius: BorderRadius.circular(16)),
                        child: Text(
                          tr('errorboundary_yeniden_cehd_et_d273ac', 'Yenidən cəhd et'),
                          style: base.copyWith(fontSize: 14, height: 20 / 14, color: s.primaryForeground),
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

/// [ErrorBoundaryFallback] wired to the root reset and the active language (re-renders on a switch).
class ConnectedErrorBoundaryFallback extends ConsumerWidget {
  const ConnectedErrorBoundaryFallback({super.key, this.message});
  final String? message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appLanguageProvider);
    return ErrorBoundaryFallback(message: message, onRetry: () => ref.read(errorBoundaryResetProvider.notifier).reset());
  }
}
