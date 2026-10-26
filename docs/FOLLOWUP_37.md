# Followup37 — Premium, Community blog və Mommy period

Əsas tətbiq Azure `https://api.anacan.az`-dır. Native admission Source/generation0
qalır. Gateway **v37 / `anacan-gateway--0000037`**, SQL31 və Functions12 canlıdır.
Gateway image:
`anacanregistry.azurecr.io/test-gateway@sha256:aeb0a227c92204563af7c1d376f6babb1b1400a9c2a03e1be5a2c660a79c545d`
(ACR **cb1v**, `v37-premium-blog-assets-20260925`).

## Premium

- Subscription row authoritative; expiry/refund köhnə profile/cache flag-ı ilə
  yenidən açılmır. Cancelled subscription ödənilmiş vaxtı bitənədək aktiv qalır.
-30 saniyəlik, backend/account/partner-scoped grant;15 saniyə monitor,
  realtime/focus/online yenilənməsi. Deadline monotonic saatla hesablanır.
- Təsdiqlənmiş revocation və ya deadline açıq paid tool-u unmount edib standart
  Premium paywall göstərir. Partner AI də eyni paywall-a qayıdır; alət ekranından
  kənarda çalan ağ səs də dayanır. Free alət və gündəlik-limit siyasəti saxlanır.
- Network failure lease-i uzatmır. Store/RevenueCat hadisəsinin serverə çatma
  gecikməsi bu30 saniyəlik client lease ilə eyni ölçü deyil.

## Community blog

`/Blog` və başlıq hissəsi ilə search; published/country-visible məqalə seçimi;
canonical cover/title/excerpt kartı; istifadəçinin ayrıca caption-u; kartdan exact
in-app article. Məqalənin share pəncərəsində Community-yə hazır kartla keçid də var.
Post yalnız nullable `blog_post_id` saxlayır, metadata reader-də yenidən yoxlanır.

## Mommy period

Optional banner ayrı tracker/calendar açır. Mövcud Mommy modulu, hamiləlik/cycle
profil tarixləri dəyişmir. Calendar yalnız qeydə alınan müşahidələri göstərir,
postpartum fertile/safe-day proqnozu vermir; gələcək və childbirth-dan əvvəlki
tarix seçilmir.21-dil source-bound UI copy istifadə olunur.

## Native capture

Yalnız əsas dashboard capture üçün açıqdır. Android FLAG_SECURE; iOS secure-text
surface və native qara curtain; JS də protected capture hadisəsində fully opaque
qara overlay göstərir. Fiziki iOS screenshot nəticəsi **hələ qəbul edilməyib**:
[NATIVE_40.md](NATIVE_40.md). Web deploy native plugin yeniləməsinin əvəzi deyil.

## Backend və təhvil

- SQL: `azure-migration/sql/31-premium-blog-continuity.sql`.
- Functions: `anacan-functions--0000012`,23 enabled route; digər gate/config saxlanır.
- Functions image: `sha256:36b222d06c72da884df9f7621e5737b62ed49de38c915b05af0502737ecdfea1`.
- SQL31 SHA: `516db24e2970ced3cfb8cf94eab163e0082a48407aacf67107e41a157409413c`.
- **1113 app testi**, hər iki TypeScript yoxlaması,7 disposable Source SQL və50
  payment-safety testi keçir. Local AZ/EN/AR yeni UI smoke və bütün21 dilin
  deployed UI, regional və Premium regressiya yoxlamaları PASS.
-6 entry/HTML,4 health,10 route və48 locale-chunk hash deployed yoxlamaları PASS.
- Source wrapper/functions operator acceptance açıqdır:
  [SUPABASE_FOLLOWUP_37.md](SUPABASE_FOLLOWUP_37.md).
- Source bundle pointer: `azure-migration/handoffs/SOURCE_FOLLOWUP37_LATEST.json`.
- Full code/evidence pointer: `azure-migration/handoffs/LATEST.json` /`VERIFIED.json`.
- Final maşınoxunan release sübutu: `azure-migration/ops/followup37-release.json`.

Canlı owned-fixture qəbulunda expiry/refund, Mommy log/profile preservation və
`/Blog`→caption→private fixture post→card→exact article keçdi;3 hesab/101 cədvəl,
qalıq0 cleanup təsdiqləndi. Brauzer capture yoxlaması fiziki native capture testi deyil.

## Paketləmə düzəlişi

İlk v37 image-i (`--0000035`) private build umask-dan gələn statik fayl icazəsi
səbəbindən403 qaytardı. İşlək v36 image-i dərhal `--0000036` ilə bərpa edildi və
hər iki origin200 qaytardı. Final image public document root-un read/traverse
icazəsini normallaşdırır. ACR build zamanı real nginx başlatmaqla index, admission
və bütün JS/CSS faylları HTTP ilə oxunur; səhv image artıq bu mərhələdə rədd edilir.
Final `--0000037` konfiqurasiya/secret/resource/gate-ləri qorumaqla yayımlandı.

## Yekun sübutlar

`azure-migration/ops/followup37-release.json` — `passed:true`, scope
`azure-web-and-native-packaging`; Source operator və physical capture qəbulu ayrıca açıqdır.

- Deployed21 UI: `followup36-web-1790323032097.json` (`feature37:true`).
- Regional21: `regional21-web-1790323292543.json`.
- Premium21: `premium-localization-source-1790322671360.json`.
- Canlı yeni axınlar: `communications-live-azure-1790322470577.json`.
- Native40: hər iki paket/imza və496 asset/platform qəbulu — [NATIVE_40.md](NATIVE_40.md).
- Hər iki finalized39 workspace assets/signing yoxlaması `changed:[]` qaytarıb.
