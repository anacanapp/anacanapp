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
| Alətlər, icma, çat/AI, partnyor, ticarət, bloq, oyun UI, native tamamlama | başlanmayıb | qalan interfeyslər: `docs/flutter/WIRING.md` |
| İstinad ekran şəkilləri | hazır | `docs/flutter/REFERENCE_SHOTS.md` |

Cəmi: `flutter test` 2344 keçdi, 18 skip, 0 uğursuz; `flutter analyze` (lib + test) 0 problem.

## Açıq qərarlar (cavab gələnə qədər mötərizədəki variant)

1. İcma postlarında moderator menyusu tətbiqdə qalsın? (qalır)
2. Yalnız adminə görünən Mağaza ekranı köçürülsün? (yox, vebə keçir)
3. `/h/:kod` və `/p/v/:token` səhifələri tətbiqdə olsun? (vebdə qalır)

## Texniki borc (düzəldilməlidir)

- Ana ekranın qalan slotları (oxunmamış sayı, bloq, banner, reklam, partnyor, kitab, Aptek) öz feature-ləri gələnə qədər boşdur (`docs/flutter/WIRING.md`).
- Native hissələr (manifest, Info.plist, `MainActivity` = `FlutterFragmentActivity`) heç vaxt kompilyasiya olunmayıb.
- Golden testlərdə emoji şrifti yoxdur (qutu kimi görünür).
