# Yığcam onboarding və paywall — 2026-10-01

## Tələb və məzmun

Eyni cari tətbiqdə üç modulun dörd səhifəsi yenilənir. Sıra istifadəçinin
istədiyi kimidir; hər Premium/coffee səhifəsində beş imkan göstərilir.

| Modul | Planınız hazırdır | Kiçik addımlar | Premium / Bir fincan |
| --- | --- | --- | --- |
| Ana (`mommy`) | 5 | 9 | 5 / 5 |
| Hamilə (`bump`) | 5 | 8 | 5 / 5 |
| Period (`flow`) | 5 | 8 | 5 / 5 |

### Ana

- Plan: Yuxu rejimi izləmə; Qidalanma izləmə; İnkişaf mərhələləri;
  Ağlama analizi; Hava və geyim.
- Kiçik addımlar: Anacan AI; Həkim PDF; Partnyor hesabı; Bəyaz səslər və
  ağıllı nağıllar; Peyvənd təqvimi; Sağlam reseptlər; Diş çıxarma izləyicisi;
  Mental sağlamlıq və məşqlər; Reklamsız təcrübə.
- Premium və Bir fincan: Anacan AI; Həkim PDF; Partnyor hesabı;
  Mental sağlamlıq və məşqlər; Reklamsız təcrübə.

### Hamilə

- Plan: Fetal böyümə izləyici; Qidalanmaya nəzarət; Təhlükəsizlik sorğusu;
  Təpik və sancı ölçən; Çəki, qan təzyiqi və şəkəri izləyicisi.
- Kiçik addımlar: Anacan AI; Həkim PDF; Partnyor hesabı; Sağlam reseptlər;
  Xəstəxana çantası və ortaq alış-veriş; Hamiləlik albomu, vitamin izləyici;
  Mental sağlamlıq və idman; Reklamsız təcrübə.
- Premium və Bir fincan: Anacan AI; Həkim PDF; Partnyor hesabı;
  Mental sağlamlıq və idman; Reklamsız təcrübə.

### Period

- Plan: Əhval gündəliyi; Qidalanmaya nəzarət; Vitamin izləyicisi;
  Sağlam reseptlər; Mental sağlamlıq və idman.
- Kiçik addımlar: Anacan AI; Həkim PDF; Partnyor hesabı; Sağlam reseptlər;
  Qidalanmaya nəzarət; Vitamin izləyicisi; Mental sağlamlıq və idman;
  Reklamsız təcrübə.
- Premium və Bir fincan: Anacan AI; Həkim PDF; Partnyor hesabı;
  Mental sağlamlıq və idman; Reklamsız təcrübə.

## UI və davranış

- Kiçik xarakter şəkli başlığın yanındadır; listlər vahid, oxunaqlı kompakt
  checklist-dir. Plan xülasəsində modul/tarix/körpə sayı saxlanır, sual cavablarının
  əlavə pill-ləri göstərilmir; saxlanmış cavablar və tövsiyə hesablaması qüvvədədir.
- İllik və aylıq planlar uyğun ekranlarda yanaşı,320px kimi dar ekranlarda
  alt-alta göstərilir. Coffee qiyməti bir əsas sətirdədir.
- Boş paywall footer-i çıxarılıb, safe-area və daxili scroll qorunur. Əsas
  hərəkət/restore/legal düymələri ən az44px hündürlükdə qalır.
- Coffee/free/success mərhələsində progress yenidən1-ə qayıtmır.
- Onboarding schema v3 və Source profil/uşaq/seçim yazıları dəyişmir.
- Real mağaza qiyməti/intro eligibility, aylıq və illik məhsul, cancellation,
  restore, pending activation və bir dəfə göstərilən aylıq offer müqaviləsi
  saxlanır. Ödəniş/yenilənmə/məxfilik/istifadə şərtləri açıqdır.
-24 feature açarı21 dildə birbaşa bundle-dadır. Köhnə `onboarding.premium_*`
  remote cache-i yeni siyahıları əvəz etmir. Əvvəlki21-dil seed manifesti dəyişmir.

## Yoxlama və yayım sübutları

Yollar repo kökünə nisbidir. Ops receipt-ləri ignored local tooling-də saxlanır;
yalnız `passed:true` / təsdiqlənmiş yayım və cleanup nəticəsi qəbul sayılır.

- `azure-migration/ops/onboarding-compact-focused-tests.json`:73 əlaqəli test.
- `azure-migration/ops/onboarding-compact-app-tests.json`:1230 test /219 suite.
- `azure-migration/ops/onboarding-compact-progress-tests.json`: son progress
  düzəlişi daxil olmaqla onboarding/purchase regressiyası.
- `azure-migration/ops/onboarding-compact-browser.json`:294 brauzer ssenarisi,
  21 dil,12 modul/səhifə kombinasiyası,320×568 dar ekran, RTL, dark mode,
  uzun ad, web/pending vəziyyətləri. Burada Auth/Store yalnız lokal fixture-dir;
  real alış və fiziki cihaz qəbulu deyil.
- `azure-migration/ops/onboarding-compact-lovable.json`: reviewed delta,
  tam application manifesti, müstəqil remote hash və publication qəbulu.
- `azure-migration/ops/onboarding-compact-delivery.json`: yekun gateway image/
  revision, Lovable commit və real backend brauzer qəbul receipt-lərinə istinad.
- Real Source yayımı üçün `verify-communications.mjs source
  --onboarding-source-deployed`, `ANACAN_ONBOARDING_COMPACT=1` ilə actual yeni
  listlər, hesab/uşaq/seçim persistence və tamamlanmadan sonrakı reload yoxlanır.
  Yalnız owned fixture hesabları yaradılır və təsdiqlənmiş cleanup edilir.

Cari web hədəfləri `https://api.anacan.az` və `https://app.anacan.az`-dır.
Database/Auth Source-da, admission source/generation0 qalır. Brend portalının
ayrı sessiyası və21-dilli copy istisnası qorunur. Source Auth Hook binding-i və
RevenueCat v2 metrics icazəsi əvvəlki operator asılılıqlarıdır.

Lovable-un qayda faylı ölçü həddinə uyğun olaraq `AGENTS.md` yığcamdır; bütün
əvvəlki davamlılıq qaydaları dəyişmədən `docs/WORKTREE_HISTORY.md`-də saxlanır.
Sinxronlaşdırma manifesti Git tərəfindən nəzərə alınan tətbiq mənbələrini izləyir.
Əvvəlki manifestin481 ignored log/aralıq tərcümə/IDE/generated-native və private
operator/signing girişi təkrar ixrac edilmir; lokal fayllar yerində saxlanır.
Tətbiq kodu, yekun21-dil lüğətləri və real native mənbələr manifestdə qalır.

Bu kod/web yeniliyi `azure-migration/releases/43.0/` artifact-larını və
finalized development43/Store43/Store39 workspace-lərini yenidən yazmır.
