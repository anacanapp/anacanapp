import { ASSET_CATALOG } from './assets';
import { BRANDS, defaultLook } from './cosmetics';
import type { BotStrategy, PlayerLook } from './cosmetics';
import { activityCredits } from '../economy';
import { canAcquire, clamp, distance, distanceSquared, movementSpeed, radiusForMass, seededRandom, START_MASS, TAKEOVER_SECONDS, viewZoom } from './model';
import type { Actor, ArenaActivity, GameEvent, GameResult, GameSnapshot, GameStatus, Input, LoseReason, Pickup, RunSave, RunStats, Vec2 } from './model';
import { EndlessWorld } from './world';
import { freshMarket, FUND_BY_ID, FUNDS, gainMultiplier, marketAt, MISSIONS, POWER_DURATION } from './market';
import type { MarketSave, Opportunity, PowerKind, SectorId } from './market';

interface GameOptions { name?: string; seed?: number; color?: string; look?: PlayerLook; runId?: string; saved?: RunSave; sector?: SectorId }
const BOT_RATIOS = [.48, .68, .86, 1.02, 1.2, 1.48, 1.85, 2.3, 2.85, 3.5, 4.3, 5.2, 6.4, 8.2];

/** Fixed-step endless simulation, with only the nearby world kept in memory. */
export class GameSimulation {
  readonly world: EndlessWorld;
  readonly player: Actor;
  readonly bots: Actor[] = [];
  readonly specs = ASSET_CATALOG;
  readonly seed: number;
  readonly random: () => number;
  readonly stats: RunStats;
  readonly look: PlayerLook;
  readonly runId: string;
  readonly market: MarketSave;
  status: GameStatus = 'playing';
  elapsed = 0;
  started = false;
  energy = 100;
  boosting = false;
  shield = 8;
  result?: GameResult;
  onEvent?: (event: GameEvent) => void;
  readonly activity: ArenaActivity[] = [];
  private activityId = 0;
  private previousRank = 0;
  private rankDelta = 0;
  private rankChangedAt = 0;
  private unlocked = new Set<string>();
  private boostExhausted = false;
  private viewport = { width: 390, height: 844, wide: false };
  private worldClock = 0;
  private takeover?: { actor: Actor; duration: number };
  private pivotPressed = false;

  constructor(options: GameOptions = {}) {
    const saved = options.saved;
    this.seed = saved?.seed ?? options.seed ?? Date.now() >>> 0;
    this.random = seededRandom(this.seed);
    this.look = { ...defaultLook(), ...options.look };
    this.runId = saved?.runId ?? options.runId ?? `run-${this.seed}-${Math.random().toString(36).slice(2, 10)}`;
    this.elapsed = saved?.elapsed ?? 0;
    this.started = saved?.started ?? false;
    this.energy = saved?.energy ?? 100;
    this.shield = saved?.shield ?? 8;
    this.market = saved?.market ? structuredClone(saved.market) : freshMarket(options.sector);
    this.player = this.actor(0, options.name || 'My Startup', saved?.player.mass ?? START_MASS, saved?.player.x ?? 24, saved?.player.y ?? 24, options.color ?? '#b9ff6b', this.look.logo);
    this.player.heading = saved?.player.heading ?? -Math.PI / 4;
    this.stats = saved ? { ...saved.stats } : { investments: 0, assets: 0, acquisitions: 0, peakMass: START_MASS, distance: 0 };
    for (const spec of this.specs) if (spec.requiredMass <= this.player.mass) this.unlocked.add(spec.kind);
    this.world = new EndlessWorld(this.seed, saved?.world);
    this.refreshWorld();
    for (const [index, brand] of BRANDS.entries()) {
      const bot = this.actor(index + 1, brand.name, Math.max(3, this.player.mass * (brand.ratio ?? BOT_RATIOS[index])), 0, 0, brand.color, brand.logo);
      const strategies: BotStrategy[] = ['builder', 'collector', 'cautious', 'funded', 'hunter'];
      const strategy = brand.strategy ?? strategies[index % strategies.length];
      bot.ai.aggression = strategy === 'hunter' ? 1 : strategy === 'cautious' ? .35 : .68;
      bot.ai.speed = strategy === 'hunter' ? .86 : strategy === 'cautious' ? .8 : .66 + this.random() * .13;
      const previous = saved?.bots.find(actor => actor.id === bot.id);
      if (previous) {
        Object.assign(bot, previous);
        bot.radius = radiusForMass(bot.mass);
      } else this.spawnPosition(bot, index < 4, index);
      this.bots.push(bot);
    }
    if (saved) this.status = 'paused';
    for (const bot of this.bots.slice(-3)) this.addActivity('joined', bot);
  }

  get pickups() { return this.world.pickups; }
  get grid() { return this.world.grid; }
  get blocks() { return this.world.blocks; }
  get localRange() { return radiusForMass(this.player.mass) * 46; }

  setViewport(width: number, height: number, wide = false) {
    if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) return;
    this.viewport = { width, height, wide };
    this.refreshWorld();
  }
  private refreshWorld() {
    const zoom = viewZoom(this.player.mass, this.viewport.width, this.viewport.height, this.viewport.wide);
    // The tilted camera needs extra world coverage toward the diagonal corners.
    const diagonalSpan = (this.viewport.width + this.viewport.height) / zoom;
    this.world.update(this.player, this.player.mass, Math.min(diagonalSpan, this.localRange * 2.6), Math.min(diagonalSpan, this.localRange * 2.6), this.elapsed);
  }

  private actor(id: number, name: string, mass: number, x: number, y: number, color: string, logo: string): Actor {
    return { id, name, mass, radius: radiusForMass(mass), x, y, heading: -Math.PI / 2, vx: 0, vy: 0, color, logo, alive: true, respawnAt: 0, protectedUntil: 0,
      ai: { direction: { x: 0, y: 0 }, nextDecision: 0, aggression: .65 + this.random() * .35, speed: .68 + this.random() * .16, mode: 'forage' } };
  }

  private spawnPosition(bot: Actor, near = false, index = 0) {
    const angle = near ? index * Math.PI / 2 + .7 : this.random() * Math.PI * 2;
    const reach = this.player.radius + bot.radius + this.player.radius * (near ? 9 + index : 17 + this.random() * 13);
    bot.x = this.player.x + Math.cos(angle) * reach;
    bot.y = this.player.y + Math.sin(angle) * reach;
  }

  pause() {
    if (this.status !== 'playing') return;
    this.status = 'paused'; this.boosting = false; this.player.vx = this.player.vy = 0; this.takeover = undefined; this.pivotPressed = false;
  }
  resume() { if (this.status === 'paused') { this.status = 'playing'; this.player.protectedUntil = Math.max(this.player.protectedUntil, this.elapsed + 1.2); } }
  abandon() {
    if (this.status === 'paused') this.status = 'playing';
    if (this.status === 'playing') this.finish('quit');
    return this.result;
  }

  step(delta: number, input: Input) {
    if (this.status !== 'playing' || !Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(delta, .05);
    const ix = Number.isFinite(input.x) ? input.x : 0;
    const iy = Number.isFinite(input.y) ? input.y : 0;
    const magnitude = Math.hypot(ix, iy);
    if (magnitude > .08) this.started = true;
    if (!this.started) return;
    this.elapsed += dt;
    this.market.powers = this.market.powers.filter(power => power.until > this.elapsed);
    if (input.pivot && !this.pivotPressed && this.elapsed >= this.market.pivotReadyAt) {
      this.market.pivotReadyAt = this.elapsed + 24; this.market.pivotUntil = this.elapsed + 1.25;
      this.player.protectedUntil = Math.max(this.player.protectedUntil, this.elapsed + 1.25);
      this.onEvent?.({ type: 'pivot', x: this.player.x, y: this.player.y });
    }
    this.pivotPressed = input.pivot === true;
    this.shield = Math.max(0, this.shield - dt);
    if (!input.boost) this.boostExhausted = false;
    this.boosting = input.boost && magnitude > .08 && this.energy > 0 && !this.boostExhausted;
    this.energy = clamp(this.energy + (this.boosting ? (this.market.sector === 'cloud' ? -20 : -28) : 25) * dt, 0, 100);
    if (this.energy === 0) this.boostExhausted = true;
    const previous = { x: this.player.x, y: this.player.y };
    const acceleration = this.hasPower('accelerator') ? 1.3 : 1;
    const pivot = this.market.pivotUntil > this.elapsed ? 1.65 : 1;
    this.move(this.player, { x: ix / Math.max(1, magnitude), y: iy / Math.max(1, magnitude) }, dt, (this.boosting ? 1.9 : 1) * acceleration * pivot);
    this.stats.distance += distance(previous, this.player);
    this.worldClock += dt;
    if (this.worldClock >= .15) { this.worldClock = 0; this.refreshWorld(); }
    this.updateMarket();

    for (const bot of this.bots) {
      if (!bot.alive) { if (this.elapsed >= bot.respawnAt) this.respawnBot(bot); continue; }
      if (distance(bot, this.player) > this.localRange * 1.35) { this.respawnBot(bot); continue; }
      if (this.elapsed >= bot.ai.nextDecision) this.think(bot);
      this.move(bot, bot.ai.direction, dt, bot.ai.speed);
    }
    this.collect(this.player);
    for (const bot of this.bots) if (bot.alive) this.collect(bot);
    this.resolveAcquisitions(dt);
    this.checkMissions();

    // Travel remains numerically local; the origin accumulates without a map boundary.
    if (Math.max(Math.abs(this.player.x), Math.abs(this.player.y)) > this.world.chunkSize * 8) {
      const shift = this.world.rebase(this.player.x, this.player.y);
      for (const actor of [this.player, ...this.bots]) { actor.x -= shift.x; actor.y -= shift.y; }
      for (const opportunity of this.market.opportunities) { opportunity.x -= shift.x; opportunity.y -= shift.y; }
      this.onEvent?.({ type: 'rebase', ...shift });
      this.refreshWorld();
    }
  }

  private move(actor: Actor, direction: Vec2, dt: number, multiplier: number) {
    // Player-relative scene velocity keeps huge competitors from teleporting across the view.
    const sizeSpeed = Math.pow(actor.radius / this.player.radius, .24);
    const speed = movementSpeed(this.player.mass) * sizeSpeed * multiplier;
    const response = 1 - Math.exp(-dt * 18);
    actor.vx += (direction.x * speed - actor.vx) * response;
    actor.vy += (direction.y * speed - actor.vy) * response;
    if (Math.hypot(actor.vx, actor.vy) > 4) actor.heading = Math.atan2(actor.vy, actor.vx);
    actor.x += actor.vx * dt; actor.y += actor.vy * dt;
  }

  private think(bot: Actor) {
    bot.ai.nextDecision = this.elapsed + .25 + this.random() * .3;
    let threat: Actor | undefined; let prey: Actor | undefined;
    let threatDistance = Infinity; let preyDistance = Infinity;
    for (const other of [this.player, ...this.bots]) {
      if (!other.alive || other.id === bot.id) continue;
      const d = distanceSquared(bot, other);
      if (canAcquire(other.mass, bot.mass) && d < (other.radius + bot.radius + this.player.radius * 6) ** 2 && d < threatDistance) { threat = other; threatDistance = d; }
      const canHuntPlayer = !(other.id === 0 && (this.shield > 0 || this.elapsed < 15));
      if (canAcquire(bot.mass, other.mass) && canHuntPlayer && d < (bot.radius * 4 + this.player.radius * 4) ** 2 && d < preyDistance) { prey = other; preyDistance = d; }
    }
    let dx = 0; let dy = 0;
    if (threat) {
      bot.ai.mode = 'flee'; dx = bot.x - threat.x; dy = bot.y - threat.y;
    } else if (prey && this.random() < bot.ai.aggression) {
      bot.ai.mode = 'hunt'; dx = prey.x - bot.x; dy = prey.y - bot.y;
    } else {
      bot.ai.mode = 'forage';
      let best: Pickup | undefined; let score = Infinity;
      const strategy = BRANDS[bot.id - 1]?.strategy;
      const fund = this.market.opportunities.filter(item => item.alive && item.kind === 'fund').sort((a, b) => distanceSquared(bot, a) - distanceSquared(bot, b))[0];
      if (fund && (strategy === 'funded' || strategy === 'collector') && distance(bot, fund) < this.player.radius * 15) {
        dx = fund.x - bot.x; dy = fund.y - bot.y;
        const length = Math.hypot(dx, dy) || 1; bot.ai.direction = { x: dx / length, y: dy / length }; return;
      }
      for (const pickup of this.grid.nearby(bot, this.player.radius * 11)) {
        if (!pickup.alive || pickup.spec.requiredMass > bot.mass) continue;
        const candidate = distanceSquared(bot, pickup) / Math.pow(pickup.spec.value, strategy === 'builder' && pickup.spec.kind !== 'investment' ? .6 : .45);
        if (candidate < score) { score = candidate; best = pickup; }
      }
      if (best) { dx = best.x - bot.x; dy = best.y - bot.y; }
      else {
        const angle = this.random() * Math.PI * 2;
        dx = this.player.x - bot.x + Math.cos(angle) * this.localRange * .4;
        dy = this.player.y - bot.y + Math.sin(angle) * this.localRange * .4;
      }
    }
    const length = Math.hypot(dx, dy) || 1;
    bot.ai.direction = { x: dx / length, y: dy / length };
  }

  private collect(actor: Actor) {
    // Supergiants stay competitive without clearing an entire loaded world per step.
    const radius = Math.min(actor.radius, this.player.radius * 3.5);
    const magnet = actor.id === 0 && this.hasPower('magnet') ? 2.25 : 1;
    for (const pickup of this.grid.nearby(actor, radius * 1.25 * magnet + this.world.blockSize * .2)) {
      const shortage = marketAt(this.elapsed).phase === 'gpu-shortage' && ['gpu', 'server'].includes(pickup.spec.kind) ? 1.25 : 1;
      if (!pickup.alive || actor.mass < pickup.spec.requiredMass * shortage) continue;
      const reach = radius * (actor.id === 0 && pickup.spec.kind === 'investment' ? 1.22 * magnet : 1) + pickup.spec.radius * .38;
      if (distanceSquared(actor, pickup) > reach ** 2) continue;
      this.world.consume(pickup, this.elapsed);
      this.grow(actor, pickup.spec.value * (actor.id === 0 ? gainMultiplier(this.market.sector, pickup.spec.kind, marketAt(this.elapsed).phase, this.hasPower('patent')) : .48));
      if (actor.id === 0) {
        if (pickup.spec.kind === 'investment') this.stats.investments++;
        else this.stats.assets++;
        this.onEvent?.({ type: 'pickup', id: pickup.id, x: pickup.x, y: pickup.y, value: pickup.spec.value, kind: pickup.spec.kind });
        this.checkUnlocks();
      }
    }
  }

  private grow(actor: Actor, value: number) {
    const grown = actor.mass + value;
    if (Number.isFinite(grown)) actor.mass = grown;
    actor.radius = radiusForMass(actor.mass);
    if (actor.id === 0) this.stats.peakMass = Math.max(this.stats.peakMass, actor.mass);
  }
  private checkUnlocks() {
    for (const spec of this.specs) {
      if (spec.requiredMass <= this.player.mass && !this.unlocked.has(spec.kind)) { this.unlocked.add(spec.kind); this.onEvent?.({ type: 'unlock', kind: spec.kind }); }
    }
  }

  hasPower(kind: PowerKind) { return this.market.powers.some(power => power.kind === kind && power.until > this.elapsed); }
  private grantPower(kind: PowerKind) {
    const existing = this.market.powers.find(power => power.kind === kind);
    const until = this.elapsed + POWER_DURATION[kind];
    if (existing) existing.until = Math.max(existing.until, until);
    else this.market.powers.push({ kind, until });
    this.stats.powers = (this.stats.powers ?? 0) + 1;
  }
  private updateMarket() {
    this.market.opportunities = this.market.opportunities.filter(item => item.alive && item.expires > this.elapsed && distance(item, this.player) < this.localRange * 1.4);
    if (this.elapsed >= this.market.nextSpawn) {
      this.market.nextSpawn = this.elapsed + 9 + this.random() * 6;
      if (this.market.opportunities.length < 7) this.spawnOpportunity();
    }
    for (const opportunity of this.market.opportunities) {
      for (const actor of [this.player, ...this.bots]) {
        if (!opportunity.alive || !actor.alive || (actor.id !== 0 && opportunity.kind !== 'fund')) continue;
        if (distance(actor, opportunity) < Math.min(actor.radius, this.player.radius * 2.5) + opportunity.radius * .55) this.collectOpportunity(opportunity, actor);
      }
    }
  }
  private spawnOpportunity() {
    const sequence = ++this.market.sequence;
    const kind = (['fund', 'talent', 'fund', 'cloud-credit', 'fund', 'patent', 'audit'] as const)[(sequence - 1) % 7];
    const fund = FUNDS[(sequence - 1) % FUNDS.length];
    const phase = marketAt(this.elapsed).phase;
    const value = Math.max(fund.minimum, this.player.mass * fund.fraction) * (phase === 'funding-winter' ? .72 : 1);
    const angle = this.random() * Math.PI * 2;
    const reach = this.player.radius * (sequence === 1 ? 5 + this.random() * 2 : 6 + this.random() * 7);
    this.market.opportunities.push({ id: sequence, kind, fund: fund.id, x: this.player.x + Math.cos(angle) * reach, y: this.player.y + Math.sin(angle) * reach, radius: this.player.radius * .5, value, alive: true, expires: this.elapsed + 65 });
  }
  collectOpportunity(opportunity: Opportunity, actor = this.player) {
    if (!opportunity.alive || opportunity.expires <= this.elapsed || !actor.alive) return;
    if (opportunity.kind === 'audit' && this.market.auditImmuneUntil > this.elapsed) return;
    opportunity.alive = false;
    let value = 0;
    if (opportunity.kind === 'fund') {
      value = opportunity.value * (actor.id === 0 ? gainMultiplier(this.market.sector, 'fund', marketAt(this.elapsed).phase, false) : .85);
      this.grow(actor, value);
      actor.protectedUntil = this.elapsed + 1.4;
      if (actor.id === 0) {
        this.stats.funds = (this.stats.funds ?? 0) + 1;
        this.grantPower(FUND_BY_ID(opportunity.fund).power);
        this.checkUnlocks();
      }
    } else if (opportunity.kind === 'talent') {
      this.grantPower('magnet');
    } else if (opportunity.kind === 'cloud-credit') {
      this.energy = 100; this.grantPower('accelerator');
    } else if (opportunity.kind === 'patent') {
      this.grantPower('patent');
    } else if (opportunity.kind === 'audit') {
      this.market.auditImmuneUntil = this.elapsed + 4;
      this.stats.audits = (this.stats.audits ?? 0) + 1;
      if (!this.hasPower('firewall') && actor.protectedUntil <= this.elapsed && this.shield <= 0) {
        const loss = actor.mass * .09;
        actor.mass = Math.max(10, actor.mass - loss); actor.radius = radiusForMass(actor.mass);
        this.energy = Math.max(0, this.energy - 22); value = -loss;
      }
    }
    if (actor.id === 0) this.onEvent?.({ type: 'opportunity', kind: opportunity.kind, fund: opportunity.fund, value, x: opportunity.x, y: opportunity.y, actorId: actor.id });
  }
  private currentMission(): GameSnapshot['mission'] {
    const mission = MISSIONS.find(item => !this.market.completedMissions.includes(item.id));
    if (!mission) return undefined;
    return { id: mission.id, target: mission.target, reward: mission.reward, progress: Math.min(mission.target, this.stats[mission.stat] ?? 0) };
  }
  private checkMissions() {
    for (const mission of MISSIONS) {
      if (this.market.completedMissions.includes(mission.id) || (this.stats[mission.stat] ?? 0) < mission.target) continue;
      this.market.completedMissions.push(mission.id);
      this.stats.bonusCredits = (this.stats.bonusCredits ?? 0) + mission.reward;
      this.onEvent?.({ type: 'mission', id: mission.id, reward: mission.reward });
    }
  }
  private nearestFund(): GameSnapshot['nearestFund'] {
    const fund = this.market.opportunities.filter(item => item.alive && item.kind === 'fund').sort((a, b) => distanceSquared(a, this.player) - distanceSquared(b, this.player))[0];
    if (!fund) return undefined;
    return { fund: fund.fund, x: (fund.x - this.player.x) / this.player.radius, y: (fund.y - this.player.y) / this.player.radius, value: fund.value };
  }

  private resolveAcquisitions(dt: number) {
    const actors = [this.player, ...this.bots];
    let attacker: Actor | undefined;
    for (let a = 0; a < actors.length; a++) {
      for (let b = a + 1; b < actors.length; b++) {
        if (!actors[a].alive || !actors[b].alive) continue;
        const big = actors[a].mass >= actors[b].mass ? actors[a] : actors[b];
        const small = big === actors[a] ? actors[b] : actors[a];
        if (!canAcquire(big.mass, small.mass) || (small.id === 0 && (this.shield > 0 || this.hasPower('firewall') || this.market.pivotUntil > this.elapsed)) || small.protectedUntil > this.elapsed) continue;
        const reach = small.id === 0 ? Math.min(big.radius, this.player.radius * 2.1) - small.radius * .32 : big.radius - small.radius * .32;
        if (distanceSquared(big, small) > reach ** 2) continue;
        if (small.id === 0) { if (!attacker || big.mass > attacker.mass) attacker = big; continue; }
        small.alive = false; small.respawnAt = this.elapsed + 5;
        const value = small.mass * (big.id === 0 ? .68 : .44);
        this.grow(big, value);
        this.addActivity('acquired', big, small);
        if (big.id === 0) { this.stats.acquisitions++; this.onEvent?.({ type: 'acquisition', x: small.x, y: small.y, value, name: small.name }); this.checkUnlocks(); }
      }
    }
    if (attacker?.alive) {
      this.takeover = { actor: attacker, duration: this.takeover?.actor.id === attacker.id ? this.takeover.duration + dt : dt };
      if (this.takeover.duration >= TAKEOVER_SECONDS) { this.addActivity('acquired', attacker, this.player); this.finish('competitor', attacker.name); }
    } else this.takeover = undefined;
  }
  private respawnBot(bot: Actor) {
    const desiredMass = this.player.mass * (BRANDS[bot.id - 1]?.ratio ?? BOT_RATIOS[bot.id - 1]) * (.84 + this.random() * .25);
    bot.mass = Math.max(3, desiredMass); bot.radius = radiusForMass(bot.mass);
    bot.vx = bot.vy = 0; bot.ai.nextDecision = this.elapsed + .2;
    bot.alive = true; this.spawnPosition(bot);
    bot.protectedUntil = this.elapsed + 1.5;
    this.addActivity('joined', bot);
  }
  private finish(reason: LoseReason, killer?: string) {
    if (this.status !== 'playing') return;
    this.status = reason === 'quit' ? 'finished' : 'lost'; this.boosting = false;
    this.result = { runId: this.runId, mass: this.player.mass, elapsed: this.elapsed, stats: { ...this.stats }, reason, killer };
    this.onEvent?.({ type: 'result', result: this.result });
  }

  snapshot(): GameSnapshot {
    const leaderboard = [this.player, ...this.bots.filter(bot => bot.alive)].sort((a, b) => b.mass - a.mass).map(actor => ({ id: actor.id, name: actor.name, mass: actor.mass, player: actor.id === 0, logo: actor.logo, color: actor.color }));
    const mapRange = this.localRange;
    const rank = leaderboard.findIndex(actor => actor.player) + 1;
    if (this.previousRank && rank !== this.previousRank) { this.rankDelta = this.previousRank - rank; this.rankChangedAt = this.elapsed; }
    this.previousRank = rank;
    return {
      status: this.status, mass: this.player.mass, elapsed: this.elapsed, started: this.started, energy: this.energy, boosting: this.boosting, shield: this.shield,
      rank, credits: activityCredits(this.stats), district: this.world.districtAt(this.player),
      room: `VC-${(this.seed % 9000 + 1000).toString()}`, founders: leaderboard.length, activity: this.activity.filter(event => this.elapsed - event.at < 12).slice(-3), rankChange: this.elapsed - this.rankChangedAt < 3 ? this.rankDelta : 0,
      market: marketAt(this.elapsed), powers: this.market.powers, pivotCooldown: Math.max(0, this.market.pivotReadyAt - this.elapsed), pivoting: this.market.pivotUntil > this.elapsed, sector: this.market.sector,
      mission: this.currentMission(), nearestFund: this.nearestFund(),
      danger: this.takeover ? { name: this.takeover.actor.name, logo: this.takeover.actor.logo, color: this.takeover.actor.color, x: this.takeover.actor.x - this.player.x, y: this.takeover.actor.y - this.player.y, progress: clamp(this.takeover.duration / TAKEOVER_SECONDS, 0, 1) } : undefined,
      nextAsset: this.specs.find(spec => spec.requiredMass > this.player.mass), leaderboard: leaderboard.slice(0, 5),
      map: [this.player, ...this.bots.filter(bot => bot.alive)].map(actor => ({ id: actor.id, x: clamp(.5 + (actor.x - this.player.x) / (mapRange * 2), .04, .96), y: clamp(.5 + (actor.y - this.player.y) / (mapRange * 2), .04, .96), threat: actor.id !== 0 && canAcquire(actor.mass, this.player.mass) })),
    };
  }
  private addActivity(type: ArenaActivity['type'], actor: Actor, target?: Actor) {
    const participant = (actor: Actor) => ({ id: actor.id, name: actor.name, logo: actor.logo, color: actor.color });
    this.activity.push({ id: ++this.activityId, at: this.elapsed, type, actor: participant(actor), target: target ? participant(target) : undefined });
    if (this.activity.length > 6) this.activity.shift();
  }
  save(): RunSave {
    return {
      version: 1, runId: this.runId, seed: this.seed, elapsed: this.elapsed, started: this.started, energy: this.energy, shield: this.shield,
      player: { x: this.player.x, y: this.player.y, mass: this.player.mass, heading: this.player.heading }, stats: { ...this.stats },
      bots: this.bots.map(bot => ({ id: bot.id, x: bot.x, y: bot.y, mass: bot.mass, heading: bot.heading, alive: bot.alive, respawnAt: bot.respawnAt })),
      world: this.world.save(this.elapsed),
      market: structuredClone(this.market),
    };
  }
}
