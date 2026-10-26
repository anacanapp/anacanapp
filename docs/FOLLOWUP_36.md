# Anacan — followup36 / 21-dil UX və regional düzəlişlər

## Yayımlanmış Azure təhvili — 2026-09-24

- Gateway **v36 / `anacan-gateway--0000034`**, ACR **cb1s**, tag `v36-followup21-20260924`:
  `sha256:49d3e2caccc401168c5b6f508fe908de4341c6d0b252e718d9c56b9e0d9f918a`.
  Deploy19:25 UTC, əvvəlki v35 image guard və konfiqurasiya müqayisəsi PASS.
- Azure SQL30 və followup public data tətbiq edilib.
- Storage `anacan-storage--0000009`:
  `sha256:efd94bcf8346ba232e03d6a37c0a35c6e9277ce43be82af0dca298a588c5e0f4`.
- Functions `anacan-functions--0000011`, ACR `cb1r`:
  `sha256:6d54e735b96b3a560d0f66b29167a4f67c364e388ddaf0279dd6573e1b245d5f`.
 23 enabled route; yeni aktiv route0, digər gates/secret references saxlanıb.
- Əsas tətbiq: **https://api.anacan.az**. Yekun maşınoxunan qəbul:
  `azure-migration/ops/followup36-release.json`.

## 16 maddənin tətbiqi

1. Görünən stage adları21 dildə Menstruasiya / Hamiləlik / Analıq ekvivalentləridir;
   onboarding header-də logo göstərilir. Artwork identifikatorları saxlanır.
2. Visual viewport və real focused field scroll-u form/dialog/sheet-lərdə paylaşılır.
   iOS overlay və Android layout-resize iki dəfə offset yaratmır.
3. Seçilmiş onboarding variantının hover/focus/active rəngləri oxunaqlıdır.
4. Premium social proof lokal formatla **10000+** göstərir.
5. Bloq paylaşımı website/app seçimi və konkret slug istifadə edir. Community/mesaj
   keçidi ayrıca article overlay açır, göndərilməmiş söhbət mətnini saxlayır.
6. İlkin vaksin və healthcare ölkəsi hesab ölkəsidir; ayrıca vaksin seçimi təsdiqlə saxlanır.
7. Yeni12 kolleksiyanın hərəsində140 ad; country description dinamikdir.
8. Exercise/Kegel daxili addımlar21 dildədir, source-bound SQL data verilir.
9. Nağıl formunda21 dil, render-time labels və lokal fictional name placeholders var.
10. Profil stage etiketi eyni shared21-dil adlarından istifadə edir.
11. AdminSecurity hər adminin public etiketini ayrı idarə edir; icazələr dəyişmir.
12. Su halqasında faiz uzun tərcümədən asılı olmayaraq mərkəzə bağlanır.
13. Yuxu/qidalanma/bez analizlərinin sorğu, cache, loading və error vəziyyəti ayrıdır.
14. Yeni12 ölkə üçün versioned qanun/qayda mətnləri və ayrıca planlama hesabı.
15. Signed-media cache persist edilmir; vaxtı bitən lease yenilənir. Köhnə audio-nun
   yanlış `video/webm` tipi storage cavabında magic/container yoxlaması ilə düzəldilir.
16. Menstrual faza başlıq/mətnləri seçilmiş dilə map edilir və SQL data ilə tamamlanır.

## Məlumat və mənbə müqaviləsi

- Names:1680 yeni public ad; Faker v9.9.0 MIT mənbə attribution-u qorunur.
  Yeni mənalar/populyarlıq reytinqləri uydurulmur.
-9 exercise /34 phase-tip,95 exact-source binding,21 dil.
- SQL30 SHA: `b5535fd710abd396883bca8fbd159f601976080c649d6575b9e67d6a16709f91`.
- Content SQL SHA: `415a7ada45b8ce9446fc1e1cee9417f6efa66b273945c2c7697c8b9bfc5d0180`.
- Names SQL SHA: `b27e3830c28911129c22372b45ae372c0cc318fa90ec4023f3a5d7e8caf7457b`.
- Mövcud child/role/name sətirlərinin qorunduğu Azure apply-də təsdiqlənib.

Dekret qaydalarının mənbələri: `src/data/maternity-regional.references.json`.
Hindistan və İndoneziya üçün əlçatmaz rəsmi səhifələrin tarixli, rəsmi PDF arxivləri
istifadə edilir və UI-da arxiv tarixi göstərilir. Fransanın/Portuqaliyanın2026 pul
hədləri başqa ilə avtomatik daşınmır. Çin/Koreya/Niderlandda fərdi pul məbləği
agentliyin hesabına yönləndirilir. İsveçdə480 ailə günü bir nəfərin analıq məzuniyyəti
kimi göstərilmir; Portuqaliyada digər valideynin günləri istifadəçinin maaşı ilə hesablanmır.
Ay əsaslı müddətlər sabit30 günə çevrilmir. Bunlar göstərilən adi əməkdaş/valideyn
planlama ssenariləridir; xüsusi hallar və şəxsi hüquq ayrıca mənbələrdə izah olunur.

## Qəbul yoxlamaları

- **105 test faylı /1097 passing app testi**, hər iki TypeScript layihəsi və diff check PASS.
- Local və deployed **21 dil**:4 keyboard-viewport ssenarisi,3 müstəqil AI bölməsi,
  country names, Kegel,21 nağıl seçimi, dekret, website/app share və chat draft preservation.
  Su faizi320/390/768px ölçülərdə mərkəzdədir; RTL dialog mərkəzlənməsi düzəldilib.
-21 dildə regional və Premium regressiyası320/390/768/1440px keçir.
 48 locale chunk hash-i,6 HTML/entry müqayisəsi,4 health və10 route yoxlaması PASS.
-7 yeni disposable Source SQL testi: nullable types, CDC/receipts, owner/admin gates,
  official-link istisnası, operator text/name preservation və frozen-writer rollback.
-14 ölkə hesabı testi;9 müstəqil AI hook testi;5 actual worker VM testi.
-13 köhnə referenced media object-in served MIME + bounded Range yoxlaması keçib.
- Yeni bundle + real Azure owned-fixture browser: audio record/preview/send/play,
  image/video upload/decode, replies, reactions, membership, admin badge/official-link
  müqaviləsi və3 ayrıca live AI sorğusu — **13 check** keçib. Cleanup3 hesab/5 obyekt,
 101 table check, remaining rows0. İlk təkrarda15s realtime timeout olmuşdu;
  ayrıca təmiz fixture run-da13 yoxlamanın hamısı keçib, hər iki run təmizlənib.

| Sübut | `azure-migration/ops/` daxilində fayl |
|---|---|
| App testləri | `followup36-vitest.json` |
| Local21 | `followup36-web-1790276918391.json` |
| Deployed21 | `followup36-web-1790279884226.json` |
| Regional21 regressiya | `regional21-web-1790280073542.json` |
| Premium21 regressiya | `premium-localization-source-1790278322530.json` |
| Canlı13 / media və scoped AI | `communications-live-azure-1790277842948.json` |
| Locale asset hashes | `localization-assets-1790278241324.json` |
| Entry/health/gates | `web-artifact-1790278244521.json` |
| Source AdMob/checkpoint | `admob-continuity-live-1790278211837.json` |

Brauzer klaviaturası/mikrofonu simulyasiya edilir; fiziki iOS/Android Store
qəbulu ayrıca qalır. Source admission20:04 UTC-də `source/generation0` olaraq yenidən
oxunub; Source259/255/open0/5cron, accepted/pending və AdMob61/13 qorunub. Population
cutover və finalized native39 bu web işinin nəticəsi kimi dəyişdirilmir.

## Supabase faylları

Tam sıra və SQL/function yolları: [SUPABASE_FOLLOWUP_36.md](SUPABASE_FOLLOWUP_36.md).
Source followup wrapper hazırlanıb, operator qəbulu açıqdır. Hər aralıq DDL-dən
sonra növbəti pending installer yenidən generate edilir.

Verified arxiv pointer-i: `azure-migration/handoffs/LATEST.json` və `VERIFIED.json`.
Yığcam SQL/Source Functions ZIP-i: `azure-migration/handoffs/SOURCE_FOLLOWUP36_LATEST.json`.
