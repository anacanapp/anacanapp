# Anacan Customer.io Data In bridge

Local Capacitor 8 adapter around the official Customer.io **DataPipelines** iOS
and **datapipelines** Android SDKs. Native dependencies are pinned in
`Package.swift` and `android/build.gradle`; only these Data In products are linked.

The application owns consent, identity, account changes, and navigation through
`src/lib/customerio.ts` and `src/components/CustomerIoSession.tsx`.
Initialization takes only environment/region across the JS bridge. Each native
implementation obtains the CDP source write key from its shipped Capacitor plugin
configuration, avoiding credential-bearing debug bridge arguments.

Full configuration, actual events, verification, and boundaries:
[`docs/CUSTOMERIO_DATA_IN.md`](../../docs/CUSTOMERIO_DATA_IN.md).
