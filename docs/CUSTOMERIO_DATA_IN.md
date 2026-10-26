# Customer.io mobile Data In

## Current native43 acceptance — 2026-09-30

The production native profile is reconciled to **workspace224149 / source93570 /
EU**. Both signed native43 development packages and the separate Store43 build
use that profile. Android/iOS package checks confirm the key is native-only,
the official bridge/SDK is linked, and Customer.io messaging modules are absent.

The actual iOS4.9.0 SDK's identify, track and screen batch received HTTP200;
the same owned test profile was independently observed through Customer.io OAuth.
The fixture receipt now reads its workspace/source from the selected build profile,
rather than the old hardcoded93520 label. Evidence: `customerio-sdk-ingestion.json`,
`customerio-sdk-build.json`, `release43-customerio-destination.json`, and
`customerio-android-package-43.json` / `customerio-ios-package-43.json` under
`azure-migration/ops/`. [Release43 status](RELEASE_43_SOURCE.md).

Historical93520 configuration and earlier receipts below describe older artifacts.

## Runtime and scope

Anacan uses React 18 / TypeScript / Vite 5 in Capacitor 8 WebViews, with npm and
`package-lock.json`. The requested React Native package requires a different
runtime. The user approved the equivalent official native SDK integration on
2026-09-28: **Customer.io iOS 4.9.0 DataPipelines** and **Android 4.22.0 datapipelines**,
through the local `@anacan/customerio-data-in` Capacitor bridge.

The original local native profile recorded workspace **224149**, source **93520**, EU ingestion
`https://cdp-eu.customer.io`. Its Customer.io source option remains `reactnative`
(Mobile). The supplied **CDP source write key** is used as the SDK's `cdpApiKey`.
The source type was not changed through a management API. Account inspection on
2026-09-30 corrected the actual source to **93570**; see the verification followup
below before staging another native candidate.

Only Data In is linked and initialized. Customer.io push, in-app, location,
geofencing, live activities, transactional messaging, and Site ID configuration
are not part of this integration. Existing messaging remains independently owned.

## Configuration

- The supplied value is in the ignored `.env.customerio.production.local` file.
  It is intentionally absent from this document and tracked source literals.
- Native staging explicitly selects `--customerio-profile production`, `sandbox`,
  or `off` (default). Sandbox requires its own
  `.env.customerio.sandbox.local`; it cannot inherit the production source/key.
- Both private profiles use `VITE_CUSTOMERIO_ENABLED`,
  `VITE_CUSTOMERIO_ENVIRONMENT`, `VITE_CUSTOMERIO_REGION`,
  `VITE_CUSTOMERIO_WORKSPACE_ID`, `VITE_CUSTOMERIO_SOURCE_ID`, and
  `VITE_CUSTOMERIO_CDP_WRITE_KEY`.
- `azure-migration/scripts/customerio-native-config.mjs` validates the selected
  profile and stages the credential only in the candidate's
  `capacitor.config.json` → `plugins.CustomerIoDataIn.cdpApiKey`.
- The write key ships with the native package as expected for a mobile SDK.
  It is excluded from Vite's JS configuration, bridge call arguments, build
  metadata, logs, and credential-free handoffs. SDK logging is `none`.
- The native singleton accepts repeated initialization of the same selected
  profile; changing profiles requires an app restart.

## Actual app behavior

`CustomerIoSession` runs inside the existing `AuthProvider`, after backend
admission and session restoration. It identifies the authenticated UUID after
login/restoration when that account's existing `privacy_share_analytics`
preference is enabled. A missing or unreadable preference does not enable
tracking. Traits are limited to UI language and the selected environment.

Logout, account/backend changes, and consent withdrawal clear tracking identity.
Queued operations are bound to their originating account/backend. SDK failures
are isolated from auth, navigation, and successful app mutations.

- **Track:** `community_post_created`, after `submit_community_post_v1` actually
  succeeds. The request ID is used only for local deduplication. Post text, media,
  medical data, private group IDs, and notes are not event properties.
- **Screen:** existing `useScreenAnalytics` / `logScreenView` navigation. The
  currently mounted screen is also emitted when identification finishes, without
  backfilling pre-consent navigation or replaying a previous account's screen.
- Automatic SDK lifecycle/device-attribute tracking is disabled; navigation is
  app-owned, rather than reporting the single native WebView repeatedly.

## Verification

**Later import check,2026-09-29:** strict requests with the currently configured
key return HTTP401 on both `/v1/batch` and the SDK's `/v1/b` transport. The
historical HTTP200 observation below used the SDK's permissive response handling;
it does not establish current key validity or destination profile arrival.
Source installation was completed through Lovable OAuth on2026-09-30. Customer.io
account inspection confirmed the actual React Native source is **93570**, with
active destination35292; the earlier93520 metadata reference and stale local key
were incorrect. The server's private `.env.customerio-sync.local` now uses the
verified key. Strict ingestion and the owned SDK test profile's arrival are verified.
All14,728 Source profiles have now been verified in Customer.io, with zero backlog
or failures. The minute-scheduled server sync is live; see `CUSTOMERIO_AUTOMATIC_SYNC.md`
and `azure-migration/ops/customerio-destination-verification.json`. It automatically backfills
existing accounts and captures future account/profile/child/subscription changes
independently of native login. It uses the same Auth UUID identity contract.

This server acceptance does not rebuild older native artifacts. Their embedded
configuration and historical source93520 report labels are release-specific;
future native staging must reconcile the production native profile with the
currently verified source93570 before creating a new candidate.

Relevant checks include TypeScript; tracking/configuration unit tests; auth
restoration/consent/account-switch tests; the real post-mutation integration;
and isolated native SDK acceptance.

On **2026-09-29 04:37:23 UTC**, the actual iOS SDK generated an identify,
`community_post_created`, and screen batch and received **HTTP 200** from
`cdp-eu.customer.io`. The unique test identifier was
`anacan-cio-verification-20260929t043546401z-caf0b911-ae9c-4796-938d-3b2a7cdcd6ec`.
Event timestamps were `04:37:21.551Z`, `.556Z`, and `.562Z`. Test traits/properties
were explicitly marked `integration-test`; the event name is a real app event.

Evidence: `azure-migration/ops/customerio-sdk-ingestion.json` and
`customerio-sdk-build.json`. The fixture uses the production native integration
and official SDK, observes its real HTTPS requests/responses with normal TLS,
and records only non-production identifiers, timestamps, types and status codes.

The SDK intentionally stubs settings/network startup in DEBUG/XCTest. Therefore
native acceptance builds **Release**, matching the shipping SDK behavior. The
workstation's Xcode test-manager startup timed out; running the compiled native
XCTest bundle directly on the iOS simulator completed the ingestion check.

**Boundary:** Customer.io MCP was unavailable and `cio` was not installed in PATH.
Workspace/source event-list arrival has not been independently verified through
Customer.io management tooling. HTTP ingestion acceptance is verified; a
physical-device or store-release acceptance is separate. Current candidate/package
status belongs in `docs/MODERATOR_CONSOLE.md`.

Reproduction (uses the private production profile and creates a unique test ID):

```sh
node azure-migration/ops/verify-customerio-sdk.mjs
# When the workstation test manager cannot launch, build and run separately:
node azure-migration/ops/verify-customerio-sdk.mjs <owned-verification-run> --build-only
ANACAN_CUSTOMERIO_SIMULATOR=<simulator-uuid> node azure-migration/ops/verify-customerio-sdk.mjs <owned-verification-run> --direct
```
