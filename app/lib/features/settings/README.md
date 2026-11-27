# Settings feature (`registerSettingsFeature`)

| React | Dart |
|---|---|
| SettingsScreen.tsx | settings_screen.dart (+ DeleteAccountDialog via AuthController.deleteAccount) |
| hooks/useNotificationSettings.ts, useSilentHours.ts, usePushNotifications.ts, usePrivacyPreferences.ts | data/preferences.dart (query cache, optimistic + revert) |
| AppearanceScreen.tsx (next-themes) | appearance_screen.dart, theme_mode_setting.dart |
| NotificationsScreen.tsx, hooks/useNotifications.ts | notifications_screen.dart, data/notifications.dart (realtime → invalidate) |
| PrivacyScreen.tsx + PartnerPrivacyScreen.tsx | privacy_screen.dart (`partner: true`) |
| ads/AdPreferencesScreen.tsx | ad_preferences_screen.dart |
| WidgetSettingsScreen.tsx, lib/home-widgets.ts (settings only) | widget_settings_screen.dart |
| HealthSyncScreen.tsx, lib/health.ts, healthCycle.ts, healthVitals.ts, hooks/useHealthData.ts | health_sync_screen.dart, data/health_service.dart |
| data export (Settings / Privacy) | data/data_export.dart (share sheet instead of a download link) |
| feature37 / moderator / privacy copy tables, data/{feedback,widgets,health-sync,lock-offer,promo} | copy/feature_copy.dart (+ generated feature_copy.g.dart, countries.g.dart; `node app/lib/features/settings/copy/gen_feature_copy.mjs`) |
| shared shadcn / a-* primitives used by all five features | ui/settings_ui.dart |

Registered screens: settings, ad-preferences, appearance, notifications, widgets, health-sync, privacy, partner-privacy.
`useAdvancedNotifications` is admin-only (audience stats / bulk push) → not ported.

## Interfaces awaiting wiring
- `ThemeModeSetting` (`themeModeSettingProvider`, LocalStore key `theme`, absent = 'system') — app root's `themeModeProvider` must read the same key.
- `reminderSchedulerProvider` (local notifications), `settingsIsNativeProvider`.
- `analyticsConsentNotifierProvider` (CUSTOMER_IO_CONSENT_EVENT).
- `privacySlotsProvider` (ConsentSettings + ConsentControls of the consent feature).
- `adPreferencesControllerProvider` (useAdExperience: decision, rewarded, UMP privacy options).
- `homeWidgetsSyncProvider` (native widget refresh).
- Health: `healthPluginBridgeProvider` (capacitor-health method set), `healthCyclePluginProvider`, `healthVitalsPluginProvider`
  (native), `vitalsSourceProvider` (Supabase default). `HealthService` exposes every function of health.ts / healthCycle.ts / healthVitals.ts.
- `dataExportSinkProvider`, `unlinkPartnersProvider`, `afterUnlinkProvider` (web reloads after unlink; here: refresh profile).

## Deviations / notes
- React stale-closure behaviour of `updateSetting` kept (turning a reminder on schedules with the previous settings).
- CSS `text-transform: uppercase` → `cssUpper()` (az/tr dotted İ).
- Native time inputs → Material time picker.
