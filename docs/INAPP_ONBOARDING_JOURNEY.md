# Tətbiqdaxili onboarding: ilk açılış səyahəti (plan, 2026-11-05)

Qeydiyyat və funnel (suallar, "Planınız hazırdır", paywall: `docs/ONBOARDING_COMPACT.md`)
bitəndən sonra istifadəçi tətbiqi ilk dəfə tam açır. Bu sənəd həmin andan 7-ci günə qədər
nə göstərdiyimizi təsvir edir. İnteraktiv prototip: `docs/prototypes/inapp-onboarding.html`
(Ana / Hamilə / Dövr, light / dark).

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
