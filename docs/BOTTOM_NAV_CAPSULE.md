# Alt menyu: üzən kapsul (test) — 2026-11-04

- `BottomNav` `app_settings.bottom_nav_style` oxuyur (`get_public_app_setting` allowlist-ə əlavə olunub,
  migrasiya `20261104190000_bottom_nav_style.sql`, canlı serverdə tətbiq olunub). Dəyər `capsule` (default) və ya `classic`.
- `capsule`: şüşə (glass) effektli üzən kapsul, yalnız ikonlar (adlar yoxdur, `aria-label` qalır), aktiv tab şüşə qabarcıqda; açıq və tünd rejim ayrıca; Alətlər ikonu `LayoutGrid`; Profil avatar
  (`profiles.avatar_url` və ya adın baş hərfi). Badge-lər, tablar, partnyor tabları dəyişməyib. Stil `.a-nav.capsule`.
- Geri qaytarmaq: admin → Tənzimləmələr → "Alt menyu stili" → Klassik → Yadda saxla. Yeni build lazım deyil
  (tətbiq açılanda və ya 5 dəqiqə keşdən sonra).
- Veb: gateway `sha256:5f920e16207ebc819d71e14a48ccb407210e3051b2c712c86a4bc6e4de253954`
  (`nav-capsule-web-plan.json` passed). Rollback: `rollback-nav-capsule-web-plan.json`. Native: növbəti build.
