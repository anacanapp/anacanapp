# Apple JS — Azure veb istifadəçi sınağı

Status: **operator preview aktiv, tam istifadəçi girişi PENDING** — recheck 2026-09-21.
Sınaq ünvanı: **https://api.anacan.az/**.

## Cari axın və public identifikatorlar

- Services ID: `com.atlasoon.anacan.signin`.
- İstifadəçi tərəfindən təsdiqlənmiş Primary App ID: `8B6976J8H7.com.atlasoon.anacan`.
- Saxlanılan native audience/Bundle ID: `com.atlasoon.anacan`.
- Apple JS Return URL: `https://api.anacan.az/auth/apple/callback`.
- Mövcud Google/legacy OAuth URL-si: `https://api.anacan.az/auth/v1/callback`.
- Gateway **v22 / `anacan-gateway--0000020`**, Auth `anacan-auth--0000005`.

```text
Apple düyməsi → rəsmi Apple JS popup (response_mode=web_message)
→ Apple identity token + state
→ Azure signInWithIdToken + raw nonce
→ GoTrue signature/issuer/audience/expiry/nonce yoxlaması
→ Anacan sessiyası və profil
```

Bu yol developer `.p8` / OAuth client-secret istifadə etmir. Mövcud iki Sign in
key və APNs key saxlanılıb. Raw nonce və state hər cəhddə yenidir, yaddaşda saxlanır;
Apple-a nonce-un SHA-256-sı göndərilir. Native iOS və source OAuth marşrutları ayrıdır.

Return URL səhifəsi yalnız statik fallback-dır: GET 200, no-store, POST 405. Popup
nəticəsini Apple JS əsas pəncərəyə çatdırır. Həmin səhifəni ayrıca açmaq login sübutu deyil.

## İstifadəçinin edəcəyi sınaq

1. Öz brauzerinizdə **https://api.anacan.az/** açın. Azure-da başqa hesabla artıq
   daxil olmusunuzsa ayrıca private pəncərə istifadə edin. Production native tətbiqdən
   çıxmağa ehtiyac yoxdur.
2. Apple düyməsinin hazırlanmasını gözləyin, **“Apple ilə davam et”** seçin.
   Popup bloklanırsa yalnız bu sayt üçün popup-a icazə verib düyməyə yenidən toxunun.
3. Əvvəldən Anacan-da istifadə etdiyiniz **eyni Apple hesabı** ilə giriş/consent-i
   Apple-ın öz pəncərəsində tamamlayın.
4. Popup bağlandıqdan sonra əsas Anacan pəncərəsində əvvəlki eyni profilin və
   tanıdığınız məlumatların açıldığını yoxlayın. Səhifəni yeniləyəndə eyni hesab qalmalıdır.
    Son qəbul edilmiş data/Auth/storage pre-sync sərhədi **2026-09-16 07:21:12 UTC**-dir;
    sonrakı Source dəyişiklikləri pending delta/replan-a tabedir.
5. Başqa/yeni boş profil görünərsə bunu bildirin; istifadəçinin mövcud hesabını
   silməyin və problemi həll etmək üçün təkrar qeydiyyat etməyin.

Yalnız **vaxt, brauzer/cihaz, popup-dan geri dönüş, eyni profil və reload nəticəsi**
bildirilir. Parol, OTP, token, nonce, cookie, HAR və tam authorization URL-si paylaşılmır.

## Qəbul qeydi

| Şərt | Status |
| --- | --- |
| Canlı UI → Apple popup/identifier ekranı | PASS, 2026-09-21, credential daxil edilmədən |
| Doğru Services ID, Return URL, web_message, state/hashed nonce | PASS, ilkin popup sorğusunda |
| İstifadəçinin Apple consent-i → Azure sessiyası | **PENDING** |
| Əvvəlki eyni Anacan UUID və Apple identity subject | **PENDING — operator read-only müqayisəsi** |
| Real Apple sessiyası ilə reload / Safari cihaz sınağı | **PENDING** |

Operator eyni e-mail/adı UUID sübutu saymamalıdır; əvvəlki `auth.users.id` və Apple
identity subject ilə uyğunluğu yoxlamalıdır. İstifadəçi hesabı fixture kimi təmizlənmir.

Google UI də aktivdir. `VITE_AUTH_CUTOVER=false`; Epoint/legacy payment və population
cron gates bağlıdır; istifadəçinin qərarı ilə RC runtime/sandbox preview aktivdir.
Final RC production ownership [ayrıca izlənir](AZURE_REVENUECAT_PREVIEW.md).
Native iOS cihaz sınağı, Android/server OAuth code exchange və
Apple grant revocation ayrıca acceptance olaraq qalır.

Cari sübut: `azure-migration/ops/PROVIDER-RECHECK-2026-09-21.md`,
`apple-browser-start-1789973022157.json`; əvvəlki hazırlıq: `APPLE-WEB-2026-09-12.md`.
Rəsmi dəstək: https://supabase.com/docs/guides/auth/social-login/auth-apple#using-sign-in-with-apple-js
