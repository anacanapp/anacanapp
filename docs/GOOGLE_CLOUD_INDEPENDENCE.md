# Google runtime müstəqilliyi — 2026-10-04

## Faktiki nəticə

Google əsas runtime-ı Source/Lovable və Azure runtime ünvanlarına çıxış olmadan
yoxlanıb. Project **`ninth-park-492111-m4`**, web **`gcp.anacan.az`**,
statik giriş **34.49.16.103**, çıxış **35.240.81.111**.

`google-cloud-independent-runtime.json`: **12:37:58 UTC PASS**, run
**`6f720fbf-1442-4147-a008-2386fe0c64ea`**. Deployed edge image-inin ayrıca
konteynerində Source Supabase, Lovable AI, Azure gateway/functions/Source web,
Key Vault və Azure PostgreSQL hostları bloklanıb.

11 canlı qəbul qrupu:

- eyni edge image, bloklanmış legacy hostlarla startup/health;
- Google-only test hesabının Auth yaradılması/girişi;
- edge üzərindən real Vertex tərcüməsi;
- push API → Auth/DB/inbox, əsassız başqa recipient üçün403;
- real RevenueCat v1 entitlement sorğusu, sıfır mağaza əməliyyatı;
- Firebase `anacan-mobile` FCM v1 Android/APNs **validate-only200**;
- Google moderation image-i ilə tək owned postun Gemini yoxlaması/dərc edilməsi;
- native45 v1 submit/retry, dil/feed və private-group RLS;
- scheduled push image-dən Google DB-yə verified TLS;
- Customer.io image-dən Google RPC-yə Source/Lovable olmadan giriş;
- birbaşa SMTP TLS login, sıfır e-poçt recipient-i.

FCM sınağı real cihaza bildiriş göndərməyib; telefonun göstərməsi və real mağaza
purchase/restore əməliyyatı bu receipt-lə iddia edilmir.8 test hesabı və122 public
relation üzrə qalıqlar təmizlənib:8 outbox tombstone,8 preference,3 notification;
real provider recipient0.

Runtime audit:6 servis Google registry-dədir,24 tətbiq edge route-u aktiv,
runtime/job konfiqurasiyalarında legacy host reference0.
Functions image:
`functions@sha256:f60fe67b5cdce969774042774d8a30cf532eceb865afcc9821e17082b1fb346a`.

## Credential və deploy

Google CLI artıq Azure CLI/Key Vault-a avtomatik müraciət etmir. Mövcud real
Google/Firebase credential-ları private runtime input-dan götürülüb.

- Cache: `azure-migration/provider-inputs/google-cloud/operator-credentials/`.
- `credential-store.mjs`: exact project/reference, Google token origin, RSA key,
  owner/mode/symlink yoxlamaları. Azure fallback yoxdur.
- Google Secret Manager: `anacan-operator-google-credential/versions/2`,
  `anacan-provider-firebase-credential/versions/1`.
- `prepare-jobs.mjs` default verified Google cache-dən işləyir;
 8-job hazırlığı Azure sorğusu olmadan keçib.
- İlkin origin inventarını təzədən çəkmək yalnız explicit `--capture-azure`
  rejimidir. `prepare-runtime.mjs --prepare-private-config` mövcud bootstrap
  cache-dən işləyir; cache yoxdursa səssiz Azure asılılığı yaratmır.
- Final origin export/drift işi Source/Azure girişini handoff-a qədər tələb edir;
  bu, Google runtime-in gündəlik asılılığı deyil.

Private keys, sessions və cache Git/code-handoff-a daxil edilmir.

## Canlı mobil keçid

İstifadəçi45.0 build-lərini göndərdiyini bildirib. Paketlər yenidən yığılmayıb,
dörd checksum eynidir. Cari admission **Source/generation0**, Google **shadow**,
release policy **buildApproved:false**.

[Final handoff](GOOGLE_CLOUD_AFTER_APPROVAL.md):

1. Faktiki build təsdiqi və son Source/Azure data/Auth/media delta-sı.
2. Canonical Google/Apple callback, normal signup/trusted-IP və native ilk target
   refresh qəbulu. Shadow Auth-da normal signup hazırda disabled-dir.
3. Köhnə provider/job sahibinin koordinasiyalı dayandırılması; Google tək owner.
   8 business timer-i hazırda disabled. Customer.io daxili `enabled` gate-i də
   ayrıca aktivləşdirilir; tək timer enable kifayət deyil.
4. İstifadəçi `api.anacan.az` / `app.anacan.az` DNS-i34.49.16.103-ə yönləndirir;
   admission/canonical runtime həmin pəncərədə uyğunlaşdırılır.

Mövcud45 binary-si canonical API/managed realm ilə Google-a keçə bilir; backend
işləri ayrıca native rebuild tələb etmir. Handoff-a qədər Source-first mobil
trafikinin Source-a ehtiyacı qalır.

## Provider icazəsi

RevenueCat **v1 abunəlik sinxronu keçir**. Admin gəlir metrikası üçün `a3647ee8`
v2 `/metrics/overview`12:57 UTC-də **403** qaytarıb. Metrics read icazəsi provider
operatorundan tələb olunur; bu, Azure/Lovable runtime asılılığı deyil.

Private receipts (`azure-migration/ops/`): `google-cloud-independence-audit.json`,
`google-cloud-independent-credentials.json`, `google-cloud-independent-runtime.json`,
`google-cloud-independent-fixture-cleanup.json`, `google-cloud-provider-permissions.json`.
