# App bundle security (what ships inside the APK / IPA)

A signed APK/IPA is a ZIP: anyone can `unzip` it or open it in jadx-gui, apktool, Hopper, etc. and
read every bundled **asset** (HTML/JS/JSON/images). Obfuscation (R8/ProGuard) only scrambles the
compiled Kotlin/Java **code**, never the assets, and no tool can make a published app impossible to
open. So the real protections are, in order:

1. **Ship nothing secret in the bundle.** Verified by `scripts/verify-bundle.mjs`, which runs on every
   `npm run build` and fails the build if `dist/` contains internal docs (`*.md`, the pitch deck),
   dev/preview artifacts (`*preview-build*`, e.g. the old `azure-preview-build.json`), source maps, env
   files, keystores/keys, or secret material (service_role JWT, private keys, Stripe/Slack/AWS/Google
   keys). The Supabase **anon/publishable** JWT in `backend.json` is public by design — it is the key
   clients are meant to hold; data is protected by Postgres RLS, not by hiding this key.
2. **Second layer on Android:** `android/app/build.gradle` `ignoreAssetsPattern` drops `*.md`,
   `*pitch-deck*`, `*preview-build*` and `*.map` from the packaged APK even if one reaches `dist/`.
3. **Code obfuscation:** R8 is on for release (`minifyEnabled true`) and runs in **full mode**
   (`android.enableR8.fullMode=true`), so decompiled code is hard to read. Crash traces stay readable
   because Google Play deobfuscates with the mapping file inside the AAB.
4. **Server-side authority:** admission/CDC/RLS and the edge functions enforce access on the server;
   the client cannot be trusted and is not the security boundary.

## If a file like `azure-preview-build.json` ever appears in an APK again
It came from `public/` (Vite copies `public/` → `dist/`, Capacitor copies `dist/` → the native app).
Move it out of `public/` (into `docs/` or delete it) and rebuild — the guard will confirm it is gone.
Never put investor decks, internal notes, preview/dev configs, `.env`, keys or keystores under `public/`.
