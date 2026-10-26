# İki dost — Ritm və Tumurcuqu birlikdə evə çatdır

**Alətlər → Mini Oyunlar → İki dost**. Oyun bütün21tətbiq dilində offline işləyir.
40səviyyəlik birgə hərəkət tapmacasıdır; bir ox hər iki personaja təsir edir,
amma hər birinin ayrı maneələri və öz evi var.

## Oynanış

- Ox düymələri, sahədə sürüşdürmə və ya klaviaturanın oxları/WASD ilə idarə edilir.
  Bir gedişdə hər iki dost hərəkət etməyə çalışır. Daş/qapı birini saxlayanda
  digəri hərəkət edə bilər.
- Tumurcuqun istiqaməti səviyyə üzrə **eyni**, **sol–sağ güzgü**,
  **yuxarı–aşağı güzgü** və ya **tam əks** olur. Cari qayda statusda göstərilir.
- Bir dostun götürdüyü açar eyni işarəli qapıları iki sahədə də daimi açır.
- Düymədə dayanmaq uyğun qapını açır; qapının həmin gedişdə açıq olub-olmaması
  hərəkətdən əvvəlki düymə vəziyyətinə görə hesablanır. Bu, bir dostun düymədə
  dayanaraq digərinin qapıdan keçməsinə imkan verir.
- Bəzi qapılar **iki düymənin eyni vaxtda basılmasını** tələb edir. Düyməni
  tərk edəndə qapı bağlanır; içəridəki dost çıxa bilər, bağlı qapıya giriş olmur.
- Çaya düşən dost raundu dayandırır. **Geri al** hər iki dostu birlikdə əvvəlki
  vəziyyətə qaytarır; açar və düymə vəziyyəti də həmin gedişlə geri alınır.
- Qələbə üçün **hər iki dost eyni anda öz evində** olmalıdır. Evə çatmaq
  personajı dondurmur: növbəti oxla yenə hərəkət edir, buna görə koordinasiya lazımdır.
- Hər raundda3pulsuz solveripucu var. İpucu yalnız növbəti doğru oxu göstərir,
  yerinə avtomatik oynamır. Fasilə, yenidən başlama və qaldığı yerdən davam var.

## Səviyyələr

| Səviyyə | Bölmə | Yeni qayda |
|---|---|---|
|1–8|Birlikdə ilk addım|Eyni idarəetmə, ayrı daşlar və gözləmə|
|9–16|Güzgü yollar|Əks ox/istiqamət və çay maneələri|
|17–24|Dosta yol aç|Birinin açarı digərinin qapısını açır|
|25–32|Əlaqəli qapılar|Düymə ilə qapı, son4səviyyədə iki düymə|
|33–40|Əsl komanda|Açar, əks hərəkət və düymə-qapı ardıcıllığı birlikdə|

Publishedcatalog`friends-202610-v1`:
`src/components/games/iki-dost/catalog.json`. Səviyyələrin həlli4–18gedişdir.
40səviyyənin hamısı optimalhəlli ilə yoxlanıb. Yeni catalog üçün yeni revision
istifadə edilir; mövcud saxlanmış raundun həndəsəsi səssiz dəyişdirilmir.

3ulduz: ipucusuz vəoptimalgedişsayını keçmədən;2ulduz: ən çox1ipucu və
optimaldan ən çox8əlavəgediş;digər tamamlanmalar1ulduz. Hərqələbə növbətini açır.
Geri alma gedişstatistikasını azaltmır. Təkrarqələbə xalı/ulduzunu yaxşılaşdıra
bilər, amma eyni dostları təkrar yeni xilasetmə kimi saymır.

## Görünüş, dillər və yaddaş

- Rəng vəməzmun ayrılığı: Ritm-in koral/yaşıl sahəsi, Tumurcuq-un bənövşəyi sahəsi.
  OrijinalAnacan`cycle-mode.webp`/`pregnancy-mode.webp`personajları istifadə edilir.
- İkiayrıboard,evstatusu,aydınidarəetməqaydası,44px+oxdüymələri. Qısa
  ekranlarda oxlarbir sırada;landscape-də iki boardyan-yana/idarəetmədockyanındadır.
- Bütün21dil üçün55label/help/copyaçarı offlinebundled;ArabicRTL yalnızUI-ni
  çevirir. Oyunhəndəsəsi vəfizikioxistiqamətləriLTRqalır. Ritm/Tumurcuq adları saxlanır.
- Localprogress:`anacan_two_friends_v1:friends-202610-v1`. Tərcümədən asılı
  olmayan eyni səviyyələr olduğuna görə dil dəyişəndə irəliləyiş dəyişmir.
-40level nəticəsi vəən çox320gedişlikcurrentpath saxlanır. Undo/reload current
  path-i replay edib eyni key/door/position vəziyyətini qaytarır. Malformedround
  sıfırlana bilər, validaggregateprogress qorunur. Existingquotahelper yalnız
  disposablecache təmizləyir;Auth/pin/draft/WordGarden/digəroynanış silinmir.
- Səsdefaultoff/hapticsdefaulton;azaldılmışanimasiya sistem seçiminə tabedir.
  Backgroundkeçiddəfasilə,dialogfocus/inert/Escape/nativebackhandler var.
- Oyunlocal-only-dir;newDBrelation/RPC/leaderboardwrite yoxdur. Mövcudreytinq
  oyunları qorunur. GameAdsconsent/Premium/interstitialhook-u istifadə edilir;
  activepuzzle başqaadvertisingplacement-ləri bloklayır.

## Qəbul

- **21focusedtest**:17engine/state/UI/21language/newhub və4mövcudWordGardenhubregressiya.
  Ortaqhərəkət,əksaxis,keytiming,two-switch/pre-movegate,safeundo/savedpath,
  once-onlyrescue,StrictMode,inputpause vəsolverbasedhint keçir.
- Müstəqilgridreference40cataloghəllinin optimal/valid olmasını yoxlayıb:
  **16keyrequired/16pressuredoorrequired/6doubleswitch/36asymmetriccoordination**.
  Qapıbağlandıqda uyğun səviyyələrin həlli olmadığı ayrıca sübut edilib.
- **14productionbrowsercheck/13screenshot**, realtouchoxqələbəsi,touchswipe/keyboard,workerhint,
  reload/undo/pause/settings,12/17/29/40advancedlevelhəlləri,320/390/428safearea/
  768tablet/844×390landscape vərealhub-da21dilin açılışı keçir.
- App/nodeTypeScript,featureESLint,Googleproductionbuild vənative17routing keçir.

Credential-freeqəbul:`scripts/iki-dost/acceptance.json`,
`level-verification.json`;privatebrowserreporttemp`anacan-two-friends/`.
Handoff `.gitignore`-a tabedir;privatebackend/signinggirişləri bu fayllara daxil edilmir.

## iPhone təhvili — 48.2

2026-10-09 istifadəçi əvvəl48.1-i telefona qurmağı,sonra oyunu əlavə etməyi istədi.
48.1cihazversioninventory ilə təsdiqləndi;istifadəçi özü açacağını bildirdi.
Sonra **İki dost daxil48.2 developmentIPA**isolatedrun
`native-20261009t044714-61919dce`-dən **iPhone13ProMax-a quraşdırıldı**.

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `azure-migration/releases/48.2/Anacan-48.2-iOS-Development.ipa` |51751972|`3710efaa8c5255ce462dc9c5fac070590b6858fc3100c8bf6baa49c250a9a9e4`|

- Device48.1→48.2in-placeinstall04:56UTCverified. Userappcontaineroxunmayıb,
  uninstallolmayıb. Launchistifadəçinin özüdür;auto-launch/process/gameplay
  qəbulutəhvildənayrıdırvəassertedPASSdeyil.
-527JS/CSSassets,TwoFriendslazy/hintworker vəWordGardenv2bundle,signedmain/widget,
  profile/certificate/HealthKit/AppleSignIn/developmentpush/AppGroup qəbul edilib.
-68nativeinput vəmain/widgetMach-Ocontentverified48.0baseline iləeyni idi;
  newcandidateclonearchive/web/version48.2/imza/export qəbulu keçir.
- Googleactivecanonical/offlineadmission`azure`generation2,session/tombstone/
  refresh-before-use,Customer.io224149:93570 vəliveAdMobrevision61 qorunur.
- Nativeidentity`com.atlasoon.anacan`,team`8B6976J8H7`,widget/AppGroup,
  WebViewhostname`app.anacan.az`. CommonStorepointer47/nextcommon48 qalır;
  finalized48.0/48.1 və47/46/45/44/43paketlər saxlanır.
- Yekunreceipt:`azure-migration/ops/two-friends-ios-test-48.2.json`,
  cihaz:`ios-device-test-1791521775778.json`;run`preparation.json`,`web-ios.json`,
  `build-ios.json`,`device-test-completion.json`. Liveweb/Storeyayımı pending-dir.

2026-10-09 sonrakı48.3developmentpaketindəİkidost/Sözbağıiləbirlikdə
Tumurcuğun uçuşu vəYolunu açdaxildir;cihaz48.2→48.3verified. Finalized48.2
paket/workspace saxlanır. [48.3təhvili](FLIGHT_AND_PARKING_48_3.md).
