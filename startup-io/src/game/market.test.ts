import { describe, expect, it } from 'vitest';
import { BRANDS } from './cosmetics';
import { FUNDS, gainMultiplier, marketAt } from './market';
import type { Opportunity } from './market';
import { GameSimulation } from './simulation';
import { radiusForMass } from './model';
import { BRAND_PATHS } from './fictional-brands';
import { checkpointRun, freshProgress, parseProgress } from '../persistence';

const idle = { x: 0, y: 0, boost: false };
const isolated = (sector: 'ai' | 'fintech' | 'cloud' = 'ai') => {
  const game = new GameSimulation({ seed: 42, sector }); game.started = true;
  for (const bot of game.bots) { bot.alive = false; bot.respawnAt = Number.MAX_VALUE; }
  for (const pickup of game.pickups) { pickup.alive = false; pickup.respawnAt = Number.MAX_VALUE; game.grid.remove(pickup); }
  game.market.nextSpawn = Number.MAX_VALUE;
  return game;
};
const opportunity = (game: GameSimulation, kind: Opportunity['kind'] = 'fund', fund: Opportunity['fund'] = 'angel'): Opportunity => ({ id: 1, kind, fund, x: game.player.x, y: game.player.y, radius: 15, value: 50, alive: true, expires: game.elapsed + 65 });

describe('venture opportunities and founder advantages', () => {
  it('provides 48 unique competitors with varied strategies and finite valuations', () => {
    expect(BRANDS).toHaveLength(48); expect(new Set(BRANDS.map(brand => brand.name)).size).toBe(48);
    expect(new Set(BRANDS.map(brand => brand.path)).size).toBe(48); expect(Object.keys(BRAND_PATHS)).toHaveLength(48);
    const game = new GameSimulation({ seed: 42 });
    expect(game.bots).toHaveLength(48); expect(game.bots.every(bot => Number.isFinite(bot.mass) && bot.mass > 0)).toBe(true);
    expect(new Set(game.bots.map(bot => bot.ai.aggression)).size).toBeGreaterThan(2);
  });
  it.each(FUNDS.map(fund => [fund.id, fund.power] as const))('%s fund immediately grows the company and grants %s once', (id, power) => {
    const game = isolated(); const item = opportunity(game, 'fund', id);
    game.collectOpportunity(item); game.collectOpportunity(item);
    expect(game.player.mass).toBe(60); expect(game.player.radius).toBe(radiusForMass(60)); expect(game.stats.funds).toBe(1);
    expect(game.hasPower(power)).toBe(true); expect(game.snapshot().credits).toBe(35);
  });
  it('lets a competitor secure a venture round without granting the player its benefits', () => {
    const game = isolated(); const bot = game.bots[0]; bot.alive = true;
    const mass = bot.mass; game.collectOpportunity(opportunity(game), bot);
    expect(bot.mass).toBe(mass + 42.5); expect(game.stats.funds).toBeUndefined(); expect(game.hasPower('magnet')).toBe(false);
  });
  it('spawns opportunities over time and bounds their active scene count', () => {
    const game = isolated(); game.market.nextSpawn = 0;
    for (let index = 0; index < 100; index++) { game.elapsed += 16; game.step(1 / 60, idle); }
    expect(game.market.sequence).toBeGreaterThan(70); expect(game.market.opportunities.length).toBeLessThanOrEqual(7);
    expect(game.market.opportunities.some(item => item.kind === 'fund')).toBe(true);
  });
  it('expires powers and preserves elapsed durations across pause and resume', () => {
    const game = isolated(); game.collectOpportunity(opportunity(game, 'talent'));
    game.pause(); const power = game.market.powers[0].until; game.step(1, idle);
    expect(game.market.powers[0].until).toBe(power);
    const saved = checkpointRun(freshProgress(), game.save()); const resumed = new GameSimulation({ saved: parseProgress(JSON.stringify(saved)).activeRun! });
    expect(resumed.hasPower('magnet')).toBe(true); expect(resumed.market.powers[0].until).toBe(power);
    resumed.resume(); resumed.elapsed = power; resumed.step(1 / 60, idle); expect(resumed.hasPower('magnet')).toBe(false);
  });
  it('cloud credits refill energy and accelerator changes movement speed', () => {
    const regular = isolated(); const accelerated = isolated(); accelerated.energy = 5;
    accelerated.collectOpportunity(opportunity(accelerated, 'cloud-credit'));
    expect(accelerated.energy).toBe(100);
    regular.step(1 / 60, { x: 1, y: 0, boost: false }); accelerated.step(1 / 60, { x: 1, y: 0, boost: false });
    expect(accelerated.player.vx).toBeGreaterThan(regular.player.vx);
  });
  it('PIVOT grants a short escape shield, then respects its cooldown', () => {
    const game = isolated(); game.shield = 0;
    game.step(1 / 60, { x: 1, y: 0, boost: false, pivot: true });
    expect(game.snapshot().pivoting).toBe(true); const ready = game.market.pivotReadyAt;
    game.elapsed += .4; game.step(1 / 60, { ...idle, pivot: true }); expect(game.market.pivotReadyAt).toBe(ready);
    game.elapsed = ready; game.step(1 / 60, idle); game.step(1 / 60, { ...idle, pivot: true }); expect(game.market.pivotReadyAt).toBeGreaterThan(ready);
  });
  it('audit reduces valuation and energy but firewall prevents the loss', () => {
    const game = isolated(); game.player.mass = 100; game.player.radius = radiusForMass(100); game.shield = 0;
    game.collectOpportunity(opportunity(game, 'audit')); expect(game.player.mass).toBe(91); expect(game.energy).toBe(78);
    game.elapsed += 5; game.collectOpportunity(opportunity(game, 'fund', 'series-a'));
    const protectedMass = game.player.mass; game.collectOpportunity(opportunity(game, 'audit'));
    expect(game.player.mass).toBe(protectedMass); expect(game.hasPower('firewall')).toBe(true);
  });
  it('pays each mission exactly once, including after restoring its checkpoint', () => {
    const game = isolated(); game.stats.investments = 12; game.step(1 / 60, idle);
    expect(game.stats.bonusCredits).toBe(45);
    game.step(1 / 60, idle); expect(game.stats.bonusCredits).toBe(45);
    const saved = checkpointRun(freshProgress(), game.save()); expect(saved.credits).toBe(331);
    const restored = new GameSimulation({ saved: parseProgress(JSON.stringify(saved)).activeRun! }); restored.resume(); restored.step(1 / 60, idle);
    expect(restored.stats.bonusCredits).toBe(45);
  });
  it('sectors and market cycles have distinct, deterministic effects without ending a run', () => {
    expect(gainMultiplier('ai', 'gpu', 'steady', false)).toBe(1.3);
    expect(gainMultiplier('fintech', 'fund', 'steady', false)).toBe(1.15);
    expect(gainMultiplier('cloud', 'investment', 'funding-winter', false)).toBe(.7);
    expect(marketAt(50).phase).toBe('ai-boom'); expect(marketAt(135).phase).toBe('funding-winter');
    expect(marketAt(220).phase).toBe('gpu-shortage'); expect(marketAt(305).phase).toBe('product-launch');
    const ai = isolated('ai'); const cloud = isolated('cloud');
    ai.step(1 / 60, { x: 1, y: 0, boost: true }); cloud.step(1 / 60, { x: 1, y: 0, boost: true });
    expect(cloud.energy).toBeGreaterThan(ai.energy); expect(cloud.status).toBe('playing');
  });
});
