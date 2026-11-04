# Tortlar — kateqoriyalar və yeni dizaynlar (2026-11-04)

- `cakes.category`: `month` (12 aylıq bento), `milestone` (Xüsusi günlər), `pregnancy` (Hamiləlik), `family`
  (Ailə və bayram). Sütun sərbəst mətndir, constraint yoxdur; schema dəyişməyib.
- 11 yeni tort (sort_order 100–110), şəkillər `assets/cakes/cake-1793812000-*.jpg`:
  milestone — 40 gün (65 ₼, 16 sm), ilk diş, 100 gün, ilk addım (28 ₼), 1 yaş (65 ₼, 16 sm);
  pregnancy — gender reveal (30 ₼, gizli cins xanası), "Ata olursan" (28 ₼);
  family — adlı bento (ad + ay xanaları), əkizlər (30 ₼, iki ad), ana üçün, Novruz (28 ₼).
  Ad/təsvir/etiket az + en + ru. Yarım yaş (½) dizaynı istifadəçinin istəyi ilə əlavə olunmayıb.
- Şəkillər AI ilə yaradılmış konseptlərdir; partnyor qənnadının real fotoları ilə əvəz olunmalıdır.
- `CakesScreen`: kateqoriya çipləri, "Hamısı"da bölmələr (aylıq üçün 4 nümunə + "Hamısı · 12"),
  "Aylıq" seçiləndə ay çipləri, uşağın növbəti ay gününə qalan gün kartı. Köhnə native versiyalar yeni
  kateqoriyaları "Hamısı" siyahısında göstərir.
- `AdminCakes`: yeni kateqoriyalar və milestone növləri (40 gün, 100 gün, gender reveal, hamiləlik xəbəri,
  ana, bayram, əkizlər, adlı tort).
- Veb: gateway `sha256:4969c2976f3fea9d844b23821b92ea6da9fa195bdc20615e3ce27a524bf019ef`
  (`cakes-cat-web-plan.json` passed). Rollback: `rollback-cakes-cat-web-plan.json`.
- Diqqət: `payment_methods.card_simulated` aktivdir — real ödəniş almadan sifarişi "paid" yazır.
