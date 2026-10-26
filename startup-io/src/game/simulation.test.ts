import { describe, expect, it } from 'vitest';
import { ASSET_CATALOG, assetSpec, formatMoney, resourceSpec } from './assets';
import { canAcquire, radiusForMass, viewZoom } from './model';
import type { AssetKind, GameEvent, Input, RunSave } from './model';
import { GameSimulation } from './simulation';

const idle: Input = { x: 0, y: 0, boost: false };
const isolated = (mass = 10) => {
  const game = new GameSimulation({ name: 'Test Labs', seed: 42 });
  game.player.mass = mass; game.player.radius = radiusForMass(mass); game.stats.peakMass = mass;
  game.started = true;
  for (const bot of game.bots) { bot.alive = false; bot.respawnAt = Number.MAX_VALUE; }
  game.setViewport(390, 844);
  for (const pickup of game.pickups) { pickup.alive = false; pickup.respawnAt = Number.MAX_VALUE; game.grid.remove(pickup); }
  return game;
};
const addAsset = (game: GameSimulation, kind: AssetKind) => {
  const pickup = game.pickups[0]; pickup.spec = assetSpec(kind);
  pickup.x = game.player.x; pickup.y = game.player.y; pickup.alive = true; pickup.respawnAt = 0; game.grid.insert(pickup);
  return pickup;
};

describe('continuous company growth', () => {
  it('waits for the first move and has no timeout after it starts', () => {
    const game = new GameSimulation({ seed: 12 });
    const bot = { x: game.bots[0].x, y: game.bots[0].y };
    for (let index = 0; index < 60; index++) game.step(1 / 60, idle);
    expect(game.elapsed).toBe(0); expect(game.bots[0].x).toBe(bot.x);
    const quiet = isolated(); quiet.elapsed = 60 * 60 * 72;
    quiet.step(1 / 60, idle);
    expect(quiet.status).toBe('playing'); expect(quiet.result).toBeUndefined();
  });
  it('eats investments but cannot collect hardware before it is big enough', () => {
    const game = isolated(); const pickup = addAsset(game, 'gpu');
    game.step(1 / 60, idle); expect(pickup.alive).toBe(true); expect(game.player.mass).toBe(10);
    pickup.spec = assetSpec('investment'); game.step(1 / 60, idle);
    expect(pickup.alive).toBe(false); expect(game.player.mass).toBe(14); expect(game.player.radius).toBe(radiusForMass(14)); expect(game.snapshot().credits).toBe(3);
  });
  it('announces each new asset once and continues after all assets unlock', () => {
    const game = isolated(58); const events: GameEvent[] = []; game.onEvent = event => events.push(event);
    addAsset(game, 'investment'); game.step(1 / 60, idle);
    addAsset(game, 'gpu'); game.step(1 / 60, idle);
    expect(game.player.mass).toBeCloseTo(98.4); expect(events.filter(event => event.type === 'unlock' && event.kind === 'gpu')).toHaveLength(1);
    expect(game.stats.assets).toBe(1);
    game.player.mass = 180000; game.player.radius = radiusForMass(180000);
    addAsset(game, 'hq'); game.step(1 / 60, idle);
    expect(game.player.mass).toBe(205000); expect(game.status).toBe('playing'); expect(game.snapshot().nextAsset).toBeUndefined();
  });
  it.each([200, 1000, 4500, 16000, 55000, 180000, 1e9, 1e15])('keeps growing past valuation %s without a final stage', mass => {
    const game = isolated(mass); const pickup = addAsset(game, 'investment');
    pickup.spec = { ...pickup.spec, value: mass * .04 };
    game.step(1 / 60, idle);
    expect(game.player.mass).toBeGreaterThan(mass); expect(game.status).toBe('playing'); expect(game.result).toBeUndefined();
    const zoom = viewZoom(game.player.mass, 390, 844);
    expect(game.player.radius * zoom).toBeGreaterThan(20); expect(game.player.radius * zoom).toBeLessThan(40);
  });
  it('future hardware scales its value and availability with a large company', () => {
    const massive = resourceSpec(1e12, 50000, .8, 'tech');
    expect(massive.value).toBeGreaterThan(1e10); expect(massive.requiredMass).toBeLessThan(1e12);
    expect(ASSET_CATALOG.map(spec => spec.kind)).toContain('hq');
    expect(formatMoney(1e12)).toBe('$1Q'); expect(formatMoney(1e18)).not.toContain('Infinity');
  });
});

describe('survival, travel and controls', () => {
  it('protects the initial spawn then records an acquisition exactly once', () => {
    const game = isolated(); const rival = game.bots[7];
    rival.mass = 100; rival.radius = radiusForMass(100); rival.x = game.player.x; rival.y = game.player.y; rival.alive = true;
    game.step(1 / 60, idle); expect(game.status).toBe('playing');
    game.shield = 0; game.step(1 / 60, idle);
    expect(game.status).toBe('playing'); expect(game.snapshot().danger?.name).toBe('Nimvale AI');
    for (let index = 0; index < 75; index++) { rival.x = game.player.x; rival.y = game.player.y; game.step(1 / 60, idle); }
    expect(game.status).toBe('lost'); expect(game.result?.killer).toBe('Nimvale AI');
    const result = game.result; game.step(1 / 60, idle); expect(game.result).toBe(result);
  });
  it('requires a size advantage and allows smaller brand acquisitions', () => {
    expect(canAcquire(117, 100)).toBe(false); expect(canAcquire(118, 100)).toBe(true);
    const game = isolated(50); const rival = game.bots[0]; rival.mass = 20; rival.radius = radiusForMass(20); rival.x = game.player.x; rival.y = game.player.y; rival.alive = true;
    game.step(1 / 60, idle); expect(rival.alive).toBe(false); expect(game.stats.acquisitions).toBe(1); expect(game.player.mass).toBeCloseTo(63.6); expect(game.snapshot().credits).toBe(45);
  });
  it('gives an overlapping rival a visible windup and cancels it when the player escapes', () => {
    const game = isolated(); game.shield = 0;
    const rival = game.bots[7]; rival.alive = true; rival.mass = 100; rival.radius = radiusForMass(100); rival.x = game.player.x; rival.y = game.player.y;
    for (let index = 0; index < 30; index++) { rival.x = game.player.x; rival.y = game.player.y; game.step(1 / 60, idle); }
    expect(game.snapshot().danger?.progress).toBeGreaterThan(.4); expect(game.status).toBe('playing');
    rival.x += 800; game.step(1 / 60, idle);
    expect(game.snapshot().danger).toBeUndefined(); expect(game.status).toBe('playing');
  });
  it('PIVOT interrupts a pending acquisition and resume grants a brief response window', () => {
    const game = isolated(); game.shield = 0;
    const rival = game.bots[7]; rival.alive = true; rival.mass = 100; rival.radius = radiusForMass(100); rival.x = game.player.x; rival.y = game.player.y;
    game.step(1 / 60, idle); expect(game.snapshot().danger).toBeDefined();
    game.step(1 / 60, { ...idle, pivot: true }); expect(game.snapshot().danger).toBeUndefined(); expect(game.status).toBe('playing');
    game.elapsed += 5; game.pause(); game.resume(); game.step(1 / 60, idle);
    expect(game.player.protectedUntil).toBeGreaterThan(game.elapsed); expect(game.snapshot().danger).toBeUndefined();
  });
  it('a distant supergiant cannot swallow a player from beyond its visible collision neighbourhood', () => {
    const game = isolated(); game.shield = 0;
    const rival = game.bots[7]; rival.alive = true; rival.mass = 1e8; rival.radius = radiusForMass(rival.mass); rival.x = game.player.x + game.player.radius * 5; rival.y = game.player.y;
    for (let index = 0; index < 50; index++) game.step(1 / 60, idle);
    expect(game.snapshot().danger).toBeUndefined(); expect(game.status).toBe('playing');
  });
  it('respawns distant brands near the new area with relevant sizes', () => {
    const game = isolated(1e6); const bot = game.bots[1];
    bot.alive = true; bot.x = game.player.x + game.localRange * 3;
    game.step(1 / 60, idle);
    expect(Math.hypot(bot.x - game.player.x, bot.y - game.player.y)).toBeLessThan(game.localRange * 1.2);
    expect(bot.mass).toBeGreaterThan(500000); expect(bot.logo).toBe('brindle');
  });
  it('normalizes diagonal motion and keeps boost stable after depletion', () => {
    const straight = isolated(); const diagonal = isolated(); const origin = { ...straight.player };
    for (let index = 0; index < 8; index++) { straight.step(1 / 60, { x: 1, y: 0, boost: false }); diagonal.step(1 / 60, { x: 1, y: 1, boost: false }); }
    expect(Math.hypot(diagonal.player.x - origin.x, diagonal.player.y - origin.y)).toBeCloseTo(straight.player.x - origin.x, 4);
    for (let index = 0; index < 260; index++) straight.step(1 / 60, { x: 1, y: 0, boost: true });
    expect(straight.boosting).toBe(false); expect(straight.energy).toBeGreaterThan(0);
    straight.step(1 / 60, idle); straight.step(1 / 60, { x: 1, y: 0, boost: true }); expect(straight.boosting).toBe(true);
  });
  it('pauses elapsed time and movement without ending the company', () => {
    const game = isolated(); const x = game.player.x;
    game.pause(); game.step(1, { x: 1, y: 0, boost: true }); expect(game.elapsed).toBe(0); expect(game.player.x).toBe(x); expect(game.energy).toBe(100);
    game.resume(); game.step(1 / 60, idle); expect(game.status).toBe('playing');
  });
  it('rebases travel past both old map boundaries and negative coordinates', () => {
    const game = isolated(); const events: GameEvent[] = []; game.onEvent = event => events.push(event);
    game.player.x = 15000; game.player.y = -19000;
    game.step(1 / 60, { x: 1, y: 0, boost: false });
    expect(game.world.originX).toBeGreaterThan(0n); expect(game.world.originY).toBeLessThan(0n);
    expect(Math.abs(game.player.x)).toBeLessThan(game.world.chunkSize);
    expect(events.some(event => event.type === 'rebase')).toBe(true);
    expect(game.world.activeCount).toBeLessThanOrEqual(81);
  });
  it('restores an ongoing company with its exact mass, elapsed time and world origin', () => {
    const game = isolated(70000); game.elapsed = 4250; game.player.x = -291; game.stats.investments = 26;
    const saved = JSON.parse(JSON.stringify(game.save())) as RunSave;
    const resumed = new GameSimulation({ saved, name: 'Restored Labs' });
    expect(resumed.status).toBe('paused'); expect(resumed.player.mass).toBe(70000); expect(resumed.elapsed).toBe(4250); expect(resumed.player.x).toBe(-291);
    expect(resumed.stats.investments).toBe(26); expect(resumed.world.originX.toString()).toBe(saved.world.originX);
  });
  it('finishes only when deliberately abandoned and keeps its session reward', () => {
    const game = isolated(); addAsset(game, 'investment'); game.step(1 / 60, idle);
    game.pause(); const result = game.abandon();
    expect(result?.reason).toBe('quit'); expect(game.status).toBe('finished'); expect(result?.stats.investments).toBe(1);
    expect(game.abandon()?.runId).toBe(result?.runId);
  });
  it('arena activity follows real acquisitions and the subsequent bot return', () => {
    const game = isolated(50); const rival = game.bots[0];
    rival.mass = 20; rival.radius = radiusForMass(20); rival.x = game.player.x; rival.y = game.player.y; rival.alive = true;
    game.step(1 / 60, idle);
    const acquisition = game.snapshot().activity.find(event => event.type === 'acquired');
    expect(acquisition?.actor.id).toBe(0); expect(acquisition?.target?.name).toBe('Vellune Studio');
    game.elapsed = rival.respawnAt; game.step(1 / 60, idle);
    expect(game.snapshot().activity.some(event => event.type === 'joined' && event.actor.id === rival.id)).toBe(true);
    expect(game.snapshot().room).toMatch(/^VC-\d{4}$/); expect(game.activity.length).toBeLessThanOrEqual(6);
  });
});
