# Anacan Mobile App - Asset Requirements Guide

## 📱 Mobil Tətbiq üçün Yaradılmalı Olan Resurslar

Bu sənəd iOS və Android platformaları üçün lazım olan bütün asset-ləri və onların ölçülərini əhatə edir.

---

## 🍎 iOS Assets

### App Icons (AppIcon.appiconset)

**Qovluq yeri:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

| Ölçü (px) | Fayl adı | Təyinat |
|-----------|----------|---------|
| 20x20 | `icon-20.png` | iPad Notifications |
| 29x29 | `icon-29.png` | Settings |
| 40x40 | `icon-40.png` | Spotlight |
| 58x58 | `icon-29@2x.png` | Settings @2x |
| 60x60 | `icon-20@3x.png` | iPhone Notifications @3x |
| 76x76 | `icon-76.png` | iPad Home |
| 80x80 | `icon-40@2x.png` | Spotlight @2x |
| 87x87 | `icon-29@3x.png` | Settings @3x |
| 120x120 | `icon-60@2x.png` | iPhone Home @2x |
| 152x152 | `icon-76@2x.png` | iPad Home @2x |
| 167x167 | `icon-83.5@2x.png` | iPad Pro |
| 180x180 | `icon-60@3x.png` | iPhone Home @3x |
| 1024x1024 | `icon-1024.png` | App Store |

**Vacib qeydlər:**
- Bütün ikonlar **kare** olmalıdır
- **Şəffaflıq yoxdur** - ağ/rəngli arxa plan olmalıdır
- Küncləri **yuvarlaqlaşdırmayın** - iOS avtomatik edir
- Format: **PNG** (RGB, 8-bit)

### Splash Screens (LaunchImage)

**Qovluq yeri:** `ios/App/App/Assets.xcassets/Splash.imageset/`

| Ölçü (px) | Fayl adı | Cihaz |
|-----------|----------|-------|
| 1242x2688 | `splash-2688h.png` | iPhone XS Max, 11 Pro Max |
| 1125x2436 | `splash-2436h.png` | iPhone X, XS, 11 Pro |
| 828x1792 | `splash-1792h.png` | iPhone XR, 11 |
| 1242x2208 | `splash-2208h.png` | iPhone 8 Plus |
| 750x1334 | `splash-1334h.png` | iPhone 8, SE |
| 2048x2732 | `splash-2732h.png` | iPad Pro 12.9" |
| 1668x2388 | `splash-2388h.png` | iPad Pro 11" |
| 1536x2048 | `splash-2048h.png` | iPad Air |

**Alternativ (tövsiyə edilən):** Storyboard LaunchScreen istifadə edin

---

## 🤖 Android Assets

### App Icons (mipmap)

**Qovluq yeri:** `android/app/src/main/res/`

| Qovluq | Ölçü (px) | DPI |
|--------|-----------|-----|
| `mipmap-mdpi/` | 48x48 | 160 dpi |
| `mipmap-hdpi/` | 72x72 | 240 dpi |
| `mipmap-xhdpi/` | 96x96 | 320 dpi |
| `mipmap-xxhdpi/` | 144x144 | 480 dpi |
| `mipmap-xxxhdpi/` | 192x192 | 640 dpi |

**Fayl adları:**
- `ic_launcher.png` - Standart ikon
- `ic_launcher_round.png` - Dairəvi ikon
- `ic_launcher_foreground.png` - Adaptive ikon (ön plan)
- `ic_launcher_background.png` - Adaptive ikon (arxa plan)

**Adaptive Icons üçün:**
- Foreground: 432x432 px (108dp x 4)
- Background: Eyni ölçü
- Safe zone: Mərkəzdə 66dp dairə

### Splash Screens (drawable)

**Qovluq yeri:** `android/app/src/main/res/`

| Qovluq | Ölçü (px) |
|--------|-----------|
| `drawable-land-mdpi/` | 480x320 |
| `drawable-land-hdpi/` | 800x480 |
| `drawable-land-xhdpi/` | 1280x720 |
| `drawable-land-xxhdpi/` | 1600x960 |
| `drawable-land-xxxhdpi/` | 1920x1080 |
| `drawable-port-mdpi/` | 320x480 |
| `drawable-port-hdpi/` | 480x800 |
| `drawable-port-xhdpi/` | 720x1280 |
| `drawable-port-xxhdpi/` | 960x1600 |
| `drawable-port-xxxhdpi/` | 1080x1920 |

**Fayl adı:** `splash.png`

---

## 🛒 App Store / Play Store Assets

### App Store (iOS)

| Asset | Ölçü | Format |
|-------|------|--------|
| App Icon | 1024x1024 | PNG (RGB) |
| Screenshots iPhone 6.7" | 1290x2796 | PNG/JPEG |
| Screenshots iPhone 6.5" | 1284x2778 | PNG/JPEG |
| Screenshots iPhone 5.5" | 1242x2208 | PNG/JPEG |
| Screenshots iPad 12.9" | 2048x2732 | PNG/JPEG |
| App Preview Video | 1080p/4K | MOV/MP4 |

### Play Store (Android)

| Asset | Ölçü | Format |
|-------|------|--------|
| App Icon | 512x512 | PNG (32-bit) |
| Feature Graphic | 1024x500 | PNG/JPEG |
| Screenshots | 320-3840 px arası | PNG/JPEG |
| Promo Video | YouTube linki | - |
| TV Banner | 1280x720 | PNG/JPEG |

---

## 🔧 Avtomatik Yaratma

### Capacitor Assets Plugin istifadə edin:

```bash
# Əvvəlcə plugin quraşdırın
npm install @capacitor/assets --save-dev

# Mənbə şəkilləri hazırlayın:
# - resources/icon.png (1024x1024)
# - resources/splash.png (2732x2732)

# Avtomatik yaradın
npx @capacitor/assets generate
```

### Mənbə fayl tələbləri:

| Fayl | Minimum Ölçü | Tövsiyə |
|------|--------------|---------|
| `icon.png` | 1024x1024 | Kare, şəffafsız |
| `splash.png` | 2732x2732 | Mərkəzləşdirilmiş logo |
| `icon-foreground.png` | 1024x1024 | Adaptive ikon üçün |
| `icon-background.png` | 1024x1024 | Adaptive ikon üçün |

---

## 📁 Qovluq Strukturu

```
resources/
├── icon.png                    # Əsas ikon (1024x1024)
├── icon-foreground.png         # Android adaptive ikon
├── icon-background.png         # Android adaptive arxa plan
├── splash.png                  # Splash screen (2732x2732)
├── ios/
│   ├── icon/
│   │   └── AppIcon.appiconset/
│   │       ├── Contents.json
│   │       └── icon-*.png
│   └── splash/
│       └── Splash.imageset/
│           ├── Contents.json
│           └── splash-*.png
└── android/
    ├── icon/
    │   ├── mipmap-mdpi/
    │   ├── mipmap-hdpi/
    │   ├── mipmap-xhdpi/
    │   ├── mipmap-xxhdpi/
    │   └── mipmap-xxxhdpi/
    └── splash/
        ├── drawable-port-mdpi/
        ├── drawable-port-hdpi/
        ├── drawable-port-xhdpi/
        ├── drawable-port-xxhdpi/
        ├── drawable-port-xxxhdpi/
        └── drawable-land-*/
```

---

## ✅ Checklist

### Ümumi:
- [ ] Əsas ikon hazır (1024x1024, PNG)
- [ ] Splash screen hazır (2732x2732, PNG)
- [ ] App Store açıqlaması (az/en)
- [ ] Screenshots hazır

### iOS:
- [ ] AppIcon.appiconset/ tam
- [ ] LaunchImage/Storyboard hazır
- [ ] App Store Connect-da metadata

### Android:
- [ ] mipmap-*/ qovluqları tam
- [ ] drawable-*/ splash-lar tam
- [ ] Play Store graphics

---

## 🎨 Dizayn Tövsiyələri

1. **İkon dizaynı:**
   - Sadə və tanınan
   - Kiçik ölçüdə də aydın
   - Brend rəngləri (#F97316 narıncı)

2. **Splash screen:**
   - Logo mərkəzdə
   - Ağ/beige arxa plan
   - Yükləmə animasiyası yoxdur (statik şəkil)

3. **Screenshots:**
   - Real app görüntüləri
   - Azərbaycan dilində
   - Əsas xüsusiyyətləri göstərin

---

## 🆘 Əlavə Kömək

- [Capacitor Assets Plugin](https://capacitorjs.com/docs/guides/splash-screens-and-icons)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Android Adaptive Icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
