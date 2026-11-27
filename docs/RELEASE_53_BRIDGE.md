# Anacan 53.0: körpü buraxılışı (Codemagic, iOS + Android)

Hazırlanıb 2026-11-27. 53.0 Capacitor tətbiqinin **son** buraxılışıdır. Məqsəd: Flutter keçidi üçün məlumat ixracı.
Flutter tətbiqi (60.0) eyni `com.atlasoon.anacan` üzərinə yeniləmə kimi quraşdırılır. O, Capacitor Preferences-i
native oxuya bilir, amma WebView-un `localStorage` və IndexedDB yaddaşını oxuya bilmir. 53.0 yalnız cihazda olan vacib
vəziyyəti Preferences-ə köçürür ki, 60.0 onu götürsün. Plan: [FLUTTER_MIGRATION_PLAN.md](FLUTTER_MIGRATION_PLAN.md) §6.

Versiya: `APP_VERSION` **53.0**, Android `versionCode` 5300 + `ANDROID_BUILD_SEQ`. `codemagic.yaml`-dakı bu dəyişikliyi
ayrı agent edir; bu sənəd yalnız tətbiq kodunu təsvir edir. Əsas: 52.0.2 (a9ff22b4 və sonrakı) + aşağıdakı ixrac.

## Nə ixrac olunur
Modul: `src/lib/migration-export.ts` (testlər `src/lib/migration-export.test.ts`), açarların tam siyahısı və hər birinin
sinfi: [flutter/LEGACY_STORAGE.md](flutter/LEGACY_STORAGE.md).

- Bir Preferences açarı: `anacan.migration.localstore.v1` (iOS `UserDefaults`-da `CapacitorStorage.anacan.migration.localstore.v1`,
  Android `CapacitorStorage` SharedPreferences). Dəyər JSON-dur: `schema` = `anacan-migration-localstore-v1`,
  `exportedAt`, `appVersion`, `entries` (açar → `localStorage`-dakı xam sətir, dəyişmədən), `skipped`.
- Nələr: tətbiq kilidi (PIN hash/salt, biometrika bayrağı), istifadəçi store-u və seçilmiş uşaq, aktiv taymerlər
  (yuxu/qidalanma, sancı, təpik), oflayn outbox və göndərilməmiş növbələr, yuxu/tərbiyə/süddən ayırma planları,
  oyun irəliləyişləri və ayarları, sağlamlıq açarları və vahidlər, bildiriş ayarları (səssiz saatlar, su xatırlatması,
  vaksin, planlanmış yerli bildirişlərin id-ləri), reyting/istifadə sayğacları, reklam limitləri, bir dəfəlik təklif,
  tur və "görüldü" bayraqları, onboarding və səbət qaralamaları.
- Nələr **yox**: giriş tokenləri və sessiya (artıq Preferences-dədir, `session-persistence.ts`), qəbul pini,
  react-query keşi, tərcümə/məzmun keşləri, IndexedDB məzmun paketləri (60.0 yenidən yükləyir).
- Ölçü həddi: bir dəyər 256 Ki simvoldan, cəmi 1,5 Mi simvoldan çox olmur; sığmayan açarların adı `skipped`-dədir.
- Nə vaxt: ilk render-dən ~4 s sonra bir dəfə, sonra ixrac olunan açar dəyişəndə 3 s gecikmə ilə, tətbiq arxa fona
  keçəndə dərhal. `localStorage`-dan silinən açar ixracdan da silinir. Vebdə heç nə etmir.
- Xətalar udulur: Preferences işləməsə də `localStorage` yazıları əvvəlki kimi işləyir, açılış gecikmir.

## Buildləri başlatmaq
Codemagic → **Start new build** → 53.0 commit-i olan branch → `ios-store`, sonra `android-store`.

## TestFlight / internal testing yoxlaması
Mağaza buildlərində WebView müfəttişi bağlıdır (`webContentsDebuggingEnabled: false`), ona görə ixracın özünü
TestFlight/Play buildində birbaşa görmək olmur. Yoxlama iki hissədir:

1. **Reqressiya (TestFlight / internal testing, 52 üzərinə 53):** girişli qalır; PIN kilidi, taymerlər, oyun
   irəliləyişi, dil, oflayn qeyd (təyyarə rejimində körpə qeydi, sonra internet) əvvəlki kimidir. 52.0-ın yoxlama
   siyahısı da keçir ([RELEASE_52_CODEMAGIC.md](RELEASE_52_CODEMAGIC.md)).
2. **İxracın mövcudluğu (developer buildi, eyni commit):**
   - iOS: Xcode ilə development imzalı build, Safari → Develop → cihaz → Anacan; konsolda
     `await Capacitor.Plugins.Preferences.get({ key: 'anacan.migration.localstore.v1' })`. `value` JSON-dur, `schema`
     `anacan-migration-localstore-v1`, `entries`-də məsələn `anacan-timers`, `anacan-user-store` görünür.
   - Android: debug build (`npx cap run android`), sonra
     `adb shell run-as com.atlasoon.anacan cat shared_prefs/CapacitorStorage.xml | grep anacan.migration` və ya
     Chrome `chrome://inspect` konsolunda eyni `Preferences.get` əmri.
   - Ssenari: PIN qur, taymer başlat, bir oyun səviyyəsi keç → tətbiqi arxa fona at → `entries`-də `anacan_lock_hash`,
     `anacan-timers`, oyun açarı var. PIN-i söndür → 3 s sonra (və ya arxa fonda) `anacan_lock_*` açarları yox olur.
     `entries`-də `sb-…-auth-token`, `anacan-rq-cache` heç vaxt olmamalıdır.
3. **Son qəbul (Flutter 60 internal buildi hazır olanda):** 52 → 53 (açıb bağla) → 60 üzərinə yaz: giriş, PIN, oyun
   irəliləyişi, taymerlər və dil qalır (plan §6 qəbul meyarı).

## Mağaza mətni
İxrac istifadəçiyə görünmür; mətn neytraldır.

**AZ:** Stabillik və performans təkmilləşdirmələri, kiçik düzəlişlər.

**EN:** Stability and performance improvements, plus minor fixes.

## Qeydlər
- 53.0-ı ötürüb 52-dən birbaşa 60-a keçənlərdə ixrac olmur; onlar üçün plan §6-dakı gizli WebView ehtiyat yolu lazımdır.
- IndexedDB məzmun paketləri köçürülmür; 60.0-da ilk açılış internetlə olmalıdır (paketlər yenidən yüklənir).
- 53.0-dan sonra yeni Capacitor buraxılışı planlaşdırılmır; ixrac sxemi (`anacan-migration-localstore-v1`) dəyişməməlidir.
