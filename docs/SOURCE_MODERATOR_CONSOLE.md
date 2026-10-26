# Source Moderator console installation

## Accepted Source release43 update — 2026-09-30

The reviewed wrapper is installed with hash
`440792c32b1f723436279c45e8993f7253698477d59fad28528b37b132fe6bdc`.
The29 reviewed Source functions are deployed; moderation is enforced by the
fixed Source origin without requiring a new environment flag. PostgREST
`moderator_pre_request_v1` is configured and real owned restriction/appeal,
warning ACK, role, private edit and function-denial tests pass. Current Source UI,
worker and native evidence: [RELEASE_43_SOURCE.md](RELEASE_43_SOURCE.md).

Auth before-user-created hook **binding is still unverified**: the authenticated
Lovable Cloud tools cannot inspect/configure this setting. The function/grants
exist, but Source IP mode remains **off** until a supported operator/support
configuration and trusted-IP canary. The installation steps below describe the
original handoff; do not replay accepted historical wrappers against the newer catalog.

## Original handoff reference

This was the prepared compatibility handoff for the same Azure-primary application.
The release43 update above supersedes its installation status. Admission remains
Source / generation0.

## Order

1. Complete the already reviewed localization/admin/regional/followup36/followup37
   prerequisites documented in `SUPABASE_FOLLOWUP_37.md`.
2. Install and accept SQL32, the Source-backed advertising worker and Source UI
   from `SOURCE_COMMUNITY_AD_MODERATION.md`.
3. **Regenerate** the Moderator wrapper against Source's resulting current catalog:
   `node azure-migration/source-compat/prepare-moderator-console.mjs`.
4. Review/run the generated `RUN_SOURCE_MODERATOR_CONSOLE_INSTALL.sql` as the
   approved Source SQL operator. Do not run raw33 SQL files directly.
5. Deploy the reviewed bundled source functions in
   `azure-migration/source-compat/moderator-functions/`, using
   `azure-migration/ops/moderator-source-functions.json` as the filename/hash map.
   These supersede earlier copies of the same functions in prerequisite handoffs.
   `epoint-payment` and `partner-create-redemption` are conditional existing-Source
   updates: do not enable previously closed routes, bulk sends or cron schedules.
6. After SQL availability is verified, set the Source function environment
   `MODERATOR_ENFORCEMENT_REQUIRED=true` and verify full-account rejection before
   provider calls. Account deletion and RevenueCat reconciliation remain available.
7. Configure PostgREST's `public.moderator_pre_request_v1` and the Auth
   `public.moderator_before_user_created_v1` hook. Any existing hook must be reviewed
   and chained, not replaced blindly. The SQL functions support reviewed prior
   PostgreSQL hook names in `moderator_runtime_settings`.
8. Verify Source-hosted client-IP authenticity for email/OAuth/OTP signup before
   changing Source `ip_mode` from `off` to `observe`, then `enforce`. Direct Source
   clients cannot attest custom Azure headers. Do not treat user metadata or a
   client-supplied XFF/Sb-Forwarded-For as proof.
9. Publish the same current application UI against Source and accept the role,
   warning ACK, restrictions, audit, appeals, post recheck and media tests.

## Catalog and data guarantees

The wrapper adds8 private relations and20 nullable moderation columns on posts,
comments and stories. It enrolls changed/new relations in CDC and writer guarding
before commit, records table resets, rejects unreviewed shape changes, and preserves
accepted/pending run lineage and writer generation. It adds no Source cron.

The prepared wrapper was generated against catalog
`7b7ce25316afb9ed0b899710bf7b9ea93cec77ccc751c432c176a1ca5e15050d`.
This is **not** the post-prerequisite catalog. Reusing it after prior DDL correctly
fails its guard; regenerate at the indicated step. The current Source sync pair is
accepted `8e22f4f9-23ed-49b6-9069-75c2793e3c83`, pending
`755ec961-7566-42d7-8e34-fb94eec834e1`.

Source acceptance is separate from the25 SQL/CDC tests and deployed Azure UI checks.
Native42 remains source-first; its new moderation behavior requires this handoff.
Customer.io Data In uses its independent, privately configured EU mobile source;
it requires no additional Source messaging modules or Customer.io server key.
