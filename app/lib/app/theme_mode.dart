// Ported from: src/App.tsx (`<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`),
//              node_modules/next-themes (storageKey 'theme', storage event), src/components/AppearanceScreen.tsx
//              (`useTheme()`: theme / setTheme / systemTheme), src/components/ThemeStatusBarSync.tsx (resolvedTheme)
//
// next-themes keeps the choice in localStorage under `theme`: 'light' | 'dark' | 'system' (missing → the default
// 'system'). Any other stored string is applied as a class that no CSS matches, i.e. the light palette, and
// `resolvedTheme` is that string (not 'dark'), so the status bar gets dark icons. The same key and values live in
// the LocalStore (the WebView localStorage equivalent; the 53.0 migration import carries the old value over).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show ThemeMode;

import '../state/persisted_store.dart' show localStoreProvider;

/// next-themes `storageKey` default.
const String kThemeStorageKey = 'theme';

/// AppearanceScreen option ids.
const String kThemeLight = 'light';
const String kThemeDark = 'dark';
const String kThemeSystem = 'system';

/// `ThemeMode` for a stored next-themes value.
ThemeMode themeModeFor(String? theme) => switch (theme) {
      null || '' || kThemeSystem => ThemeMode.system,
      kThemeDark => ThemeMode.dark,
      _ => ThemeMode.light,
    };

/// The persisted theme choice. State = the [ThemeMode] the app renders with; [theme] = next-themes' `theme`.
final themeModeProvider = NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

class ThemeModeController extends Notifier<ThemeMode> {
  String _theme = kThemeSystem;

  /// `useTheme().theme`: the stored value, or 'system' when nothing is stored.
  String get theme => _theme;

  @override
  ThemeMode build() {
    final store = ref.watch(localStoreProvider);
    // next-themes listens to `storage` events for its key (another writer of the same store).
    final sub = store.changes.where((c) => c.key == kThemeStorageKey).listen((c) {
      _theme = _read(c.newValue);
      state = themeModeFor(_theme);
    });
    ref.onDispose(sub.cancel);
    _theme = _read(store.getItem(kThemeStorageKey));
    return themeModeFor(_theme);
  }

  static String _read(String? stored) => (stored == null || stored.isEmpty) ? kThemeSystem : stored;

  /// `setTheme(value)`: `localStorage.setItem('theme', value)` + apply.
  void setTheme(String value) {
    _theme = value;
    try {
      ref.read(localStoreProvider).setItem(kThemeStorageKey, value);
    } catch (_) {
      // next-themes ignores storage failures
    }
    state = themeModeFor(value);
  }
}
