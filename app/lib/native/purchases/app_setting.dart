// Ported from: src/hooks/useAppSettings.ts
//
// The purchases layer used to own the only `useAppSetting` port; it now lives in core (one source for every
// feature). Kept as a re-export so existing imports keep working.
export '../../core/data/app_settings.dart';
