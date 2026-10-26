# METRO Simulator — davam nöqtəsi

## Cari vəziyyət

- Native Godot3D **1.1.0 / build2**, `com.atlasoon.metrosimulator`.
- iPhone13 Pro Max-a faktiki quraşdırılıb,309-check device acceptance keçir,
  son normal foreground launch təsdiqlənib.
- Brauzer release/test4 və simulation281 keçir. Preview port5179.
- Current source: `scenes/main.tscn` → `scripts/game_ui.gd` → `world_3d.gd`.
- 27 stansiya/37 mərhələ/116 qapı; lokal save schema1 qorunur.
- Delivery: `artifacts/DELIVERY.json` və `docs/TESTING.md`.

## Əsas fayllar

| Fayl | Məqsəd |
|---|---|
| `scripts/game_ui.gd`, `game_widgets.gd` | Native mobil lobby/TAP/HUD/map/shop |
| `scripts/world_3d.gd` | Kamera, həqiqi mövqe, crowd və obstacle inteqrasiyası |
| `scripts/station_3d.gd`, `train_3d.gd`, `mesh_factory.gd` | Məkan/vaqon/detal/batching |
| `scripts/commuter_3d.gd`, `shaders/` | Skelet animasiyası və avadanlıq |
| `scripts/rules.gd`, `session.gd`, `metro.gd`, `store.gd` | TAP/progression/economy/save |
| `data/network.json`, `shop.json` | Reviewed stansiya və avadanlıq definitions |
| `scripts/tailor-commuters.mjs` | Original skinned knit top/trouser geometry |
| `tests/acceptance.gd`, `device_acceptance.gd` | İzolə simulation/native acceptance |
| `e2e/game.spec.ts` | Mobile touch/browser acceptance |
| `scripts/ios.mjs`, `accept-ios.mjs`, `verify-ios.mjs` | Native export/install proof |

Əvvəlki2D prototype helper-ləri source-dədir; cari main scene onları istifadə
etmir. Təkmilləşdirmə `game_ui.gd/world_3d.gd` üzərindən davam edir.

## Rebuild

`README.md`-dəki əmrlərdən istifadə et. Yeni native dəyişiklikdən sonra növbəti
build nömrəsini və ayrıca build/install/acceptance yollarını seç; hazır build2
receipt və paketini saxla. Backend/accounts bu oyunda lokal irəliləyiş deyil.
