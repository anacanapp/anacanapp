# Razılıq (consent) — analitika, fərdi reklam, reklam ölçmə

2026-11-04. Opt-in model (GDPR üçün): seçim edilənə qədər bütün əlavə kanallar sönülüdür.

## Kanallar

| Açar | Nəyi idarə edir |
| --- | --- |
| `analytics` | Firebase Analytics (native + web), daxili `analytics_events`, Customer.io ekran izləmə (`privacy_share_analytics` ilə sinxron) |
| `ads` | AdMob fərdi reklam (`npa=false` yalnız razılıqla) + Firebase Consent Mode `AD_*` |
| `attribution` | Meta App Events (yalnız `EVENT_MAP`-dakı marketinq eventləri), iOS ATT pəncərəsi, Android advertiser ID |
| Zəruri | Hesab, sinxronizasiya, push, təhlükəsizlik — həmişə aktiv |

## Kod

- `src/lib/privacyConsent.ts` — vəziyyət (localStorage + Capacitor Preferences, `anacan_privacy_consent_v1`),
  `applyPrivacyConsent()` Firebase `setEnabled`/`setConsent` və `applyFacebookConsent()` çağırır.
- `src/components/privacy/PrivacyConsentSheet.tsx` — ilk dəfə (qərar yoxdursa, daxil olmuş istifadəçiyə) çıxan pəncərə.
  "Hamısını qəbul et" və "Yalnız zəruri" bərabər çəkili; fərdiləşdirmədə açarlar əvvəlcədən sönülüdür.
- `src/components/privacy/ConsentControls.tsx` — Məxfilik ekranında (`PrivacyScreen`) eyni açarlar; Ayarlar → "Razılıq seçimləri".
- Mətnlər: `scripts/i18n/privacy-copy.json` (23 dil).
- Analitikaya sağlamlıq dəyərləri getmir (çəki, əhval, təpik sayı, kalori, ad axtarışı sorğusu çıxarılıb).

## Native standartlar (yeni build tələb edir)

- Android `AndroidManifest.xml`: `firebase_analytics_collection_enabled=false`, `google_analytics_default_allow_*=false`,
  Meta `AutoLogAppEventsEnabled=false`, `AdvertiserIDCollectionEnabled=false` (razılıqla `FbEvents.setConsent` açır).
- iOS `Info.plist`: `FIREBASE_ANALYTICS_COLLECTION_ENABLED=false`, `GOOGLE_ANALYTICS_DEFAULT_ALLOW_*=false`,
  `FacebookAutoLogAppEventsEnabled=false`. ATT pəncərəsi artıq açılışda yox, istifadəçi "Reklam ölçmə"ni seçəndə çıxır.
- Meta "app activation" eventi avtomatik deyil, razılıqla hər açılışda bir dəfə əl ilə göndərilir.
