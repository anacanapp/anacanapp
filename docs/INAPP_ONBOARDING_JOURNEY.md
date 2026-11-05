# Tətbiqdaxili onboarding: ilk açılış səyahəti (plan, 2026-11-05)

Qeydiyyat və funnel (suallar, "Planınız hazırdır", paywall: `docs/ONBOARDING_COMPACT.md`)
bitəndən sonra istifadəçi tətbiqi ilk dəfə tam açır. Bu sənəd həmin andan 7-ci günə qədər
nə göstərdiyimizi təsvir edir. İnteraktiv prototip: `docs/prototypes/inapp-onboarding.html`
(Ana / Hamilə / Dövr, light / dark).

## v3 (2026-11-05): bələdçi turu real ekranlarda
Prototip: `docs/prototypes/inapp-onboarding-v3.html`. Stillər: **Glass** (şüşə panellər, canlı
fon, light/dark), **Sakit** (ağ kart, oxla hədəfə işarə), **Cəsur** (coral alt panel),
**AI Bələdçi** (Anacan AI avatarı danışır).
- Tur istifadəçini həqiqətən aparır. Tab düyməsi işıqlanır, toxunuş animasiyası göstərilir,
  istifadəçi basanda ekran açılır. Alətdən danışanda həmin alətin səhifəsi açılır və
  "📍 Siz buradasınız: Alətlər › Mental sağlamlıq" göstərilir.
- Əsas addımlar 5 / 4 qalır. Hər addımın içində 2-4 kiçik keçid var (mini nöqtələr).
  Hər keçid bir toxunuşdur, "Turu bağla" hər zaman görünür.
- İlk qeyd alətin öz səhifəsində edilir (ana ekran düyməsi → alət). Bildiriş sorğusu nəticə
  kartının içindədir və v2 qaydalarına tabedir.
- Alətlər addımında ilk qeyd alətindən sonra 2 əlavə **açıq** alət açılır (təkrar yoxdur).
  Free istifadəçinin kilidli alətləri ayrıca "Premium" bölməsində solğun görünür,
  amma işıqlandırılmır və onlardan danışılmır.
- Tətbiqdə hədəflər `data-tour="..."` atributu ilə işarələnir: `tab-tools`, `tab-ai`,
  `tab-community`, `q-<alət>`, `tools-free`, `tool-hero`, `log`, `ai-chips`, `com-feed`.

## v2 (2026-11-05): addım sayı, yeni axın və məntiq qaydaları
Prototip v2: `docs/prototypes/inapp-onboarding-v2.html`. 5 dizayn variantı var: A Vərəq,
B Hekayə, C Spotlight, D Söhbət (Anacan AI bələdçi kimi), E Mərkəz (plitələr, öz tempi ilə).
Hamısı eyni məzmun və eyni məntiq ilə işləyir.

### Neçə addım (araşdırma)
- Chameleon (15 mln tur qarşılıqlı əlaqəsi): 3 addımlı turlar ən yüksək tamamlanır (~66%).
  4-cü addımdan sonra diqqət kəskin düşür; 5-ci addım tamamlanmanı təxminən yarıya endirir.
- Produktly 2026 (256 tur): 3-5 addım median 38%, 6-8 addım 25%. Avtomatik açılan
  turlar daha az tamamlanır (23%), istifadəçinin özü başlatdığı turlar daha çox.
- Intercom: 5 addımlı turlar median ~34%.
- Mobil onboarding üçün tövsiyə olunan aralıq 3-7 ekrandır, çox tətbiq 4-5-də dayanır.
  Bu rəqəmlər vendor məlumatlarıdır; dəqiq sayı öz A/B testimiz təsdiqləyəcək.
- **Qərar:** əsas tur **Premium üçün 4, Free üçün 5 addım**. Hər addım bir mövzudur, keçmək
  olar, irəliləmə göstərilir. Qalan hər şey Başlanğıc siyahısına və kontekstual ipuçlarına keçir.
  Bildiriş sorğusu ayrıca addım deyil: ilk qeydin nəticə ekranının içindədir.

### Axın
| # | Addım | Free | Premium |
|---|-------|------|---------|
| 1 | Xoş gəldin (ad, plan, 3 fayda) | ✓ | ✓ |
| 2 | İlk qeyd (+ bildiriş, yalnız şərt ödənirsə) | pulsuz funksiya: əhval (ana, hamilə), dövr qeydi | Premium aləti: qidalanma, təpik |
| 3 | Alətlər | yalnız **pulsuz və uyğun** alətlər, kilidli alət göstərilmir | mərhələnin ən faydalı alətləri |
| 4 | Anacan AI + İcma | AI: gündə N pulsuz sual (`app_settings.free_limits`) | AI limitsiz |
| 5 | Premium üstünlükləri | ✓ (qiymətsiz, "Pulsuz davam et" düyməsi ilə) | göstərilmir |

### Məntiq qaydaları (heç bir şərt pozulmamalıdır)
- **Bildiriş:** `FirebaseMessaging.checkPermissions()`.
  - `granted`: heç bir sorğu yoxdur.
  - `denied`: sorğu yoxdur, çünki sistem yenidən soruşmur. Siyahıya "Ayarlardan aç" bəndi düşür.
  - `prompt` və ya `prompt-with-rationale`: əvvəl öz yumşaq kartımız göstərilir, "Bəli" deyəndə sistem pəncərəsi açılır.
  - "İndi yox": bu sessiyada yenidən soruşulmur; 3 gün sonra kontekstdə 1 dəfə soruşulur.
  - Funnel-də (`OnboardingJourney` → `notifications`) artıq soruşulubsa, nəticəyə həmin vəziyyət qərar verir.
- **Mövcud kodla toqquşma:** `useDeviceToken` hər gün 1 dəfə özü icazə istəyir. Onboarding
  aktiv olan sessiyada bu avtomatik sorğu dayandırılmalıdır (vahid "permission coordinator"),
  əks halda istifadəçi eyni gündə iki sorğu görər.
- **Premium:** `useSubscription().isPremium` yüklənib qurtarmadan tur başlamır (yanlış addım
  sayı olmasın). Tur zamanı alış olsa, Premium addımı çıxarılır.
- **Alətlər (Free):** siyahı `freemium.ts` `isToolFree` ilə qurulur və mərhələ/region filtrindən
  keçir: Tortlar yalnız `isCakesAvailable` (AZ ölkə + dil), PDF kitablar yalnız `az` dili,
  dövr rejimində körpə alətləri yoxdur. Kilidli alət heç vaxt "sizdə var" kimi göstərilmir.
- **İlk qeyd:** Free istifadəçidə paywall açan funksiya seçilmir (əhval, mental sağlamlıq,
  dövr təqvimi pulsuzdur). Premium üçün izləmə aləti seçilir.
- **Partnyor:** Premium funksiyasıdır. Free siyahısına salınmır, Premium üstünlüklərində göstərilir.
- **AI limiti:** mətn serverdəki `free_limits.ai_chat_count_per_day` dəyərindən gəlir, kodda sabit yazılmır.
- **Kimə göstərilmir:** partnyor rolu, loss mode, artıq tamamlamış və ya keçmiş istifadəçi
  (serverdə `onboarding_journey`), funksiyadan əvvəl qeydiyyatdan keçənlər.
- **Təkrar və cihazlar:** irəliləmə hesabda saxlanılır; başqa cihazda və ya yenidən qurduqda təkrar olunmur.

## Məqsəd və ölçü
- **Aktivləşmə:** ilk 24 saatda ən azı 1 qeyd (qidalanma, yuxu, təpik, əhval, period).
- **Bildiriş icazəsi:** dəyər göründükdən sonra soruşulur; hədəf ≥ 55% razılıq.
- **D1 / D7 qayıdış**, başlanğıc siyahısının tamamlanma faizi, partnyor dəvəti faizi.
- Premium: onboarding Premium satmır (funnel artıq paywall göstərib). 3-5-ci gündə
  istifadə olunan funksiyaya bağlı yumşaq təklif.

## Yormamaq qaydaları
1. İlk sessiyada ən çox **3 ipucu**, **1 əsas hərəkət**, **1 icazə sorğusu**.
2. Hər ekranda **"Keç" / "Sonra"** var; keçən istifadəçi siyahı kartından davam edə bilər.
3. Mətn: başlıq 1 sətir, izah ən çox 2 sətir. İzah yox, fayda yazılır.
4. Bir anda bir ipucu. İki ipucu ardıcıl açılmır (spotlight 1/2 → 2/2 istisna).
5. Funnel cavabları təkrar soruşulmur. Ad, körpənin adı, həftə və mərhələ artıq məlumdur.
6. Sistem icazə pəncərəsi (bildiriş, sağlamlıq) heç vaxt birinci ekranda açılmır.
   Əvvəl tətbiqin öz izah kartı, sonra sistem pəncərəsi.

## İlk sessiya (≈ 40 saniyə)
| # | An | Nə göstərilir | Niyə |
|---|----|---------------|------|
| 1 | Xoş gəldin vərəqi | Ad + "Planın hazırdır" + 3 fərdi fayda. "30 saniyəlik tanışlıq" / "Sonra" | "Sizi eşitdik" hissi |
| 2 | Spotlight: ana kart | Kart nə göstərir, nə vaxt yenilənir (1/2) | Sabah qayıtmaq üçün səbəb |
| 3 | Spotlight: sürətli qeyd | Bir toxunuşla qeyd (2/2), "İndi sınayım" | "Aha" anına aparır |
| 4 | İlk hərəkət | 3 böyük seçimli vərəq (məs. Sol döş / Sağ döş / Butulka) | Aktivləşmə |
| 5 | Təbrik + icazə | Nəticə (növbəti qidalanma ~15:10) və "Xatırladaq?" | İcazə dəyərdən sonra |
| 6 | Ana ekran | "Başlanğıc" siyahısı kartı (2/5 tamam) | Qalanı könüllüdür |

### Mərhələyə görə məzmun
- **Ana (`mommy`):** ana kart = körpənin yaşı və həftənin inkişafı. İlk hərəkət = qidalanma
  qeydi. Siyahı: partnyor, Anacan AI, vidcet.
- **Hamilə (`bump`):** ana kart = həftə, körpənin ölçüsü. İlk hərəkət = bu günkü vəziyyət
  (və ya təpik sayğacı ≥ 24-cü həftə). Siyahı: partnyor, xəstəxana çantası, Anacan AI.
- **Dövr (`flow`):** ana kart = dövrün günü, növbəti period. İlk hərəkət = əhval / simptom.
  Siyahı: son period tarixi, Anacan AI, vidcet. Bildiriş mətni məxfi (kilid ekranında yalnız "Anacan").

## Başlanğıc siyahısı (ana ekran kartı)
- 5 element, ilk ikisi artıq tamamdır (irəliləmə effekti). Hər element 1 toxunuşla açılır.
- Bağlana bilir (×). Bağlananda Profil → "Başlanğıc bələdçisi"ndən geri açılır.
- Hamısı tamamlananda "Hər şey hazırdır" göstərilir, 1 gün sonra kart özü gizlənir.
- 7 gün sonra tamamlanmayıbsa kart avtomatik gizlənir (yorğunluq olmasın).

## Kontekstual ipuçları (lazım olan anda)
- Hər bölmənin ilk açılışında bir dəfə 1 cümlə: Alətlər, Anacan AI (nümunə suallar),
  İcma (qaydalar), Bloq, Partnyor. Göstərilən ipucu bir daha çıxmır.
- Funksiyanın özü ilk istifadədə öyrədir (məs. AI-da 3 hazır sual düyməsi).

## 1-7-ci günlər
| Gün | Kanal | Məzmun |
|-----|-------|--------|
| 1 axşam | push (icazə varsa) | Günün xülasəsi (6 qidalanma, 14 saat yuxu) |
| 2 | in-app kart | Həftəlik ritm / proqnoz hazır |
| 3 | in-app | Bildiriş icazəsi rədd edilibsə kontekstdə yenidən (1 dəfə) |
| 3 | push | Partnyor dəvəti: "Birgə izləyin" |
| 4-5 | in-app | Ən çox istifadə olunan funksiyaya bağlı Premium faydası (banner, Free üçün) |
| 7 | push | Həftənin xülasəsi + siyahının qalanı |
Gündə ən çox 1 onboarding bildirişi; sakit saatlar 22:00-08:00 (körpə qidalanması xatırlatmaları istisna).

## İstisnalar
- **Loss mode:** körpə mərkəzli səyahət göstərilmir; yalnız bərpa bölməsinin öz qarşılaması.
- **Partnyor rolu:** öz turu var (`PartnerOnboardingTour`), bu səyahət göstərilmir.
- **Qayıdan / yenidən quran istifadəçi:** irəliləmə serverdə saxlanılır, təkrar göstərilmir.
  Köhnə istifadəçilər (bu funksiyadan əvvəl qeydiyyat) avtomatik "tamamlanmış" sayılır.
- Bildiriş icazəsi artıq verilibsə 5-ci addım yalnız təbrikdən ibarətdir.

## Texniki plan
- `app_settings.inapp_onboarding_enabled` (söndür/yandır, A/B üçün faiz).
- İrəliləmə: `profiles.onboarding_journey jsonb` (`version`, `steps_done`, `checklist`,
  `tips_seen`, `dismissed_at`). Yeni sütun CDC/writer guard ilə; cihazlar arası sinxron.
- Komponentlər: `OnboardingWelcomeSheet`, `Spotlight` (hədəf `data-tour="..."` atributu ilə),
  `QuickFirstLogSheet` (mövcud qeyd hook-larını işlədir), `StarterChecklistCard`,
  `useContextualTip(id)`.
- Analitika hadisələri: `ob_welcome_shown`, `ob_tour_step`, `ob_skip`, `ob_first_log`,
  `ob_notif_soft_yes/no`, `ob_checklist_item`, `ob_checklist_dismiss`, `ob_tip_shown`.
- Mətnlər 23 dildə (`docs/LOCALIZATION_23.md`), RTL (ar) yoxlaması, `prefers-reduced-motion`.
- Native: bildiriş icazəsi Capacitor Push/Local Notifications ilə; vidcet addımı yalnız
  native-də, vebdə gizlidir.
