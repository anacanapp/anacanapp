import v3 from '../../scripts/i18n/brand-portal-v3-copy.json';
import { brandText, type BrandText } from '@/lib/brand-ads';
import { normalizeAppLanguage } from '@/lib/app-languages';

// Portal-only copy for anacan-brand-ads-v3. It lives beside (not inside) the shared
// brand-ads copy so the consumer bundle, which imports src/lib/brand-ads.ts, does not grow.
export type PortalV3Text = keyof typeof v3.languages.en;
export type PortalText = BrandText | PortalV3Text;

export function portalText(key: PortalText, language: string, values: Record<string, string | number> = {}): string {
  const lang = normalizeAppLanguage(language) as keyof typeof v3.languages;
  const own = v3.languages[lang] as Record<string, string> | undefined, english = v3.languages.en as Record<string, string>;
  const text = key in english ? own?.[key] || english[key] : brandText(key as BrandText, language);
  return text.replace(/\{(\w+)\}/g, (match, name) => name in values ? String(values[name]) : match);
}
