# Anacan Partner SDK: partnyor saytında satışların ölçülməsi

Bu sənəd partnyor mağazasında (ilk olaraq Olivia) tamamlanan satışların necə ölçüldüyünü təsvir edir. Söhbət
əməkdaşlıq modeli **V2**-dən gedir: Anacan məhsulları kataloq kimi göstərir, sifariş isə partnyorun öz saytında
verilir. Model V1-də (satış Anacan-da) ödəniş Anacan-dan keçir, ona görə ölçmə avtomatikdir və bu SDK lazım deyil.

## Necə işləyir

1. **Tətbiqdən keçid.** İstifadəçi tətbiqdə “Olivia saytında bax” və ya səbətdə “saytında al” düyməsinə toxunur.
   - Tətbiq hər keçid üçün təsadüfi `anacan_click` kodu yaradır və onu UTM teqləri ilə birlikdə linkə əlavə edir.
   - Kod `shop_partner_click_v1` ilə qeydə alınır: kim, hansı məhsul, hansı yerdən.
   - Link dərhal açılır, qeyd fonda gedir.
2. **Partnyor saytında yadda saxlama.** Saytın bütün səhifələrindəki `anacan-partner.js` kodu oxuyur və saxlayır:
   - saytın öz cookie-sində (`_anacan_click`, 30 gün, bütün subdomenlər üçün);
   - ehtiyat olaraq `localStorage`-da.
3. **Sifariş bildirişi.** İki yolla gəlir:
   - **Sayt kodu (pixel):** təsdiq (thank-you) səhifəsində `anacan('order', …)` sifariş nömrəsini, məbləği və məhsulları göndərir.
   - **Server bildirişi (tövsiyə olunur):** partnyorun serveri sifariş yaradılanda və status dəyişəndə gizli açarla bildiriş göndərir.
4. **Uyğunlaşdırma.** `partner-conversion` funksiyası bildirişi `shop_partner_conversion_v1`-ə ötürür. Bu funksiya:
   - açarı, gizli açarı və ya səhifənin domenini yoxlayır;
   - klikin həmin partnyora aid olduğunu və müddət daxilində olduğunu yoxlayır, klik yoxdursa Anacan kuponuna baxır;
   - sifarişi bir dəfə yazır.

   Klik və ya kupon olmayan sifarişlər saxlanılmır: partnyorun digər müştəriləri haqqında heç nə toplanmır.
5. **Panel.** `/partner` › **İnteqrasiya** bölməsində bunlar görünür:
   - keçidlər, sifarişlər, məbləğ;
   - təsdiqlənmiş komissiya və gözlənilən komissiya;
   - hər sifarişin statusu.

   Komissiya yalnız `confirmed` (təsdiqlənib) və `delivered` (çatdırılıb) statuslu sifarişlərdən hesablanır.

## Açarlar

| Açar | Harada | Kim görür |
|---|---|---|
| `pk_…` açıq açar | Sayt kodunda (`data-key`) və server sorğusunun gövdəsində | Hamı görə bilər, gizli deyil |
| `sk_…` server açarı | Yalnız partnyorun serverində, `Authorization: Bearer sk_…` başlığında | Panelin sahibi yaradır, **bir dəfə** göstərilir |

Bazada server açarının yalnız sha256-sı saxlanılır. Açar yenilənəndə köhnəsi dərhal işləməz olur.

## Partnyor üçün quraşdırma

### 1. Bütün səhifələrə (`<head>`)
```html
<script async src="https://app.anacan.az/sdk/anacan-partner.js" data-key="pk_…"></script>
```

### 2. Sifariş təsdiqi səhifəsinə
```html
<script>
  window.anacan = window.anacan || function () { (anacan.q = anacan.q || []).push(arguments); };
  anacan('order', {
    order_id: '100045',          // sifariş nömrəsi
    total: 31.98,                // ümumi məbləğ
    currency: 'AZN',
    items: [{ sku: '00-10023595', name: 'Siveno körpə yuyucu gel', quantity: 2, price: 15.99 }]
  });
</script>
```
Kod yalnız Anacan-dan gələn ziyarətçilər üçün sorğu göndərir. Eyni sifariş səhifə yenilənəndə ikinci dəfə göndərilmir.
Google Tag Manager varsa, eyni kodu “Custom HTML” teqi kimi təsdiq səhifəsinə qoymaq olar.

### 3. Server bildirişi (statuslar üçün)
Sifariş yaradılanda brauzerdəki `anacan('click')` dəyərini, ya da `_anacan_click` cookie-sindəki ilk hissəni sifarişlə
birlikdə saxlayın. Sonra hər status dəyişikliyində göndərin:
```bash
curl -X POST https://api.anacan.az/functions/v1/partner-conversion \
  -H 'Authorization: Bearer sk_…' -H 'Content-Type: application/json' \
  -d '{"key":"pk_…","order":{"order_id":"100045","total":31.98,"currency":"AZN","status":"delivered","click":"<anacan_click>"}}'
```
`status` aşağıdakılardan biri olmalıdır: `pending`, `confirmed`, `delivered`, `cancelled`, `returned`.
- Server bildirişi sifarişi yarada da bilər, yeniləyə də.
- Sayt kodu isə yalnız ilk dəfə `pending` statusu ilə yaradır.

Magento-da (olivia.az) bunu `sales_order_place_after` və `sales_order_save_after` hadisələrinə bağlanan kiçik bir
modul və ya mövcud webhook mexanizmi ilə etmək olar.

### Digər imkanlar
- **Kupon:** `anacan('coupon', 'ANACAN10')` və ya `order` daxilində `coupon`. Kuponlar paneldə təyin olunur. Kuponla verilən sifariş kliksiz də Anacan-a yazılır.
- **Test:** skriptə `data-test="true"` əlavə edin, ya da sifarişdə `test: true` göndərin. Test sifarişləri paneldə “Test” rejimində görünür və komissiyaya düşmür. Admin və partnyor komandasının öz klikləri də avtomatik test sayılır.
- **Atribusiya müddəti:** standart 30 gündür (1-90). Müqavilə şərti olduğu üçün yalnız Anacan admini dəyişir.

## Cavablar

| HTTP | `error` | Mənası |
|---|---|---|
| 200 | | `{"ok":true,"attributed":true,"by":"click","order":"…","status":"pending"}`; `attributed:false` Anacan-a aid deyil deməkdir; `duplicate:true` (sayt kodu) və ya `updated:true` (server) də ola bilər |
| 400 | `invalid_key`, `invalid_json`, `invalid_order_id`, `invalid_total`, `invalid_status` … | Sorğu səhvdir |
| 401 | `invalid_secret` | Server açarı səhvdir və ya yaradılmayıb |
| 403 | `origin_not_allowed` | Sayt kodu partnyorun öz domenindən deyil (`shop_partners.website_url` ilə yoxlanılır) |
| 404 | `unknown_key` | Belə açıq açar yoxdur |
| 409 | `partner_paused` | Mağaza dayandırılıb |

## Fayllar

| Hissə | Fayl |
|---|---|
| Miqrasiya | `supabase/migrations/20261117150000_shop_partner_tracking.sql` (+ `.cdc.json`), `20261117090000_shop_partners.sql`-dən sonra |
| Edge function | `supabase/functions/partner-conversion/index.ts` |
| Partnyor saytı üçün skript | `public/sdk/anacan-partner.js` → `https://app.anacan.az/sdk/anacan-partner.js` |
| Tətbiq: keçid kodu | `partnerVisitLink` (`src/hooks/usePartnerShop.ts`), `newClickToken` / `partnerLink` (`src/lib/partner-shop.ts`) |
| Panel | `src/components/partner-shop/panel/PartnerTracking.tsx` (İnteqrasiya bölməsi) |
| Testlər | `supabase/tests/shop_partner_tracking.sql` (35 yoxlama, `PARTNER_TRACKING_OK`), `src/lib/partner-tracking.test.ts` |

## İşə salma (Google)

1. SQL: əvvəl `20261117090000_shop_partners.sql`, sonra `20261117150000_shop_partner_tracking.sql`, hər ikisi `run-sql.py` ilə. Ardınca `supabase/tests/shop_partner_tracking.sql` (rollback) işlədilir.
2. Functions image:
   - `partner-conversion` qovluğu image-ə əlavə olunur;
   - `catalog.mjs`-ə yeni route yazılır: public, JWT yoxdur, `POST`/`OPTIONS`, env olaraq `SUPABASE_URL` və `SUPABASE_SERVICE_ROLE_KEY`;
   - funksiya `ENABLED_FUNCTIONS`-ə əlavə olunur.
3. Web gateway yenilənir: `npm run build` + gateway image. `/sdk/anacan-partner.js` `dist/`-dən verilir.
4. Paneldə Olivia üçün server açarı yaradılır və təhlükəsiz kanalla ötürülür.
5. Olivia əvvəlcə `data-test="true"` ilə yoxlayır, sonra test rejimini söndürür.
