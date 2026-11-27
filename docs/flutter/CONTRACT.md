# Flutter port: working contract

Plan: `docs/FLUTTER_MIGRATION_PLAN.md`. Flutter project: `app/` (Flutter 3.50.1 at `/opt/flutter/bin`, package name `anacan`).
The React app in `src/` is the source of truth for behaviour and visuals. The backend does not change.

## Rules

1. **Parity first.** Port behaviour and visuals exactly. Do not redesign, rename user-facing text, or "improve" flows.
   A React bug that the port fixes is recorded in `docs/flutter/PARITY_FIXES.md` (one line: what, where, why).
2. **Source header.** Every ported Dart file starts with `// Ported from: <path under src/>` (several paths if merged).
3. **Logic before UI.** Port pure logic with its vitest cases as Dart tests first; a ported test file keeps the case names.
4. **Layout.** `app/lib/core/` (admission, session, storage, i18n, cache), `app/lib/design/` (tokens, widgets),
   `app/lib/shell/`, `app/lib/features/<feature>/`, `app/lib/native/`. Tests mirror the path under `app/test/`.
5. **State:** Riverpod (`flutter_riverpod`). **Routing:** `go_router` for outer routes only; the in-app screen state
   machine mirrors `src/pages/Index.tsx`.
6. **Strings:** never hard-code user-facing text. Use `tr(key, azDefault)` from `app/lib/core/i18n/` with the same keys
   as the React app, so the `translations` table overlay keeps working.
7. **Colours, radii, shadows, easings:** only from generated tokens in `app/lib/design/tokens/`. No literal hex in features
   unless the React source has a one-off literal; then keep the exact value with a comment naming the source line.
8. **Storage compatibility.** Keys and JSON shapes written by the Capacitor app stay byte-compatible where the plan says
   so (session backup, tombstone, adoption receipt, admission pin), so a rollback to Capacitor still works.
9. **Secrets.** Nothing private in Git, logs or chat. Keys arrive through Codemagic environment groups only.
10. **Quality gate:** `flutter analyze` clean and `flutter test` green in `app/` before handing back.
11. **Scope discipline.** Touch only the paths your brief assigns. Do not edit `app/pubspec.yaml` unless your brief says you
    own it; list the dependencies you need in your report instead. Do not commit or push; the orchestrator commits.
12. **Honest reports.** Say what was verified by running it and what was not. Do not claim device behaviour that was not
    exercised; this environment has no Xcode, no Android SDK and no device.
