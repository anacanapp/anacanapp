# 📱 Anacan Mobile App - Tam Deployment Təlimatı

Bu sənəd Android və iOS üçün tətbiqin başdan sona qurulması, build edilməsi və mağazalara yüklənməsi üçün **100% tam** təlimatdır.

---

## 📋 İçindəkilər

1. [Tələblər](#-tələblər)
2. [GitHub-dan Layihəni Yükləmə](#-github-dan-layihəni-yükləmə)
3. [Capacitor Quraşdırması](#-capacitor-quraşdırması)
4. [iOS Quraşdırması](#-ios-quraşdırması)
5. [Android Quraşdırması](#-android-quraşdırması)
6. [Push Notifications Quraşdırması](#-push-notifications-quraşdırması)
7. [In-App Purchases (IAP)](#-in-app-purchases-iap)
8. [Production Build](#-production-build)
9. [Mağaza Yükləmə](#-mağaza-yükləmə)
10. [Problemlər və Həlləri](#-problemlər-və-həlləri)

---

## 🔧 Tələblər

### Ümumi Tələblər
- **Node.js**: 18.0+ versiya
- **npm** və ya **bun**: Package manager
- **Git**: Version control
- **Lovable proyektinin GitHub-a export edilməsi**

### iOS Tələbləri
- **macOS kompüter** (Mac Mini, MacBook, iMac)
- **Xcode 15+** (App Store-dan yükləyin)
- **CocoaPods**: `sudo gem install cocoapods`
- **Apple Developer Hesabı**: $99/il ([developer.apple.com](https://developer.apple.com))

### Android Tələbləri
- **Android Studio** (Arctic Fox və ya daha yeni)
- **JDK 17+**: Android Studio ilə birlikdə gəlir
- **Google Play Developer Hesabı**: $25 birdəfəlik ([play.google.com/console](https://play.google.com/console))

---

## 📥 GitHub-dan Layihəni Yükləmə

### Addım 1: Lovable-dan GitHub-a Export
1. Lovable-da layihəni açın
2. **Project Settings** → **GitHub** → **Export to GitHub**
3. Repository yaradılmasını gözləyin

### Addım 2: Layihəni Klonlama
```bash
# Repository-ni klonlayın
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Qovluğa keçin
cd YOUR_REPO_NAME

# Dependencies yükləyin
npm install
```

### Addım 3: Asılılıqların Yoxlanması
```bash
# Bütün Capacitor plugin-lərinin yükləndiyini yoxlayın
npm list @capacitor/core @capacitor/ios @capacitor/android
```

---

## ⚡ Capacitor Quraşdırması

### capacitor.config.json Yoxlaması

Layihədə artıq `capacitor.config.json` faylı var. **Production build-dən əvvəl** `server` bölməsini SİLİN:

**Development (hazırda):**
```json
{
  "appId": "com.atlasoon.anacan",
  "appName": "Anacan",
  "webDir": "dist",
  "server": {
    "url": "https://e07ee1f9-3d58-48fe-a7a0-068ecf028173.lovableproject.com?forceHideBadge=true",
    "cleartext": true
  }
}
```

**Production (mağaza üçün):**
```json
{
  "appId": "com.atlasoon.anacan",
  "appName": "Anacan",
  "webDir": "dist",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "launchAutoHide": true,
      "backgroundColor": "#FAF7F4"
    },
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    }
  }
}
```

### Native Platformların Əlavə Edilməsi

```bash
# iOS platformasını əlavə et
npx cap add ios

# Android platformasını əlavə et  
npx cap add android
```

### Layihənin Build Edilməsi

```bash
# Web assets-ləri build et
npm run build

# Native platformalara sinxronizasiya et
npx cap sync
```

---

## 🍎 iOS Quraşdırması

### Addım 1: Xcode-da Açma

```bash
npx cap open ios
```

### Addım 2: Signing Konfiqurasiyası

1. Xcode-da layihəni açın
2. Sol paneldə **App** layihəsini seçin
3. **Signing & Capabilities** tabına keçin
4. **Automatically manage signing** seçimini aktiv edin
5. **Team** seçin (Apple Developer hesabınız)
6. **Bundle Identifier**: `com.atlasoon.anacan` (dəyişməyin!)

### Addım 3: Capabilities Əlavə Etmə

**Signing & Capabilities** tabında **+ Capability** düyməsini klikləyin və əlavə edin:
- **Push Notifications**
- **In-App Purchase**
- **Sign in with Apple** (əgər istifadə edilirsə)
- **Background Modes** → Remote notifications

### Addım 4: Info.plist Konfiqurasiyası

`ios/App/App/Info.plist` faylında bu açarların olduğunu yoxlayın:

```xml
<!-- Kamera icazəsi -->
<key>NSCameraUsageDescription</key>
<string>Tətbiq nəcis skaneri və şəkil yükləmək üçün kameraya ehtiyac duyur</string>

<!-- Foto kitabxanası icazəsi -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Tətbiq profil şəkli və hamiləlik albomu üçün şəkillərə ehtiyac duyur</string>

<!-- Məkan icazəsi -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Tətbiq hava vəziyyəti və geyim tövsiyələri üçün məkanınıza ehtiyac duyur</string>

<!-- Mikrofon icazəsi (ağlama analizi üçün) -->
<key>NSMicrophoneUsageDescription</key>
<string>Tətbiq körpə ağlama analizi üçün mikrofona ehtiyac duyur</string>
```

### Addım 5: App Icons

1. **Assets.xcassets** → **AppIcon** seçin
2. 1024x1024 PNG şəkil hazırlayın
3. [App Icon Generator](https://appicon.co/) saytından bütün ölçüləri yaradın
4. Uyğun yuvalara sürükləyib buraxın

### Addım 6: Launch Screen

`ios/App/App/LaunchScreen.storyboard` faylını Xcode-da açın və branding-ə uyğun düzəldin.

### Addım 7: Test Etmə

```bash
# Simulatorda işə sal
npx cap run ios

# Fiziki cihazda işə sal (USB ilə bağlı olmalıdır)
npx cap run ios --device
```

---

## 🤖 Android Quraşdırması

### Addım 1: Android Studio-da Açma

```bash
npx cap open android
```

### Addım 2: Gradle Sync

Android Studio açıldıqdan sonra:
1. **File** → **Sync Project with Gradle Files**
2. Bütün dependency-lərin yüklənməsini gözləyin

### Addım 3: SDK Konfiqurasiyası

**android/app/build.gradle** faylında:
```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        applicationId "com.atlasoon.anacan"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

### Addım 4: AndroidManifest.xml İcazələri

`android/app/src/main/AndroidManifest.xml` faylında bu icazələrin olduğunu yoxlayın:

```xml
<!-- İnternet icazəsi -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Kamera icazəsi -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Məkan icazəsi -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Mikrofon icazəsi -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<!-- Fayl icazəsi -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Vibrasiya icazəsi -->
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Push Notifications -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### Addım 5: App Icons

1. **res** qovluğunda müxtəlif ölçülü icon qovluqları yaradın:
   - `mipmap-mdpi/ic_launcher.png` (48x48)
   - `mipmap-hdpi/ic_launcher.png` (72x72)
   - `mipmap-xhdpi/ic_launcher.png` (96x96)
   - `mipmap-xxhdpi/ic_launcher.png` (144x144)
   - `mipmap-xxxhdpi/ic_launcher.png` (192x192)

2. [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/) istifadə edə bilərsiniz

### Addım 6: Splash Screen

`android/app/src/main/res/drawable/splash.xml` faylını düzəldin

### Addım 7: Test Etmə

```bash
# Emulatorda işə sal
npx cap run android

# Fiziki cihazda işə sal (USB debugging aktiv olmalıdır)
npx cap run android --device
```

---

## 🔔 Push Notifications Quraşdırması

### Firebase Konfiqurasiyası

1. [Firebase Console](https://console.firebase.google.com/) açın
2. Yeni layihə yaradın: "Anacan"
3. **Project Settings** → **General** → **Your apps**

### Android üçün Firebase

1. **Add app** → Android seçin
2. Package name: `com.atlasoon.anacan`
3. `google-services.json` faylını yükləyin
4. Faylı `android/app/` qovluğuna kopyalayın

### iOS üçün Firebase

1. **Add app** → iOS seçin
2. Bundle ID: `com.atlasoon.anacan`
3. `GoogleService-Info.plist` faylını yükləyin
4. Xcode-da **App** layihəsinə sürükləyib buraxın

### APNs Konfiqurasiyası (iOS)

1. [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list) açın
2. **Keys** → **Create a Key**
3. **Apple Push Notifications service (APNs)** seçin
4. `.p8` faylını yükləyin
5. Firebase Console → **Cloud Messaging** → **APNs Authentication Key** yükləyin

### Sinxronizasiya

```bash
npx cap sync
```

---

## 💰 In-App Purchases (IAP)

### App Store Connect Konfiqurasiyası (iOS)

1. [App Store Connect](https://appstoreconnect.apple.com) açın
2. Tətbiqi yaradın (əgər yoxdursa)
3. **Features** → **Subscriptions**
4. **Subscription Group** yaradın: "Anacan Premium"

**Məhsullar:**

| Product ID | Tip | Qiymət |
|------------|-----|--------|
| `com.atlasoon.anacan.premium.monthly` | Auto-Renewable | $3.99/ay |
| `com.atlasoon.anacan.premium.yearly` | Auto-Renewable | $29.99/il |

5. Hər məhsul üçün:
   - Display Name: "Aylıq Premium" / "İllik Premium"
   - Description: Azərbaycanca izah
   - App Store Localization

6. **Users and Access** → **Sandbox Testers** → Test hesabı əlavə edin

### Google Play Console Konfiqurasiyası (Android)

1. [Google Play Console](https://play.google.com/console) açın
2. Tətbiqi yaradın
3. **Monetize** → **Subscriptions**

**Məhsullar:**

| Product ID | Base Plan ID | Qiymət |
|------------|--------------|--------|
| `com.atlasoon.anacan.premium.monthly` | `monthly-plan` | $3.99/ay |
| `com.atlasoon.anacan.premium.yearly` | `yearly-plan` | $29.99/il |

4. **Testing** → **Internal testing** → Test hesabları əlavə edin

---

## 🏗️ Production Build

### Addım 1: capacitor.config.json Yeniləmə

`server` bölməsini SİLİN:

```json
{
  "appId": "com.atlasoon.anacan",
  "appName": "Anacan",
  "webDir": "dist",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "launchAutoHide": true,
      "backgroundColor": "#FAF7F4",
      "androidScaleType": "CENTER_CROP",
      "showSpinner": false,
      "splashFullScreen": true,
      "splashImmersive": true
    },
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    },
    "LocalNotifications": {
      "smallIcon": "ic_stat_icon",
      "iconColor": "#F97316"
    }
  },
  "ios": {
    "contentInset": "never",
    "scheme": "Anacan",
    "backgroundColor": "#FAF7F4"
  },
  "android": {
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": false,
    "backgroundColor": "#FAF7F4"
  }
}
```

### Addım 2: Web Assets Build

```bash
npm run build
npx cap sync
```

### iOS Production Build (IPA)

1. Xcode-da layihəni açın: `npx cap open ios`
2. **Product** → **Destination** → **Any iOS Device (arm64)**
3. **Product** → **Archive**
4. Archive tamamlandıqdan sonra **Distribute App** seçin
5. **App Store Connect** → **Upload**

### Android Production Build (AAB)

1. Android Studio-da layihəni açın: `npx cap open android`
2. **Build** → **Generate Signed Bundle / APK**
3. **Android App Bundle** seçin
4. **Create new keystore** və ya mövcud keystore istifadə edin

**Keystore yaratma:**
```
Key store path: /path/to/anacan-release.keystore
Password: güclü_parol
Alias: anacan
Key password: güclü_parol
Validity: 25 years
```

⚠️ **VACIB**: Keystore faylını və parolları təhlükəsiz saxlayın! İtirdiyiniz halda tətbiqi yeniləyə bilməzsiniz.

5. **release** build variant seçin
6. **Finish** klikləyin

AAB faylı: `android/app/release/app-release.aab`

---

## 🚀 Mağaza Yükləmə

### App Store Connect (iOS)

1. [App Store Connect](https://appstoreconnect.apple.com) açın
2. **My Apps** → Tətbiqi seçin
3. **App Store** tabına keçin

**Məlumatlar:**
- **App Name**: Anacan
- **Subtitle**: Hamiləlik & Ana köməkçisi
- **Privacy Policy URL**: https://anacanapp.lovable.app/legal/privacy
- **Category**: Health & Fitness
- **Age Rating**: 4+

**Screenshots (lazım olan ölçülər):**
- iPhone 6.7" Display (1290 x 2796)
- iPhone 6.5" Display (1242 x 2688)
- iPhone 5.5" Display (1242 x 2208)
- iPad Pro 12.9" (2048 x 2732)

4. **Build** bölməsində yüklənmiş IPA-nı seçin
5. **Submit for Review**

### Google Play Console (Android)

1. [Google Play Console](https://play.google.com/console) açın
2. Tətbiqi seçin
3. **Release** → **Production**

**Məlumatlar:**
- **App name**: Anacan
- **Short description**: Hamiləlik və ana köməkçisi
- **Full description**: Tam Azərbaycanca izah
- **Category**: Health & Fitness

**Screenshots:**
- Phone: 1080 x 1920 (ən az 2 şəkil)
- 7-inch tablet: 1200 x 1920
- 10-inch tablet: 1800 x 2560

**Feature Graphic:** 1024 x 500

4. AAB faylını yükləyin
5. **Review and release**

---

## 🔧 Problemlər və Həlləri

### iOS: "No signing certificate"

```bash
# Xcode → Preferences → Accounts → Apple ID əlavə edin
# Signing & Capabilities-də Team seçin
```

### iOS: CocoaPods xətası

```bash
cd ios/App
pod install --repo-update
```

### Android: "SDK location not found"

`android/local.properties` faylı yaradın:
```properties
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

### Android: Gradle Sync xətası

```bash
cd android
./gradlew clean
./gradlew build
```

### Plugin-lər tapılmır

```bash
# node_modules silin və yenidən yükləyin
rm -rf node_modules
rm -rf ios android
npm install
npx cap add ios
npx cap add android
npx cap sync
```

### IAP "Product not found"

1. Bundle ID / Package name **dəqiq** olmalıdır
2. Məhsullar **Review** statusunda olmalıdır (və ya aktiv)
3. Sandbox/Internal test hesabı istifadə edin
4. IAP məhsullarının **Ready to Submit** statusunda olduğunu yoxlayın

### Push Notifications işləmir

1. `google-services.json` (Android) düzgün yerdədir?
2. `GoogleService-Info.plist` (iOS) layihəyə əlavə edilib?
3. APNs Key Firebase-ə yüklənib?
4. Capabilities-də Push Notifications aktiv edilib?

---

## 📝 Checklist - Release Öncəsi

### Ümumi
- [ ] `capacitor.config.json`-dan `server.url` silinib
- [ ] App version nömrəsi artırılıb
- [ ] Privacy Policy URL mövcuddur
- [ ] Terms of Service URL mövcuddur

### iOS
- [ ] App Icons əlavə edilib (1024x1024)
- [ ] Launch Screen konfiqurasiya edilib
- [ ] Signing konfiqurasiya edilib
- [ ] Capabilities əlavə edilib (Push, IAP)
- [ ] Info.plist icazələri əlavə edilib
- [ ] Screenshots hazırdır (6.7", 6.5", 5.5")
- [ ] App Store məlumatları doldurulub
- [ ] IAP məhsulları yaradılıb və test edilib
- [ ] Sandbox testçilər əlavə edilib

### Android
- [ ] App Icons əlavə edilib (bütün density-lər)
- [ ] Splash screen konfiqurasiya edilib
- [ ] Keystore yaradılıb və **təhlükəsiz saxlanılır**
- [ ] google-services.json əlavə edilib
- [ ] Screenshots hazırdır
- [ ] Feature Graphic hazırdır (1024x500)
- [ ] Play Console məlumatları doldurulub
- [ ] IAP məhsulları yaradılıb və test edilib
- [ ] Internal test track qurulub

---

## 🔗 Faydalı Linklər

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Google Play Console](https://play.google.com/console)
- [Firebase Console](https://console.firebase.google.com)
- [Apple Developer Portal](https://developer.apple.com)
- [Lovable Native Apps Guide](https://docs.lovable.dev/tips/native-mobile-apps)

---

## 📞 Dəstək

Problemlər yaşadığınız halda:
1. Bu sənədə yenidən baxın
2. Error mesajlarını Google-da axtarın
3. Stack Overflow-da axtarın
4. Capacitor Discord serverinə qoşulun

---

**Son yenilənmə**: 2026-02-08  
**Versiya**: 1.0.0
