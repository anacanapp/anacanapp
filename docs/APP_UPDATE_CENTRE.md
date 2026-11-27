# App update centre (2026-11-11)

Admin: **Yeniləmə mərkəzi** (`/admin/app-updates`). Old screen kept as "Köhnə yeniləmə ayarı" (`force-update`).

## Pieces
- `app_client_seen` (migration `20261111140000`): one row per signed-in user with platform and app version, written by
  `app_client_seen_touch_v1` from the `force_update` poll (every native build polls it every 5 min) and from
  `get_app_update_v1`. Version source: `X-Anacan-Version`, else the iOS native user agent `App/<version>.<build> CFNetwork/…`.
  Android's `Dalvik/…` agent has no version, so Android builds without the header show as unknown. No IP is stored.
- `app_update_rules` (migration `20261111150000`): mode `force | soft | banner`, platform, `below_version`
  (and optional `min_version`), languages, countries, audience `test` (admins) / `percent` / `all`, frequency
  (`daily | once | every_launch`), per-language texts `{title, body, whats_new[], button, later}`, schedule, priority.
- `app_settings.store_versions` `{ios, android}`: a rule is shown only when that store already serves `below_version`.
  iOS seeded with 50.0; Android must be filled in the admin page.
- `get_app_update_v1(platform, version, language, country)`: the decision for new builds (strongest mode wins;
  texts in the user's language, then English, then Azerbaijani).
- Legacy bridge: builds before the update centre only read `get_public_app_setting('force_update')`. When a **force**
  rule matches the caller (platform/version from the request, language from `user_preferences.language`) it returns
  that rule as the legacy object, so old builds can be forced per platform, version and language. Soft and banner
  rules need a build with `useAppUpdate` (next native release).

## App
`useAppUpdate` (launch, foreground, every 6 h; 24 h cache) → `ForceUpdateScreen`, `AppUpdateSheet` (soft, "Later"
leaves a home banner), `AppUpdateBanner`. Fixed labels in 23 languages: `src/lib/appUpdate-i18n.ts`.

## Not yet
Android Google Play in-app update (flexible download / immediate) needs a native plugin in a native build; until then
"Update" opens the Play Store page on Android and the App Store page on iOS.
