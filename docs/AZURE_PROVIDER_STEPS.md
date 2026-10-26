# Anacan — provider açarları və callback-lər üçün icra siyahısı

Son yenilənmə: **2026-09-21**. Azure əsas tətbiq/deploy bazasıdır; yayımlanmış native 30
və cari 31 namizədi admission source/generation 0 olduğu üçün Source-first işləyir.
Provider konsollarında tətbiq/layihə adının Anacan olduğunu
yoxlayın; mövcud açarlar, callback-lər və məhsul identifikatorları saxlanılır.

**Artıq tamamlanan staging:** Google Web JSON-u və RevenueCat API/webhook secret-ləri
Azure Key Vault/ref ilə qoşulub. Auth `--0000005`, Functions `--0000005`, gateway
**v22 / `--0000020`**, REST `anacan-rest--wxj8me2` cari revisions-dır. Google və Apple düymələri
**https://api.anacan.az/** üzərində aktivdir. Apple JS/ID-token yolu `.p8` istifadə
etmir. Hər iki identifier ekranı 21 sentyabrda yenidən keçib; tam browser istifadəçi
girişi/eyni hesab **PENDING**-dir. 51 focused test, hər iki TypeScript layihəsi və
dörd Auth qrupu keçib; iki test hesabı 96 cədvəl üzrə təmizlənib, qalıq 0.
[Cari recheck](../azure-migration/ops/PROVIDER-RECHECK-2026-09-21.md).
[İstifadəçi sınağı](AZURE_GOOGLE_PREVIEW_HANDOFF.md) ·
[Apple veb sınağı](AZURE_APPLE_WEB_HANDOFF.md) ·
[Apple ayrıca native cihaz planı](AZURE_APPLE_NATIVE_TEST_PLAN.md).

**Native 27.0 tarixi Azure/RC test build-idir:** [artefaktlar](AZURE_NATIVE_PREVIEW_BUILD.md).
Cari source-first namizəd [31.0](IOS_RELEASE_31.md)-dır. Yeni birbaşa Azure cihaz sınağı
ayrıca workspace-də hazırlanır; 30/31 admission-u bu provider yoxlaması dəyişmir.
İstifadəçi təsdiqi ilə mövcud Android signer SHA-ları Firebase app-a əlavə edilib,
əvvəlki fingerprint-lər saxlanılıb. Bu, cihazda login və ya mağaza acceptance-i deyil.

## 0. Faylların yeri və ünvanların statusu

Finder → Go → Go to Folder (`⌘⇧G`):

```text
/Users/jamilturkan/Desktop/anacannew/azure-migration/provider-inputs/
```

Mətn faylları plain UTF-8 olsun; TextEdit istifadə edilirsə Format → Make Plain
Text seçin. Açar dəyərlərini söhbətə, screenshot-a və Git-ə qoymayın. Bu qovluq
Git-dən kənardadır; açarların serverdə istifadəsi Key Vault/ref wiring mərhələsində
ediləcək. Mövcud `setup-notes.txt` faylının uyğun bölməsində boş sahələri doldurun.

### Canonical callback-lər və planlanan production səhifələri

Cari Google preview **site URL**-i `https://api.anacan.az`-dır; GoTrue
`API_EXTERNAL_URL` də eynidir. Aşağıdakı `anacan.az` payment/recovery səhifələri
son production planıdır; bu veb deploy production mənbəsini həmin sayta keçirmir.

| İstifadə | Ünvan | Provider-də hansı sahə? |
| --- | --- | --- |
| Google giriş | `https://api.anacan.az/auth/v1/callback` | OAuth Web client → Authorized redirect URIs |
| Apple JS veb giriş | `https://api.anacan.az/auth/apple/callback` | Services ID → Sign in with Apple → Return URLs; əlavə edilib/yoxlanıb |
| Apple legacy/server OAuth | `https://api.anacan.az/auth/v1/callback` | Mövcud Return URL saxlanılır; code-exchange credential-i ayrıca |
| RevenueCat → Anacan | `https://api.anacan.az/functions/v1/revenuecat-webhook` | Integrations → Webhooks → URL, POST |
| Epoint → Anacan | `https://api.anacan.az/functions/v1/epoint-payment?action=callback` | Merchant Result/Callback URL, POST |
| Epoint uğurlu geri dönüş | `https://anacan.az/payment/success` | Success URL |
| Epoint uğursuz geri dönüş | `https://anacan.az/payment/error` | Error URL |
| Şifrə bərpasının tətbiq səhifəsi | `https://anacan.az/reset-password` | Auth recovery redirect; SMTP webhook deyil |

**Domen/TLS statusu, 2026-09-11:** `api.anacan.az` artıq gateway-ə managed certificate
ilə bağlanıb (`SniEnabled`). CA/hostname yoxlamalı TLS 1.3, health/Auth/REST sorğuları
və təmiz Chrome-da HTTP/2 açılışı keçib. Cloudflare CNAME **DNS only** qalmalıdır.
Bu, Google/Apple login və RevenueCat/Epoint əməliyyatlarının acceptance-i deyil;
provider açarları və ayrıca qəbul sınaqları hələ tələb olunur.

Google/Apple-də yeni ünvanı əlavə allowlist sətri kimi saxlamaq olar. Mövcud
Supabase/Firebase/Lovable callback siyahısını bununla əvəz etməyin. Mənbənin adi
Supabase callback forması `https://tntbjulojatnrqmylorp.supabase.co/auth/v1/callback`-dir;
konsolda olan digər mövcud ünvanlar da saxlanmalıdır.

### Mövcud Azure preview ünvanları

```text
Veb/API bazası:
https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io

RevenueCat handler ünvanı:
https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io/functions/v1/revenuecat-webhook

Epoint handler ünvanı:
https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io/functions/v1/epoint-payment?action=callback
```

RC preview route-ları artıq aktivdir; TEST, explicit sandbox və tanınan UUID-lərlə
atomik TRANSFER qəbul edilir. İstifadəçi 21 sentyabrda aktiv preview-ni saxlamağı seçib.
Son 16 sentyabr operator inventarı Source və Azure webhook-larını **Production + Sandbox**
kimi göstərirdi; runtime-da sandbox qəbulu təkbaşına sandbox-only delivery demək deyil.
Real store lifecycle və final production tək-writer ownership ayrıca qalır.
Epoint/legacy payment/crons bağlıdır. [RC aktiv preview](AZURE_REVENUECAT_PREVIEW.md).

Google-un canonical provider callback-i `https://api.anacan.az/auth/v1/callback`-dir.
Gateway FQDN OAuth-u başlada bilər, amma provider callback kimi onun hostname-i
qeyd olunmur. Cari site URL və əlavə redirect allowlist `api.anacan.az` preview-yə
qayıdışı dəstəkləyir; mövcud source/native URL-lər saxlanılıb.

## 1. RevenueCat — mövcud credential/mapping və qalan acceptance

API/webhook secret-ləri artıq var; onları yenidən generasiya etməyin. SDK offerings
monthly/yearly/base-plan mapping-i təsdiqləyib, user Transfer-to-new-ID siyasətini
təsdiqləyib. Source webhook sahibliyi saxlanır; `ENABLE_REVENUECAT=true` Azure preview
üçündür. Qalan iş real store purchase/lifecycle, credential statusu və final production
reconciliation-dur. Console Sandbox TEST 200 istifadəçi tərəfindən təsdiqlənib.

Panel: https://app.revenuecat.com/

1. Mövcud **Anacan project**-ini seçin.
2. **API keys → Secret API keys → + New secret API key** açın.
3. Ad olaraq `anacan-azure-server` yazın.
4. Hazırkı handler `GET /v1/subscribers/{app_user_id}` çağırır. Versiya seçimi
   göstərilirsə **API v1** üçün uyğun server açarı seçin. Yalnız v2 seçimi varsa
   bunu `setup-notes.txt`-də qeyd edin; adapter uyğunluğu yoxlanmadan v2 açarını
   v1 endpoint-inə uyğun hesab etməyin.
5. Açarı `revenuecat-secret-api-key.txt` faylında tək sətir kimi saxlayın.
   SDK/public `appl_...` və `goog_...` açarları bu server açarının yerinə istifadə olunmur.
6. Project ID, iOS/Android App ID-ləri, entitlement identifier, product/package
   identifier-ləri və hazırkı restore/transfer siyasətini `setup-notes.txt`-ə yazın.
   Kodun gözlədiyi entitlement **`Anacan LLC Pro`**-dur; fərqlidirsə konsoldakı
   identifier-i dəyişmək əvəzinə faktiki dəyəri qeyd edin.
7. Mövcud store bağlantılarının/credentials yoxlamasının statusunu qeyd edin.
   İşləyən App Store Server Notifications və Google Play RTDN bağlantıları
   RevenueCat-a gələn axın olaraq saxlanmalıdır.

### Operator inventarı üçün sahələr

Məhsul/package/base-plan və Transfer-to-new-ID siyasəti artıq təsdiqlənib. Aşağıdakı
yerlər mövcud qeydlərin yoxlanması üçündür; yeni açar/mapping yaratmaq tələb olunmur.

- **Actual product/package identifiers:** Product catalog → Products-də store
  məhsul identifikatorlarını götürün. Android üçün subscription ID və base plan ID-ni
  də qeyd edin. Product catalog → Offerings → mövcud Default/Current offering →
  Packages-də package identifier və ona bağlı iOS/Android məhsulunu qeyd edin.
  `$rc_monthly` / `$rc_annual` yalnız standart nümunələrdir; faktiki panel dəyərləri
  əsasdır. Məhsul, entitlement, package adını və Default Offering-i dəyişməyin.
- **Current restore/transfer policy:** Project settings → General → Restore behavior
  dropdown-unda hazırda seçilmiş variantı olduğu kimi yazın. Bu parametr project-dəki
  bütün app-lərə təsir edir. Sandbox üçün ayrıca override varsa onu ayrıca qeyd edin.
- **Existing production webhook preserved:** Integrations → Webhooks-də əvvəlki
  konfiqurasiyanın URL/Authorization/statusu saxlanıbsa `yes`; dəyişdirilibsə `no`;
  əvvəlcədən webhook yoxdursa `not_configured`. Authorization dəyərini qeydə/çata
  çıxarmayın və yeni aktiv webhook yaratmaqla bu sahəni doldurmağa çalışmayın.
- **Store credentials status:** Apps → uyğun Anacan App Store app-i və Google Play
  app-i → credentials bölməsi. Mövcud valid/error statusunu platforma üzrə yazın;
  Check credentials düyməsi varsa status yoxlamasından istifadə edin. Sadəcə uploaded
  olması valid kimi qeyd olunmur. İşlək credential-i yenidən yaratmaq lazım deyil.

### Azure üçün ayrıca webhook secret

Bu dəyər bizim endpoint-in giriş secret-idir. Mac Terminal-da aşağıdakı əmr
64 simvolluq təsadüfi secret-i fayla yazır, dəyəri terminala çıxarmır və mövcud
faylın üstünə yazmır:

```sh
(umask 077 && set -C && openssl rand -hex 32 > "/Users/jamilturkan/Desktop/anacannew/azure-migration/provider-inputs/revenuecat-webhook-secret.txt")
```

Fayl artıq varsa onu yenidən yaratmayın. Key Vault üçün xam dəyər saxlanılır;
`Bearer ` prefiksi yalnız RevenueCat header sahəsində istifadə edilir.

### İlkin webhook konfiqurasiyası — tarixi təlimat

Mövcud konfiqurasiyanı yenidən yaratmayın. Son məlum Production + Sandbox/iki-endpoint
inventarı [RC sənədində](AZURE_REVENUECAT_PREVIEW.md) qeyd edilib; final owner/filter
keçidi həmin qəbul planına uyğun koordinasiya edilir.

**Integrations → Webhooks → Add new configuration**:

| Sahə | Dəyər |
| --- | --- |
| Name | `Anacan Azure` |
| URL | Yuxarıdakı sınaqdan keçmiş preview və ya production RevenueCat handler ünvanı |
| Authorization header | `Bearer ` + `revenuecat-webhook-secret.txt` faylındakı dəyər |
| App filter | Yalnız Anacan-ın uyğun iOS/Android app-ləri |
| Environment / event filter | Backend-in təsdiqlənmiş qəbul/test planına uyğun; hazırda production/both aktivləşdirilmir |

Bu sahələri hazırlayın, **qəbuledici hazır olmadan yeni aktiv konfiqurasiyanı
saxlamayın**. Mövcud production webhook-un URL/Authorization dəyərini dəyişməyin.
Yeni URL RevenueCat → Anacan üçündür; Apple/Google mağazalarının RevenueCat-a
bildiriş göndərdiyi sahələrə yazılmır. `sync-revenuecat-entitlement` tətbiqin
daxili API-sidir və webhook URL-i deyil.

Cari kod Authorization header yoxlayır. RevenueCat-in ayrıca HMAC/signing secret-i
bu header secret-ini əvəz etmir; raw-body HMAC təsdiqi hazırkı handler-də qurulmayıb.

## 2. Google — mövcud Web client-ə əlavə callback və ayrıca secret

Panel: https://console.cloud.google.com/auth/clients

1. Mövcud Anacan girişinin istifadə etdiyi Google/Firebase layihəsini seçin.
   Yeni boş layihə yaradıb cari client-ləri əvəz etməyin.
2. **Google Auth Platform → Clients** bölməsində Anacan-a aid **Web application**
   client-ini açın.
3. **Authorized redirect URIs → Add URI** ilə əlavə edin:

   ```text
   https://api.anacan.az/auth/v1/callback
   ```

4. Client-side Google web sign-in üçün origin tələb olunursa, uyğun **Authorized
   JavaScript origins** sahələri aşağıdakı origin-lərdir; callback path-i bu
   sahəyə yazılmır:

   ```text
   https://anacan.az
   https://app.anacan.az
   ```

   **Branding → Authorized domains** tələb olunarsa eTLD domeni `anacan.az`-dır.
   Mövcud branding, scopes və audience/publishing statusu saxlanmalıdır.
5. Client ID-ni qeyd edin. Mövcud secret-in təhlükəsiz surəti varsa götürün.
   Görünmürsə **Add Secret** ilə əlavə secret yaradıla bilər: Google iki secret-i
   paralel işlək saxlayır. Köhnə secret üçün Disable/Delete etməyin. Artıq iki
   secret varsa onları silmədən bu vəziyyəti qeydə alın.
6. Yeni secret yaradılan anda JSON-u yükləyin: **`google-oauth-client.json`**.
   JSON yükləmə seçimi yoxdursa Client ID-ni `google-web-client-id.txt`, yeni
   secret-i `google-web-client-secret.txt` faylında saxlayın. Secret sonradan tam
   görünməyə bilər; yalnız son dörd simvol tam secret deyil.
7. Eyni layihədə Anacan **Android** və **iOS** client ID-lərini də qeydə alın:
   Android package və iOS Bundle ID **`com.atlasoon.anacan`**-dır.
8. Android üçün **Play Console → Anacan → App integrity/App signing → App signing
   key certificate** SHA-1/SHA-256 məlumatlarını qeyd edin. Bu, Upload key və debug
   sertifikatından fərqlənə bilər. Mövcud işlək fingerprint-ləri əvəz etməyin.

Google OAuth Web client JSON-u ilə Vertex/Firebase service-account JSON-u ayrı
credential növləridir. Native login üçün də ID token audience/client ID uyğunluğu
serverdə yoxlanmalıdır; sadəcə callback əlavə etmək native qəbul sübutu deyil.

### Mövcud Web client-də artıq iki Enabled secret varsa

Hər ikisi etibarlıdır; yaradılma tarixi hansı secret-in işləyən backend-də istifadə
olunduğunu göstərmir. İstifadəni müəyyən etmək üçün faktiki server credential-i
ilə uyğunluğu yoxlamaq lazımdır. Google iki-secret limitini **hər OAuth client**
üçün tətbiq edir.

Köhnə secret-lərə toxunmadan paralel yol:

1. Eyni Google layihəsində **Google Auth Platform → Clients → Create client**.
2. Application type: **Web application**; Name: **Anacan Azure Web**.
3. Authorized redirect URI: `https://api.anacan.az/auth/v1/callback`.
4. Web JavaScript origins tələb olunursa `https://anacan.az`, `https://app.anacan.az`
   və operator preview üçün `https://api.anacan.az` əlavə edin.
5. Create etdikdən sonra yeni Client ID/secret JSON-unu dərhal
   `google-oauth-client.json` adı ilə qorunan provider-inputs qovluğunda saxlayın.
6. `setup-notes.txt`-də **yeni Azure Web client ID** ilə **mövcud Anacan Web/native
   client ID-lərini** ayrı qeyd edin. Mövcud client/secret-lər enabled qalır.

Bu JSON server OAuth konfiqurasiyasıdır; Android `google-services.json` və iOS
`GoogleService-Info.plist` fayllarının yerinə qoyulmur. Azure Auth web flow-da yeni
Client ID/secret cütü, native ID-token axınında isə Anacan-ın faktiki istifadə etdiyi
audience ID-ləri ilə konfiqurasiya olunub yoxlanmalıdır. Bütün client-ləri kor-koranə
audience allowlist-ə əlavə etmək lazım deyil. Eyni Google hesabının mövcud Anacan
UUID-sinə bağlanması real qəbul sınağında təsdiqlənəcək.

Mövcud Google layihəsinin Branding, Audience/publishing statusu, scopes, Android/iOS
client-ləri və app signing fingerprint-ləri bu əməliyyat üçün dəyişdirilmir.

Google sənədinə görə URI dəyişikliklərinin yayılması bir neçə dəqiqədən bir neçə
saata qədər çəkə bilər. Azure OAuth-un real testi DNS/TLS və server konfiqurasiyası
uyğunlaşdırıldıqdan sonra keçirilir.
Cari Azure vebdə Google düyməsi `VITE_AZURE_GOOGLE_OAUTH_ENABLED=true` ilə
operator preview üçün aktivdir. Canonical callback/client-auth və Google identifier
ekranı keçib; istifadəçi öz əvvəlki Google hesabı ilə successful callback və eyni
Anacan UUID/profili [handoff-a uyğun](AZURE_GOOGLE_PREVIEW_HANDOFF.md) yoxlamalıdır.
Bu flag full OAuth/production acceptance-i tamamlanmış göstərmir.

## 3. Apple Sign in — mövcud tətbiq kimliyi ilə

**Veb üçün `.p8`-siz yol artıq deploy edilib:** Apple JS popup → ID-token/nonce →
Azure Auth. Services ID `com.atlasoon.anacan.signin`, Primary App ID
`8B6976J8H7.com.atlasoon.anacan`. Yeni JS Return URL əvvəlcə “Invalid web redirect url”
ilə rədd edildi; eyni Services ID-də əlavə edilib saxlandıqdan sonra Apple qəbul etdi.
Giriş/eyni hesab testi: [AZURE_APPLE_WEB_HANDOFF.md](AZURE_APPLE_WEB_HANDOFF.md).

Hazırkı **native iOS** login Apple identity token → Supabase `signInWithIdToken`
yoludur; bu yol developer `.p8` faylını istifadə etmir. Aşağıdakı Services ID və
private-key hazırlığı **server/Android OAuth code exchange** və server token əməliyyatları
üçündür. Native iOS qəbul sınağı və no-logout session migration ayrıca yoxlanır.
İki Sign in key limitini boşaltmaq native iOS login hazırlığının şərti deyil.
Mövcud iki key saxlanılaraq staging workspace və ayrılmış fiziki iPhone üzərində
[Azure-only native sınağı](AZURE_APPLE_NATIVE_TEST_PLAN.md) planlanıb. Cari vebdə
Apple veb flag-i `true`-dur; native cihaz planı və hazır production native çıxışları ayrıdır.

Panel: https://developer.apple.com/account/

### 3.1. Identifikatorlar

1. **Membership details**-dən **Team ID**-ni götürün.
2. **Certificates, Identifiers & Profiles → Identifiers → App IDs** altında
   `com.atlasoon.anacan` tətbiqini və Sign in with Apple əlaqəsini tapın.
3. **Identifiers → Services IDs** altında həmin Anacan primary App ID ilə bağlı
   mövcud web Services ID-ni tapıb identifier-i qeydə alın. Tapılmırsa bunu qeyd
   edin; təsadüfi ID ilə əvəz etmək hesab uyğunluğu testi sayılmır.
4. Services ID → **Sign in with Apple → Configure**:

   ```text
   Domains and Subdomains:
   api.anacan.az
   anacan.az

    Return URLs:
    https://api.anacan.az/auth/v1/callback
    https://api.anacan.az/auth/apple/callback
   ```

   Bunları əlavə sətirlər kimi daxil edin. Mövcud URL-lər, primary App ID və
   qruplaşdırma saxlanılır. Domain sahəsində `https://` və path olmur; Return URL
   isə tam HTTPS ünvanıdır.

### 3.2. Sign in with Apple açarı

Key ID verilib, amma məqsədi bilinmirsə Keys → həmin key → enabled services
siyahısını yoxlayın. **Sign in with Apple** icazəsi olmalıdır. Yalnız **APNs**
icazəsi olması Sign in with Apple üçün uyğunluq sübutu deyil. Bir key bir neçə
xidmətə icazəli ola bilər; məqsəd yalnız `.p8` uzantısından müəyyən edilmir.

1. **Certificates, Identifiers & Profiles → Keys** bölməsinə keçin.
2. Mövcud Anacan Sign in with Apple `.p8` faylı saxlanılıbsa, həmin faylı götürün
   və **Key ID**-ni qeyd edin.
3. Fayl yoxdursa və uyğun primary App ID-də əlavə açar yeri varsa:
   **+ → ad `Anacan Azure Sign In` → Sign in with Apple → Configure → mövcud
   Anacan primary App ID → Register → Download**.
4. Faylı orijinal adı ilə saxlayın: **`AuthKey_<KEY_ID>.p8`**.
   `.p8` adətən yalnız bir dəfə endirilir. Primary App ID üçün iki açar limiti
   doludursa işləyən açarı revoke etmədən vəziyyəti qeyd edin.
5. **`apple-signin-details.txt`** daxilində bunları yazın:

   ```text
   Team ID:
   Key ID:
   Primary App ID:
   Services ID:
   Bundle ID: com.atlasoon.anacan
   P8 filename:
   ```

Bu `.p8` **Sign in with Apple** üçündür. App Store Connect API və APNs üçün olan
`.p8` faylları bu iş üçün avtomatik uyğun deyil. GoTrue-nun Apple secret dəyəri
`.p8`-dən generasiya olunan müddətli client-secret JWT olacaq; `.p8` mətnini birbaşa
`GOTRUE_EXTERNAL_APPLE_SECRET` yerinə yapışdırmaq lazım deyil.

Apple-in ayrıca **Server-to-Server Notification Endpoint** sahəsinə login
callback-i yazılmır. Yuxarıdakı ünvan Services ID-nin **Return URLs** sahəsi üçündür.
Cari Azure vebdə Apple düyməsi `VITE_AZURE_APPLE_OAUTH_ENABLED=true` ilə JS popup
üçün aktivdir. Yuxarıdakı `.p8`/client-secret addımları ayrıca OAuth/server əməliyyatları
üçündür; yeni JS və native iOS ID-token yolunu bloklamır.

### Services ID və p8 tapılmırsa

- Identifiers səhifəsinin filtrində **Services IDs** seçin; App IDs siyahısı ayrı
  görünüşdür. Mövcud Anacan web Services ID-si varsa ondan istifadə edin.
- Uyğun Services ID həqiqətən yoxdursa, **Account Holder/Admin** rolu ilə
  **Identifiers → + → Services IDs** vasitəsilə əlavə web qeyd yaradıla bilər:
  description `Anacan Web`, identifier üçün boşdursa `com.atlasoon.anacan.web`.
  Sonra həmin Services ID-də Sign in with Apple → Configure → mövcud Anacan primary
  App ID seçilir və yuxarıdakı domain/return URL əlavə edilir. Mövcud App ID-nin
  primary/grouping təsnifatı bu addımda dəyişdirilmir. Anacan primary App ID siyahıda
  görünmürsə mövcud qruplaşdırma əvvəlcə aydınlaşdırılmalıdır.
- Configure → Done → Continue → Save ardıcıllığını tamamlayıb yenidən açaraq URL-nin
  saxlandığını təsdiqləyin; bundan sonra `New return URL added: yes` yazılır.
- P8 filename endirilmiş faylın adıdır. Finder/Downloads-də
  `AuthKey_<Key ID>.p8` adı ilə axtarın və faylı provider-inputs-a köçürün. Key ID
  təkbaşına itmiş private key-i bərpa etmir. Fayl yoxdursa əlavə key qaydasına baxın;
  yeni key yaranarsa Key ID və filename yeni cütə uyğun olmalıdır.
- `Existing URLs/grouping/keys preserved: yes` yalnız əvvəlki qeydlər saxlanıbsa
  yazılır; yoxlanmamış vəziyyət `unknown` kimi qeyd edilə bilər.

### İki Sign in açarı doludur və private fayllar tapılmırsa

- Key adı, yaranma/dəyişiklik tarixi və native iOS girişinin işləməsi əsasında
  hansı açarın istifadəsiz olduğu müəyyən edilmir. Cari iOS kodu native Apple
  identity token-i Supabase-ə ötürür; bu yol developer `.p8` key ID-sini göstərmir.
- APNs açarı ayrıca xidmətə aiddir; onu silmək Sign in üçün yer açmır. Eyni primary
  App ID altında yeni Services ID yaratmaq da iki-key limitini artırmır.
- Mənbənin işlək Supabase/Lovable **Apple OAuth provider** konfiqurasiyasındakı
  **client_secret / Secret Key (for OAuth)** JWT-sinin header `kid` sahəsi həmin
  konfiqurasiyanın işarə etdiyi developer key ID-sidir. Apple `identity_token`-ın
  `kid` sahəsi Apple-ın öz açarıdır və bunun əvəzi kimi istifadə edilmir.
- Cari client secret əldə edilə bilirsə, onu yalnız yerli
  `azure-migration/provider-inputs/apple-current-client-secret.jwt` faylında saxlayın.
  Onlayn JWT decoder və söhbət vasitəsilə paylaşılmır. Metadata oxuma əmri:

  ```sh
  node azure-migration/scripts/inspect-apple-key-usage.mjs --client-secret
  ```

  Bu əmr yalnız key ID, Team ID, client ID və expiry metadata-sı çıxarır; signature
  validation və ya digər key-in istifadəsiz olmasının sübutu deyil. Expired JWT
  həmin private key-in başqa yerdə istifadə olunmadığını göstərmir.
- Firebase Auth Apple üçün read-only metadata yoxlaması:

  ```sh
  node azure-migration/scripts/inspect-apple-key-usage.mjs --firebase
  ```

  2026-09-11 yoxlaması `enabled=true` qaytardı, amma client ID, Team ID və Key ID
  metadata-sı gəlmədi. Repo və Git tarixində `.p8` faylı tapılmadı. Bunlar hər hansı
  key-i revoke etməyə əsas vermir; source OAuth konfiqurasiyası hələ yoxlanmalıdır.
- İstifadəçi Lovable Cloud panelində Apple sahəsinin boş göründüyünü bildirdi.
  Boş UI sahəsi saxlanmış credential-in olmadığına təkbaşına sübut deyil.
  `inspect-apple-key-usage.mjs --source-apple` ilə mənbənin ilkin OAuth cavabı
  yoxlanıldı: HTTP 302, Apple yönləndirməsi, `client_id=com.atlasoon.anacan`.
  Yönləndirmə izlənilmədi və istifadəçi girişi tamamlanmadı. Bu cavab key ID-ni,
  secret-in etibarlılığını və ya tam Apple login-in işləməsini sübut etmir.
  Lovable Cloud idarəetməsində metadata görünmürsə, səlahiyyətli platforma operatoru/
  Support-dan mövcud Apple client_secret-in yalnız `kid`, `iss`, `sub`, `exp`
  metadata-sı və konfiqurasiyanın istifadə etdiyi key ID-ləri istənilməlidir.
  Full secret/private key çıxarışı və avtomatik kod/config dəyişikliyi tələb olunmur.
- Bir backend-də key ID müəyyən edildikdən sonra digər source/backend/CI/Firebase
  consumer-lər də nəzərə alınmalıdır. İstifadəsiz key təsdiqlənərsə yer açılıb yeni
  key endirilə bilər. Hər iki key istifadə olunursa əvvəlcə mövcud private key backup-ı
  tapılmalı və ya consumer-lər üzrə koordinasiyalı rotasiya hazırlanmalıdır.

## 4. Epoint — merchant məlumatları, son URL-ləri aktivləşdirmədən

Giriş: https://epoint.az/az/login

Sənədlər: https://developer.epoint.az/

1. Mövcud Anacan merchant hesabını seçin, API/inteqrasiya məlumatları bölməsini açın.
   Şəxsi kabinetdə dəqiq menyu adı hesab görünüşündən asılı ola bilər.
2. Public key/merchant identifikatorunu təsdiqləyin; çatışmayan **private key**-ni
   təhlükəsiz götürün. Köhnə işlək açarı reset etmədən əlavə giriş imkanı tələb edin.
3. `epoint-merchant.txt`-də public key, private key, faktiki mode və merchant
   identifikatorunu saxlayın. Hazır snapshot-da mode `live`-dır.
4. Provider-dən callback imzası/payload, status, full refund və test proseduru üzrə
   cari sənədi/linki götürüb `setup-notes.txt`-ə əlavə edin.
5. Bu üç sahəni son qoşulma üçün hazırlayın:

   ```text
   Result / Callback URL:
   https://api.anacan.az/functions/v1/epoint-payment?action=callback

   Success URL:
   https://anacan.az/payment/success

   Error URL:
   https://anacan.az/payment/error
   ```

Canlı merchant callback-i acceptance/cutover-dan əvvəl dəyişdirilmir. Hazır Azure
handler `test` rejimini dəstəklənən sandbox kimi qəbul etmir. Uğurlu return səhifəsi
ödəniş qəbzi deyil; order-bound DB təsdiqi və native geri dönüş ayrıca tamamlanacaq.

## 5. Firebase / APNs — mövcud bağlantını təsdiqləyin

Panel: https://console.firebase.google.com/

1. Mövcud **`anacan-mobile`** layihəsini seçin.
2. **Project settings → Cloud Messaging → Apple app configuration** altında
   `com.atlasoon.anacan` üçün APNs key/certificate statusunu, Team ID və Key ID
   məlumatını qeyd edin. İşlək konfiqurasiyanı başqa açarla əvəz etməyin.
3. Android/iOS app qeydlərinin həmin tətbiqə aid olduğunu təsdiqləyin.
4. `FIREBASE-SERVICE-ACCOUNT-JSON` Key Vault-da artıq var; bu mərhələdə yeni Firebase
   service-account key generasiya etmək lazım deyil.

Birbaşa panel: https://console.firebase.google.com/project/anacan-mobile/settings/cloudmessaging

APNs authentication key sahəsində **production** və **development/sandbox** ayrı
göstərilirsə hər ikisini ayrıca qeyd edin. Status nümunələri: `production key
uploaded — delivery test pending`, `certificate uploaded — expires YYYY-MM-DD`,
və ya `not_configured`. APNs Team ID və Key ID həmin uploaded key məlumatlarından
götürülür; Sign in with Apple bölməsindəki ID-lər avtomatik buraya köçürülmür.
Firebase panelindəki Team ID eyni Apple team-ə aiddirsə Sign in team-i ilə eyni
ola bilər. Bu konfiqurasiya qeydi real cihazda push delivery acceptance deyil.

Firebase konsoluna bizim push function URL-imizi daxil etmək lazım deyil. Azure
server FCM-ə çıxan sorğu göndərəcək; bizim daxili event endpoint-imiz
`/functions/v1/send-push-notification`-dır, provider webhook-u deyil.

## 6. SMTP — e-mail göndərilməsi

SMTP artıq Auth `anacan-auth--0000005` üzərində Key Vault references ilə qoşulub.
16 sentyabrda operator recovery e-mailini alıb reset səhifəsini açdığını təsdiqləyib;
21 sentyabr runtime yoxlaması mövcud konfiqurasiyanı təsdiqləyir. Qəbul sübutu:
`azure-migration/ops/smtp-acceptance-20260916.json`.

Aşağıdakı sahələr mövcud qorunan `smtp.txt` qeydinin inventarıdır; açarı təkrar
yaratmaq tələb olunmur. Provayderin **SMTP / Integration / Credentials** bölməsi:

```text
Provider:
SMTP host:
SMTP port:
TLS mode:
SMTP username:
SMTP password / SMTP API key:
Verified sender email:
Sender name: Anacan
```

Mövcud **`smtp.txt`** faylı qorunur. SPF/DKIM üçün provayderin göstərdiyi DNS
qeydlərini də götürün; dəyərlər provayderə xasdır və uydurulmur. Apple Private Relay
ünvanlarına məktub üçün göndərən domen/ünvanın uyğun qeydiyyatı da yoxlanmalıdır.

Cari Auth site URL-i `https://api.anacan.az`-dır; reset səhifəsi açılışının operator
qəbulu mövcuddur. Gələcək `anacan.az/reset-password` final veb planıdır. Tam şifrə
yeniləmə lifecycle-i, confirmation siyasəti və Apple Private Relay delivery ayrıca
qəbul edilir; `/auth/v1/verify` və redirect allowlist uyğunluğu saxlanmalıdır.
Bu ünvanları SMTP provayderinin webhook sahəsinə yazmayın.

## 7. DNS, mənbə idarəetməsi və store qeydləri

- `anacan.az` DNS-inin idarə edildiyi paneli və mövcud `api` qeydini qeyd edin.
  Hazır Azure CNAME hədəfi aşağıdakı hostdur; **DNS only** və `asuid.api` TXT
  saxlanmalıdır. Ownership/TLS binding artıq yoxlanılıb:

  ```text
  anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io
  ```

- Mənbə Supabase/Lovable üçün səlahiyyətli SQL/management yolunu müəyyənləşdirin.
  Session/refresh-token export-u və writer freeze ayrıca idarə olunacaq; auth
  məlumatlarını söhbətə/Git-ə export etməyin. Əvvəlki `ON CONFLICT DO NOTHING`
  importer-i son sinxronizasiya kimi işlətməyin.
- Play Console/App Store Connect-də mövcud tətbiqin nömrələrini və App Store
  Apple ID-sini qeyd edin. Android store ünvanı:
  `https://play.google.com/store/apps/details?id=com.atlasoon.anacan`.
  iOS linki App Store Connect-dəki faktiki Apple ID ilə təsdiqlənəcək.
- **Force Update** indi açılmır: minimum build müqayisəsi, source legacy oxunuşu,
  real native upgrade və hər iki mağazanın əlçatanlığı əvvəlcə yoxlanmalıdır.

## Təhvil veriləcək fayllar

- [x] `revenuecat-secret-api-key.txt` — Key Vault/ref, RC preview aktiv
- [x] `revenuecat-webhook-secret.txt` — ayrıca Azure Sandbox webhook TEST 200
- [x] `google-oauth-client.json` — Azure Web server konfiqurasiyası staged
- [x] Apple Services ID/Primary App ID — istifadəçi təsdiqləyib, Azure audience staged
- [ ] `AuthKey_<KEY_ID>.p8` — ayrıca server OAuth/revocation işi; JS/native login üçün lazım deyil
- [ ] `apple-signin-details.txt` — əlavə server OAuth metadata-sı lazım olduqda
- [ ] `epoint-merchant.txt`
- [x] `smtp.txt` — Key Vault/ref və operator recovery-mail receipt/reset-page qəbulu
- [x] `setup-notes.txt` — mövcuddur; qalan APNs/store/ownership statusları ayrıca dəqiqləşdirilir

Qalan fayllar üçün yalnız hansıların hazır olduğunu bildirmək kifayətdir. Google/RC
Key Vault import-u, dar managed identity icazələri və env wiring artıq tamamlanıb;
eyni açarları yenidən yaratmaq/stage etmək tələb olunmur. RC mapping/TRANSFER hazırlığı
tamamlanıb; real istifadəçi/store lifecycle və final webhook ownership qəbulu ayrıca qalır. Mövcud
Supabase, native identity və production webhook sahibliyi son keçidə qədər qorunur.

### Mənbələr

- RevenueCat keys: https://www.revenuecat.com/docs/projects/authentication
- RevenueCat webhooks: https://www.revenuecat.com/docs/integrations/webhooks
- Google client/secret əlavə etmə: https://support.google.com/cloud/answer/15549257?hl=en
- Apple web return URL: https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/
- Apple Sign in keys: https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key/
