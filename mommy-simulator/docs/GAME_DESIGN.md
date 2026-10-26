# Mommy Simulator · Hamiləlikdən Analığa

## Oyun vədi

Anacan-ın məlumat kitabxanasından ilham alan, analar üçün isti, yaradıcı və
əyləncəli bir həyat simulatoru. Ana öz hekayəsinin qəhrəmanıdır. Kiçik qayğı
anları, rahat ev, ailə dəstəyi və körpənin ilk kəşfləri oyunun əsasını təşkil edir.

## 0.2.0 — ardıcıl həyat simulatoru

- Real vaxtda işləyən 3D, damı açıq ev və bağ; gündüz/gecə işığı, kölgələr,
  küləklə hərəkət edən ağaclar, hərəkət/pozaları olan ana və ailə.
- Əşyaya toxun → ora get → məşğuliyyət seç → nəticəni dünyada gör.
- 14 fəsil: test, ilk ultrasəs, trimestrlərin gündəlik həyatı, ilk hərəkət,
  ikinci müayinə, üçüncü trimestr, körpə otağının qurulması, doğuş planı,
  doğuş, ilk qucaq, evə dönüş, rutin,6 aylıq kəşflər və ilk yaş.
- Ana üçün enerji, qida, əhval; körpə üçün qida, yuxu, rahatlıq və bağlılıq.
- Hər fəslin çoxaddımlı ardıcıl missiyası, təcrübə/səviyyə, bacarıqlar,
  xatirələr və seçimli ailə hadisələri.
- Test/görüş/ultrasəs, doğrama/ocaq/süfrə, nəfəs ritmi, drag-and-drop beşik,
  doğum çantası, ad, doğuş planı, dalğa zamanlayıcısı, körpə qayğısı, oturacaq,
  rutin, layla və yaddaş oyunları. Doğuş ayrıca beş səhnəli 3D təcrübədir.
- 3D klinika: həkim, müayinə kreslosu, ultrasəs cihazı, doğuş otağı,
  monitor, yeni doğulmuş beşiyi, dəyişmə guşəsi və reception.
- Avatarın dəri/saç/geyim seçimləri; ev üçün rəng mövzuları və yerləşdirilən dekor.
- Google kitabxanasından hamiləlik qeydləri, reseptlər, adlar, çanta siyahısı və
  körpə mərhələləri. Hər qeydin mənbə ID-si saxlanır.
- Telefonda avtomatik save + ehtiyat nüsxə. App bağlandıqda dünya gözləyir.
- Kamera rejimi və şəxsi xatirə albomu; foto paylaşmaq mümkündür.

## Oyun dövrəsi

1. Hekayənin mərhələsini, ananın/körpənin ehtiyaclarını və növbəti addımı gör.
2. Addımı seç; personaj əşyaya gedir, kamera səhnəyə yaxınlaşır.
3. İnteraktiv səhnədə sürüşdür, doğra, fokusla, ritmi tut və seçimlər et.
4. Nəticə görünən dünyada və save-də qalır: beşik qurulur, çanta hazır olur,
   ultrasəs alboma yazılır, doğuş yolu və qidalandırma metodu saxlanır.
5. Missiyanı bitir, mükafatı al, növbəti fəsilə keç. Arada sərbəst ev həyatı oyna.

Bir oyun günü bir neçə dəqiqəlik sessiya üçündür. Hamiləlik və böyümə vaxtı
hekayə üçün sürətləndirilir. Fəsil onun bütün missiya addımları bitəndə açılır.
Müayinə və doğuş üçün home/clinic location və ardıcıllıq tələb olunur.
Oyun ehtiyacları real sağlamlıq ölçüsü deyil.
İstirahət və ailədən kömək istəmək dəyərli oyun hərəkətləridir.

## Görünüş sistemi

**Şəxsiyyət:** qayğıkeş, oynaq, xəyalpərəst, sakit. Caregiver + Creator.

| Token | Rəng | İstifadə |
|---|---|---|
| Forest ink | `#33433E` | oxunaqlı mətn |
| Willow | `#688775` | əsas əməl, hekayə |
| Warm rose | `#D5B5A6` | sevgi, ailə |
| Garden | `#A9BC85` | rahatlıq, uğur |
| Antique gold | `#BBA171` | sikkə, kiçik vurğu |
| Linen | `#F5F1E8` | panellər |

Manrope + DM Serif Display: yığcam oyun HUD-u və yetkin hekayə tipoqrafiyası.
Nunito əvvəlki component baza compatibility-si üçün paketdə qalır.
3D obyektlər: yumru kənar, krem divar, ağcaqayın ağacı, toxuma parçalar,
isti günəş, əldə hazırlanmış kimi detallı kiçik diorama.
Panellər: 12–24px radius, incə sərhəd, krem/adaçayı tonları, yumşaq kölgə.
Kamera: rotate/pinch, fəaliyyət focus-u, portrait/landscape framing.

## Texniki quruluş

React + TypeScript UI, Three.js dünya, Capacitor 8 native iOS/Android.
2026-10-05 tam dünya tələbi üçün native Godot4.7.2 mənbəyi `godot/` daxilində
əlavə edilib; iOS0.3.0/build4 renderer-i Metal-dır. [Native3D müqaviləsi](NATIVE_3D.md).
Bu mərhələ art prototipidir; istifadəçinin PUBG/COD vizual hədəfi ayrı son-keyfiyyət
mərhələsi olaraq saxlanır.
Simulyasiya render-dən ayrıdır. Təmiz reducer bütün əməl, mükafat və keçidləri
yoxlayır. A* gəzinti evin maneələrini nəzərə alır. Native Preferences durable
save, Haptics toxunuş reaksiyası, Filesystem/Share şəxsi foto paylaşımı üçündür.

Google yalnız aktiv ictimai kataloq oxusudur. Oyun heç bir şəxsi istifadəçi
qeydini oxumur. Snapshot offline paketdədir; yenilənmə üçün whitelist GET
adapteri var. Lokal game save yeni Anacan data relation yaratmır.

## Növbəti genişləndirmə xətti

Əlavə məhəllə/görüş yerləri, daha böyük evlər, sərbəst divar tikintisi,
əl ilə hazırlanmış əlavə personaj/animasiya paketləri, əlavə ailə hekayələri,
istəyə bağlı hesablararası save və daha çox UI dili. Bunlar ayrıca məzmun və
buraxılış mərhələləridir; hazır test paketinin funksiyaları yuxarıda göstərilib.
