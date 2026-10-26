# iOS Native Assets

Bu qovluq iOS tətbiqi üçün lazım olan native resursları saxlayır.

## Quruluş

```
resources/ios/
├── icon/
│   └── AppIcon.appiconset/
│       ├── Contents.json
│       └── icon-*.png (müxtəlif ölçülər)
├── splash/
│   └── Splash.storyboard
└── Assets.xcassets/
    └── AppIcon.appiconset/
```

## İkon yaratma

Capacitor Assets plugin-i ilə avtomatik yaradılır:

```bash
npx @capacitor/assets generate --ios
```

## App Store Connect Quraşdırması

### IAP (In-App Purchase) Product IDs:

1. **Aylıq Premium**: `com.atlasoon.anacan.premium.monthly`
   - Tip: Auto-Renewable Subscription
   - Qiymət: $3.99 / ay
   - Subscription Group: Premium

2. **İllik Premium**: `com.atlasoon.anacan.premium.yearly`
   - Tip: Auto-Renewable Subscription
   - Qiymət: $29.99 / il
   - Subscription Group: Premium

### Lazımi addımlar:

1. App Store Connect-da tətbiq yaradın
2. Subscriptions bölməsinə gedin
3. Subscription Group yaradın: "Premium"
4. Yuxarıdakı product ID-ləri ilə abunəliklər yaradın
5. TestFlight ilə test edin
6. Sandbox test istifadəçiləri əlavə edin

### StoreKit Configuration File (Development üçün):

Xcode-da File → New → File → StoreKit Configuration File yaradın və test məhsullarını əlavə edin.
