// Ported from: next-themes as configured in src/App.tsx (`<ThemeProvider attribute="class" defaultTheme="system"
//              enableSystem>`): localStorage key `theme` = 'light' | 'dark' | 'system' (absent → 'system').
//
// Interface provider for the Appearance screen. The app root owns `themeModeProvider` (app/lib/app); wire it to read
// this (or override this with an adapter onto it) so both use the same LocalStore key.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/state.dart';

const String kThemeStorageKey = 'theme';

class ThemeModeSetting extends Notifier<String> {
  @override
  String build() {
    final store = ref.watch(localStoreProvider);
    final v = store.getItem(kThemeStorageKey);
    return v == 'light' || v == 'dark' || v == 'system' ? v! : 'system';
  }

  /// `setTheme(id)`.
  void set(String theme) {
    ref.read(localStoreProvider).setItem(kThemeStorageKey, theme);
    state = theme;
  }
}

final themeModeSettingProvider = NotifierProvider<ThemeModeSetting, String>(ThemeModeSetting.new);

/// `systemTheme` of next-themes (`prefers-color-scheme`).
final systemBrightnessProvider = Provider<Brightness>((ref) => WidgetsBinding.instance.platformDispatcher.platformBrightness);
