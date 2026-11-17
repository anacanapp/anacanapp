# Partnyor mağazaları (2026-11-17)

Sahibin tapşırığı: Olivia.az və gələcək brendlər üçün partnyor inteqrasiyası. Hər partnyor öz məhsullarını, qiymət və stoku,
kampaniyalarını, satışlarını və statistikasını idarə edir və yalnız öz mağazasını görür. Tətbiqdə hər məhsul şəklinin küncündə
partnyorun kiçik ikonu, məhsul səhifəsində "by <loqo>" var.

## Verilənlər bazası (`supabase/migrations/20261117090000_shop_partners.sql`, CDC: `.cdc.json`)

- 7 yeni relation, hamısı CDC + writer guard, RLS açıq, client grant yoxdur:
  - `shop_partners` (slug, ad, loqo/ikon, sayt, `status` admin_only|live|paused, komissiya);
  - `shop_partner_members` (owner|manager|viewer);
  - `shop_partner_invites` (yalnız tokenin sha256-sı saxlanır, 14 gün);
  - `shop_partner_events` (impression/open/add/site/bundle, impression gündə 1 dəfə, `internal` = admin/üzv trafiki);
  - `shop_partner_campaigns` (pending → admin approved/rejected, partnyor cancel);
  - `shop_partner_sales` (partnyorun əl ilə yazdığı satışlar);
  - `shop_partner_audit`.
- `products` +`partner_id`, +`partner_listed`. Partnyor məhsulları həmişə `is_active=false` qalır, tətbiq onları yalnız
  `shop_storefront_v1` ilə oxuyur: `live` partnyor hamıya, `admin_only`/`paused` yalnız adminlərə və həmin partnyorun üzvlərinə.
  Kampaniya qiyməti serverdə hesablanır.
- Bütün yazma/oxuma `shop_partner_*` SECURITY DEFINER RPC-ləri ilə, rol hər çağırışda yoxlanır (`_shop_partner_need`).
- Olivia `olivia` slug ilə seed olunub (`admin_only`), 16.11-də yüklənən 51 məhsul ona bağlanıb.
- Tenant testi: `supabase/tests/shop_partners_isolation.sql` (tranzaksiya, rollback). Yoxlayır:
  - başqa partnyorun məhsulu, statistikası və satışı əlçatmazdır;
  - viewer yaza bilmir;
  - dəvət yalnız həmin e-poçtla qəbul olunur və bir dəfə işləyir;
  - gizli mağaza adi istifadəçiyə və anonim ziyarətçiyə görünmür;
  - impression deduplikasiyası işləyir;
  - kampaniya təsdiqdən sonra tətbiq olunur;
  - komissiya düzgün hesablanır;
  - admin idxalı və təmizləmə yalnız həmin partnyora təsir edir.

## Tətbiq

- `src/components/partner-shop/PartnerShop.tsx`: Mağaza bölməsi (`ShopScreen`) və ana səhifə kartı (bump, mommy, flow).
  İtki rejimində heç nə göstərilmir. Səbət cihazda saxlanır, alış partnyorun saytında edilir (UTM `utm_source=anacan`).
- Ölçmə: `shop_partner_track_v1` (impression batch, open, add, bundle, site).

## Partnyor paneli: `https://app.anacan.az/partner`

- Giriş: Anacan hesabı (e-poçt/şifrə). Dəvət linki `/partner?invite=…` hesabı mağazaya qoşur (yalnız dəvət olunan e-poçt).
- Bölmələr:
  - **İcmal:** göstərim, açılış, səbət, sayta keçid, əhatə, satış/komissiya, günlər, məhsullar və yerlər üzrə, CSV.
  - **Məhsullar:** əlavə/redaktə, qiymət, köhnə qiymət, stok (0 = tətbiqdə gizli), şəkil və link, kolleksiyalar, göstər/gizlə, toplu əməliyyatlar.
  - **Kampaniyalar:** endirim %, tarix, məhsullar; Anacan təsdiqi ilə.
  - **Satışlar:** əl ilə qeyd, komissiya.
  - **Komanda:** dəvət, rol, çıxarma.
  - **Tarixçə:** audit.
- Rollar:
  - sahib: hər şey, komandanı idarə etmək daxil;
  - menecer: məhsul, kampaniya və satış;
  - baxış: yalnız oxumaq.

## Admin › Satış › Partnyor mağazaları (`AdminShopPartners`, köhnə `olivia` linki bura yönəlir)

- Partnyor yarat/redaktə (status, komissiya, loqo, ikon).
- Kampaniya təsdiqi.
- İstənilən partnyorun panelini admin kimi açmaq.
- Olivia kataloqunu bir kliklə yükləmək və bütün məhsulları bir kliklə silmək. Başqa partnyorlarda silmə təsdiq istəyir.

## Hamıya açmaq

Admin › Partnyor mağazaları › Ayarlar › Status "Canlı". Kod dəyişikliyi lazım deyil. UI mətnləri hazırda Azərbaycancadır.

## Satışların ölçülməsi (partnyor saytında sifariş, model V2)

Partnyorun öz saytında tamamlanan sifarişlər Anacan SDK ilə avtomatik ölçülür. Ətraflı: `docs/PARTNER_TRACKING_SDK.md`.
- Tətbiqdən hər keçidə `anacan_click` kodu əlavə olunur.
- Partnyorun saytına `https://app.anacan.az/sdk/anacan-partner.js` qoyulur, server bildirişləri `partner-conversion` funksiyasına gəlir.
- Paneldə **İnteqrasiya** bölməsi var: açıq açar, server açarı (bir dəfə göstərilir), quraşdırma kodu, kuponlar, izlənən sifarişlər və komissiya.
- Komissiya yalnız təsdiqlənmiş və çatdırılmış sifarişlərdən hesablanır.
