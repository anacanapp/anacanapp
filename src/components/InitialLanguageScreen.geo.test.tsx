import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

let resolveGeo: (v: string | null) => void = () => {};
vi.mock('@/lib/geoLanguage', async (orig) => ({
  ...(await orig<typeof import('@/lib/geoLanguage')>()),
  fetchGeoCountry: () => new Promise<string | null>((r) => { resolveGeo = r; }),
}));
vi.mock('@/lib/i18n', async (orig) => ({
  ...(await orig<typeof import('@/lib/i18n')>()),
  ensureLanguageReady: vi.fn(async () => {}), loadTranslations: vi.fn(async () => {}),
  fetchActiveLanguages: vi.fn(() => Promise.reject(new Error('offline'))),
}));

import InitialLanguageScreen from './InitialLanguageScreen';
import { useUserStore } from '@/store/userStore';

const selected = () => Array.from(document.querySelectorAll('[data-lang]'))
  .filter((b) => b.querySelector('svg')).map((b) => b.getAttribute('data-lang'));

beforeEach(() => { useUserStore.setState({ language: 'az', hasSelectedLanguage: false }); Element.prototype.scrollIntoView = vi.fn(); });

describe('InitialLanguageScreen IP preselect', () => {
  it('preselects the language of the IP country', async () => {
    render(<InitialLanguageScreen />);
    expect(selected()).toEqual(['az']);
    await act(async () => resolveGeo('TR'));
    await waitFor(() => expect(selected()).toEqual(['tr']));
  });
  it('uses English when the country has no app language', async () => {
    render(<InitialLanguageScreen />);
    await act(async () => resolveGeo('IT'));
    await waitFor(() => expect(selected()).toEqual(['en']));
  });
  it('never overrides a language the user already tapped', async () => {
    render(<InitialLanguageScreen />);
    fireEvent.click(document.querySelector('[data-lang="de"]')!);
    await act(async () => resolveGeo('RU'));
    await new Promise((r) => setTimeout(r, 20));
    expect(selected()).toEqual(['de']);
  });
  it('keeps the old default when the country is unavailable', async () => {
    render(<InitialLanguageScreen />);
    await act(async () => resolveGeo(null));
    await new Promise((r) => setTimeout(r, 20));
    expect(selected()).toEqual(['az']);
  });
});
