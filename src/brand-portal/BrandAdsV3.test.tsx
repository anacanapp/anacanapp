import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import v3 from '../../scripts/i18n/brand-portal-v3-copy.json';
import { APP_LANGUAGES } from '@/lib/app-languages';

const auth = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => { throw new Error('Consumer auth must not enter the brand portal'); });
vi.mock('./Auth', () => ({ useBrandAuth: () => ({ client: { rpc: auth.rpc }, session: { user: { id: 'member' } }, access: { allowed: true, admin: false, brands: [] }, backendOrigin: 'https://api.anacan.az' }) }));
import { portalText } from './copy';
import { creativeIssues, emptyCreative } from './Creatives';
import { leadFormIssues, leadsCsv } from './Leads';
import BrandAudienceView, { bucketLabel } from './Audience';

afterEach(() => { cleanup(); auth.rpc.mockReset(); });
const brand = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Owned brand', website: null, logo_url: null, report_timezone: 'Asia/Baku', is_active: true, created_at: '2026-01-01' };
const t = (key: any, values?: Record<string, string | number>) => portalText(key, 'en', values);

describe('portal v3 copy', () => {
  it('covers all 21 languages with identical keys and placeholders', () => {
    const languages = v3.languages as Record<string, Record<string, string>>, english = v3.languages.en as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual(APP_LANGUAGES.map(item => item.code).sort());
    for (const [code, values] of Object.entries(languages)) {
      expect(Object.keys(values).sort(), code).toEqual(Object.keys(english).sort());
      for (const key of Object.keys(english)) expect((values[key].match(/\{\w+\}/g) ?? []).sort(), `${code}.${key}`).toEqual((english[key].match(/\{\w+\}/g) ?? []).sort());
    }
  });
  it('falls back to the shared brand copy and interpolates values', () => {
    expect(portalText('impressions', 'az')).toBe(portalText('impressions', 'az'));
    expect(portalText('k_notice', 'en', { k: 20 })).toContain('20');
    expect(portalText('reach', 'en')).toBe('Reach'); expect(portalText('reach', 'xx')).toBe(portalText('reach', 'az'));
    expect(portalText('reach', 'ar')).not.toBe('Reach');
  });
});

describe('creative and lead form validation', () => {
  it('requires copy, a safe destination and valid targeting before submission', () => {
    expect(creativeIssues(emptyCreative()).sort()).toEqual(['copy', 'link']);
    const ready = { ...emptyCreative(), copy: { az: { title: 'Salam' } }, link_url: 'https://brand.example', audience_tiers: ['free', 'premium'] as ('free' | 'premium')[] };
    expect(creativeIssues(ready)).toEqual([]);
    expect(creativeIssues({ ...ready, link_url: 'http://brand.example' })).toEqual(['link']);
    expect(creativeIssues({ ...ready, link_type: 'lead_form', lead_form_id: null })).toEqual(['link']);
    expect(creativeIssues({ ...ready, audience_tiers: [] })).toEqual(['tiers']);
    expect(creativeIssues({ ...ready, banner_type: 'image' })).toEqual(['image']);
    expect(creativeIssues(ready, true)).toEqual(['week_list']);
  });
  it('requires a contact field, consent copy and translated questions', () => {
    const base = { name: 'Sample', fields: [{ key: 'name' as const, required: true }, { key: 'phone' as const, required: true }], copy: { az: { title: 'T', consent: 'C' } }, privacy_url: '', retention_days: 90 };
    expect(leadFormIssues(base)).toEqual([]);
    expect(leadFormIssues({ ...base, fields: [{ key: 'name', required: true }] })).toEqual(['contact']);
    expect(leadFormIssues({ ...base, copy: { az: { title: 'T' } } })).toEqual(['copy']);
    expect(leadFormIssues({ ...base, fields: [...base.fields, { key: 'question_1', required: false }] })).toEqual(['questions']);
    expect(leadFormIssues({ ...base, privacy_url: 'http://x.example' })).toEqual(['privacy']);
  });
  it('exports leads as spreadsheet-safe CSV', () => {
    const csv = leadsCsv({ protocol: 'anacan-brand-leads-v1', brand: brand.id, total: 1, export_truncated: false,
      leads: [{ id: '1', form_id: 'f', form_name: '=HYPERLINK("x")', answers: { name: '+cmd', phone: '+994501234567' }, language: 'az', consent_text: 'ok', consent_at: '', created_at: '2026-10-22', expires_at: '' }] }, brand, t);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`); expect(csv).toContain(`"'+cmd"`);
  });
});

describe('audience report', () => {
  it('labels buckets for every dimension', () => {
    expect(bucketLabel('tier', 'premium', t, 'en')).toBe('Premium members');
    expect(bucketLabel('week_bucket', '13-16', t, 'en')).toBe('Weeks 13–16');
    expect(bucketLabel('child_age_bucket', '0-3m', t, 'en')).toBe('0–3 months');
    expect(bucketLabel('child_age_bucket', '36m+', t, 'en')).toBe('36+ months');
    expect(bucketLabel('trimester', '2', t, 'en')).toBe('Trimester 2');
    expect(bucketLabel('stage', 'other', t, 'en')).toBe('Other (small groups)');
    expect(bucketLabel('country', 'AZ', t, 'en')).toMatch(/Azerbaijan/);
  });
  const renderAudience = (data: unknown) => {
    auth.rpc.mockReturnValue({ abortSignal: async () => ({ data, error: null }) });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queries}><BrandAudienceView brand={brand} t={t} language="en" /></QueryClientProvider>);
  };
  it('shows only k-anonymous groups and never a group below the threshold', async () => {
    renderAudience({ protocol: 'anacan-brand-audience-v1', brand: brand.id, from: '2026-09-23', to: '2026-10-22', k: 20, available: true, reach: 160, timezone: 'Asia/Baku', refreshed_at: '2026-10-22T10:00:00Z',
      dimensions: { tier: [{ bucket: 'free', reach: 120, impressions: 400, clicks: 12 }, { bucket: 'premium', reach: 40, impressions: 90, clicks: 3 }],
        country: [{ bucket: 'AZ', reach: 150, impressions: 470, clicks: 14 }, { bucket: 'GE', reach: 4, impressions: 9, clicks: 0 }] } });
    await waitFor(() => expect(screen.getByText('Premium members')).toBeTruthy());
    expect(screen.queryByText(/Georgia/)).toBeNull();
    expect(auth.rpc).toHaveBeenCalledWith('brand_audience_report_v1', expect.objectContaining({ p_brand: brand.id, p_placement: null }));
  });
  it('explains when the audience is too small to report', async () => {
    renderAudience({ protocol: 'anacan-brand-audience-v1', brand: brand.id, from: '2026-09-23', to: '2026-10-22', k: 20, available: false, dimensions: {}, timezone: 'Asia/Baku', refreshed_at: '2026-10-22T10:00:00Z' });
    await waitFor(() => expect(screen.getByText('Not enough audience yet')).toBeTruthy());
  });
  it('rejects a report for another brand', async () => {
    renderAudience({ protocol: 'anacan-brand-audience-v1', brand: 'another', k: 20, available: true, dimensions: {} });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy());
  });
});

describe('web-only isolation', () => {
  it('keeps consumer i18n, consumer auth and native-only modules out of the brand portal', () => {
    for (const file of readdirSync('src/brand-portal').filter(name => /\.tsx?$/.test(name) && !/\.test\./.test(name))) {
      const source = readFileSync(`src/brand-portal/${file}`, 'utf8');
      expect(source, file).not.toMatch(/@\/lib\/tr['"]|@\/i18n|@\/integrations\/supabase\/client|@\/hooks\/useAuth|@capacitor\//);
    }
  });
});
