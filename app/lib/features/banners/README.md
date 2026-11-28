# Banners (svc.banners)

Port of `src/components/banners/{BannerSlot,NativeAdCard,LeadFormSheet}.tsx`, `src/hooks/useBanners.ts`,
`src/lib/brand-ads.ts` (safeAdUrl only; the brand portal is web-only), `src/lib/ads/{brandMeasurement,leadForm,brandTargeting}.ts`.

| File | What |
|---|---|
| `data/banner.dart`, `data/banners_repository.dart` | `Banner` row, `bannersQuery(placement)` (v3 → v2 RPC → legacy table), click / impression RPCs |
| `brand_measurement.dart`, `brand_targeting.dart`, `lead_form.dart`, `brand_ads.dart` | pure logic |
| `ui/banner_slot.dart`, `ui/native_ad_card.dart`, `ui/lead_form_sheet.dart` | widgets |
| `banners_seams.dart` | builders for `HomeSlots.bannerSlot`, `ProfileSlots.bannerSlot`, `ToolsHubSlots.bannerSlot`, `communityBannerProvider` |

`generated/brand_lead_copy.g.dart` is generated from `scripts/i18n/brand-lead-copy.json` (run from the repo root):

```
node -e "const c=require('./scripts/i18n/brand-lead-copy.json');const e=s=>JSON.stringify(s).replace(/\$/g,'\\\\$');let o='// Ported from: scripts/i18n/brand-lead-copy.json (read by src/lib/ads/leadForm.ts)\n// GENERATED - do not edit; regenerate with the command in app/lib/features/banners/README.md.\n// ignore_for_file: lines_longer_than_80_chars\n\nconst String kBrandLeadCopyProtocol = '+e(c.protocol)+';\n\nconst Map<String, Map<String, String>> kBrandLeadCopy = {\n';for(const[l,v]of Object.entries(c.languages)){o+='  '+e(l)+': {\n';for(const[k,t]of Object.entries(v))o+='    '+e(k)+': '+e(t)+',\n';o+='  },\n'}o+='};\n';require('fs').writeFileSync('app/lib/features/banners/generated/brand_lead_copy.g.dart',o)"
```

`test/features/banners/lead_form_test.dart` checks the table against the JSON.
