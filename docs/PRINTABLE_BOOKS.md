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

## Aktivləşdirmə

- Epoint açarları və rejim mövcud **admin → Epoint ödəniş** bölməsindən gəlir (`app_settings` `epoint_public_key`,
  `epoint_private_key`, `epoint_mode=live`; mağaza/tort/albom ödənişləri ilə eyni hesab).
- Satış **admin → PDF kitablar → Ayarlar**-dakı açarla (`books_payments_enabled`) açılır; söndürülü olanda
  `GET book-checkout` → `{ready:false}` və tətbiq "Kartla ödəniş tezliklə" göstərir.
- Epoint kabinetində tək Result URL qalır: `…/functions/v1/epoint-payment?action=callback`. Bu callback kitab
  sifarişlərini (`book_orders.id`) tanıyıb `_shared/book-result.ts`-ə ötürür (`epoint-result` ayrıca URL kimi də işləyir).
- PDF-lər `book-pdfs` (private) bucket-ə `book_catalog.pdf_path` yolu ilə; qapaqlar `book-covers` (public).
  PDF-lər tətbiqə yerləşdirilmir: yalnız link (tətbiqdə 15 dəq. signed URL, e-poçtda tokenli link).
- Epoint sahələri canlı sınaq ödənişində yoxlanmalıdır.

## Admin (PDF kitablar)

Göstəricilər (gəlir, ödənilmiş sifariş, orta çek, alıcılar/təkrar, konversiya, gözləyən/uğursuz, günlük gəlir,
paket ölçüsü, yaş qrupları, top 10), Sifarişlər (axtarış, status, linkləri yenidən göndər, kitab hədiyyə et),
Kataloq (PDF var/yox, satış), Ayarlar (satış açarı, Epoint vəziyyəti, qiymət pillələri), Necə işləyir.
RPC: `admin_book_dashboard_v1`, `admin_book_orders_v1`, `admin_book_catalog_v1`; funksiya `book-admin`.

## Analitika

Tətbiq: `books_store_viewed`, `book_viewed`, `book_added_to_cart`, `book_removed_from_cart`, `books_collection_added`,
`books_checkout_started`, `books_checkout_unavailable`, `books_purchase_confirmed`, `book_downloaded`, `books_reco_clicked`
(analitika razılığı ilə; Meta-ya yalnız baxış/səbət/checkout/satınalma, reklam ölçmə razılığı ilə).
Server: `books_purchase_completed` (`analytics_events`, ödəniş təsdiqlənəndə).

## Fayllar

Migrasiya `supabase/migrations/20261104150000_printable_books.sql` (+ `.cdc.json`); funksiyalar `book-checkout`,
`epoint-result`, `book-download`, `book-admin`; `_shared/epoint.ts`, `_shared/book-result.ts`, `_shared/book-email.ts`; admin `src/components/admin/AdminBooks.tsx`; UI `src/components/books/*`,
kataloq `src/data/books/catalog.json`, mətnlər `scripts/i18n/books-copy.json` (23 dil).
