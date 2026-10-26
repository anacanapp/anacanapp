# Tumurcuğun uçuşu və Yolunu aç — iOS 48.3

**Hər iki oyun Mini Oyunlar bölməsinə əlavə edilib və48.3 development paketi
iPhone13ProMax-a quraşdırılıb.** Təhvil vaxtı:2026-10-09 07:57UTC.

## Tumurcuğun uçuşu

**Alətlər → Mini Oyunlar → Tumurcuğun uçuşu**.

- Tumurcuq yarpaq paraşütü ilə uçur. Ekranı və ya **Yüksəl** düyməsini basıb
  saxlayanda yüksəlir, buraxanda enir. KlaviaturadaSpace/↑/W də işləyir.
- Məqsəd budaqların arasından keçərək ulduzları toplamaq və bayraqlı sona çatmaqdır.
 3can var;toqquşma bircanazaldır və1.25saniyəlikqoruma verir. Sonaçatmaq
  üçün bütünulduzları toplamaq tələb olunmur.
- **30səviyyə**,5bölmə:1–6ilk uçuş,7–12külək,13–18daha dar keçid,
  19–24hərəkətli budaqlar,25–30gizli yollar. Sonbölmədə24ayrıcaalternativ
  keçid vəbənövşəyibonusulduz var;həminkeçidlər toqquşmadan keçilə bilir.
- Səviyyələr deterministikdir,revision`flight-202610-v1`. Sabit60Hzphysics
  işləyir;rəsmrenderframe-dənasılıolmadan eyniqaydaylatətbiq edilir. Uzunframe
  vəbackgroundelapsed səssizcəcanitirməyə çevrilmir.
- Yoxlanmıştamamlanmamüddəti28–35saniyədir. Bütün30səviyyə realhold/release
  nəzarət trajectory-si ilə3canqorunaraqtamamlanır. Realbrowser-də1və30səviyyə
  touchpress/release iləsonacanoynanıb.
- 3ulduz:əsasulduzlarınənaz80%-i vəənaz2can;2ulduz:ənaz45%;digər
  tamamlanmalar1ulduz. Xal toplananulduz/can/bölmədənhesablanır.

## Yolunu aç

**Alətlər → Mini Oyunlar → Yolunu aç**.

- Qucaqın yaşılmaşını sağdakıçıxışaçatmalıdır. Digərmaşınları yalnızöz
  üfüqi/şaquli istiqamətlərində sürüşdürərək yolu aç.
- Bir neçəxananı keçənsürüşdürmə **birgediş** sayılır;araşəldəbaşqamaşın varsa
  keçməkolmır. Maşını seçiboxlar vəyaklaviaturailə dəhərəkət etdirməkolar.
- Uzun3xanalıavtobuslar,dahasıxparkdüzülüşləri və**40həlliyoxlanmışsəviyyə**.
  İlk8səviyyəbaşlanğıc,9–16dahasix,17–24uzunmaşınkoordinasiyası,
  25–32kilidliçıxış,33–40ustatapmacalarıdır.
- Son16səviyyədəçıxışkilidlidir. Açar işarəlimaşını halqalımüəyyən yerə
  gətirəndəkiliddəfəlikaçılır;sonradan maşınıhərəkətetdirmək çıxışıbağlamır.
- Catalogrevision`parking-202610-v1`;40səviyyəninenqısahəlli2–15gedişdir.
  Minimumhəllarbitrarysürüşdürməbaşına1gedişolaraqmüstəqilBFSiləverified-dir.
- 3pulsuzsolveripucu,geri alma,fasilə,restart vəsaxlanmışraundvardır.
  İpucuəsasdüzgünmaşın/istiqaməti vurğulayır,özüyərinəoynamır.
- 3ulduz:optimalgedişdaxilində/ipucusuz;2ulduz:optimaldanənçox5əlavəgediş/
  ənçox1ipucu;digərtamamlanmalar1ulduz. Undoümumigedişstatistikasınıazaltmır.

## Dil, yaddaş və inteqrasiya

- Həriki oyun **21offlineUI dilində** açılır. Yeni20açar/copybundle +mövcud
  localizedcommoncontrols istifadə edilir. ArabicRTL UI-dədir,oyunhəndəsəsi
  vəsağçıxış/fizikioxlar dəyişmir. Tumurcuq/Qucaqbrendpersonajları qorunur.
- Existing`pregnancy-mode.webp`/`mother-mode.webp`artwork,Canvasparachute,
  responsivescrolling-freeactiveboard/dock vəiPhonesafearealayout.
- Saveaçarları:
  `anacan_casual_v1:leaf-flight:flight-202610-v1`,
  `anacan_casual_v1:clear-the-way:parking-202610-v1`.
- Progressdilə görə bölünmür,çünki hərdiləeynicataloghəndəsəsiuyğundur.
  Maksimum30/40result;flightcurrentstate/collection vəparkingənçox240move
  saxlanır. Wincurrentround-u təmizləyir,bestscore/starsmonotonic qalır.
- Flight2sautosave/fasilə/unmountcurrentphysicsstate saxlayır;touchcancel/
  keyup/blur/visibilityhold-u buraxır. Reloadəvvəlcə**Oyna**tələb edir.
  Parkingpathreplayexactcar/keypositionsbərpa edir;malformedround valid
  aggregateprogress-ətoxunmadan sıfırlana bilər.
- Auth/pin/draft/WordGarden/TwoFriendssave-ləri qorunur;quotahelper yalnız
  disposablecachetəmizləyir. Local-onlygame, yeniDBrelation/RPC yoxdur.
- ExistingGameAdsconsent/Premium/terminalinterstitialtransition saxlanır;
  activepuzzle başqaadvertisingplacement-ləribloklayır. Dialogfocus/inert/
  Escape/nativeback/fasilə daxil edilib. Fizikihaptics ayrıcauseracceptance-dir.

## Qəbullar

- **58focusedtest**:15yenigame/state/input/language,43WordGarden/TwoFriends/hub
  regressiyası. Flightfixed-step/hold/cancel/background/save vəparkingcollision/
  axis/keyexit/multi-cell/shortestsolution/undo/hint yoxlanıb.
- Müstəqilreference **40parkingoptimalhəll/16lockedexit/85avtobus** və
  **30flightsafetraj/24secretgap** qəbulunu keçir.
- **9productionbrowsercheck/18screenshot/8responsivecase**:realtouchcar-drag,
  multixanagediş/reload/undo/workerhint/pause,25/40keyparkhəlləri,
  flight1/30realtouchfinish,keyboardpause/resume və42realhubopen×21dil.
  320/390/428safearea/768tablet/844×390landscape keçir.
- App/nodeTypeScript,featureESLint,Googleproductionbuild vənative17routing keçir.
- Credential-freeqəbul:`scripts/new-games/acceptance.json`,
  `level-verification.json`;productionbrowsertemp`anacan-flight-parking/`.
  CheckpointsourceSHA-matchedresume yalnızeyniruntimekod üçün istifadə edilir.

## iPhone paketi və davam

Isolatedrun **`native-20261009t074213-baba0023`**,version **48.3**.

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `azure-migration/releases/48.3/Anacan-48.3-iOS-Development.ipa` |51787909|`f95409faf9324a7fb3e725ef513ff6f64668da286df2dd7a1cf502a4c6dce675`|

- iPhone48.2→48.3in-placeinstallverified;istifadəçiəvvəlözüaçacağınıbildirib.
  Receipt**installed:true**,launch**user-will-launch**;fizikigameplaypending-dir.
- 535JS/CSSasset/nativehash,LeafFlight/ClearTheWay/parkingmoduleworker,
  WordGardenv2/TwoFriends,21dil/17managedroutingbundle qəbul edilib.
- 68nativeinput vəmain/widgetMach-O48.0baseline iləeyni;candidateclonearchive-də
  yenibundle/version/imza/export. Signature/profile-certificate/developmentpush/
  HealthKit/AppleSignIn/widgetAppGroup verified;originalworkspacelərread-onlydir.
- Identity`com.atlasoon.anacan`,team`8B6976J8H7`,widget
  `com.atlasoon.anacan.AnacanTimerWidgetExt`,AppGroup`group.com.atlasoon.anacan`,
  WebViewhostname`app.anacan.az` qorunur.
- Googleactivecanonical/offlinemanagedadmission`azure`generation2,
  refresh-before-use/session/tombstone/adoption,Customer.io224149:93570 və
  liveAdMobrevision61/13placement confirmed. Currentblogprojection/gateway
  overlay və8timer bu app-onlybuildscope-dədavam edir.
- Receipt:`azure-migration/ops/flight-parking-ios-test-48.3.json`,
  device`ios-device-test-1791532662481.json`;run`preparation.json`,`web-ios.json`,
  `build-ios.json`,`device-test-completion.json`;deliverymanifest/SHA256SUMS.
- Finalized48.3/48.2/48.1/48.0developmentpaket/workspace saxlanır.
  CommonStorepointer47/nextcommon48 qalır;Storepublication/liveweb ayrıpendingdir.
  Feedbacknewisolateddevelopmentrevision tələb edir.
