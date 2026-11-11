import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GlassTour from './GlassTour';
import { buildTourPlan, type TourTool } from '@/lib/onboardingTour';

vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
afterEach(cleanup);
const tools: TourTool[] = [{ id: 'mood', name: 'Əhval Gündəliyi', open: true }, { id: 'vaccine-calendar', name: 'Peyvənd Təqvimi', description: 'Peyvənd qrafiki', open: true }];
const setup = (push: 'prompt' | 'granted' = 'prompt', isPremium = false) => {
  const props = { onNavigate: vi.fn(), onPush: vi.fn(async () => {}), onPremium: vi.fn(), onFinish: vi.fn() };
  const plan = buildTourPlan({ stage: 'mommy', isPremium, push, tools });
  render(<GlassTour plan={plan} name="Leyla" stage="mommy" isPremium={isPremium} aiFreePerDay={3} tools={tools} {...props} />);
  return { ...props, plan };
};
const next = () => fireEvent.click(screen.getAllByRole('button').find((b) => /Davam|Başlayaq|Bitir/.test(b.textContent || ''))!);

describe('GlassTour', () => {
  it('starts on the welcome card and closes as skipped', () => {
    const p = setup();
    expect(screen.getByText('Xoş gəldin, Leyla!')).toBeTruthy();
    expect(p.onNavigate).toHaveBeenCalledWith({ tab: 'home' });
    fireEvent.click(screen.getByText('Sonra, özüm baxaram'));
    expect(p.onFinish).toHaveBeenCalledWith('skipped', 'welcome:0');
  });

  it('walks into the mood tool, asks for push once and shows where the user is', async () => {
    const p = setup('prompt');
    next(); // welcome → tools tab spot
    next(); // → mood tile on the tools list
    expect(p.onNavigate).toHaveBeenLastCalledWith({ tab: 'tools', tool: null });
    next(); // → inside the mood tool
    expect(p.onNavigate).toHaveBeenLastCalledWith({ tab: 'tools', tool: 'mood' });
    expect(screen.getByText(/Siz buradasınız: Alətlər › Əhval Gündəliyi/)).toBeTruthy();
    next(); // → push sub
    fireEvent.click(screen.getByText('Bəli, xatırlat'));
    await vi.waitFor(() => expect(p.onPush).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.getByText('Bunlar sizdə ödənişsizdir')).toBeTruthy());
  });

  it('never shows the push ask when permission is already granted', () => {
    setup('granted');
    for (let i = 0; i < 4; i++) next();
    expect(screen.queryByText('Bəli, xatırlat')).toBeNull();
  });

  it('skips the Premium-only AI screen for free users and finishes as done on the last card', () => {
    const p = setup('granted');
    const subs = p.plan.flatMap((s) => s.subs);
    expect(subs.some((s) => s.copy === 'ai_tab' || s.copy === 'ai_screen_free' || s.nav.tab === 'ai')).toBe(false);
    while (!screen.queryByText('Daha çoxunu açın')) next();
    fireEvent.click(screen.getByText('Ödənişsiz davam et'));
    fireEvent.click(screen.getByText('Başla'));
    expect(p.onFinish).toHaveBeenCalledWith('done', 'final:0');
    expect(p.onPremium).not.toHaveBeenCalled();
  });

  it('Premium users get no Premium card', () => {
    const p = setup('granted', true);
    expect(p.plan.some((s) => s.id === 'premium')).toBe(false);
  });
});
