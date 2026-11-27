# Flutter port: dead and web-only code

What is **not** ported, with evidence. Measured on `claude/blissful-sagan-lqhvv9` (HEAD `8e2bac89`, 2026-11-27).

## Method

- Entry: `src/main.tsx` → `src/bootstrap-app.tsx` → `src/App.tsx` → `src/pages/Index.tsx`, bundled with esbuild and
  `VITE_NATIVE_BUILD=true` / `MODE=google`, so the `VITE_NATIVE_BUILD !== 'true'` branches in `main.tsx` (web entry,
  website, brand portal, public blog) are folded away exactly like the Vite build. The walk follows static imports,
  `import()` / `React.lazy`, `import.meta.glob` (expanded with fast-glob; the glob in `components/admin/sections.ts`
  uses negative patterns and is admin-only anyway), `new Worker(new URL(...))` and `?url` imports.
  2 044 files reachable natively; 1 852 after cutting the web-only routes (the "consumer graph").
- An import whose binding is never used is elided by TypeScript/esbuild, so a file that is only imported "for nothing"
  is dead in the bundle (marked *unused import* below).
- Every candidate was cross-checked with a second, regex-based importer scan over all of `src/` including tests and
  `import type`. "0 importers" means nothing in `src/` imports it at all.
- Type-only modules (`types.ts`, generated DB types) do not appear in a bundle; they are not dead but have no runtime
  to port (Dart models are written from them as needed): `src/integrations/supabase/types.ts` (25 131 lines, generated),
  `src/integrations/supabase/database-types.ts`, `src/data/kid-exercises/types.ts`, `src/data/play-together/types.ts`,
  `src/lib/blog-content.d.mts`, `src/web-entry/policy.d.mts`, `src/public-blog/model.ts`, `src/website/calc-content/types.ts`.

## 1. Dead: unreachable from any entry (do not port; candidates for deletion in React)

| File(s) | LOC | Evidence |
|---|---|---|
| `src/components/baby/SleepHistoryPanel.tsx` | 266 | *unused import*: `Dashboard.tsx:50` imports it, never renders it |
| `src/components/community/GroupsList.tsx` | 144 | *unused import*: `CommunityScreen.tsx:22` imports it, never renders it |
| `src/components/community/CreatePostModal.tsx` | 385 | 0 importers (replaced by `CreatePostScreen.tsx`) |
| `src/components/chat/ChatMediaUpload.tsx` | 282 | only `ChatMediaUpload.test.tsx` |
| `src/components/chat/ChatMessageBubble.tsx` | 159 | 0 importers |
| `src/components/bump/PregnancyDayNavigator.tsx` | 163 | 0 importers (`usePregnancyDayNavigation` hook is used directly by `Dashboard`) |
| `src/components/mommy/QuickActionsBar.tsx` | 135 | 0 importers |
| `src/components/mommy/hero/*` (MommyHero + 8 variants) | 895 | `MommyHero.tsx` has 0 importers; variants imported only by it |
| `src/components/qaygicash/QaygiCashHomeCard.tsx` | 65 | only `QaygiCash.test.tsx` |
| `src/components/funnel/**` (ReverseTrialFunnel, funnelData, 9 steps) | 879 | 0 importers outside the folder; the web funnels (`docs/WEB_FUNNELS.md`) do not use them either |
| `src/components/OnboardingScreen.tsx` | 6 | 0 importers (stub) |
| `src/components/NavLink.tsx` | 28 | 0 importers |
| `src/components/admin/push/LegacyBulkPushTab.tsx` | 425 | 0 importers (admin, legacy) |
| `src/hooks/useConfigData.ts` | 326 | 0 importers |
| `src/hooks/useUnsavedChanges.ts` | 136 | 0 importers |
| `src/hooks/useDynamicOnboarding.ts` | 112 | 0 importers |
| `src/hooks/useUserBadge.ts` | 73 | 0 importers |
| `src/hooks/useBrandAds.ts` | 39 | 0 importers |
| `src/hooks/useTranslation.ts` | 21 | 0 importers (only mocked by `NativeAdCard.test.tsx`) |
| `src/hooks/use-mobile.tsx` | 19 | only `ui/sidebar.tsx`, itself dead |
| `src/lib/iap.ts` | 47 | 0 importers (re-export shim of `revenuecat.ts`) |
| `src/lib/referralSync.ts` | 50 | 0 importers; file header says deprecated (Duzelis33) |
| `src/lib/recap/index.ts` | 7 | 0 importers (barrel; callers import the modules directly) |
| `src/lib/recap/fixtures.ts` | 52 | tests + `scripts/recap/demo-entry.ts` only |
| `src/integrations/lovable/index.ts` | 38 | 0 importers; only consumer of `@lovable.dev/cloud-auth-js` |
| `src/integrations/supabase/previewAuthStorage.ts` | 93 | 0 importers (Lovable preview auth broker) |
| `src/components/ui/{alert,aspect-ratio,breadcrumb,chart,command,context-menu,drawer,empty-state,form,hover-card,input-otp,menubar,navigation-menu,pagination,resizable,separator,sidebar,skeleton-shimmer}.tsx`, `ui/use-toast.ts` | 2 471 | 0 importers (`separator` only from `sidebar`; app code imports `@/hooks/use-toast`, not `ui/use-toast`) |
| `src/App.css` | 42 | 0 importers (Vite template leftover) |
| `src/assets/logo.png`, `src/assets/onboarding/{README.md,manifest.json}` | – | 0 importers (onboarding images are reached by `import.meta.glob('../../assets/onboarding/*.webp')`, the manifest is documentation) |
| `src/data/maternity-regional.references.json` | 204 | 0 importers (source notes for `maternity-regional.json`) |
| `android/.../TimerWidgetProvider.kt` + `res/xml/timer_widget_info.xml` | 116 | Not declared as a `<receiver>` in `AndroidManifest.xml` and not referenced by any other class: the timer home widget can never be added. The timer surface on Android is the foreground-service notification only. |

Total dead TS/TSX: 7 316 lines.

## 2. Reachable natively but web/admin-only (stays React, not ported)

| Area | Files / LOC | Evidence |
|---|---|---|
| Admin panel | `src/components/AdminPanel.tsx`, `src/components/admin/**` (131 files, 37 914 LOC), `src/contexts/AdminLanguageContext.tsx`, `src/pages/AdminPage.tsx`, `src/pages/AdmobAdminPage.tsx` | Reached only via `/admin*` routes in `App.tsx` and `Index.tsx` `showAdmin` (`activeScreen 'admin'`). Plan decision 1: web only; the Flutter profile entry opens the web admin link (`screen.admin`). |
| Admin-only shared modules | `hooks/{useAdmobAdmin,useAdminFAQ,useAdminMentalHealth,useAdminOnboarding,useAdminPartnerTips,useAdminRecipes,useSkillCategories,useScheduledNotifications,useAdvancedNotifications,useMommyDayNotifications,useQuickActions,useTrimesterInfo,useBabyMonthIllustrations,useEpointPayment,useSupportTicketsAdmin}.ts`, `lib/{admin-insights,epoint,in-app-epoint-pricing,premium-funnel-report,notification-tests,ads/labels,recap/window}.ts`, `utils/csvExport.ts`, `components/ads/AdmobSimulator.tsx`, `components/tools/parenting/ParentingPreview.tsx`, `ui/{badge,table,progress,collapsible,RichTextEditor}.tsx`, `styles/admin.css` | Every importer is under `src/components/admin/**` (or another file in this list). Note `useEpointPayment`/`lib/epoint.ts` are admin-only; the consumer Epoint path is `lib/in-app-epoint.ts` (`paywall.epoint-option`). |
| Moderator console | `src/components/moderation/ModeratorPanel.tsx`, `AdModerationWorkspace.tsx`, `styles/moderator.css`, `src/pages/ModeratorPage.tsx` | `/moderator` route and in-app `activeScreen 'moderator'` (Profile → "open panel" for moderators/admins). Stays React; becomes a web link (`screen.moderator`). The consumer-facing moderation pieces **are** ported: `ModeratorEnforcement`, `MyModerationDecisions`, `BlockUserDialog`, `RestrictionNote`, and the inline `ModeratorActionMenu`/`Dialog` (see open question in the report). |
| Shop-partner workspace | `src/pages/PartnerPage.tsx`, `src/components/partner-shop/panel/**` (4 files, 926 LOC), `lib/partner-panel.ts` | `/partner` route only (business users of partner shops). |
| Public blog | `src/public-blog/**` (5 files, 297 LOC), `styles/public-blog.css` | `/blog` route + `BlogLink.tsx` fallback; native renders blog posts with `BlogScreen` (`screen.blog`). |
| Dev/debug routes | `src/pages/MiniGamesPage.tsx` (standalone `/mini-games`), `src/pages/RevenueCatDebug.tsx` | Comments mark them dev/test-only; production reaches games via Tools. |
| Web entry (not in native bundle) | `src/web-entry/**` (8 files, 376 LOC) incl. `early.js` (inlined by `scripts/app-entry/plugin.mjs` only when `VITE_NATIVE_BUILD !== 'true'`) | Folded out by `VITE_NATIVE_BUILD`. **Exception:** `src/web-entry/policy.mjs` is imported by `src/lib/deeplink.ts` (`APP_ENTRY_HOSTS`, `appLaunchDestination`) and must be ported as part of `svc.deeplinks`. |
| Website | `src/website/**` (85 files, 12 852 LOC); separate entries `website/main.tsx`, `website/index.html`, `website/server-render.tsx` (SSR prerender, `scripts/website/*`) | Folded out by `VITE_NATIVE_BUILD`; Codemagic also deletes `dist/website`. `website/routing.ts` is tiny and imported by `main.tsx` only for the web branch. |
| Brand portal | `src/brand-portal/**` (14 files, 923 LOC), `standalone.tsx` (entry of `vite.brands.config.ts`) | Folded out; `brand-portal/routing.ts` only in the web branch. |
| Web-only polyfill/chunk logic | `src/lib/polyfills.ts`, `src/lib/chunk-reload.ts` (reached, but WebView-specific) | Listed in `core.boot`; nothing to port beyond "no-op". |

## 3. npm dependencies

| Package | Status | Evidence (importers in consumer / native / web graphs) |
|---|---|---|
| `@lovable.dev/cloud-auth-js` | dead | 0/0/0 (only `integrations/lovable/index.ts`, itself dead); also `external` in `vite.config.ts` |
| `mixpanel-browser` | dead | 0/0/0; `src/lib/mixpanel.ts` is a no-op stub kept for call-site compatibility (port as no-op or drop calls) |
| `@hookform/resolvers`, `react-hook-form`, `input-otp`, `cmdk`, `react-resizable-panels`, `react-easy-crop`, `@tanstack/query-sync-storage-persister`, `rehype-parse`, `rehype-remark` | dead | 0/0/0 |
| `@radix-ui/react-{aspect-ratio,context-menu,hover-card,menubar,navigation-menu,separator}` | dead | 0/0/0 (only dead `ui/*` wrappers) |
| `@radix-ui/react-collapsible`, `@radix-ui/react-progress`, `@tiptap/*` (7 packages), `bcryptjs` | admin-only | 0 consumer, ≥1 native via `components/admin/**` |
| `unified`, `remark-parse`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-stringify` | web-only | only website / public blog |
| `@anacan/tiktok-events` | native-only | no JS import; used through `registerPlugin('TikTokEvents')` in `lib/tiktok-events.ts` (port: `native.tiktok-pkg`) |
| `@capacitor/android`, `@capacitor/ios`, `@capacitor/cli`, `@playwright/test`, `@types/dompurify`, `tailwindcss-animate` | tooling | build/test/Tailwind plugin only |
| Everything else in `dependencies` | used by the consumer graph | mapped to Flutter packages in `docs/FLUTTER_MIGRATION_PLAN.md` §4 |

## 4. Not part of the Anacan app at all

- `mommy-simulator/`: a separate game project (own `capacitor.config.ts` with appId `com.atlasoon.mommysimulator`,
  own Godot/Metal "native 3D world", own README/build scripts). Nothing in `src/`, `android/`, `ios/`, `vite*.ts` or
  `package.json` references it. Not wired into Anacan; out of scope for the port.
- `scripts/i18n/*.cjs`, `build*.txt`, `*-dump.txt` and other one-off migration/translation helpers: build-time only.
