import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The whole az content chunk: the home card must never load it (only tips.ts + programmes.ts).
const flags = vi.hoisted(() => ({ fullChunkLoaded: false }));
vi.mock('@/data/parenting/az', async (orig) => {
  flags.fullChunkLoaded = true;
  return orig();
});

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
  getPersistedLanguage: () => 'az',
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: false }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => 'on' }));
vi.mock('@/hooks/useDisabledTools', () => ({ useDisabledTools: () => ({ disabledTools: [], isToolDisabled: () => false }) }));
vi.mock('@/store/userStore', () => ({
  useUserStore: (sel: (s: { language: string; lifeStage: string }) => unknown) => sel({ language: 'az', lifeStage: 'mommy' }),
}));
vi.mock('@/hooks/useChildren', () => ({
  useChildren: () => ({ selectedChild: { id: 'c1', name: 'Aysel', birth_date: '2024-07-07' }, children: [{ id: 'c1', name: 'Aysel', birth_date: '2024-07-07' }] }),
}));
vi.mock('@/lib/analytics', () => ({ analytics: { logToolUsed: vi.fn() } }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: false, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/parenting-reminders', async (orig) => ({ ...(await orig<typeof import('@/lib/parenting-reminders')>()), syncParentingReminders: vi.fn() }));

import ParentingHomeCard from './ParentingHomeCard';
import { PARENTING_HOME_LOADERS, PARENTING_LANGUAGE_LOADERS, loadBundledParentingContent, loadParentingTips } from '@/data/parenting';
import { TIPS } from '@/data/parenting/az/tips';

afterEach(cleanup);
const NOW = new Date(2026, 10, 7, 10);

describe('Tərbiyə home card bundle', () => {
  it('shows today’s tip from the small tips + programmes chunk without loading the whole language content', async () => {
    render(<ParentingHomeCard onOpen={vi.fn()} now={NOW} />);
    const card = await screen.findByTestId('parenting-home-card');
    expect(TIPS['1-3'].some((tip) => card.textContent?.includes(tip.title))).toBe(true);
    expect(flags.fullChunkLoaded).toBe(false);
  });

  it('does not import the full content hook or loader', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/tools/parenting/ParentingHomeCard.tsx'), 'utf8');
    expect(src).not.toMatch(/useParentingContent|loadParentingContent|PARENTING_LANGUAGE_LOADERS/);
    expect(src).toMatch(/useParentingTips/);
  });

  it('has a small loader for every registered language', async () => {
    expect(Object.keys(PARENTING_HOME_LOADERS).sort()).toEqual(Object.keys(PARENTING_LANGUAGE_LOADERS).sort());
    const en = await loadParentingTips('en', { overrides: false });
    expect(en?.tips['1-3'].length).toBeGreaterThan(0);
    expect(en?.programmes.map((p) => p.id)).toContain('sleep-7');
    expect(await loadParentingTips('xx')).toBeNull();
    expect(flags.fullChunkLoaded).toBe(false);
  });

  it('(control) the detector sees the full chunk once the tool loads it', async () => {
    await loadBundledParentingContent('az');
    expect(flags.fullChunkLoaded).toBe(true);
  });
});
