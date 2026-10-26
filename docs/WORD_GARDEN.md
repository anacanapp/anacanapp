# Söz bağı — Azərbaycan dilində söz oyunu

## Hazır funksiyalar

Tətbiqdə **Alətlər → Mini Oyunlar → Söz bağı**.

- Barmaqla hərfləri birləşdirmə, bir-bir toxunma və klaviatura ilə söz yaratma.
- Kəsişən söz lövhəsi, söz tapıldıqda açılan xanalar və ayrıca bonus söz kolleksiyası.
- **Rahat** rejimdə vaxt məhdudiyyəti yoxdur; **Vaxtlı** rejimdə görünən sayğac,
  çətinliyə uyğun **25–100 saniyə**, fasilə və təsdiqlənmiş mükafatla əlavə vaxt var.
  İlk səviyyə31saniyədir;2sözlü asan səviyyələr25saniyə. Söz/hərf sayı artdıqca
  vaxt artır. Sayğac **“Oyuna başla”** toxunuşundan sonra işləyir.
- Yuxarıda aydın söz/vaxt statusu, ayrıca böyük lövhə, altda hərf çarxı və söz
  giriş sahəsi var. Kiçik telefonlarda giriş çarxın yanında, landscape-də
  lövhə və çarx yan-yana yerləşir; aktiv oyunda scroll tələb olunmur.
- Söz nömrəsi/uzunluğu göstəricisinə toxunmaq onun xanalarını vurğulayır;
  hərf açmır və ipucu ləçəyi xərcləmir. Alt paneldə **İpucu / Bonus / Fasilə**.
- Azərbaycan əlifbasının **Ə, I/İ, Ğ, Ö, Ü, Ç, Ş** hərfləri və eyni hərfin ayrı
  düymələrlə təkrarlanması dəstəklənir.
- Şəfəq bağı, Sakit göl, Ulduzlu gecə; səs, native toxunuş hissi, güclü kontrast
  və azaldılmış animasiya parametrləri.
- Qaldığı yerdən davam etmə, 20 səviyyəlik səhifələr, ulduzlar və ləçək balansı.
- Hər səviyyədə ilk ipucu pulsuz, sonrakılar **25 ləçək**. Yeni bonus söz
  **5 ləçək**, ilk qələbə **20 + 10 × ulduz** verir. Başlanğıc balans75-dir.
- Üç ulduz ipucusuz; iki ulduz1–2 ipucu; bir ulduz daha çox ipucu ilə.
  Keçilmiş səviyyəni yenidən oynamaq və eyni bonus sözü yenidən tapmaq ləçəkləri artırmır.
- Vaxt yalnız aktiv oyunda hesablanır; parametrlər, fasilə və arxa plana keçid
  zamanı saxlanır. Reklam bağlanması əlavə vaxt vermir.

## Söz kitabxanası və səviyyə generatoru

`src/components/games/word-garden/data/az.json`:

- Revision **`az-202610-v2`**: **6 857 lüğət sözü**, bunlardan **2 921 əsas tapmaca
  sözü**, **412 tanış başlanğıc sözü**. Eyni təsdiqlənmiş lüğət snapshot-ından911
  əlavə corpus-confirmed lemma əsas oyun seçiminə daxil edilib.
- Mənbə: Wiktionary / Kaikki.org; tezlik sıralaması Leipzig əsaslı
  `aosp-dict-az` məlumatından. Data attribution və CC BY-SA4.0:
  `src/components/games/word-garden/data/README.md`.
- Latin əlifbası, NFC normallaşdırılması, Azərbaycan case qaydaları,3–8hərf,
  baş söz və istifadə/tezlik filtrləri. Sözlər runtime-da avtomatik tərcümə edilmir.
- Yeni səviyyə dil + kitabxana versiyası + rejim + səviyyə nömrəsinə bağlı
  deterministik seed-dən yaranır. Eyni giriş eyni hərfləri və lövhəni verir.
- Çətinlik4→8hərf və2→8sözə artır; bütün sözlər bir-birinə kəsişmə ilə bağlıdır.
  Səhv hərflər, paralel təsadüfi sözlər və həllsiz səviyyələr qəbul edilmir.
- Hərf dəstləri çətinlik üzrə qarışdırılmış deck-dən təkrar istifadə etmədən
  paylanır; son6tapmacanın sözlərinə güclü təkrar cəriməsi tətbiq edilir.
  Sonrakı deck cycle yeni söz seçimi/lövhə ilə yaranır; sonlu söz kitabxanasında
  uzaq səviyyələrdə təkrar mümkündür. İlk20tapmaca hər iki rejimdə fərqlidir.
- Generator Web Worker-də işləyir; ağır lüğət/genişlənən səviyyə siyahısı əsas
  ekran render-ini bloklamır. Lüğət lazy asset olaraq bundle-ə daxil olur.
- Son30/300səviyyə kimi oyun limiti yoxdur. Sabit lüğət sonlu olduğundan uzun
  müddətdə sözlər və bəzi kombinasiyalar təkrarlana bilər; generator yeni səviyyə
  nömrələri, söz seçimləri və lövhə düzülüşləri yaratmağa davam edir.

İdxal və yoxlama:

```sh
node scripts/word-garden/import-az.mjs --fetch
node scripts/word-garden/verify-levels.mjs
```

İdxal yeni mənbə snapshot-ından istifadə edir; mənbə/library SHA-ları
`scripts/word-garden/az-import-receipt.json`-da qeyd edilir. Nəşr olunmuş library
dəyişəndə yeni revision istifadə olunmalıdır ki saxlanmış oyun başqa sözlərə çevrilməsin.
`import-az.mjs --fetch` eyni publishedrevision-i yenidən yazmağı rədd edir;
əvvəl editorialrevision artırılır. v2 eyni verifiedv1snapshot-ını
`rebalance-az.mjs --from-current` ilə sıralayıb; xarici söz tərcüməsi edilməyib.

## Dil və yaddaş müqaviləsi

Bu mərhələdə **yalnız Azərbaycan dili** aktivdir. Digər tətbiq dillərində kart
həmin dilin lüğəti hazır olanadək göstərilmir. Azərbaycan sözləri başqa dilin
versiyası kimi təqdim edilmir.

Yeni dil üçün:

1. Eyni schema ilə həmin dilin öz əlifba/locale və sözlərini ehtiva edən lexicon.
2. `library.ts`-də ayrıca lazy descriptor, revision, söz/target sayı.
3. `messages.ts`-də həmin dilin bütöv oyun copy paketi.
4. Dilə uyğun böyük/kiçik hərf, grapheme, uzunluq və ekran istiqaməti qəbulu.
5. Deterministik generator, söz kitabxanası və mobil input testləri.

Progress açarı:
`anacan_word_garden_v1:<language>:<revision>:<calm|timed>`.
Dil, kitabxana revision-u və rejimlər ayrı saxlanır. Son180səviyyənin detallı
ulduz/xalı, ümumi irəliləyiş və yalnız cari səviyyənin bonus claim-ləri saxlanır;
yaddaş səviyyə sayı ilə limitsiz böyümür. Storage quota olduqda mövcud cache
reclamation helper-i istifadə olunur, Auth/pin/session və digər game progress silinmir.
v1→v2 keçidində ləçək/ulduz/xal/unlockedlevel və yarımçıq raund saxlanır.
Yarımçıq raund original`az-v1.json` və legacygenerator ilə eyni sözləri açır;
növbəti səviyyəv2-dir. Köhnə save və lüğət baytları silinmir. Currentv2-də
restart/reload earnedəlavəvaxtı azaltmır; legacytimedround yeni qısa büdcəyə tabedir.

## İnteqrasiya və qəbul

Kod:`src/components/games/word-garden/`; giriş kartı`MiniGamesHub.tsx`.
Söz bağı öz local progress modelindən istifadə edir. Mövcud digər oyunların
server reytinq/RPC müqaviləsi qorunur. Word Garden hesab/şəxsi data və ya yeni DB
relation tələb etmir. GameAds interstitial cadence/consent/Premium/mükafat axını
mövcud hook-la işləyir; oyun zamanı başqa placement-lər bloklanır.

Qəbul:

- Azərbaycan case/repeatedletter, deterministik/futurelevel, bonus, ipucu,
  one-time win reward, malformed round recovery, mode/language separation,
  timer pause və təsdiqlənmiş vaxt mükafatı testləri.
- **4 806 generasiya edilmiş səviyyə**:1–2400hərrejimdə və10000/1000000/2147483647
  nömrələri; dictionary/rack/kəsişmə və təsadüfi adjacentword yoxlamalarında failure0.
- Hər rejimin ardıcıl1–2400səviyyəsi üzrə repeatedanswer0/repeatedrack0,
  eynitapmaca0; timedrange25–98saniyə/first31saniyə. Bu yoxlanmış sərhəd
  əbədiunikalsəviyyə vədi deyil.
- Production browser bundle-də real pointer və touch drag ilə söz tamamlama,
  yarımçıq oyunun reload bərpası, parametr persistence və320/390/428/768/1440px,
  ayrıca844×390landscape qəbulu. Hərf düymələri ən azı44×44px.
- **26 feature/inteqrasiya testi** keçir. Mini Oyunlar kartından oyun ekranına
  keçid, geri qayıdış və təkrar açılış real production browser-də də yoxlanıb.
  13browsercheck/14screenshot, timedready/pause/realtouchwin və iPhonesafearea
  qəbulu daxildir. v1savedgame→v2nextlevel/currency və inputexpiry testləri var.
- Original48.0workspace ilə32legacyv1puzzle qarşılaşdırılıb; söz/lövhə/seed/id
  eyniliyi vəoriginaldictionarySHA qəbul edilib. Receipt:`legacy-verification.json`.
- App/node TypeScript, feature ESLint və Google-mode production build keçir.

Yekun credential-free qəbul qeydi: `scripts/word-garden/acceptance.json`.
Digər mövcud mini oyunlar, reklam mükafatı və xal sinxronunun48focused testi
əvvəlki yoxlamada keçib.

Local vizual qəbul:

```sh
GOMAXPROCS=2 NODE_OPTIONS=--max-old-space-size=2048 node scripts/word-garden/verify-browser.mjs --production
```

Bu alət yalnız lokal production preview yaradır və backend/provider şəbəkəsini
intercept edir. Browserreport/screenshot-lar preapproved temp-dədir; production
web çıxışı`azure-migration/word-garden-verification/web`-dədir.

## Təhvil vəziyyəti

Söz bağı cari application koduna qoşulub və lokal production qəbulundan keçib.
Sonrakı oyun feedback-i üçün **48.1 iOS development paketi iPhone-a quraşdırılıb**;
521asset/imza/capability/Googlebackend qəbulu keçir. Avtomatiklaunch kilidliekrana
görə pending-dir. [48.1 balans/vizual yenilənməsi](WORD_GARDEN_IOS_48_1.md).
Əvvəlki48.0package/workspace və ilkininstall/launchreceipt saxlanır:
[48.0 cihaz sınağı](WORD_GARDEN_IOS_48.md). Fiziki gameplay təsdiqi ayrıca qalır.
Canlı web deployment və yeni native Store yayımı ayrıca qalır; imzalı native47
bu oyundan əvvəlki finalized Store build-dir.

2026-10-09 sonrakı **48.2** development paketində Sözbağıv2 iləbirlikdə
**İki dost** daxildir vəiPhone-a quraşdırılıb. İstifadəçi oyunu özü açacaq;
[soncihaztəhvili](TWO_FRIENDS.md).48.0/48.1 vəv1dictionary/savehistory qorunur.

Sonrakı48.3-dəSözbağıv2/İkidostiləTumurcuğun uçuşu/Yolunu açdaxildir və
iPhone-a quraşdırılıb:[48.3təhvili](FLIGHT_AND_PARKING_48_3.md).
