# Uşaqla oyun (2026-11-12)

Screen-free games a parent plays with a child (6 months to 8 years), with links to the Anacan PDF books.

- Tool id `play-together`, a code tool (`src/lib/code-tools.ts`). Its `tool_configs` row is `is_active = false` on
  purpose (migration `20261112090000_play_together_tool.sql`), so older native builds never show it. Needs a new
  native build to appear.
- Visible for: Ana module, app language `az` (content is Azerbaijani only), admins in any stage. Free
  (`FREE_TOOL_IDS`); the admin can make it Premium with `tool_configs.is_premium`.
- Content: `src/data/play-together/az.ts` (46 games, 7 kinds: kəs-yapışdır-rənglə, hərəkətli, rollu, mətbəx, sakit,
  çöldə, söz və mahnı). Each game: age range in months, minutes, materials, steps, tip, safety note, book ids.
  A new language needs its own translated file and a wider `isPlayTileVisible` rule; books are Azerbaijani only.
- Logic: `src/lib/play-together.ts` (age filter, three daily picks from different kinds, WHO/AAP screen-time line,
  books per game and per age group). Progress (played today, favourites, chosen age) stays on the phone per
  account, bounded (300 log rows, 60 favourites). No server relation.
- Books: the game screen and the home list open an in-tool book sheet; "Kitab mağazasında bax" opens the PDF book
  store on that book (`sessionStorage` key `anacan_books_open_v1`, read once by `BookStoreScreen`).
- Analytics: `play_together_opened`, `play_game_viewed`, `play_game_done`, `play_book_clicked`.
