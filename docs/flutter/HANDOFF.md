# Flutter keçidi: işi davam etdirmək üçün təhvil

Yenilənib: 2026-11-27. Budaq: `claude/blissful-sagan-lqhvv9` (baza `main-630mc7`, 52.0.2). Flutter layihəsi: `app/`.

## Əvvəlcə oxu

1. `docs/FLUTTER_MIGRATION_PLAN.md` — plan və qəbul olunmuş qərarlar.
2. `docs/flutter/CONTRACT.md` — köçürmə qaydaları (dəyişməz).
3. `docs/flutter/PROGRESS.md` — nə hazırdır, texniki borc, açıq qərarlar.
4. `docs/flutter/PARITY_MATRIX.md` — 284 vahid; hər iş bu cədvəldən götürülür.
5. `docs/flutter/SHELL.md`, `APP_ROOT.md`, `WIRING.md` (varsa) — ekranın qabığa necə qoşulduğu.
6. `app/lib/core/cache/README.md` — React hook → Dart tərcümə bələdçisi.

## Mühit

- Flutter 3.50.1 stable lazımdır. Yoxdursa: `releases_linux.json`-dan 3.50.1 arxivini endir, `/opt/flutter`-ə aç, `git config --global --add safe.directory /opt/flutter`.
- React tərəfi üçün repo kökündə `npm ci`.
- Android SDK və Xcode yoxdursa, native kod kompilyasiya olunmur; yalnız `flutter analyze` və `flutter test`. Real yığım yalnız Codemagic-də (`ios-flutter-store`, `android-flutter-store`).

## Vəziyyət

Hazır (testləri keçir, cihazda işlədilməyib, heç bir Codemagic yığımı aparılmayıb):
dizayn sistemi, dil qatı və məzmun paketləri, qəbul protokolu və sessiya, köhnə anbarın oxunması, məlumat qatı və store-lar,
naviqasiya qabığı, tətbiq kökü, giriş axını, onboarding, paywall və alışlar, profil, ayarlar, tətbiq kilidi, dəstək, hüquqi,
ana ekran (ortaq + hamiləlik + dövr + körpə), stories, təqvim, hesablama məntiqi (`app/lib/domain`), oyun mühərrikləri,
körpü buraxılışı 53.0-ın ixrac kodu, Codemagic workflow-ları, istinad şəkilləri infrastrukturu (`tools/reference-shots`).

Yarımçıq ola bilər: inteqrasiya keçidi (bütün funksiyaların `app/lib/app`-da qoşulması, qabığın sliver əsaslı scroll-u,
deeplink çatdırılması). Davam etməzdən əvvəl `app/` içində `flutter analyze` və `flutter test` işə sal; uğursuz test varsa,
ilk iş onları düzəltməkdir.

Başlanmayıb (sıra ilə):
1. Billing ekranı, moderasiya tarixçəsi, Recap ekranı, bildirişlər siyahısının qalan hissələri.
2. Alətlər (mərhələ 4, ~41 min sətir): `ToolsHub` + hər alət. 4–5 dəstəyə böl.
3. Sosial (mərhələ 5): icma lenti, post, şərhlər, stories, qruplar, mesajlar, stikerlər, AI söhbət (SSE axını).
4. Partnyor rejimi (mərhələ 6).
5. Ticarət və məzmun (mərhələ 7): aptek, tortlar, partnyor mağazaları, QayğıCash, kitablar, bloq, Epoint.
6. Oyunların ekranları (mərhələ 8; mühərriklər hazırdır).
7. Native (mərhələ 9): push və toxunuşlar, yerli bildirişlər, Live Activity və vidcetlər, Health, AdMob, ekran qoruması,
   Customer.io, TikTok, Facebook hadisələri, analitika. Manifest və Info.plist siyahısı: `docs/flutter/BUILD.md`.
8. Sərtləşdirmə (mərhələ 10): istinad şəkilləri ilə tam müqayisə, 25 dil, performans ölçümü, 52/53 → 60 yeniləmə sınağı.

## İş üsulu

- Hər funksiya öz qovluğunda: `app/lib/features/<ad>/`, testlər `app/test/features/<ad>/`.
- Əvvəl məntiq və onun vitest halları, sonra UI. Hər Dart faylının başında `// Ported from: <src yolu>`.
- Mətnlər yalnız `tr` / `trInline` ilə; açarı tapmaq: `node app/tool/i18n/find-key.mjs "<az mətn>"`.
- Rəng, radius, kölgə yalnız tokenlərdən (`package:anacan/design/design.dart`).
- Hər funksiya `registerXFeature(FeatureRegistry r)` ixrac edir; `app/lib/app/feature_registrations.dart`-a əlavə olunur.
- Başqa funksiyaya aid hissə üçün interfeys qoy, `WIRING.md`-ə yaz.
- İstinad şəkli varsa (`tools/reference-shots/out/**`; yoxdursa `node tools/reference-shots/run.mjs` ilə çək), golden ilə
  gözlə tutuşdur və fərqləri düzəlt.
- Tapılan React qüsurları: `docs/flutter/PARITY_FIXES.md`.
- Hər tamamlanmış hissədən sonra: `flutter analyze` təmiz, `flutter test` yaşıl, `PARITY_MATRIX.md`-də status, `PROGRESS.md`,
  sonra commit və push.

## Sahibindən gözlənilənlər

- Codemagic-də ilk sınaq yığımı (`android-flutter-store`), loqların paylaşılması.
- Açıq qərarlar: `PROGRESS.md` sonunda.
- Körpü buraxılışı 53.0-ın yığılıb mağazaya göndərilməsi (`docs/RELEASE_53_BRIDGE.md`).
