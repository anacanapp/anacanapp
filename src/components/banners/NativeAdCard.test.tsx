import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeInlineCopy } from '../../../scripts/i18n/inline-localization.mjs';
import { NATIVE_TEMPLATES } from '@/lib/ads/brandTargeting';
import NativeAdCard, { contrastRatio, nativeTemplate, readableOn } from './NativeAdCard';

afterEach(cleanup);
const ad = { title: 'Pulsuz nümunə', description: 'Körpəniz üçün', button_text: 'Sifariş et', image_url: 'https://cdn.example/a.webp',
  background_color: '#1B3A5C', text_color: '#1B3A5C', link_type: 'external', creative_options: { offer_code: 'ANA10', expert_name: 'Dr. Leyla', expert_role: 'Pediatr' } };

describe('native ad templates', () => {
  it('renders every template as one accessible button with the brand copy', () => {
    for (const template of NATIVE_TEMPLATES) {
      const onClick = vi.fn();
      const { container, unmount } = render(<NativeAdCard ad={{ ...ad, native_template: template }} sponsorLabel="Sponsorlu · Brand" codeLabel="Kod" onClick={onClick} />);
      const button = container.querySelector('button')!;
      expect(button.dataset.template).toBe(template);
      expect(button.textContent).toContain('Pulsuz nümunə');
      expect(button.textContent).toContain('Sponsorlu · Brand');
      fireEvent.click(button); expect(onClick).toHaveBeenCalledOnce();
      unmount();
    }
  });
  it('shows template-specific content and only safe https images', () => {
    render(<NativeAdCard ad={{ ...ad, native_template: 'offer' }} codeLabel="Kod" />);
    expect(screen.getByText('ANA10')).toBeTruthy(); cleanup();
    render(<NativeAdCard ad={{ ...ad, native_template: 'expert' }} />);
    expect(screen.getByText('Dr. Leyla')).toBeTruthy(); expect(screen.getByText('Pediatr')).toBeTruthy(); cleanup();
    const { container } = render(<NativeAdCard ad={{ ...ad, native_template: 'spotlight', image_url: 'javascript:alert(1)' }} />);
    expect(container.querySelector('img')).toBeNull();
  });
  it('falls back to classic for unknown templates with a legible brand-coloured surface', () => {
    expect(nativeTemplate('carousel')).toBe('classic'); expect(nativeTemplate(null)).toBe('classic');
    const { container } = render(<NativeAdCard ad={{ ...ad, native_template: 'carousel' }} />);
    const button = container.querySelector('button')!;
    expect(button.dataset.template).toBe('classic');
    expect(button.style.getPropertyValue('--nad-on-accent')).toBe('#FFFFFF');
  });
  it('keeps brand text legible on the brand colour in light and dark themes', () => {
    expect(readableOn('#1B3A5C', '#1B3A5C')).toBe('#FFFFFF');
    expect(readableOn('#FFE680', '#FFFFFF')).toBe('#1A1A1A');
    expect(readableOn('#F48155', '#FFFFFF')).toBe('#1A1A1A');
    expect(readableOn('#0B3D2E', '#F5F5F5')).toBe('#F5F5F5');
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });
  it('holds no literal UI copy, so it can be shared with the web-only brand portal', () => {
    for (const file of ['src/components/banners/NativeAdCard.tsx', 'src/components/banners/LeadFormSheet.tsx']) {
      expect(analyzeInlineCopy(readFileSync(file, 'utf8'), file).messages).toEqual({});
    }
    const source = readFileSync('src/components/banners/NativeAdCard.tsx', 'utf8');
    expect(source).not.toMatch(/@\/lib\/tr|@\/i18n|integrations\/supabase|useTranslation/);
    expect(source).not.toMatch(/backdrop-filter|animation:/);
    expect(readFileSync('src/styles/native-ads.css', 'utf8').replace(/\/\*[^]*?\*\//g, '')).not.toMatch(/backdrop-filter|infinite/);
  });
});
