# Free Trial-ın bağlanması və illik qiymət — 2026-09-22

38.0 üçün son tətbiq müqaviləsi: adi illik **$29.99**, ilk il endirimlə **$19.99**,
sonra **$29.99/il**. İllikdən çıxışda aylıq kofe təklifi göstərilir; trial yoxdur.
[Mağaza/RevenueCat quraşdırmasının tam addımları](ONBOARDING_STORE_OFFER.md).

## Anacan-da faktiki quruluş

- Native tətbiq RevenueCat **`pricing_2026`** offering-ini seçir.
- Entitlement: **`Anacan LLC Pro`**.
- Aylıq məhsul `com.atlasoon.anacan.premium.monthly`, Google base plan `monthly-plan`.
- İllik məhsul `com.atlasoon.anacan.premium.yearly`, Google base plan `yearly-plan`.
- Native qiymət mağazadan gələn Product/SubscriptionOption-dan oxunur. 38.0 Android
  alışda paid base plan/explicit paid offer seçir; free-trial default seçimi çıxarılıb.
- 38.0 təqdimatında `free_trial_enabled=false`, köhnə trial mətnləri göstərilmir.
  Bu kod siyasəti App Store/Google Play konsolundakı offer-ləri özü silmir.
- `premium_onboarding_enabled` onboarding/funnel görünüşünü idarə edir, aktiv
  abunəliyi və onun son tarixini dəyişmir. Yeni xarakterli axın [38.0 qeydi](ONBOARDING_38.md)-dədir.

## Yeni istifadəçilər üçün trial-ı bağlamaq

### App Store Connect

**Apps → Anacan → Subscriptions → abunə qrupu → illik məhsul → Subscription Prices →
View all Subscription Pricing → Introductory Offers**.

Aktiv Free Trial introductory offer-i bütün tətbiq olunan ölkə/regionlarda silin
və gələcəyə planlanmış trial varsa onu da nəzərdən keçirin. Silinən obyekt trial
təklifidir; əsas illik subscription məhsulu satışda qalmalıdır.

### Google Play Console

**Anacan → Monetize with Play → Products → Subscriptions → illik məhsul →
Base plans and offers → `yearly-plan` → trial offer → Deactivate**.

İllik base plan aktiv qalır. Offer-in söndürülməsi onu yeni alışlar üçün bağlayır;
mövcud abunəliklərin davamını dayandırmır.

### RevenueCat və tətbiq mətnləri

RevenueCat-da eyni aylıq/illik məhsul və entitlement mapping-i saxlanılır. Paywall-da
statik “3 gün pulsuz” / “Pulsuz başla” mətni varsa, trialsız mətnə dəyişdirilir.
Native qiymətin/offer-in mağazadan yenilənməsi və varsa RevenueCat paywall conditional
visibility-si yoxlanmalıdır. Veb təqdimat üçün `premium_paywall_config` daxilində
`free_trial_enabled=false` qoyulur.

## Artıq trial almış istifadəçilərə nə olur?

**Təklifi yeni alışlar üçün bağlamaq mövcud trial-ı geriyə dönük silmir.**

- Başlamış trial razılaşdırılmış müddət və mağazanın entitlement son tarixinə görə davam edir.
- İstifadəçi abunəliyi ləğv etməzsə, trial bitəndə auto-renewing ödəniş mərhələsinə keçir.
- İstifadəçi ləğv edibsə, növbəti ödəniş tutulmur; tətbiq faktiki mağaza/RevenueCat
  expiry statusuna əməl edir. Offer-i deaktiv etmək istifadəçinin abunəliyini ayrıca
  cancel/revoke etmək ilə eyni əməliyyat deyil.
- Anacan `active` və müddəti bitməmiş `cancelled` hüququ Premium sayır. Aktiv trial
  da Premium entitlement verir; sınaq/abunəlik bitəndə badge və funksiyalar faktiki
  entitlement-ə uyğun yenilənir.

## İllik qiyməti endirəndə

- **Apple:** eyni auto-renewable məhsulun qiymət endirimi mövcud abunəçilərin növbəti
  uyğun yenilənməsində aşağı qiymətə tətbiq olunur; köhnə yüksək qiyməti qorumaq seçimi yoxdur.
- **Google Play:** base-plan qiymətini dəyişəndə köhnə abunəçilər legacy price
  cohort-da qala bilər. Onlara da endirim tətbiq etmək üçün **legacy pricing**-i
  yeni base-plan qiymətinə keçirmək lazımdır. Aşağı qiymətə keçid istifadəçi razılığı
  tələb etmir; növbəti uyğun renewal-da tətbiq olunur. Əvvəldən avtorizasiya edilmiş
  yaxın ödənişlərdə keçid sonrakı renewal-a qala bilər.
- Satın alınmış trial/intro offer mərhələsinin müddəti və qiyməti geriyə dönük
  dəyişdirilmir. Dəqiq ilk ödəniş qiyməti istifadəçinin mağazada göstərilən renewal
  məlumatından yoxlanmalıdır.
- Təkcə RevenueCat offering adını dəyişmək mövcud abonentin qiymətini və trial-ını
  dəyişdirmir. Eyni product-u satan köhnə build-lər də mağaza qiyməti/offer dəyişikliyini
  görə bilər; offering ID-si köhnə qiyməti qoruyan mexanizm deyil.

Yeni USD məbləğləri 38.0 taskında verilib. Mağaza qiymətlərinin/offer-lərin aktivlik
tarixini konsolda təyin etmək və yeni məhsulları RevenueCat-a bağlamaq tələb olunur.
Mövcud abunəçi hüquqları geriyə dönük dəyişdirilməyib.

## Rəsmi mənbələr

- [Apple: introductory offer yaratmaq/silmək](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/)
- [Apple: subscription qiymətlərini dəyişmək](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions/)
- [Google: subscriptions, offer statusları və legacy pricing](https://support.google.com/googleplay/android-developer/answer/12154973?hl=en)
