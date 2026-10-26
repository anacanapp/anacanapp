# RevenueCat Azure preview — aktiv; recheck 2026-09-21

**Azure backend preview aktivdir; istifadəçi 21 sentyabrda bunu saxlamağı seçib.**
Native 27.0 tarixi Azure test build-idir; yayımlanmış 30 və cari 31 namizədi hələ
source-first admission-dadır. Epoint, legacy purchase validator və population cron-lar
bağlıdır; production writer/webhook sahibliyinin final keçidi hələ tamamlanmayıb.

21 sentyabr runtime yoxlaması: `ENABLE_REVENUECAT=true`, `REVENUECAT_ALLOW_SANDBOX=true`,
iki Key Vault reference və sync/webhook route-ları mövcuddur. Credential-siz boş
sorğular **401** qaytarır. [Cari recheck](../azure-migration/ops/PROVIDER-RECHECK-2026-09-21.md).

## Cari konfiqurasiya

- Functions: `anacan-functions--0000005`, 20 route (18 baseline + RC sync/webhook).
- Entitlement: **`Anacan LLC Pro`**; app `pricing_2026` offering-i seçir, current
  offering `anacan` saxlanılıb. `default` də mövcuddur.
- İstifadəçi mövcud restore siyasətini **Transfer to new App User ID** kimi təsdiqləyib;
  panel siyasəti dəyişdirilməyib.
- iOS app `appaedb35b823`, Android app `appcbfb47e107` allowlist-dədir.

| Package | Store product | Android base plan | Backend plan |
| --- | --- | --- | --- |
| `$rc_monthly` | `com.atlasoon.anacan.premium.monthly` | `monthly-plan` | `premium` |
| `$rc_annual` | `com.atlasoon.anacan.premium.yearly` | `yearly-plan` | `premium_plus` |

Bu mapping hər iki public SDK offerings API-sindən alınıb. Server həm plain product
ID-ni, həm Android `product:base-plan` formasını tanıyır. Katalogda olmayan məhsula
özbaşına Premium verilmir; ayrıca mapping tələb olunur. V2 metadata API verilən v1
açarla 403 qaytardı; store credentials valid statusu ayrıca cihaz/konsol acceptance-dir.

## Webhook

**Son operator inventarı — 2026-09-16:** həm `Anacan` (Source), həm `Anacan Azure`
webhook-u **Production + Sandbox** üçün aktiv göstərilib. Bu console inventarı
21 sentyabr runtime/401 yoxlamasında yenidən alınmayıb. Buna görə aşağıdakı ilkin
Sandbox təlimatı hazırkı delivery filter-in sübutu deyil. Final tək-writer ownership,
filter və production-only entitlement reconciliation ayrıca tamamlanmalıdır.
Mənbə: `azure-migration/ops/FINAL-HANDOFF-PROGRESS-2026-09-16.md`.

İlkin 12 sentyabr preview quraşdırma təlimatı:

```text
URL: https://api.anacan.az/functions/v1/revenuecat-webhook
Yeni konfiqurasiya: Anacan Azure Preview
Environment: Sandbox
Authorization: Bearer + yerli revenuecat-webhook-secret.txt dəyəri
```

İstifadəçi Authorization sahəsini düzəltdikdən sonra RevenueCat konsolunun test
hadisəsinin **200** qaytardığını təsdiqləyib. Secret burada saxlanmır. Mövcud production
webhook URL/secret/filter-i final cutover-a qədər saxlanmalıdır.

## Davranış və sərhədlər

- Store/SDK/webhook payload-ındakı `isPro` və məbləğə etibar edilmir: server RevenueCat
  REST-dən cari entitlement-i oxuyur, yalnız təsdiqlənmiş məhsulu plan-a çevirir.
- SQL08 hər iki TRANSFER tərəfinin tanınan UUID-lərini bir transaction-da yeniləyir.
  Naməlum/custom və ya Azure-a hələ gəlməmiş istifadəçi səbəbindən yarım transfer
  edilmir. Anonim RC ID-lər təxminlə Anacan hesabına çevrilmir.
- Yeni provider snapshot-ını köhnə/fərqli snapshot geri çevirə bilmir. Event ID başqa
  istifadəçiyə bağlana bilmir; cancellation dedup və referral once-only qalır.
- Preview sandbox grant-ləri qəbul edilir və `_migration_audit.revenuecat_sync_state`
  daxilində `SANDBOX` kimi izlənir. **Sandbox və TRANSFER referral mükafatı yaratmır.**
- Native SDK yalnız login edilmiş UUID ilə açılır; logout yeni anonymous customer
  yaratmır. Alış/restore/paywall hesab uyğunluğu yoxlanır.
- Native UI Premium-u yalnız server sync təsdiqləyəndən sonra uğurlu göstərir.
  Store əməliyyatı alınıb server gecikirsə “təsdiq gözlənilir” göstərilir; avtomatik
  ikinci alış edilmir.

## İndi necə sınamaq olar?

Birbaşa Azure store sınağı üçün cari koddan **ayrıca isolated native test workspace**
hazırlanmalıdır. [27.0 artefaktları](AZURE_NATIVE_PREVIEW_BUILD.md) tarixi qəbul
sübutudur; [31.0 namizədi](IOS_RELEASE_31.md) source-first-dir. Build-in faktiki
backend/RC flag-ləri və test cihazı seçimi təsdiqlənəndən sonra aşağıdakı matrisi keçirin.

1. iOS development IPA/TestFlight-da App Store Connect Sandbox tester ilə sınaq
   alışından istifadə edin. Google Play üçün AAB-ni internal testing track və
   license tester hesabı ilə sınamaq tövsiyə olunur.
2. Anacan-da əvvəlki eyni test hesabınıza daxil olun; aylıq/illik qiymətlərin store-dan
   yükləndiyini yoxlayın.
3. Sandbox purchase → backend Premium/plan təsdiqi → app restart/restore sınağı edin.
   Test transferi yalnız test hesabları ilə edin, real ödənişli hesablar arasında yox.
4. Renewal/cancel/expiry/refund və iki test hesabı arasında restore/TRANSFER zamanı
   köhnə/yeni hesab entitlement-lərinin düzgün dəyişdiyini yoxlayın.
5. “Təsdiq gözlənilir” çıxarsa yenidən ödəniş etməyin; bir qədər sonra restore/sync
   nəticəsini yoxlayın və vaxt/xəta kodunu bildirin. Receipt/token paylaşılmır.

**Agent real alış/refund etməyib.** Offline DB/provider testləri və canlı boş fixture
sync/TRANSFER/sandbox-event/TEST delivery keçib; real StoreKit/Play əməliyyat acceptance-i
hələ istifadəçi sınağıdır.

## Production keçidindən əvvəl

Sandbox grant-ləri production hüququ kimi promosiya edilməməlidir. Son source delta
və provider reconciliation zamanı bu audit qeydləri nəzərə alınmalı, production-only
provider truth yoxlanmalı və uyğun anda `REVENUECAT_ALLOW_SANDBOX=false` edilməlidir.
Sonra production webhook sahibi bir dəfə Azure-a keçirilir; source callback-lər drain
edilir. Tək bu ayarı söndürmək əvvəlki test grant-lərini avtomatik təmizləmir.

Təxirə salınmış final sync planı: [AZURE_FINAL_SYNC_AFTER_APPROVAL.md](AZURE_FINAL_SYNC_AFTER_APPROVAL.md).
Texniki sübut: `azure-migration/ops/REVENUECAT-ACTIVATION-2026-09-12.md`.
