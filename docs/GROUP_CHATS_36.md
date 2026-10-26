# Yazışma qrupları — 36.0 / 2026-09-21

İstifadəçinin yeni tələbinə uyğun olaraq Qruplar artıq hamiləlik/doğum ayı və
kateqoriya siyahısı deyil: **Public/Private yazışma qruplarıdır**.

## İstifadəçi axını

- **Qrup yarat:** ad, haqqında, Public/Private və ilk dəvət ediləcək istifadəçilər.
- **Public:** bloklanmayan hər istifadəçi özü qoşula bilər.
- **Private:** yalnız yaradanın istifadəçiyə dəvəti və ya qoşulma sorğusunu təsdiqi.
  Dəvət olunan Qəbul et/Rədd et seçir; sorğu göndərən təsdiq gözləyir.
- **Sahib idarəetməsi:** üzv çıxarma/bloklama/bloku açma, dəvət/sorğular, idarəçi
  təyin etmə/çıxarma, sahibliyi ötürmə, qrup adı/haqqında/məxfilik, yalnız
  idarəçilərin yaza bilməsi və qrupu bağlama/silmə.
- **Mesaj silmək:** yaradıcı/idarəçi başqasının mesajını, üzv öz mesajını silə bilər.
  Server icazəni yoxlayır; reaksiyalar/reply FK-ləri ardıcıl təmizlənir.
- **Mesajlar:** istifadəçinin yaratdığı/qoşulduğu qruplar, mesajı olmayan yeni
  qruplar da daxil, DM/partner söhbətləri ilə bir siyahıda görünür. Son mesaj,
  oxunmamış say və bir toxunuşla həmin qrupa keçid var. Dəvətlər ayrıca göstərilir.
- **Community → Qrup etiketlə:** öz qruplarından ən çox 3-nü posta əlavə etmək olur.
  Qrup kartı Public/Private tipini göstərir; toxunuş söhbəti və ya qoşulma/təsdiq
  ekranını açır. Anonim paylaşım seçiləndə composer seçilmiş etiketləri təmizləyir.

Qrup yaratma və status dəyişiklikləri istifadəçi/məxfilik/owner qaydalarına serverdə
bağlıdır. Private qrupun mesajları/üzv siyahısı təsdiqdən əvvəl oxunmur. Sorğu və
dəvət bildirişləri idempotentdir. Bloklanan üzv birbaşa REST və köhnə v2 join RPC-si
ilə də geri daxil ola bilmir.

## Köhnə qruplar

Hər iki backend-də **26 köhnə kateqoriya qrupu** aktiv siyahıdan çıxarılıb və avtomatik
qoşulma dayandırılıb. İki tarixi postun FK əlaqəsini cascade ilə silməmək üçün
kateqoriya sətirləri arxiv statusunda saxlanılır; yeni UI/RPC onları göstərmir.
Yeni qruplar yalnız istifadəçinin açıq seçimi ilə yaradılır/qoşulur.

## Backend / deployment

- Ortaq migration: `azure-migration/sql/22-group-chats.sql`.
- Source wrapper: `azure-migration/source-compat/source-group-chats-v3.sql`.
- Source runtime `anacan-group-chats-v3`, version 3: bütün policy flag-ləri canlıda true.
- Source **259 cədvəl / 255 guarded relation**; yeni `group_chat_access` eyni
  transaction-da CDC/writer guard-a qoşulub. Dəyişmiş `community_groups` və
  `community_posts` üçün exact-shape replacement marker-ləri yazılıb.
- Source catalog SHA-256:
  `38137dabfa605c02abd72ab1bbda3a1b5e81658d3b116794b440ff6119f628eb`.
- Accepted `8e22f4f9-23ed-49b6-9069-75c2793e3c83`, pending
  `755ec961-7566-42d7-8e34-fb94eec834e1`; writer open/generation 0 və 5 Source cron.
- Azure gateway **`anacan-gateway--0000024`**, tag `v26-group-chats-20260921`, ACR `cb1a`:
  `sha256:1580e2f188722b4f6a088e7634556ac27f576dadeb3bc43a11621f618624226c`.
- Functions `--0000006`, Storage `--0000008`; əvvəlki event push/MIME/CORS müqavilələri
  [35.0 qeydinə](COMMUNICATIONS_35.md) uyğundur. Native admission hələ Source/generation 0-dır.

## Qəbul

- **8 PostgreSQL/Source CDC ssenarisi:** retirement/post preservation, invitation/
  approval, raw REST/actor rejection, ban/unban, owner message delete/announcement
  mode, creator-only post tags, ownership transfer/closure, writer freeze və
  credential-free read-only schema-drift diaqnostikası.
- **148 əlaqəli UI/hook/navigation yoxlaması**, hər iki TypeScript layihəsi keçib.
  Partner Mesajlar tabı indi də vahid inbox-u göstərir; uyğun test yeni müqaviləyə keçirilib.
- Canlı Source: `communications-live-source-1790013575780.json`, 5 qrup sınağı.
  Real Source Auth/REST və 36.0 Android web bundle-i; native transport simulyasiya edilir.
- Canlı Azure: `communications-live-azure-1790014789407.json`, 5 qrup sınağı.
  UI-dən sahib təsdiqi, başqasının mesajını silmə, Mesajlardan dəqiq qrupa giriş,
  post etiketindən qrupa keçid yoxlanıb.
- Hər iki canlı sınaqda 3 test hesabı və yaratdığı 2 qrup təmizlənib. Azure 100
  cədvəl üzrə qalıq 0 qaytarıb. Source catalog/accepted/pending dəyişməyib.
- Web bytes/health/gates: `web-artifact-1790014666338.json`.
- Report-lar `azure-migration/ops/` altındadır. Heç bir real cihaz token-i qeydiyyata
  alınmayıb; test hesablarının push preferences-i bağlıdır.

## Native 36.0

Run: `native-20260921t175037-c58ab799` — eyni Source-first tətbiq kodu, real AdMob
App ID-ləri, `com.atlasoon.anacan`, team `8B6976J8H7`, mövcud widget/App Group və
WebView `app.anacan.az`.

Hər iki platformanın **344 code asset / 13 bundled session-admission ssenarisi**
keçib. Native build nəticələri və paket heşləri run qovluğundakı `build-ios.json`,
`build-android.json` və `artifacts/` altında saxlanılır.

- [Xcode project](../azure-migration/native-preview/native-20260921t175037-c58ab799/workspace/ios/App/App.xcodeproj)
- [Android APK](../azure-migration/native-preview/native-20260921t175037-c58ab799/artifacts/anacan-source-first-36.0.apk)
- [Android AAB](../azure-migration/native-preview/native-20260921t175037-c58ab799/artifacts/anacan-source-first-36.0.aab)
- [iOS development IPA](../azure-migration/native-preview/native-20260921t175037-c58ab799/artifacts/anacan-source-first-36.0-development.ipa)

| Paket | Byte | SHA-256 |
| --- | ---: | --- |
| APK | 32,028,659 | `ad3dbb55d461303225caa913ce170fe9fe1caea86aef0e3b69e19bf62e9f817f` |
| AAB | 30,747,898 | `f4cefbfb2bc4c5b52c516ced8e8a9b789027ae53157a54c07d292869edf00b72` |
| IPA | 20,114,811 | `2a6e59f527bd99c93c94bb15db55cf315fb019b0911b3eef7eb77e4b629ed0e9` |

Bu, yeni store publication və ya Azure population cutover deyil. Fiziki cihazda
install/permission qəbulunun statusu native delivery hesabatı ilə ayrıca yoxlanılır.

Son imza/ZIP/asset yoxlamaları:
`native-ios-verification-1790016221185.json` və
`native-android-verification-1790016238931.json` — hər ikisi PASS.
Android-də permission guard, keyboard resize və 16 KB alignment təsdiqlənib.
`ios-device-test-1790016926919.json` paket/344 asset/AdMob metadata-nı yoxlayıb,
amma iPhone bağlı olmadığı üçün cihaz mərhələsi tamamlanmayıb; quraşdırma aparılmayıb.

## Sonradan görülən Source schema fərqi

Qrup quraşdırılması və canlı sınaqlar zamanı 259/255 catalog və accepted/pending
zəncirinin qorunması yoxlanıb. **18:29 UTC** son recheck isə
`ANACAN_SYNC_SCHEMA_CHANGED_REBASE_REQUIRED` qaytarıb
(`source-runtime-live-1790015347227.json`). Qrup v3 müqaviləsi yenə bütün flag-ləri
true qaytarır. Fərqin nədən yarandığı hələ təsdiqlənməyib.

Sonrakı metadata Supabase Storage lifecycle sütunları və indeks yeniləməsini təsdiqlədi.
Reviewed `source-storage-platform-v1.sql` tətbiq edildi, status/writer və dəyişməyən
accepted/pending zənciri yoxlandı. Təfərrüat: [37.0 qeydi](COMMUNITY_POLISH_37.md).
Tarixi warm delta üçün ayrıca replan tələbi qüvvədədir.

## Davam əmrləri

```sh
node --test azure-migration/source-compat/group-chats.test.mjs
node azure-migration/source-compat/verify-runtime.mjs
node azure-migration/ops/verify-communications-source.mjs
node azure-migration/ops/verify-communications.mjs azure --groups-web
node azure-migration/ops/verify-communications.mjs source --groups-native native-20260921t175037-c58ab799 android
```

Source SQL artıq tətbiq edilmiş versiyadır; həmin faylı dəyişib eyni hash/version
kimi replay etmək olmaz. Sonrakı schema dəyişiklikləri ayrıca reviewed migration
və mövcud pending delta üçün replan tələb edir.
