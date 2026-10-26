import type { CSSProperties } from 'react';
import { ChevronRight, ExternalLink, Quote, Sparkles, Ticket } from 'lucide-react';
import { safeAdUrl } from '@/lib/brand-ads';
import { NATIVE_TEMPLATES, type NativeTemplate } from '@/lib/ads/brandTargeting';
import '@/styles/native-ads.css';

// Shared by the consumer BannerSlot and the web-only brand portal preview. It holds
// no literal UI copy, so inline localization never injects consumer i18n into the portal.
export interface NativeAdContent {
  title: string;
  description?: string | null;
  button_text?: string | null;
  image_url?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  native_template?: string | null;
  creative_options?: { offer_code?: string | null; expert_name?: string | null; expert_role?: string | null } | null;
  link_type?: string | null;
  sponsor_logo?: string | null;
}
interface Props { ad: NativeAdContent; sponsorLabel?: string; codeLabel?: string; onClick?: () => void; preview?: boolean }

const HEX = /^#[0-9a-f]{6}$/i;
const luminance = (hex: string) => {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
export function contrastRatio(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
/** Text colour for a brand-coloured surface: the brand's choice when legible, else black/white. */
export function readableOn(background: string, preferred?: string | null) {
  if (preferred && HEX.test(preferred) && contrastRatio(background, preferred) >= 4.5) return preferred;
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#1A1A1A') ? '#FFFFFF' : '#1A1A1A';
}
export const nativeTemplate = (value: string | null | undefined): NativeTemplate =>
  NATIVE_TEMPLATES.includes(value as NativeTemplate) ? value as NativeTemplate : 'classic';

function adjust(color: string, amount: number) {
  const num = parseInt(color.slice(1), 16);
  const part = (shift: number) => Math.min(255, Math.max(0, ((num >> shift) & 0xff) + amount));
  return `#${(1 << 24 | part(16) << 16 | part(8) << 8 | part(0)).toString(16).slice(1)}`;
}

export default function NativeAdCard({ ad, sponsorLabel, codeLabel, onClick, preview = false }: Props) {
  const template = nativeTemplate(ad.native_template);
  const accent = ad.background_color && HEX.test(ad.background_color) ? ad.background_color : '#F48155';
  const onAccent = readableOn(accent, ad.text_color);
  const image = safeAdUrl(ad.image_url), logo = safeAdUrl(ad.sponsor_logo);
  const Arrow = ad.link_type === 'external' ? ExternalLink : ChevronRight;
  const style = { '--nad-accent': accent, '--nad-on-accent': onAccent } as CSSProperties;
  const cta = ad.button_text ? <span className="nad-cta">{ad.button_text}<Arrow className="nad-arrow" aria-hidden="true" /></span>
    : <Arrow className="nad-arrow nad-arrow-only" aria-hidden="true" />;
  const sponsor = sponsorLabel ? <span className="nad-sponsor">{sponsorLabel}</span> : null;
  const media = (className: string) => image ? <img className={className} src={image} alt="" loading={preview ? 'eager' : 'lazy'} decoding="async" data-creative-image="true" /> : null;
  const options = ad.creative_options || {};
  const body = (() => {
    switch (template) {
      case 'spotlight': return <>{media('nad-spotlight-media')}<span className="nad-body">{sponsor}<strong className="nad-title">{ad.title}</strong>
        {ad.description && <span className="nad-text nad-clamp-2">{ad.description}</span>}{cta}</span></>;
      case 'split': return <>{media('nad-split-media')}<span className="nad-body">{sponsor}<strong className="nad-title">{ad.title}</strong>
        {ad.description && <span className="nad-text nad-clamp-2">{ad.description}</span>}{cta}</span></>;
      case 'minimal': return <span className="nad-body nad-row"><span className="nad-grow">{sponsor}<strong className="nad-title">{ad.title}</strong>
        {ad.description && <span className="nad-text nad-clamp-1">{ad.description}</span>}</span><Arrow className="nad-arrow" aria-hidden="true" /></span>;
      case 'offer': return <span className="nad-body">{sponsor}<span className="nad-row"><Ticket className="nad-offer-icon" aria-hidden="true" /><strong className="nad-title nad-grow">{ad.title}</strong></span>
        {ad.description && <span className="nad-text nad-clamp-2">{ad.description}</span>}
        <span className="nad-row nad-offer-foot">{options.offer_code && <span className="nad-code"><span className="nad-code-label">{codeLabel}</span><bdi>{options.offer_code}</bdi></span>}{cta}</span></span>;
      case 'expert': return <span className="nad-body">{sponsor}<Quote className="nad-quote" aria-hidden="true" /><strong className="nad-title">{ad.title}</strong>
        {ad.description && <span className="nad-text nad-clamp-3">{ad.description}</span>}
        <span className="nad-row nad-expert">{image ? media('nad-expert-photo') : <span className="nad-expert-photo nad-expert-fallback" aria-hidden="true" />}
          <span className="nad-grow">{options.expert_name && <span className="nad-expert-name">{options.expert_name}</span>}{options.expert_role && <span className="nad-text nad-clamp-1">{options.expert_role}</span>}</span>{cta}</span></span>;
      default: return <span className="nad-row nad-classic-row"><span className="nad-classic-icon">{logo ? <img src={logo} alt="" loading="lazy" decoding="async" /> : <Sparkles aria-hidden="true" />}</span>
        <span className="nad-grow">{sponsor}<strong className="nad-title">{ad.title}</strong>{ad.description && <span className="nad-text nad-clamp-1">{ad.description}</span>}</span>
        {ad.button_text && <span className="nad-classic-cta">{ad.button_text}</span>}<Arrow className="nad-arrow" aria-hidden="true" /></span>;
    }
  })();
  return <button type="button" onClick={onClick} className={`nad nad-${template}`} data-template={template}
    style={template === 'classic' ? { ...style, background: `linear-gradient(135deg, ${accent} 0%, ${adjust(accent, -20)} 100%)`, color: onAccent } : style}>
    {body}
  </button>;
}
