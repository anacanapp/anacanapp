# Google Azure veb sınağı — istifadəçi təhvili

Son canlı yoxlama: **2026-09-21**. Sınaq ünvanı: **https://api.anacan.az/**.

## Hazır olan hissə

Google düyməsi aktivdir; Apple veb JS preview də aktivdir. Təmiz Chrome-da Google
düyməsi Azure Auth-a, oradan HTTP 302 ilə Google-a gedir; HTTP 200 cavabı və
redaktə edilə bilən Google identifier ekranı təsdiqlənib. Heç bir Google parolu,
istifadəçi kodu və ya token daxil edilməyib. **Tam OAuth giriş hələ təsdiqlənməyib.**

Cari versiya: gateway **v22 / `anacan-gateway--0000020`**, Auth `anacan-auth--0000005`,
REST API `anacan-rest--wxj8me2`, Functions `anacan-functions--0000005`.
Server callback: `https://api.anacan.az/auth/v1/callback`.
Cari preview `GOTRUE_SITE_URL`: `https://api.anacan.az`.

iOS native Google nonce xətası provider-specific compatibility ayarı ilə həll edilib;
istifadəçi əvvəlki profilə girişin uğurlu olduğunu təsdiqləyib. Aşağıdakı browser və
independent UUID/source-session acceptance qeydləri bundan ayrıdır.

## İstifadəçinin edəcəyi sınaq

1. Öz brauzerinizdə **https://api.anacan.az/** açın. Lazım gələrsə dil/qarşılama
   addımlarından giriş ekranına keçin. Quraşdırılmış production tətbiqindən çıxış
   etməyə ehtiyac yoxdur; ayrıca brauzer/private pəncərə istifadə oluna bilər.
2. **“Google ilə davam et”** seçin. Anacan-da əvvəldən istifadə etdiyiniz **eyni
   Google hesabını** seçin. Parol və təsdiq addımlarını yalnız Google-un öz səhifəsində
   tamamlayın.
3. Consent-dən sonra brauzerin Azure callback-dən keçib yenidən
   **`https://api.anacan.az/`** ünvanına qayıtmasını yoxlayın. Tək Google identifier
   ekranının açılması bu addımın keçməsi deyil.
4. Əvvəlki hesabın profili/adı və tanıdığınız məlumatların açıldığını yoxlayın.
   Səhifəni yeniləyəndə eyni hesab açıq qalmalıdır. Son qəbul edilmiş Azure
   data/Auth/storage pre-sync sərhədi **2026-09-16 07:21:12 UTC**-dir; sonrakı Source
   dəyişiklikləri burada olmaya bilər. Pending delta schema replan gözləyir.
5. Yeni/boş profil, təkrar onboarding və ya başqa hesab görünərsə nəticəni belə
   qeyd edin; problemi həll etmək üçün yeni hesab yaratmayın və hesab silməyin.

**Bildirmək kifayətdir:** sınağın vaxtı, brauzer/cihaz, “Azure-a geri döndü / dönmədi”,
“əvvəlki eyni profil açıldı / açılmadı”, reload nəticəsi və varsa ekrandakı xəta adı.
Parol, OTP, access/refresh token, cookie, HAR və tam callback URL-ni paylaşmayın;
URL query/fragment hissəsi code/state/token daşıya bilər.

## Operatorun tamamlayacağı hesab uyğunluğu

- İstifadəçinin bildirdiyi vaxtdakı Azure Google girişini əvvəlcədən mövcud olan
  Anacan UUID/Google identity ilə yalnız read-only metadata əsasında müqayisə edin.
  Eyni e-mail/ad təkbaşına UUID uyğunluğu sübutu deyil.
- Mövcud `auth.users.id` və Google identity subject saxlanmalı, yeni dublikat UUID
  yaranmamalıdır. Yalnız uyğunluq nəticəsi/say və sanitizasiya edilmiş vaxt qeyd edilsin;
  sessiya/identity token-i götürülməsin.
- Successful callback, eyni UUID və reload təsdiqlənənədək aşağıdakı qəbul qeydi
  **PENDING** qalır. Bu nəticə native Google və ya source sessiyalarının no-logout
  cutover sınağını əvəz etmir.

| Qəbul şərti | Status |
| --- | --- |
| Azure UI → Google identifier ekranı | PASS — 2026-09-21, credential daxil edilməyib |
| İstifadəçinin Google consent + successful callback-i | **PENDING — istifadəçi** |
| Mövcud profil və eyni Anacan UUID/Google identity | **PENDING — istifadəçi + operator** |
| Real Google sessiyası ilə reload | **PENDING — istifadəçi** |

## Cari sərhədlər və sübut

Build: `VITE_AZURE_PARTNER_PAIRING=true`, `VITE_AUTH_CUTOVER=false`,
`VITE_AZURE_GOOGLE_OAUTH_ENABLED=true`, `VITE_AZURE_APPLE_OAUTH_ENABLED=true`.
İstifadəçi 21 sentyabrda Apple və RevenueCat preview-ni aktiv saxlamağı təsdiqləyib.
RC runtime sandbox qəbul edir; Epoint/legacy payment/push bağlı, beş Azure job Manual/retry 0-dır.
Son operator inventarı Source/Azure RC webhook-larında Production + Sandbox göstərirdi;
final tək-writer ownership ayrıca həll edilməlidir. [RC statusu](AZURE_REVENUECAT_PREVIEW.md).
Yayımlanmış 30 və cari 31 native namizədi hələ **source / generation 0** admission-dadır.
Apple cihaz sınağı: [AZURE_APPLE_NATIVE_TEST_PLAN.md](AZURE_APPLE_NATIVE_TEST_PLAN.md).
Apple veb sınağı: [AZURE_APPLE_WEB_HANDOFF.md](AZURE_APPLE_WEB_HANDOFF.md).

Yerli cari sübut: `azure-migration/ops/PROVIDER-RECHECK-2026-09-21.md`,
`google-browser-start-1789972676388.json`, `api-auth-1789973002829.json`.
51 focused test, hər iki TypeScript layihəsi və dörd canlı Auth qrupu keçib;
iki test hesabı 96 cədvəl üzrə təmizlənib, qalıq 0.
Production cutover qərarı `azure-migration/CUTOVER.md`-də **NO-GO** olaraq qalır.
