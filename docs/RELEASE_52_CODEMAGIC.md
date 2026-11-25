# Anacan 52.0 (Codemagic, iOS + Android)

Hazırlanıb 2026-11-25, `main-630mc7`. `APP_VERSION` **52.0** (`codemagic.yaml`); iOS build nömrələri 52.0.0-dan,
Android `versionName` 52.0.`ANDROID_BUILD_SEQ`, `versionCode` 5200 + `ANDROID_BUILD_SEQ` (51.0.x kodlarından yuxarı).

Məzmun: stabillik mərhələ 2, bax [STABILITY_PHASE2.md](STABILITY_PHASE2.md). Native bundle 16 dilin məzmun
paketləri olmadan gedir (`codemagic.yaml` `dist/content-packs`-ı silir, `verify-bundle` yoxlayır); paketlər
https://app.anacan.az/content-packs/ ünvanından yüklənir, ona görə veb gateway-də olmalıdır.

## Buildləri başlatmaq
Codemagic → **Start new build** → branch `main-630mc7` → `ios-store`, sonra `android-store`.

## TestFlight / internal testing yoxlaması
- Giriş: e-poçt, Apple (pəncərəni bağlamaq səssiz), Google (köhnə Android-də brauzer yolu).
- Dil: fr/ky/uk kimi paket dilində məzmun ekranları (əvvəl en/ru, sonra doğma dil), təyyarə rejimində təkrar açılış.
- İnternetsiz açılış (uzun müddətdən sonra), körpə qeydləri, taymerlər, "internet yoxdur" işarəsi.
- AI söhbəti: cavab hissə-hissə, Dayandır.
- Push: tətbiq bağlı ikən toxunuş düz ekranı açır; bildiriş icazəsi onboarding addımında.
- Xatırlatmalar: 2+ uşaqla vaksin/qidalanma xatırlatmaları; vitamin hər gün.
- Android geri düyməsi dialoq/alt paneldə; iOS ağ səs kilid ekranında, səssiz düymə ilə, səs səviyyəsi.
- Satınalma/bərpa, HealthKit/Health Connect, widget (reqressiya).

## Mağaza mətni
**AZ:** Tətbiq daha yüngül və sürətli oldu, zəif internetdə və internetsiz də rahat işləyir. Bildirişlər və
xatırlatmalar daha dəqiq gəlir, Android-də geri düyməsi və iOS-də ağ səs düzəldi, giriş problemləri aradan qaldırıldı.

**EN:** A lighter, faster app that works smoothly on weak connections and offline. Notifications and reminders
arrive more reliably, the Android back button and iOS white noise are fixed, and sign-in issues are resolved.
