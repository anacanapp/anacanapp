# Support feature (`registerSupportFeature`)

| React | Dart |
|---|---|
| HelpScreen.tsx, hooks/useSupportTickets.ts, useSupportTicketReplies.ts, useDynamicTools (useFaqs, useSupportCategories) | help_screen.dart, data/support_tickets.dart |
| FeedbackSheet.tsx, lib/app-feedback.ts, lib/prompt-day.ts | feedback_sheet.dart (`showFeedbackSheet`), data/app_feedback.dart |
| AppRatingPrompt.tsx, hooks/useAppRating.ts | app_rating.dart (in_app_review; `anacan_rating_done`, `anacan_app_usage_count`) |
| Index.tsx day-14 feedback effect | register.dart `AutoFeedbackHost` frame overlay |

Registered: screen `help`; frame overlays `support-rating-prompt`, `support-auto-feedback`.
Wiring: `externalLinkOpenerProvider` (mailto/tel), `storeReviewProvider`, `appInfoSourceProvider`, `ticketInserterProvider`.

## Not started
- BillingScreen.tsx (+ CancellationReasonDialog, useSubscriptionCancellation) — no `BillingActions` interface yet.
- `useAdSafetyBlock(shouldShowPrompt)` of AppRatingPrompt (ads feature) not wired.
