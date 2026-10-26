# Anacan working rules

Read `docs/WORKTREE_HISTORY.md` and `docs/APPLICATION_BASELINE.md` before release,
backend, native or deployment work. Their detailed continuity rules still apply.

- Develop current `src/` in Google project `ninth-park-492111-m4`; follow
  `docs/GOOGLE_POPULATION_CUTOVER_20261007.md` and `docs/GOOGLE_CLOUD_MIGRATION.md`.
  Google population is active/completed; api/app/gcp DNS/TLS is Google. PostgreSQL
  `anacan` is self-hosted on `anacan-gcp-candidate`. Keep reserved LB `34.49.16.103`
  / egress `35.240.81.111`. `npm run dev`/`build` default to Google mode.
  Admission is managed realm `azure`/generation2; retain this native protocol name.
- Public marketing`anacan.az`/`www` is onGoogle with21locale/translatedslug URLs,
  guarded existingblog metadata andsession-freeSSR60s reads. Preserve legacy301,
  appcoral/peach,Ritm/Tumurcuq/Qucaq and8localizeddetail pages; see
  `docs/WEBSITE_GOOGLE_20261006.md`. Keep website out ofnative/consumerinlinei18n.
- BlogreadersnormalizeMarkdown/HTMLwithresponsive localtable/pre scroll. Google
  `anacan-blog-projection`preservesPostgREST auth/RLS/writes andoldnativeHTMLcompat;
  adminrawread uses`X-Anacan-Blog-Format: source-v1`. Preservecurrentgatewayoverlay,
  projectioncontainer/storedsourcehashes;see`docs/BLOG_APP_RENDERING_20261009.md`.
- Preserve Source sealed/generation3, cron0, accepted `52d3634b…`, pending null and
  completed lineage. Authority is `ops/google-population-cutover.json`; old refresh
  pointer is historical. Do not replay capture/apply/freeze/seal/activate or reopen
  Source writers/jobs. Every new/changed Google relation needs CDC/writer guarding.
- Keep `/brands` and `/brands/manage` web-only, with separate managed session/cache,
  legacy Source namespaces and server-side membership. Exclude `src/brand-portal/` from consumer inline
  localization and native bundles.
- Preserve native47/46/45/44/43, Store43 and older finalized workspaces. Signed47
  iOS/Android Store packages are delivered; follow `docs/RELEASE_47_GOOGLE.md`.
  Store47 upload/publication is pending; the next common native version is48. Use isolated candidates
  and production entitlements for new store packages. Keep `com.atlasoon.anacan`,
  team `8B6976J8H7`, widget/App Group, `app.anacan.az` WebView hostname, per-backend
  sessions, logout tombstones and one-way adoption receipts.
- Preserve finalized48.0 iOS development Word Garden device-test package/workspace;
  `docs/WORD_GARDEN_IOS_48.md`. Installed/launch verified; physical gameplay user
  acceptance is pending. Common Store pointer remains47; next common release48.
  Feedback successor48.1: `docs/WORD_GARDEN_IOS_48_1.md`, AZv2/shorttimer/saveadoption;
  installed, auto-launch device-locked pending. Keep48.0/v1library/oldprogress intact.
- Two Friends is40verifiedlevels/21offlineUIlanguages; follow `docs/TWO_FRIENDS.md`.
  Preserve sharedcontrol/mirroredaxes/pre-movepressuregates/sharedkeys/boundedsaves.
  Signeddevelopment48.2installedoniPhone;userwilllaunch/physicalgameplaypending.
  Keep48.2/48.1/48.0isolatedworkspaces;commonStorepointer47/nextcommon48 remains.
- Leaf Flight30levels andClear the Way40verifiedpuzzles/21offlineUIlanguages are
  ininstalleddevelopment48.3;see `docs/FLIGHT_AND_PARKING_48_3.md`. Preserve60Hz
  hold/release/background-safephysics,axis-onlycardrag/keyexit/solver/boundedprogress.
  Keep48.3/48.2/48.1/48.0finalized;commonStore47/nextcommon48;physicalgameplaypending.
- Use explicit Azure build/config for Azure work. Source-generated `types.ts` and
  `previewAuthStorage.ts` stay generated; custom compatibility lives in
  `database-types.ts` and `authStorage.ts`.
- Future Google deploys preserve canonical/signup/active control mount, current
  website gateway overlay, persisted Google credentials and8 enabled timers. New
  native bundles use verified managed admission offline, retain maintenance pins,
  tombstones and refresh-before-use. Never fall back to shadow/Source after cutover.
- Preserve all21 languages and real-store pricing, eligibility, restore/pending
  and one-time offers. Compact onboarding contract: `docs/ONBOARDING_COMPACT.md`.
- Word Garden starts Azerbaijani-only; follow `docs/WORD_GARDEN.md`. Each new
  language needs its own lexicon/copy and language+revision+mode progress. Never
  translate puzzle words or substitute another language's dictionary. Preserve
  deterministic generation, bounded saves and one-time hint/bonus/win rewards.
- Source Auth-hook binding/IP enforcement and RevenueCat v2 metrics permission
  remain operator dependencies; require live proof before claiming activation.
- Keep private inputs, signing material, sessions and ignored migration helpers
  out of logs/chat/Git/archives. Honor `.gitignore` when preparing code handoffs.
  Use existing private inputs/secret references; never replace them with samples.
