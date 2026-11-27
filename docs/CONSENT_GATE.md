# Consent gate (legal documents v2.0)

The Terms of Use / Privacy Policy / Medical disclaimer v2.0 (`legal_documents`, version `2.0`) promise:
Terms accepted through an unticked checkbox, health data processed only with a separate explicit
consent (withdrawable in Privacy settings), minimum age 16, marketing as a separate optional consent,
and consent time + document version recorded. This is how the app keeps those promises.

## What is recorded

Migration `supabase/migrations/20261107150000_user_consents.sql` (+ `.cdc.json`; the new relation is
CDC/writer-guarded and owned by `pgadmin`).

`public.user_consents` is an append-only log (no UPDATE; DELETE only via the `auth.users` cascade on
account deletion). One row per decision:

| column | meaning |
| --- | --- |
| `kind` | `terms`, `health_data`, `age_16`, `marketing` (everyone); `ai_assistant` (first Anacan.AI use); `child_data`, `marketing_email`, `marketing_push`, `marketing_sms` (Türkiye, KVKK / 6563 İYS) |
| `granted` | true / false (a withdrawal is a new `false` row) |
| `document_version` | the `consent_gate.version` in force (e.g. `2.0`) |
| `text_variant` | `kvkk_tr` when the owner's KVKK Açık Rıza wording was shown, else null |
| `source`, `app_version` | `ios` / `android` / `web`, native or web build version |
| `created_at` | consent time (server clock) |

The latest row per kind is the current state. RLS: a user selects/inserts only their own rows.

RPCs (both `SECURITY DEFINER`, `auth.uid()` required, granted to `authenticated`):

- `record_consents_v1(p_items jsonb, p_source text, p_app_version text)`: 1–12 items
  `{kind, granted, version, variant?}`. The whole batch is rejected unless every kind is known and every
  `version` equals the current `consent_gate.version` (`CONSENT_VERSION_MISMATCH`). `terms` and `age_16`
  can only be granted (withdrawing the Terms = deleting the account). Returns `my_consents_v1()`.
- `my_consents_v1()`: `{gate: {enabled, version}, consents: {kind: {granted, document_version, text_variant, source, created_at}}}`.

## App behaviour

- **Gate** (`src/components/consent/ConsentGateScreen.tsx`, decision in `src/lib/consentGate.ts`,
  hook `src/hooks/useConsentGate.ts`): mounted in `src/pages/Index.tsx` after sign-in, the block check
  and e-mail verification, before the country gate, onboarding and the dashboard, so it is shown to new
  and existing users. It is not shown to logged-out users, in `/admin` routes or in the in-app admin panel.
  It appears when the latest `terms` row for the current version is missing. Required: Terms + Privacy
  Policy, health data, 16+; optional: marketing. Nothing is pre-ticked. "Çıxış et" signs out.
- **Türkiye** (profile `country_code` `TR` or app language `tr`): a "KVKK Aydınlatma Metni'ni okuyun"
  link to `https://anacan.az/kvkk`, the owner's Turkish KVKK texts verbatim for health data (required),
  child data (optional) and commercial messages with E-posta / push / SMS sub-choices (`marketing` = any
  channel). Texts live in `KVKK_TEXTS` (`src/lib/consent-copy.ts`) and are never translated.
- **Anacan.AI** (`src/components/consent/AiConsentGate.tsx`): the chat (mother and partner AI tabs)
  opens only after a granted `ai_assistant` consent; declining returns to Home and the rest of the app
  keeps working.
- **Never a lock-out**: offline, timeout (6 s), missing RPC or a malformed setting skip the gate. An
  acceptance that cannot be sent is cached per backend + user + version and retried on the next launch;
  the user is not asked again on that device.
- **Privacy → Razılıqlar** (Profil → Gizlilik → Razılıqlar; tr: Gizlilik → Rızalar): toggles for health
  data, Anacan.AI and marketing (Türkiye: child data and the three channels), plus the date/version of
  the Terms acceptance. Withdrawing health data asks for confirmation and records a `false` row.
  **Data deletion and stopping sync are not implemented yet**: only the withdrawal is recorded and shown.

## Switching it off

```sql
UPDATE public.app_settings SET value = jsonb_set(value, '{enabled}', 'false') WHERE key = 'consent_gate';
```

With `enabled: false` the gate and the Anacan.AI sheet are skipped (Privacy toggles still record).

## Bumping the document version

1. Publish the new `legal_documents` rows (new `version`).
2. `UPDATE public.app_settings SET value = jsonb_set(value, '{version}', '"2.1"') WHERE key = 'consent_gate';`
   (format `^\d{1,4}(\.\d{1,4}){0,3}$`; anything else disables the gate rather than locking users out).
3. Every user whose latest `terms` row has an older version sees the gate again on the next launch.
   Pending offline acceptances for the old version are dropped by the server (`CONSENT_VERSION_MISMATCH`).
   Earlier rows stay as the history.

## Strings

Keys `consent_*` / `ai_consent_*` (`CONSENT_COPY` in `src/lib/consent-copy.ts`) are in `src/locales/{az,en}.json`
and `scripts/i18n/<lang>.seed.json` for all 23 languages; `scripts/i18n/translation-manifest.json` was
updated (sha256/bytes/count/keysHash) so `verify-bundles.mjs` passes.

## Version 1.0 (owner documents)

The owner's Privacy Policy and Terms of Use (both version `1.0`, effective 2026-03-05) replaced the v2.0
texts. `20261107160000_privacy_terms_owner_v1.sql` sets `consent_gate.version` to `1.0`, and the app fallback
(`FALLBACK_CONSENT_VERSION`) is `1.0`. Bump the setting again whenever a new document version needs re-acceptance.
