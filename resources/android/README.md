# Android Native Assets

Bu qovluq Android tətbiqi üçün lazım olan native resursları saxlayır.

## Quruluş

```
resources/android/
├── icon/
│   ├── drawable-ldpi/     (36x36)
│   ├── drawable-mdpi/     (48x48)
│   ├── drawable-hdpi/     (72x72)
│   ├── drawable-xhdpi/    (96x96)
│   ├── drawable-xxhdpi/   (144x144)
│   ├── drawable-xxxhdpi/  (192x192)
│   └── playstore-icon.png (512x512)
├── splash/
│   ├── drawable-land-*/   (landscape splash screens)
│   └── drawable-port-*/   (portrait splash screens)
└── res/
    └── values/
        └── strings.xml
```

## İkon yaratma

Capacitor Assets plugin-i ilə avtomatik yaradılır:

```bash
npx @capacitor/assets generate --android
```

## Google Play Console Quraşdırması

### IAP (In-App Purchase) Product IDs:

1. **Aylıq Premium**: `com.atlasoon.anacan.premium.monthly`
   - Tip: Subscription
   - Qiymət: $3.99 / ay
   - Base Plan ID: `monthly-plan`

2. **İllik Premium**: `com.atlasoon.anacan.premium.yearly`
   - Tip: Subscription
   - Qiymət: $29.99 / il
   - Base Plan ID: `yearly-plan`

### Lazımi addımlar:

1. Google Play Console-da tətbiq yaradın
2. App Bundle / APK yükləyin
3. Products → Subscriptions bölməsinə gedin
4. Yuxarıdakı product ID-ləri ilə abunəliklər yaradın
5. Tətbiqi daxili test üçün aktiv edin
