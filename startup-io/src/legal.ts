import type { Language } from './i18n';

export const LEGAL_COPY = {
  en: {
    privacy: [
      ['Privacy policy', 'startup.io is an offline arcade game developed by Atlasoon. Effective date: 7 October 2026.'],
      ['Your data stays on your device', 'Your startup name, selected sector, custom logo, game progress, credits and cosmetic collection are stored locally on this device. The developer does not receive this information.'],
      ['Photos and custom logos', 'If you choose to upload a logo, you select one image through the system picker. The image is cropped and resized locally. The game does not upload it or access the rest of your photo library.'],
      ['No tracking', 'The game includes no advertising, analytics, account registration, third-party tracking or in-app purchases. Arena opponents are computer-controlled. No real-player chat is provided.'],
      ['Deleting local data', 'Settings → Delete all progress removes your local company, logo, credits and collection. Uninstalling the app also removes local progress. Your operating system may maintain device backups according to your own backup settings.'],
      ['Contact', 'For privacy or support questions, email jamil@anacan.az. If you email support, the information in your message is used only to respond to that request.'],
    ],
    terms: [
      ['Terms of use', 'startup.io is an entertainment game. All company valuations, venture funds, credits, market cycles and acquisitions are fictional gameplay values. They have no cash value and are not financial advice.'],
      ['Local game credits', 'Credits are earned through play and exchanged for cosmetic items. They cannot be bought with real money, transferred to another player, withdrawn or exchanged for money.'],
      ['Your logo', 'Choose or upload a logo you have the right to use. Uploaded images stay on your device and are not shared with other players.'],
      ['Venture City identities', 'The built-in competitors and venture funds are fictional game identities with original artwork. They do not represent real companies or investment services. Any resemblance to an existing business is coincidental.'],
      ['Progress and availability', 'Progress is stored locally. Changing devices, deleting app data or uninstalling may remove it. Updates aim to preserve existing progress. The game is provided for personal entertainment subject to applicable consumer rights.'],
      ['Contact', 'Questions: jamil@anacan.az. Developer: Atlasoon.'],
    ],
    support: [
      ['How can we help?', 'Send a message to jamil@anacan.az with your device model, OS version and a description of the issue. Do not include passwords or private account information.'],
      ['Resume your company', 'The game saves automatically and when paused. Choose Save & leave to return to the menu, then Continue to resume the same company.'],
      ['Game credits', 'Funding, assets, acquisitions, venture funds and founder missions earn credits. Equipping an already-owned cosmetic never charges you again.'],
      ['Movement', 'Drag anywhere to move. Hold BOOST or use a second finger for speed. PIVOT gives a brief escape shield and recovers after its cooldown.'],
    ],
  },
  az: {
    privacy: [
      ['Məxfilik siyasəti', 'startup.io Atlasoon tərəfindən hazırlanmış oflayn arcade oyunudur. Qüvvəyə minmə tarixi: 7 oktyabr 2026.'],
      ['Məlumatların cihazında qalır', 'Startup adı, seçilən sahə, logo şəkli, oyun gedişatı, xallar və kolleksiya bu cihazda saxlanır. Hazırlayan tərəf bu məlumatları almır.'],
      ['Şəkil və logo', 'Logo yükləyəndə sistem seçicisi vasitəsilə bir şəkil seçirsən. Şəkil cihazda kəsilir və kiçildilir. Oyun şəkli yükləmir və foto kitabxananın qalan hissəsinə daxil olmur.'],
      ['İzləmə yoxdur', 'Oyunda reklam, analitika, hesab qeydiyyatı, üçüncü tərəf izləməsi və real pulla tətbiqdaxili alış yoxdur. Arenadakı rəqiblər botlardır. Real oyunçu çatı yoxdur.'],
      ['Lokal məlumatı silmək', 'Ayarlar → Bütün gedişatı sil şirkəti, logo şəklini, xalları və kolleksiyanı cihazdan silir. Tətbiqi silmək də lokal gedişatı silir. Əməliyyat sistemi öz backup ayarlarına əsasən cihaz ehtiyat nüsxələrini saxlaya bilər.'],
      ['Əlaqə', 'Məxfilik və dəstək üçün jamil@anacan.az ünvanına yaz. Dəstəyə göndərdiyin məlumat yalnız həmin sorğuya cavab vermək üçün istifadə edilir.'],
    ],
    terms: [
      ['İstifadə şərtləri', 'startup.io əyləncə oyunudur. Şirkət dəyərləri, Venture fondları, xallar, bazar hadisələri və satınalmalar uydurma oyun göstəriciləridir. Pul dəyəri yoxdur və maliyyə məsləhəti deyil.'],
      ['Oyun xalları', 'Xallar oynayışla qazanılır və kosmetik əşyalara dəyişilir. Real pulla alınmır, başqa oyunçuya köçürülmür, çıxarılmır və pula dəyişilmir.'],
      ['Sənin logon', 'İstifadə hüququn olan logo seç və ya yüklə. Yüklədiyin şəkillər cihazında qalır, digər oyunçularla paylaşılmır.'],
      ['Venture City brendləri', 'Hazır rəqiblər və Venture fondları orijinal artwork ilə uydurma oyun brendləridir. Real şirkətləri və yatırım xidmətlərini təmsil etmir. Mövcud biznesə oxşarlıq təsadüfidir.'],
      ['Gedişat', 'Gedişat lokal saxlanır. Cihazı dəyişmək, tətbiq məlumatını və ya tətbiqi silmək onu itirə bilər. Yenilənmələrdə mövcud gedişatın saxlanması nəzərdə tutulur. Oyun tətbiq edilən istehlakçı hüquqları ilə şəxsi əyləncə üçün təqdim edilir.'],
      ['Əlaqə', 'Suallar: jamil@anacan.az. Hazırlayan: Atlasoon.'],
    ],
    support: [
      ['Necə kömək edə bilərik?', 'Cihaz modelini, OS versiyasını və problemin təsvirini jamil@anacan.az ünvanına göndər. Şifrə və şəxsi hesab məlumatı göndərmə.'],
      ['Şirkətə davam et', 'Oyun avtomatik və fasilədə saxlanır. Saxla və çıx ilə menyuya qayıt, Davam et ilə eyni şirkəti aç.'],
      ['Oyun xalları', 'Yatırım, aktiv, satınalma, Venture fondu və founder missiyaları xal verir. Əvvəl alınmış əşyanı seçmək yenidən xal çıxmır.'],
      ['İdarəetmə', 'İstənilən yerə sürüklə. BOOST və ya ikinci barmaqla sürətlən. PIVOT qısa qaçış sipəri verir və cooldown-dan sonra yenilənir.'],
    ],
  },
} as const;
export const legalCopy = (language: Language, type: 'privacy' | 'terms' | 'support') => LEGAL_COPY[language][type];
