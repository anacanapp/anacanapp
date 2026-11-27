# Flutter keçidi: gedişat

Yenilənib: 2026-11-27. Budaq: `claude/blissful-sagan-lqhvv9`. Test sayları `app/` içində `flutter test` ilə alınıb.
Heç nə cihazda işlədilməyib və heç bir Codemagic yığımı aparılmayıb.

| İş | Vəziyyət | Yoxlama |
|---|---|---|
| Plan, uyğunluq cədvəli, servis spesifikasiyaları | hazır | `docs/flutter/*.md` |
| Körpü buraxılışı 53.0 (localStorage ixracı) | kod hazır, yığılmayıb | 12 vitest, tsc, `npm run build` |
| Codemagic: 53.0 versiyası, Flutter 60.0 workflow-ları | yazılıb, işə salınmayıb | YAML və skriptlər lokal yoxlanıb |
| Dizayn sistemi (tokenlər, şriftlər, ikonlar, vidcetlər) | hazır | 65 test |
| Dil qatı və məzmun paketləri | hazır | 160 test |
| Qəbul protokolu, sessiya, köhnə anbar | hazır; native kanal kompilyasiya olunmayıb | 210 test |
| Naviqasiya qabığı | hazır; tətbiq kökünə qoşulmayıb | 451 test |
| Oyun mühərrikləri (8 oyun) | hazır; UI yoxdur | 108 test |
| Hesablama məntiqi (`app/lib/domain`) | davam edir | |
| Məlumat qatı, giriş vəziyyəti, store-lar | davam edir | |
| İstinad ekran şəkilləri | davam edir | |
| Tətbiq kökü (`main.dart`), giriş axını, ekranlar, alətlər | başlanmayıb | |

## Açıq qərarlar (cavab gələnə qədər mötərizədəki variant)

1. İcma postlarında moderator menyusu tətbiqdə qalsın? (qalır)
2. Yalnız adminə görünən Mağaza ekranı köçürülsün? (yox, vebə keçir)
3. `/h/:kod` və `/p/v/:token` səhifələri tətbiqdə olsun? (vebdə qalır)

## Texniki borc (düzəldilməlidir)

- Qabığın scroll konteyneri `SingleChildScrollView`-dur, ona görə şaquli siyahılar tənbəl qurulmur. Uzun siyahılar (icma lenti) üçün qabıq sliver əsaslı olmalıdır.
- Ana ekranın girişləri (`home_inputs.dart`, `HomeSlots`) hələ neytral dəyərlərlə işləyir: premium, oxunmamış sayı, stories ayarı, bloq, banner.
- Golden testlərdə emoji şrifti yoxdur (qutu kimi görünür).
