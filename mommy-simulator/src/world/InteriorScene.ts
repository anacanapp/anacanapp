import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Character, makeBaby, makeChild } from './character';
import { Materials } from './materials';
import { currentStep, simulationWeek } from '../game/progression';
import { art, GROCERY_PRODUCTS } from '../game/luzern';
import { householdVisuals, interiorFamily, interiorLight, layoutInteriorPins } from '../game/interior';
import { roomAt } from '../game/navigation';
import { FURNITURE } from '../game/content';
import { availableActivities } from '../game/engine';
import type { GameState, Room, ActivityId } from '../game/types';

export interface InteriorPosition { x: number; y: number; visible: boolean }
type Interactable = { id: ActivityId; mesh: THREE.Object3D; anchor: THREE.Vector3 };
type InteriorCallbacks = { onActivity(id: ActivityId): void; onPositions(positions: Partial<Record<ActivityId, InteriorPosition>>): void; onReady(): void };

/** Real-time eye-level room, independently lit and furnished. */
export class InteriorScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, .1, 80);
  private materials = new Materials();
  private environment = new THREE.Group();
  private household = new THREE.Group();
  private decor = new THREE.Group();
  private mother: Character;
  private father: Character;
  private baby: THREE.Group;
  private sittingBaby: THREE.Group;
  private toddler: THREE.Group;
  private doctor: Character;
  private clock = new THREE.Clock();
  private sunlight: THREE.DirectionalLight;
  private ambient: THREE.HemisphereLight;
  private room: Room;
  private state: GameState;
  private avatarKey: string;
  private interactables: Interactable[] = [];
  private points: THREE.Points;
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private paused = false;
  private angle = .18;
  private targetAngle = .18;
  private distance = 8.3;
  private lastPointer = { x: 0, y: 0 };
  private pointerStart = { x: 0, y: 0 };
  private moved = false;
  private ray = new THREE.Raycaster();
  private visible = true;
  private t = 0;
  private target = new THREE.Vector3(0, 1.15, -.10);
  private controls = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private elevation = 2.8;
  private textures = new Map<string, THREE.Texture>();
  private lights: THREE.PointLight[] = [];
  private visualKey = '';
  private decorKey = '';
  private structureKey = '';
  private crib = new THREE.Group();
  private cribParts = new THREE.Group();
  private ready = false;
  private lastPositions = 0;
  private pinKey = '';
  private suspended = false;

  constructor(private element: HTMLDivElement, state: GameState, room: Room, private callbacks: InteriorCallbacks) {
    this.state = state; this.room = room; this.avatarKey = JSON.stringify(state.avatar);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none'; this.renderer.domElement.setAttribute('data-testid', 'interior-canvas'); this.element.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#e8e4d4');
    this.ambient = new THREE.HemisphereLight('#fff6e6', '#c0c6b5', 2.0); this.scene.add(this.ambient);
    this.sunlight = new THREE.DirectionalLight('#ffedbd', 4.0); this.sunlight.position.set(-4, 6, -2);
    this.sunlight.castShadow = true; this.sunlight.shadow.mapSize.set(1024, 1024); this.sunlight.shadow.camera.left = -6; this.sunlight.shadow.camera.right = 6;
    this.sunlight.shadow.camera.top = 7; this.sunlight.shadow.camera.bottom = -7; this.sunlight.shadow.normalBias = .018; this.sunlight.shadow.bias = -.00015; this.scene.add(this.sunlight);
    const rim = new THREE.DirectionalLight('#f5f1e9', 1); rim.position.set(3, 3, 6); this.scene.add(rim);
    this.scene.add(this.environment, this.household, this.decor);
    this.mother = new Character(this.materials, state.avatar); this.father = new Character(this.materials, { ...state.avatar, outfitStyle: 'knit' }, true);
    this.scene.add(this.mother.group, this.father.group);
    this.baby = makeBaby(this.materials, state.avatar.skin, '#eee4d2'); this.scene.add(this.baby);
    this.sittingBaby = makeChild(this.materials, state.avatar.skin); this.toddler = makeChild(this.materials, state.avatar.skin, true); this.scene.add(this.sittingBaby, this.toddler);
    this.doctor = new Character(this.materials, { ...state.avatar, skin: '#bd8059', hair: '#241e25', outfitStyle: 'casual' }, false, true); this.scene.add(this.doctor.group);
    const geometry = new THREE.BufferGeometry(), positions = new Float32Array(120 * 3);
    for (let i = 0; i < positions.length; i += 3) { positions[i] = Math.sin(i * 19.3) * 3.2; positions[i + 1] = .4 + Math.abs(Math.sin(i * 31.7)) * 3.1; positions[i + 2] = Math.cos(i * 13.5) * 2.7; }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#fff5d5', size: .014, transparent: true, opacity: .25, depthWrite: false })); this.scene.add(this.points);
    this.rebuildRoom(); this.update(state);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(element); this.resize();
    const canvas = this.renderer.domElement; canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move); canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    canvas.addEventListener('webglcontextlost', this.contextLost); canvas.addEventListener('webglcontextrestored', this.contextRestored);
    this.frame = requestAnimationFrame(this.animate);
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, material: string | THREE.Material, radius = .03, parent: THREE.Object3D = this.environment) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 3, h / 3, d / 3)), typeof material === 'string' ? this.materials.colour(material) : material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private ball(rx: number, ry: number, rz: number, x: number, y: number, z: number, material: string | THREE.Material, parent: THREE.Object3D = this.environment) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), typeof material === 'string' ? this.materials.colour(material) : material); mesh.scale.set(rx, ry, rz); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private cylinder(r: number, h: number, x: number, y: number, z: number, material: string | THREE.Material, parent: THREE.Object3D = this.environment, r2 = r) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, 24), typeof material === 'string' ? this.materials.colour(material) : material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private interaction(object: THREE.Object3D, id: ActivityId, at?: [number, number, number]) {
    object.traverse(o => { o.userData.activity = id; }); object.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(object), anchor = at ? new THREE.Vector3(...at) : bounds.getCenter(new THREE.Vector3());
    if (!at) anchor.y = Math.min(2.5, bounds.max.y + .13);
    this.interactables.push({ id, mesh: object, anchor });
  }
  private texture(id: string) {
    if (!this.textures.has(id)) { const texture = new THREE.TextureLoader().load(art(id)); texture.colorSpace = THREE.SRGBColorSpace; this.textures.set(id, texture); }
    return this.textures.get(id)!;
  }
  private ring(radius: number, width: number, x: number, y: number, z: number, material: string | THREE.Material, parent: THREE.Object3D = this.environment) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, width, 8, 32), typeof material === 'string' ? this.materials.colour(material) : material);
    mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  }

  private window(x: number, w = 2.4) {
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.9), new THREE.MeshBasicMaterial({ map: this.texture('alpine-window') })); outside.position.set(x, 1.90, -3.095); outside.userData.ownedMaterial = true; this.environment.add(outside);
    const white = '#f5eee0';
    for (const xx of [x - w / 2, x + w / 2, x]) this.box(.055, 2.96, .18, xx, 1.91, -3.015, white, .006);
    for (const y of [.40, 1.6, 3.37]) this.box(w + .06, .055, .17, x, y, -3.02, white, .006);
    this.box(w + .18, .07, .30, x, .39, -2.98, '#eee3d0', .015);
    const curtainMat = this.materials.fabric('#d9d4bf');
    for (const sign of [-1, 1]) {
      const group = new THREE.Group(); group.position.set(x + sign * (w / 2 + .04), 1.91, -2.78); this.environment.add(group);
      for (let i = 0; i < 6; i++) this.cylinder(.035, 3.02, -.135 + i * .054, 0, Math.sin(i) * .018, curtainMat, group);
      this.box(.39, 3.02, .039, 0, 0, -.02, curtainMat, .02, group);
    }
  }

  private rug(x: number, z: number, w: number, d: number) { this.box(w, .018, d, x, .02, z, this.materials.rug('#e9dfc9', '#a5b4a0', 'flower'), .025); }
  private plant(x: number, y: number, z: number, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); this.environment.add(group);
    this.cylinder(.18, .32, 0, .17, 0, '#c7aa89', group, .13);
    this.cylinder(.024, 1.13, 0, .89, 0, '#819469', group);
    for (let i = 0; i < 11; i++) { const a = i * 2.4, radius = .17 + i % 3 * .065; const leaf = this.ball(.12, .23, .019, Math.sin(a) * radius, .48 + i * .075, Math.cos(a) * radius, i % 2 ? '#82956b' : '#a4b087', group); leaf.rotation.set(.23, a, .33 * Math.cos(a)); }
  }
  private artPrint(x: number, y: number, z: number, type = 'botanical') {
    const group = new THREE.Group(); group.position.set(x, y, z); this.environment.add(group);
    this.box(.77, .98, .055, 0, 0, 0, this.materials.wood('#c4a17e', '#927553'), .015, group);
    this.box(.66, .87, .021, 0, 0, .038, '#f5efdf', .006, group);
    if (type === 'bunny') {
      this.ball(.18, .22, .012, 0, -.05, .054, '#cfb69a', group);
      this.ball(.061, .18, .012, -.086, .23, .054, '#cfb69a', group).rotation.z = .1;
      this.ball(.061, .18, .012, .086, .23, .054, '#cfb69a', group).rotation.z = -.1;
      for (const xx of [-.067, .067]) this.ball(.015, .016, .009, xx, -.013, .067, '#7c624c', group);
    } else {
      this.box(.012, .53, .01, 0, -.04, .055, '#8a9b72', .003, group);
      for (let i = 0; i < 5; i++) this.ball(.11, .035, .01, (i % 2 ? 1 : -1) * .061, -.24 + i * .085, .058, '#a5b593', group).rotation.z = (i % 2 ? 1 : -1) * .5;
    }
  }
  private lamp(x: number, z: number, y = 0) {
    this.cylinder(.16, .028, x, y + .06, z, '#bca78a'); this.cylinder(.018, .69, x, y + .42, z, '#b7a17d');
    this.cylinder(.22, .36, x, y + .91, z, this.materials.fabric('#efe4c8'), this.environment, .32);
    const glow = new THREE.PointLight('#ffe6ad', 1.9, 3.5, 2); glow.position.set(x, y + .8, z); this.environment.add(glow); this.lights.push(glow);
  }
  private chair(x: number, z: number, action: ActivityId = 'feed') {
    const group = new THREE.Group(); group.position.set(x, 0, z); this.environment.add(group);
    const linen = this.materials.fabric('#e6dbc6');
    this.box(1.11, .30, 1.10, 0, .42, 0, linen, .15, group);
    this.box(1.05, .91, .30, 0, .92, -.41, linen, .13, group).rotation.x = -.10;
    for (const sign of [-1, 1]) this.box(.27, .53, 1.08, sign * .52, .68, 0, linen, .11, group);
    this.box(.78, .16, .85, 0, .66, .01, linen, .07, group);
    this.box(.48, .39, .12, .02, 1.02, -.22, this.materials.fabric('#d5ad97', true), .055, group).rotation.z = .1;
    for (const xx of [-.4, .4]) for (const zz of [-.36, .36]) this.cylinder(.028, .18, xx, .14, zz, '#bba182', group);
    this.interaction(group, action); return group;
  }
  private table(x: number, z: number, r = .43) {
    const group = new THREE.Group(); group.position.set(x, 0, z); this.environment.add(group);
    this.cylinder(r, .07, 0, .62, 0, this.materials.wood('#c5a37b', '#8b6c46'), group);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; this.cylinder(.029, .57, Math.sin(a) * r * .64, .31, Math.cos(a) * r * .64, '#b69b79', group); }
    this.interaction(group, 'read'); return group;
  }
  private bunny(x: number, y: number, z: number) {
    const group = new THREE.Group(); group.position.set(x, y, z); this.environment.add(group); const plush = this.materials.fabric('#e3d3ba');
    this.ball(.11, .15, .085, 0, .15, 0, plush, group); this.ball(.085, .09, .072, 0, .34, .025, plush, group);
    for (const sign of [-1, 1]) { this.ball(.023, .13, .03, sign * .044, .46, -.008, plush, group).rotation.z = sign * -.24; this.ball(.009, .012, .006, sign * .033, .35, .093, '#6b5242', group); this.ball(.033, .019, .046, sign * .063, .025, .045, plush, group); }
  }

  private cup(x: number, y: number, z: number, parent: THREE.Object3D = this.environment) {
    const cup = this.cylinder(.066, .10, x, y + .05, z, '#f3ebd7', parent);
    this.cylinder(.049, .005, x, y + .102, z, '#9d7955', parent);
    this.ring(.034, .009, x + .072, y + .05, z, '#e5d7bd', parent).rotation.y = Math.PI / 2;
    return cup;
  }

  private basket(x: number, y: number, z: number, parent: THREE.Object3D = this.environment) {
    const group = new THREE.Group(); group.position.set(x, y, z); parent.add(group);
    const wicker = this.materials.fabric('#c8ad87', true);
    this.cylinder(.29, .42, 0, .24, 0, wicker, group, .23);
    const rim = this.ring(.29, .025, 0, .455, 0, '#c1a17c', group); rim.rotation.x = Math.PI / 2;
    for (const sign of [-1, 1]) this.ring(.065, .014, sign * .285, .39, 0, '#b69570', group).rotation.y = Math.PI / 2;
    return group;
  }

  private foldedCloth(x: number, y: number, z: number, colour: string, parent: THREE.Object3D = this.environment) {
    const cloth = this.box(.35, .045, .27, x, y, z, this.materials.fabric(colour, true), .02, parent);
    this.box(.26, .005, .19, x, y + .025, z + .02, this.materials.fabric(colour), .01, parent); return cloth;
  }

  private pendant(x: number, z: number) {
    this.cylinder(.008, .39, x, 3.21, z, '#a98e68');
    const shade = this.cylinder(.31, .29, x, 2.90, z, this.materials.fabric('#ddc8a2', true), this.environment, .43);
    for (let i = 0; i < 9; i++) this.ring(.31 + i * .014, .008, x, 3.03 - i * .03, z, '#c9af85').rotation.x = Math.PI / 2;
    const glow = new THREE.PointLight('#ffe6b9', 1.1, 5); glow.position.set(x, 2.75, z); this.environment.add(glow); this.lights.push(glow); shade.castShadow = false;
  }

  private rebuildRoom() {
    for (const group of [this.environment, this.household, this.decor]) { this.clearGroup(group); group.clear(); }
    this.interactables = []; this.lights = []; this.visualKey = ''; this.decorKey = ''; this.pinKey = ''; this.callbacks.onPositions({});
    this.structureKey = `${this.room}:${this.state.pregnancy.born}:${this.state.chapter >= 6}`;
    this.distance = this.room === 'garden' || this.room === 'lakeside' ? 8.7 : 8.25; this.targetAngle = .18; this.elevation = 2.8;
    this.target.set(0, 1.25, -.15);
    if (this.room === 'garden' || this.room === 'lakeside') { this.terrace(); return; }
    const wall = this.room === 'nursery' ? '#c4d1b9' : this.room === 'bathroom' ? '#e4e3d4' : '#d9dfca', wood = this.materials.wood('#d0ab81', '#8a6749');
    this.box(7.2, .08, 6.6, 0, -.05, .1, wood, .01);
    this.box(7.2, 3.55, .16, 0, 1.71, -3.20, wall, .01);
    this.box(.16, 3.55, 6.6, -3.56, 1.71, .1, wall, .01);
    this.box(7.08, .11, .065, 0, .065, -3.09, '#f1eadb', .008); this.box(.065, .11, 6.5, -3.45, .065, .1, '#f1eadb', .008);
    this.box(7.08, .08, .07, 0, 3.39, -3.09, '#eee5d2', .009);
    this.box(.07, .08, 6.45, -3.45, 3.39, .1, '#eee5d2', .009);
    for (let x = -3.3; x < 3.5; x += .38) this.box(.006, .002, 6.42, x, -.008, .1, '#b69b77', .001);
    if (this.room !== 'kitchen' && this.room !== 'market' && this.room !== 'clinic') {
      this.box(7.08, .85, .035, 0, .52, -3.10, '#e6e7d7', .006); this.box(.035, .85, 6.45, -3.45, .52, .1, '#e6e7d7', .006);
      this.box(7.08, .035, .07, 0, .97, -3.06, '#f0eddf', .005); this.box(.07, .035, 6.45, -3.42, .97, .1, '#f0eddf', .005);
      for (let x = -3.2; x < 3.5; x += .55) this.box(.017, .78, .019, x, .52, -3.065, '#d4dbc8', .004);
    }
    if (this.room !== 'market' && this.room !== 'clinic') this.window(.35, 2.45);
    this.plant(2.85, 0, -2.56, 1.12);
    if (this.room === 'nursery') this.nursery();
    else if (this.room === 'kitchen') this.kitchen();
    else if (this.room === 'bathroom') this.bathroom();
    else if (this.room === 'bedroom') this.bedroom();
    else if (this.room === 'market') this.market();
    else if (this.room === 'cafe') this.cafe();
    else if (this.room === 'clinic') this.clinic();
    else this.living();
  }

  private nursery() {
    this.rug(0, .45, 4.8, 3.35);
    const crib = new THREE.Group(); this.crib = crib; crib.position.set(-2.25, 0, -.55); this.environment.add(crib); const oak = this.materials.wood('#cfac83', '#97714c');
    this.box(1.28, .12, 2.06, 0, .44, 0, oak, .035, crib);
    this.box(1.14, .15, 1.90, 0, .57, 0, this.materials.fabric('#f2ecd9'), .035, crib);
    for (const xx of [-.61, .61]) for (let i = 0; i < 12; i++) this.cylinder(.019, .64, xx, .91, -.95 + i * .172, oak, crib);
    for (const xx of [-.64, .64]) this.box(.07, .055, 2.10, xx, 1.25, 0, oak, .015, crib);
    for (const zz of [-1.0, 1.0]) { this.box(1.34, .06, .055, 0, 1.25, zz, oak, .015, crib); for (let i = 0; i < 8; i++) this.cylinder(.019, .64, -.60 + i * .17, .91, zz, oak, crib); }
    for (const xx of [-.62, .62]) for (const zz of [-.97, .97]) this.cylinder(.036, .42, xx, .24, zz, oak, crib);
    this.box(.5, .025, .75, -.40, 1.27, -.34, this.materials.fabric('#d6c3ad', true), .01, crib).rotation.z = -.09;
    this.interaction(crib, this.state.pregnancy.born ? 'lullaby' : this.state.chapter >= 6 ? 'assemble' : 'read');
    this.cribParts = new THREE.Group(); this.environment.add(this.cribParts);
    this.box(1.14, .29, 1.6, -2.24, .17, -.51, oak, .035, this.cribParts);
    for (let i = 0; i < 5; i++) this.box(.05, 1.18, .065, -2.81 + i * .075, .65, -1.48, oak, .009, this.cribParts).rotation.z = -.10;
    this.box(.75, .018, .55, -2.18, .33, -.42, '#efe4ca', .01, this.cribParts);
    this.interaction(this.cribParts, this.state.chapter >= 6 ? 'assemble' : 'read', [-2.25, .72, -.50]);
    this.chair(1.30, .3, this.state.pregnancy.born ? 'feed' : 'read'); this.table(2.44, .4, .38); this.bunny(2.42, .66, .39); this.lamp(2.86, -1.32);
    const dresser = new THREE.Group(); dresser.position.set(.83, 0, -2.4); this.environment.add(dresser);
    this.box(1.68, .90, .67, 0, .5, 0, '#ece3d0', .045, dresser); this.box(1.75, .06, .75, 0, .99, 0, oak, .025, dresser);
    for (const yy of [.22, .52, .80]) { this.box(1.52, .22, .025, 0, yy, .35, '#e4d9c3', .02, dresser); for (const xx of [-.44, .44]) this.ball(.035, .035, .026, xx, yy, .384, '#c0a07d', dresser); }
    this.box(1.03, .065, .56, 0, 1.06, 0, this.materials.fabric('#e9dfc8'), .06, dresser); this.interaction(dresser, this.state.pregnancy.born ? 'diaper' : 'pack');
    this.foldedCloth(1.52, 1.11, -2.35, '#c5cdb4'); this.cylinder(.052, .15, .20, 1.12, -2.42, '#ede8d6');
    this.basket(-.58, 0, -2.36);
    this.artPrint(-2.65, 2.45, -3.075, 'bunny'); this.artPrint(-1.63, 2.45, -3.075); this.plant(-3.03, 0, -2.40, .98);
    // Suspended wooden moon and stars rotate gently over the crib.
    this.cylinder(.015, 1.76, -2.72, 1.73, -1.45, '#bca381');
    const mobile = new THREE.Group(); mobile.position.set(-2.26, 2.51, -.60); this.environment.add(mobile);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(.31, .014, 8, 36), oak); hoop.rotation.x = Math.PI / 2; mobile.add(hoop);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; this.cylinder(.004, .33 + i % 2 * .11, Math.sin(a) * .28, -.17 - i % 2 * .05, Math.cos(a) * .28, '#d8ccb2', mobile); this.ball(.061, .070, .017, Math.sin(a) * .28, -.38 - i % 2 * .10, Math.cos(a) * .28, i % 2 ? '#d1b078' : '#eadfbd', mobile); }
    mobile.userData.mobile = true;
    const play = this.box(.94, .035, .94, -.28, .055, 1.57, this.materials.rug('#ede3cc', '#b6c4a4', 'dots'), .09); this.interaction(play, this.state.pregnancy.born ? 'play' : 'tidy');
    for (let i = 0; i < 3; i++) this.box(.11, .11, .11, -.55 + i * .18, .13, 1.64, ['#c3b393', '#9daf91', '#c7a994'][i], .018);
    this.mother.group.position.set(1.30, .38, .43); this.mother.group.rotation.y = -.20; this.father.group.position.set(-.34, 0, .66); this.father.group.rotation.y = .64;
    this.baby.position.set(-2.25, .70, -.58); this.baby.rotation.x = -Math.PI / 2;
  }

  private living() {
    this.rug(.15, .55, 4.93, 3.41);
    const sofa = new THREE.Group(); sofa.position.set(.26, 0, -.44); this.environment.add(sofa); const cloth = this.materials.fabric('#e7deca');
    this.box(2.88, .27, 1.05, 0, .40, 0, cloth, .14, sofa); this.box(2.91, .73, .25, 0, .86, -.46, cloth, .13, sofa);
    for (const sign of [-1, 1]) this.box(.26, .54, 1.10, sign * 1.42, .58, 0, cloth, .13, sofa);
    for (let i = 0; i < 3; i++) { this.box(.88, .16, .85, -.9 + i * .9, .64, .035, cloth, .08, sofa); this.box(.50, .44, .13, -.9 + i * .9, .94, -.26, this.materials.fabric(i === 1 ? '#c59980' : '#a7b795', true), .06, sofa).rotation.z = (i - 1) * -.09; }
    for (const xx of [-1.1, 1.1]) for (const zz of [-.32, .31]) this.cylinder(.026, .16, xx, .12, zz, '#b99a75', sofa);
    this.interaction(sofa, 'rest');
    this.table(0, 1.44, .74); this.cylinder(.21, .025, 0, .69, 1.44, '#dcccae');
    for (const xx of [-.18, .17]) this.cup(xx, .71, 1.43);
    this.box(.28, .027, .38, .45, .68, 1.50, '#dbc5a7', .01).rotation.y = -.2;
    // Bookshelves / fireplace on the left wall read like a Swiss family interior.
    const shelf = new THREE.Group(); shelf.position.set(-2.89, 0, -1.68); this.environment.add(shelf); const walnut = this.materials.wood('#a68562', '#6c523a');
    for (const xx of [-.60, .60]) this.box(.06, 2.52, .49, xx, 1.29, 0, walnut, .01, shelf);
    for (let i = 0; i < 5; i++) { const y = .24 + i * .53; this.box(1.23, .07, .48, 0, y, 0, walnut, .008, shelf); for (let b = 0; b < 8; b++) this.box(.082, .29 + b % 3 * .042, .30, -.43 + b * .111, y + .205, -.01, ['#c5b79e', '#90a186', '#d3beaa', '#8b806e'][b % 4], .006, shelf).rotation.z = b === 7 ? -.11 : 0; }
    this.interaction(shelf, 'read');
    const journal = this.box(.42, .035, .31, -.46, .69, 1.57, '#b4bc9e', .009); this.interaction(journal, 'journal');
    this.box(.23, .42, .027, -.97, .86, -.04, this.materials.fabric('#b5bea0', true), .02, sofa).rotation.z = -.20;
    this.box(.40, .038, .70, -1.13, .76, .13, this.materials.fabric('#b5bea0', true), .022, sofa);
    this.basket(2.64, 0, 1.67); const cleaningCloth = this.box(.25, .04, .19, 2.65, .49, 1.66, this.materials.fabric('#e7dcc5'), .02); this.interaction(cleaningCloth, 'clean', [2.64, .68, 1.66]);
    this.artPrint(2.22, 2.40, -3.075); this.lamp(2.74, -.67);
    this.plant(-2.76, 0, 1.72, .82); this.bunny(1.65, .03, 1.68);
    this.mother.group.position.set(.18, .36, -.23); this.mother.group.rotation.y = .03; this.father.group.position.set(1.79, 0, .50); this.father.group.rotation.y = -.71;
    this.baby.position.set(.18, .70, -.30);
  }

  private kitchen() {
    const cabinet = new THREE.Group(); this.environment.add(cabinet); const sage = '#b9c3a7', marble = '#efe5cf';
    this.box(5.9, .89, .78, 0, .47, -2.73, sage, .02, cabinet); this.box(6.0, .075, .85, 0, .975, -2.72, marble, .025, cabinet);
    for (let i = 0; i < 8; i++) { const x = -2.53 + i * .72; this.box(.63, .70, .022, x, .51, -2.313, '#bbc6ae', .015, cabinet); this.box(.19, .02, .025, x, .76, -2.29, '#bea278', .005, cabinet); }
    this.box(1.0, .035, .50, .3, 1.035, -2.71, '#b4c5b9', .10, cabinet);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.30, 1, -2.97), new THREE.Vector3(.30, 1.48, -2.97), new THREE.Vector3(.30, 1.51, -2.69), new THREE.Vector3(.30, 1.30, -2.64)]);
    this.environment.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .017, 10), this.materials.colour('#c5a16a', .35, .65)));
    this.box(.83, .03, .56, -1.35, 1.030, -2.70, '#546a60', .035, cabinet);
    for (const xx of [-1.59, -1.1]) for (const zz of [-2.9, -2.57]) { const burner = new THREE.Mesh(new THREE.TorusGeometry(.095, .009, 6, 20), this.materials.colour('#87998a')); burner.rotation.x = Math.PI / 2; burner.position.set(xx, 1.052, zz); this.environment.add(burner); }
    this.cylinder(.15, .19, -1.57, 1.16, -2.9, '#ccb794'); this.cylinder(.17, .023, -1.57, 1.263, -2.9, '#eee1c6');
    this.plant(2.26, 1.03, -2.73, .3); this.interaction(cabinet, 'cook');
    this.box(.7, .39, .03, -1.36, .45, -2.28, '#5e6e63', .03); this.box(.59, .28, .015, -1.36, .45, -2.25, '#85958c', .02);
    this.box(.55, .025, .035, -1.36, .69, -2.22, '#c3ac87', .008);
    this.box(1.26, .10, .63, -1.36, 2.63, -2.80, '#d9dfce', .03); this.box(.44, .54, .32, -1.36, 2.96, -2.96, '#e4e6d9', .02);
    const shelves = new THREE.Group(); shelves.position.set(-2.73, 0, -.95); this.environment.add(shelves);
    const oak = this.materials.wood('#c5a27a', '#94734d');
    for (const y of [.72, 1.29, 1.87, 2.45]) this.box(.70, .055, 1.05, 0, y, 0, oak, .01, shelves);
    for (const z of [-.52, .52]) this.box(.035, 2.24, .035, -.31, 1.55, z, oak, .007, shelves);
    for (let i = 0; i < 4; i++) { this.cylinder(.076, .22, -2.93, 2.60, -.65 - i * .18, '#d8cfb7'); this.cylinder(.08, .025, -2.93, 2.72, -.65 - i * .18, '#b89b73'); }
    this.box(.37, .34, .35, -2.48, 1.18, -2.71, '#dedaca', .04); this.box(.21, .19, .03, -2.48, 1.2, -2.51, '#8f9f90', .01);
    const island = new THREE.Group(); island.position.set(.20, 0, .44); this.environment.add(island);
    this.box(2.22, .81, 1.16, 0, .44, 0, '#c6b894', .04, island); this.box(2.38, .075, 1.3, 0, .905, 0, marble, .045, island); this.interaction(island, 'water');
    this.cylinder(.27, .09, .49, .99, .34, '#ccb58c');
    this.box(.40, .022, .26, -.57, .967, .36, '#bc9b75', .03); this.plant(-3.0, 0, 1.48, .87);
    const pitcher = this.cylinder(.077, .24, -.61, 1.09, .06, '#cedacc'); this.interaction(pitcher, 'water'); this.cup(-.89, .95, .15);
    for (const x of [-.54, .73]) {
      const stool = new THREE.Group(); stool.position.set(x, 0, 1.51); this.environment.add(stool);
      this.cylinder(.23, .075, 0, .62, 0, oak, stool);
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; this.cylinder(.021, .58, Math.sin(a) * .17, .30, Math.cos(a) * .17, '#b19370', stool); }
      this.ring(.19, .011, x, .23, 1.51, '#b19370').rotation.x = Math.PI / 2;
    }
    this.pendant(-.53, .32); this.pendant(.92, .32);
    this.mother.group.position.set(.0, 0, -1.25); this.mother.group.rotation.y = Math.PI; this.father.group.position.set(1.68, 0, 1.7);
  }

  private bedroom() {
    this.rug(.25, .66, 4.63, 4.73); const bed = new THREE.Group(); bed.position.set(.22, 0, -.08); this.environment.add(bed);
    const oak = this.materials.wood('#c2a180', '#90714c'); this.box(2.44, .24, 2.93, 0, .28, 0, oak, .045, bed); this.box(2.43, .85, .17, 0, .89, -1.51, oak, .03, bed);
    this.box(2.3, .32, 2.8, 0, .54, 0, this.materials.fabric('#ece4ce'), .1, bed); this.box(2.3, .075, 1.86, 0, .74, .38, this.materials.fabric('#b1c0a0', true), .04, bed);
    for (const xx of [-.57, .57]) this.box(.76, .13, .49, xx, .79, -.99, this.materials.fabric('#f6ecda'), .06, bed);
    this.interaction(bed, 'rest'); this.table(-1.53, -.80, .35); this.lamp(-1.53, -.80, .62); this.table(1.98, -.8, .34); this.cup(1.98, .66, -.8);
    this.artPrint(-1.92, 2.40, -3.075); this.plant(2.68, 0, -2.45, 1);
    const basket = this.basket(-2.46, 0, 1.22); this.interaction(basket, 'laundry');
    const dresser = new THREE.Group(); dresser.position.set(-2.95, 0, -1.33); this.environment.add(dresser);
    this.box(.73, .93, 1.53, 0, .49, 0, oak, .03, dresser);
    for (const y of [.2, .47, .73]) { this.box(.018, .23, 1.36, .38, y, 0, '#d5c4a5', .01, dresser); this.ball(.027, .027, .027, .404, y, 0, '#b39570', dresser); }
    this.box(.80, .05, 1.60, 0, .98, 0, '#e3d8bf', .02, dresser);
    this.box(.69, .028, .55, .21, .80, 1.03, this.materials.fabric('#b7c3a7', true), .025, bed);
    this.box(.74, .25, .035, .21, .69, 1.5, this.materials.fabric('#b7c3a7', true), .02, bed);
    const journal = this.box(.30, .027, .40, -1.58, .68, -.83, '#d0b999', .01); this.interaction(journal, 'journal');
    this.mother.group.position.set(-1.33, 0, .72); this.mother.group.rotation.y = .48; this.father.group.position.set(2.56, 0, 1.73);
  }
  private bathroom() {
    this.box(7.15, .015, 6.49, 0, .012, .1, '#ddd8c1', .004);
    for (let x = -3.45; x < 3.5; x += .60) this.box(.01, .002, 6.45, x, .022, .1, '#c3c9b9', .001);
    for (let z = -3.0; z < 3.35; z += .60) this.box(7.1, .002, .01, 0, .022, z, '#c3c9b9', .001);
    const bath = new THREE.Group(); bath.position.set(-1.49, 0, -.38); this.environment.add(bath);
    this.box(1.10, .64, 2.36, 0, .38, 0, '#f4efde', .24, bath); this.box(.90, .025, 2.06, 0, .71, 0, '#c5dbd2', .19, bath); this.interaction(bath, 'bath');
    this.box(1.81, .83, .70, 1.15, .48, -2.47, '#c9b99a', .035); this.box(1.89, .07, .76, 1.15, .945, -2.47, '#efe7d0', .025);
    this.ball(.33, .08, .21, 1.15, 1.03, -2.47, '#f5eedb'); const mirror = this.cylinder(.59, .022, 1.15, 2.06, -3.06, '#b7ccc8'); mirror.rotation.x = Math.PI / 2;
    this.ring(.60, .025, 1.15, 2.06, -3.015, '#bca078');
    this.cylinder(.016, .27, 1.15, 1.12, -2.75, '#b99b70'); this.box(.12, .022, .025, 1.19, 1.26, -2.70, '#b99b70', .006);
    this.cylinder(.055, .15, 1.81, 1.07, -2.45, '#b6c4ae');
    for (const y of [.24, .49, .76]) this.box(1.62, .21, .025, 1.15, y, -2.09, '#dccdb2', .014);
    const washer = new THREE.Group(); washer.position.set(2.69, 0, .30); this.environment.add(washer);
    this.box(.83, .94, .78, 0, .49, 0, '#f0ece0', .055, washer); this.box(.70, .12, .02, 0, .83, .405, '#d5decb', .014, washer);
    const drum = this.cylinder(.245, .02, 0, .44, .419, '#82988b', washer); drum.rotation.x = Math.PI / 2;
    this.ring(.26, .042, 0, .44, .445, '#c6d2c1', washer); this.cylinder(.035, .018, .23, .84, .429, '#9eac99', washer).rotation.x = Math.PI / 2;
    this.interaction(washer, 'laundry'); this.basket(2.7, 0, 1.49);
    this.box(.52, .025, .37, 2.69, 1.0, .30, this.materials.fabric('#c2cbb4'), .02);
    this.rug(-.15, 1.48, 1.33, .77); this.foldedCloth(-2.21, .82, -.61, '#e5d4b9');
    const test = this.box(.25, .08, .18, 1.52, 1.01, -2.34, '#ece4cf', .014); if (this.state.chapter === 0) this.interaction(test, 'test');
    this.lamp(2.09, -1.33);
    this.plant(2.87, 0, -2.32, .94); this.mother.group.position.set(.1, 0, .96); this.father.group.position.set(2.51, 0, 2.8);
  }
  private terrace() {
    const view = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: this.texture(this.room === 'lakeside' ? 'lakeside-wide' : 'alpine-window') })); view.position.set(0, 3.1, -4.2); view.userData.ownedMaterial = true; this.environment.add(view);
    this.box(7.6, .10, 6.4, 0, -.04, .15, this.materials.wood('#bea17b', '#92714e'), .01);
    for (let i = 0; i < 25; i++) this.cylinder(.018, 1.03, -3.5 + i * .29, .56, -2.9, '#72847a'); this.box(7.2, .035, .042, 0, 1.10, -2.9, '#7c8d7e', .008);
    this.table(.2, .52, .65); this.chair(-.91, -.6, 'breathe'); this.chair(1.23, -.6, this.room === 'lakeside' ? 'lakesideWalk' : 'walk');
    this.cup(.1, .66, .52); this.cup(.47, .66, .52);
    for (const x of [-2.87, 2.84]) for (const z of [-1.9, 1.4]) this.plant(x, 0, z, .74);
    const planter = this.box(1.0, .31, .44, -2.36, .18, -.64, this.materials.wood('#c7a478', '#94704e'), .03); this.interaction(planter, this.room === 'lakeside' ? 'lakesideWalk' : 'plant');
    for (let i = 0; i < 5; i++) { const stem = this.cylinder(.008, .26, -2.70 + i * .17, .48, -.64, '#8c9d75'); this.ball(.065, .035, .065, stem.position.x, .63, -.64, i % 2 ? '#c9ad8c' : '#d4c19d'); }
    this.box(7.2, .055, .07, 0, 2.86, -2.86, '#c7b290', .009);
    for (let i = 0; i < 9; i++) { const bulb = this.ball(.035, .06, .035, -3.1 + i * .78, 2.68 - Math.sin(i / 8 * Math.PI) * .15, -2.84, '#f3deb1'); bulb.castShadow = false; }
    this.rug(.18, 1.19, 3.7, 2.56);
    this.mother.group.position.set(-.79, 0, .13); this.mother.group.rotation.y = .40; this.father.group.position.set(1.60, 0, 1.3);
  }

  private groceryProp(id: string, x: number, y: number, z: number, parent: THREE.Object3D) {
    if (id === 'fruit') {
      this.ball(.065, .072, .065, x, y + .07, z, '#be9776', parent); this.cylinder(.005, .04, x, y + .15, z, '#8b7450', parent);
    } else if (id === 'vegetables') {
      this.ball(.044, .13, .040, x, y + .06, z, '#c0a07b', parent).rotation.z = 1.2;
      this.ball(.018, .05, .025, x + .11, y + .10, z, '#9cad7b', parent).rotation.z = -1.1;
    } else if (id === 'milk') {
      this.cylinder(.055, .19, x, y + .10, z, '#eeead8', parent); this.cylinder(.038, .04, x, y + .22, z, '#97ac99', parent);
      this.box(.06, .05, .008, x, y + .10, z + .055, '#b9c9b1', .005, parent);
    } else if (id === 'bread') {
      const loaf = this.ball(.16, .063, .072, x, y + .06, z, '#c9a57b', parent);
      for (let i = 0; i < 3; i++) this.box(.015, .009, .07, x - .08 + i * .07, y + .12, z, '#ead2a7', .004, parent).rotation.y = -.3;
      loaf.rotation.y = .12;
    } else {
      this.cylinder(.074, .22, x, y + .11, z, '#d7c8a6', parent); this.cylinder(.079, .018, x, y + .23, z, '#b99a75', parent);
    }
  }

  private market() {
    const oak = this.materials.wood('#c29d76', '#896b46'), stand = new THREE.Group(); this.environment.add(stand);
    for (const x of [-2.9, 2.9]) this.box(.08, 2.57, .61, x, 1.34, -2.64, oak, .01, stand);
    for (const y of [.45, 1.05, 1.65, 2.25]) this.box(5.95, .065, .72, 0, y, -2.62, oak, .012, stand);
    GROCERY_PRODUCTS.forEach((product, i) => {
      const x = -2.30 + i * 1.14;
      for (const y of [.49, 1.09, 1.69]) {
        this.box(.97, .13, .49, x, y + .045, -2.51, '#ddcaac', .018, stand);
        for (let n = 0; n < 4; n++) this.groceryProp(product.id, x - .31 + n * .2, y + .13, -2.49, stand);
      }
      this.box(.56, .19, .013, x, 2.55, -2.32, '#ece5d0', .01, stand);
    });
    this.interaction(stand, 'groceries', [0, 1.85, -2.2]);
    const counter = new THREE.Group(); counter.position.set(.44, 0, .50); this.environment.add(counter);
    this.box(2.66, .86, 1.05, 0, .45, 0, '#c5cbb2', .035, counter); this.box(2.83, .075, 1.16, 0, .93, 0, oak, .025, counter);
    this.box(.47, .11, .35, .86, 1.04, 0, '#9ba992', .018, counter); this.box(.40, .32, .07, .86, 1.23, -.12, '#748777', .02, counter);
    this.basket(-.26, .98, .5); this.interaction(counter, 'groceries'); this.plant(-2.81, 0, 1.72, .91);
    this.artPrint(-2.25, 2.72, -3.07); this.artPrint(2.18, 2.72, -3.07); this.pendant(.48, .5);
  }

  private cafe() {
    const counter = new THREE.Group(); this.environment.add(counter);
    this.box(5.70, .93, .80, 0, .49, -2.57, '#b9c3aa', .025, counter); this.box(5.82, .08, .91, 0, 1.01, -2.57, this.materials.wood('#c5a27a', '#927049'), .025, counter);
    const machine = new THREE.Group(); machine.position.set(.05, 1.05, -2.56); this.environment.add(machine);
    this.box(.93, .49, .53, 0, .26, 0, '#c5c8b6', .045, machine); this.box(.84, .07, .54, 0, .04, .05, '#819389', .013, machine);
    for (const x of [-.23, .23]) { this.cylinder(.03, .12, x, .24, .22, '#a99879', machine); this.cup(x, .07, .27, machine); }
    this.interaction(machine, 'coffee');
    for (let i = 0; i < 4; i++) this.groceryProp('bread', -2.23 + i * .27, 1.07, -2.51, this.environment);
    this.chair(-1.1, .25, 'read'); this.chair(1.28, .25, 'talk'); this.table(.12, 1.20, .60); this.cup(-.05, .67, 1.20); this.cup(.30, .67, 1.20);
    this.artPrint(-2.14, 2.45, -3.06); this.artPrint(1.82, 2.45, -3.06); this.lamp(2.62, .47); this.pendant(.12, 1.20); this.rug(.1, .77, 3.76, 2.61);
  }

  private clinic() {
    const bed = new THREE.Group(); bed.position.set(1.30, 0, -.38); this.environment.add(bed);
    this.box(1.46, .22, 2.33, 0, .49, 0, '#bbcbbd', .065, bed); this.box(1.34, .19, 2.19, 0, .69, 0, this.materials.fabric('#eee6d4'), .075, bed);
    this.box(1.28, .11, 1.41, 0, .83, .28, this.materials.fabric('#b4c6b5'), .04, bed); this.box(.96, .11, .45, 0, .86, -.79, '#f4eddc', .065, bed);
    for (const x of [-.78, .78]) { this.box(.035, .035, 1.91, x, .98, 0, '#c1bba5', .009, bed); for (const z of [-.77, .77]) this.box(.035, .34, .035, x, .80, z, '#c1bba5', .007, bed); }
    for (const x of [-.54, .54]) for (const z of [-.88, .88]) this.cylinder(.038, .47, x, .24, z, '#b6c1b3', bed);
    this.interaction(bed, this.state.pregnancy.born ? 'skin' : 'scan');
    const monitor = new THREE.Group(); monitor.position.set(-1.24, 0, -.79); this.environment.add(monitor);
    this.box(.63, .62, .54, 0, .58, 0, '#d5ddce', .04, monitor); this.box(.76, .06, .61, 0, .95, 0, '#bbc8b9', .018, monitor);
    this.box(.80, .54, .06, 0, 1.39, -.19, '#627b72', .03, monitor);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 160; const context = canvas.getContext('2d')!;
    context.fillStyle = '#25443d'; context.fillRect(0, 0, 256, 160); context.strokeStyle = '#a2c4a5'; context.lineWidth = 2; context.beginPath();
    for (let x = 0; x < 256; x++) { const spike = x % 61, y = 98 + (spike > 22 && spike < 33 ? -Math.sin((spike - 22) / 11 * Math.PI) * 34 : Math.sin(x * .25) * 2); if (!x) context.moveTo(x, y); else context.lineTo(x, y); }
    context.stroke(); context.fillStyle = '#d7e6ce'; context.font = '18px sans-serif'; context.fillText('ANACAN', 14, 30);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.69, .42), new THREE.MeshBasicMaterial({ map: texture })); screen.position.set(-1.24, 1.4, -.94); screen.userData.ownedMaterial = true; screen.userData.ownedTexture = true; this.environment.add(screen);
    this.interaction(monitor, 'scan'); this.chair(-2.35, 1.20, 'checkup'); this.artPrint(-2.04, 2.53, -3.07); this.artPrint(1.64, 2.53, -3.07);
    this.box(1.80, .76, .60, -.3, .42, -2.65, '#d5dbc8', .025); this.box(1.88, .055, .68, -.3, .83, -2.65, '#e9e1c9', .016);
    const seat = this.box(.62, .46, .68, 2.59, .30, 1.66, '#afc2b5', .12); this.interaction(seat, 'carseat');
    this.lamp(2.71, -1.69); this.rug(0, 1.22, 1.03, 2.33);
  }

  private updateHousehold() {
    const visuals = householdVisuals(this.state), key = JSON.stringify([this.room, visuals]);
    this.renderer.domElement.dataset.pantry = String(Object.values(this.state.household.groceries).reduce((n, count) => n + count, 0));
    this.renderer.domElement.dataset.dirty = String(this.state.household.laundry.dirty);
    this.renderer.domElement.dataset.folded = String(this.state.household.laundry.folded);
    this.renderer.domElement.dataset.dust = String(visuals.dust);
    if (key === this.visualKey) return;
    this.visualKey = key; this.clearGroup(this.household); this.household.clear();
    if (this.room === 'kitchen') {
      GROCERY_PRODUCTS.forEach((product, i) => {
        for (let n = 0; n < visuals.pantry[product.id]; n++) {
          if (product.id === 'fruit') this.groceryProp(product.id, .49 + Math.sin(n * 2.8) * .15, 1.01 + (n > 3 ? .05 : 0), .34 + Math.cos(n * 2.8) * .13, this.household);
          else if (product.id === 'vegetables') this.groceryProp(product.id, -.60 + n % 3 * .12, .98 + Math.floor(n / 3) * .055, .38, this.household);
          else this.groceryProp(product.id, -2.87 + Math.floor(n / 3) * .18, .76 + (i - 2) * .57, -1.27 + n % 3 * .22, this.household);
        }
      });
    }
    if (this.room === 'bedroom' || this.room === 'bathroom') {
      const x = this.room === 'bedroom' ? -2.46 : 2.7, z = this.room === 'bedroom' ? 1.22 : 1.49;
      for (let n = 0; n < visuals.dirty; n++) this.ball(.14, .035, .11, x + Math.sin(n * 2) * .1, .41 + n * .032, z + Math.cos(n * 2) * .10, this.materials.fabric(n % 2 ? '#acb99e' : '#e9dfc6'), this.household).rotation.z = Math.sin(n) * .2;
      for (let n = 0; n < visuals.folded; n++) this.foldedCloth(this.room === 'bedroom' ? -2.91 : 2.71, 1.04 + n * .049, this.room === 'bedroom' ? -1.22 : .30, n % 2 ? '#c0cbb3' : '#e7dcc5', this.household);
    }
    if (['living', 'kitchen', 'nursery', 'bedroom'].includes(this.room)) {
      const spots = [[-.79, 1.30], [1.04, 2.20], [-1.43, .60], [2.52, .77], [-2.19, 2.33], [.40, 2.56]];
      spots.slice(0, visuals.dust).forEach(([x, z], i) => {
        const dust = this.box(.17 + i % 2 * .06, .004, .13, x, .044, z, '#c4b59a', .012, this.household); dust.rotation.y = i * .7; dust.userData.activity = 'clean'; dust.castShadow = false;
      });
    }
  }

  private updateDecor() {
    const placements = this.state.location === 'home' ? this.state.placements.filter(p => roomAt(p.x, p.z) === this.room) : [];
    const key = JSON.stringify(placements); if (key === this.decorKey) return;
    this.decorKey = key; this.clearGroup(this.decor); this.decor.clear();
    placements.forEach((placement, i) => {
      const item = FURNITURE.find(item => item.id === placement.itemId)!;
      const group = new THREE.Group(); group.position.set(2.72 - i * .72, .02, 2.38); group.rotation.y = placement.rotation; this.decor.add(group);
      if (item.kind === 'rug') this.box(1.42, .014, 1.10, 0, .002, 0, this.materials.rug(item.colour, '#ede5d0', 'dots'), .035, group);
      else if (item.kind === 'lamp') { this.cylinder(.16, .035, 0, .06, 0, '#bea57f', group); this.cylinder(.013, .83, 0, .48, 0, '#bba17b', group); this.ball(.23, .24, .17, 0, 1.08, 0, item.colour, group); }
      else if (item.kind === 'ottoman') this.cylinder(.29, .37, 0, .21, 0, this.materials.fabric(item.colour, true), group);
      else if (item.kind === 'toy') for (let n = 0; n < 4; n++) this.ring(.28 - n * .055, .023, 0, .13, 0, ['#c4a589', '#d3bd94', '#a9bb9d', '#b9c4b2'][n], group);
      else if (item.kind === 'shelf') { for (const x of [-.33, .33]) this.box(.04, 1.11, .39, x, .57, 0, item.colour, .01, group); for (const y of [.12, .56, 1.10]) this.box(.71, .04, .39, 0, y, 0, item.colour, .01, group); }
      else { this.cylinder(.13, .23, 0, .14, 0, '#c5ad88', group); for (let n = 0; n < 7; n++) this.ball(.071, item.kind === 'plant' ? .17 : .05, .03, Math.sin(n * 2.4) * .15, .38 + n * .055, Math.cos(n * 2.4) * .15, item.colour, group); }
    });
    this.renderer.domElement.dataset.decor = String(placements.length);
  }

  private updateFamily() {
    const family = interiorFamily(this.state, this.room), active = this.state.activity?.id;
    const seated = ['rest', 'feed', 'read', 'skin', 'soothe', 'scan', 'birth'].includes(family.motherActivity ?? '');
    const poses: Record<Room, [number, number, number, number]> = {
      living: [.18, .21, -.21, .02], nursery: seated ? [1.30, .21, .33, -.22] : [.55, 0, .79, -.34],
      kitchen: [0, 0, -1.28, Math.PI], bedroom: [-1.34, 0, .60, .45], bathroom: [.10, 0, .96, -.35],
      garden: [-.79, seated ? .21 : 0, .13, .4], lakeside: [-.79, 0, .13, .4],
      market: [.14, 0, 1.61, Math.PI], cafe: [-1.1, .21, .33, .18], clinic: [1.27, .28, -.22, .05],
    };
    const pose = [...poses[this.room]];
    if (this.room === 'living' && active && !seated) pose.splice(0, 4, -.46, 0, .83, -.56);
    if (this.room === 'bedroom' && active === 'rest') pose.splice(0, 4, -.30, .20, .06, .04);
    if (this.room === 'bedroom' && active === 'laundry') pose.splice(0, 4, -1.81, 0, 1.17, -Math.PI / 2);
    if (this.room === 'bathroom' && active === 'laundry') pose.splice(0, 4, 1.98, 0, .42, Math.PI / 2);
    if (this.room === 'bathroom' && active === 'test') pose.splice(0, 4, .96, 0, -1.54, Math.PI);
    if (this.room === 'kitchen' && active === 'water') pose.splice(0, 4, -.55, 0, -.63, 0);
    if (this.room === 'nursery' && active === 'diaper') pose.splice(0, 4, .86, 0, -1.51, Math.PI);
    if (this.room === 'nursery' && active === 'assemble') pose.splice(0, 4, -1.30, 0, -.20, -Math.PI / 2);
    this.mother.group.position.set(pose[0], pose[1], pose[2]); this.mother.group.rotation.y = pose[3];
    this.mother.setPregnant(this.state.pregnancy.born ? false : simulationWeek(this.state)); this.mother.setChildPresent(this.state.pregnancy.born);
    this.mother.setActivity(family.motherActivity); this.mother.setSitting(seated && !(this.room === 'bedroom' && active !== 'rest'));
    this.father.group.visible = family.fatherVisible;
    const fatherPoses: Record<Room, [number, number, number, number]> = {
      living: [1.89, 0, .29, -.77], nursery: [-.46, 0, .38, .67], kitchen: [1.92, 0, 1.54, -.55], bedroom: [2.28, 0, 1.52, -.55],
      bathroom: [0, 0, 0, 0], garden: [1.51, 0, 1.30, -.85], lakeside: [1.51, 0, 1.30, -.85],
      market: [2.18, 0, 1.61, -.73], cafe: [1.28, .21, .33, -.25], clinic: [2.50, 0, .63, -.63],
    };
    const father = fatherPoses[this.room]; this.father.group.position.set(father[0], father[1], father[2]); this.father.group.rotation.y = father[3];
    this.father.setSitting(this.room === 'cafe'); this.father.setActivity(active === 'help' || active === 'talk' ? 'talk' : null);
    this.baby.visible = family.childVisible && family.stage === 'newborn'; this.sittingBaby.visible = family.childVisible && family.stage === 'sitting'; this.toddler.visible = family.childVisible && family.stage === 'toddler';
    this.baby.position.set(this.room === 'nursery' ? -2.25 : .08, this.room === 'nursery' ? .72 : .23, this.room === 'nursery' ? -.58 : 1.71); this.baby.rotation.x = -Math.PI / 2;
    if (active === 'diaper' && this.room === 'nursery') this.baby.position.set(.86, 1.15, -2.45);
    for (const child of [this.sittingBaby, this.toddler]) { child.position.set(-.24, .07, 1.71); child.rotation.y = .24; }
    this.crib.visible = family.cribReady; this.cribParts.visible = !family.cribReady;
    this.doctor.group.visible = this.room === 'clinic'; this.doctor.group.position.set(-1.63, 0, .56); this.doctor.group.rotation.y = .96; this.doctor.setActivity(active ? 'talk' : null);
    let partner = this.interactables.find(i => i.mesh === this.father.group);
    if (!partner && family.fatherVisible) { this.interaction(this.father.group, 'talk', [father[0], 2.06 + father[1], father[2]]); partner = this.interactables.at(-1); }
    partner?.anchor.set(father[0], 2.06 + father[1], father[2]);
    this.renderer.domElement.dataset.family = this.state.pregnancy.born ? family.stage : 'pregnancy';
    this.renderer.domElement.dataset.holding = String(family.holding);
  }

  setRoom(room: Room) { if (room === this.room) return; this.room = room; this.rebuildRoom(); this.update(this.state); }
  update(state: GameState) {
    this.state = state;
    if (this.structureKey !== `${this.room}:${state.pregnancy.born}:${state.chapter >= 6}`) this.rebuildRoom();
    const key = JSON.stringify(state.avatar);
    if (key !== this.avatarKey) {
      for (const object of [this.mother.group, this.father.group, this.baby, this.sittingBaby, this.toddler]) { this.scene.remove(object); this.clearGroup(object); }
      this.interactables = this.interactables.filter(i => i.mesh !== this.father.group);
      this.mother = new Character(this.materials, state.avatar); this.father = new Character(this.materials, state.avatar, true);
      this.baby = makeBaby(this.materials, state.avatar.skin, '#eee4d2'); this.sittingBaby = makeChild(this.materials, state.avatar.skin); this.toddler = makeChild(this.materials, state.avatar.skin, true);
      this.scene.add(this.mother.group, this.father.group, this.baby, this.sittingBaby, this.toddler); this.avatarKey = key;
    }
    this.updateFamily(); this.updateHousehold(); this.updateDecor();
    this.renderer.domElement.dataset.room = this.room;
  }
  setPaused(value: boolean) { this.paused = value; }
  setVisible(value: boolean) { this.visible = value; }
  capture(): string {
    this.renderer.render(this.scene, this.camera);
    const canvas = document.createElement('canvas'), source = this.renderer.domElement, scale = Math.min(1, 1200 / Math.max(source.width, source.height));
    canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale);
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', .78);
  }
  private resize() {
    const w = this.element.clientWidth, h = this.element.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.fov = w < h * 1.1 ? 49 : 43; this.camera.updateProjectionMatrix();
  }
  private down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const point = { x: event.clientX, y: event.clientY }; this.controls.set(event.pointerId, point); this.lastPointer = point;
    if (this.controls.size === 1) { this.pointerStart = point; this.moved = false; }
    this.renderer.domElement.setPointerCapture(event.pointerId);
    if (this.controls.size >= 2) { const [a, b] = [...this.controls.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); this.moved = true; }
  };
  private move = (event: PointerEvent) => {
    if (!this.controls.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY }; this.controls.set(event.pointerId, point);
    if (this.controls.size >= 2) {
      const [a, b] = [...this.controls.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch && distance > 1) this.distance = THREE.MathUtils.clamp(this.distance * this.pinch / distance, 5.9, 10.5);
      this.pinch = distance; this.moved = true;
    } else if (Math.hypot(point.x - this.pointerStart.x, point.y - this.pointerStart.y) > 6) {
      this.targetAngle = THREE.MathUtils.clamp(this.targetAngle - (point.x - this.lastPointer.x) * .004, -.45, .55);
      this.elevation = THREE.MathUtils.clamp(this.elevation + (point.y - this.lastPointer.y) * .005, 1.9, 3.7); this.moved = true;
    }
    this.lastPointer = point;
  };
  private up = (event: PointerEvent) => {
    if (!this.controls.has(event.pointerId)) return;
    this.controls.delete(event.pointerId); if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
    if (!this.moved && this.controls.size === 0) {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1), this.camera);
      const allowed = availableActivities(this.state);
      const hit = this.ray.intersectObjects([...this.environment.children, ...this.household.children, this.father.group], true).find(hit => {
        if (!allowed.some(a => a.id === hit.object.userData.activity)) return false;
        for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
        return true;
      });
      if (hit) this.callbacks.onActivity(hit.object.userData.activity);
    }
    this.pinch = 0;
    const remaining = [...this.controls.values()][0]; if (remaining) { this.lastPointer = remaining; this.pointerStart = remaining; }
  };
  private cancel = (event: PointerEvent) => { this.controls.delete(event.pointerId); this.moved = true; this.pinch = 0; };
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.distance = THREE.MathUtils.clamp(this.distance + (event.deltaY > 0 ? .35 : -.35), 5.9, 10.5); };
  private contextLost = (event: Event) => { event.preventDefault(); this.suspended = true; };
  private contextRestored = () => { this.suspended = false; this.resize(); };

  private projectPositions() {
    const width = this.element.clientWidth, height = this.element.clientHeight, positions: Partial<Record<ActivityId, InteriorPosition>> = {};
    for (const item of this.interactables) {
      let visible = true; for (let object: THREE.Object3D | null = item.mesh; object; object = object.parent) if (!object.visible) visible = false;
      if (!visible || positions[item.id]?.visible) continue;
      const projected = item.anchor.clone().project(this.camera), x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      positions[item.id] = { x, y, visible: projected.z < 1 && projected.z > -1 && x > 25 && x < width - 25 && y > 24 && y < height - 25 };
    }
    const allowed = availableActivities(this.state), step = currentStep(this.state);
    const pins = Object.entries(positions).filter(([id, position]) => position.visible && allowed.some(a => a.id === id))
      .map(([id, position]) => ({ id: id as ActivityId, x: position.x, y: position.y }))
      .sort((a, b) => Number(b.id === step?.action) - Number(a.id === step?.action));
    const next = Object.fromEntries(layoutInteriorPins(pins, width, height).map(pin => [pin.id, { x: Math.round(pin.x * 10) / 10, y: Math.round(pin.y * 10) / 10, visible: true }]));
    const key = JSON.stringify(next); if (key !== this.pinKey) { this.pinKey = key; this.callbacks.onPositions(next); }
  }
  private animate = () => {
    if (this.disposed) return; this.frame = requestAnimationFrame(this.animate); const dt = Math.min(.08, this.clock.getDelta());
    if (!this.visible || document.hidden || this.suspended) return; if (!this.paused) this.t += dt;
    this.angle = THREE.MathUtils.lerp(this.angle, this.targetAngle, this.state.settings.reducedMotion ? 1 : .12);
    this.camera.position.set(Math.sin(this.angle) * this.distance, this.elevation, Math.cos(this.angle) * this.distance); this.camera.lookAt(this.target);
    const light = interiorLight(this.state); this.sunlight.intensity = .22 + light.daylight * 3.7; this.ambient.intensity = .82 + light.daylight * 1.12;
    this.sunlight.color.set(light.warm ? '#ffe3b0' : '#fff3d5'); this.ambient.color.set(this.state.household.weather === 'rain' ? '#e5eef0' : '#fff4df');
    this.lights.forEach(lamp => { lamp.intensity = .35 + light.lamps * 2.35; });
    for (const character of [this.mother, this.father, this.doctor]) character.animate(this.paused ? 0 : dt, this.state.settings.reducedMotion);
    this.points.visible = !this.state.settings.reducedMotion && light.daylight > .15;
    if (!this.state.settings.reducedMotion && !this.paused) {
      this.points.rotation.y = this.t * .013; this.environment.children.filter(o => o.userData.mobile).forEach(o => { o.rotation.y = Math.sin(this.t * .28) * .15; });
      if (this.sittingBaby.visible) this.sittingBaby.rotation.y = .24 + Math.sin(this.t * .9) * .05;
      if (this.toddler.visible) { this.toddler.position.x = -.24 + Math.sin(this.t * .35) * .22; this.toddler.userData.legs.forEach((leg: THREE.Group, i: number) => { leg.rotation.x = Math.sin(this.t * 3 + i * Math.PI) * .10; }); }
    }
    this.renderer.render(this.scene, this.camera);
    if (!this.ready) { this.ready = true; this.renderer.domElement.dataset.ready = 'true'; this.callbacks.onReady(); }
    const now = performance.now(); if (now - this.lastPositions > 150) {
      this.lastPositions = now; this.projectPositions(); this.renderer.domElement.dataset.camera = `${this.angle.toFixed(2)}:${this.elevation.toFixed(2)}:${this.distance.toFixed(2)}`;
      this.renderer.domElement.dataset.daylight = light.daylight.toFixed(2);
    }
  };
  private clearGroup(group: THREE.Object3D) {
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return; object.geometry.dispose();
      if (object.userData.ownedMaterial) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (object.userData.ownedTexture) (material as THREE.MeshBasicMaterial).map?.dispose(); material.dispose();
      }
    });
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.down); canvas.removeEventListener('pointermove', this.move); canvas.removeEventListener('pointerup', this.up); canvas.removeEventListener('pointercancel', this.cancel);
    canvas.removeEventListener('wheel', this.wheel); canvas.removeEventListener('webglcontextlost', this.contextLost); canvas.removeEventListener('webglcontextrestored', this.contextRestored);
    this.clearGroup(this.scene); this.materials.dispose(); this.textures.forEach(texture => texture.dispose()); this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose();
    this.renderer.dispose(); canvas.remove();
  }
}
