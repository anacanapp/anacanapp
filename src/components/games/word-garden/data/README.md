# Azərbaycan söz kitabxanası

`az.json` Söz bağı oyununun ayrıca, offline söz məlumat paketidir.

- **Dil:** Azərbaycan / `az-AZ`.
- **Versiya:** `az-202610-v2`.
- **Sözlər:** 6 857 lüğət sözü; bunlardan 2 921-i əsas tapmaca üçün,
  qalanları əlavə düzgün sözlərin yoxlanması üçün istifadə olunur.
- **Əsas mənbə:** [Wiktionary → Kaikki.org Azerbaijani](https://kaikki.org/dictionary/Azerbaijani/).
- **Tezlik sıralaması:** [Subhan Gadirli — aosp-dict-az](https://github.com/subhangadirli/aosp-dict-az/tree/c68c85cb297510d19cee04787e445e2a558b1f70),
  Leipzig Corpora Collection əsasında.
- **Məlumat lisenziyası:** [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

Uyğunlaşdırmalar: NFC normallaşdırılması, Azərbaycan dilində böyük/kiçik hərf
qaydaları, Latin əlifbası, 3–8 hərf, lüğət baş sözləri, söz növü/istifadə filtrləri,
corpus tezliyi, Anacan başlanğıc çətinlik və izah seçimləri. Şəxs adları, süni
şəkilçilənmiş sözlər və avtomatik tərcümə edilmiş sözlər səviyyə bazası deyil.

İdxal aləti: `scripts/word-garden/import-az.mjs`. Mənbə və kitabxana SHA-256-ları:
`scripts/word-garden/az-import-receipt.json`. Bu lisenziya söz məlumat paketinə aiddir.
Runtime oyun kodu bu README ilə ayrıca lisenziyalaşdırılmır.

v2 eyni verified Kaikki snapshot-ından911 əlavə corpus-confirmedlemmanı
əsas seçimə daxil edir (frequency40+);daha müxtəlif başlanğıcracks vədeterministik
deck istifadə olunur. Publishedv1`az-v1.json`baytları saxlanır ki yarımçıqsave
originalsözlərlə açılsın. Lüğətin tərcüməsi və süni söz generasiyası yoxdur.
