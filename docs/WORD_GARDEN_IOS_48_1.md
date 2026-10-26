# Söz bağı — 48.1 iOS balans və vizual yenilənməsi

**Yenilənmiş48.1 development paketi iPhone13ProMax-a quraşdırılıb.**
2026-10-08 istifadəçi gameplayfeedback-i vaxtın qısaldılması, söz təkrarının
azaldılması və ekranın daha yaxşı bölünməsini tələb edib.

## Dəyişikliklər

- İlk vaxtlı səviyyə **31 saniyə**, asan2sözlü səviyyələr **25 saniyə**;
  daha çox/uzun söz olduqda büdcə artır. Yoxlanmış səviyyələrdə maksimum98saniyədir.
  Vaxt yalnız **“Oyuna başla”** ilə başlayır, fasilə/background/settings zamanı dayanır.
- Əsas söz seçimi **2010→2921**; lüğətdə6857verifiedAzərbaycan sözü saxlanır.
  Yeni revision **`az-202610-v2`**. Hər rejimdə1–2400ardıcıl səviyyə üzrə
  eynisöz/eynirack/eynipuzzle0; uzaq səviyyələrdə sonlu lüğət təkrarı mümkündür.
- Böyük ayrıca lövhə, oxunaqlıvaxt/sözstatusu, kompakt hərf dock-u,
  **İpucu/Bonus/Fasilə**, sözün yerini vurğulamaq, yüngül cavabfeedback-i.
  320pxtelefonlarda çarx/giriş yan-yana;landscape-də lövhə/çarx yan-yana.
- v1savedlevel/currency/ulduz/xal irəliləyişi v2-yə daşınır;yarımçıqpuzzle
  originalv1dictionary ilə tamamlanır,növbətipuzzle v2-dir. Originalsave silinmir.

## Qəbul və paket

- **26 test**, **4806 səviyyə**, **13 productionbrowsercheck /14screenshot**,
  realpointer/touch, timedready/pause/win,hubreturn/reload/320–1440px/428iPhonesafearea
  və844×390landscape keçir. App/nodeTypeScript/ESLint/Googlebuild keçir.
- Isolatedrun: `native-20261008t184004-ed749c1c`,developmentrevision **48.1**.
  **521JS/CSSassets/17routing/21app languages**,AZv2gameworker,Googleactive
  offlineadmission/profile-certificate/push/HealthKit/AppleSignIn/widgetAppGroup keçir.
- Native68inputfile vəmain/widgetMach-Ocontent48.0baseline iləeyni təsdiqlənib.
  Ayrıclonearchive-dəyeniwebbundle/versionmetadata/imza/export hazırlanıb;
  coldnativecompile təkrarlanmayıb. Finalized48.0archive/paket və47Store4hash saxlanır.

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `azure-migration/releases/48.1/Anacan-48.1-iOS-Development.ipa` |51711082|`912bfffa8a8b40b488988a553dc94be01b1bdf4db2f94a83d5a7934e550f15b7`|

## Cihaz vəziyyəti və növbəti sınaq

48.0→48.1in-placeinstall vəcihazdakıversiya təsdiqlənib. Telefon kilidli olduğuna
görəauto-launch hələpending-dir;gameplayqəbulu da istifadəçinin sınağını gözləyir.
Telefonu açın → **Azərbaycan dili → Alətlər → Mini Oyunlar → Söz bağı**.

Yekun package/build: run`build-ios.json`; ilk install receipt-i:
`ops/ios-device-test-1791485427008.json`. Son launch cəhdi:
`ops/ios-device-test-1791486990987.json`, **`IOS_TEST_DEVICE_LOCKED`**.
`ops/word-garden-ios-test-48.1.json` və run`device-test-completion.json`
**installed:true / launched:false / passed:false** vəziyyətini saxlayır;
passed:false qalan launch qəbulunu göstərir, uğurlu install-ı rədd etmir.
Kilid açıldıqdan sonra candidate-scoped completion eyni48.1paket üçün yalnız
launch-u yenidən sınayır, installedversion48.1-i yoxlayır və5sprocess qəbulunu tamamlayır.

48.1sınaqnamizədidir. CommonStorepointer47/nextcommon48,qəbulolunmuşGoogle
authority və48.0finalizedtestworkspace saxlanır. Yeni düzəliş ayrıca izolə
developmentrevision-da edilir. [Oyun müqaviləsi](WORD_GARDEN.md).

## 2026-10-09 cihaz davamı

İstifadəçi əvvəl48.1-in telefonda olmasını,sonra **İki dost** oyununun əlavə
edilməsini istədi. Cihaz inventory-si48.1-i təsdiqlədi;istifadəçi **“Özüm açacağam”**
seçimini bildirdi. Ardınca Sözbağıv2 vəİkidostdaxil48.2quraşdırıldı:
[TWO_FRIENDS.md](TWO_FRIENDS.md),`ops/ios-device-test-1791521775778.json`,
previousVersion48.1/installedVersion48.2.48.1paket/workspace saxlanır;
automaticlaunchsuccess iddiası yoxdur,istifadəçi gameplayqəbulu gözlənilir.
