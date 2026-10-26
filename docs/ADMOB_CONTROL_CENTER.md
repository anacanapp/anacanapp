# AdMob reklam idarəetmə mərkəzi

## Açılış ünvanları

- **İdarəetmə:** https://api.anacan.az/admin/ads — mövcud administrator hesabı.
- **Əsas ekranda demo:** https://api.anacan.az/?ad_preview=1&ad_screen=home
- **Alətlərdə demo:** https://api.anacan.az/?ad_preview=1&ad_screen=tools
- **Cəmiyyətdə demo:** https://api.anacan.az/?ad_preview=1&ad_screen=community
- **Bloqda demo:** https://api.anacan.az/?ad_preview=1&ad_screen=blog
- **Reseptlərdə demo:** https://api.anacan.az/?ad_preview=1&ad_screen=recipes
- **Adlar kataloqunda demo:** https://api.anacan.az/?ad_preview=1&ad_screen=names
- **Mükafat/fasilə demosu:** https://api.anacan.az/?ad_preview=1&ad_screen=ad_preferences
- **Publisher faylı:** https://api.anacan.az/app-ads.txt

Admin paneldə **Satış & E-Ticarət → AdMob · Reklam idarəetməsi** bölməsi də var.
Demo parametri serverdə admin icazəsi yoxlanandan sonra işləyir. Normal istifadəçi
URL parametrini əlavə etməklə admin önizləməsi və ya redaktə icazəsi almır.

## Source reklam davamlılığı — 2026-09-22

Yeni client müqaviləsi **39.0 / `source-mirror-v1`**: Source-da durable reklam
nüsxəsi, Azure paneldə sync ready/pending/retry, Source adminində ayrıca sticky
emergency stop. Azure save uğurlu olsa da Source təsdiqlənmədən bütün cihazlara
çatdığı göstərilmir. [Runtime, SQL, yoxlamalar və paket təhvili](ADMOB_CONTINUITY_39.md).

Canlı Source nüsxəsi **V61 / live / 13 placement** üzrə Azure ilə eynidir;
`admob-continuity-live-1790086561748.json` 259/255, open/0 və 5 cron-u təsdiqləyir.
Əvvəlki 38.0 və köhnə paketlər bu transport dəyişikliyini yeni native build ilə alır.

## Cari cihaz qəbulu — 2026-09-21

- Operator real Publisher/App/ad-unit ID-lərini daxil edib. Konfiqurasiya revision
  **59**, **Canlı**, enabled; 13 iOS placement-in ID-ləri doldurulub.
- `api.anacan.az/app-ads.txt` və `anacan.az/app-ads.txt` eyni operator publisher sətrini təqdim edir.
- iOS **34.0 development** paketi real App ID ilə cihazda işləyir; istifadəçi giriş
  və əsas ekran bannerini təsdiqləyib. UMP mesajı Published edilib və storage quota
  xətası düzəldilib. [Cihaz sınağı və IPA](IOS_ADMOB_TEST_34.md).
- Bu qəbul digər native formatları və gəlir/store publication yoxlamasını əvəz etmir.

## İlkin v2 vəziyyəti — 2026-09-20

2026-09-20 v2 web release-i `anacan-gateway--0000018` üzərindədir. Konfiqurasiya
`anacan-admob-v2`, **Demo**, ümumi açar aktiv və 13 placement aktivdir. Demo yalnız
administratorun önizləmə sessiyasında göstərilir; adi istifadəçilərə nümunə reklam
göndərilmir. Canlı publisher, App ID və ad unit ID-ləri operator tərəfindən doldurulur.

Canlı panel, hər N story / hər 2 oyun demosu, rewarded davranışı, hər üç banner
mövqeyi və ümumi dayandırma **8/8 browser yoxlamasından keçib**. Sınaq ayarları
bərpa edilib və müvəqqəti test hesabları silinib. Sübut:
`azure-migration/ops/admob-web-1789883603854.json`.

Hazırlanan native mənbə və test namizədi Google-un rəsmi test App ID-lərindən istifadə
edir. Real gəlir yaradan native yayım üçün öz App ID-lərinizlə yenidən build lazımdır.
Yayımlanmış 30.0 paketinə native SDK avtomatik əlavə olunmur.

## 1. Placement xəritəsi

| Placement ID | Harada | Format | Tetiklənmə |
| --- | --- | --- | --- |
| `home_banner` | Əsas ekran, qadın və partnyor home | Adaptiv banner | Ekran açıq, giriş fasiləsi/minimum vaxt keçib |
| `tools_banner` | Alətlər kataloqu | Adaptiv banner | Alət açılana qədər |
| `community_banner` | Ümumi cəmiyyət lenti | Adaptiv banner | Feed açıq, mesaj/profil/story/redaktor bağlı |
| `blog_list_banner` | Bloq/kateqoriya siyahısı | Adaptiv banner | Siyahıya baxış |
| `blog_article_banner` | Açıq məqalə | Adaptiv banner | Oxunuş; şərh yazarkən gizlənir |
| `recipes_banner` | Resept siyahısı və detalı | Adaptiv banner | Reseptlərə baxış |
| `baby_names_banner` | Adlar kataloqu | Adaptiv banner | Siyahı; ad detalı/axtarış klaviaturasında gizlənir |
| `article_exit_interstitial` | Məqalədən çıxış | Interstitial | Məqalənin Geri düyməsi, minimum oxuma vaxtı |
| `recipe_exit_interstitial` | Reseptdən siyahıya qayıdış | Interstitial | Resept detalının Geri düyməsi |
| `ads_pause_rewarded` | Tənzimləmələr → Reklam seçimləri | Rewarded | İstifadəçinin “Reklama bax və fasilə qazan” seçimi |
| `community_story_break` | Cəmiyyət story-ləri arasında | 9:16 native / native video | Hər N real irəli story keçidindən sonra; ilkin N = 5 |
| `games_break_interstitial` | Hər iki mini oyunun nəticə ekranı | Interstitial | Hər N bitmiş raunddan sonra keçid; ilkin N = 2 |
| `game_revive_rewarded` | Uduzulmuş raund | Rewarded | İstifadəçinin can / gediş bərpası seçimi |

Banner bir anda yalnız bir dənədir. Hər placement üçün mövqe ayrıca seçilir:

- **Yuxarı:** safe-area-dan aşağı; məzmun reklamın altından başlayır.
- **Orta:** məzmun daxilində ayrılmış 320×50 sahə. Scroll zamanı həmin sahəni
  izləyir, sahə tam görünməyəndə native view gizlənir.
- **Aşağı:** aşağı naviqasiyadan yuxarı; scroll sahəsi reklam/nav zolağını örtmür.

Yuxarı/aşağı banner adaptivdir. Native creative-ni Google SDK çəkir; paneldəki
nümunə creative yalnız demo görünüşüdür. Orta mövqe üçün ekranlarda explicit
yer ayrılıb; mətn və düymələrin üstünə təsadüfi reklam əlavə edilmir.

Interstitial əvvəlcədən yüklənir. Geri düyməsi basıldıqda hazır reklam yoxdursa
naviqasiya dərhal davam edir. App açılışında, bildiriş toxunuşunda, tab dəyişəndə,
hardware-back və ya swipe ilə təsadüfi tam ekran reklam açılmır.

Yeni placement ID-ni sadəcə panelə yazmaq yeni ekran yeri yaratmır. Xəritə client
kodunda müəyyən edilib; yeni yer/format əlavə etmək yeni web və native build tələb edir.

### Story və mini oyun davranışı

- Story placement-də **Native/media** və **Yalnız video** seçilir. İkinci seçim
  yalnız video media-sı olan AdMob Native cavabını qəbul edir; uyğun reklam
  yoxdursa story axını davam edir. Unit ID AdMob-da Native formatında yaradılır.
- Native story görünüşü MediaView, advertiser/headline/body/CTA, **REKLAM**, AdChoices
  və ayrıca bağlama/növbəti düymələri ilə tam ekran təqdim edilir. Öz video faylını
  panelə yükləmək üçün creative editor yoxdur.
- Öz story-ləri, geri keçid və təkrar forward view sayılmır. Ad açıqkən story
  videosu/progress dayanır; bağlananda dəqiq növbəti story-yə keçir. Son story
  bağlanışında məcburi ad açılmır. Reklam story view/like/reply sayına daxil edilmir.
- Oyun cadence-i `won` və `lost` nəticələrini bir dəfə sayır; reklam retry/next/menu
  keçidində açılır. Oynayarkən reklam yoxdur. Göstərilmə minimum vaxt, limit,
  hazır ad və digər uyğunluq qaydalarına tabedir; N hər keçiddə zəmanətli impression deyil.
- Hər üç yeni placement-in ayrıca aktiv/deaktiv açarı var.

## 2. Ümumi qaydalar

| Ayar | İlkin dəyər | Mənası |
| --- | --- | --- |
| Ümumi reklam açarı | Aktiv | Bütün yeni reklam cəhdlərini idarə edir |
| Rejim | Demo | Demo / Test / Canlı |
| Minimum native versiya | 31.0 | SDK-sız/köhnə build-də reklam açılmır |
| Başlanğıc fasiləsi | 60 saniyə | Passiv banner və interstitial üçün sessiya grace müddəti |
| Tam ekranlar arası fasilə | 600 saniyə | `Ümumi fasiləyə əməl et` aktiv olan placement-lər üçün |
| Tam ekran sessiya limiti | 3 | Interstitial + native story + rewarded ümumi açılış sayı |
| Tam ekran günlük limit | 8 | UTC günü üzrə, bu cihazda |
| Banner dəyişmə fasiləsi | 60 saniyə | Tez tab/ekran dəyişəndə yeni banner yükünü məhdudlaşdırır |
| Rewarded fasilə | 30 dəqiqə | Tamamlanmış videodan sonra reklamsız vaxt |
| NPA | Aktiv | Fərdiləşdirilməmiş reklam sorğusu |

**Hamısını dərhal dayandır** serverdə son konfiqurasiyanın yalnız `enabled`
bayrağını söndürür, ayrıca audit versiyası yaradır. Redaktə edilən draft varsa
qorunur, amma əvvəlki versiyaya əsaslandığı üçün yenidən uyğunlaşdırılmalıdır.
Normal dəyişikliklər **Yadda saxla** ilə birlikdə atomik tətbiq olunur.
Yeni panel ayrıca Source sinxronunun təsdiqini gözləyir. Pending olduqda Source
əvvəlki ayarları göstərə bilər; **Source sinxronunu yoxla** ilə təkrar yoxlayın.
Source emergency override-u Azure-dan ləğv edilmir.

Cihazlar konfiqurasiyanı təxminən 30 saniyədə yeniləyir. Şəbəkə/config xətasında
yeni reklam dayandırılır. Artıq açılmış native tam ekran reklamının bağlanması
Google SDK-nın bağlama düyməsi ilə idarə olunur.

## 3. Hər placement-in ayarları

- Aktiv/deaktiv.
- iOS və Android seçimi.
- Platformaya ayrı canlı ad unit ID.
- Ekranda minimum vaxt.
- Eyni placement-in yenidən göstərilmə fasiləsi.
- Sessiya və günlük açılış limiti.
- İstəyə bağlı başlanğıc/bitmə tarixi. Panel lokal vaxtı göstərir, server UTC saxlayır.
- Banner üçün **yuxarı / orta / aşağı** mövqeyi.
- Story və oyun fasiləsi üçün **hər N** tezliyi; story üçün **native / video** formatı.
- Tam ekranlar üçün ümumi cooldown-a əməl edib-etməmə.
- Oyun revive üçün bərpa olunan can, gediş, minimum saniyə və raund başına revive limiti.

İlkin banner limitləri: **90 saniyə / sessiyada 10 / gündə 40 / minimum baxış 5 saniyə**.
Məqalə/resept interstitial: **1200 saniyə / sessiyada 2 / gündə 4 / minimum baxış 30 saniyə**.
Reklamsız fasilə rewarded: **1800 saniyə / sessiyada 2 / gündə 4**.

| Yeni placement | Tezlik / bərpa | Cooldown | Sessiya / gün |
| --- | --- | --- | --- |
| Story arası | Hər 5 story; minimum 2 saniyə baxış | 15 saniyə | 20 / 40 |
| Oyun arası | Hər 2 bitmiş raund | 15 saniyə | 20 / 40 |
| Oyun revive | 3 can, 5 gediş, ən azı 15 saniyə; 1 dəfə/raund | 0 saniyə | 10 / 20 |

Bu üç placement-də ümumi 600 saniyəlik cooldown ilkin olaraq söndürülüb.
**Ümumi 3/sessiya və 8/gün tam ekran limitləri yenə işləyir.** Daha çox fasilə
istənirsə admin həm placement, həm ümumi limitləri birlikdə nəzərə almalıdır.

Banner limiti tətbiqin placement-i açmasına aiddir. AdMob SDK-nın öz banner refresh
siyasəti AdMob konsolundadır; impression telemetriyası açılış sayından çox ola bilər.
Günlük sayğac cihazda saxlanır; yeni app sessiyası sessiya sayını sıfırlayır, həmin
UTC gününün sayını saxlayır. Bu sayğaclar ödəniş/hesablaşma təhlükəsizliyi mexanizmi deyil.

## 4. Premium və qorunan axınlar

- Premium, aktiv ləğv edilmiş amma müddəti bitməmiş Premium və ailə Premium-u reklamsızdır.
- Abunəlik hələ dəqiqləşməyibsə reklam göstərilmir.
- Giriş, onboarding, tibbi alətlər, hesabat, şəxsi mesajlaşma və ödəniş ekranlarında
  reklam placement-i yoxdur.
- Klaviatura, görünən modal, tətbiq kilidi, aktiv taymer və ağ səs banneri dayandırır.
- Hamiləlik həftəsi, simptom, dövr, uşağın məlumatları, mesaj, ad axtarışı və digər
  tibbi məlumatlar AdMob sorğusuna göndərilmir və placement hədəfləməsi sahələri deyil.
- UMP `canRequestAds` icazəsi olmadan native reklam sorğusu başlanmır.

## 5. Rewarded mükafatı

Mükafat yalnız SDK-nın **earned reward** hadisəsi ilə bir dəfə verilir. Sadəcə videonu
bağlamaq, show promise-in bitməsi və ya yüklənmə callback-i mükafat sayılmır.
`ads_pause_rewarded` mükafatı bu cihazda reklam fasiləsidir. `game_revive_rewarded`
isə yalnız həmin raundun canını/gedişini bərpa edir; reklamsız fasilə vermir.
Premium statusu, AI limitləri, balans, abunəlik və serverdəki ödənişli imkanlar dəyişmir.

**Sağlam Səbət:** score saxlanır, can və minimum qalan vaxt bərpa olunur, köhnə
düşən obyektlər təmizlənir. **Birləşdir:** board və score saxlanır, əlavə gediş verilir.
Bağlanmış ekran, köhnə raund və təkrar callback mükafat vermir. Premium istifadəçi
placement aktivdirsə eyni raund limitilə videoya məcbur edilmədən bərpa edə bilir.

Demo üçün ayrıca sayğac/fasilə saxlanır. Demodakı “tamamla” seçimi canlı reklam
fasiləsi və gəlir yaratmır. Admin “Demo limitlərini sıfırla” ilə sınağı təkrar edə bilir.

## 6. Demo laboratoriya və real ekran önizləməsi

**Laboratoriya** draft ayarlarını sınayır: placement, platforma, Free/Premium,
online/offline, UMP icazəsi, modal/klaviatura, əvvəlcədən yüklənmə və vaxt ssenariləri.
Hər cəhddə göstərilmə və ya rədd səbəbi görünür. Test/Canlı qaydaları seçilsə belə,
laboratoriya real reklam şəbəkəsinə sorğu göndərmir.

Story üçün **Bir story tamamlandı**, oyun üçün **Bir oyun tamamlandı** düymələri
ilə N sayğacını sınayın. Native/video görünüşünü və revive parametrlərini placement
draftında dəyişmək olar. Tamamlama düyməsi demo mükafatını, bağlama isə mükafatsız
keçidi göstərir.

**Saytda aç** yadda saxlanmış konfiqurasiya ilə real ekranı ayrı pəncərədə açır.
Yuxarıdakı bənövşəyi panel demo rejimini göstərir. Sürətli önizləmə yalnız başlanğıc
və ekran vaxtını qısaldır; placement/platforma, Premium, global switch və say limitləri
yoxlanır. Məqalə placement-i üçün bloqda məqalə, resept çıxışı üçün resept açın.

## 7. Telemetriya və tarixçə

Son 30 gün üçün demo/test/canlı ayrılığında sorğu, yüklənmə, impression, açılış,
bağlanma, rewarded tamamlama, rədd və xəta sayları saxlanır. Hadisələr yalnız
placement/platforma/rejim/səbəb səviyyəsindədir; tibbi kontekst və mesaj məzmunu yoxdur.
Client telemetriyası maliyyə hesabatı deyil. Gəlir/hesablaşma üçün paneldəki AdMob
konsol linkindən istifadə olunur.

Konfiqurasiya hər yadda saxlamada versiyalanır. Paralel redaktə `409` ilə dayandırılır.
Tarixçədən bərpa köhnə ayarları yeni versiya kimi yazır. JSON ixrac/idxal mümkündür;
idxal yalnız draftı dəyişir, tətbiq üçün ayrıca Yadda saxla tələb olunur.

## 8. Native və canlı ID-lər

1. AdMob-da iOS və Android üçün app qeydlərini və uyğun reklam bölmələrini yaradın.
2. App ID `ca-app-pub-…~…`, ad unit ID `ca-app-pub-…/…`, publisher `pub-…` formasındadır.
3. Eyni AdMob publisher-inə aid ID-ləri panelə daxil edib yadda saxlayın.
4. **Native hazırlıq → Native build konfiqurasiyası** faylını endirin; yerli olaraq
   `azure-migration/provider-inputs/admob-native-config.json` yolunda saxlayın.
5. Yeni namizəd hazırlanarkən konfiqurasiyanı verin:

```sh
node azure-migration/scripts/prepare-native-preview.mjs --create --version 31 --source-first --revenuecat-enabled --ios-store --ios-project-from native-20260913t165359-6aa475be --admob-config azure-migration/provider-inputs/admob-native-config.json
```

Komandadan qaytarılan **yeni run ID** ilə `build-native-web.mjs RUN_ID ios` və
`build-native-web.mjs RUN_ID android` ardıcıl işlədilir. Mövcud Xcode workspace və
yayımlanmış 30 artefaktlarının üstünə build edilmir. Google test App ID-ləri ilə
hazırlanan namizəd canlı publisher üçün uyğun sayılmır.

App ID native Info.plist/Android resursuna və uyğun build metadata-sına birlikdə
yazılır. Client canlı rejimdə build-in App ID-sini server konfiqurasiyası ilə
müqayisə edir. Uyğunsuzluqda reklam açılmır. Ad unit ID, aktivlik və limit dəyişiklikləri
hazır SDK/placement olan build-də uzaqdan idarə olunur.

`@capacitor-community/admob@8.1.0` sabit versiyadır. Reviewed patch iOS-da gecikmiş
banner callback-inin silinmiş ekranı yenidən açmasını, Android-də silmə/yenidən
yaratma yarışını və host window inset listener-inin əvəzlənməsini düzəldir.
`patch-package` postinstall-da bu düzəlişləri saxlayır.

Patch həmçinin `setBannerFrame` və hər iki platformada native story prepare/show/remove
API-lərini əlavə edir. UMP executor iOS SDK initialize-dan əvvəl hazırlanır.
`pin-admob-swift-packages.mjs RUN_ID` original 22 Swift pin-i qoruyur, yalnız
GoogleMobileAds **13.6.0** və GoogleUserMessagingPlatform **3.1.0** əlavə edir.
Resolution zamanı `-skipPackageUpdates -disableAutomaticPackageResolution
-onlyUsePackageVersionsFromResolvedFile` istifadə olunur.

Cari test namizədi `native-20260919t173724-4142fccb`-dir. Web/sync/routing yoxlaması
və Android signed APK/AAB yoxlamaları keçib; iOS Release arm64 kompilyasiyası
0 xəta/0 xəbərdarlıqla tamamlanıb. Hər iki platformada 334 embedded asset və yeni
AdMob native bridge metodları yoxlanıb. Distribution signing, fiziki cihaz və
store mərhələləri [iOS 31 sənədində](IOS_RELEASE_31.md) qeyd olunur.

## 9. app-ads.txt və mobil buraxılış

Panel publisher-dən `google.com, pub-…, DIRECT, f08c47fec0942fa0` sətrini yaradır.
`/app-ads.txt` həmin public məlumatı text/plain kimi təqdim edir. Fayl mağazadakı
developer website domeninin kökündə olmalıdır; həmin domen fərqlidirsə orada da
yayımlayın. Publisher təyin olunmayanda server izahlı comment qaytarır.

Native UMP mesajını AdMob **Privacy & messaging** bölməsində konfiqurasiya edin.
SDK daxil edilmiş yeni paketlə test reklamı, bağlama, rewarded, Premium, klaviatura,
taymer və offline/restart yoxlamaları edilir. Store məlumatları istifadə olunan SDK
və reklam davranışını əks etdirməlidir.

Mövcud native admission hələ Source-first müqaviləsinə tabedir. Cari native client
Source backend-də olarkən də reklam konfiqurasiyasını Azure public control endpoint-indən
anonim oxuyur; Source sessiyası ora göndərilmir. [Source uyğunluğu](SOURCE_RUNTIME_COMPATIBILITY.md).
Bu reklam yenilənməsi [final backend handoff](AZURE_FINAL_SYNC_AFTER_APPROVAL.md)-u əvəz etmir.

## Texniki fayllar

- `src/lib/ads/`: registry, schema, eligibility, device counters, SDK adapter, API.
- `src/components/ads/`: provider, demo, simulator, preferences.
- `src/components/admin/AdminAdmob.tsx`, `/admin/ads` route.
- `azure-migration/sql/13-admob-control.sql`: validated/admin-only writes, revisions,
  coarse telemetry and raw publisher text endpoint.
- `azure-migration/sql/14-admob-contextual.sql`: v2, 13 placement, cadence/position/revive
  validation və operator ayarlarını qoruyan upgrade/history expansion.
- `azure-migration/scripts/admob-native-config.mjs`: native App ID injection.
- `src/hooks/useGameAds.ts`, `src/lib/ads/cadence.ts`, `StoryViewer.tsx`: oyun/story inteqrasiyası.
- `patches/@capacitor-community+admob+8.1.0.patch`: native lifecycle fixes.
- `azure-migration/ops/verify-admob-web.mjs`: real Azure API + browser acceptance.
- `azure-migration/ops/web-artifact-1789883606328.json`: canlı v20 entry bytes/health/route sübutu.
- ACR run `cb11`, image `test-gateway@sha256:99b02a53b95f85c0a648d5b89d41d9b19b72ed4501c96e78a73fe26aa5d2265b`.
