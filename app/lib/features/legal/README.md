# Legal feature (`registerLegalFeature`) + rich-text widgets

| React | Dart |
|---|---|
| LegalScreen.tsx, hooks/useLegalDocuments.ts, lib/legalProse.ts, pages/LegalPage.tsx | legal_screen.dart, register.dart (screen `legal[/doc]` + route page `/legal/:docType`) |
| MarkdownContent.tsx | content/markdown_content.dart (`MarkdownContent`, flutter_markdown_plus) |
| ui/HtmlContent.tsx | content/html_content.dart (`HtmlContent`, `sanitizeHtml`, `wrapLegalTables`, flutter_widget_from_html) |
| per-element classes | content/content_typography.dart (`ContentTypography.markdown/html/legal(...)`, `ContentVariant.chat`) |
| MedicalDisclaimer.tsx, hooks/useEmergencyNumber.ts | medical_disclaimer.dart (banner / compact / inline / anacan) |

## Rich text API (for AI chat, blog, tools)
`MarkdownContent(content:, variant:, typography:, onTapLink:, textColor:, imageBuilder:)`,
`HtmlContent(content:, typography:, onTapLink:, textColor:, imageBuilder:)`. Links open externally by default; tables
scroll horizontally in their own box; images use cached_network_image with radius 12.
Note: `prose`/`prose-sm` in React are inert (no @tailwindcss/typography plugin in tailwind.config.ts), so only the
explicit utility classes are reproduced. CSS margin collapsing is approximated with paddings (h-tag top margin minus
the paragraph margin); first-element top margins are not collapsed away exactly.
