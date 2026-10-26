# Rəng çeşidləmə — mini oyun

## Haradan açılır?

- **2026-09-20:** Azure web-də canlıdır — gateway `anacan-gateway--0000019`,
  `test-gateway:v21-color-sort-20260920`, ACR run `cb12`.
- Tətbiqdə **Alətlər → Mini Oyunlar → Rəng çeşidləmə**.
- Ayrı oyun girişi: `https://api.anacan.az/mini-games`.
- Oyun və irəliləyiş cihazda işləyir. Hesaba daxil olan istifadəçinin nəticəsi
  mövcud `game_scores` reytinqinə `game_id = color-sort` ilə ötürülür.

## Oyun qaydaları

1. Maye tökmək üçün əvvəl mənbə, sonra hədəf qabı seç.
2. Hədəf boş olmalı və ya onun üst rəngi mənbənin üst rəngi ilə eyni olmalıdır.
3. Eyni rəngli üst qatlar hədəfdəki boş yer qədər bir gedişdə tökülür.
4. Hər rəngdən dörd qat var. Bir rənglə dolan qab tamamlanır və bağlanır.
5. Bütün rənglər ayrı qablarda tamamlananda səviyyə keçilir; boş qablar qala bilər.

Rəng işarələri başlanğıcda aktivdir: rənglər rəqəmlərlə də fərqlənir.
Onları aşağıdakı **Rəng işarələri** düyməsindən dəyişmək olar.

## Səviyyələr və çətinlik

İlk **30 səviyyə** oyunla birlikdə gəlir. Hər birinin qanuni gedişlərlə sona
çatan həll ardıcıllığı yoxlanılıb. Limitli səviyyələrdə həmin həll büdcəyə sığır.

| Səviyyələr | Çətinlik | Rənglər | Başlanğıcda açıq boş qab | Mexanizmlər |
| --- | --- | --- | --- | --- |
| 1–6 | Başlanğıc | 2–4 | 3 | Gediş limiti yoxdur |
| 7–12 | Orta | 4–5 | 2 | Gediş limiti; 11-ci səviyyədən kilid |
| 13–18 | Çətin | 5–6 | 2, sonra 1 | Kilid, gizli qatlar, gediş limiti |
| 19–24 | Usta | 6–7 | 1 | İki kilidli qab, daha çox gizli qat |
| 25–30 | Ekspert | 7–8 | 1 | Daha dərin gizli qatlar; 28-ci səviyyədən ikinci kilid üçün 3 rəng |

Kilid rəng tamamlandıqda açılır. Üstündəki rəqəm neçə rəngin qaldığını göstərir.
Gizli qatlar səthə çıxdıqca görünür; gedişi geri almaq görülmüş rəngi yenidən gizlətmir.

## Köməkçilər

- **Geri al:** son tökməni və gediş sayını qaytarır; artıq görülmüş rəngləri saxlayır.
- **İpucu:** hər raundda 3 dəfə. Mövcud vəziyyətdən həllə aparan gediş axtarılır.
  Axtarış nəticə verməzsə ipucu xərclənmir; geri alma və əlavə qab yolu göstərilir.
- **Əlavə qab:** hər raundda 1 boş qab. Bu əməliyyat geri alma tarixçəsini təmizləyir.
- **Mükafatlı davam:** gedişlər bitəndə mövcud admin idarəli rewarded mexanizmi
  əlavə gediş verə bilir. Video bağlanması mükafat sayılmır. Premium yolu reklam tələb etmir.
- Səviyyələrdən sonra reklam üçün mövcud `games_break_interstitial` cadence-i işləyir;
  oynayarkən reklam açılmır.

Hər qələbə növbəti səviyyəni açır. Üç ulduz üçün göstərilən gediş hədəfinə ipucusuz
çatmaq lazımdır. Əlavə qabla qələbə bir ulduz verir; yaxşı nəticələr sonradan artırıla bilər.

## Daha çox səviyyə

- Səviyyə ekranındakı **+10 səviyyə əlavə et** ilə növbəti dəsti əlavə etmək olar.
- 30-cu və hər son mövcud səviyyə tamamlananda eyni seçim növbəti səviyyəyə aparır.
- Yeni dəst əvvəlki irəliləyişi silmir və keçilməmiş səviyyələri açıq etmir.
- Hazırkı limit **300 səviyyədir**. Yeni səviyyələr ayrıca Web Worker-də yaradılır,
  həlli yoxlanır və cihazda saxlanır. Worker əlçatan deyilsə və ya vaxt büdcəsi
  dolarsa, həlli məlum şablonun rəng/yer/kilid/həll uyğunluğu qorunan variantı işlənir.
- `difficulty.ts` daxilində `MAX_LEVEL_COUNT` və çətinlik profillərini genişləndirmək olar.
  Müəllif səviyyələri `catalog.json`-a tam həll ardıcıllığı ilə əlavə edilir.

Yeni başlanğıc dəsti hazırlamaq üçün:

```sh
node --experimental-strip-types scripts/generate-color-sort-levels.ts
```

Komanda nəticəni çıxarır; mövcud kataloqu və istifadəçi məlumatlarını dəyişmir.
Kataloq yenilənəndə `engine.test.ts` bütün həlləri, kilidləri və gediş büdcələrini yoxlayır.

## Dillər və yadda saxlama

Azərbaycan, ingilis, türk, rus, alman, ərəb, qazax, özbək və gürcü dilləri tam
oyun mətnləri ilə paketlənib. Ərəb dilində RTL dəstəyi var. Yeni mətnlər köhnə
ümumi tərcümə keşindən asılı deyil; `colorsort_` prefiksli admin tərcüməsi varsa üstün tutulur.

Aktiv raund bu cihazda saxlanır. Tətbiq arxa plana keçəndə oyun dayanır; təkrar
açılışda saxlanmış raunda davam etmək mümkündür. Saxlama xətası oyunu bloklamır.

## Yoxlamalar və çatdırılma

- 30 başlanğıc səviyyəsinin həlli, əlavə generator/fallback, tökmə/kilid/undo,
  davam etmə və bütün 9 dil üçün avtomatik testlər.
- Brauzerdə üç oyunlu hub, +10 genişlənmə, real 1/16/30 səviyyə oyunları,
  worker ilə 31-ci səviyyə, mobil ölçülər və 9 dil: **12/12**.
- Lokal production bundle sübutu:
  `azure-migration/ops/color-sort-web-1789906725473.json`.
- Canlı web, həqiqi worker yüklənməsi/yeni səviyyə və RTL smoke **4/4**:
  `azure-migration/ops/color-sort-web-1789907254725.json`.
- Canlı entry bytes/health/provider qapıları:
  `azure-migration/ops/web-artifact-1789907258383.json`.
- Native ekranlar paket daxilindədir. Bu yeni oyun əvvəlki yoxlanmış
  `native-20260919t173724-4142fccb` AdMob namizədindən sonradır; native çatdırılması
  yeni web bundle/sync və release yoxlaması tələb edir.

Əsas mənbə: `src/components/games/color-sort/`. Mövcud digər oyunların cihazdakı
irəliləyiş açarları və native identity/session müqavilələri qorunur.
