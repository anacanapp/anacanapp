# METRO Simulator — 1.1.0 / build 2 qəbulu

**2026-10-05: iPhone13 Pro Max / iOS26.6.2, faktiki install və normal foreground
launch təsdiqlənib.** Final receipt: `artifacts/DELIVERY.json`.

| Yoxlama | Nəticə |
|---|---|
| `npm run metro:test` | **281 PASS** |
| Bütün5 marşrut /37 stansiya mərhələsi /116 qapı | PASS |
| `npm run metro:build` — Godot Web release | PASS |
| `npm run metro:test:e2e` — touch/mobile Chrome | **4 PASS** |
| Xcode arm64 / Apple Development | **0 xəta /0 xəbərdarlıq** |
| `codesign --verify --deep --strict` / team və bundle ID | PASS |
| iPhone13 Pro Max-a faktiki1.1.0/build2 install | PASS |
| Faktiki normal foreground launch / Metal3D readiness | PASS |
| Fiziki iPhone-da native3D/simulation/input acceptance | **309 PASS /0 failure** |
| Signed app/PCK SHA-256 uyğunluğu | PASS |
| Native Retina UI / notch və home-indicator safe area | PASS |
| NativeTAP →3 qapı → Əhmədli açılması → jeton | PASS |
| Native güc alışı / görünən3D kask / station lock | PASS |
| Dörd saniyəlik240 native frame interval nümunəsi | Mean17.183ms / p9516.685ms |

## Mənalı test ssenariləri

- Idle/countdown/pause/closed-door input guard, same-frame duplicateTAP guard.
- Ritm kombosu, güc, boş zolaq üstünlüyü, vaxt bonuslarının yalnız bir dəfə
  verilməsi,60-enerji bacarığı və cooldown.
- Uduzma/yenidən cəhd; üç qapıdan sonra stansiya açılması; finalda dörd qapı.
- Təkrar mükafatın iki dəfə alınmasının qarşısı; replay mükafatı; qiymət artımı,
  az jeton və max upgrade guard; baş slotunda kask/qulaqlıq əvəzlənməsi.
- Save validation, hashed envelope, atomic replacement və korrupt primary-dən
  düzgün backup bərpası. Testlər öz izolə save yolunu istifadə edir.
- Tam kampaniya yalnız earned jeton/public transition-larla oynanır; health/time/
  won-state saxtalaşdırılması ilə tamamlanmır.
- Brauzerdə real touchTAP, sonra screen-reader control callback-i ilə stabil ritm.
  Üç qapı, mağaza/güc/kask, reload-dan sonra coin/gear/station bərpası.
- Native3D personajının qapıya doğru həqiqi mövqe dəyişməsi,458 batched mesh,
  20 fon skeletli sərnişin və altı sürüşən qapı qanadı.
- 320×700,360×800,430×932,768×1024,1440×1000 və932×430 canvas/input ölçüləri.
- Fasilə sonrası davam, qazanılmış qapıdan mağazaya və geri keçid, accessibility
  controls, saxlanan səs/hərəkət ayarları.

## Sübut faylları

- `artifacts/simulation-acceptance.json`
- `artifacts/browser-acceptance.json` — yekun4-scenario report.
- `artifacts/web-build.json`
- `artifacts/ios-build2-delivery.xcresult`
- `artifacts/ios-v2-final-install.json`
- `artifacts/ios-v2-normal-launch.json`
- `artifacts/ios-v2-runtime.json`
- `artifacts/physical-device-v2/acceptance.json` — fresh physical309-check report.
- `artifacts/physical-device-v2/{home,play-paused,station-clear,wardrobe,map}.png`
- `artifacts/ios-v2-package.json` / `artifacts/DELIVERY.json`

Native ölçmə qısa acceptance sessiyasının frame-interval nəticəsidir; ayrıca uzun
thermal/battery sessiyası ölçülməyib. Test rejimi normal user save-i dəyişmir və
sonda adi oyun yenidən foreground-da açılır.

## Paket hash-i

IPA: `metro-simulator-1.1.0-ios-development.ipa` —53,395,125 bayt.

SHA-256: `151d9e5085410ef5cabf0f92ac7ff9adc47b20f09cb84cdd8fb828597ea564dc`.

PCK:26,377,528 bayt.

SHA-256: `3574a84783015cc8b83440f4b2fd217e56490f9ad7486b27d2dfc91c27929d65`.

Build/package/install sübutunu yenidən yoxlamaq:

```bash
node metro-simulator/scripts/verify-ios.mjs
```
