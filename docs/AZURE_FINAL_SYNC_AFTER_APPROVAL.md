# Yayımlanmış native tətbiqlərin Azure backend-ə son keçidi

Əsas tətbiq/deploy hədəfi istifadəçinin qərarı ilə Azure-dur:
[Azure iş bazası](APPLICATION_BASELINE.md). Aşağıdakı addımlar yayımlanmış 30-un
backend keçidi və son UI-ni daşıyan iOS 31.0-ın buraxılışı üçündür.

Azure data/Auth/storage-si 2026-09-16 **07:21:12 UTC** sərhədinə yenilənib;
source Supabase işləyir və bundan sonrakı dəyişikliklər delta ilə alınır.
Son consistent sync source yazıları dayandırılıb drain edildikdən sonra,
Azure writer admission açılmadan əvvəl tamamlanır.

İstifadəçinin [tam/delta sinxronu](AZURE_INCREMENTAL_SYNC.md) tamamlanıb:
252 cədvəl, 2,138,253 Source sətri, 1,847 fayl; Source checkpoint-i qəbul edib.
Bu pre-sync aşağıdakı frozen final handoff və store release mərhələlərini əvəz etmir.

**2026-09-16 yeniləməsi:** 30 artıq hər iki mağazada yayımlanıb (Android istifadəçi
təsdiqi, iOS public lookup). Source-first admission `source / generation 0`-dır;
native backend keçidi hələ pending-dir. Final writer/session handoff yenə tələb
olunur. Yeni ekranların namizədi [iOS 31.0](IOS_RELEASE_31.md)-dır.

## 1. Native hazırlıq və cihaz qəbulu

- **30.0 hər iki mağazada yayımlanıb:** [Android paket/submission tarixçəsi](STORE_SUBMISSION_30.md),
  [iOS Xcode tarixçəsi](XCODE_UPLOAD_30.md). [iOS 31.0 namizədi](IOS_RELEASE_31.md)
  son UI-ni əlavə edir. 29.0-da əlavə edilən refresh-before-use davranışı saxlanır.
  Source API/sessiya namespace-ni saxlayır; backend seçimi bütün SDK importlarından
  qabaq edilir. Public admission qərarı hazırda `phase=source`, generation 0-dır.
  `VITE_AUTH_CUTOVER=false` qalır; 30/31 ilk Azure API istifadəsindən əvvəl real refresh
  ilə target JWT-si alır və davamlı adoption receipt-i saxlayır.
- Namizədin source üzərindən real native upgrade/expiry/restart qəbulu və server
  handoff rehearsal-i tamamlanmalıdır. Son **canlı data** snapshot-ının bu vaxt alınması
  lazım deyil. Yığılmış SDK sınaqlarındakı sintetik grant-lər real server uyğunluğu deyil.
- Yeni force-update hook-u public RPC və quraşdırılmış native versiyanı müqayisə edir;
  yeni build və web bloklanmır. Android25-in köhnə bundled reader/admission davranışı
  ayrıca source tərəfində yoxlanmalıdır. Client UI qapısı server-side write freeze deyil.
- Seçilmiş native 29 refresh-before-use yolunda target signer-in qorunması, auth.sessions, refresh-token rotation/HMAC/
  revocation/MFA dependencies və rollback üçün səlahiyyətli export/import yolu təmin
  edilməlidir. Hazır `import-data.mjs` yalnız `ON CONFLICT DO NOTHING` ilkin importer-idir;
  real inserts/updates/deletes, Auth lineage və storage reconciler-i indi `azure-migration/sync/`
  altındadır. Final frozen handoff/device rehearsal-i ayrıca tamamlanmalıdır.
- Source counts-only nəticədə legacy 12-simvollu refresh formatı və yoxlanmış
  encrypted-envelope sahələrində 0 nəticəsi alınıb. Fixture-only alətin real Azure
  self-test-i və [real Source→Azure refresh rehearsal-i](AZURE_AUTH_REHEARSAL.md)
  keçib. Bu dar test importer-i tam production reconciler-i əvəz etmir.
- App Store-da **Manually release this version**, Play production üçün **Managed
  publishing** istifadə edin. Internal/TestFlight tester-lər və reviewer hesabları
  production population-dan ayrı idarə olunur; reviewer/tester Azure yazıları final
  production data üçün avtomatik source-of-truth sayılmır.

## 2. Canlı backend keçidi pəncərəsi

1. Dəqiq source watermark və müşahidə/rollback pəncərəsi müəyyənləşdirin.
2. Source-da **server-side write freeze** tətbiq edin: app yazıları, signup, auth
   refresh rotation, storage upload, arxa plan job-ları və provider callback-ləri
   nəzərə alınsın. Tək UI “maintenance/force update” bloku yazıları dayandırmır.
3. In-flight sorğuları drain edin. Ödəniş/webhook event-lərini itirməyən queue/retry
   qaydası ilə tək writer saxlayın; eyni anda iki backend sərbəst yazmasın.

## 3. Son köçürmə və qəbul

- **Yeni + dəyişmiş + silinmiş sətirlər** köçürülür. UUID-lər, provider subjects,
  FK-lər, sifarişlər, subscription/referral və domain-lər arası mapping qorunur.
- Source session/refresh lineage də həmin consistent sərhəddən alınır. Sadəcə
  auth.users/identities və ya JWT secret kopyalamaq no-logout üçün yetərli deyil.
- Storage bytes/ownership/privacy və dəyişiklik/silinmələr yoxlanır. Azure Storage
  API-nin faktiki object version-ları source version-ları ilə kor-koranə əvəz edilmir.
- Preview test hesabları/yazıları və sandbox entitlement-ləri ayrıca ayırın. RC
  production truth və TRANSFER sahibliyi reconcile edilir; test Premium-u production-a
  keçirməyin. Mövcud source production webhook sonadək saxlanır, sonra bir dəfə transfer edilir.
- Saylar, canonical ID coverage, FK və row-level nümunələr, file checksums və silinmələr
  yoxlanır. Köhnə real sessiya ilə access, token expiry/refresh, restart/offline və revoked
  sessiyanın rəddi keçmədən writer admission açılmır.

## 4. Azure admission və 31.0 public release

Qəbul keçdikdən sonra `auth-handoff/prepare-admission.mjs` ilə bütün real final-handoff
hesabatlarına bağlı Azure policy hazırlanır; daha yeni generation və receipt SHA-256
ilə public admission ünvanında yayımlanır. `sessionHandoffMode=refresh-before-use-v1`
üçün minimum version 29.0 və target-signer/first-refresh qəbul sübutu tələb olunur.
Yayımlanmış 30 və 31 namizədi yeni bootstrap zamanı qərarı cihazda saxlayır,
ilk target istifadəsindən əvvəl refresh edir və API-ləri birlikdə Azure-a seçir.
Tək scheduler/webhook sahibi açılır. 31.0-ın Azure-only RPC-ləri real cihazda
yoxlanandan sonra mağazada gözləyən manual release yayımlanır. Android25 source
Supabase URL-ni daşıyır: onu Azure DNS-i ilə köçürmək olmur; köhnə client update/
read-only siyasəti source tərəfində də işləməlidir.

Hər iki mağazanın hədəf cihaz/regionlarda əlçatanlığı təsdiqlənəndən sonra yalnız
köhnə build-lərə yönələn version-aware update tələbi açılsın. Yeni build/veb bloklanmasın.

## Rollback və cari status

Azure yeni yazı/refresh token qəbul etdikdən sonra DNS/image-i geri çevirmək təkbaşına
rollback deyil; yeni data/session/financial state geri reconcile edilməlidir.
Azure authority pin-i logout-dan sonra da qalır və source-a geri qərarı
rədd edir. Pin-i silmək və köhnə backup-ı seçmək rollback üsulu deyil.

Bu sənəd **plan və qəbul şərtləridir**. 07:21:12 UTC data/Auth/storage pre-sync-i
tamamlanıb; source freeze/drain, frozen final delta və session/writer cutover
hələ icra edilməyib. 30-un store public release-i istifadəçi tərəfindən tamamlanıb.
Azure writer admission üçün final qəbul sübutları hələ tələb olunur; Google native
hotfix və RC preview aktivləşməsi bu qərarı avtomatik dəyişmir.
