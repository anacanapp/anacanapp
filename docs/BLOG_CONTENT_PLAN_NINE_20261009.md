# Kontent planı — əlavə doqquz məqalə, 2026-10-09

**İstifadəçinin “Continue to more 9” göstərişi tamamlanıb: 9 məqalə bütün 21 dildə
aktiv Google bloqunda yayımlanıb və tətbiqdaxili qəbuldan keçib.** İlk üçlüklə birlikdə
planın **12 mövzusu /252 dil versiyası /36 şəkli** hazırdır. Qalan **16 mövzu** üçün
növbəti davam göstərişi gözlənilir.

## Canlı məqalələr

| Sıra /FAQ | Mövzu | Azərbaycan dilində keçid |
|---|---|---|
|4 /FAQ010|Ürək döyüntüsünün görünməsi və eşidilməsi|[Oxu](https://anacan.az/az/korpenin-urek-doyuntusu-nece-heftede-gorunur-ve-ya-esidilir/)|
|6 /FAQ012|İlk həkim qəbulu|[Oxu](https://anacan.az/az/hamile-oldugumu-yeni-oyrenmisem-ilk-hekim-qebuluna-ne-vaxt-gedim/)|
|7 /FAQ021|Qəhvəyi və çəhrayı ləkələnmə|[Oxu](https://anacan.az/az/hamilelikde-qehveyi-ve-ya-cehrayi-lekelenme-olanda-ne-etmeliyem/)|
|8 /FAQ023|Axıntı, sidik və dölyanı maye fərqi|[Oxu](https://anacan.az/az/axinti-sidik-qacirma-ve-dolyani-mayenin-gelmesini-nece-ayird-etmek-olar/)|
|9 /FAQ028|Körpənin hərəkətlərinin azalması|[Oxu](https://anacan.az/az/korpenin-evvelkinden-az-hereket-etmesi-ve-ya-hereketin-hiss-edilmemesi-zamani-ne-etmeliyem/)|
|10 /FAQ032|Yemək və maye saxlaya bilməmək|[Oxu](https://anacan.az/az/yemek-ve-maye-saxlaya-bilmeyende-ne-etmeliyem/)|
|11 /FAQ045|Progesteron şamı və qalıq axıntısı|[Oxu](https://anacan.az/az/progesteron-sami-nece-istifade-olunur-ve-qaliq-axintisi-ne-demekdir/)|
|12 /FAQ047|Dərmandan sonra qusma və doza qərarı|[Oxu](https://anacan.az/az/dermani-qebul-etdikden-sonra-qussam-doza-ile-bagli-nece-qerar-verilir/)|
|13 /FAQ049|Fol turşusu və qəbul müddəti|[Oxu](https://anacan.az/az/fol-tursusu-ne-ucun-verilir-ve-ne-vaxtadek-qebul-olunur/)|

CSV-də sıra5 yerindəki boş sətir mövzu sayılmır. Tətbiqdaxili legacy slug-lar və
21 dil üçün `editorial_metadata.website.slugs` permalink-ləri sabit saxlanılıb.

## Mətn və şəkillər

- **189 tam dil versiyası**: mətn, başlıq/excerpt,6FAQ,SEO,tags,alt/caption və
  mənbə başlıqları. Azərbaycan məqalələrinin hərəsində9–10bölmə var.
- NHS,NICE,RCOG,eMC vəSPS-dən23mənbə snapshot-ı və accepted
  `source-editorial-final-v3` redaksiya yoxlaması saxlanır.
- Tərcümə auditində həqiqi rəqəm/məna səhvləri faktiki mətnlə müqayisə edilərək
  düzəldilib; yanlış omission/quote tapıntıları ayrıca adjudication-da qeydə alınıb.
- Hərəkət azalması və mümkün su sızması üçün dərhal əlaqə, maye saxlaya bilməməkdə
  gecikmədən yardım, doza qərarının preparata görə verilməsi izah olunur. Fol turşusu
 400mikroqram=0.4mg/ilk12həftə,5mg yalnız uyğun riskdə həkimlə; progesteron formaları
  və sxemləri bir-birini avtomatik əvəz etmir. İnsan həkim/reviewer təsdiqi uydurulmayıb.
- **9featured1200×630 +18inline1200×675 WebP**,cəmi **1 128 192bayt**. Fotolar mövzuya
  uyğun yaradılmış redaksiya təsvirləridir; real diaqnostik USM kimi təqdim edilmir.
- Public `assets/editorial/content-plan-next-nine-20261008/` içində27hash-named fayl;
  hər ikisi Google olan api/gcp hostlarında real byte SHA256 təsdiqlənib.

## Qəbul

- Active project`ninth-park-492111-m4`,self-hosted database`anacan`.
  Rollback edilmiş dry-run və verifiedCOMMIT:9post/18category relation.
- Published **78→87**,marketinq article sitemap **1 638→1 827URL**.
- **189HTML/189websitebrowser/189anonymousAPI/189in-app staff-preview** yoxlaması.
  Tam localized body,3şəkil/məqalə,caption/alt,6FAQ vəFAQschema,canonical22hreflang,
  mənbələr,320/390/768/1440px,RTL,TOC/FAQ,axtarış vədilpermalink keçib.
- Owned bəyənmə/saxlama/şərh persistence vəTəqviməkeçid keçir; bütün test hesabları,
  preference vəCustomer.io outbox qalıqları təmizlənib: **residual0**.
- Əvvəlki78content/category/controlhash,aktivCDCguard,Source sealed3/cron0/accepted
  lineage vənative47paketləri qorunub. Sayt renderer-inin ayrıca təhvili:
  [Markdown qəbulu](WEBSITE_MARKDOWN_20261008.md).

## Davam nöqtəsi

- Workspace:`azure-migration/blog-plan-nine/`.
- Batch:`anacan-content-plan-next-nine-20261008`.
- CSV SHA256:`72d6ee59f4b606e159a14044a9ac12f5b5038bc26c147364483ed65d81bbf603`.
- Rows SHA256:`8d9827b4cdd25feb8a1db05bb1bfc38528bf97149b22ccf041d21cd78d7468a4`.
- `delivery.json`/`checkpoint.json`: **`completed-awaiting-user-continue`**.
- Ops:`azure-migration/ops/blog-content-plan-delivery.json`; ilk3ops pointer-i
  `blog-content-plan-first-batch.json` olaraq saxlanıb.
- **57allowlisted content/media/receipt faylı** private GCS-ə yazılıb və generation-
  bound read-back SHA256 yoxlanılıb:
  `gs://anacan-migration-ninth-park-492111-m4/content-plan-checkpoints/anacan-content-plan-next-nine-20261008/`.
  Credential/session/signing input-ları bu nüsxəyə daxil deyil.
- Növbəti mövzular:**sıra14/15/16 — FAQ041/FAQ042/FAQ061**. Cari doqquzun və əvvəlki
  üçlüyün publication-u, tamamlanmış Google cutover addımları təkrarlanmır.
