import { describe, expect, it } from 'vitest';
import { buyItem, checkpointRun, equipItem, freshProgress, parseProgress, recordResult } from './persistence';
import type { GameResult } from './game/model';
import { GameSimulation } from './game/simulation';

const result: GameResult = { runId: 'run-first', mass: 400, elapsed: 480, reason: 'competitor', stats: { investments: 20, assets: 3, acquisitions: 1, peakMass: 400, distance: 7000 } };

describe('endless checkpoints and earned credits', () => {
  it('preserves wallet, cosmetics and old achievements during the version upgrade', () => {
    const old = { version: 2, name: 'Legacy AI', color: '#ffabd6', credits: 70, lifetimeCredits: 250, owned: ['lotus'], look: { logo: 'lotus', frame: 'classic', trail: 'none' }, records: [{ stars: 2, bestMass: 200, bestTime: 95, wins: 1 }] };
    const migrated = parseProgress(JSON.stringify(old));
    expect(migrated.version).toBe(3); expect(migrated.name).toBe('Legacy AI'); expect(migrated.credits).toBe(70); expect(migrated.look.logo).toBe('lotus');
    expect(migrated.endless.bestMass).toBe(200); expect(migrated.legacyRecords[0].stars).toBe(2); expect(migrated.tutorialSeen).toBe(false);
    expect(migrated).not.toHaveProperty('selectedLevel'); expect(migrated).not.toHaveProperty('unlockedLevel');
    expect(parseProgress(JSON.stringify(migrated))).toEqual(migrated);
  });
  it('migrates first-generation saves without resetting their achievements', () => {
    const migrated = parseProgress(JSON.stringify({ version: 1, records: [{ bestMass: 55000, stars: 3 }], name: 'Early Labs' }));
    expect(migrated.credits).toBe(250); expect(migrated.endless.bestMass).toBe(55000); expect(migrated.name).toBe('Early Labs');
  });
  it('retains old bot IDs, positions and wallet while adopting original Venture City identities', () => {
    const game = new GameSimulation({ seed: 42 }); game.bots[7].x = 432; game.bots[7].mass = 100;
    const saved = checkpointRun(freshProgress(), game.save()); saved.credits = 777;
    const progress = parseProgress(JSON.stringify(saved)); const restored = new GameSimulation({ saved: progress.activeRun! });
    expect(progress.credits).toBe(777); expect(restored.bots[7].id).toBe(8); expect(restored.bots[7].x).toBe(432); expect(restored.bots[7].mass).toBe(100);
    expect(restored.bots[7].name).toBe('Nimvale AI'); expect(restored.bots[7].logo).toBe('nimvale');
  });
  it('checkpoints an ongoing run and pays only its new reward increments', () => {
    const game = new GameSimulation({ seed: 42, runId: 'run-saved' });
    game.stats.investments = 10; game.stats.distance = 1200; game.elapsed = 72;
    const first = checkpointRun(freshProgress(), game.save());
    expect(first.credits).toBe(280); expect(first.activeRun?.elapsed).toBe(72); expect(first.endless.totalRuns).toBe(0);
    expect(checkpointRun(first, game.save()).credits).toBe(280);
    game.stats.investments = 15; game.stats.distance = 1500;
    const second = checkpointRun(first, game.save());
    expect(second.credits).toBe(295); expect(second.endless.totalDistance).toBe(1500);
    expect(parseProgress(JSON.stringify(second)).activeRun).toEqual(second.activeRun);
  });
  it('settles death/quit once after autosave and never replays the credits', () => {
    const game = new GameSimulation({ runId: result.runId, seed: 42 }); game.stats.investments = 12;
    const saved = checkpointRun(freshProgress(), game.save());
    const finished = recordResult(saved, result);
    expect(finished.credits).toBe(409); expect(finished.activeRun).toBeNull(); expect(finished.endless.totalRuns).toBe(1);
    expect(recordResult(parseProgress(JSON.stringify(finished)), result)).toEqual(finished);
    expect(checkpointRun(finished, game.save()).activeRun).toBeNull();
  });
  it('supports long endless runs with more than the former 20,000 credit limit', () => {
    const finished = recordResult(freshProgress(), { ...result, stats: { ...result.stats, investments: 15000 } });
    expect(finished.credits).toBe(250 + 45000 + 54 + 45); expect(finished.endless.bestMass).toBe(400);
  });
  it('buys and equips cosmetics without charging twice or changing an active run', () => {
    const active = checkpointRun(freshProgress(), new GameSimulation({ seed: 42 }).save());
    const purchased = buyItem(active, 'lotus'); expect(purchased.status).toBe('bought'); expect(purchased.progress.credits).toBe(70); expect(purchased.progress.look.logo).toBe('lotus'); expect(purchased.progress.activeRun).toEqual(active.activeRun);
    expect(buyItem(purchased.progress, 'lotus').progress.credits).toBe(70);
    expect(buyItem(purchased.progress, 'unicorn').status).toBe('insufficient'); expect(buyItem(active, 'missing').status).toBe('invalid'); expect(equipItem(active, 'crown-logo').look.logo).toBe('rocket');
  });
  it('recovers corrupt records and validates saved worlds and logo data', () => {
    expect(parseProgress('{broken')).toEqual(freshProgress()); expect(parseProgress(JSON.stringify({ version: 4 }))).toEqual(freshProgress());
    const saved = parseProgress(JSON.stringify({ ...freshProgress(), color: '#2ae7b5', owned: ['unknown'], look: { logo: 'unicorn', frame: 'hex', trail: 'fire', customImage: 'data:image/svg+xml;base64,unsafe', monogram: '<AI>' }, activeRun: { version: 1, runId: 'bad', player: { mass: null, x: 0, y: 0 } } }));
    expect(saved.color).toBe('#2ae7b5'); expect(saved.look.logo).toBe('rocket'); expect(saved.look.frame).toBe('classic'); expect(saved.look.customImage).toBeNull(); expect(saved.activeRun).toBeNull(); expect(saved.look.monogram).toBe('AI');
  });
});
