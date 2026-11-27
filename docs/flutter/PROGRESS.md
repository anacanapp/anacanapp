# Flutter keçidi: gedişat

Yenilənib: 2026-11-27. Budaq: `claude/blissful-sagan-lqhvv9`. Test sayları `app/` içində `flutter test` ilə alınıb.
Heç nə cihazda işlədilməyib və heç bir Codemagic yığımı aparılmayıb.

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

## Açıq qərarlar (cavab gələnə qədər mötərizədəki variant)

1. İcma postlarında moderator menyusu tətbiqdə qalsın? (qalır)
2. Yalnız adminə görünən Mağaza ekranı köçürülsün? (yox, vebə keçir)
3. `/h/:kod` və `/p/v/:token` səhifələri tətbiqdə olsun? (vebdə qalır)

## Texniki borc (düzəldilməlidir)

- Ana ekranın qalan slotları (oxunmamış sayı, bloq, banner, reklam, partnyor, kitab, Aptek) öz feature-ləri gələnə qədər boşdur (`docs/flutter/WIRING.md`).
- Native hissələr (manifest, Info.plist, `MainActivity` = `FlutterFragmentActivity`) heç vaxt kompilyasiya olunmayıb.
- Golden testlərdə emoji şrifti yoxdur (qutu kimi görünür).
