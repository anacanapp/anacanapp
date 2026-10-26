# Real Source Auth refresh rehearsal

**Rehearsal tamamlanıb.** Real Source→Azure refresh qəbulunun 5 qrupu keçib; Azure
fixture qalıqları təmizlənib, Source fixture retirement API-dən yoxlanıb.
[Yekun 29.0 namizədi və CLI fix](AZURE_RELEASE_CANDIDATE_29.md).

## Cari nəticə — 2026-09-13

İstifadəçinin SOURCE SQL nəticəsi qəbul edilib. Snapshot vaxtı
**2026-09-13 06:52:30 UTC**:

- 13,018 istifadəçi; 13,079 sessiya; 13,079 AMR claim.
- 87,660 refresh-token sətri: 13,066 aktiv, 74,594 revoked; hamısı legacy 12-simvollu formatda.
- Session HMAC açarı/counter, MFA factor və OAuth-client session dependency sayı **0**.
- Yoxlanmış password/HMAC/MFA sahələrində encrypted JSON envelope sayı **0**.

Bu snapshot-da həmin encryption maneəsi görünmür. Final snapshot yenidən yoxlanmalıdır;
real refresh və signing/session-policy uyğunluğu ayrıca qəbul tələb edir.
Sübut: `azure-migration/ops/auth-refresh-readiness-1789290376994.json`.

### Source capture də tamamlandı

Operator fixture yaradılmasını təsdiqlədi. Real Source GoTrue **v2.196.0** ilə
password grant, ilk sessiyanın local logout/revocation rəddi, yeni sessiyada refresh
rotasiyası və eyni user/session UUID-si üzrə **4 qəbul yoxlaması keçdi**.
Sübut: `azure-migration/ops/auth-rehearsal-1789296837904.json`.

Yaradılmış Source JWT-si **ES256**, kid `92429a5b-a1e7-4a70-9294-83b0519738bb`,
issuer `https://tntbjulojatnrqmylorp.supabase.co/auth/v1`, müşahidə edilən lifetime
**3600 saniyə**dir. Onun imzası Source-un yayımladığı public JWK ilə ayrıca kriptoqrafik
yoxlamadan keçdi; fixture sub/session/audience/role də uyğun gəldi. Yoxlama vaxtında
JWT-nin vaxtı bitməmişdi. Sübut: `azure-migration/ops/source-jwt-verification-1789297174179.json`.
Bu, həmin fixture üçün aktiv açarı təsdiqləyir; bütün outstanding token/key-history
və Azure signing overlap hələ ayrıca qəbul edilməlidir.

Private Source export alındı və real Source→Azure sınağı tamamlandı:
`azure-migration/ops/auth-rehearsal-1789297847667.json`. Original refresh ilə user və
session UUID-si qorundu, iki target rotasiyası və Auth/REST uğurlu oldu; həm source-da
ləğv olunmuş token, həm target logout-dan sonrakı refresh rədd edildi. Target qalıq 0-dır.

Köhnə Source access JWT-si vaxtı bitməmiş olsa da 403 aldı. 29.0 bu yolu ilk target
istifadəsindən əvvəl real refresh/target JWT ilə bağlayır. Birbaşa Source JWT verification
Azure-da açılmayıb; seçilmiş native yol bununla işləməyə məcbur deyil.

## Hazır alətlər və keçən qəbul

`azure-migration/auth-handoff/rehearsal.mjs` yalnız yeni yaradılmış, xüsusi
`@example.invalid` ünvanlı test hesabına bağlıdır. Source-dakı başqa hesabı seçə bilən
ümumi importer/exporter deyil. User/identity/session UUID-ləri və token lineage qorunur;
serial refresh ID-ləri target sequence-dən yenidən ayrılır, mövcud sətirlər overwrite edilmir.

- 59 auth-handoff testi keçib: 29 yeni fixture/scope/lineage/rollback testi + əvvəlki 30 test.
- Real **Azure GoTrue v2.189.0** ilə self-test keçib: hesabın real password grant-i,
  revoked session, refresh rotasiyası, consistent export, təmizləmə və yenidən import;
  sonra original refresh ilə eyni user/session UUID-si, yeni JWT ilə Auth/REST,
  növbəti refresh və target logout-dan sonra rədd.
- Self-test hesabı və qalıqlar 94 public cədvəl + Auth cədvəlləri üzrə təmizlənib: **0 qalıq**.
- Bu self-testin producer-i Azure-dur. Source v2.196.0 → Azure qəbulunu avtomatik sübut etmir.

Sübut: `azure-migration/ops/auth-rehearsal-1789293297844.json`.

## İndi operatorun SOURCE addımı

Private run qovluğu:

`azure-migration/provider-inputs/auth-rehearsal-20260913t095238-85ed6522/`

1. **Tamamlanıb:** SOURCE Lovable SQL Editor-də bu qovluqdakı `source-provision.sql` işlədildi.
   Bu əməliyyat yalnız bir disposable test user və email identity yaradır; mövcud UUID
   varsa overwrite etmədən dayanır. Hesab confirmed yaradıldığı üçün email göndərilmir.
   Password lokallaşdırılmış təsadüfi dəyərdir; SQL-də yalnız onun hash-i var.
2. **Tamamlanıb:** `created: true` təsdiqindən sonra agent bu əmri işlətdi:

   ```sh
   node azure-migration/auth-handoff/rehearsal.mjs --capture-source auth-rehearsal-20260913t095238-85ed6522
   ```

   Komanda test hesabında real Source Auth password grant-i edir, ilk sessiyanı local
   logout ilə ləğv edib rəddi yoxlayır, sonra aktiv sessiya yaradır və refresh edir.
   Sessiya/refresh sətirləri SQL-lə uydurulmur; onları Source GoTrue özü yaradır.
3. **Tamamlanıb:** SOURCE SQL Editor-də `source-export.sql` işlədilib.
   Bu, yalnız həmin fixture üçün repeatable-read/read-only snapshot qaytarır.
   **Nəticə private-dir:** refresh token və password hash ehtiva edir. Çata göndərməyin;
   yalnız eyni private run qovluğunda `source-fixture.json` kimi saxlayın.
4. **Tamamlanıb:** agent real Source snapshot-ını Azure-da belə yoxladı:

   ```sh
   node azure-migration/auth-handoff/rehearsal.mjs --verify-target auth-rehearsal-20260913t095238-85ed6522
   ```

   Target fixture cleanup avtomatikdir və ayrıca təsdiqlənir. Source signing keys,
   global sessiya siyasəti və public admission bu komanda ilə dəyişmir.
5. Source fixture artıq API səviyyəsində retired görünür: password/refresh grant-ləri
   rədd edilir, public profile card yoxdur. Sübut:
   `azure-migration/ops/auth-rehearsal-1789314407598.json`. Full SQL residual audit
   ayrıca aparılmayıb; `source-cleanup.sql` həmin UUID üçün idempotent operator aləti olaraq saxlanır.

Private `state.json`, SQL-in hash-li konkret surəti və snapshot Git/code arxivinə daxil
edilmir. Ops hesabatları yalnız status, say, fixture run ID-si və sanitizasiya edilmiş
JWT alg/kid/issuer metadata-sı saxlayır; heç bir parol/access/refresh token yazmır.

Source tokenini yenidən refresh etmədən local public-key yoxlaması:

```sh
node azure-migration/auth-handoff/verify-captured-source-jwt.mjs auth-rehearsal-20260913t095238-85ed6522
```

Bu əmr yalnız public JWKS-i oxuyur; Source capture təkrarlanmır və export üçün
saxlanmış refresh lineage dəyişmir.

## Aralıq dayanma və qəbul sərhədləri

Target əməliyyatı yarımçıq qalarsa həmin run üçün:

```sh
node azure-migration/auth-handoff/rehearsal.mjs --cleanup-target auth-rehearsal-20260913t095238-85ed6522
```

Source capture yarımçıq qalarsa SOURCE cleanup-dan sonra yeni fixture hazırlanır;
köhnə snapshot-dan sessiya diriltmək rehearsal retry üsulu deyil.

Rehearsal source refresh-in qəbulunu və köhnə source JWT-nin 403 nəticəsini ayrıca
qeyd edir. Native 29 `refresh-before-use-v1` ilə API çağırışından əvvəl target JWT-si
alır; bu strategiya minimum version 29 və öz qəbul sübutunu tələb edir. Real native
upgrade, final session/data snapshot və digər buraxılış gates-i tamamlanmadan Azure
admission açılmır. Production qərarı **NO-GO**, public policy **source / generation 0** qalır.

Tam final inserts/updates/deletes, bütün production sessiyaları, files, source writer
freeze/drain, provider ownership və rollback bu fixture-only alətin scope-u deyil;
[final sync planı](AZURE_FINAL_SYNC_AFTER_APPROVAL.md) üzrə tamamlanır.
