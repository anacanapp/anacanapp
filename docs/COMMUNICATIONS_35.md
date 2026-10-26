# Mesajlaşma yeniləməsi — 35.0 / 2026-09-21

## Tətbiq və backend

**Eyni tətbiq kodu Azure və Source/Supabase ilə yoxlanıb.** Veb:
https://api.anacan.az. Native admission **source / generation 0**-dır; 35.0
source-first / `refresh-before-use-v1` müqaviləsini istifadə edir.

- DM, partner və qrup üçün vahid, footersiz çat; yuxarı back və profilə keçid.
- Mətnə/media-ya reply, emoji reaksiyaları, tarix bölmələri, əvvəlki mesajların
  səhifələnməsi, read marker-ləri və hesab/backend üzrə ayrı query cache.
- Şəkil/video və səs yazısı: əvvəlcə preview, sonra Send. AAC/MP4 dəstəklənirsə
  açıq seçilir; oynatma state-i real audio event-lərini izləyir və retry mümkündür.
- Özəl qrup yaratmaq, üzv seçmək/əlavə etmək/çıxarmaq, administrator və owner transfer.
  Yeni üzv yalnız qoşulduğu vaxtdan sonrakı mesajları görür.
- Premium/household Premium serverdən hesablanır; staff badge yanında da göstərilir.
  Rəydə aktiv linki yalnız administrator/moderator yaza bilər; server birbaşa REST
  yazısını da yoxlayır. Anonim müəllifin badge-i göstərilmir.
- Community reply başlığı: **“Ad rəyinizə cavab yazdı”**. Canonical handler və atomik
  claim bir hadisənin inbox-a təkrar yazılmasının qarşısını alır.
- Android WebView permission callback-ləri və geolocation coroutine lifecycle-i
  müdafiəli işlənir; recording Back/background/unmount zamanı buraxılır.

## Canlı revisions

| Servis | Revision | Immutable image |
| --- | --- | --- |
| Gateway | `anacan-gateway--0000023` | `test-gateway@sha256:b6fcb0374a63d87853791ba5de1087267b780cb93f470251b071205a9970a41f` |
| Functions | `anacan-functions--0000006` | `edge-runtime@sha256:cdd5064a666f72876057897b74b3e1427690e1c19b2a4da29cc79213cc10dd42` |
| Storage | `anacan-storage--0000008` | `storage-api-azure@sha256:a0db140128822ab1c0f8c976dd1e997c9563ce866bc90f7286aa73378511d42e` |

Registry `anacanregistry.azurecr.io`; gateway tag
`v25-communications-storage-cors-20260921`, ACR `cb19`. Functions tag
`communications-v5-20260921`, ACR `cb14`; Storage metadata-v2, ACR `cb17`.
Auth `anacan-auth--0000005`, REST `anacan-rest--wxj8me2`.

Event push 21 explicit route içində aktivdir və Firebase Key Vault reference-i
istifadə edir. RC/Google/Apple preview aktivdir; Epoint/legacy purchase/bulk push
bağlıdır. Beş Azure notification job Manual/retry 0; Source-da 5 mövcud cron aktivdir.

Azure Files MIME/cache məlumatını xattr-da saxlaya bilmirdi. Yeni overlay məlumatı
eyni mounted volume-də davamlı saxlayır, SMB mtime dəyişməsinə dözür və hər yazıdan
əvvəl əvvəlki metadata-nı təmizləyir. Bayt yolları və versiyalama dəyişmir.
[Storage overlay və bərpa müqaviləsi](../azure-migration/storage-runtime/README.md).
Storage üçün ayrıca cookie-siz CORS preflight əlavə olunub; bütün real sorğular
yenə Storage JWT/RLS yoxlamasından keçir.

## Source quraşdırılması

- SQL18–21 hər iki backend-də tətbiq edilib. Source yalnız CDC/writer-guard wrapper-i
  `azure-migration/source-compat/source-communications-v2.sql` vasitəsilə dəyişdirilib.
- Source Edge `send-push-notification.source.ts` canonical
  `supabase/functions/_shared/interaction-push.ts` handler-indən hazırlanıb.
- Köhnə `on_comment_reply_notify` hook-u çıxarılıb; ayrıca köhnə DM/bildiriş istehsalı
  dayandırılıb. Hazır runtime `singleReplyProducer=true`, `durablePushClaims=true` qaytarır.
- Source-da əvvəl çatışmayan hesab-silmə projection müqaviləsi operator tərəfindən
  `source-account-projections-communications-20260921.sql` ilə tətbiq edilib.
  `get_anacan_account_projection_contract_v1()` → `deletePublicCardAndGameScores=true`.
  Eyni transaction artıq silinmiş üç dəqiq test hesabının qalıq kartını təmizləyib.
- **258 cədvəl / 254 guarded relation**, catalog SHA-256
  `c526a4124b8ca574cb0bd202df120f30804895c4e70bc7f46a66f0a884ff8792`.
- Accepted `8e22f4f9-23ed-49b6-9069-75c2793e3c83`, pending
  `755ec961-7566-42d7-8e34-fb94eec834e1`; writer open/generation 0.

## Yoxlama sübutları

- **812 tətbiq testi / 80 fayl** keçib. HealthSync test mock-u native API v2-yə
  uyğunlaşdırılıb. Son AAC dəyişikliklərindən sonra 68 əlaqəli test və TypeScript
  yoxlamaları yenidən keçib.
- Communications SQL/CDC **11**, push safety **25**, edge prepare/router **24**,
  Source compatibility **11**, Storage adapter **6**, gateway **10** yoxlama keçib.
  Lokal nginx executable testi mövcud binary olmadığı üçün skipped; real ACR
  `nginx -t`, deploy və endpoint yoxlamaları keçib.
- **Source 10 canlı qrup**: `communications-live-source-1790006062786.json`.
  35.0 Android web bundle-i, real Source Auth/REST/realtime/storage və fake native
  transport/mikrofon istifadə olunub. Mətn/reply/reaction, profil/back/footer,
  real encoded səs preview/send/play, şəkil və video decode keçib.
- **Azure 11 canlı qrup**: `communications-live-azure-1790006746409.json`.
  Həm custom, həm generated domain-də Storage CORS; DM/group RLS və real realtime;
  Premium/moderator müsbət halları; yuxarıdakı browser media axını keçib.
- Hər canlı run-un üç hesabı və beş media faylı silinib. Azure-da 99 cədvəldə qalıq
  0; Source public kartları da silinib. Source-da replay-in qarşısını alan synthetic
  UUID-only idempotency tombstone-ları müqaviləyə uyğun qalır.
- Push sınaqlarında cihaz token-i qeydiyyata alınmayıb, preferences bağlı olub;
  real FCM çatdırılması iddia edilmir. Native permission transport və Android crash
  reproduksiyası fiziki cihaz qəbulu ilə ayrıca təsdiqlənməlidir.
- Son read-only Source runtime: `source-runtime-live-1790005985721.json`;
  communications readiness: `communications-source-1790005988525.json`.
- Son web bytes/health/gates: `web-artifact-1790006582430.json`.

Bütün report-lar `azure-migration/ops/` altındadır. Private fixture checkpoint-ləri
`provider-inputs/communications-fixtures/`-dədir; parol/sessiyalar arxivə daxil edilmir.

## Native workspace və paketlər

Run: **`native-20260921t140943-bd25b1fd`**, version **35.0**.
App ID `com.atlasoon.anacan`, team `8B6976J8H7`, widget/App Group və WebView
`app.anacan.az` saxlanılır. Real AdMob input revision 58, canlı control revision 59.

- [Xcode project](../azure-migration/native-preview/native-20260921t140943-bd25b1fd/workspace/ios/App/App.xcodeproj)
- [Android APK](../azure-migration/native-preview/native-20260921t140943-bd25b1fd/artifacts/anacan-source-first-35.0.apk)
- [Android AAB](../azure-migration/native-preview/native-20260921t140943-bd25b1fd/artifacts/anacan-source-first-35.0.aab)
- [Development IPA](../azure-migration/native-preview/native-20260921t140943-bd25b1fd/artifacts/anacan-source-first-35.0-development.ipa)

Hər platformada **344 code asset və 13 bundled session/admission ssenarisi** var.
Son AAC sync-dən sonra iOS archive/export/codesign və Android release/signature/
16 KB alignment yenidən keçib. Paketlər:

| Artefakt | Byte | SHA-256 |
| --- | ---: | --- |
| APK | 32,020,381 | `83550175a39e423f0ee99f03fc98b9cbd7138ab346fb367c01081218d25e40f1` |
| AAB | 30,739,699 | `4f80703d897c040241ef87eba74f577f1f65570426baa22d66967d09e3d29388` |
| Development IPA | 20,106,931 | `7b27fc7678710f84272654316fe43c9c8bedffec4cdc649bfec7147003567182` |

`web-ios.json`, `web-android.json`, `build-ios.json`, `build-android.json` son entry/
asset hash-lərini saxlayır. iOS cihaz yoxlaması `ios-device-test-1790007254094.json`:
imza, 344 asset, 7 bridge marker-i, real AdMob App ID və 13 real iOS placement
yoxlanıb; **iPhone bağlı olmadığı üçün install/launch icra edilməyib**.
Android də adb-də bağlı deyil; real microphone/location crash qəbulu cihaz gözləyir.
Development IPA store distribution upload-u əvəz etmir; production entitlement üçün
ayrıca `--ios-store` workspace tələb olunur.

Yayımlanmış 30, qorunan 31/32 workspace-ləri və istifadəçinin 34.0 login/banner
qəbulu [əsas baseline](APPLICATION_BASELINE.md) və [34.0 qeydi](IOS_ADMOB_TEST_34.md)-ndədir.
Bu iş final population/Auth cutover və ya store publication deyil; qalan handoff
[final sync qaydasına](AZURE_FINAL_SYNC_AFTER_APPROVAL.md) tabedir.

## Təkrar ops yoxlaması

```sh
node azure-migration/source-compat/verify-runtime.mjs
node azure-migration/ops/verify-communications-source.mjs
node azure-migration/ops/verify-preview-web-artifact.mjs --revenuecat-enabled --event-push-enabled
node azure-migration/scripts/prepare-native-preview.mjs --verify-source native-20260921t140943-bd25b1fd
```

Canlı fixture sınaqları ayrıca `verify-communications.mjs azure --web` və
`verify-communications.mjs source --native-web RUN_ID android` ilə icra olunur.
Yarımçıq run üçün yalnız öz private checkpoint-i ilə `source|azure --cleanup UUID`.
Source-da quraşdırılmış SQL/version hash-lərini redaktə edib replay etməyin;
sonrakı dəyişiklik reviewed additive migration tələb edir.
