# Moderator paneli və Customer.io — 2026-09-29

## Canlı Azure yayımı

- Ayrı panel: **https://api.anacan.az/moderator**. Mobil tətbiqdə Profil → Moderator
  paneli. Moderator rolu mövcud Admin → İstifadəçilər rol seçimindən təyin edilir.
- Gateway **v41 / `anacan-gateway--0000043`**, ACR **cb26**:
  `anacanregistry.azurecr.io/test-gateway@sha256:54e1645e42fd5b985d79f635215e58fb3ed971453e3c2e1eb5e4f31a963032bf`.
- Functions **13**, ACR **cb24**,23 mövcud enabled route:
  `anacanregistry.azurecr.io/edge-runtime@sha256:72845d4ff1d32a3e5f47922371426c21ee5ca6403c556737d74f410ac9145275`.
- SQL33; Auth **7**, REST **`--0000001`**, Storage **9**. Auth7-nin son dəyişməsi
  GoTrue trusted-proxy `Sb-Forwarded-For` dəstəyini açır. OAuth/SMTP/identity,
  resurslar və23-route allowlist deploy zamanı müqayisə olunub.
- SQL32 reklam moderasiya worker-i əvvəlki ayrıca minute job-dur. Native admission
  **Source/generation0**; bu yayım population/data cutover deyil.

## İmkanlar və server müqaviləsi

- Admin panelindən ayrı,21 dildə responsive Moderator shell: ümumi baxış,
  tapşırıqlar, reklam yoxlaması, post/comment/story, istifadəçi tarixçəsi,
  məhdudiyyətlər, xəbərdarlıqlar, apellyasiya, IP qaydaları və audit.
- Xəbərdarlıq hesabla bağlıdır, “×” ilə bağlanır. İki dəqiqəlik göstərilmə lease-i
  açıq pəncərədə yenilənir. ACK tokeni lease dəyişsə də sabit qalır; offline
  bağlanmış bildiriş üçün yalnız ACK ID/tokeni lokal saxlanır və yenidən göndərilir.
- `full`, `community`, `post`, `story`, `comment`, `message` məhdudiyyətləri.
  Moderator müddəti60 saniyə–30 gündür; müddətsiz qərar yalnız Admin üçündür.
  Müddət bitməsi və ləğv server vaxtı ilə hesablanır; yeni cron tələb olunmur.
- Moderator başqa staff hesabını/özünü sanksiyalaşdıra və Admin qərarını götürə
  bilməz. Rol frontend bayrağından yox, DB-dən yoxlanır; bloklanmış moderatorun
  moderator RPC-lərinə də girişi bağlanır.
- Post/comment redaktəsi, auditli soft-remove/restore, post/comment pin,
  comment lock. Post redaktəsi/bərpası reklam yoxlamasına qayıdır; silinmiş postu
  köhnə worker dərc edə bilməz. Bitmiş story yeni story kimi bərpa edilmir.
- Legacy Admin düymələri eyni auditli RPC-lərə bağlanıb. Başqa müəllifin məzmununa
  birbaşa silmə/redaktə və auditdən kənar `user_blocks` yazıları rədd edilir.
  Müəllif öz postunu və onun reply/report cascade-lərini silə bilir.
- Full-account gate PostgREST, user Edge Functions, reviewed Realtime SELECT
  policies və authenticated Storage əməliyyatlarına tətbiq edilir. Status,
  xəbərdarlıq ACK-si, apellyasiya, hesab silmə və RevenueCat reconciliation
  yolları saxlanır. Public/bundled məzmunun əvvəlki nüsxəsi geri çağırılmır.
-8 private relation: `moderator_actions`, `moderator_restrictions`,
  `moderator_warnings`, `moderator_tasks`, `moderator_appeals`,
  `moderator_ip_observations`, `moderator_ip_rules`, `moderator_runtime_settings`.
  Staff/hesab sorğuları disk React Query cache-inə yazılmır.

## IP və qeydiyyat

Azure HTTP ingress-in XFF zəncirində son hop götürülür. Gateway əvvəlki alternativ
IP başlıqlarını silir/əvəz edir və canonical IP-ni `X-Forwarded-For`, `X-Real-IP`,
`X-Anacan-Client-IP` və `Sb-Forwarded-For` ilə daxili servislərə ötürür.
GoTrue-də `GOTRUE_SECURITY_SB_FORWARDED_FOR_ENABLED=true` və
`GOTRUE_HOOK_BEFORE_USER_CREATED_URI=pg-functions://postgres/public/moderator_before_user_created_v1`
qurulub. Auth/REST/Functions ingress-i internal-dır.

Qaydalar yalnız son30 gündə serverin etibarlı müşahidə etdiyi **dəqiq IP** üçün,
60 saniyə–7 gün aralığında verilə bilər. CIDR/subnet və əl ilə uydurulmuş IP qəbul
edilmir. Yeni email/OAuth/OTP hesabına tətbiq olunur; mövcud login qaydası deyil.
Paylaşılan IP barədə Moderator UI məlumat verir. Şəxsi IP-lər qəbul hesabatlarına
və gateway access log-larına yazılmır.

Hər iki gateway domenində saxta XFF, Real-IP, CF, Sb-Forwarded-For və custom
başlıqların təsirsiz olduğu yoxlanıb. GoTrue-nin `auth.sessions.ip` sahəsi burada
private connection peer-i saxlayır; hook metadata üçün müqayisə mənbəyi deyil.
IP mode hazırda **enforce**-dur. Canlı sınaqda ünvanı paylaşan başqa hesab olduğu
üçün həmin ünvanda real signup-denial canary-si edilmədi. Qeydiyyat rəddi/expiry
PostgreSQL fixture-də yoxlanıb; canlı etibarlı header daşınması və hook
konfiqurasiyası ayrıca təsdiqlənib.

## Qəbul sübutları

-21 moderator SQL ssenarisi və4 Source CDC/catalog sınağı.
-36 router/packager/scoped-AI/Source-auth testi; Moderator paneli24,
  action dialog3, warning/full-block4 test; mövcud Community/Auth/push regressiyaları.
-21 dildə həm lokal, həm deployed320/390/768/1440px UI, warning yaratma,
  şəxsi cache exclusion, birdəfəlik ACK və full-block görünüşü.
- Canlı Auth/RPC: staff qorunması, private comment redaktə/replay, pin/comment lock,
  warning/ACK, ayrı post/comment/message blokları, Admin qərarı, full REST/function
  rəddi, apellyasiya və private audit.4 test hesabı/private group təmizlənib;
  real push/e-mail alıcıları0.
- Fayllar: `azure-migration/ops/moderator-console-azure.json`,
  `moderator-runtime-build.json`, `moderator-runtime-deploy.json`,
  `moderator-api-acceptance.json`, `moderator-network-inspection.json`,
  `moderator-web-local.json`, `moderator-web-deployed.json`.

## Customer.io və native42

[Customer.io Data In müqaviləsi və real SDK qəbulu](CUSTOMERIO_DATA_IN.md).
Capacitor bridge rəsmi iOS/Android Data Pipelines SDK-larını işlədir. EU SDK
identify/track/screen batch-i HTTP200 ilə qəbul olunub; Customer.io source-events
ekranının ayrıca MCP/CLI təsdiqi yoxdur.

İzolə42.0 workspace:
`azure-migration/native-preview/native-20260929t044212-2dfb3aec/`.
Hər platformada24 bundled routing/admission/AdMob test ssenarisi və504 web asset
uyğunluğu keçir. Finalized39/40/41 və Store39 saxlanıb. Mövcud22 Swift dependency
pin-i bərpa/yoxlanıb; Firebase/messaging/RevenueCat asılılıqları yenilənməyib.

Android imzalı APK/AAB hazırdır, signer və16KB ZIP/ELF yoxlaması keçir:

- `artifacts/anacan-source-first-42.0.apk` —62,910,655 bayt,
  SHA256 `50608242a29de45c543da980973a2b5538ba5c426f1d42c6ca40b6919a4da4f9`.
- `artifacts/anacan-source-first-42.0.aab` —61,646,032 bayt,
  SHA256 `65f687b36ff05e4279d5d967ea97f0c2a0fd00a4945ca72cea2561f8ea6bfbfc`.

**iOS tam42.0 arxivi hazır deyil:** cold Xcode build müddət limitinə çatıb;
`build-ios.json`/`logs/ios-archive-1790660651023.log` və build cache saxlanılıb.
Rəsmi Customer.io iOS modulu ayrıca Release simulator SDK sınağında işləyib.
Fiziki cihaz/capture exclusion və Store upload qəbul edilməyib.

## Source sərhədi

[Source quraşdırma və Edge Function təhvili](SOURCE_MODERATOR_CONSOLE.md).
Source28 sentyabrda yenidən cavab verib; catalog `7b7ce253…15050d`, accepted/pending
sync chain saxlanıb. SQL32/33, Source worker/UI və Auth hook operator qəbulu hələ
açıqdır. Hər əvvəlki DDL-dən sonra növbəti catalog-pinned installer regenerate
edilməlidir. Source-first42 yeni moderation funksiyalarının tam işləməsi bu
quraşdırmadan asılıdır; Azure rollout bunu əvəz etmir.
