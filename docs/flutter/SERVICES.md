# Flutter port: cross-cutting service specs

Behaviour of the services that are easy to get wrong, precise enough to re-implement in Dart. Source of truth is
the code at `claude/blissful-sagan-lqhvv9` (HEAD `8e2bac89`); file paths are given per section. "LS" = WebView
`localStorage` (origin `https://app.anacan.az` on Android, `capacitor://app.anacan.az` on iOS); "Prefs" = Capacitor
Preferences (iOS `UserDefaults` key prefix `CapacitorStorage.`, Android SharedPreferences file `CapacitorStorage`).
Keys marked **(compat)** must stay byte-compatible for a Capacitor rollback (CONTRACT rule 8).

## 1. Startup sequence and gate order

### 1.1 `src/main.tsx` (before any SDK)
1. Polyfills, CSS. Global `error`/`unhandledrejection` → one guarded reload on chunk-load errors (web only, n/a).
2. `installNotificationTapListeners()` **synchronously**, before any await (§7).
3. Native: skip web entry / website / brand portal / public blog branches (folded by `VITE_NATIVE_BUILD`).
4. `await bootstrapBackend()` (§2), then `import('./bootstrap-app')` → `startApp()`.
5. Any throw → SDK-free retry screen (language from `startup-i18n.ts` `storedStartupLanguage()`; `dir=rtl` for `ar`):
   title "Anacan", message `updateRequired` if `BackendAdmissionError.code === 'ADMISSION_UPDATE_REQUIRED'`, otherwise
   `connectionPending`; button `retry` reloads. Splash is hidden. Storage is never touched.

### 1.2 `startApp()` (`src/bootstrap-app.tsx`)
1. Add `native-app` body class; `installTouchGuards()`.
2. Start `prepareStartupLanguage()` in parallel: restore Prefs `anacan_app_language`, `anacan_has_selected_language`
   (`'true'`), `anacan_has_seen_intro` (`'true'`) into `userStore`, **capped at 3 000 ms**; normalise language;
   set `dir`; `ensureLanguageReady(lang)` (§4). A failure here is rethrown later (→ retry screen).
3. `restoreAdmittedNativeSession()` (§3) raced against **8 000 ms** (source-first bootstrap, the native default) or
   15 000 ms → on timeout/error: `auth.stopAutoRefresh()` (capped 1 000 ms) and throw → retry screen. Never the login form.
4. `initCrashReporter()`, `initFacebookEvents()`, `void loadPrivacyConsent()` (§11.3),
   `initializeNativeFeatures()` (status bar dark; push register + listeners; water reminder unless LS
   `anacan_water_reminder_enabled === 'false'`; `installLocalNotificationReplanner()`), Android back handler (§9),
   `startNativeSessionSync()`.
5. Load `App` in parallel, `await languageReady`, render.
6. `watchBackendAdmission(onChange)`: on change unmount, then (capped 1 000 ms) stop auto refresh, remove all realtime
   channels, remove the AdMob banner, then full reload. Never sign out.

### 1.3 `src/App.tsx` (module load + providers)
- Module load: `initRevenueCat()`; `setTimeout(0)`: LS `language` = store language (or `az`), `loadTranslations(lang)`
  for non-az (DB overlay). `html.a-lite` if low-end **or Android**; `html.a-noblur` on Android (§13).
- React Query: `staleTime 30 s`, `gcTime = maxAge = 7 days`; persisted to LS `anacan-rq-cache` by a deferred persister
  (writes when backgrounded, else at most every 2 min); buster `anacan-rq-v1` (Azure source-first:
  `anacan-rq-v1:azure:<handoffSha256>`); only queries allowed by `shouldPersistQuery` (`lib/query-persist-policy.ts`).
- Splash hide: first effect, two animation frames, `SplashScreen.hide({fadeOutDuration: 180})`
  (`capacitor.config.json`: `launchShowDuration 2000`, `launchAutoHide true`, background `#FAF7F4`).
- Provider order: ErrorBoundary → MotionConfig (`reducedMotion: 'always'` on lite) → PersistQueryClient → Theme
  (system) → `ThemeStatusBarSync` → Direction → `AuthProvider` → `CustomerIoSession`, `TikTokSession`,
  `PrivacyConsentSheet`, `PremiumEntitlementMonitor`, `PromoRedeemer` → Toasters → **`AppLockGate`** (z-400, above
  everything) → `ScreenCaptureGuard` → `OfflineSyncIndicator` → Router → `AdExperienceProvider` →
  `ModeratorEnforcement` (lazy; routes render as its fallback meanwhile) → `PendingAppLink` + routes.
- Routes kept natively: `/` (Index), `/blog/:slug`, `/blog/:language/:slug` (BlogLink), `/reset-password`,
  `/legal/:docType`, `/payment/success`, `/payment/error`, `/p/v/:token`, `/h/:code`, `*` (AppPathLink, §8.4).

### 1.4 `src/pages/Index.tsx` render order (first match wins)
| # | Condition | Shows |
|---|---|---|
| 1 | `showSplash` (initially `needsBrandSplash()`: true once per process) | `SplashScreen`; completes after **350 ms**; an independent **1 500 ms** timer also hides it and sets `showIntro` if `!hasSeenIntro` |
| 2 | `!hasSelectedLanguage && !(hasSeenIntro \|\| isOnboarded \|\| isAuthenticated)` | `InitialLanguageScreen` (an effect sets `hasSelectedLanguage` for anyone matching the bypass) |
| 3 | `showIntro` | `AppIntroduction` → `setHasSeenIntro(true)` |
| 4 | auth `loading` | `StartupScreen` |
| 5 | update centre `forceRequired` | `ForceUpdateScreen` (decision texts) (§10) |
| 6 | legacy `force_update` enabled and version < `min_version` | `ForceUpdateScreen` |
| 7 | `!isAuthenticated` | `AuthScreen` |
| 8 | active block `block_type === 'full'` | `BlockedScreen` |
| 9 | user not onboarded and e-mail gate undecided | `StartupScreen` (decision ≤ 4 s, see below) |
| 10 | e-mail gate `required && email` | `EmailVerificationScreen` |
| 11 | consent gate (not while admin panel open) `loading` / `show` | `StartupScreen` / `ConsentGateScreen` (§11) |
| 12 | profile loaded, profile has empty `country_code`, not just set | `CountryGate` |
| 13 | `(!isOnboarded && !partner) \|\| needsName \|\| pendingJourney \|\| legacyPending` | `PremiumOnboarding` (StartupScreen until `profileLoaded`) |
| 14 | – | `setFunnelCompleted(true)` if not yet |
| 15 | `showAdmin && isAdmin` | admin panel (Flutter: open web admin link) |
| 16 | `viewingUserId` | `UserProfileScreen` |
| 17 | `activeScreen` matches (see `PARITY_MATRIX.md` `screen.*`, role gates there) | sub-screen inside `.a-subscreen` |
| 18 | `showMotherChat` | `MessagesScreen` |
| 19 | else | shell: rating prompt, update sheet, `AlertReceiver` (if linked partner), status-bar spacer, scroll container with tab content, `FloatingTimerWidget`, `FeedbackSheet`, `LockOfferSheet`, `AppLockSetupSheet`, `HomeWidgetSync` (native, bump/mommy), `OnboardingTourHost` (non-partner), `BottomNav` |

- `partner = role === 'partner' || lifeStage === 'partner'`; `needsName` = profile name empty or `'İstifadəçi'`;
  `pendingJourney = hasPendingOnboarding(userId, backendUrl, profile.onboarding_answers)`; `legacyPending` = LS
  `anacan_pending_funnel` JSON `{userId, backend}` matching the current user and backend.
- E-mail gate: skip if onboarded; skip if LS `anacan_email_verified_v1:<uid> === '1'`; else `fetchEmailVerificationState()`
  with a 4 s timer that decides "not required"; an answered not-required result writes the cache key; verifying writes it.
- Partner tabs: `home`, `together`, `chat` (MessagesScreen), `ai` (AiConsentGate → PartnerAIPremiumGate), `profile`;
  `community` is shared. Mother tabs: `home`, `tools`, `community`, `ai` (PremiumGate self → AiConsentGate → AIChat),
  `profile`; `cakes` only if admin or `isCakesAvailable(country, language)`. An empty tab result resets to `home`.
- First-run sheets on Home (blocked while the in-app tour runs, and only when no screen/tool is open): lock offer after
  1 500 ms if native, lock not enabled, LS `anacan.lockOffer.seenAt` unset and no prompt today
  (`anacan.prompt.lastShownDay`); auto feedback after 20 s if native and `shouldAutoPromptFeedback` (account age,
  `anacan_app_usage_count`, not in loss recovery, no prompt today).
- Every tab/screen/tool change resets scroll to top (now, next frame, +80 ms); `setActiveScreen(x)` saves the tab's scroll
  (`scrollMemory` key `tab:<tab>`), closing restores it. Screen views go to analytics with names
  `{home: Dashboard, tools: ToolsHub, ai: AIChat, shop: Shop, cakes: Cakes, profile: Profile, community: Community}`
  else the raw id; class `Screen` / `Tools` / `Tab`.

## 2. Backend admission (`src/integrations/supabase/backend-*.ts`)
- Control URL `https://api.anacan.az/.well-known/anacan-backend.json`, GET, no credentials, no redirect, **4 000 ms** abort.
  401/403/404/408/429/5xx/network → `unavailable`; non-200, non-JSON, missing `Cache-Control: no-store`, > 2 048 chars,
  unparseable → `malformed` (treated like offline); JSON failing validation → `invalid` (startup: `ADMISSION_INVALID`).
- Policy: exactly keys `generation, handoffSha256, minNativeVersion, phase, schema`; schema
  `anacan-backend-admission-v1`; phase `source|maintenance|azure`; azure needs generation > 0 and 64-hex handoff,
  others `handoffSha256: null`. Pin **(compat)**: Prefs + LS `anacan.backend-admission.v1` =
  `{schema:'anacan-backend-pin-v1', authority:'source'|'azure', policy}`; reconciled between both stores; source→azure
  is one-way (`ADMISSION_ROLLBACK`). Prefs written first, then LS. `minNativeVersion` > app version →
  `ADMISSION_UPDATE_REQUIRED`; maintenance → `ADMISSION_MAINTENANCE`. Native builds may carry
  `VITE_INITIAL_MANAGED_ADMISSION` (azure floor).
- Watch: every **60 s**, on `online` and on `visibilitychange` (skipped while hidden); restart only when a valid policy
  differs, or after **2 consecutive** `invalid` reads.

## 3. Session, offline open, logout
- Supabase auth storage key `sb-<host first label>-auth-token` in LS (Azure: `sb-api-auth-token`), realm =
  origin+path. Backup **(compat)**: Prefs `anacan.auth.session.v2:<encodeURIComponent(realm)>` =
  `{"realm": realm, "session": {"access_token","refresh_token"} | null}`; `null` = logout tombstone (blocks the legacy
  `anacan.auth.session.v1` fallback, which is only read for the source realm). Adoption receipt **(compat)**: Prefs
  `anacan.auth.adoption.v1:https%3A%2F%2Fapi.anacan.az` = `{schema:'anacan-auth-adoption-v1', state:'pending'|'complete',
  handoff, userId}`. Full algorithm: `src/lib/session-persistence.ts` (terminal refresh codes:
  `refresh_token_not_found, refresh_token_already_used, session_not_found, session_expired, user_banned, user_not_found`
  with HTTP 400/401/403/404/422 → tombstone; anything else keeps the backup).
- Offline open (`AuthContext` + `lib/offline-session.ts`): if the stored session is expired
  (`expires_at*1000 - now < 90 000 ms`) open read-only on the stored user immediately when `navigator.onLine === false`,
  else after **2 500 ms** if the SDK has not answered. Cached profile/role from LS `anacan_ocache_v1:profile` /
  `anacan_ocache_v1:role` (`{userId, savedAt, data}`, max age 30 days, user-bound). On `online`, `getSession()`;
  `TOKEN_REFRESHED` after an offline open → full re-hydration + `flushOutbox(uid)`. `SIGNED_OUT` → clear state,
  query cache, all `anacan_ocache_v1:*`, RevenueCat logout.
- `signOut()` order: `runLogoutCleanup(userId)` (all steps in parallel, each capped at **2 500 + 1 500 ms**:
  `resetLocalNotifications()`; drop queued taps + pending push intent; delete this device's `device_tokens` row by
  current FCM token, while the session still exists) → `supabase.auth.signOut()` (patched: writes the tombstone first
  and removes `<storageKey>`, `-user`, `-code-verifier` even if the server call fails) → always clear user/session/
  profile/role, `userStore.logout()`, query cache, offline caches, RevenueCat logout (Azure), Mixpanel no-op.
- Outbox entries are **not** deleted on logout (keyed by user id).

## 4. i18n startup (`src/lib/i18n.ts`, `tr.ts`, `ui-copy.ts`)
- `tr(key, azDefault)`: `translationCache[lang][key] ?? azDefault`. az cache = bundled `src/locales/az.json`.
- Module load: hydrate the boot language from LS `anacan_i18n_cache:<lang>` (signature `anacan_i18n_sig:<lang>`).
- `ensureLanguageReady(lang)` (blocks first render): ui-copy chunk for the language; for non-az: start content packs
  in background, await the bundled seed (`scripts/i18n/<lang>.seed.json`; `en` uses `src/locales/en.json`), merged
  *under* cached/overlay values; persist merged dictionary on idle (≤ 5 s).
- `loadTranslations(lang)`: seed, then DB overlay `translations(key,value) where lang=…` in pages of 1 000, merged on
  top, persisted. Language source of truth for `tr`: `readAppLanguage()` (persisted `anacan-user-store` state, else
  LS `language`). Content packs: `DATA_ASSETS.md` §3.

## 5. Network timeouts (`src/lib/network-timeout.ts`)
- SDK fetch: deadline to response headers; races the request (native HTTP ignores abort). Auth 15 000; REST/RPC
  20 000; Functions 20 000, **90 000** for `dr-anacan-chat, generate-fairy-tale, generate-baby-photo,
  generate-blog-content, analyze-poop, analyze-cry, analyze-horoscope, baby-insight, baby-chat-reply, safety-ai-lookup,
  name-ai-lookup, food-calories, translate-content, translate-post, send-bulk-push, admin-notification-dispatch,
  book-download`; Storage GET/HEAD 60 000, upload 120 000. AI stream: connect 30 000, idle between chunks 30 000.
- Timeout error: name `TimeoutError`, code `REQUEST_TIMEOUT`, localized message via `setRequestTimeoutMessage`
  (default "Bağlantı zəifdir. Yenidən cəhd edin.").
- Refresh token (`/auth/v1/token?grant_type=refresh_token`) failures are reported as network errors (session kept)
  unless HTTP 400/401/403/404/422 **and** JSON body with one of `code, error_code, error, msg, error_description`.
- Other bounded calls: admission 4 000; consent RPCs 6 000; outbox/water/daily-log sends 15 000; content-pack
  manifest 15 000 / shard 20 000; local-notification serial step 10 000; logout steps 2 500.

## 6. Offline outbox (`src/lib/offline-outbox.ts`, `water-intake-rpc.ts`, `daily-log-rpc.ts`)
- Key `anacan_outbox_v1:<userId>` (LS, quota-aware writer; empty list → key removed). Entry
  `{id (client UUID v4 = row PK), table, payload (incl. id), createdAt, attempts, rejects?}`.
- Tables: row inserts `baby_logs, kick_sessions, weight_entries, meal_logs, exercise_logs, cycle_history,
  vitamin_intake_logs, appointments` via `upsert(row, {onConflict:'id', ignoreDuplicates:true}).select().maybeSingle()`;
  `water_intake` → RPC `increment_water_intake_v1(p_log_date, p_delta, p_op_id=id)` (missing RPC PGRST202/42883/404 →
  legacy read-modify-upsert, clamp 0..20 000); `daily_logs` → merge-upsert on `(user_id, log_date)` with only
  `mood, symptoms, bleeding, temperature, notes, sleep_hours, sleep_quality` (water never).
- `saveWithOutbox`: enqueue **before** sending → success: remove, `saved` → transient failure: attempts+1, `queued`
  (UI shows the queued toast, `offline-outbox-copy.ts`) → real rejection: remove, `error`.
- Transient = offline, status 0/401/408/429/≥500, `AbortError|TimeoutError|TypeError`, PGRST301/303, or message matching
  `failed to fetch|load failed|network|fetch failed|timed? ?out|timeout|aborted|offline|connection|econn|enotfound|socket`.
- Flush: oldest first, one in-flight flush per user, stop at the first transient failure; real rejections count
  `rejects`; drop at `rejects ≥ 5` or `attempts ≥ 200`. Triggers: `retainOutboxUser` (immediate), `online`, app resume,
  token refresh after offline open. Listeners get `{userId, sentTables}` to invalidate queries; `pendingOutboxRows` lets
  screens show queued rows optimistically.

## 7. Notification taps and push navigation
- `notification-taps.ts`: listeners registered once at boot (native): FCM `notificationActionPerformed`,
  PushNotifications `pushNotificationActionPerformed` (both: `notification.data`), LocalNotifications
  `localNotificationActionPerformed` (`notification.extra`, only if it has string `type` or `deeplink`). Same payload
  JSON within **2 000 ms** is ignored (FCM + fallback duplicates). No handler yet → keep **only the latest** tap.
  Index attaches the handler on mount (`navigateFromPush`); logout clears the queue.
- `navigateFromPush(data)`: if `data.deeplink` is a trusted URL (`anacan:`/`com.atlasoon.anacan:` scheme, or https on the
  current origin, `anacan.az`, `www.anacan.az`, `app.anacan.az`, `anacanapp.lovable.app`, or the configured backend
  origin; no userinfo) and `parseDeeplink` succeeds → intent `{deeplink}`. A trusted website link that does not parse
  (`anacan.az`/`www`) opens in the external browser once the app is visible (+350 ms). Otherwise `type` → intent:

| `type` | Intent |
|---|---|
| `message`, `partner_message`, `love`, `thank_you` | mother chat (partner role: tab `chat`) |
| `direct_message` | tab `community`, `{dmUserId: sender_id}` if UUID else `{conversations:true}` |
| `shopping_list` | partner: home + screen `partner-shopping`; mother: tool `shopping` (from dashboard) |
| `parenting_programme` | set parenting target `{programme}`; `partner==='1'` → screen `partner-parenting`, else tool `parenting` |
| `baby_chat` | screen `baby-chat` |
| `group_message`, `group_invite`, `group_join_request` | tab `community`, `{groupId}` if UUID |
| `community_like`, `community_comment` | tab `community`, `{postId}` |
| `community_moderation` | tab `community`, `{postId}` if UUID |
| `moderation_action` | screen `moderation-history` |
| `community_reply` | tab `community`, `{postId, commentId: interactionId (UUID) ?? commentId}` |
| `comment_like` | tab `community`, `{postId, commentId}` |
| `story_like`, `story_reply` | tab `community`, `{storyId}` |
| `like`, `comment`, `community` | tab `community` |
| `premium_expired`, `subscription` | screen `billing` |
| `contraction_511` | screen `live-contractions` |
| `appointment`, `appointment_reminder` | screen `calendar` |
| `flow_reminder`, `period_reminder`, `pill_reminder`, `sos`, `sos_alert`, `birth`, `birth_alert` | tab `home` |
| anything else | nothing (app just opens) |

- The intent is stored as `pending` and dispatched (`anacan-push-nav`). Index applies it only when authenticated, not
  loading and profile loaded (pending consumed then). Applying resets: admin panel, viewed user, mother chat, screen,
  tool, `toolOpenedFromDashboard`, community target, swipe-restore, and remounts ToolsHub. Order of checks:
  motherChat → shoppingList → deeplink → tool → screen → tab (+communityTarget).

## 8. Deeplinks (`src/lib/deeplink.ts`, `app-path-links.ts`, `widget-actions.ts`, `promo.ts`)
- Accepted: `anacan://…`, `com.atlasoon.anacan://…` (host+path), `https://<APP_ENTRY_HOSTS>/…`
  (`src/web-entry/policy.mjs`), app-relative `/…`. No userinfo/port. Native registration: URL schemes `anacan`,
  `com.atlasoon.anacan` (iOS `CFBundleURLSchemes`, Android intent filter). **No universal links / App Links are
  registered** (no `associated-domains` entitlement, no https intent filter), so https links reach the app only via
  pushes/in-app events.
- Routes: `/`→tab home; `/tools`,`/ai`,`/community`,`/profile`,`/cakes`→tab; `/books`,`/my-books`→screen;
  `/tool/{id}[?widget_action=feed|sleep|diaper]`; `/parenting/(sos|article|programme)/{id ≤60 [a-z0-9-]}`→tool parenting
  with target; `/premium`→screen billing; `/settings`,`/notifications`,`/calendar`,`/help`,`/edit-profile`,
  `/appearance`→screen; `/blog`, `/blog/{slug}` (rejects whitespace, `/\<>`, control chars, `.`/`..`); localized
  `/blog/{az|en|tr|ru|de|ar|ka|kk|uz|zh|id|fr|es|pt|vi|hi|ja|ko|pl|nl|sv}[/slug]`→screen + language;
  `/messages[/{user_id}]`→mother chat (user id ignored by Index); `/community/post/{id}`; `/user/{id}`; `/legal/{doc}`;
  `?blog_module=sleep|feeding|diaper|babyGrowth|hospitalBag|calendar`→blog module. `?language=`/`?blog_language=` (app
  language) switches language first.
- Listener: `App.appUrlOpen`; `App.getLaunchUrl()` checked once per process. `/h/<code>` promo links are not routed:
  the code is saved (LS `anacan:promo-code`) and `PromoRedeemer` redeems after sign-in. Same router handles in-app
  `anacan:deeplink` events (banners).
- Tool deeplink: parenting items handled by `openParentingDeeplink`; otherwise store widget action
  (`setPendingWidgetAction`, consumed once by the tool within **30 s**), open Tools tab on that tool; if the same tool is
  already open with a widget action, close and reopen it on the next tick.
- AppPathLink (`*` route): known app path → `anacan://<path>[?language]`, kept in sessionStorage
  `anacan_pending_app_link` `{href, at}` for **30 min**, delivered through `navigateFromPush({deeplink})` after sign-in.

## 9. Android back button, overlays, swipe (`src/lib/backButton.ts`, `hooks/useOverlayBackHandler.ts`, `useSwipeNavigation.ts`)
- Layers asked in order `overlay` → `screen` → `root`; inside a layer the most recently registered handler first; a
  handler returning true consumes the press. Overlays (`useOverlayBackHandler(open, close)`, `useBackClosableRoot` for
  Radix/vaul roots) register while open; `close = null` swallows back (non-dismissible). Index registers the root
  handler: admin panel → viewed user → mother chat → activeScreen → activeTool (+ToolsHub remount) → non-home tab →
  home; else not consumed. Unconsumed at root: second press within **2 000 ms** exits, else toast
  `back_press_again` ("Çıxmaq üçün yenidən basın", 1 800 ms). Android only.
- Swipe: left-edge **55 px**, threshold **35 px**, enabled when authenticated and no splash/intro/admin/blog overlay.
  Back pops activeScreen → viewed user → mother chat → tool (only on Tools tab) and remembers it; forward re-applies
  the remembered item once. Never switches tabs.

## 10. App update centre (`hooks/useAppUpdate.ts`, `useForceUpdate.ts`, `docs/APP_UPDATE_CENTRE.md`)
- Native only. RPC `get_app_update_v1(p_platform, p_version (App.getInfo().version), p_language, p_country =
  profile.country_code)`; refetch every 6 h, on app resume, `staleTime 60 s`, retry 1. Valid decision:
  `protocol === 'anacan-app-update-v1'`, mode `force|soft|banner`, string `store_url`. Cache LS `anacan_app_update_v1`
  `{at, decision}` for **24 h**, used only when the query errors (so a forced update survives offline starts).
- Soft sheet allowed: `every_launch` → once per process (`shownThisLaunch`); otherwise never "Later"-tapped, or
  `daily` and ≥ 24 h since LS `anacan_app_update_later_<rule_id>` (ms epoch); `once` → never again after Later.
  "Later" adds to `shownThisLaunch` and writes the timestamp. Banner shows for `banner` mode, or `soft` when the sheet is
  not allowed. "Update" = `later()` then open `store_url` externally.
- Legacy: RPC `get_public_app_setting('force_update')` → `{enabled, min_version, title, message, android_url, ios_url}`,
  every 5 min; required when enabled and `compareNativeVersions(version, min_version) < 0`. Update-centre force wins
  (checked first).

## 11. Consents
### 11.1 Consent gate (`lib/consentGate.ts`, `hooks/useConsentGate.ts`, `components/consent/*`, `docs/CONSENT_GATE.md`)
- Key scope `<backendUrl>:<userId>`. LS `anacan_consent_gate_v1:<scope>` = `{version, at}` (accepted);
  `anacan_consent_pending_v1:<scope>` = `{items, source, appVersion}` (unsent acceptance). A local accepted version
  (cache, or a pending granted `terms` item) → status `skip` immediately, pending flushed, server checked in background.
  Else `loading` until `my_consents_v1` (6 s timeout); any failure / malformed → `skip` (never lock out).
- Decision: show iff gate `enabled`, `version` matches `^\d{1,4}(\.\d{1,4}){0,3}$`, local accepted ≠ version, and latest
  `terms` row is not (granted and same version). Fallback version `1.0`.
- Required: `terms`, `health_data`, `age_16`; optional `marketing`. KVKK (profile country `TR` or language `tr`):
  rows `terms, health_data(kvkk_tr), age_16, child_data(kvkk_tr), marketing(kvkk_tr, = any channel),
  marketing_email|push|sms(kvkk_tr)`. Record via `record_consents_v1(p_items, p_source ios|android|web,
  p_app_version)`; network failure → save pending + treat as accepted. "Çıxış et" signs out.
### 11.2 AI consent (`AiConsentGate`)
- LS `anacan_ai_consent_v1:<scope>` `{granted, at}`; opens chat only after granted `ai_assistant`; decline → Home tab.
### 11.3 Privacy consent (`lib/privacyConsent.ts`, `docs/PRIVACY_CONSENT.md`)
- LS + Prefs `anacan_privacy_consent_v1` = `{analytics, ads, attribution, decidedAt}` (undecided: all false,
  `decidedAt null`). Load: LS synchronously; Prefs at startup overrides if `decidedAt` differs. Apply: Firebase consent
  `analytics_storage`=analytics, `ad_storage`/`ad_user_data`/`ad_personalization`=ads, `setEnabled(analytics)`; Meta
  (`attribution`, ATT prompt only when chosen by the user); TikTok. Sheet shows to signed-in users with no decision.
  Native manifests default collection off.

## 12. Local notification scheduler (`src/lib/local-notification-scheduler.ts`)
- Desired set in LS `anacan.localNotifications.v1` = `{v:1, owner, namespaces: {ns: [{id,title,body,at(ms),repeat?:'day',
  extra?,smallIcon?,channelId?}]}, scheduled: {id: fingerprint}}`. Fingerprint =
  `JSON.stringify([title, body, repeat ? 'd<h>:<m>' : 'a<at>', extra ?? null, smallIcon ?? null, channelId ?? null])`.
- **Nearest 60 rule**: `PENDING_BUDGET = 60` (iOS keeps 64). Next fire: daily → today at h:m local, or tomorrow if
  ≤ now; one-shot → `at` if `at > now + 5 000 ms`, else expired (pruned). Plan = all namespaces in sorted name order, an
  id counts once (first namespace wins), sort by next fire then id, take `60 − unmanaged`, where unmanaged = OS-pending
  ids not in `scheduled`, not desired and not being retired.
- Reconcile: cancel ids in `scheduled` not chosen + feature-retired ids; check permission (prompt only with `ask` from a
  user action); schedule chosen items whose fingerprint changed or that are missing from OS pending; native shape
  daily `{on:{hour,minute}, repeats:true, allowWhileIdle:true}`, one-shot `{at, allowWhileIdle:true}`.
- All operations run serially (a stuck bridge holds the queue ≤ 10 s). Re-plan at native init and on every app resume
  (throttled 30 s). `bindLocalNotificationOwner(uid)` (from `useDeviceToken` after sign-in): a different previous owner →
  drop all namespaces except device-level `water`. Logout: `resetLocalNotifications()` empties the store, cancels all
  pending, removes delivered. Never return the Capacitor plugin proxy from an async function (52.0.0/52.0.1 bug: `then`
  became a native call); irrelevant in Dart but keep the "never throws" contract.

| Feeder (namespace) | Ids | Schedule |
|---|---|---|
| Water (`water`, device-level) | 101 (legacy 108–120 cancelled) | daily 10:00, unless LS `anacan_water_reminder_enabled === 'false'` |
| Vitamin (`vitamin`) | 200 | daily at chosen time (`native.ts`, `useNotificationSettings`) |
| Exercise (`exercise`) | 300 + day offset (0–6) | one-shots 10:00 on the chosen weekdays of the next 7 days (`useNotificationSettings`) |
| Pill, flow (`flow-pill`) | 91201 | daily (`PillReminderCard`) |
| Nap alerts (`nap`) | 880001 nap, 880002 long nap, 880003 regression | one-shots (`lib/nap-alerts.ts`) |
| Weaning (`weaning`) | 881100–881111 | plan steps (`weaning-reminders.ts`) |
| Parenting programme (`parenting`) | 882200–882207 | next 7 slots; extra `{type:'parenting_programme', partner, programme}` |
| Vaccines (`vaccine:<base>`) | legacy block 883300+, per child 883400 + 30·slot (+0…22), ≤ 10 children | 10:00, ≤ 20 upcoming in 60 days + ≤ 3 overdue (365-day lookback); deeplink `anacan://tool/vaccine-calendar` |
| Baby chat (`baby-chat`) | 7300–7306 | next 7 daily arrivals (> now + 60 s), extra `{type:'baby_chat'}`; cancelled when stage ≠ bump |
| Illness doses (`illness:<episodeId>`) | 900 000 000 + hash(`episodeId:med`) % 99 000 000 | per medicine next dose (> now + 60 s) |
| Chat messages (`notifyNow`, not planned) | 1 100 000 000 + seed % 100 000 000 | immediate, only when the document is not visible; never prompts |
| Timer fallback (`notifyNow`) | 31-hash of timer id % 2 147 483 647 | immediate ongoing notification when Live Activity/FGS fails |

## 13. Device tier (`src/lib/device-tier.ts`, `App.tsx`)
- Low-end = `hardwareConcurrency ≤ 4` or `deviceMemory ≤ 4` (GB), computed once. `a-lite` = low-end **or any Android**:
  CSS drops backdrop blur and endless animations; framer-motion `reducedMotion: 'always'` (else follows the OS).
  `a-noblur` = any Android: fixed glass bars get a solid fill. Flutter: same two flags from `Platform.isAndroid` and
  device info (cores, RAM).

## 14. Home-screen widgets (`HomeWidgetSync.tsx`, `hooks/useHomeWidgetSync.ts`, `lib/home-widgets.ts`, native)
- Mounted only when native and stage `bump|mommy`. Recompute on: profile/stage/child/logs/premium/language changes, every
  **5 min**, `storage` events for `anacan.widgets.settings.v1` or `anacan.sleepTraining*`, custom
  `anacan-widgets-changed`, app going hidden. Push only when the snapshot without `updatedAt` changed.
- Snapshot v1: `{v:1, updatedAt, locale, premium, privacy, showActions, journey, care, careLocked, word, labels, links}`.
  bump: journey = trimester eyebrow, `pregnancy_week`/`_only` title, fruit subtitle, days-left badge, progress 0–1,
  fruit emoji. mommy: journey = child name / age text; care (logs of last 8 days if Premium, else 1) = last feed
  (side + minutes), next nap window via `predictNextNap` (sleep plan LS key `planStorageKey(uid)`), sleepingSince,
  today feeds/sleep/diapers, `dayStart` local midnight. Non-Premium: realistic sample care ("Nuray", 3 m 12 d) with
  `careLocked: true`. Settings LS `anacan.widgets.settings.v1` `{showFeed, showNap, showActions, privacy}` (defaults
  true,true,true,false) blank the matching fields. Daily word = `words[dayOfYear % n]`.
- Links: home `anacan:///`, premium `anacan://premium`, feed `anacan://tool/baby-tracker?widget_action=feed`, sleep
  `anacan://tool/sleep-training?widget_action=sleep`, diaper `…baby-tracker?widget_action=diaper`, sleepTool, tracker.
- Plugin `AnacanWidgets.update({snapshot})` (≤ 32 000 chars). Android: SharedPreferences `AnacanHomeWidgets` key
  `snapshot_v1`, broadcasts update to `AnacanJourneyWidget`, `AnacanCareWidget`, `AnacanWordWidget` (update periods
  60/30/60 min; request codes 7100, 7200, 7301–7304, 7400). iOS: App Group `group.com.atlasoon.anacan`, key
  `anacan.widget.snapshot.v1`, reloads kinds `AnacanJourneyWidget`, `AnacanCareWidget` (**not** `AnacanWordWidget`:
  parity bug candidate for `PARITY_FIXES.md`); timeline refresh every 30 min plus local midnight. Privacy hides
  journey and the child's name/age/last-feed text; `dayStart` not today → today counters show 0.

## 15. Live timer (`lib/live-timer.ts`, `plugins/LiveActivityPlugin.ts`, `hooks/usePendingTimerStops.ts`)
- Plugin `LiveActivity`: `startActivity({id, type, label, subLabel, stopLabel, startTime, feedType, channelName,
  channelDesc})`, `stopActivity({timerId})`, `getPendingStops()`, `clearPendingStops()`, event `timerStopped`
  (Android). iOS = ActivityKit (+ `AnacanTimerStopIntent`); Android = `TimerForegroundService` (channel
  `anacan_timer_channel`, actions `com.atlasoon.anacan.timer.START|CANCEL|STOP`, pending list
  `anacan-pending-timer-stops`). Start failure → ongoing local notification fallback (iOS also shows a diagnostic toast).
- Pending stops processed on mount, `timerStopped`, app resume: only `sleep`/`feeding` with duration ≥ 3 s; wait
  (return false = retry later) until user and children are loaded; skip if a log with the same start exists; feeding
  side → `breast_left|breast_right`; list cleared only when every stop succeeded. Timers persist in zustand
  `anacan-timers` (LS).

## 16. Smaller services
- **App lock** (`lib/appLock.ts`): LS `anacan_lock_enabled` ('1'), `anacan_lock_hash` = hex SHA-256 of
  `"<salt>:<pin>:anacan"`, `anacan_lock_salt` (16 random bytes hex), `anacan_lock_bio`, `anacan_lock_last_bg`;
  PIN length 4; relock after **30 s** in background. Biometrics: `@capgo/capacitor-native-biometric`.
- **Screen capture guard**: protection on everywhere except the main dashboard with no dialog/chat/onboarding/large
  fixed overlay (`[data-main-dashboard="true"]`), re-evaluated on DOM changes (throttle 300 ms) →
  `ScreenshotGuard.setEnabled({enabled: !allowed})` (Android `FLAG_SECURE`, iOS secure surface); while screen
  recording (`captureChanged`) and not allowed → opaque `#FAF7F4` cover with `public/brand-mark-coral.png`
  (112×118). `setCurtainSuspended` during system auth sheets (iOS).
- **Moderator enforcement**: warning acks LS `anacan-moderator-warning-acks-v1:<encodeURIComponent(backend:uid)>`
  (≤ 100 `{id, claim}`).
- **Rating/feedback**: LS `anacan_app_usage_count`, `anacan_rating_done`, `anacan.review.firstOpenAt`,
  `anacan.prompt.lastShownDay` (one prompt per day across lock offer, feedback, rating).
- **Push prompt**: LS `last_push_prompt_date` (at most one permission prompt per day); token row in `device_tokens`
  (upsert, then delete this user's other tokens on the same platform).
- **Persisted stores**: zustand `anacan-user-store` (LS), `selected-child-storage`, `anacan-timers`; Prefs mirror of
  language/intro flags (§1.2).
