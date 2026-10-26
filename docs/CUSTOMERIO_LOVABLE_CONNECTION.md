# Lovable vasitəsilə avtomatik Customer.io qoşulması

Bu yol **mövcud Lovable Cloud bazasına Lovable hesabı ilə giriş** istifadə edir.
Supabase hesabı, database şifrəsi və Supabase access tokeni tələb etmir.

## Bir dəfəlik giriş

```sh
node azure-migration/lovable-bridge/connect.mjs connect
```

Brauzerdə **Anacan Customer.io setup** bağlantısını təsdiqləyin. Giriş bu Mac-dəki
lokal callback ilə tamamlanır. Sonra:

```sh
node azure-migration/lovable-bridge/connect.mjs verify-source
```

Köməkçi Anacan layihələrini tapır və mövcud Source bridge identity-si ilə bazanı
yoxlayır. Bir neçə uyğun layihə olarsa, Lovable layihəsinin ID-si əlavə edilə bilər:
`node azure-migration/lovable-bridge/connect.mjs verify-source <project-id>`.

Mövcud layihə üçün quraşdırma Lovable-ın rəsmi `query_database` aləti ilə aparılır.
Köməkçi yeni layihə/database yaratmır və Lovable frontend-ini publish etmir.
Source Supabase girişinin yerinə Lovable OAuth istifadə olunur; scheduler
yenə mövcud Azure mühitində işləyir.

## Server tərəfinin quraşdırılması

```sh
node azure-migration/ops/customerio-sync.mjs install-source
node azure-migration/ops/customerio-sync.mjs verify-source-runtime
```

Birinci komanda izləmə funksiyalarını və davamlı növbəni quraşdırır, əvvəlki
hesabları avtomatik növbəyə alır. İkinci komanda qeydiyyat/dəyişiklik/silinməni
yalnız öz tranzaksiya daxilindəki sınaq hesabı ilə yoxlayıb geri qaytarır.

Customer.io bağlantısı təsdiqləndikdən sonra:

```sh
node azure-migration/ops/customerio-sync.mjs activate
```

Qalan texniki müqavilə: [CUSTOMERIO_AUTOMATIC_SYNC.md](CUSTOMERIO_AUTOMATIC_SYNC.md).

## Customer.io hesabına giriş

Customer.io OAuth girişi də təsdiqlənib. Hesabdakı cari CDP açarı private
`.env.customerio-sync.local` faylına təhlükəsiz yazılıb. Yenidən giriş lazım olsa:

```sh
node azure-migration/lovable-bridge/connect.mjs --customerio connect
```

Customer.io-da workspace224149 seçilir. Giriş yalnız `read configure` scope-ları
ilə başlayıb; seqment yaratma tələbi üçün istifadəçi təsdiqi ilə `write` də əlavə
edilib. Mesaj göndərmə (`write:live`) və həssas profil oxuma scope-ları istənilmir. Hesabda MCP
istifadəsi bağlıdırsa, Customer.io admini Settings → AI bölməsində onu aktivləşdirir.

## Faktiki vəziyyət —2026-09-30

- Lovable OAuth və Source bazasına çıxış **canlı təsdiqlənib**.
- Layihə: `e07ee1f9-3d58-48fe-a7a0-068ecf028173`;
  Source: `tntbjulojatnrqmylorp`.
- `source-customerio-sync-v1` quraşdırılıb; SQL hash:
  `f9f1a7c20cbc963c8b0b92d479611b069b0b8cbcf2807ddfa66596281df802dd`.
- **14 728 hesab** ilkin növbəyə daxil edilib. Yeni dəyişikliklər də tutulur.
- Canlı qeydiyyat/profil/silinmə yoxlaması keçib; sınaq dəyişiklikləri commit olunmayıb.
- Customer.io hesabı üzrə düzgün mənbə **93570** (`React Native`), destination
  **35292** (`Journeys Workspace`) və işlək key94417 təsdiqlənib. Əvvəlki93520
  istinadı və köhnə yerli açar düzəldilib.
- Dəqiqəlik Azure işi **aktivdir**. **14 728 profil Customer.io-da təsdiqlənib**;
  ilkin və cari gözləmə/xəta sayları0-dır. Böyük ailələrin bütün uşaq məlumatları da
  qarşılaşdırılıb. Avtomatik təkrar və sonrakı dəyişikliklərin ötürülməsi işləyir.

Sübutlar: `azure-migration/ops/customerio-sync-source-installed.json`,
`customerio-sync-source-canary.json`, `customerio-sync-preflight.json`,
`customerio-sync-activation.json`, `customerio-sync-backfill.json` və
`customerio-destination-verification.json`.

OAuth məlumatları yalnız ignored `azure-migration/provider-inputs/*-mcp/`
qovluqlarında, fayllar0600/qovluqlar0700 icazəsi ilə saxlanır. İki xidmətin
tokenləri və refresh əməliyyatları ayrıdır. Köməkçi əlavə npm asılılığı tələb etmir.

Rəsmi sənədlər: [Lovable Cloud](https://docs.lovable.dev/integrations/cloud),
[Lovable MCP](https://docs.lovable.dev/integrations/lovable-mcp-server),
[Customer.io MCP](https://docs.customer.io/ai/mcp/get-started/).
