# Brief for a porting agent (one feature folder at a time)

You port one part of the Anacan consumer app from React/Capacitor (`src/`) to Flutter (`app/`), next to other agents
working in other folders. The orchestrator integrates, runs the full suite, commits and pushes.

## Environment (Windows host)
- Flutter 3.50.1 at `C:\flutter\bin`; in PowerShell prefix commands with `$env:Path += ';C:\flutter\bin';`.
  Use `node`, `npm.cmd`, `npx.cmd`. PowerShell 5: no `??`, no `&&`.
- Run only scoped checks from `app/`: `flutter analyze lib/features/<yours> test/features/<yours>` and
  `flutter test test/features/<yours>`. Never the whole suite (30+ min; the orchestrator runs it).
- Goldens committed in the repo were rendered on Linux; `app/test/flutter_test_config.dart` makes pixel diffs
  non-fatal on other hosts. New goldens you create here are Windows renders — say so in your report.
- No git commands that change state (no add/commit/push/checkout/reset).

## Read first
1. `docs/flutter/CONTRACT.md` — the rules (parity first; `// Ported from: <src path>` header on every Dart file;
   logic and its vitest cases first, then UI; strings only via `tr(key, azDefault)` / existing copy helpers with the
   React keys — `node app/tool/i18n/find-key.mjs "<az text>"`; colours/radii/shadows from
   `package:anacan/design/design.dart` tokens, a one-off React literal stays with a comment).
2. `docs/flutter/SHELL.md` (registration §11, transitions §4, push/deeplinks §8), `docs/flutter/APP_ROOT.md`,
   `docs/flutter/WIRING.md` (interfaces waiting for your feature).
3. `app/lib/core/cache/README.md` — React Query → Dart (`queryProvider`, `mutationProvider`, realtime helper).
4. Grep `app/lib` before porting a hook or helper: many are already ported (core, domain, home, baby, settings,
   premium, moderation, tools kit). Do not duplicate; import.
5. Reusable UI: `app/lib/design/` (tokens, `ACard`, `AButton`, `ASheet`/`showASheet`, `AToastHost`, `AIcon`/`AIcons`,
   `PressScale`, `AGlass`), `app/lib/features/settings/ui/settings_ui.dart` (`px()`, `ATopbar`, `AIconBtn`,
   shadcn-like `ShadButton`, `ShadInput`, `ShadDialogFrame`, `ALoader`, `cssUpper`, `toasts(context)`).
   Test harnesses: `app/test/features/settings/support/harness.dart` (`pumpApp`, `baseOverrides`, `screenTest`),
   `app/test/features/onboarding/support.dart` (`OnboardingTestEnv`, fake purchases/db).

## Rules for your output
- Code only in your assigned folders (`app/lib/features/<x>/`, `app/test/features/<x>/`). Do not edit
  `app/lib/app/*`, `app/pubspec.yaml`, shell, design, core or other features. If something there must change,
  put the exact change in your report.
- Export `void register<X>Feature(FeatureRegistry r)` from `app/lib/features/<x>/register.dart`.
- A dependency on a feature that does not exist yet: define a provider/slot with a safe default in your folder and
  list it for `docs/flutter/WIRING.md`.
- React bugs you find: fix them in Dart and list them (one line each) for `docs/flutter/PARITY_FIXES.md`.
- Never claim device behaviour; nothing here runs on a device.

## Final report (English, concise)
Files created; test count; verified vs not verified; parity fixes; exact edits needed outside your folders
(registration line, `app_wiring.dart` overrides, pubspec deps with versions, assets); interfaces left on defaults.
