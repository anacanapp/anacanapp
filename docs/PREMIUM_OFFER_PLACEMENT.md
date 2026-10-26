# Reklamsız Premium təklifinin yerləşməsi

Azure web: gateway **v39 / `--0000040`**, ACR **cb20**,
`anacanregistry.azurecr.io/test-gateway@sha256:8a2a80068cb66c64cc28145e0bbe1dc40d0e6eb72633281ad6a0bc81f313852a`.
Release evidence: `azure-migration/ops/offer39-release.json`.

## Davranış

- Pulsuz istifadəçi kartı ilk dəfə gördüyü ana səhifə ziyarətində təklif yuxarıdadır.
- İlk görünmə yadda saxlanır; sonrakı ana səhifə açılışlarında kart səhifənin ən
  aşağısında, digər məzmundan sonra göstərilir.
- İlk ziyarətdə kart istifadəçi onu oxuyarkən və ya paywall açarkən yerini dəyişmir.
- Flow/Bump/Mommy bir marker istifadə edir. Dil dəyişikliyi, adi rerender və səhifənin
  yenilənməsi yuxarı təqdimatı sıfırlamır. Eyni vaxtda yalnız bir kart görünür.
- Aktiv və household Premium istifadəçilərində kart gizlənir; loading zamanı ilk
  görünmə qeydə alınmır. Marker kartın ən az yarısı görünəndə yazılır.
- Yaddaş backend/hesab üzrə ayrılmış lokal UI seçimidir:
  `anacan-ad-free-offer-seen-v1:<backend>:<user>`. Backend və ya hesab dəyişdikdə
  başqa hesabın vəziyyəti istifadə edilmir. Brauzer/tətbiq yaddaşının silinməsi və
  başqa cihaz bu lokal seçimi paylaşmır.

## Silinən blok

`WinBackCard` ana səhifənin hər iki variantından və Billing-dən çıxarılıb.
“Premium-suz darıxdıq 💛” və “3 gün pulsuz geri qayıdın” kartı göstərilmir.
`src/components/WinBackCard.tsx` silinib; code handoff manifestinin `deletedFiles`
sahəsi bu silinməni qeyd edir. Köhnə tərcümə kataloglarının unused açarları render
edilmir.

## Yoxlama

-14 component testi: lokal copy/paywall, loading/Premium, bir dəfə top, sonrakı bottom,
  hesab/backend/modul sərhədləri və həqiqi görünmə.
- App TypeScript və Azure build yoxlanır.
- `verify-premium-localization.mjs --placement` actual bundle ilə mocked backend-də
  ilk top → real reload → bottom,3 modul, standart paywall və silinmiş win-back
  mətnlərinin həm dashboard, həm Billing-də yoxluğunu yoxlayır.
- Lokal AZ/EN/AR və bütün21 dil üzrə deployed browser yoxlamaları keçib. Deployed sübutlar
  `azure-migration/ops/offer39-deployed.log` və timestamped
  `premium-localization-source-*.json` fayllarındadır.
- Yekun: `offer39-release.json`, `passed:true`;3 modul, real reload sonrası aşağı
  yerləşmə və standart Premium paywall təsdiqlənib. Deployed browser reportu:
  `premium-localization-source-1790419199019.json`.

Bu frontend dəyişiklikdir. Source SQL/function install tələb etmir; hazır tətbiq
mənbəyindən növbəti native namizədə daxil edilə bilər.
