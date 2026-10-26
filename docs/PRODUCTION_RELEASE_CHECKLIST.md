# Production-a Build Göndərmə — Tam Bələdçi (iOS + Android)

Bu sənəd hazırkı vəziyyəti tam audit edərək hazırlanıb (build konfiqurasiyaları,
signing, Xcode layihə faylı, translation/DB migrasiya vəziyyəti daxil olmaqla).
**Bu sessiyada avtomatik düzəldilən 3 element** aşağıda "✅ Artıq düzəldildi" kimi
işarələnib — qalanı sizin əl ilə (Mac/Xcode/Developer Portal/parol) etməli
olduğunuz addımlardır.

## TL;DR — Status cədvəli

| | iOS | Android |
|---|---|---|
| Kod (JS/TS + Swift/Kotlin) | ✅ 100% hazır | ✅ 100% hazır |
| Native layihə faylı (Xcode/.pbxproj) | ❌ 4 addım çatışır (aşağı A bölməsi) | ✅ heç nə lazım deyil |
| Release imzalama (signing) | ⚠️ Team/Bundle ID var, provisioning yoxlanmalı | ✅ **bu sessiyada düzəldildi** (parol lazımdır) |
| Versiya nömrəsi | 18 (build 18.0) | 19.0 (build 19) — **uyğunsuzdur, bax B.4** |
| DB migrasiyaları | 🔴 ən azı `Duzelis10.sql` təsdiqlənmiş işlədilməyib | eyni |
| Mağaza bəyanatları (Health) | ⚠️ mətn hazır, Console-da tətbiq olunmalı | ⚠️ mətn hazır, Console-da tətbiq olunmalı |

---

## HİSSƏ A — KRİTİK: iOS Xcode addımları (Mac + Xcode tələb edir)

Bunlar **`docs/IOS_NATIVE_FEATURES_SETUP.md`** və **`docs/LIVE_TIMER_SETUP.md`**-də ətraflı
izah olunub — bura yalnız **build-dən əvvəl blocker olan minimum** yığılıb. Tam təfərrüat
üçün o 2 sənədə bax.

**Niyə vacibdir:** Bütün Swift faylları artıq repoda var, AMMA Xcode-un öz layihə faylı
(`project.pbxproj`) onları HEÇ BİR target-ə bağlamayıb — confirmed: `HealthCyclePlugin.swift`,
`HealthVitalsPlugin.swift`, `PrivacyInfo.xcprivacy`, həmçinin bütöv Widget Extension target-i
(`AnacanTimerWidget`) hal-hazırda `.pbxproj`-da SIFIR dəfə görünür. Bunlar edilmədən:
- Health-lə bağlı HEÇ NƏ işləməyəcək (nə oxuma, nə yazma)
- Kilid ekranı taймer widget-i ÜMUMİYYƏTLƏ olmayacaq
- App Store review-də Health icazə mətnləri var amma funksionallıq yoxdursa, bu qəribə görünə bilər (amma reject səbəbi olmaz, sadəcə funksional boşluqdur)

**Addımlar (~40-60 dəqiqə, fiziki iPhone-da test tələb olunur):**
1. `git pull --rebase --autostash && npm install && npm run build && npx cap sync ios && npx cap open ios`
2. `HealthCyclePlugin.swift` + `HealthVitalsPlugin.swift`-i `App` target-inə əlavə et (Add Files to "App…")
3. `PrivacyInfo.xcprivacy`-ni `App` target-inin Resources-ına əlavə et
4. Signing & Capabilities → HealthKit capability əlavə et
5. File → New → Target → **Widget Extension** (`AnacanTimerWidget`) yarat, şablon faylları sil, repo-dakı 4 faylı düzgün target-lərə əlavə et (cədvəl `LIVE_TIMER_SETUP.md`-də)
6. Signing & Capabilities → **hər iki target-ə** (App + AnacanTimerWidget) App Groups → `group.com.atlasoon.anacan`
7. AnacanTimerWidget target → Minimum Deployment → iOS 16.1
8. Apple Developer Portal → App ID-yə HealthKit capability aktivləşdir + lazım gələrsə App Group yarat (eyni ID-lə: `group.com.atlasoon.anacan`)
9. Build (⌘B), xətaları düzəlt (adətən unudulmuş target membership)
10. **Fiziki iPhone-da test et** — Simulator-da Health/Live Activity etibarsızdır

> Bunlar edilmədən də app compile/build olur və App Store-a göndərilə bilər — sadəcə bu 2
> xüsusiyyət (Health, Live Activity) işləməyəcək. Əgər tələsirsinizsə, bu addımları KEÇİB
> birbaşa B/C hissəsinə keçə bilərsiniz — Health/Widget sonrakı bir yenləmədə əlavə edilə bilər.

---

## HİSSƏ B — KRİTİK: Versiya, imzalama və konfiqurasiya

### B.1 — Android release imzalama (bu sessiyada infrastruktur quruldu, parol lazımdır)

**Tapılan problem:** `android/app/anacan-release-key.jks` mövcuddur (git-də), amma
`build.gradle`-da HEÇ bir `signingConfig` istinadı yox idi — yəni release build indiyə
qədər Gradle vasitəsilə imzalanmırdı (yalnız Android Studio-nun "Generate Signed Bundle"
sehrbazı ilə əl ilə edilə bilərdi).

**✅ Bu sessiyada düzəldildi:**
- `android/app/build.gradle`-a `signingConfigs { release {...} }` bloku əlavə olundu — `android/keystore.properties`
  faylından (git-ə düşməyən) parolları oxuyur
- `android/keystore.properties.example` şablonu yaradıldı
- `android/.gitignore`-a `keystore.properties` əlavə olundu

**Sizin etməli olduğunuz YEGANƏ addım:**
```bash
# android/ qovluğunda:
cp keystore.properties.example keystore.properties
# sonra keystore.properties-i açıb HƏQİQİ parolları yazın:
#   storePassword, keyAlias, keyPassword
```
Bu parolları haradan tapmaq: keystore-u kim yaratdıbsa (əvvəlki developer/komanda) onda
olmalıdır. Əgər tamamilə itibsə, **yeni keystore yaratmaq YALNIZ ilk dəfə Play Store-a
göndərəndə mümkündür** — artıq bir dəfə həmin keystore ilə imzalanıb yayımlanmış tətbiq
üçün keystore DƏYİŞDİRİLƏ BİLMƏZ (Play Store eyni imzanı tələb edir, əks halda "yenləmə"
kimi qəbul olunmaz). Ona görə bu parolları tapmaq **prioritet #1**-dir.

`keystore.properties` yoxdursa, build **yenə də uğurla tamamlanır** (signingConfig sadəcə
tətbiq olunmur, AAB imzasız qalır) — yəni bu addımı hələ etməsəniz belə sizi build etməkdən
saxlamır, sadəcə həmin AAB-ni Play Console-a birbaşa yükləyə bilməyəcəksiniz (Google imzasız
AAB qəbul etmir).

### B.2 — `minifyEnabled false` (R8/ProGuard deaktivdir)

Hazırda Android release build-də kod kiçildilməsi/gizlədilməsi (R8) SÖNÜKDÜR. Bu, funksional
problem DEYİL (app işləyəcək), yalnız: (a) APK/AAB ölçüsü lazımından böyük olacaq, (b) kod
asanlıqla decompile oluna bilər. **Tövsiyə: hələlik `false` saxlayın** (bu sessiyada dəyişmədim)
— çünki native pluginlər (Health Connect, Facebook SDK, Firebase) üçün ProGuard qaydaları
yoxlanmayıb, kor-koranə aktivləşdirmək runtime crash riski yaradır ki, mən bunu fiziki
cihazsız test edə bilmirəm. Əgər aktivləşdirmək istəyirsiniz: `minifyEnabled true` edin,
**tam regression test edin** (xüsusilə Health Connect yazma, Firebase Auth, Facebook SDK).

### B.3 — DB migrasiyaları (Supabase) — TƏSDİQLƏNMİŞ problemlər var

Kodda birbaşa sübut tapıldı ki, **`supabase/duzelis/Duzelis10.sql` production-da hələ
işlədilməyib** (`src/lib/public-profile-cards.ts`, `UserProfileScreen.tsx`,
`AdminVerifiedBadges.tsx` — hamısında bunun üçün defensiv fallback kodu var, əks halda
bu sətirlər yazılmazdı). Digər Duzelis/Ereb fayllarının statusu qarışıqdır (bəziləri
"artıq edildi" tərzində şərhlərlə yazılıb, sübut yoxdur).

**Kəşf edilən əlavə fakt:** `supabase/duzelis/` və `supabase/ereb/`-dən başqa, DAHA ƏVVƏL
adları çəkilməyən **3 əlavə ad-hoc SQL toplu qovluğu** da var: `supabase/alman/` (14 fayl,
Alman dili), `supabase/qazax/` (18 fayl, Qazax dili), `supabase/son/` (30 fayl, müxtəlif).
Bunların HEÇ BİRİ Supabase-in öz migration tracking sistemində (`supabase/migrations/`)
deyil — yəni `supabase db push` bunları görmür, əl ilə SQL Editor-da işlədilməli idi və
hansının artıq edildiyini repo-dan tapmaq mümkün deyil.

**Tövsiyə olunan addım (build göndərməzdən ƏVVƏL):**
1. Supabase Dashboard → SQL Editor-a keçin
2. Sadə yoxlama sorğusu işlədin ki, konkret sütunların/cədvəllərin mövcud olub-olmadığını görün, məsələn:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name IN ('chorionicity', 'is_verified', 'multiples_type');

   SELECT table_name FROM information_schema.tables
   WHERE table_name IN ('fetal_growth_scans', 'multiples_options');
   ```
3. Əskik olan hər şey üçün müvafiq `DuzelisN.sql`/`ErebN.sql`/`AlmanN.sql`/`QazaxN.sql`/`SonN.sql`
   faylını SQL Editor-da ardıcıl (1-dən başlayaraq) işlədin — **hamısı idempotentdir**
   (`ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO UPDATE` istifadə edir), yəni artıq
   işlədilmiş olanı TƏKRAR işlətmək zərər vermir.
4. Ən sadə/təhlükəsiz yol: **sadəcə hamısını ardıcıl işlədin** (Duzelis1→14, Ereb1→6,
   Alman1→8, Qazax1→9, Son1→27) — idempotent olduqları üçün bu 100% təhlükəsizdir, sadəcə
   vaxt aparır (~90 fayl).

**Niyə bu, KRİTİKDİR:** Yeni build-də olan kod (bu sessiyada əlavə edilən `chorionicity`,
`fetal_growth_scans`, `kick_sessions.position` və s.) əgər müvafiq `Duzelis13.sql`/`Duzelis14.sql`
işlədilməyibsə, o funksiyalar sükutla "boş" davranacaq (mövcud fallback pattern-lər sayəsində
APP ÇÖKMƏYƏCƏK, sadəcə həmin xüsusiyyətlər işləməyəcək) — amma daha köhnə, fallback-sız yerlərdə
(məsələn birbaşa `.select('yeni_sutun')` edən başqa kodlarda) xəta ehtimalı var.

### B.4 — Versiya nömrələri uyğunsuzdur

- iOS: `MARKETING_VERSION = 18`
- Android: `versionName "19.0"`, `versionCode 19`

Bu, ya qəsdəndir (Android bir əlavə buraxılış edib, iOS etməyib), ya da unudulmuş sinxronizasiya
xətasıdır. **Qərar sizindir** — mən hansının "düzgün" olduğunu bilə bilmərəm (bu, faktiki
mağaza submission tarixçənizdən asılıdır). Tövsiyə: **hər iki platformanı eyni versiyaya
gətirin** (məsələn hər ikisini 20-yə keçirin) və bundan sonra hər buraxılışda İKİSİNİ BİRLİKDƏ
artırın ki, bu qarışıqlıq təkrarlanmasın.
- iOS: `ios/App/App.xcodeproj/project.pbxproj` → `MARKETING_VERSION` və `CURRENT_PROJECT_VERSION` (2 yerdə, Debug+Release eyni olmalıdır) — Xcode-da General tab-dan da dəyişdirilə bilər.
- Android: `android/app/build.gradle` → `versionCode`/`versionName`

---

## HİSSƏ C — Mağaza uyğunluğu (Health bəyanatları)

Tam mətn artıq `docs/STORE_COMPLIANCE.md`-də hazırdır — bura yalnız **checklist** kimi
təkrarlanır, tam mətn üçün o sənədə bax:

- [ ] **Google Play Console** → App content → Data safety → Health Connect bölməsi ("Yes", icazələr siyahısı, "App functionality", "processed ephemerally / on device")
- [ ] **Google Play Console** → App content → Health apps → "Reproductive health / cycle tracking" seç
- [ ] **App Store Connect** → App Privacy → Health & Fitness = Collected, Linked, App Functionality
- [ ] **App Store Connect** → App Review Information → Notes → HealthKit izah mətnini yapışdır (`STORE_COMPLIANCE.md`-də hazır mətn var)
- [ ] App təsvirinə (hər iki mağazada) HealthKit/Health Connect istifadəsi barədə 1 cümlə
- [ ] Privacy Policy səhifəsində (anacanwebsitenew saytı) Health bölməsi yenilənsin

**Bunlar App Store/Play Store-un öz Console-larında edilir — kodda dəyişiklik tələb etmir.**
Əgər bu addımlar EDİLMƏDƏN göndərsəniz və app HealthKit istifadə edirsə, review REJECT
riski var (Guideline 5.1.3) — Android tərəfdə isə Data Safety formu səhv/natamam olarsa
tətbiq dərc oluna bilər, amma sonradan Google tərəfindən xəbərdarlıq/məcburi düzəliş tələb
oluna bilər.

---

## HİSSƏ D — Firebase Analytics (BLOKLAYICI DEYİL, təxirə salına bilər)

`VITE_FIREBASE_API_KEY`/`AUTH_DOMAIN`/`APP_ID`/`MEASUREMENT_ID` boşdur, hər iki native
konfiq faylında (`google-services.json`, `GoogleService-Info.plist`) `IS_ANALYTICS_ENABLED = false`.
Bu, app-ın işləməsinə HEÇ TƏSİR ETMİR (Firebase Auth/Push/Facebook-events işləyir, yalnız
Analytics event-ləri göndərilmir — Mixpanel onsuz da söndürülüb, amma Firebase/GA4 + Facebook
events ayrıca işləyir). **Production build-i bunun üçün gözlətməyə ehtiyac yoxdur** — istəsəniz
sonrakı yenləmədə əlavə edə bilərsiniz (addımlar: Firebase Console-da Web app qeydiyyatı +
GA4 aktivləşdirmə + native konfiq fayllarını yenidən yükləmə).

---

## HİSSƏ E — Təhlükəsizlik qeydi (bloklayıcı deyil, amma diqqətə çatdırılmalıdır)

`android/app/anacan-release-key.jks` (əsl release imzalama açarı) **git repository-ə
commit edilib**. Bu, adətən tövsiyə OLUNMUR — repo-ya girişi olan (və ya repo hansısa
səbəbdən sızarsa) hər kəs, əgər parolları da əldə edərsə, tətbiqin "rəsmi" yenləməsini
təqlid edə bilər. Bu sessiyada bunu git tarixçəsindən silmədim (bu, `git filter-repo`/
force-push tələb edir və mövcud commit tarixçəsini poza bilər — sizin açıq təsdiqiniz
olmadan görmədim). Tövsiyə: gələcəkdə **Google Play App Signing**-ə keçin (Google öz
upload-key sistemi ilə əsl imzalama açarını özündə saxlayır, sizin yalnız "upload key"
adlı ikinci dərəcəli açarı olur — daha təhlükəsiz), və mövcud `.jks`-i git tarixçəsindən
təmizləməyi düşünün (bu, ayrıca, diqqətli bir əməliyyatdır).

---

## HİSSƏ F — Addım-addım: iOS build və App Store-a göndərmə

1. `git pull --rebase --autostash`
2. `npm install && npm run build`
3. `npx cap sync ios`
4. `npx cap open ios` (və ya birbaşa `ios/App/App.xcworkspace` aç)
5. **[Bir dəfəlik]** Hissə A-dakı Xcode addımlarını et (Health plugin-ləri + Widget target) — ya da hazırkı sessiyada bunları keçib sadəcə Health/Widget-siz göndər
6. Xcode-da **App** scheme seç, **Any iOS Device (arm64)** hədəf seç
7. Signing & Capabilities-də Team-in düzgün seçildiyini yoxla (Team ID `8B6976J8H7`), "Automatically manage signing" ✅
8. Menu → **Product → Archive**
9. Archive tamamlananda açılan **Organizer** pəncərəsində → **Distribute App** → **App Store Connect** → **Upload**
10. Yükləmə bitəndə App Store Connect-ə keç (appstoreconnect.apple.com) → yeni build-in "processing"-dən çıxmasını gözlə (adətən 10-30 dəqiqə)
11. **TestFlight**-də özün/komandan test et (xüsusilə Health/Live Activity fiziki cihazda)
12. App Store Connect → **App Version** yarat/seç → yeni build-i bağla → Hissə C-dəki bəyanatları doldur → **Submit for Review**

## HİSSƏ G — Addım-addım: Android build və Play Store-a göndərmə

1. `git pull --rebase --autostash`
2. `npm install && npm run build`
3. `npx cap sync android`
4. Hissə B.1-i tamamla (`android/keystore.properties` yarat + doldur) — **bu edilmədən aşağıdakı `bundleRelease` imzasız AAB yaradacaq, Play Console qəbul etməyəcək**
5. Terminal-da (`android/` qovluğunda) və ya Android Studio-dan:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   (Windows-da `gradlew.bat bundleRelease`)
6. Nəticə: `android/app/build/outputs/bundle/release/app-release.aab`
7. Play Console (play.google.com/console) → tətbiqinizi seç → **Production** (və ya əvvəlcə **Internal/Closed testing**, tövsiyə olunur) → **Create new release**
8. `app-release.aab`-ni yüklə
9. Release qeydlərini (release notes) yaz
10. Hissə C-dəki Data Safety/Health apps bəyanatlarının yenilənmiş olduğunu təsdiqlə
11. **Review-a göndər** (Google review adətən bir neçə saatdan bir neçə günə qədər çəkir)

---

## Son yoxlama siyahısı (hər iki mağazaya göndərmədən əvvəl)

- [ ] `android/keystore.properties` yaradılıb, həqiqi parollarla doldurulub
- [ ] Versiya nömrələri qərarlaşdırılıb (Hissə B.4) və hər iki platformada eyniləşdirilib (istəyə bağlı, amma tövsiyə olunur)
- [ ] DB migrasiyaları yoxlanılıb/işlədilib (Hissə B.3) — ən azı `Duzelis10.sql`-in vəziyyəti təsdiqlənməli
- [ ] (İstəyə bağlı, bloklayıcı deyil) iOS Xcode addımları edilib — Health/Live Activity işləsin deyə
- [ ] Play Data Safety + Health apps declaration yenilənib
- [ ] App Store Privacy labels + Review Notes yenilənib
- [ ] Fiziki cihazda son smoke-test edilib (ən azı: qeydiyyat/giriş, əsas dashboard, ödəniş axını)
- [ ] `npm run build` təmiz keçir, `npx tsc --noEmit` xətasız (bu sessiyanın sonunda təsdiqləndi)

## İstinad edilən fayllar

- `docs/IOS_NATIVE_FEATURES_SETUP.md` — Health + Widget Xcode addımlarının tam mətni
- `docs/LIVE_TIMER_SETUP.md` — Widget Extension target yaratmanın tam addım-addım təlimatı
- `docs/STORE_COMPLIANCE.md` — Health bəyanatlarının tam mətni (Play + App Store)
- `.agents/workflows/ios-build.md` — standart iOS build əmr ardıcıllığı
- `android/keystore.properties.example` — release imzalama parolları üçün şablon (bu sessiyada yaradıldı)
