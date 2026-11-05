import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMERGENCY_PLACEHOLDER, FALLBACK_EMERGENCY_NUMBER, fillEmergencyNumber, getEmergencyNumber } from './emergency';
import { APP_LANGUAGE_CODES } from './app-languages';
import { useUserStore } from '@/store/userStore';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';

const auth = vi.hoisted(() => ({ profile: null as { country_code: string | null } | null }));
vi.mock('@/contexts/AuthContext', () => ({ useOptionalAuthContext: () => ({ profile: auth.profile }) }));

describe('getEmergencyNumber', () => {
  it.each([
    ['AZ', '103'], ['GB', '999'], ['US', '911'], ['CA', '911'],
    ['RU', '103'], ['KZ', '103'], ['KG', '103'], ['UZ', '103'], ['BY', '103'], ['UA', '103'],
    ['TR', '112'], ['GE', '112'], ['DE', '112'], ['FR', '112'], ['EE', '112'], ['SE', '112'], ['PL', '112'],
  ])('%s -> %s', (country, number) => {
    expect(getEmergencyNumber(country)).toBe(number);
    expect(getEmergencyNumber(country.toLowerCase())).toBe(number);
  });

  it('falls back to 112 when the country is unknown or missing', () => {
    expect(FALLBACK_EMERGENCY_NUMBER).toBe('112');
    for (const value of [null, undefined, '', 'ZZ', 'not-a-country', '1']) expect(getEmergencyNumber(value)).toBe('112');
  });

  it('has a number for every country the app languages point at', () => {
    for (const code of ['AZ', 'GB', 'TR', 'RU', 'DE', 'SA', 'GE', 'KZ', 'UZ', 'CN', 'ID', 'FR', 'ES', 'PT', 'VN', 'IN', 'JP', 'KR', 'PL', 'NL', 'SE', 'KG', 'EE']) {
      expect(getEmergencyNumber(code), code).toMatch(/^\d{3,5}$/);
    }
  });
});

describe('fillEmergencyNumber', () => {
  it('fills the placeholder', () => {
    expect(fillEmergencyNumber('In an emergency, call {emergency}.', '999')).toBe('In an emergency, call 999.');
  });
  it('rewrites the legacy literal 103 from cached copy without touching other digits', () => {
    expect(fillEmergencyNumber('In an emergency, call 103.', '911')).toBe('In an emergency, call 911.');
    expect(fillEmergencyNumber('Təcili hallarda 103-ə zəng edin.', '103')).toBe('Təcili hallarda 103-ə zəng edin.');
    expect(fillEmergencyNumber('Call 1030 or +103 or 2103', '999')).toBe('Call 1030 or +103 or 2103');
  });
});

const localeFiles = () => APP_LANGUAGE_CODES.map((lang) => [lang, ['az', 'en'].includes(lang)
  ? resolve(process.cwd(), `src/locales/${lang}.json`) : resolve(process.cwd(), `scripts/i18n/${lang}.seed.json`)] as const);

describe('emergency copy in every app language', () => {
  const keys = ['medical_disclaimer_full', 'medical_disclaimer_text', 'aichatscreen_medical_disclaimer_banner',
    'firstaidguide_103_zeng_et_52da85', 'poopscanner_tecili_yardim_103_176a98'];
  it.each(localeFiles())('%s uses the {emergency} placeholder instead of a fixed number', (_lang, file) => {
    const dict = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
    for (const key of keys) {
      expect(dict[key], key).toContain(EMERGENCY_PLACEHOLDER);
      expect(dict[key], key).not.toMatch(/(^|[^\d])(103|112)(?!\d)/);
    }
    for (const key of ['bp_guide_crisis', 'bp_th_crisis', 'rf_103_title']) {
      if (dict[key]) expect(dict[key], key).not.toMatch(/(^|[^\d])(103|112)(?!\d)/);
    }
  });

  it('solid food guide bundles use the placeholder in every language', () => {
    const dir = resolve(process.cwd(), 'src/data/solid-food-guide');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(APP_LANGUAGE_CODES.length);
    for (const file of files) {
      const text = JSON.parse(readFileSync(resolve(dir, file), 'utf8')).emergency as string;
      expect(text, file).toContain(EMERGENCY_PLACEHOLDER);
      expect(text, file).not.toMatch(/\b(103|112)\b/);
    }
  });
});

describe('MedicalDisclaimer', () => {
  afterEach(() => { cleanup(); auth.profile = null; useUserStore.setState({ countryCode: null }); });

  it('renders the profile country number', () => {
    auth.profile = { country_code: 'GB' };
    render(createElement(MedicalDisclaimer, { variant: 'anacan' }));
    expect(screen.getByText(/999/)).toBeTruthy();
    expect(screen.queryByText(/103|\{emergency\}/)).toBeNull();
  });

  it('uses the stored country before sign-in and 112 when unknown', () => {
    useUserStore.setState({ countryCode: 'US' });
    render(createElement(MedicalDisclaimer, { variant: 'anacan' }));
    expect(screen.getByText(/911/)).toBeTruthy();
    cleanup();
    useUserStore.setState({ countryCode: null });
    render(createElement(MedicalDisclaimer, { variant: 'anacan' }));
    expect(screen.getByText(/112/)).toBeTruthy();
  });
});
