# Customer.io istifadəçi sinxronizasiyası

2026-09-29 tarixli son tələb **davamlı avtomatik sinxronizasiyadır**:
əvvəlki istifadəçilərin ilkin ötürülməsi və sonrakı qeydiyyat/dəyişiklik/silinmələr.

Aktiv müqavilə və quraşdırma:
**[CUSTOMERIO_AUTOMATIC_SYNC.md](CUSTOMERIO_AUTOMATIC_SYNC.md)**.

Mexanizm Source database-də davamlı növbə və transaction daxilində dəyişiklik
izləməsi, Azure-da isə hər dəqiqə işləyən server prosesindən ibarətdir. İlkin
istifadəçilər bir dəfə avtomatik növbələnir; sonra xidmət davam edir.

Aktivləşdirmə əmri:

```sh
node azure-migration/ops/customerio-sync.mjs activate
```

**Source bağlantısı həll olunub:** Lovable OAuth vasitəsilə runtime quraşdırılıb,
14 728 hesab ilkin növbəyə alınıb və canlı dəyişiklik izləməsi yoxlanıb.
Supabase şifrəsi/tokeni tələb olunmur. [Lovable qoşulması](CUSTOMERIO_LOVABLE_CONNECTION.md).

**Canlıdır:** düzgün Customer.io source93570/açar təsdiqlənib, dəqiqəlik Azure işi
aktivləşdirilib və14 728 profilin hamısı Customer.io-da qarşılaşdırılıb.
İlkin və cari növbə0, xəta0. Sonrakı dəyişikliklər avtomatik ötürülür.

Əvvəlki SQL/CSV və birdəfəlik import təlimatları bu davamlı server iş axını ilə
əvəzlənib. İstifadəçi məlumatının əl ilə çıxarılıb yüklənməsi tələb olunmur.
