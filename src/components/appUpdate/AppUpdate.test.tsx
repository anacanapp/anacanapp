import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { softSheetAllowed, type AppUpdateDecision } from '@/hooks/useAppUpdate';
import { APP_UPDATE_TEXT_LANGUAGES, updateText } from '@/lib/appUpdate-i18n';
import { APP_LANGUAGE_CODES } from '@/lib/app-languages';
import AppUpdateSheet from './AppUpdateSheet';
import AppUpdateBanner from './AppUpdateBanner';

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn(), addListener: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react');
  return { motion: { div: forwardRef((props: any, ref) => { const { initial, animate, transition, ...rest } = props; return createElement('div', { ...rest, ref }); }) } };
});
afterEach(cleanup);

const base: AppUpdateDecision = {
  protocol: 'anacan-app-update-v1', rule_id: 'r1', mode: 'soft', frequency: 'daily', target_version: '51.0', store_version: '51.0',
  title: 'Yeni versiya hazırdır', body: null, whats_new: ['Yeni rəy bölməsi', 'Daha sürətli açılış'], button: null, later: null,
  store_url: 'https://apps.apple.com/app/id6758301924',
};

describe('update frequency', () => {
  const now = Date.UTC(2026, 10, 11, 12);
  it('daily: shows again 24h after Later, not before', () => {
    expect(softSheetAllowed(base, null, now)).toBe(true);
    expect(softSheetAllowed(base, now - 3 * 3600_000, now)).toBe(false);
    expect(softSheetAllowed(base, now - 25 * 3600_000, now)).toBe(true);
  });
  it('once: never again after Later', () => {
    expect(softSheetAllowed({ ...base, frequency: 'once' }, now - 40 * 86400_000, now)).toBe(false);
  });
  it('banner and force rules never open the sheet', () => {
    expect(softSheetAllowed({ ...base, mode: 'banner' }, null, now)).toBe(false);
    expect(softSheetAllowed({ ...base, mode: 'force' }, null, now)).toBe(false);
  });
});

describe('update texts', () => {
  it('has fixed labels in all 23 app languages', () => {
    expect(APP_UPDATE_TEXT_LANGUAGES.sort()).toEqual([...APP_LANGUAGE_CODES].sort());
    expect(updateText('later', 'ru')).toBe('Позже');
    expect(updateText('update', 'xx')).toBe('Yenilə'); // unknown codes normalise to the app default (az)
  });
});

describe('screens', () => {
  it('soft sheet lists what is new and calls Update / Later', () => {
    const onUpdate = vi.fn(), onLater = vi.fn();
    render(<AppUpdateSheet decision={base} currentVersion="49.0" onUpdate={onUpdate} onLater={onLater} />);
    expect(screen.getByRole('dialog', { name: 'Yeni versiya hazırdır' })).toBeInTheDocument();
    expect(screen.getByText('49.0 → 51.0 · App Store')).toBeInTheDocument();
    expect(screen.getByText('Daha sürətli açılış')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yenilə' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sonra' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onLater).toHaveBeenCalledOnce();
  });
  it('banner can be closed for this session', () => {
    render(<AppUpdateBanner decision={{ ...base, mode: 'banner' }} onUpdate={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Yeni versiya hazırdır');
    fireEvent.click(screen.getByRole('button', { name: 'Sonra' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
