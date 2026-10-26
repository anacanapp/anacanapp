import Phaser from 'phaser';
import { GameSimulation } from './simulation';
import { canAcquire, hashString, viewZoom } from './model';
import type { Actor, CityBlock, GameEvent, GameSnapshot, Input } from './model';
import { project, screenInputToWorld } from './isometric';
import { formatMoney } from './assets';
import { BRANDS } from './cosmetics';
import { paintActor, paintGround, paintOpportunity, paintProp, paintResource, paintSpark, TEXTURE_DENSITY } from './iso-art';
import type { PaintedTexture, PropKind } from './iso-art';
import { FUNDS, marketAt } from './market';
import { actorPresentation } from './presentation';

interface ArenaOptions {
  simulation: GameSimulation;
  input: () => Input;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onEvent: (event: GameEvent) => void;
  onReady: () => void;
  onSuspend: () => void;
  details: boolean;
  preview?: boolean;
}
interface ActorView {
  sprite: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Arc;
  shield: Phaser.GameObjects.Ellipse;
  aura: Phaser.GameObjects.Ellipse;
  radius: number;
  texture: string;
}
interface PropView { kind: PropKind; x: number; y: number; variant: number; sprite: Phaser.GameObjects.Image }
interface BlockView { block: CityBlock; tile: Phaser.GameObjects.Image; props: PropView[]; signature: string }
interface Effect { object: Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Ellipse; x: number; y: number; vx: number; vy: number; age: number; duration: number; startScale: number; screenSpace: boolean }

class VentureScene extends Phaser.Scene {
  readonly options: ArenaOptions;
  private texturesByKey = new Map<string, PaintedTexture>();
  private blocks = new Map<string, BlockView>();
  private resources = new Map<string, Phaser.GameObjects.Image>();
  private actors = new Map<number, ActorView>();
  private opportunities = new Map<number, { sprite: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }>();
  private effects: Effect[] = [];
  private worldCamera = { x: 0, y: 0, zoom: 1 };
  private accumulator = 0;
  private lastSnapshot = 0;
  private lastTrail = 0;
  private lastRevision = -1;
  private lastCulling = 0;
  private ready = false;
  private pixelRatio = Math.min(devicePixelRatio || 1, 2);
  private logicalWidth = 390;
  private logicalHeight = 844;
  wide = false;
  details: boolean;
  visibleFrames = 0;
  activeSprites = 0;

  constructor(options: ArenaOptions) { super({ key: 'VentureCity' }); this.options = options; this.details = options.details; }

  create() {
    const game = this.options.simulation;
    this.cameras.main.setBackgroundColor('#132432');
    this.texture('spark', () => paintSpark());
    for (const brand of BRANDS) this.texture(`actor-${brand.logo}`, () => paintActor(brand.logo, brand.color));
    this.texture('player', () => paintActor(game.player.logo, game.player.color, game.look));
    for (const fund of FUNDS) this.texture(`opportunity-fund-${fund.id}`, () => paintOpportunity('fund', fund.id));
    for (const kind of ['talent', 'cloud-credit', 'patent', 'audit'] as const) this.texture(`opportunity-${kind}`, () => paintOpportunity(kind));
    for (const kind of ['investment', 'gpu', 'office', 'server', 'data-center', 'tower', 'campus', 'hq'] as const) {
      for (let variant = 0; variant < (kind === 'investment' || kind === 'gpu' || kind === 'server' ? 1 : 3); variant++) this.texture(`resource-${kind}-${variant}`, () => paintResource(kind, variant));
    }
    for (const kind of ['tree', 'lamp', 'bench', 'car'] as const) for (let variant = 0; variant < (kind === 'tree' || kind === 'car' ? 3 : 1); variant++) this.texture(`prop-${kind}-${variant}`, () => paintProp(kind, variant));
    this.resizeScene();
    this.worldCamera = { x: game.player.x, y: game.player.y, zoom: viewZoom(game.player.mass, this.logicalWidth, this.logicalHeight) * (this.options.preview ? .9 : 1) };
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeScene, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.suspendScene, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.suspendScene, this);
    const previousEvent = game.onEvent;
    game.onEvent = event => { this.handleEvent(event); this.options.onEvent(event); };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeScene, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.suspendScene, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.suspendScene, this);
      game.onEvent = previousEvent;
    });
    this.ready = true;
    this.options.onReady();
  }
  private suspendScene() { if (!this.options.preview) this.options.onSuspend(); }
  private resizeScene() {
    this.logicalWidth = this.scale.width / this.pixelRatio; this.logicalHeight = this.scale.height / this.pixelRatio;
    this.cameras.main.setOrigin(0, 0).setZoom(this.pixelRatio).setScroll(0, 0);
    this.options.simulation.setViewport(this.logicalWidth, this.logicalHeight, this.wide); this.lastRevision = -1;
  }

  setWide(wide: boolean) { this.wide = wide; this.resizeScene(); }
  setDetails(details: boolean) { if (details === this.details) return; this.details = details; this.lastRevision = -1; }
  private texture(key: string, paint: () => PaintedTexture) {
    const existing = this.texturesByKey.get(key); if (existing) return existing;
    const artwork = paint(); this.textures.addCanvas(key, artwork.canvas); this.texturesByKey.set(key, artwork); return artwork;
  }
  private image(key: string, x = 0, y = 0) {
    const artwork = this.texturesByKey.get(key)!;
    return this.add.image(x, y, key).setOrigin(artwork.anchorX, artwork.anchorY);
  }
  private screen(x: number, y: number) {
    const p = project({ x: x - this.worldCamera.x, y: y - this.worldCamera.y });
    return { x: this.logicalWidth / 2 + p.x * this.worldCamera.zoom, y: this.logicalHeight * .52 + p.y * this.worldCamera.zoom };
  }
  private onScreen(x: number, y: number, margin: number) { return x >= -margin && y >= -margin && x <= this.logicalWidth + margin && y <= this.logicalHeight + margin; }

  update(time: number, delta: number) {
    if (!this.ready) return;
    const dt = Math.min(delta / 1000, .075); const game = this.options.simulation;
    if (!this.options.preview) {
      this.accumulator += dt;
      if (this.accumulator >= 1 / 60) {
        const direction = screenInputToWorld(this.options.input());
        while (this.accumulator >= 1 / 60) { game.step(1 / 60, direction); this.accumulator -= 1 / 60; }
      }
    }
    const zoom = viewZoom(game.player.mass, this.logicalWidth, this.logicalHeight, this.wide) * (this.options.preview ? .9 : 1);
    const following = 1 - Math.exp(-dt * 6);
    this.worldCamera.x += (game.player.x + game.player.vx * .16 - this.worldCamera.x) * following;
    this.worldCamera.y += (game.player.y + game.player.vy * .16 - this.worldCamera.y) * following;
    this.worldCamera.zoom += (zoom - this.worldCamera.zoom) * (1 - Math.exp(-dt * 3));
    if (game.world.revision !== this.lastRevision || time - this.lastCulling > 250) { this.syncBlocks(); this.lastRevision = game.world.revision; this.lastCulling = time; }
    this.drawBlocks(time);
    this.syncResources(time);
    this.syncActors(time, dt);
    this.syncOpportunities(time);
    this.updateEffects(dt);
    this.visibleFrames++;
    this.activeSprites = this.children.length;
    if (!this.options.preview && time - this.lastSnapshot > 110) { this.options.onSnapshot(game.snapshot()); this.lastSnapshot = time; }
  }

  private syncOpportunities(time: number) {
    const game = this.options.simulation; const active = new Set<number>();
    for (const item of game.market.opportunities) {
      if (!item.alive || item.expires <= game.elapsed) continue;
      const p = this.screen(item.x, item.y); if (!this.onScreen(p.x, p.y, 140)) continue;
      active.add(item.id);
      let view = this.opportunities.get(item.id);
      const texture = item.kind === 'fund' ? `opportunity-fund-${item.fund}` : `opportunity-${item.kind}`;
       if (!view) {
         view = { sprite: this.image(texture), label: this.add.text(0, 0, item.kind === 'fund' ? `VC · +${formatMoney(item.value)}` : item.kind === 'audit' ? '!' : item.kind === 'talent' ? 'TALENT' : item.kind === 'patent' ? 'PATENT' : 'CLOUD', { fontFamily: 'Space Grotesk, sans-serif', fontSize: '8px', color: item.kind === 'audit' ? '#efb2be' : '#e5dfbd', stroke: '#142b29', strokeThickness: 3, resolution: 2 }).setOrigin(.5) };
        this.opportunities.set(item.id, view);
      }
      const r = item.radius * this.worldCamera.zoom;
      view.sprite.setPosition(p.x, p.y - Math.sin(time * .002 + item.id) * 2).setScale(r * 4 / this.texturesByKey.get(texture)!.unit).setDepth(p.y + 2);
       view.label.setPosition(p.x, p.y + r * .5 + 9).setDepth(100000 + p.y);
    }
    for (const [id, view] of this.opportunities) if (!active.has(id)) { view.sprite.destroy(); view.label.destroy(); this.opportunities.delete(id); }
  }

  private syncBlocks() {
    const game = this.options.simulation;
    // Streaming retains a simulation ring; Phaser allocates sprites only for the visible neighborhood.
    const visible = game.blocks.filter(block => {
      const p = this.screen(block.x, block.y); const size = block.size * this.worldCamera.zoom;
      return p.x + size > -180 && p.x - size < this.logicalWidth + 180 && p.y + size * 1.1 > -160 && p.y < this.logicalHeight + 160;
    });
    const active = new Set(visible.map(block => block.key));
    for (const [key, view] of this.blocks) if (!active.has(key)) { view.tile.destroy(); for (const prop of view.props) prop.sprite.destroy(); this.blocks.delete(key); }
    for (const block of visible) {
      const signature = `${block.district}-${block.variation % 3}-${this.details}`;
      const existing = this.blocks.get(block.key);
      if (existing?.signature === signature) { existing.block = block; continue; }
      if (existing) { existing.tile.destroy(); for (const prop of existing.props) prop.sprite.destroy(); }
      const texture = `ground-${signature}`;
      this.texture(texture, () => paintGround(block.district, block.variation % 3, this.details));
      const view: BlockView = { block, tile: this.image(texture).setDepth(-1000000), props: [], signature };
      if (this.details) {
        const coordinates: [PropKind, number, number][] = block.district === 'park'
          ? [['tree', .21, .2], ['tree', .75, .22], ['tree', .22, .73], ['tree', .78, .77], ['bench', .44, .74], ['lamp', .84, .35]]
          : block.district === 'waterfront'
            ? [['tree', .18, .2], ['tree', .84, .75], ['bench', .31, .82], ['lamp', .81, .27]]
            : [['tree', .22, .76], ['tree', .77, .2], ['bench', .75, .78], ['lamp', .17, .45]];
        if (block.variation % 6 === 0) coordinates.push(['car', .07, .5]);
        for (const [kind, x, y] of coordinates) {
          const variant = kind === 'tree' || kind === 'car' ? block.variation % 3 : 0;
          view.props.push({ kind, x, y, variant, sprite: this.image(`prop-${kind}-${variant}`) });
        }
      }
      this.blocks.set(block.key, view);
    }
  }
  private drawBlocks(time: number) {
    const zoom = this.worldCamera.zoom;
    for (const { block, tile, props } of this.blocks.values()) {
      const p = this.screen(block.x, block.y); const scale = block.size / 240 * zoom;
      const visible = this.onScreen(p.x, p.y, block.size * zoom * 2.2);
      tile.setVisible(visible); if (!visible) { for (const prop of props) prop.sprite.setVisible(false); continue; }
      tile.setPosition(p.x, p.y).setScale(scale / TEXTURE_DENSITY);
      for (const prop of props) {
        const travel = prop.kind === 'car' ? ((time / 1000 * .035 + block.variation % 100 / 100) % 1) : prop.y;
        const x = block.x + block.size * prop.x; const y = block.y + block.size * travel;
        const position = this.screen(x, y);
        prop.sprite.setPosition(position.x, position.y).setScale(scale / TEXTURE_DENSITY * (prop.kind === 'tree' ? .55 : prop.kind === 'lamp' ? .48 : .5)).setDepth(position.y - (prop.kind === 'car' ? 30 : 0)).setVisible(this.onScreen(position.x, position.y, 100));
      }
    }
  }

  private syncResources(time: number) {
    const game = this.options.simulation; const active = new Set<string>();
    const shortage = marketAt(game.elapsed).phase === 'gpu-shortage';
    for (const pickup of game.pickups) {
      if (!pickup.alive) continue;
      const p = this.screen(pickup.x, pickup.y); const projectedRadius = pickup.spec.radius * this.worldCamera.zoom;
      if (!this.onScreen(p.x, p.y, Math.max(120, projectedRadius * 4))) continue;
      active.add(pickup.id);
      let sprite = this.resources.get(pickup.id);
      const variant = ['investment', 'gpu', 'server'].includes(pickup.spec.kind) ? 0 : hashString(pickup.id) % 3;
      const texture = `resource-${pickup.spec.kind}-${variant}`;
      if (!sprite) { sprite = this.image(texture); this.resources.set(pickup.id, sprite); }
      else if (sprite.texture.key !== texture) sprite.setTexture(texture);
      const unit = this.texturesByKey.get(texture)!.unit;
      const scale = pickup.spec.kind === 'investment' ? projectedRadius * 3.2 / unit : projectedRadius * 3.1 / unit;
      const hover = pickup.spec.kind === 'investment' ? Math.sin(time * .0018 + pickup.phase) * 1.4 : 0;
      const required = pickup.spec.requiredMass * (shortage && ['gpu', 'server'].includes(pickup.spec.kind) ? 1.25 : 1);
      const edible = game.player.mass >= required;
      sprite.setPosition(p.x, p.y - hover).setScale(scale).setDepth(p.y).setAlpha(edible ? 1 : .7).setVisible(true);
    }
    for (const [id, sprite] of this.resources) if (!active.has(id)) { sprite.destroy(); this.resources.delete(id); }
  }

  private actorView(actor: Actor): ActorView {
    let view = this.actors.get(actor.id); if (view) return view;
    const texture = actor.id === 0 ? 'player' : `actor-${actor.logo}`;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: 'Manrope, sans-serif', fontSize: '9px', color: '#d5e5ec', fontStyle: '600', stroke: '#10202b', strokeThickness: 3, resolution: 2, padding: { x: 3, y: 1 } };
    view = {
      sprite: this.image(texture), name: this.add.text(0, 0, actor.name, textStyle).setOrigin(.5, 0),
      value: this.add.text(0, 0, '', { ...textStyle, fontFamily: 'Space Grotesk, sans-serif', fontSize: '8px', color: '#8caab9', strokeThickness: 2 }).setOrigin(.5, 0),
      marker: this.add.circle(0, 0, 2, 0xadc79c), shield: this.add.ellipse(0, 0, 70, 44).setStrokeStyle(1, 0x88c9d8, .65).setFillStyle(0, 0),
      aura: this.add.ellipse(0, 0, 60, 33).setStrokeStyle(1.2, 0xb5df87, .28).setFillStyle(0xb5df87, .04), radius: actor.radius, texture,
    };
    this.actors.set(actor.id, view); return view;
  }
  private syncActors(time: number, dt: number) {
    const game = this.options.simulation;
    const labels: { left: number; right: number; top: number; bottom: number }[] = [];
    const actors = [game.player, ...game.bots.slice().sort((a, b) => Math.hypot(a.x - game.player.x, a.y - game.player.y) - Math.hypot(b.x - game.player.x, b.y - game.player.y))];
    for (const actor of actors) {
      const view = this.actorView(actor); const p = this.screen(actor.x, actor.y);
      view.radius += (actor.radius - view.radius) * (1 - Math.exp(-dt * 9));
      const isPlayer = actor.id === 0;
      const presentation = actorPresentation({ mass: actor.mass, radius: view.radius }, game.player.mass, this.worldCamera.zoom, this.logicalWidth, this.logicalHeight, isPlayer);
      const r = presentation.radius;
      const visible = actor.alive && this.onScreen(p.x, p.y, r * 3 + 100);
      for (const item of [view.sprite, view.name, view.value, view.marker, view.shield, view.aura]) item.setVisible(visible);
      if (!visible) continue;
      const threat = !isPlayer && canAcquire(actor.mass, game.player.mass); const edible = !isPlayer && canAcquire(game.player.mass, actor.mass);
      const hover = Math.sin(time * .002 + actor.id) * (isPlayer ? 1.5 : .9);
      const scale = r * 2 / (148 * TEXTURE_DENSITY);
      view.sprite.setPosition(p.x, p.y - hover).setScale(scale).setDepth(p.y + 1).setAlpha(isPlayer ? 1 : .95);
      const labelY = p.y + r * .38 + 7;
      const nameColor = isPlayer ? '#dcefc6' : threat ? '#d9b7c5' : '#aec9d6';
      if (view.name.style.color !== nameColor) view.name.setColor(nameColor);
      const width = Math.min(presentation.labelWidth, actor.name.length * 5.1 + 6);
      const bounds = { left: p.x - width / 2, right: p.x + width / 2, top: labelY, bottom: labelY + (presentation.showValue ? 26 : 14) };
      const landscape = this.logicalWidth > this.logicalHeight;
      const behindChrome = landscape ? labelY < 95 && p.x < this.logicalWidth * .5 : labelY < 115;
      const behindControls = labelY > this.logicalHeight - 135 && (p.x < 145 || p.x > this.logicalWidth - 110);
      const showLabel = !this.options.preview && (r > 15 || isPlayer) && (isPlayer || !behindChrome && !behindControls && !labels.some(label => bounds.left < label.right + 4 && bounds.right > label.left - 4 && bounds.top < label.bottom + 3 && bounds.bottom > label.top - 3));
      if (showLabel) labels.push(bounds);
      const name = actor.name.length > 19 ? `${actor.name.slice(0, 17)}…` : actor.name;
      if (view.name.text !== name) view.name.setText(name);
      view.name.setPosition(p.x, labelY).setDepth(110000 + p.y).setFontSize(isPlayer ? 10 : 8).setVisible(showLabel);
      const value = formatMoney(actor.mass); if (view.value.text !== value) view.value.setText(value);
      view.value.setPosition(p.x, labelY + 13).setDepth(110001 + p.y).setVisible(showLabel && presentation.showValue);
      const outline = threat ? 0xdd8b9f : edible ? 0xb0d98f : 0x95b9ca;
      view.marker.setPosition(p.x + r * .7, p.y - r * 1.08).setRadius(threat ? 2.5 : 2).setFillStyle(outline).setDepth(110002 + p.y).setVisible(visible && !isPlayer && showLabel);
      view.aura.setPosition(p.x, p.y + 1).setSize(r * 2.25, r * 1.24).setDepth(p.y - 2).setStrokeStyle(isPlayer ? 1.8 : 1.3, isPlayer ? Phaser.Display.Color.HexStringToColor(actor.color).color : outline, isPlayer ? .55 : threat ? .5 : .35).setFillStyle(outline, .025).setVisible(visible && (isPlayer || threat || edible));
      view.shield.setPosition(p.x, p.y - r * .34).setSize(r * 2.6, r * 2).setDepth(p.y + 5).setAlpha(.5 + Math.sin(time * .004) * .15).setVisible(visible && isPlayer && game.started && (game.shield > 0 || game.hasPower('firewall') || game.market.pivotUntil > game.elapsed));
      if (isPlayer && (game.look.frame === 'orbit' || game.look.frame === 'hex')) view.aura.setStrokeStyle(1.5, Phaser.Display.Color.HexStringToColor(actor.color).color, .55).setAngle(game.look.frame === 'orbit' ? -20 : 0);
      if (isPlayer && (game.boosting || game.look.trail !== 'none') && Math.hypot(actor.vx, actor.vy) > 30 && time - this.lastTrail > 60) {
        this.lastTrail = time;
        const velocity = project({ x: actor.vx, y: actor.vy }); const length = Math.hypot(velocity.x, velocity.y) || 1;
        const spark = this.add.image(p.x - velocity.x / length * r * .5, p.y - velocity.y / length * r * .5, 'spark').setDepth(p.y - 3).setAlpha(.45).setScale(.18);
        spark.setTint(game.look.trail === 'electric' ? 0x78d8ff : game.look.trail === 'fire' ? 0xffc27b : game.look.trail === 'stardust' ? 0xc0a5ff : game.look.trail === 'rainbow' ? Phaser.Display.Color.HSVToRGB((time / 5000) % 1, .5, 1).color : Phaser.Display.Color.HexStringToColor(actor.color).color);
        this.effects.push({ object: spark, x: spark.x, y: spark.y, vx: 0, vy: 0, age: 0, duration: .55, startScale: .18, screenSpace: true });
      }
    }
  }

  private handleEvent(event: GameEvent) {
    if (event.type === 'rebase') {
      this.worldCamera.x -= event.x; this.worldCamera.y -= event.y;
      for (const effect of this.effects) if (!effect.screenSpace) { effect.x -= event.x; effect.y -= event.y; }
      this.lastRevision = -1; return;
    }
    if (event.type === 'opportunity' || event.type === 'pivot') {
      const p = this.screen(event.x, event.y); const ring = this.add.ellipse(p.x, p.y, 42, 24).setStrokeStyle(2, event.type === 'pivot' ? 0x8dd6de : event.kind === 'audit' ? 0xdf8f9b : 0xddcf92, .75).setDepth(p.y + 12);
      this.effects.push({ object: ring, x: event.x, y: event.y, vx: 0, vy: 0, age: 0, duration: .6, startScale: 1, screenSpace: false });
      return;
    }
    if (event.type !== 'pickup' && event.type !== 'acquisition') return;
    const position = this.screen(event.x, event.y);
    if (event.type === 'pickup') {
      const sprite = this.resources.get(event.id);
      if (sprite) {
        const ghost = this.add.image(sprite.x, sprite.y, sprite.texture.key).setOrigin(sprite.originX, sprite.originY).setScale(sprite.scaleX).setDepth(position.y + 10);
        this.effects.push({ object: ghost, x: event.x, y: event.y, vx: 0, vy: -22, age: 0, duration: .24, startScale: ghost.scaleX, screenSpace: false });
      }
    }
    for (let index = 0; index < (event.type === 'acquisition' ? 10 : 3); index++) {
      const angle = Math.random() * Math.PI * 2; const spark = this.add.image(position.x, position.y, 'spark').setDepth(position.y + 11).setScale(.13).setTint(event.type === 'acquisition' ? 0xffd59a : 0xbbeb9b);
      this.effects.push({ object: spark, x: event.x, y: event.y, vx: Math.cos(angle) * 80, vy: Math.sin(angle) * 60, age: 0, duration: .45, startScale: .13, screenSpace: false });
    }
    if (event.type === 'acquisition' || event.kind !== 'investment') {
      const label = this.add.text(position.x, position.y - 28, `+${formatMoney(event.value)}`, { fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', color: '#cfebba', stroke: '#102b24', strokeThickness: 3, resolution: 2 }).setOrigin(.5).setDepth(position.y + 12);
      this.effects.push({ object: label, x: event.x, y: event.y, vx: 0, vy: -25, age: 0, duration: .9, startScale: 1, screenSpace: false });
    }
    if (this.effects.length > 100) for (const effect of this.effects.splice(0, this.effects.length - 100)) effect.object.destroy();
  }
  private updateEffects(dt: number) {
    this.effects = this.effects.filter(effect => {
      effect.age += dt; if (effect.age >= effect.duration) { effect.object.destroy(); return false; }
      const t = effect.age / effect.duration;
      const base = effect.screenSpace ? { x: effect.x, y: effect.y } : this.screen(effect.x, effect.y);
      effect.object.setPosition(base.x + effect.vx * effect.age, base.y + effect.vy * effect.age).setAlpha(1 - t).setScale(effect.startScale * (effect.object instanceof Phaser.GameObjects.Text ? 1 : 1 - t * .55));
      return true;
    });
  }
}

export interface PhaserArena {
  game: Phaser.Game;
  setWide: (wide: boolean) => void;
  setDetails: (details: boolean) => void;
  metrics: () => { engine: string; renderer: string; frames: number; sprites: number; textures: number };
  destroy: () => void;
}
export function createPhaserArena(parent: HTMLElement, options: ArenaOptions): PhaserArena {
  const scene = new VentureScene(options);
  const rect = parent.getBoundingClientRect();
  const pixelRatio = Math.min(devicePixelRatio || 1, 2);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: Math.max(1, Math.round(rect.width * pixelRatio)), height: Math.max(1, Math.round(rect.height * pixelRatio)), backgroundColor: '#132432',
    antialias: true, pixelArt: false, transparent: false,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / pixelRatio, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance', maxTextures: 16 },
     fps: { target: options.preview ? 24 : 60, limit: options.preview ? 24 : 60, smoothStep: true }, audio: { noAudio: true },
    input: { activePointers: 3, keyboard: false, mouse: false, touch: false },
    scene: [scene], banner: false, autoFocus: false,
  });
  const observer = new ResizeObserver(() => {
    const size = parent.getBoundingClientRect();
    if (size.width > 0 && size.height > 0) game.scale.resize(Math.round(size.width * pixelRatio), Math.round(size.height * pixelRatio));
  });
  observer.observe(parent);
  game.canvas.setAttribute('aria-label', 'startup.io Phaser 2.5D arena');
  return {
    game,
    setWide: wide => scene.setWide(wide), setDetails: details => scene.setDetails(details),
    metrics: () => ({ engine: `Phaser ${Phaser.VERSION}`, renderer: game.renderer?.type === Phaser.WEBGL ? 'WebGL' : 'Canvas', frames: scene.visibleFrames, sprites: scene.activeSprites, textures: game.textures?.getTextureKeys().length ?? 0 }),
    destroy: () => { observer.disconnect(); game.destroy(true); },
  };
}
