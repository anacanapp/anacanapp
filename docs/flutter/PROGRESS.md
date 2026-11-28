# Flutter keçidi: gedişat

Yenilənib: 2026-11-28. Budaq: `claude/blissful-sagan-lqhvv9`. Test sayları `app/` içində `flutter test` ilə alınıb.
Sahibin məlumatı (2026-11-28): Android Codemagic yığımında problem yoxdur; iOS-da cüzi problemlər var, sahib
yekun nəticəni sonra bildirəcək. Agent özü heç nəyi cihazda işlətməyib.

| İş | Vəziyyət | Yoxlama |
|---|---|---|
| Plan, uyğunluq cədvəli, servis spesifikasiyaları | hazır | `docs/flutter/*.md` |
| Körpü buraxılışı 53.0 (localStorage ixracı) | kod hazır, yığılmayıb | 12 vitest, tsc, `npm run build` |
| Codemagic: 53.0 versiyası, Flutter 60.0 workflow-ları | yazılıb, işə salınmayıb; RevenueCat və Google ID-ləri repodakı fayllardan oxunur | YAML və skriptlər lokal yoxlanıb |
| Dizayn sistemi (tokenlər, şriftlər, ikonlar, vidcetlər) | hazır | 65 test (`test/design`) |
| Nüvə: dil, məzmun paketləri, qəbul, sessiya, auth, keş, məlumat, saat qurşağı, app settings | hazır; native kanal kompilyasiya olunmayıb | 543 test (`test/core`) + 18 (`test/state`) |
| Hesablama məntiqi (`app/lib/domain`) | hazır | 375 test |
| Naviqasiya qabığı (sliver əsaslı scroll konteyneri) | hazır, tətbiq kökünə qoşulub | 453 test (`test/shell`) |
| Tətbiq kökü, bağlantılar (`app/lib/app`), deeplink, OAuth callback | hazır; cihazda yoxlanmayıb | 83 test (`test/app`) + 1 smoke |
| Giriş axını, onboarding, paywall/RevenueCat, ana ekranlar (flow, bump, mommy), stories, təqvim, profil, ayarlar, kilid, dəstək, hüquqi sənədlər | hazır, qeydiyyatdan keçib | 678 test (`test/features`) + 128 (`test/native`) |
| Oyun mühərrikləri (8 oyun) | hazır; UI yoxdur | `test/features/games` daxilində |
| Abunəliyim (Billing) + ləğv səbəbi dialoqu, anacan.az abunəliyi (`web-premium`) | hazır, qeydiyyatdan keçib; React istinad şəkli ilə hələ tutuşdurulmayıb | 20 test (`test/features/billing`) |
| Moderasiya tarixçəsi + şikayət, 25 dilli moderator mətnləri (generator `app/tool/moderation`) | hazır, qeydiyyatdan keçib | 7 test (`test/features/moderation`) |
| Recap (kətan renderi React-ın çəkmə əmrləri ilə ±0.002 eyni, şəkil paylaşımı, fontlar və musiqi faylı paketdə) | hazır; musiqi səsi və video ixracı 9-cu mərhələdə | 65 test (`test/features/recap`) |
| Alətlər mərkəzi (ToolsHub), alət dəsti (ToolKit), dinamik alət/konfiq/məzmun məlumatları | hazır; ayrı-ayrı alətlər dəstələrlə gedir | 52 test (`test/features/tools`) |
| Sağlamlıq/həyat tərzi alətləri: qidalanma (+ vitaminlər tabı), məşqlər, əhval, psixi sağlamlıq (EPDS), təzyiq, qan şəkəri, vitaminlər, ilk yardım (oflayn), reseptlər, alış-veriş, həkimlər | hazır | 70 test (`test/features/tools/*`) |
| Köhnə tətbiqdən yeniləmə: 87 ixrac qaydası + Preferences açarları yoxlandı; məxfilik razılığının bərpası; çıxış etmiş istifadəçinin məlumatları saxlanır; 53.0-ı atlayanlar üçün gizli WebView oxuması (Dart hazır, native kanal ayrıca commit-də) | Dart hazır; cihazda yeniləmə sınağı lazımdır (ssenari: `LEGACY_STORAGE.md`) | 25 yeni test (`test/app/legacy_upgrade_test.dart` və s.) |
| Mərhələ 9, Dart hissəsi B: analitika (daxili `analytics_events`, razılıq qapıları, ekran baxışları), Customer.io/TikTok/Facebook məntiqi, reklam təcrübəsi (tezlik, davamlılıq, demo reklam, səthlər, keçid reklamları), bannerlər + native reklam kartı + lid forması, ekran qoruması (popup-lar, dashboard) | Dart hazır; SDK-lar (google_mobile_ads, firebase_analytics və s.) native addımda | ~112 test (`test/services`, `test/features/banners`) |
| Mərhələ 9, Dart hissəsi A: deeplink 404 səhifəsi, push göndərmə + cihaz tokeni, bildiriş toxunuşları, mərkəzi yerli bildiriş planlayıcısı (bütün feature xatırlatmaları ona bağlı), su/vitamin/çat/peyvənd xatırlatmaları, icazələr | Dart hazır; OS plugin-ləri (firebase_messaging, flutter_local_notifications, permission_handler) native addımda | 115 test (`test/services`) |
| Oyunlar (mərhələ 8): mini oyunlar mərkəzi, reytinq, Word Garden, İki Dost, Leaf Flight, Clear the Way, Sağlam Səbət, Birləşdir, Color Sort, casual, Qabarcıq; köhnə tətbiqin saxlanmış irəliləyişi oxunur | hazır; reklam və səs 9-cu mərhələdə; landşaft/çox qısa ekran CSS variantları qismən | `test/features/games` |
| Sağlamlıq ekranları: xəstəlik jurnalı (+ ana ekran kartları, temperatur qrafiki), doğuşdan sonra bərpa + Kegel, hamiləlik itkisi (ev, bələdçi, əlamətlər, xatirələr), profil hamiləlik kartı, həkim hesabatı (məlumat hazır, PDF 9-cu mərhələdə) | hazır | 98 test, 3 skip (`test/features/health_screens`, `recovery`) |
| Proqramlar: yuxu təlimi (+ növbəti yuxu), süddən ayırma (+ ana ekran kartları, AI kartı), Tərbiyə (25 dil məzmun, axtarış, paylaşım, partnyor ekranı, ana ekran kartı) | hazır; xatırlatmalar 9-cu mərhələdə | 294 test (`test/features/tools/sleep_training`, `weaning`, `parenting`) |
| Qalan alətlər: ikinci əl bazarı (+ inbox, təhlükəsizlik), analar üçün məkanlar (React-da da xəritəsiz siyahı), ağıllı oyun qutusu, birlikdə oyun, uşaq məşqləri (141 şəkil), affiliate | hazır | 161 test (`test/features/tools/*`) |
| AI/media alətləri: fotosessiya, ağlama tərcüməçisi, nəcis skaneri, nağıl, ulduz falı, hava/geyim, ağ səs, səs-küy ölçən | hazır; səs/mikrofon/yer 9-cu mərhələdə | 103 test (`test/features/tools/*`) |
| Hamiləlik alətləri: təhlükəsizlik, təpik, sancı (5-1-1), çəki, xəstəxana çantası, adlar, dekret, döl inkişafı, təhlükə əlamətləri, albom | hazır; partnyor bildirişləri və SOS 6-cı, Health 9-cu mərhələdə | 78 test (`test/features/tools/*`) |
| Körpə alətləri: izləyici (+ böyümə, diş bölmələri, nailiyyətlər), peyvənd təqvimi, əlavə qida, vaxtından əvvəl doğulanlar, körpə albomu | hazır; peyvənd xatırlatmaları 9-cu mərhələdə | 108 test (`test/features/tools/*`) |
| Partnyor nüvəsi: ana ekran + kartlar (missiyalar, doğuş rejimi, doğuşdan sonra, fəaliyyət), "Birlikdə", qoşulma, tur, səviyyə artımı, SOS + xəbərdarlıq qəbuledicisi, qayğı kartı, gündəlik xülasə sinxronu, partnyor bildirişləri | hazır; 16 partnyor ekranı ayrıca gedir | 59 test (`test/features/partner`) |
| Ticarət: Aptek (mağaza, səbət, sifariş, axtarışda məhsullar), tortlar (yalnız Epoint kartı), Epoint ödənişi + nəticə səhifələri, QayğıCash (pul kisəsi, profil kartı, Premium seçimi), partnyor mağazaları, partnyorlar + endirim QR-ı, promo, sponsor | hazır; ödənişlər cihazda/sandbox-da yoxlanmayıb | 157 test (`test/features/commerce`) |
| Bloq (siyahı, məqalə, şərhlər, redaksiya bölmələri, modul məqalələri, link host), kitablar (mağaza + ana ekran kartı/karuseli), albom sifarişi | hazır; admin Mağaza vebdə qalır | 58 test (`test/features/blog`, `books`, `album_order`) |
| Partnyor ekranları (16): ad səsverməsi, xəstəxana çantası, xülasə, alış-veriş, qəbullar, körpənin günü, həftəlik statistika, sürprizlər, tərbiyə, xəstəxanaya qaçış, canlı sancılar, paylaşım, gecə növbəsi, doğuş planı, doğuşdan sonra, itki dəstəyi | hazır | 52 yeni test (`test/features/partner/screens`) |
| İcma stories (zolaq, baxış, redaktor, profil tabı, paylaşım) və qruplar (panel, qrup söhbəti, iştirak) | hazır; story reklamları 9-cu mərhələdə | 42 test (`test/features/community_stories`, `groups`) |
| İcma: tab, lent (filtr, axtarış, görülmə), post kartı, şərhlər, tək post, post yaratma (bloq əlavəsi), istifadəçi profili (izləmə), moderator menyusu, bloklama, moderator nəzarəti (tam blok, xəbərdarlıq) | hazır; stories və qruplar ayrıca gedir | 122 test (`test/features/community`) |
| Mesajlar, partnyor söhbəti, söhbət ekranı (media, səsli mesaj oxuma), stikerlər, DM | hazır; səs yazma 9-cu mərhələdə (`record`) | 88 test (`test/features/chat`) |
| AI tabı (qadın + partnyor, `dr-anacan-chat` axını, Dayandır), AI razılıq qapısı, körpə söhbəti + ana ekran kartı | hazır; canlı axın yalnız saxta HTTP ilə yoxlanıb | 93 test (`test/features/ai_chat`, `baby_chat`) |
| İlk açılış pəncərələri (kilid təklifi, kilid quraşdırma, avtomatik rəy) turu gözlədir | hazır | 1 test (`test/state`) |
| Alətlər, icma, çat/AI, partnyor, ticarət, bloq, oyun UI, native tamamlama | başlanmayıb | qalan interfeyslər: `docs/flutter/WIRING.md` |
| İstinad ekran şəkilləri | hazır | `docs/flutter/REFERENCE_SHOTS.md` |

Cəmi (2026-11-27, Windows, Recap qovluğu xaric): `flutter test` 2 372 keçdi, 17 skip, 0 uğursuz; `flutter analyze` 0 problem.

Golden-lər Linux-da çəkilib. `app/test/flutter_test_config.dart` Linux-dan başqa hostlarda (Codemagic `mac_mini_m2`, Windows)
piksel fərqini xəbərdarlıq kimi çap edir, testi yıxmır; render xətaları yenə yıxır. Ciddi yoxlama: Linux və ya
`ANACAN_STRICT_GOLDENS=1`. Bu olmasaydı, Codemagic-də `flutter test` 138 golden-də düşəcəkdi.
Bu sessiyada Windows-da yaradılan yeni golden-lər (`test/features/ai_chat/goldens`, `test/features/baby_chat/goldens`
və sonrakı alt-agentlərinkilər) Linux-da `--update-goldens` ilə yenidən çəkilməlidir.

## Qəbul olunmuş qərarlar (2026-11-27)

- `analyze-cry` m4a/Ogg da qəbul edir (backend dəyişikliyi; sahib 2026-11-28 deploy etdi; köhnə tətbiqlər dəyişmədən WebM göndərir).
- Switzer şriftinin lisenziyası sahib tərəfindən təsdiqlənib (2026-11-28); Recap şriftləri `app/assets/fonts/recap/`-da qalır.
- Oxunmamış mesaj nişanı inbox-dakı bütün qrupları sayır.

## Açıq qərarlar (cavab gələnə qədər mötərizədəki variant)

1. İcma postlarında moderator menyusu tətbiqdə qalsın? (qalır)
2. Yalnız adminə görünən Mağaza ekranı köçürülsün? (yox, vebə keçir)
3. `/h/:kod` və `/p/v/:token` səhifələri tətbiqdə olsun? (vebdə qalır)

## Texniki borc (düzəldilməlidir)

- iOS: Codemagic-də kompilyasiya olunub, imzalanıb və yüklənib; ilk build Apple emalında qəbul olunmamışdı, icazə
  mətnləri, privacy manifest və entitlements əlavə edildi (`app/tool/ios/apply_ios_parity.mjs`). Sahib 2026-11-28
  "cüzi problemlər" bildirdi, təfsilat gözlənilir. Android yığımı sahibə görə problemsizdir.
- Səs/mikrofon/yer paketləri (`just_audio`, `record`, `geolocator`, `gal`) hələ yoxdur: ağ səs, ağlama tərcüməçisi,
  səs-küy ölçən, hava, səsli mesaj yazma "dəstəklənmir" yolu ilə işləyir (WIRING.md, 9-cu mərhələ).
- Golden-lərdə kölgə yoxdur: flutter_test kölgələri bulanıqlıqsız çəkir (Billing geri düyməsinin "itən" kölgəsi də
  budur, tətbiq qüsuru deyil). Yeni paritet golden-ləri bunu söndürür; ortaq harness-lərdə də açmaq (Linux-da yenidən
  çəkməklə) təklif olunur.
- Telefon mətn sahələri: React telefonlarda bütün input-ları ən azı 16 px edir; Flutter-də yalnız alətlər və bloq
  axtarışı düzəldilib, qalanları 13 px — dizayn səviyyəsində köməkçi lazımdır.
- Flutter sətir hündürlüyünü tam piksələ yuvarlaqlaşdırır (19.5 → 20): uzun siyahılar sətir başına ~1 px sürüşür
  (ayarlar ekranının 5-ci bölməsində ~11 px). `inline-flex` paraqraflarında bir neçə px aralıq fərqi ola bilər.
- `settings_ui.dart`-da (`ShadSwitch`, `AIconBtn`) kölgə blur-u CSS-dən 1:1 köçürülüb, tokenlərdən fərqli — bir az yumşaq.
- 2026-11-28 vizual müqayisə (12 ekran, React istinad şəkilləri ilə): 10 real fərq düzəldildi (ana ekran 6 px sürüşmə,
  təqvim sətirləri, məqalə kartı eni, alətlər başlıqları və axtarış ölçüsü, icma başlıq düymələri və boşluq, AI mesaj
  qutusu 2 sətir, bloq axtarışı). Yeni/yenilənmiş golden-lər Windows-da çəkilib, Linux-da yenidən çəkilməlidir.
- Golden testlərdə emoji şrifti yoxdur (qutu kimi görünür).
