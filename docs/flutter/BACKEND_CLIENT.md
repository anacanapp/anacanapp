# Backend client: admission, session, storage (Flutter 60)

Port of the React native-startup backend layer to `app/lib/core/`. Behaviour source of truth:
`src/integrations/supabase/backend-admission.ts`, `backend-bootstrap.ts`, `backend-config.ts`,
`auth-storage-key.ts`, `client.ts`, `src/lib/session-persistence.ts`, `offline-session.ts`,
`logout-cleanup.ts`, `network-timeout.ts`, `src/main.tsx`, `src/bootstrap-app.tsx`.

## 1. File map

| React | Dart | Tests (`app/test/core/…`) |
|---|---|---|
| `integrations/supabase/backend-admission.ts` | `admission/backend_admission.dart` | `admission/backend_admission_test.dart` |
| `integrations/supabase/backend-bootstrap.ts` | `admission/backend_bootstrap.dart` | `admission/backend_bootstrap_test.dart` |
| `integrations/supabase/backend-config.ts` | `admission/backend_config.dart` | (in bootstrap tests) |
| `integrations/supabase/auth-storage-key.ts` | `session/auth_storage_key.dart` | `session/auth_storage_key_test.dart` |
| `integrations/supabase/client.ts` | `net/backend_client.dart` (`initializeSupabaseClient`, `versionHeaders`), `session/auth_storage_key.dart` (`selectAuthStorage`), `storage/session_store.dart` | `net/backend_client_test.dart` |
| `lib/session-persistence.ts` | `session/session_persistence.dart`, `session/auth_gateway.dart` | `session/session_persistence_test.dart`, `session/native_auth_adoption_test.dart` |
| `lib/offline-session.ts` | `session/offline_session.dart` | `session/offline_session_test.dart` (new) |
| `lib/logout-cleanup.ts` | `session/logout_cleanup.dart` (steps injected) | `session/logout_cleanup_test.dart` |
| `lib/network-timeout.ts` | `net/network_timeout.dart` (`AnacanHttpClient`) | `net/network_timeout_test.dart` |
| `main.tsx`, `bootstrap-app.tsx` | `net/backend_client.dart` (`BackendClient.bootstrapBackend`), `net/backend_providers.dart` | `net/backend_client_test.dart` |
| `import.meta.env.VITE_*` | `net/build_config.dart` | — |
| `@capacitor/preferences` | `storage/legacy_preferences.dart` + `android/…/LegacyPreferencesChannel.kt`, `MainActivity.kt`, `ios/Runner/AppDelegate.swift` | `storage/legacy_preferences_test.dart` |
| (bridge export reader) | `storage/migration_import.dart` | `storage/migration_import_test.dart` |
| (SDK storage) | `storage/session_store.dart`, `storage/key_value_store.dart`, `storage/js_compat.dart` | `storage/session_store_test.dart` |

## 2. Compile-time configuration (`--dart-define`)

All read in `app/lib/core/net/build_config.dart` (`BuildConfig.fromEnvironment`). Values are strings; comparisons are
the React ones (`=== 'true'`, `=== 'source-first-v1'`). Put them in the Codemagic `anacan_native` group next to the
`VITE_*` originals and pass each as `--dart-define=NAME=$VALUE` (or one `--dart-define-from-file`).

| dart-define | From | Store build value |
|---|---|---|
| `ANACAN_API_URL` | `VITE_SUPABASE_URL` | `https://api.anacan.az` (required for source-first) |
| `ANACAN_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` | managed backend anon key |
| `ANACAN_SOURCE_ANON_KEY` | `VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY` | Source anon key; must differ from `ANACAN_ANON_KEY` |
| `ANACAN_APP_VERSION` | `VITE_APP_VERSION` | e.g. `60.0` (`^\d+\.\d+$`); min-version gate and `X-Anacan-Version` |
| `ANACAN_INITIAL_MANAGED_ADMISSION` | `VITE_INITIAL_MANAGED_ADMISSION` | one-line JSON of the live `/.well-known/anacan-backend.json`; must be `phase:"azure"` |
| `ANACAN_BACKEND_BOOTSTRAP` | `VITE_BACKEND_BOOTSTRAP` | `source-first-v1` |
| `ANACAN_AUTH_CUTOVER` | `VITE_AUTH_CUTOVER` | `false` |
| `ANACAN_BUILD_MODE` | `vite build --mode` | `google` (default) |
| `ANACAN_AZURE_PARTNER_PAIRING` | `VITE_AZURE_PARTNER_PAIRING` | as in the Capacitor group |
| `ANACAN_AZURE_REVENUECAT_ENABLED` | `VITE_AZURE_REVENUECAT_ENABLED` | `true` (the native check requires it) |
| `ANACAN_AZURE_APPLE_OAUTH_ENABLED` | `VITE_AZURE_APPLE_OAUTH_ENABLED` | as in the Capacitor group |
| `ANACAN_AZURE_GOOGLE_OAUTH_ENABLED` | `VITE_AZURE_GOOGLE_OAUTH_ENABLED` | as in the Capacitor group |

`VITE_NATIVE_BUILD` has no counterpart: the Flutter app is always native, so a non-empty
`ANACAN_INITIAL_MANAGED_ADMISSION` is always used. `scripts/codemagic/check-native-env.mjs` should be mirrored for the
`ANACAN_*` names (same rules: distinct keys, cutover `false`, bundled admission equal to the live one).

## 3. Admission protocol (as implemented)

### 3.1 Control read
`GET https://api.anacan.az/.well-known/anacan-backend.json`, no request headers of its own, redirects not followed, no
cookies/HTTP cache (`dart:io`), 4 s bound over headers and body (the request is aborted on timeout).

| Answer | Probe | Startup | Watcher |
|---|---|---|---|
| transport error, timeout, body read error | `unavailable` | keep pin (like offline) | no decision, streak reset |
| status 401/403/404/408/429 or ≥500 | `unavailable` | keep pin | no decision |
| other non-200 (incl. 3xx), content-type without `application/json`, `cache-control` without a `no-store` token, body > 2048 UTF-16 units, unparseable JSON (captive portal, proxy) | `malformed` | keep pin (like offline) | no decision |
| JSON no-store document failing validation | `invalid` | `ADMISSION_INVALID` | restart after 2 consecutive |
| valid policy | `policy` | advance | restart if different from the running one |

### 3.2 Policy `anacan-backend-admission-v1`
Exactly the keys `schema, generation, phase, minNativeVersion, handoffSha256`. `generation` safe integer ≥ 0 (JSON
`2.0` is accepted as 2, like JS); `phase` ∈ `source|maintenance|azure`; `minNativeVersion` matches
`^\d{1,9}(\.\d{1,9}){0,3}$`; `azure` ⇒ `generation ≠ 0` and `handoffSha256` 64 lower-hex; otherwise `handoffSha256` is
`null`. Built-in floor: `{generation:0, phase:"source", minNativeVersion:"28.0", handoffSha256:null}`.

### 3.3 Pin `anacan.backend-admission.v1` (Capacitor Preferences)
`{"schema":"anacan-backend-pin-v1","authority":"source"|"azure","policy":{…policy, same key order…}}`, written
byte-identical to `JSON.stringify`. Authority must equal the policy phase unless the phase is `maintenance`.
Corrupt/unreadable → `ADMISSION_STORAGE`. React additionally mirrors the pin in WebView localStorage and reconciles
both; Flutter has only the Preferences copy (which React already treats as the surviving one).

### 3.4 Advance rules (`advanceAdmission`)
Rollback (`ADMISSION_ROLLBACK`) when the new generation is lower, or equal but not identical, or the pin is `azure`
and the policy is `source`. Maintenance keeps the previous authority (`source` if none).

### 3.5 Startup algorithm (`AdmissionBootstrap`, coalesced)
1. Not a native platform → `ADMISSION_CONFIGURATION`.
2. Read pin (error → `ADMISSION_STORAGE`). 3. Control read (`invalid` → `ADMISSION_INVALID`).
4. Floor = bundled managed admission if set (non-JSON or not `azure` → `ADMISSION_CONFIGURATION`), else Source floor.
5. Azure floor and a remote `source` policy → `ADMISSION_ROLLBACK`.
6. Azure floor raises a missing / source / older-azure pin to the floor; a maintenance pin stays latched.
7. Advance with remote ?? pin policy ?? floor. 8. Write pin (failure → `ADMISSION_STORAGE`), *before* any client.
9. `minNativeVersion` > `ANACAN_APP_VERSION` or unparseable → `ADMISSION_UPDATE_REQUIRED`; maintenance phase →
   `ADMISSION_MAINTENANCE`. 10. Select backend (below); a bad key set → `ADMISSION_CONFIGURATION`.

Non-source-first builds skip all of it and use `ANACAN_API_URL`/`ANACAN_ANON_KEY` directly.

### 3.6 Backend selection
`authority:"azure"` (the managed realm; the protocol keeps the historical name) → `https://api.anacan.az` +
`ANACAN_ANON_KEY`. `authority:"source"` → `https://tntbjulojatnrqmylorp.supabase.co` + `ANACAN_SOURCE_ANON_KEY`.
Requires `ANACAN_API_URL == https://api.anacan.az`, both keys present and different, cutover not `true`.

### 3.7 Watcher (`BackendClient.watchAdmission`)
Every 60 s, on app resume (`AppLifecycleListener`) and on any `wakes` event the shell supplies (connectivity regained;
there is no connectivity package in the app yet), skipped while paused/hidden and while a read is in flight. A changed
valid policy or two consecutive `invalid` reads: stop auto refresh + realtime (bounded 1 s, no sign-out, no credential
deletion), then call the shell, which runs `BackendClient.restart()` and a fresh startup.

## 4. Session storage

### 4.1 Keys and shapes (Capacitor Preferences, byte-compatible)
| Key | Value |
|---|---|
| `anacan.auth.session.v2:<encodeURIComponent(realm)>` | `{"realm":<realm>,"session":{"access_token":…,"refresh_token":…}}` |
| same key | `{"realm":<realm>,"session":null}` = logout tombstone (blocks the v1 fallback) |
| `anacan.auth.session.v1` | `{"access_token":…,"refresh_token":…}`; read only when the realm is Source; removed on every write |
| `anacan.auth.adoption.v1:https%3A%2F%2Fapi.anacan.az` | `{"schema":"anacan-auth-adoption-v1","state":"pending"\|"complete","handoff":<sha256>,"userId":<uuid\|null>}` |

Store builds are source-first, so the SDK key is `sb-tntbjulojatnrqmylorp-auth-token` and the backup realm is
`https://tntbjulojatnrqmylorp.supabase.co` whichever authority is admitted (exactly `client.ts`). Keys use a
byte-exact port of `encodeURIComponent` (`storage/js_compat.dart`), not `Uri.encodeComponent`.

### 4.2 Restore (`NativeSessionPersistence`)
`restoreAdmittedNativeSession(backend)`: managed realm + valid handoff → adoption flow (receipt `complete` for this
handoff → plain restore; otherwise restore preserving terminal candidates, then refresh-before-use: receipt `pending`
with the expected user id, `refreshSession()` of the current session, same user, durable rotated backup verified by
reading it back, receipt `complete`). Any failure → `NATIVE_SESSION_RECOVERY_PENDING`.
Plain restore: SDK session present → write backup; else backup (v2, or v1 for Source) → refresh grant with its
refresh token. Terminal = `AuthApiException` with status 400/401/403/404/422 and code in
`refresh_token_not_found, refresh_token_already_used, session_not_found, session_expired, user_banned,
user_not_found` → tombstone. Everything else keeps the backup; transition builds then block on the retry screen.
Writes are serialized; stale results (revision changed, logout in progress) are dropped; logout writes the tombstone,
removes v1, clears `<key>`, `<key>-user`, `<key>-code-verifier` locally, and survives restart.

### 4.3 SDK copy (`SessionStore`, supabase_flutter `LocalStorage`)
supabase_flutter 2.18.3 persists `jsonEncode(session.toJson())` =
`{access_token, expires_in, expires_at, refresh_token, token_type, provider_token, provider_refresh_token, user}`
under the SDK key in Flutter's own `shared_preferences` (never seen by Capacitor). Mapping to the backup:
`{access_token, refresh_token}` ⊂ that JSON; the reverse direction never builds an SDK session from the backup
(there is no user object or expiry in it) — it always goes through the refresh grant:

`POST <backend>/auth/v1/token?grant_type=refresh_token` body `{"refresh_token":"<backup refresh_token>"}` with the
`apikey` header of the admitted backend; gotrue saves the returned session (`TOKEN_REFRESHED`), SessionStore persists
it, the backup is rewritten with the rotated pair.

Cross-build rule: on start SessionStore keeps its SDK copy only if its refresh token equals the backup's, or the
backup equals the value this app last wrote or consumed (seen marker
`anacan.flutter.auth.backup-seen.v1:<realm>` in shared_preferences, recorded after each backup write and *before*
each backup grant). Otherwise (a Capacitor build ran and rotated or logged out) the SDK copy is discarded and the
backup path above is used. A Preferences read failure keeps the SDK copy.

### 4.4 Network timeouts (`AnacanHttpClient`, the SDK `httpClient`)
REST/RPC 20 s, Auth 15 s, Functions 20 s, AI functions (`slowFunctions`) 90 s, Storage download 60 s, upload 120 s,
AI stream connect 30 s (`sendStreaming`). Deadline to the response headers; the request is aborted on timeout;
the caller's `Abortable` trigger is honoured before and after the headers. A non-2xx refresh-token answer that is not
JSON 400/401/403/404/422 with `code|error_code|error|msg|error_description` is thrown as `http.ClientException`, so
gotrue keeps the session (`AuthRetryableFetchException`) instead of signing out.

## 5. Startup result (`BackendClient.bootstrapBackend`)

| Result | When | Shell (as `src/main.tsx`) |
|---|---|---|
| `BootstrapReady` | session restored/refreshed/adopted | open app |
| `BootstrapSignedOut` | no session (fresh install, logout tombstone, terminal revocation) | open app → login |
| `BootstrapUpdateRequired` | `ADMISSION_UPDATE_REQUIRED` | `updateRequired` text + retry |
| `BootstrapMaintenance` | `ADMISSION_MAINTENANCE` | `connectionPending` text + retry |
| `BootstrapRetryableFailure(reason)` | `ADMISSION_INVALID/ROLLBACK/STORAGE/CONFIGURATION`, `sessionRecoveryPending` (restore error or the 8 s bound — 15 s for non-source-first builds), `unexpected` | `connectionPending` text + retry |

No SDK client exists for admission failures; storage is never cleared by a failure. Retry = `restart()` + new
startup. Providers: `backendClientProvider`, `backendBootstrapProvider`, `supabaseClientProvider`,
`sessionPersistenceProvider`, `authStateProvider`, `currentSessionProvider` (`net/backend_providers.dart`).
Sign out only through `NativeSessionPersistence.signOut()`.

## 6. Upgrade path: Capacitor 52/53 → Flutter 60

1. Capacitor wrote `anacan.backend-admission.v1` (Preferences), the session backup v2 (and possibly v1), the adoption
   receipt, and (53 only) `anacan.migration.localstore.v1`. The full SDK session lived in WebView localStorage, which
   Flutter cannot read.
2. Flutter starts: admission reads the Preferences pin, reads the control document, advances, rewrites the pin.
3. `SessionStore.initialize` finds no SDK copy → supabase_flutter emits `INITIAL_SESSION` without a session.
4. Adoption: the receipt for this handoff is already `complete` (52/53 ran on the managed realm) → plain restore →
   backup found → one refresh grant (4.3) → rotated pair saved in SDK copy and backup. User stays signed in.
   If the receipt is missing/pending: the full adoption flow runs (an extra `refreshSession()`).
5. Offline at first launch: the grant fails retryably → the retry screen (8 s bound), backup intact, next launch retries.
   This matches React source-first builds, which also block on an expired, unrefreshable token.
6. 53 → 60 only: `MigrationImport.pendingImport()` exposes the localStorage export to features; `markImported` once.
   52 → 60 has no export (plan §6 hidden-WebView fallback, not implemented here).

## 7. Rollback path: Flutter 60 → Capacitor 52/53

The Capacitor build finds the Preferences pin (it reconciles it with its own older localStorage copy; a newer Flutter
pin wins), the v2 backup with the latest rotated pair (or the tombstone after a Flutter logout) and the adoption
receipt. Its WebView localStorage still holds the pre-upgrade SDK session whose refresh token was already rotated by
Flutter: if its access token is expired, the Capacitor SDK refresh fails with `refresh_token_already_used`
(terminal) and React writes a tombstone → the user must sign in again. **Known limitation**, not fixable from Flutter
(the WebView store is unreachable). If the old access token is still valid the Capacitor app works until it expires,
then hits the same path. Forward again to Flutter: the backup rule in 4.3 discards the stale SDK copy.

## 8. Deviations forced by supabase_flutter / gotrue (vs supabase-js)

- **API shape:** gotrue throws instead of returning `{data, error}`; `GoTrueSessionGateway` restores the shape.
  `signOut` cannot be monkey-patched; callers use `NativeSessionPersistence.signOut()`. gotrue reports a failed remote
  logout by throwing (supabase-js may resolve `{error}`); local cleanup runs either way.
- **Refresh semantics:** gotrue's `getSession()` refreshes only when `isExpired` (30 s margin, supabase-js 90 s) and,
  on failure, returns a still-valid token instead of throwing; `refreshSession()` without an argument uses the in-memory
  session (supabase-js re-reads storage under a lock). Retries: gotrue retries retryable refresh errors for < 10 s
  (supabase-js ~30 s). gotrue signs out on *any* non-retryable refresh error, including non-JSON 4xx and 429 — the
  `AnacanHttpClient` classification turns those into network errors (tested with a real `GoTrueClient`).
- **Storage key:** supabase_flutter has no `storageKey` option; SessionStore stores under the selected key name in
  Flutter's shared_preferences. The WebView localStorage copy is not migrated (always one refresh on first launch).
- **Persisted JSON:** gotrue derives `expires_at` from the JWT `exp`, not from the stored field.
- **PKCE/code verifier:** supabase_flutter defaults to PKCE; the client is set to `AuthFlowType.implicit` like
  supabase-js. gotrue's verifier key is `supabase.auth.token-code-verifier` (not `<storageKey>-code-verifier`); it is
  stored in the same Flutter store and the logout cleanup removes `<storageKey>-code-verifier` only. An OAuth flow
  in flight across the upgrade is not carried over.
- **Deep links:** `detectSessionInUri: false` (the WebView never parsed native deep links); the auth feature must
  handle `com.atlasoon.anacan://auth-callback` itself.
- **Initial-session race:** `Supabase.initialize` starts its own `recoverSession()` (refresh of an expired SDK copy)
  in the background; gotrue de-duplicates it with ours per refresh token.
- **No WebView mirror** of the admission pin; no Lovable broker; `cutover` is a typed bool (the vitest string case
  does not apply). `isNativePlatform` replaces the `app.anacan.az` origin check.
- **Watcher wakes:** `online` has no built-in equivalent; resume is wired, connectivity must be fed by the shell.

## 9. Not verified here

This environment has no device, no Xcode and no Android SDK.

- `LegacyPreferencesChannel.kt`, `MainActivity.kt` and the channel in `AppDelegate.swift` were **not compiled**.
  Their Dart side is tested only against a mocked channel.
- The exact Android file (`CapacitorStorage`) and iOS prefix (`CapacitorStorage.`) were checked against
  `node_modules/@capacitor/preferences` 8.0.1 sources, not against a real 52/53 installation.
- `Supabase.initialize` with these options was not run end to end (the tests use the real `GoTrueClient` with a fake
  server, not the platform plugins); `shared_preferences` on device not exercised.
- The live admission endpoint and real token rotation were not called.

### Device test checklist
1. Install Capacitor 52 (and separately 53), sign in, background the app; install Flutter 60 over it (same signing).
   Expect: no login screen; one `POST /auth/v1/token?grant_type=refresh_token`; v2 backup in Preferences rotated.
2. Same with the network off at first Flutter launch: retry screen, no login form; network on + retry → signed in.
3. Flutter 60 logout → install 52/53 over it: Capacitor shows the login form (tombstone honoured).
4. Flutter 60 signed in → roll back to 53: note whether a re-login is required (section 7) → forward to 60 again:
   Flutter uses the Capacitor backup, no stale-token sign-out.
5. Android: verify `/data/data/com.atlasoon.anacan/shared_prefs/CapacitorStorage.xml` keys are read and written
   (pin, backup); iOS: `CapacitorStorage.*` keys in the app's UserDefaults plist.
6. Captive portal Wi-Fi at launch: app opens on the pinned backend, no restart loop; on a real outage of
   `api.anacan.az` (401/403/5xx) the pinned backend is kept.
7. Publish a maintenance admission on staging: running app restarts into the retry screen, stays there offline.
8. `minNativeVersion` above 60.0 on staging: update-required screen.
9. 53 → 60: `MigrationImport` sees `anacan.migration.localstore.v1`; marker written once.
10. Requests carry `X-Anacan-Version: 60.0`; a hung REST call fails after 20 s, an AI function after 90 s.
