# Profile feature (`registerProfileFeature`)

| React | Dart |
|---|---|
| components/ProfileScreen.tsx (tabs + classic layouts, child dialog, partner info sheet, logout dialog) | profile_screen.dart |
| components/profile/ProfileTabs.tsx | widgets/profile_tabs.dart |
| components/LanguageSelector.tsx | widgets/language_selector.dart |
| components/PartnerProfileScreen.tsx, hooks/usePartnerConfig.ts (fallbacks) | partner_profile_screen.dart |
| components/ProfileEditScreen.tsx | profile_edit_screen.dart |
| components/ReferralScreen.tsx, hooks/useReferral.ts | referral_screen.dart, data/referral.dart |
| hooks/useChildren.ts (subset used here: list/add/update/delete, seeding, offline cache) | data/children.dart |

Registered: tab `profile` (woman + partner variant), screens `edit-profile`, `referral`, `moderator` (opens the web
moderator console and returns). Admin row → `shell.openAdminWeb()`.

## Interfaces awaiting wiring (profile_interfaces.dart)
- `premiumPromptProvider` (`PremiumPrompt.show`) → premium feature `showPremiumModal`.
- `subscriptionIsPremiumProvider` → purchases `useSubscription().isPremium`.
- `profileLayoutSettingProvider` → `useAppSetting('profile_layout')`.
- `profileSlotsProvider`: BannerSlot, QaygiCashProfileCard, ProfilePregnancyCard, PartnerLinkForm, PromoCodeDialog.
- `recapProfileRowProvider`, `qaygiCashRowProvider` (rows contributed by recap / qaygicash).
- `partnerProfileDataProvider` (usePartnerData/Stats/Missions/Surprises/config rows).
- `accountActionsProvider` (defaults to AuthController), `shareServiceProvider` (share_plus), `partnerPairingEnabledProvider`,
  `appOriginProvider`, `avatarPickerProvider` (image_picker), `profileEditRepositoryProvider`, `moderatorWebOpenerProvider`.
- `childrenRepositoryProvider`/`childrenQuery` duplicate a part of useChildren with the same query key
  (`['user-children', uid]`); another agent is writing features/baby/hooks/use_children.dart — re-export it here once stable.

## Not ported / deviations
- Moderation history screen (`moderation-history`, MyModerationDecisions + useModerator) — not ported.
- Avatar crop uploads PNG (dart:ui cannot encode JPEG 0.88) to `community-media/avatars/<uid>-<ms>.png`.
- `window.confirm` (delete child) → small Radix-style confirm dialog; shadcn Select → popup list; DateField → Material date picker.
- Country flags: assets/images/profile/flags/<ISO>.png generated from countries.json (settings/copy/gen_feature_copy.mjs).

## Visual uncertainties
Partner-info sheet slide uses a tween (framer default spring on y); profile-tab pill spring 420/34 approximated with SpringSimulation.
Golden PNGs under test/features/profile/goldens are self-generated (emoji render as boxes in tests).
