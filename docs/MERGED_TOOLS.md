# Merged tools (2026-11-09)

Compact Tools page: some tools now open as sections (tabs under the header) of another tool. Map:
`src/lib/merged-tools.ts`.

| Host | Sections |
|---|---|
| Mental sağlamlıq (`mental-health`) | Əhval gündəliyi (`mood`) |
| Körpə izləyicisi (`baby-tracker`) | İnkişaf izləyicisi (`baby-growth`), Diş çıxarma (`teething`) |
| Qan təzyiqi (`blood-pressure`) | Qan şəkəri (`blood-sugar`) |
| Ağ səs (`whitenoise`) | Səs-küy ölçən (`noise-meter`) |

- The child keeps its screen, data and access rule. A Premium section inside a free/preview host shows the paywall
  and returns to the host when closed.
- The child tile is hidden only where the host is available in the current stage (e.g. in Dövr, where Mental
  sağlamlıq is off, Əhval gündəliyi stays a tile). Old links (tile ids, deeplinks, push, banners, stories) open the
  host on that section.
- Ağ səs and Yuxu (`sleep-training`) stay two tools; each shows its own description as a one-line intro with a link
  to the other.
- Tab labels and intros reuse the tools' translated names and descriptions (no new strings).
- UI: `ToolSectionsContext` / `ToolSectionsBar` in `src/components/tools/anacan/ToolKit.tsx` (rendered under every
  `ToolHeader`), provided by `ToolsHub`. Admin → Alət sıralaması lists merged tools under "Bu mərhələdə görünmür"
  with an "İçində: …" badge. Analytics: `tool_used` action `section`.
