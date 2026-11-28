# Flutter shell: navigation state machine, links, gates, nav bar

Port of `src/pages/Index.tsx` (state machine + render order), `src/App.tsx` (outer routes),
`src/components/BottomNav.tsx` (+ CSS), `src/lib/{deeplink,pushNav,notification-taps,backButton,scrollMemory,scroll,
blog-links,blog-module-navigation,app-path-links,merged-tools,parenting-nav,parenting-target,widget-actions}.ts`,
`src/hooks/{useSwipeNavigation,useOverlayBackHandler,useChatChrome,useScrollToTop}.ts`, `src/web-entry/policy.mjs`
(subset). Code: `app/lib/shell/`, tests: `app/test/shell/` (451 tests, `flutter test test/shell`).
Import everything with `import 'package:anacan/shell/shell.dart';`.

Nothing here was compared against browser screenshots. The nav goldens
(`app/test/shell/widgets/goldens/nav_*.png`) are Flutter renders used as regression baselines only.

## 1. Layout

| Path | What |
|---|---|
| `shell_inputs.dart` | Read-only inputs the orchestrator must wire (§2), `ShellPlatform` side effects |
| `nav/ids.dart` | `ShellTab`, nav tab specs, `ScreenId` (+ guards), `ShellScreen`, `ToolId` (+ aliases), merged tools, `isCakesAvailable` |
| `nav/shell_state.dart` | Immutable `ShellState`, `SwipeRestore`, `BlogOverlay`, `ShellLayer`, `TourNav` |
| `nav/shell_machine.dart` | Pure transitions over a `ShellTxn` + `ShellEffect`s (every Index handler) |
| `nav/shell_controller.dart` | `shellProvider` (Riverpod `Notifier`) executing transitions/effects; process stores |
| `nav/back_button.dart` | `BackDispatcher` (overlay → screen → root layers), `BackExitPolicy` (2 s) |
| `nav/scroll_memory.dart` | `ScrollMemory` (save / restore with frame, 80, 180 ms retries; reset to top) |
| `nav/swipe.dart` | `SwipeGestureTracker` (pure port of the edge-swipe hook) |
| `nav/admin_web.dart` | `adminWebUri()` for the web admin |
| `links/*` | `parseDeeplink`, `PushNavRouter`/`intentFromPushData`, `NotificationTapQueue`, blog links/modules, app path links, entry policy, `JsUrl` (browser-URL semantics) |
| `gates/gate_sequence.dart` | `decideGate(GateInputs, …)` (pure gate order) |
| `gates/gate_host.dart` | `GateHost` widget: splash/intro timers, renders gates or the shell |
| `router.dart` | `buildShellRouter()` (go_router), `resolveOuterRoute()`, `PendingAppLink` |
| `feature_registry.dart` | `FeatureRegistry`, `featureRegistryProvider`, `ShellPlaceholder` |
| `widgets/bottom_nav_capsule.dart` | `BottomNavBar` (pure), `BottomNavCapsule` (wired) |
| `widgets/shell_scaffold.dart` | `ShellScaffold`, `ShellFrame`, `SubScreenFrame`, `TabEnter`, `SwipeNavigationDetector` |
| `widgets/android_back_scope.dart` | `AndroidBackScope` (PopScope → dispatcher → toast/exit), `OverlayBackHandler` |

## 2. Inputs the orchestrator must wire (`shell_inputs.dart`)

All throw `UnimplementedError` until overridden in the root `ProviderScope`.

| Provider | Type | Source in React |
|---|---|---|
| `shellUserProvider` | `ShellUser{isAuthenticated, authLoading, profileLoaded, userId, role, lifeStage, isAdmin, isModerator, language, profileCountryCode, storedCountryCode, linkedPartnerId, avatarUrl, displayName, backendUrl}` | `useUserStore` (isAuthenticated, role, lifeStage, language, countryCode), `useAuth` (loading, profileLoaded, user.id, isAdmin, isModerator, profile.*), `getBackendConfig().url` |
| `unreadMessagesCountProvider` | `int` | `useUnreadMessages().unreadCount` |
| `unreadCommunityPostsCountProvider` | `int` | `useUnreadCommunityPosts().unreadCount` |
| `bottomNavStyleProvider` | `BottomNavStyle` | `useAppSetting('bottom_nav_style') === 'capsule'` → capsule, else (also while loading) classic |
| `gateInputsProvider` | `GateInputs` (§9) | store flags, `useForceUpdate`, `useAppUpdate`, `useActiveBlock`, e-mail gate, `useConsentGate`, profile, `hasPendingOnboarding`, LS `anacan_pending_funnel` |
| `gateActionsProvider` | `GateActions{setHasSelectedLanguage, setHasSeenIntro, setFunnelCompleted}` | userStore setters |

`shellPlatformProvider` has a working default (`DefaultShellPlatform`: language via `appLanguageProvider`,
`url_launcher` external, `SystemNavigator.pop`); `logScreenView` is a no-op until analytics is ported.
`featureRegistryProvider` defaults to an empty registry (placeholders everywhere).

## 3. State (`ShellState`)

`activeTab` (`ShellTab`), `activeScreen` (raw string, kept even when it does not render), `activeTool` (raw id, the
Tools hub's `initialTool`), `toolOpenedFromDashboard`, `toolsResetKey` (remounts the Tools hub), `showMotherChat`,
`viewingUserId`, `communityDeepLink` (`CommunityDeepLinkTarget{postId, commentId, storyId, dmUserId, conversations,
userId, groupId, composeBlog}`), `blogSection` (home scroll target of a blog module), `swipeRestore`, `blogOverlay`
(BlogLinkHost article: slug + `<backend>:<user>` scope). `showAdmin` does not exist natively.

Render precedence after the gates (`layerFor`): `viewingUserId` → user profile (in `.a-subscreen`) → a *rendered*
sub-screen (§5 guards) → `showMotherChat` → Messages → frame (tabs + nav). The blog article overlay is drawn over
whatever layer is showing; the layer below stays mounted.

### Tabs
Woman nav: `home`, `tools`, `community`, `ai` (AI pill), `profile`. Partner nav: `home`, `together`, `chat`, `ai`
(pill, "Məsləhət"), `profile`. Link-only: `cakes` (rendered for admins or `isCakesAvailable(profile.country_code ||
countryCode, language)`), `community` for partners (rendered with the woman/shared variant). Partner variant = role
`partner` and tab ≠ `community` (BottomNav `isPartner` uses role only). A tab with no content (e.g. `cakes` elsewhere,
`tools` for a partner) resets to `home` after the commit (also when the role/language changes).

## 4. Transitions (`ShellController` → `shell_machine.dart`)

| Controller method | React origin | Effect |
|---|---|---|
| `selectTab(tab)` | `handleTabChange` (nav tap) | `tools`: tool null, fromDashboard false, toolsResetKey+1. If tab changes: save `tab:<old>`, restore `tab:<new>`. Does **not** close `activeScreen` or clear the community target. |
| `setTab(tab)` / `openAssistant()` | raw `setActiveTab` (open chat, AI decline, partner chat back, Dashboard assistant) | tab only |
| `openScreen(raw)` / `openScreenId(id, param)` | `setActiveScreen(s)` | save `tab:<committed tab>` |
| `closeScreen()` | `setActiveScreen(null)` (every screen `onBack`) | restore `tab:<committed tab>` |
| `navigateScreen(raw)` | `navigateScreen` (Profile, loss memories) | `home` → screen null + tab home |
| `openTool(ToolId, {fromDashboard = true})` | `handleNavigateToTool` | tool, fromDashboard, tab `tools` |
| `toolBack()` | `handleToolBack` | fromDashboard → tool null + tab home; else tool null |
| `screenOpensTool(id)` / `screenOpensAssistant()` | Recovery/LossMemories `onNavigateToTool`, BabyChat `onOpenAssistant` | screen null, then tool / tab `ai` |
| `openMotherChat()` / `closeMotherChat()` | Dashboard `onOpenChat`, Messages `onBack` | |
| `viewUser(id)` / `closeUserProfile()` / `userProfileSendMessage(id)` / `userProfileEditProfile()` | UserProfileScreen props | send message → community `{dmUserId}`; edit → community `{userId: me}` + `edit-profile` |
| `communityEditProfile()`, `consumeCommunityDeepLink()`, `notificationsToCommunity(target?)` | CommunityScreen / NotificationsScreen props | |
| `back()` | root back handler | §6 |
| `swipeBack()` / `swipeForward()` | `handleSwipeBack/Forward` | §7 |
| `applyDeeplink(parsed)` / `openUrl(url)` | `handleDeeplink` | §8 |
| `navigateFromPush(data)` | `navigateFromPush` + `applyIntent` | §8 |
| `dispatchPushEvent(intent)` / `openParentingTool(target)` | `PUSH_NAV_EVENT` without pending | applied only while ready |
| `openBlogModule(module)` | `openBlogModule` + Index `show()` | §8 |
| `openBlogOverlay(slug)` / `openAppBlogLink(url)` / `closeBlogOverlay()` | BlogLinkHost | not signed in / profile not loaded → remembered (24 h) and opened as screen `blog/<slug>` once ready |
| `clearBlogSection()` | Dashboard after scrolling to `[data-blog-module-section]` (100 × 100 ms tries) | |
| `tourNavigate(TourNav)` / `tourPreview()` | onboarding tour | tool → fresh hub; Tools tab resets; preview → screen null + home |
| `openAdminWeb()` | Profile → Admin Panel | opens `https://<admitted public host or app.anacan.az>/admin?web=admin` in the browser |

Post-commit (Index effects): `activeScreen == 'admin'` and admin → open web admin, close the screen (non-admins keep an
unrendered `admin` screen, like Index). Every tab/screen/tool change: scroll reset to top (now, frame, 80 ms) and
`logScreenView(name, Screen|Tools|Tab)` with `{home: Dashboard, tools: ToolsHub, ai: AIChat, shop: Shop, cakes: Cakes,
profile: Profile, community: Community}` when authenticated. On user change: another scope closes the article;
signed in + profile loaded → pending article opens as `blog/<slug>`, pending blog module is shown; ready
(`isAuthenticated && !authLoading && profileLoaded`) → pending push intent is consumed and applied.

**Scroll memory**: one scroll container; positions per key `tab:<tab>`. `restore` ignores ≤ 0, applies on the next
frame and at 80 / 180 ms (the last one wins over the reset), cancelled by a newer restore or `cancelRestoration()`.
`scrollToTop()` = `useScrollToTop` (now, frame, 60 ms) for features. The "committed tab" is the tab of the last render
(`activeTabRef`), not the one set earlier in the same handler.

## 5. Screens (51 `ScreenId`s incl. `admin`), tools (48 + 11 aliases)

Guards (screen stays in state but the tab frame renders when the guard fails): `mommy-period` mommy;
`books`/`my-books` admin or language az; `recovery`, `recovery/kegel`, `partner-sharing`, `loss-guide`,
`loss-guide/signs`, `loss-memories` not partner; `shop` admin; `name-voting`, `partner-hospital-bag`, `daily-summary`,
`partner-shopping`, `partner-appointments`, `partner-baby-day`, `partner-weekly-stats`, `partner-surprises`,
`partner-parenting`, `hospital-run`, `live-contractions`, `postpartum-support`, `partner-loss-support` partner only;
`baby-chat` not partner and stage bump; the rest (`moderator`, `moderation-history`, `notifications`, `settings`,
`ad-preferences` (back → `settings`), `widgets`, `illness`, `health-sync`, `qaygicash`, `recap`, `referral`,
`doctor-report`, `calendar`, `aptek[/cart|/orders|/p:<id>]`, `edit-profile`, `help`, `privacy`, `partner-privacy`,
`appearance`, `billing`, `legal[/<doc>]`, `blog[/<slug>]`, `night-shift`, `partner-notifications`, `birth-plan`,
`partners`) none.

Tools (`ToolId`, ids of `ToolsHub.renderToolById`): photoshoot, nutrition, shopping, safety, kick, contraction, weight,
whitenoise (white-noise), names (baby-names), hospital, exercise (exercises), mood (mood-diary), blog, recipes, doctors,
blood-sugar, blood-pressure, danger-signs, preemie-hub, pregnancy-album, baby-album, cry-translator, poop-scanner,
weather-clothing, noise-meter, secondhand-market (second-hand-market), mom-friendly-map, smart-play-box, play-together,
kid-exercises, mental-health, first-aid, fairy-tale, horoscope, baby-growth (growth-tracker), fetal-growth, affiliate
(affiliate-products), maternity-calculator (maternity), teething (teething-tracker), vaccine-calendar
(vaccines-calendar), vitamin-tracker (vitamins), cakes, baby-tracker, sleep-training, solid-food-guide, weaning,
parenting, mini-games. Merged tools (`docs/MERGED_TOOLS.md`): `kToolHost`, `kHostSections`, `resolveToolTarget`,
`isMergedAway`, `kToolCompanion` are for the Tools hub feature. Unknown tool ids are kept raw (the hub shows its list).

## 6. Android back

`AndroidBackScope` (Android only) wraps the Index route. Flutter pops pushed routes (dialogs, `showASheet`) first —
they are the top of the overlay layer. Then `BackDispatcher`: `overlay` (in-tree overlays via `OverlayBackHandler`,
the blog article) → `screen` (features' own back, e.g. the Tools hub closing a tool) → `root` (shell). Inside a layer
the newest handler first; a throwing handler is skipped. Root order: viewed user → mother chat → screen (restores
the tab scroll) → tool (+ hub remount) → non-home tab → home → not consumed: toast `back_press_again`
("Çıxmaq üçün yenidən basın", 1 800 ms); a second press within 2 000 ms exits (`ShellPlatform.exitApp`).

## 7. Edge swipe

Left edge ≤ 55 px (right edge in RTL), threshold 35 px; vertical-first movement cancels; diagonal needs dx > 1.5·dy;
fast flicks resolved at touch end; `maxDeltaX` counts when the finger came back. Enabled when authenticated and no
article overlay (the shell is only rendered after the gates). Back pops: screen → viewed user → mother chat → tool
(only on the Tools tab, via `handleToolBack`) and remembers it; forward re-opens it once; a push clears it. Never
switches tabs.

**Interactive back swipe (iOS, `widgets/edge_swipe_back.dart`, no React source).** `edgeSwipeBackPlatformProvider`
(iOS only: Android's system back gesture/button already reaches `AndroidBackScope`). A drag starting ≤ 20 px from
the leading edge (trailing in RTL) slides the top layer (the blog article over the mounted layer, else the shell
layer) with a shadow over the dimmed `--a-bg`; release past 35 % of the width or a flick ≥ 700 px/s → slide out,
unfocus, then `edgeSwipeBack`: `BackDispatcher` overlay + screen layers (same handlers/guards as the back button),
then the root layer only when `edgeBackCanPopRoot` (a layer above the frame, or a tool on the Tools tab) — never the
tab switch or exit toast. Starts only when `edgeSwipeCanGoBack`; claims the pointer after 6 px (before carousel and
scroll slop), vertical-first or backwards movement releases it. While on, the Index detector above ignores
back-edge starts (`reserveBackEdge`), so a swipe never goes back twice; forward swipes stay. Dialogs/sheets are
Navigator routes above the shell and get no edge swipe.

**Keyboard** (`design/widgets/keyboard_dismiss.dart`, `KeyboardDismissScope` in `AppChrome`): a tap outside the
focused field's `TextFieldTapRegion` group unfocuses it; a vertical user drag of any scroll view unfocuses a text
field (not the text scroll inside a multi-line field). Chat composers (DM/group, AI, baby chat) are wrapped in
`TextFieldTapRegion`, so send keeps the keyboard open.

## 8. Deep links and push taps

`parseDeeplink(url)` accepts `anacan://`, `com.atlasoon.anacan://` (host + path, host case kept), `https://` on
`app|gcp|api.anacan.az`, app-relative `/…`; no userinfo/port. `?blog_language=` / `?language=` (app language) adds
`params.language` → language switch first.

| Path | Parsed | Applied |
|---|---|---|
| `/` `/tools` `/ai` `/community` `/profile` `/cakes` | `tab` | tab; tool null; screen null |
| `/books` `/my-books` | `screen` | screen |
| `/tool/{id}[?widget_action=feed\|sleep\|diaper]` | `tool` | widget action stored (30 s, read once); tab tools; tool (same tool + action → close now, reopen next tick); fromDashboard false |
| `/parenting/(sos\|article\|programme)/{[a-z0-9-]{1,60}}` | `tool` parenting | parenting target + push event (partner → screen `partner-parenting`, else tool `parenting`) |
| `/premium` | screen `billing` | |
| `/settings` `/notifications` `/calendar` `/help` `/edit-profile` `/appearance` | `screen` | |
| `/blog`, `/blog/{slug}`, `/blog/{21 langs}[/{slug}]` | screen `blog[/slug]` (+language) | article remembered, screen |
| `/messages[/{user}]` | `messages` | mother chat (user id ignored) |
| `/community/post/{id}` | `community-post` | tab community, screen null, `{postId}` |
| `/user/{id}` | `user-profile` | viewed user |
| `/legal/{doc}` | screen `legal/{doc}` | |
| `?blog_module=sleep\|feeding\|diaper\|babyGrowth\|hospitalBag\|calendar` | `blog-module` | remembered until ready; screen/chat/user/tool cleared; calendar → screen; hospitalBag/babyGrowth → tool `hospital`/`baby-growth` from dashboard (+hub remount); not mommy or partner → screen `blog`; else home + `blogSection` |

Push taps (`NotificationTapQueue` → `navigateFromPush`): the native plugins call `deliver(data)` from boot; the shell
attaches on build; before that only the latest tap is kept; the same JSON within 2 s is dropped; logout →
`clearQueued()`. `data.deeplink` is used when it is an app scheme with `//`, or https on the current origin
(`https://app.anacan.az`), `anacan.az`, `www.anacan.az`, `app.anacan.az`, `anacanapp.lovable.app` or the configured
backend origin, with no userinfo: parsed → intent `{deeplink}`; website (`anacan.az`/`www`) → browser after 350 ms;
other trusted pages → `ShellPlatform.openWebPage`, falling back to the `type` intent when it fails. Otherwise the
`type` table (`kPushTypes`, 34 types):

| `type` | Intent |
|---|---|
| `message` `partner_message` `love` `thank_you` | mother chat (partner: tab `chat`) |
| `direct_message` | community `{dmUserId: sender_id}` if UUID else `{conversations}` |
| `shopping_list` | partner: home + `partner-shopping`; woman: tool `shopping` from dashboard |
| `parenting_programme` | target `{programme}`; `partner == '1'` → `partner-parenting`, else tool `parenting` |
| `baby_chat` | screen `baby-chat` |
| `group_message` `group_invite` `group_join_request` | community `{groupId}` if UUID |
| `community_like` `community_comment` | community `{postId}` |
| `community_moderation` | community `{postId}` if UUID |
| `moderation_action` | screen `moderation-history` |
| `community_reply` | community `{postId, commentId: interactionId (UUID) ?? commentId}` |
| `comment_like` | community `{postId, commentId}` |
| `story_like` `story_reply` | community `{storyId}` |
| `like` `comment` `community` | community `{}` |
| `premium_expired` `subscription` | screen `billing` |
| `contraction_511` | screen `live-contractions` |
| `appointment` `appointment_reminder` | screen `calendar` |
| `flow_reminder` `period_reminder` `pill_reminder` `sos` `sos_alert` `birth` `birth_alert` | tab `home` |

An intent is stored as pending; applied (and consumed) only when ready. Applying resets viewed user, mother chat,
screen, tool, fromDashboard, community target, swipe restore and remounts the hub, then: motherChat → shoppingList →
deeplink → tool → screen → tab (+ community target, `{}` when none). Every push event closes the article overlay.

## 9. Gates (`decideGate`, first match wins)

1 splash (350 ms, once per process; the independent 1 500 ms timer also hides it and shows the intro when not seen) →
2 initial language (unless intro seen / onboarded / signed in, which also sets `hasSelectedLanguage`) → 3 intro →
4 startup while auth loads → 5 update-centre force → 6 legacy `force_update` → 7 auth → 8 full block → 9 startup while
a new (not onboarded) account's e-mail decision is pending → 10 e-mail code (required + address) → 11 consent
(loading → startup; show with a version → consent) → 12 country (profile loaded, empty `country_code`, not just set) →
13 onboarding when `(!onboarded && !partner) || needsName || pendingJourney || legacyPending` (startup until the
profile loads) → 14 shell (`setFunnelCompleted(true)` if not yet). `GateHost` renders `registry.gate(GateId)` with
`GateArgs{decision, inputs, onIntroComplete, onCountryDone}`; unregistered → placeholder. The brief's suggested order
(consent before intro, maintenance) does not match the code; the code order above is what is implemented.
Maintenance / admission errors happen before Flutter's widget tree (`core/admission`), not in Index.

## 10. Outer routes (`router.dart`)

`/` → `AndroidBackScope(GateHost)`; `/blog/:slug`, `/blog/:language/:slug` → remember the article, redirect `/`;
`/reset-password`, `/legal/:docType`, `/payment/success`, `/payment/error`, `/mini-games` → `registry.routePage`;
anything else: a known app path (`appLinkForPath`) is remembered 30 min and the location becomes `/` — the shell's
`PendingAppLink` hands it to `navigateFromPush({deeplink})` once signed in; other paths → `/404` (NotFound page).
Trailing slashes are ignored. **Omitted (web-only):** `/blog` (public blog), `/admin`, `/admin/:section`,
`/admin/ads`, `/moderator`, `/partner`, `/p/v/:token`, `/h/:code` (promo codes arrive via the native deeplink handler),
`/debug/revenuecat`, `/revenuecat-debug`; the web launcher/admin entry (`src/web-entry`) and `?ad_preview` admin links.

## 11. Feature registration

Each feature exposes one function and registers its widgets:

```dart
void registerKickCounter(FeatureRegistry r) {
  r.registerTool(ToolId.kick, (context, a) => KickCounter(onBack: a.onBack));
}
void registerSettings(FeatureRegistry r) {
  r.registerScreen(ScreenId.settings, (context, a) => SettingsScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.legal, (context, a) => LegalScreen(onBack: a.onBack, initialDocument: a.screen.param));
}
void registerHome(FeatureRegistry r) {
  r.registerTab(ShellTab.home, (context, a) => const Dashboard());
  r.registerTab(ShellTab.home, (context, a) => const PartnerHomeScreen(), partner: true);
  r.registerTab(ShellTab.ai, (context, a) => const AIChatScreen(), fillsViewport: true);   // h-full tabs
  r.registerFrameOverlay('alert-receiver', (context) => const AlertReceiver());
}
// app root:
final registry = FeatureRegistry()..registerAll([registerHome, registerSettings, registerKickCounter /* … */]);
ProviderScope(overrides: [featureRegistryProvider.overrideWithValue(registry), /* §2 inputs */], child: …);
```

Also `registerOverlay(ShellOverlayId.motherChat|userProfile|blogArticle, …)`, `registerGate(GateId.x, …)`,
`registerRoutePage(OuterRouteId.x, …)`. Registering a key twice throws. Tab bodies are not scrollable themselves (the
shell owns the single scroll container, a `CustomScrollView` keyed `shell-scroll` whose last sliver is the `pb-nav`
clearance = 108 + safe area); `fillsViewport` tabs get the viewport height minus `pb-nav`. A box tab
(`registerTab`) is one `SliverToBoxAdapter`; a sliver tab (`registerTabSlivers(tab, (c, a) =>
ShellSliverBody(sliver: …, background: …))`) puts its sliver straight into the scroll view, so `SliverList`s are
built lazily; `background` is painted behind the scroll view and moves with the scroll offset (the home sky). Scroll
memory, scroll-to-top and the tab enter animation (`SliverTabEnter`: `SliverOpacity` + paint translation) work the
same for both. With lazy lists the max extent is an estimate, so a restore deep into a list may clamp until the
80 / 180 ms retries (React measured the full DOM). Sub-screens get `.a-subscreen` (safe top/inline padding, `--a-bg`) and scroll
themselves. The Tools tab content is keyed by `toolsResetKey`; the hub reads `args.state.activeTool` on mount and
looks tools up with `registry.tool(ToolId)`; it registers its own `BackLayer.screen` handler for an open tool.

Opening things from feature code:

```dart
final shell = ref.read(shellProvider.notifier);
shell.openTool(ToolId.kick);                       // from Dashboard (back → Home)
shell.openTool(ToolId.kick, fromDashboard: false); // from inside the hub
shell.openScreenId(ScreenId.legal, 'privacy_policy');
shell.openScreen('aptek/cart');
shell.closeScreen();                               // screen onBack
shell.openMotherChat(); shell.viewUser(id); shell.setTab(ShellTab.ai);
shell.openUrl('anacan://tool/names');               // banners' in-app deeplinks
shell.openAppBlogLink(url); shell.openBlogModule('sleep'); shell.openParentingTool(target);
shell.openAdminWeb();
// one-shot hand-offs: ref.read(widgetActionStoreProvider).consume(), ref.read(parentingTargetStoreProvider).peek()
// full-screen chat hides the nav: ref.read(fullScreenChatLeasesProvider.notifier).acquire() / release()
// in-tree overlay back: OverlayBackHandler(open: open, onClose: close, child: …)
```

## 12. Widgets

`BottomNavBar` ports both styles: classic pill (labels, 394 max, peach active, AI circle with `--a-grad-peach`,
`#e05555` badge with a 2 px `--a-nav-bg` ring at top 5 / 50 % + 5 px) and capsule (icons only, 360 max, 6 px padding,
radius 34, `AGlass.navCapsule` blur 22 / saturate 1.8 unless lite/noBlur, items 52 high ≤ 64 wide with
space-between, active glass bubble with outer + inset shadow, 220 ms `--a-ease` background / 200 ms colour, LayoutGrid
tools icon, coral AI glyph 21 px, avatar / initial / user icon on profile, coral badge at top 7 / 50 % + 4 px).
Badges: unread messages on `home` (women) or `chat` (partner), `9+`; community unread on `community` (women), `99+`;
scale-in with framer's scale spring. Press scale 0.92. Wrap padding 16 / 12 + safe-area bottom. RTL via
`Directionality`. Hidden while a full-screen chat lease is held. `data-tour="tab-<id>"` → `BottomNavBar.tourKey(tab)`.

`ShellFrame`: frame background `--a-bg` for redesigned tabs (non-partner: home in flow/bump/mommy, tools,
community, ai, profile) else `bg-background`; status-bar spacer `--a-bg` / `bg-card`; tab content enter = opacity
0 → 1 (300 ms, `[0.25, 0.1, 0.35, 1]`) + y 10 → 0 (spring 500 / 25; skipped under reduced motion or lite), no exit
animation; frame overlays between content and nav.

## 13. Ambiguities and how they were resolved

1. **Sliding indicator (480 ms bounce):** `.a-nav-ind` exists in the CSS but `BottomNav.tsx` never renders it; the
   active state is the item's own background. Not rendered (parity); tests check the active bubble per tab instead.
2. **Haptics / hide-on-scroll / hide-on-keyboard:** none in React. Not added. The nav is `position: fixed` to the layout
   viewport, so it stays behind the keyboard; natively it is not lifted by `viewInsets`.
3. **Sub-screen slide-in:** Index renders sub-screens without any animation (`.a-subscreen` has none). No transition is
   added; only tabs have the enter animation.
4. **Admin panel:** product decision → web admin URL (`/admin?web=admin` on the admitted public host, else
   `app.anacan.az`; staff login is server-verified there). The consent-gate "not while admin is open" exception and
   the swipe "admin open" condition disappear.
5. **Default nav style:** `docs/BOTTOM_NAV_CAPSULE.md` says capsule is the default, the code uses classic unless the
   setting is `capsule` (also while loading). Code followed.
6. **Swipe back order differs from back-button order** (screen before viewed user although the user profile renders
   on top). Kept as in Index; documented in tests.
7. **`activeTabRef` lag:** within one handler that switches tab and opens/closes a screen, the scroll key uses the tab
   of the last render (e.g. push `shoppingList` for a partner saves `tab:<previous tab>`). Kept.
8. **Root back to Home** uses `setActiveTab` (no scroll save/restore), unlike the nav tap. Kept.
9. **Unknown tab ids** (only possible from untyped callers) map to nothing; Index rendered an empty frame then reset
   to home. `ShellTab.tryParse` returns null and the tab is left unchanged by the deeplink/intent.
10. **Window/DOM specifics:** `[data-blog-module-section]` polling → `blogSection` state + `clearBlogSection()` for the
    Dashboard; `window.location.href = url` for trusted-but-unknown push links → `ShellPlatform.openWebPage`
    (browser by default) with the `type` fallback; `window.location.origin` → `https://app.anacan.az` (the Android
    WebView origin); sessionStorage hand-offs (pending article, blog module, app link) → process memory; ErrorBoundary
    keys → widget keys (`screen:<raw>`, `aptek`, tab id); `?ad_preview` / `?blog_module` page queries are web-only.
11. **Gate order in the brief vs code:** implemented from the code (§9). Splash/intro/country-just-set are `GateHost`
    state; the e-mail gate decision (4 s cap, LS cache) is an input (`EmailGateStatus`) computed by the auth layer.
12. **Swipe while gates are shown:** React enabled it whenever authenticated; natively the detector lives in the
    shell, so it is off while a gate screen shows.
13. **`/blog` and `/nope`:** natively `/blog` (public blog page) is not a route; like any non-app path it goes to the
    404 page (React native would render the public blog). Known app paths open the screen (STABILITY_PHASE2 #25).
14. **Dart vs browser URL parsing:** `JsUrl` reproduces trimming, tab/newline removal, backslashes, opaque-host case and
    dot-segment resolution (`/blog/..` → `/`, as in the browser). Exotic IDNA/IPv6 cases may still differ.

## 14. Remaining for the shell

- App root (`main.dart`): `ProviderScope` overrides (§2, registry), theme from `buildAnacanTheme` + `Directionality`
  from the language, `AToastHost`, `MaterialApp.router`/`WidgetsApp.router` with `buildShellRouter()`.
- Native glue: call `ref.read(notificationTapQueueProvider).deliver(data)` from the FCM / local-notification tap
  listeners at boot (`localTapData` for local extras); route `appUrlOpen` + launch URL through
  `shell.openUrl(url)` (promo `/h/<code>` first to the promo store); `clearQueued()` on logout.
- Wire `ShellPlatform.logScreenView` to analytics; replace `openWebPage` if in-app web pages are wanted.
- Feature registrations (all tabs, screens, tools, gates, overlays, route pages); the Tools hub's own back handler.
- Not verified on a device: hardware back, edge swipe feel, glass blur performance on Android.
