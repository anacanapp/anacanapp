# Stabillik, Mərhələ 2 (növbəti native build, 51.0-dan sonra)

2026-11-25 auditinin (Anacan-Problemler-ve-Hell-Yollari.pdf) build tələb edən hissəsi.

| # | Dəyişiklik | Əsas fayllar |
| --- | --- | --- |
| 5 | 16 dilin məzmun paketləri native bundle-dan çıxdı (native dist ~211 MB → 67 MB); serverdən hissə-hissə yüklənir, IndexedDB-də saxlanır, sha256 ilə yoxlanır; yüklənənə qədər en/ru | `src/lib/content-packs.ts`, `content-i18n.ts`, `scripts/i18n/content-packs.mjs`, `docs/LOCALIZATION_25.md` |
| 5 | Açılış: ayarlar və dil seed-i sessiya bərpası ilə paralel; məzmun açılışı gözlətmir | `src/bootstrap-app.tsx`, `src/lib/i18n.ts` |
| 11 | Vaxtı keçmiş sessiya + internet yox: tətbiq son məlumatla açılır, şəbəkə gələndə yenilənir və outbox göndərilir | `src/contexts/AuthContext.tsx`, `src/lib/offline-session.ts`, `OfflineSyncIndicator.tsx` |
| 12 | Captive portal cavabı native açılışı bloklamır | `backend-bootstrap.ts` |
| 13 | Bütün sorğulara vaxt limiti (REST 20 s, Auth 15 s, AI 90 s, upload 120 s); AI native-də axınla gəlir, Dayandır işləyir | `src/lib/network-timeout.ts`, `AIChatScreen.tsx` |
| 6 | Çıxışda push qeydləri, çatdırılmış bildirişlər və bütün yerli xatırlatmalar silinir | `logout-cleanup.ts`, `useDeviceToken.ts` |
| 20 | Bildiriş icazəsi açılışda soruşulmur; köhnə hesablara izahlı toast | `useDeviceToken.ts`, `useNotificationSettings.ts` |
| 21 | Push toxunuş dinləyiciləri `main.tsx`-də dərhal qoşulur, router hazır olana qədər növbədə | `src/lib/notification-taps.ts` |
| 22 | Mərkəzi yerli bildiriş planlaşdırıcısı: həmişə ən yaxın 60 (iOS 64 limiti) | `src/lib/local-notification-scheduler.ts` |
| 23 | Android geri düyməsi: əvvəl dialog/sheet, sonra ekran | `src/lib/backButton.ts`, `useOverlayBackHandler.ts`, `components/ui/*` |
| 24 | iOS ağ səs: Web Audio ilə səs səviyyəsi, `.playback` audio session, kilid ekranı | `whiteNoiseStore.ts`, `white-noise-audio.ts`, `AppDelegate.swift` |
| 26 | Google girişi köhnə Android-də brauzer ilə ehtiyat yol; Apple 1001 səssiz, 1000 aydın mesaj | `social-auth-errors.ts`, `native-auth.ts` |

## Yayımdan əvvəl lazım olanlar

1. **Veb deploy:** gateway image-i `dist/content-packs/`-ı da kopyalamalıdır (`manifest.json` no-cache,
   shard-lar immutable, gzip). Bu olmadan 16 paket dilində (veb və native) kataloq məzmunu en/ru görünür.
2. **Google brauzer ehtiyat yolu:** auth serverinin icazəli redirect siyahısına
   `com.atlasoon.anacan://auth-callback` əlavə olunmalıdır. O olmadan ehtiyat yol tətbiqə qayıda bilmir.
3. **Cihazda yoxlama (TestFlight / internal testing):** məzmun paketlərinin CapacitorHttp ilə yüklənməsi,
   iOS AI axını (`capacitor://app.anacan.az` CORS), push toxunuşu soyuq açılışda, ağ səs kilid ekranında və
   səssiz düymə ilə, Android geri düyməsi dialoqlarda, internetsiz açılış vaxtı keçmiş sessiya ilə.

## Yoxlamalar
- Bütün test dəsti: 349 fayl, 3 480 test keçdi (2 skip).
- `tsc` təmiz; `npm run build` (veb) və `VITE_NATIVE_BUILD=true` build exit 0, `verify-bundle` keçir.
- Brauzer smoke testi: veb build xətasız açılır.
