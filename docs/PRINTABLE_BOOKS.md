# Çap kitabları (PDF) — Epoint ilə veb ödəniş

2026-11-04. 70 uşaq fəaliyyət kitabı (7 yaş qrupu × 10: 6+ ay, 1+ … 6+ yaş), Azərbaycan dilində.

## Qiymət (server hesablayır)

| Səbətdə | Kitabı | Cəmi (nümunə) |
| --- | --- | --- |
| 1–2 | 4,00 ₼ | 1 → 4 ₼ |
| 3–4 | 3,00 ₼ | 3 → 9 ₼ |
| 5–9 | 2,60 ₼ | 5 → 13 ₼ |
| 10+ | 2,00 ₼ | 10 → 20 ₼ |

`supabase/functions/_shared/book-pricing.ts` = `src/lib/books/pricing.ts` (test bərabərliyi yoxlayır).

## Axın

1. Tətbiq: Mağaza (yaş + mövzu filtrləri, uşağın yaşına görə tövsiyə, paket pillələri, yaş kolleksiyası) → Səbət → "Ödənişə keç".
2. `book-checkout` (istifadəçi sessiyası): kitabları yoxlayır, alınmışları rədd edir, qiyməti hesablayır,
   `book_orders` yazır, Epoint `api/1/request` → ödəniş səhifəsi xarici brauzerdə açılır.
3. `epoint-result` (Epoint kabinetində Result URL: `https://api.anacan.az/functions/v1/epoint-result`):
   imza (`base64(sha1(private+data+private))`) + `get-status` + məbləğ yoxlanır → `paid`, `book_entitlements`,
   yükləmə tokeni (hash saxlanır), Customer.io ilə e-poçt (PDF linkləri).
4. `book-download`: tətbiqdən (sessiya + sahiblik) və ya e-poçt linkindən (token) 15 dəqiqəlik signed URL.
5. "Kitablarım": alınmış kitablar, PDF yüklə, çap bələdçisi.

## Aktivləşdirmə (Epoint hesabı təsdiqlənəndən sonra)

- Functions env: `EPOINT_PUBLIC_KEY`, `EPOINT_PRIVATE_KEY`, `ENABLE_BOOK_PAYMENTS=true` (+ istəyə görə `BOOKS_EMAIL_FROM`).
  Bunlar olmadan `GET book-checkout` → `{ready:false}` və tətbiq "Kartla ödəniş tezliklə" göstərir.
- Epoint kabinetində Result URL; success/error redirect `https://app.anacan.az/payment/{success,error}?kind=books`.
- PDF-lər `book-pdfs` (private) bucket-ə `book_catalog.pdf_path` yolu ilə (məs. `pdf/1-yas/1_01_fermada.pdf`);
  qapaqlar `book-covers` (public) bucket-ə fayl adı ilə (e-poçt üçün). Tətbiq qapaqları `public/books/covers/<id>.webp`-dən göstərir.
- Epoint API sahələri (data/signature, `redirect_url`, `get-status`) canlı açarlarla sınaq ödənişində yoxlanmalıdır.

## Fayllar

Migrasiya `supabase/migrations/20261104150000_printable_books.sql` (+ `.cdc.json`); funksiyalar `book-checkout`,
`epoint-result`, `book-download`; `_shared/epoint.ts`, `_shared/book-email.ts`; UI `src/components/books/*`,
kataloq `src/data/books/catalog.json`, mətnlər `scripts/i18n/books-copy.json` (23 dil).
