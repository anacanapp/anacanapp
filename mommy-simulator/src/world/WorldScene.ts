import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Materials } from './materials';
import { Character, makeBaby, makeChild } from './character';
import { buildClinic } from './clinic';
import { simulationWeek } from '../game/progression';
import { CHAPTERS, FURNITURE } from '../game/content';
import { OBJECTS, PLACEMENT_SPOTS, canPlace, findPath, roomAt, walkable, worldObjects, type Point } from '../game/navigation';
import type { GameState, Placement, Room } from '../game/types';

export interface WorldCallbacks {
  onObject(id: string): void;
  onFloor(point: Point): void;
  onPositions(positions: Record<string, { x: number; y: number; visible: boolean }>): void;
  onReady(): void;
}

const THEME = {
  lavender: { wall: '#e6dbea', sofa: '#b5a2c9', nursery: '#eae1ee', rug: '#d4bedc' },
  peach: { wall: '#f1dfd3', sofa: '#d5a6a0', nursery: '#f0e5d6', rug: '#e6c1b0' },
  sage: { wall: '#dde7db', sofa: '#a7beb0', nursery: '#e3ecdc', rug: '#c0d5c4' },
};

export class WorldScene {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
  private renderer: THREE.WebGLRenderer;
  private materials = new Materials();
  private content = new THREE.Group();
  private furniture = new THREE.Group();
  private trees: THREE.Group[] = [];
  private themedWalls: THREE.Mesh[] = [];
  private themedSofa: THREE.Mesh[] = [];
  private mother: Character;
  private partner: Character;
  private cribBaby: THREE.Group;
  private playBaby: THREE.Group;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.22);
  private sun: THREE.DirectionalLight;
  private ambient: THREE.HemisphereLight;
  private ring: THREE.Mesh;
  private hearts: THREE.Group;
  private fireflies = new THREE.Group();
  private points: Point[] = [];
  private arrived?: () => void;
  private state: GameState;
  private avatarKey: string;
  private themeKey: string;
  private placementKey = '';
  private angle = .36;
  private targetAngle = .36;
  private zoom = 1;
  private targetZoom = 1;
  private focus = new THREE.Vector3(0, .2, .75);
  private targetFocus = new THREE.Vector3(0, .2, .75);
  private tick = 0;
  private last = 0;
  private overlayTime = 0;
  private frame = 0;
  private disposed = false;
  private paused = false;
  private visible = true;
  private pointers = new Map<number, { x: number; y: number }>();
  private pointerStart = { x: 0, y: 0 };
  private lastPointer = { x: 0, y: 0 };
  private moved = false;
  private pinch = 0;
  private selected: string | null = null;
  private photoMode = false;
  private placing: string | null = null;
  private clock = new THREE.Group();
  private resizeObserver: ResizeObserver;
  private staticContent = new THREE.Group();
  private clinic = new THREE.Group();
  private doctor: Character;
  private homeObjects: THREE.Object3D[] = [];
  private birthBaby: THREE.Group;
  private toddler: THREE.Group;
  private locationKey = '';
  private preparedCrib = new THREE.Group();
  private cribParts = new THREE.Group();
  private packedBag = new THREE.Group();
  private sittingBaby: THREE.Group;
  private livedIn = new THREE.Group();
  private poseKey: string | null = null;
  private standingPosition?: THREE.Vector3;

  constructor(private element: HTMLDivElement, state: GameState, private callbacks: WorldCallbacks) {
    this.state = state; this.avatarKey = JSON.stringify(state.avatar); this.themeKey = state.theme;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor('#edf0e4', 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Mommy Simulator 3D world');
    this.renderer.domElement.setAttribute('data-testid', 'world-canvas');
    this.renderer.domElement.style.touchAction = 'none'; this.element.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog('#edf0e4', 35, 65);
    this.ambient = new THREE.HemisphereLight('#fff3e6', '#b7bacb', 1.5); this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#ffe8c2', 3.0); this.sun.position.set(-7, 14, 6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.camera.left = -13; this.sun.shadow.camera.right = 13;
    this.sun.shadow.camera.top = 13; this.sun.shadow.camera.bottom = -13; this.sun.shadow.camera.far = 40;
    this.sun.shadow.bias = -.0005; this.sun.shadow.normalBias = .025; this.scene.add(this.sun);
    const fill = new THREE.DirectionalLight('#e3e9ff', .70); fill.position.set(8, 8, -5); this.scene.add(fill);
    this.scene.add(this.content, this.furniture);
    this.buildGround(); this.buildHouse(); this.buildKitchen(); this.buildLiving(); this.buildNursery(); this.buildBathroom(); this.buildGarden();
    this.mother = new Character(this.materials, state.avatar); this.mother.group.position.set(-1.15, .235, 1.3);
    this.mother.group.rotation.y = .4; this.content.add(this.mother.group);
    this.partner = new Character(this.materials, { ...state.avatar, skin: '#e3ae87', hair: '#53372e' }, true);
    this.partner.group.position.set(-.8, .235, 2.4); this.partner.group.rotation.y = -.8;
    this.tag(this.partner.group, 'partner'); this.content.add(this.partner.group);
    this.cribBaby = makeBaby(this.materials, state.avatar.skin); this.cribBaby.rotation.x = -Math.PI / 2;
    this.cribBaby.position.set(3.95, .83, -.7); this.cribBaby.scale.setScalar(.85); this.content.add(this.cribBaby);
    this.playBaby = makeBaby(this.materials, state.avatar.skin, '#c6d7bd', false); this.playBaby.position.set(1.38, .26, 1.45);
    this.playBaby.scale.setScalar(1.0); this.content.add(this.playBaby);
    this.tag(this.cribBaby, 'crib'); this.tag(this.playBaby, 'playmat');
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.38, .47, 40), new THREE.MeshBasicMaterial({ color: '#fbe7b2', opacity: .85, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .25; this.ring.visible = false; this.content.add(this.ring);
    this.hearts = this.makeHearts(); this.content.add(this.hearts);
    this.mergeStaticMeshes();
    const dynamicObjects = new Set<THREE.Object3D>([this.mother.group, this.partner.group, this.hearts, this.ring]);
    this.homeObjects = this.content.children.filter(o => !dynamicObjects.has(o));
    this.clinic = buildClinic(this.materials); this.content.add(this.clinic);
    this.doctor = new Character(this.materials, { ...state.avatar, skin: '#e3ae87', hair: '#3c312a', hairstyle: 'bob', outfitStyle: 'casual' }, false, true);
    this.doctor.group.position.set(-3.8, .26, .6); this.doctor.group.rotation.y = .8; this.clinic.add(this.doctor.group);
    this.birthBaby = makeBaby(this.materials, state.avatar.skin, '#e4d5bb'); this.birthBaby.position.set(1.3, 1.15, 3.15); this.birthBaby.rotation.x = -Math.PI / 2; this.birthBaby.scale.setScalar(.8); this.clinic.add(this.birthBaby);
    this.toddler = makeChild(this.materials, state.avatar.skin, true); this.toddler.position.set(1.4, .31, 1.65); this.content.add(this.toddler);
    this.sittingBaby = makeChild(this.materials, state.avatar.skin, false); this.sittingBaby.position.set(1.4, .31, 1.6); this.content.add(this.sittingBaby);
    this.buildProgressProps();
    this.update(state);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.cancelPointer);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(element); this.resize();
    this.frame = requestAnimationFrame(this.animate); this.callbacks.onReady();
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.content) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  private box(w: number, h: number, d: number, x: number, y: number, z: number, colour: string | THREE.Material, radius = .04, parent: THREE.Object3D = this.content) {
    const material = typeof colour === 'string' ? this.materials.colour(colour) : colour;
    return this.mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), material, x, y, z, parent);
  }
  private sphere(rx: number, ry: number, rz: number, x: number, y: number, z: number, colour: string, parent: THREE.Object3D = this.content) {
    const m = this.mesh(new THREE.SphereGeometry(1, 16, 12), this.materials.colour(colour), x, y, z, parent); m.scale.set(rx, ry, rz); return m;
  }
  private cylinder(top: number, bottom: number, h: number, x: number, y: number, z: number, colour: string | THREE.Material, parent: THREE.Object3D = this.content, segments = 20) {
    return this.mesh(new THREE.CylinderGeometry(top, bottom, h, segments), typeof colour === 'string' ? this.materials.colour(colour) : colour, x, y, z, parent);
  }
  private tag(group: THREE.Object3D, id: string) { group.traverse(o => { o.userData.interactive = id; }); }
  private group() { const g = new THREE.Group(); this.content.add(g); return g; }
  private leg(x: number, z: number, height: number, parent: THREE.Object3D = this.content) {
    this.cylinder(.04, .055, height, x, .24 + height / 2, z, '#b9926e', parent, 8);
  }

  private plant(x: number, z: number, size: number, parent: THREE.Object3D = this.content, pot = '#d6b396') {
    const g = new THREE.Group(); g.position.set(x, .23, z); g.scale.setScalar(size); parent.add(g);
    this.cylinder(.21, .16, .32, 0, .17, 0, pot, g);
    this.cylinder(.21, .21, .035, 0, .337, 0, '#755746', g);
    this.cylinder(.025, .03, .8, 0, .71, 0, '#967657', g, 7);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39, r = .12 + (i % 3) * .025, h = .52 + i * .065;
      const leaf = this.sphere(.1, .21, .06, Math.cos(a) * r, h, Math.sin(a) * r, i % 2 ? '#9bbfa0' : '#81a78e', g);
      leaf.rotation.set(Math.sin(a) * .7, -a, Math.cos(a) * .7);
    }
    return g;
  }

  private flowers(x: number, y: number, z: number, parent: THREE.Object3D = this.content, colour = '#deb8d2') {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    this.cylinder(.11, .075, .25, 0, .12, 0, '#ece1cd', g);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, r = .09;
      this.cylinder(.008, .008, .25, Math.cos(a) * r, .34, Math.sin(a) * r, '#90a785', g, 5);
      this.sphere(.07, .055, .065, Math.cos(a) * r, .48 + (i % 2) * .025, Math.sin(a) * r, colour, g);
      this.sphere(.025, .025, .025, Math.cos(a) * r, .515 + (i % 2) * .025, Math.sin(a) * r, '#efd79a', g);
    }
    return g;
  }

  private buildGround() {
    const grass = this.materials.colour('#c4d6bd');
    this.box(14.8, .62, 14.0, 0, -.4, 1.0, '#d4c3b7', .3);
    this.box(14.65, .13, 13.85, 0, -.04, 1.0, grass, .2);
    // Stepping stones and a gently raised home foundation.
    for (let i = 0; i < 7; i++) this.box(.82, .05, .56, .18 + Math.sin(i) * .1, .055, 3.55 + i * .56, '#ede5d8', .13);
    this.box(10.9, .37, 7.85, 0, .02, -.23, '#dbcdbf', .12);
    this.box(10.75, .08, 7.7, 0, .22, -.23, '#f1e4d4', .03);
    // A quiet path around the house.
    for (let i = 0; i < 15; i++) {
      this.box(.6, .045, .72, -5.8, .025, -3.9 + i * .64, '#dfdacb', .08);
      this.box(.6, .045, .72, 5.8, .025, -3.9 + i * .64, '#dfdacb', .08);
    }
    this.content.add(this.fireflies);
    for (let i = 0; i < 15; i++) {
      const m = this.sphere(.022, .022, .022, Math.sin(i * 4) * 6, .8 + i % 3 * .3, 4 + Math.cos(i * 3) * 2, '#f6e3a7', this.fireflies);
      m.material = new THREE.MeshBasicMaterial({ color: '#ffdda0' });
    }
  }

  private buildHouse() {
    const wood = this.materials.wood('#e5c7aa', '#9b7354'), whiteWood = this.materials.wood('#eee0cb', '#b49c7c');
    this.box(5.2, .055, 4.1, -2.65, .267, 1.28, wood, .01);
    this.box(5.2, .055, 3.0, -2.65, .267, -2.35, whiteWood, .01);
    this.box(5.2, .055, 5.2, 2.65, .267, .72, wood, .01);
    this.box(5.2, .055, 2.05, 2.65, .267, -3.08, '#d2dfd9', .01);
    // Bathroom tile lines.
    for (let x = .1; x < 5.2; x += .5) this.box(.012, .007, 2.03, x, .3, -3.08, '#bfcfc8', 0);
    for (let z = -4.02; z < -2.05; z += .5) this.box(5.1, .007, .012, 2.65, .3, z, '#bfcfc8', 0);
    const wall = THEME[this.state.theme].wall;
    this.themedWalls.push(this.box(10.75, 2.9, .17, 0, 1.7, -4.14, wall, .025));
    this.themedWalls.push(this.box(.17, 2.9, 7.65, -5.33, 1.7, -.23, wall, .025));
    this.themedWalls.push(this.box(.17, 1.05, 7.65, 5.33, .78, -.23, wall, .025));
    // Exposed edges of the cutaway walls.
    this.box(.22, .09, 7.65, 5.33, 1.34, -.23, '#faf3e9', .02);
    this.box(.22, .09, 7.65, -5.33, 3.18, -.23, '#faf3e9', .02);
    this.box(10.75, .09, .22, 0, 3.18, -4.14, '#faf3e9', .02);
    this.box(10.8, .09, .08, 0, .38, -4.015, '#faf3e9', .01);
    this.box(.08, .10, 7.65, -5.21, .38, -.23, '#faf3e9', .01);
    this.box(.15, .73, 3.5, .05, .64, -2.25, wall, .02);
    this.box(.15, .73, 1.35, .05, .64, 2.6, wall, .02);
    this.box(.22, .055, 3.5, .05, 1.035, -2.25, '#fff6eb', .01);
    this.box(2.45, .73, .16, 3.65, .64, -2.15, '#d9e4dc', .02);
    // Wainscoting on the rear wall and the side.
    for (let x = -4.95; x < 5.1; x += .57) this.box(.025, .7, .03, x, .78, -4.035, '#faf0e5', .005);
    this.box(10.4, .055, .04, 0, 1.14, -4.03, '#fff6ea', .005);
    for (let z = -3.9; z < 3.2; z += .57) this.box(.03, .7, .025, -5.22, .78, z, '#faf0e5', .005);
    this.window(-2.55, -4.015, 1.65, 1.05); this.window(3.13, -4.015, 1.8, 1.0);
    this.art(-5.19, 1.9, 1.15, .72, .92, true, '#b9c5b4');
    this.art(.75, 2.2, -4.02, .55, .72, false, '#eac2a8');
    // A hand-painted growth chart near the nursery.
    this.box(.12, 1.8, .03, 4.97, 1.52, -4.035, '#cba582', .01);
    for (let i = 0; i < 12; i++) this.box(i % 3 ? .06 : .10, .012, .035, 4.95, .7 + i * .125, -4.01, '#fff0db', .002);
    // Warm pools of sunlight, without large transparent shadow receivers.
    const sunlight = new THREE.MeshBasicMaterial({ color: '#fff2cf', transparent: true, opacity: .16, depthWrite: false });
    const pool = this.mesh(new THREE.PlaneGeometry(1.6, 1.5), sunlight, 2.6, .306, -1.9); pool.rotation.x = -Math.PI / 2; pool.rotation.z = .2;
  }

  private window(x: number, z: number, w: number, h: number) {
    const y = 2.15;
    this.box(w + .18, h + .18, .07, x, y, z, '#fff9f0', .02);
    this.box(w, h, .06, x, y, z + .05, '#cadde0', .02);
    this.box(.065, h, .1, x, y, z + .08, '#fff9f0', .008);
    this.box(w, .065, .1, x, y, z + .08, '#fff9f0', .008);
    this.box(w + .26, .1, .27, x, y - h / 2 - .04, z + .09, '#faf3e6', .02);
    // Floating sheer curtains.
    for (const sign of [-1, 1]) {
      const curtain = this.box(.27, h + .28, .13, x + sign * (w / 2 + .03), y - .015, z + .1, '#f1e6dc', .035);
      for (let i = 0; i < 4; i++) this.cylinder(.013, .013, h + .22, curtain.position.x - .09 + i * .06, y, z + .175, '#e5d8cd', this.content, 6);
    }
    this.box(w + .42, .035, .05, x, y + h / 2 + .18, z + .13, '#c9a57f', .006);
    // Simple greenery visible beyond the panes.
    this.sphere(.16, .12, .008, x - .4, y - .15, z + .09, '#a9c0ad');
  }

  private art(x: number, y: number, z: number, w: number, h: number, side: boolean, colour: string) {
    const g = this.group(); g.position.set(x, y, z); if (side) g.rotation.y = Math.PI / 2;
    this.box(w, h, .055, 0, 0, 0, '#c5a17e', .025, g);
    this.box(w - .07, h - .07, .025, 0, 0, .037, '#f5e8d6', .004, g);
    this.sphere(w * .23, h * .22, .01, 0, .06, .055, colour, g);
    this.sphere(w * .17, h * .13, .012, -.1, -.13, .06, '#e5bc9e', g);
    this.box(.012, h * .4, .014, 0, -.03, .075, '#94a083', .002, g);
    for (const sign of [-1, 1]) {
      const leaf = this.sphere(w * .13, h * .06, .012, sign * .075, -.06, .076, '#9cae90', g); leaf.rotation.z = sign * .5;
    }
  }

  private buildKitchen() {
    const g = this.group(), cream = '#eee5d5', counter = '#f8efdf';
    this.box(3.5, .86, .75, -3.2, .71, -3.55, cream, .06, g);
    this.box(3.62, .085, .84, -3.2, 1.18, -3.55, counter, .035, g);
    for (let i = 0; i < 5; i++) {
      const x = -4.58 + i * .68;
      this.box(.61, .73, .025, x, .76, -3.158, '#e5dbc9', .02, g);
      this.box(.24, .025, .03, x, 1.0, -3.13, '#c6a47b', .008, g);
    }
    // Sink and a curved brass faucet.
    this.box(.72, .035, .46, -3.5, 1.233, -3.57, '#cdc8bc', .09, g);
    this.box(.57, .03, .33, -3.5, 1.25, -3.57, '#aab9b6', .1, g);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.49, 1.2, -3.84), new THREE.Vector3(-3.49, 1.59, -3.84), new THREE.Vector3(-3.49, 1.63, -3.59), new THREE.Vector3(-3.49, 1.45, -3.5)]);
    this.mesh(new THREE.TubeGeometry(curve, 20, .022, 8, false), this.materials.colour('#c5a56e', .4, .4), 0, 0, 0, g);
    this.box(.7, .045, .55, -2.5, 1.24, -3.52, '#626a67', .035, g);
    for (const x of [-2.67, -2.32]) for (const z of [-3.69, -3.36]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.1, .011, 5, 16), this.materials.colour('#343e3b'));
      ring.position.set(x, 1.272, z); ring.rotation.x = Math.PI / 2; g.add(ring);
    }
    this.cylinder(.15, .12, .20, -2.67, 1.36, -3.69, '#c7a2a4', g);
    this.cylinder(.16, .15, .025, -2.67, 1.47, -3.69, '#f7eee0', g);
    this.sphere(.025, .025, .025, -2.67, 1.495, -3.69, '#b28d6b', g);
    // Bowl, apples and a little chopping board.
    this.cylinder(.18, .12, .12, -1.62, 1.3, -3.54, '#a7bdab', g);
    for (let i = 0; i < 3; i++) this.sphere(.065, .067, .065, -1.62 + Math.sin(i * 3) * .08, 1.4, -3.54 + Math.cos(i * 3) * .06, i % 2 ? '#e9c688' : '#dba39c', g);
    this.box(.4, .025, .26, -4.49, 1.25, -3.53, '#c99c73', .035, g);
    this.cylinder(.08, .07, .16, -4.61, 1.35, -3.74, '#e7d3c2', g);
    // Tall mint refrigerator with a postcard magnet.
    this.box(.72, 1.85, .73, -4.54, 1.2, -2.1, '#bbccc2', .09, g);
    this.box(.65, 1.12, .035, -4.54, 1.53, -1.706, '#c5d4ca', .04, g);
    this.box(.65, .53, .035, -4.54, .64, -1.706, '#c5d4ca', .04, g);
    this.box(.03, .5, .05, -4.28, 1.47, -1.672, '#edf0df', .008, g);
    this.box(.18, .24, .013, -4.57, 1.64, -1.675, '#f4dfcf', .006, g);
    this.sphere(.025, .025, .01, -4.57, 1.76, -1.664, '#cf98a5', g);
    // Open shelving, books and tiny mugs.
    for (const y of [2.05, 2.62]) {
      this.box(1.6, .07, .30, -4.12, y, -3.94, '#c7a786', .02, g);
      for (let i = 0; i < 4; i++) {
        const x = -4.6 + i * .30;
        this.cylinder(.072, .064, .15, x, y + .115, -3.85, ['#d0b6c6', '#bac9b4', '#e9d3a6', '#e9b9a7'][i], g);
      }
    }
    this.clock.position.set(-.87, 2.35, -4.02); this.content.add(this.clock);
    const dial = this.cylinder(.235, .235, .05, 0, 0, 0, '#c9ab83', this.clock); dial.rotation.x = Math.PI / 2;
    const face = this.cylinder(.203, .203, .057, 0, 0, .012, '#f8efdb', this.clock); face.rotation.x = Math.PI / 2;
    const hour = this.box(.014, .115, .014, 0, .045, .055, '#7a7567', .003, this.clock); hour.rotation.z = -.6;
    this.box(.014, .155, .014, .05, .015, .055, '#7a7567', .003, this.clock).rotation.z = -1.2;
    this.tag(g, 'counter');
    // Breakfast table.
    const dining = this.group();
    for (const x of [-2.45, -1.55]) for (const z of [-1.28, -.73]) this.leg(x, z, .55, dining);
    this.box(1.42, .1, 1.03, -2, .9, -1, '#e9c8a5', .13, dining);
    this.box(.41, .014, 1.05, -2, .962, -1, '#ecd1c4', .007, dining);
    this.flowers(-2, .97, -1, dining, '#dab3b7');
    for (const [x, z, angle] of [[-2.95, -1, Math.PI / 2], [-1.08, -1, -Math.PI / 2], [-2, -.2, 0]]) {
      const chair = new THREE.Group(); chair.position.set(x, .27, z); chair.rotation.y = angle; dining.add(chair);
      this.box(.46, .08, .46, 0, .39, 0, '#d0b28c', .06, chair);
      this.box(.46, .42, .06, 0, .66, -.2, '#dcc4a3', .06, chair);
      for (const a of [-.17, .17]) for (const b of [-.17, .17]) this.cylinder(.025, .03, .35, a, .18, b, '#b69776', chair, 6);
    }
    this.tag(dining, 'dining');
  }

  private buildLiving() {
    const g = this.group(), sofa = THEME[this.state.theme].sofa;
    const rug = this.materials.rug('#e9ddcc', '#c8b59f', 'stripe');
    this.box(3.4, .022, 2.6, -2.75, .31, 1.55, rug, .09);
    for (let i = 0; i < 15; i++) {
      this.box(.022, .008, .10, -4.22 + i * .21, .319, .22, '#e7d5bd', .003);
      this.box(.022, .008, .10, -4.22 + i * .21, .319, 2.88, '#e7d5bd', .003);
    }
    this.themedSofa.push(this.box(2.12, .25, 1.24, -3.65, .54, .35, sofa, .11, g));
    this.themedSofa.push(this.box(2.12, .66, .29, -3.65, .95, -.16, sofa, .1, g));
    for (const x of [-4.58, -2.72]) this.themedSofa.push(this.box(.29, .5, 1.15, x, .8, .35, sofa, .1, g));
    for (const x of [-4.18, -3.65, -3.12]) {
      this.box(.51, .18, .88, x, .78, .4, '#d0bfdc', .085, g);
      const cushion = this.box(.43, .42, .15, x, 1.0, .01, x === -3.65 ? '#e5c7b2' : '#e4d6e3', .07, g); cushion.rotation.x = -.13;
    }
    this.box(.41, .07, .67, -4.2, .9, .65, '#e7d4be', .025, g);
    for (const x of [-4.43, -2.87]) for (const z of [-.02, .7]) this.leg(x, z, .16, g);
    this.tag(g, 'sofa');
    // Side table and a warm shaded lamp.
    this.cylinder(.30, .3, .075, -4.77, .89, 1.41, '#d6b491'); this.leg(-4.77, 1.41, .56);
    this.cylinder(.13, .13, .025, -4.77, .95, 1.41, '#cdb28c');
    this.cylinder(.024, .03, .46, -4.77, 1.16, 1.41, '#b79c75');
    this.cylinder(.20, .30, .32, -4.77, 1.5, 1.41, '#f3e6cc');
    // Low oval table, tea, and an open magazine.
    const table = this.group();
    this.box(1.05, .07, .65, -2.73, .65, 1.95, '#d2b290', .20, table);
    for (const x of [-3.07, -2.39]) this.leg(x, 1.95, .33, table);
    this.box(.24, .026, .32, -2.52, .708, 1.94, '#d7b4c7', .01, table);
    this.box(.21, .012, .3, -2.53, .726, 1.94, '#f7ebd6', .003, table).rotation.y = -.15;
    this.cylinder(.07, .055, .095, -2.99, .75, 1.93, '#ebe3d2', table);
    this.cylinder(.055, .055, .01, -2.99, .80, 1.93, '#bfa084', table);
    this.tag(table, 'sofa');
    // A little journal desk with drawers.
    const desk = this.group();
    this.box(1.35, .095, .8, -4.1, .99, 2.6, '#dcc09d', .07, desk);
    for (const x of [-4.62, -3.58]) for (const z of [2.32, 2.88]) this.leg(x, z, .63, desk);
    this.box(.37, .21, .57, -4.48, .84, 2.56, '#cbaa89', .025, desk);
    this.sphere(.024, .024, .02, -4.48, .85, 2.88, '#eddfbc', desk);
    this.box(.38, .02, .3, -3.92, 1.06, 2.65, '#e9dcd0', .008, desk).rotation.y = .3;
    this.box(.16, .02, .025, -3.87, 1.085, 2.65, '#9b96ac', .003, desk).rotation.y = .65;
    this.flowers(-4.49, 1.04, 2.62, desk);
    this.tag(desk, 'desk');
    this.plant(-4.75, 3.03, .82); this.plant(-.55, -.55, .8, this.content, '#e0c2b2');
  }

  private buildNursery() {
    const rug = this.materials.rug('#e7dcdf', '#f8ecd3', 'flower');
    const playmat = this.group();
    const mat = this.cylinder(.98, .98, .024, 1.4, .324, 1.6, rug, playmat, 48);
    mat.receiveShadow = true;
    for (let i = 0; i < 5; i++) {
      const b = this.box(.16, .17, .16, .93 + Math.sin(i * 3) * .18, .44 + (i % 3) * .12, 1.73 + Math.cos(i * 3) * .14,
        ['#d9b59c', '#b9c9b0', '#c2afd7', '#e6c883', '#d8a7b6'][i], .025, playmat); b.rotation.y = i * .3;
    }
    // A little bunny, complete with floppy ears and a cotton tail.
    this.sphere(.12, .16, .10, 1.9, .48, 1.9, '#e9dfcd', playmat);
    this.sphere(.095, .085, .09, 1.9, .67, 1.91, '#eee6d7', playmat);
    this.sphere(.034, .15, .035, 1.85, .82, 1.9, '#eee6d7', playmat).rotation.z = .2;
    this.sphere(.034, .15, .035, 1.96, .80, 1.9, '#eee6d7', playmat).rotation.z = -.25;
    for (const x of [1.86, 1.94]) this.sphere(.01, .013, .01, x, .67, 1.993, '#6d5548', playmat);
    this.tag(playmat, 'playmat');
    // Crib in natural birch, with individually modelled rails.
    const crib = this.group(); this.preparedCrib = crib;
    this.box(1.30, .13, 1.95, 3.95, .53, -.45, '#d7bda0', .05, crib);
    this.box(1.14, .17, 1.78, 3.95, .68, -.45, '#f5e8dd', .075, crib);
    this.box(1.08, .04, 1.14, 3.95, .79, -.15, '#dec5d6', .03, crib);
    this.box(.68, .08, .35, 3.95, .80, -1.02, '#fff4e7', .065, crib);
    for (const x of [3.36, 4.54]) {
      this.box(.055, .07, 1.97, x, 1.12, -.45, '#d4b18c', .015, crib);
      for (let i = 0; i < 11; i++) this.cylinder(.017, .017, .55, x, .815, -1.31 + i * .173, '#e6ceb2', crib, 6);
    }
    for (const z of [-1.4, .5]) {
      this.box(1.29, .07, .055, 3.95, 1.12, z, '#d4b18c', .015, crib);
      for (let i = 0; i < 7; i++) this.cylinder(.017, .017, .55, 3.41 + i * .18, .815, z, '#e6ceb2', crib, 6);
      for (const x of [3.35, 4.55]) this.cylinder(.04, .045, .95, x, .70, z, '#d0ac83', crib, 8);
    }
    // Crib mobile, a crescent moon and suspended stars.
    this.cylinder(.019, .019, 1.30, 4.53, 1.74, -1.35, '#c09e77', crib, 8);
    this.box(.65, .03, .03, 4.22, 2.4, -1.35, '#c09e77', .008, crib);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(.24, .018, 6, 32), this.materials.colour('#c7a886'));
    hoop.rotation.x = Math.PI / 2; hoop.position.set(3.95, 2.35, -1.35); crib.add(hoop);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, x = 3.95 + Math.cos(a) * .22, z = -1.35 + Math.sin(a) * .22;
      this.cylinder(.005, .005, .28 + i % 2 * .14, x, 2.18 - i % 2 * .07, z, '#e8dbbd', crib, 5);
      this.star(x, 2.02 - i % 2 * .14, z, .095, i % 2 ? '#d7bfdd' : '#f0d8a2', crib);
    }
    this.tag(crib, 'crib');
    // A nursery chair with a curved back and rocker feet.
    const chair = this.group();
    this.box(.92, .16, .86, 1.2, .70, -.8, '#e7cfc0', .12, chair);
    this.box(.92, .71, .22, 1.2, 1.05, -1.16, '#e7cfc0', .11, chair).rotation.x = -.1;
    for (const x of [.79, 1.61]) this.box(.18, .3, .82, x, .87, -.8, '#dfc0ae', .09, chair);
    this.box(.48, .45, .12, 1.2, 1.15, -1.025, '#c6cbb3', .09, chair).rotation.z = .1;
    for (const x of [.87, 1.53]) {
      this.box(.045, .07, 1.12, x, .35, -.8, '#bda280', .025, chair);
      this.leg(x, -.63, .31, chair);
    }
    this.tag(chair, 'chair');
    // Changing station with little folded blankets.
    const dresser = this.group();
    this.box(1.28, .8, .94, 4, .71, 2.3, '#efe3ce', .065, dresser);
    this.box(1.35, .06, 1, 4, 1.14, 2.3, '#ead8bb', .04, dresser);
    for (const y of [.47, .72, .98]) {
      this.box(1.13, .205, .028, 4, y, 2.797, '#e4d1b3', .025, dresser);
      for (const x of [3.68, 4.32]) this.sphere(.035, .035, .035, x, y, 2.835, '#c7aa7e', dresser);
    }
    this.box(.88, .075, .55, 3.88, 1.22, 2.28, '#d9c6d8', .1, dresser);
    for (let i = 0; i < 3; i++) this.box(.22, .04, .2, 4.47, 1.23 + i * .043, 2.48, ['#ede5d7', '#c6d0b8', '#e5c3b9'][i], .015, dresser);
    this.cylinder(.035, .04, .16, 4.5, 1.28, 2.03, '#f4ecd8', dresser);
    this.tag(dresser, 'dresser');
    // Rainbow arch wall detail.
    const rainbow = this.group();
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(.40 - i * .076, .033, 7, 24, Math.PI), this.materials.colour(['#d1a5a2', '#e2c294', '#b3bda0', '#b9a7ca'][i]));
      arc.position.set(1.42, 1.98, -4.005); rainbow.add(arc);
    }
    this.plant(4.9, 1.2, .7, this.content, '#e4c8b3');
    // Star garland on the tall back wall.
    for (let i = 0; i < 6; i++) this.star(.45 + i * .34, 2.94 - Math.sin(i / 5 * Math.PI) * .15, -3.99, .055, '#e9d49e');
  }

  private star(x: number, y: number, z: number, radius: number, colour: string, parent: THREE.Object3D = this.content) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 + Math.PI / 2, r = i % 2 ? radius * .44 : radius;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath(); return this.mesh(new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false }), this.materials.colour(colour), x, y, z, parent);
  }

  private buildProgressProps() {
    this.content.add(this.cribParts, this.packedBag, this.livedIn);
    this.box(1.32, .38, .82, 3.94, .50, -.55, '#c6ad8c', .04, this.cribParts);
    this.box(.075, .10, .84, 3.94, .744, -.55, '#eadbbd', .01, this.cribParts);
    for (let i = 0; i < 4; i++) this.box(.09, 1.0, .1, 4.35 + i * .10, .89, -1.18, '#d6bea0', .01, this.cribParts).rotation.z = -.07;
    this.box(.65, .78, .065, 3.43, .84, -.49, '#d4bca0', .04, this.cribParts).rotation.z = .09;
    this.box(.68, .016, .57, 3.84, .73, -.15, '#eee4cc', .01, this.cribParts).rotation.y = .2;
    this.tag(this.cribParts, 'crib');
    this.box(.63, .50, .35, -.59, .54, 3.13, '#b39d85', .09, this.packedBag);
    this.box(.66, .06, .38, -.59, .81, 3.13, '#c9b395', .04, this.packedBag);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.15, .019, 7, 22, Math.PI), this.materials.colour('#937e68'));
    handle.position.set(-.59, .83, 3.13); this.packedBag.add(handle);
    this.box(.15, .21, .014, -.62, .54, 3.317, '#d9ccaf', .02, this.packedBag);
    this.tag(this.packedBag, 'dresser');
    for (const x of [-2.35, -1.7]) {
      this.cylinder(.18, .18, .025, x, .978, -.83, '#f6efde', this.livedIn, 24);
      this.sphere(.11, .018, .10, x, 1.00, -.83, '#acbb8d', this.livedIn);
      this.cylinder(.045, .035, .10, x, 1.025, -1.21, '#ddc7a9', this.livedIn);
    }
    this.flowers(-4.1, 1.05, 2.70, this.livedIn, '#c6ae8c');
    this.tag(this.livedIn, 'dining');
  }

  private buildBathroom() {
    const bath = this.group();
    this.box(1.85, .48, .9, 3.55, .58, -3.45, '#f7f0e6', .2, bath);
    this.box(1.62, .018, .70, 3.55, .83, -3.45, '#b7d6d1', .18, bath);
    for (const x of [2.67, 4.43]) this.box(.1, .12, .70, x, .84, -3.45, '#fff7ec', .04, bath);
    for (const z of [-3.86, -3.04]) this.box(1.6, .10, .08, 3.55, .85, z, '#fff7ec', .035, bath);
    for (let i = 0; i < 8; i++) this.sphere(.07 + (i % 3) * .025, .035, .06, 2.95 + i * .15, .853, -3.6 + Math.sin(i) * .15, '#f6f1e8', bath);
    this.cylinder(.025, .025, .47, 2.57, .78, -3.76, '#c7ac7b', bath);
    this.box(.23, .03, .04, 2.66, 1.025, -3.76, '#c7ac7b', .008, bath);
    this.tag(bath, 'bath');
    // Vanity and a round mirror.
    this.box(.9, .65, .66, 1.6, .63, -3.71, '#b3c6b9', .06);
    this.box(1.0, .07, .74, 1.6, .99, -3.71, '#eee7d7', .035);
    this.sphere(.3, .095, .2, 1.6, 1.06, -3.7, '#faf4ea');
    this.cylinder(.018, .018, .20, 1.6, 1.2, -3.95, '#c1a678');
    const mirror = this.cylinder(.39, .39, .05, 1.6, 1.94, -4.03, '#cab58d'); mirror.rotation.x = Math.PI / 2;
    const glass = this.cylinder(.35, .35, .055, 1.6, 1.94, -3.995, '#bdd3d4'); glass.rotation.x = Math.PI / 2;
    this.box(.35, .027, .2, 4.4, 1.11, -3.46, '#d5bbcb', .015);
    this.box(.3, .05, .8, 2.2, .325, -2.8, this.materials.rug('#e3d9c9', '#b7c7bb', 'dots'), .04);
  }

  private buildGarden() {
    const bench = this.group();
    for (let i = 0; i < 4; i++) this.box(2.12, .07, .15, -3.9, .73, 5.15 + i * .155, '#d5b996', .025, bench);
    for (let i = 0; i < 4; i++) this.box(2.12, .11, .045, -3.9, 1.0 + i * .14, 5.68, '#dcc4a4', .022, bench);
    for (const x of [-4.76, -3.04]) {
      this.box(.07, .61, .75, x, .48, 5.37, '#aaa590', .022, bench);
      this.box(.08, .06, .85, x, .98, 5.39, '#aaa590', .02, bench);
    }
    this.box(.43, .36, .13, -4.22, .98, 5.56, '#d9b8ba', .06, bench);
    this.tag(bench, 'bench');
    const planter = this.group();
    this.box(1.68, .28, .65, 4, .30, 5.15, '#c4a283', .08, planter);
    this.box(1.53, .03, .52, 4, .453, 5.15, '#846a55', .02, planter);
    for (let i = 0; i < 6; i++) {
      const x = 3.38 + i * .25;
      this.cylinder(.018, .018, .31 + i % 2 * .08, x, .64, 5.15 + Math.sin(i) * .08, '#86a682', planter, 6);
      this.sphere(.105, .085, .1, x, .82 + i % 2 * .08, 5.15 + Math.sin(i) * .08, ['#d1aacb', '#edc892', '#deafac'][i % 3], planter);
      this.sphere(.037, .027, .037, x, .897 + i % 2 * .08, 5.15 + Math.sin(i) * .08, '#f0dfa8', planter);
    }
    this.tag(planter, 'planter');
    // Low white picket fence; the front stays open to the viewer.
    for (const x of [-6.85, 6.85]) {
      for (let z = -4.75; z < 7; z += .38) this.box(.07, .65, .09, x, .37, z, '#ede8d8', .025);
      for (const y of [.26, .52]) this.box(.055, .045, 11.9, x, y, 1.18, '#e7e1d0', .01);
    }
    for (let x = -6.8; x < 6.9; x += .38) this.box(.09, .65, .07, x, .37, -5.62, '#ede8d8', .025);
    for (const y of [.26, .52]) this.box(13.7, .045, .055, 0, y, -5.62, '#e7e1d0', .01);
    // Full, sculpted olive trees at the edge of the diorama.
    for (const [x, z, size] of [[-6.1, -3.6, 1.25], [6.03, -.9, 1.10], [-6.0, 4.0, .94], [5.7, 6.4, .83], [3.1, -5.0, .95]]) {
      const tree = new THREE.Group(); tree.position.set(x, .08, z); tree.scale.setScalar(size); this.content.add(tree); this.trees.push(tree);
      this.cylinder(.09, .17, 1.3, 0, .66, 0, '#aa8e70', tree, 9);
      this.sphere(.75, .70, .69, 0, 1.75, 0, '#a0b99a', tree);
      this.sphere(.51, .59, .52, -.36, 1.5, .15, '#b6c6a4', tree);
      this.sphere(.48, .54, .48, .37, 1.64, .06, '#b0c3a0', tree);
      this.sphere(.44, .44, .47, .04, 2.12, -.03, '#b8c9aa', tree);
    }
    for (let i = 0; i < 36; i++) {
      const side = i % 2 ? -1 : 1, x = side * (5.98 + Math.sin(i * 4) * .31), z = -3.8 + (i % 18) * .6;
      this.sphere(.13, .18, .15, x, .18, z, i % 3 ? '#b2c2a0' : '#c5c6a0');
      if (i % 3 === 0) this.sphere(.06, .05, .06, x, .35, z, '#dfbecb');
    }
    // Garden blanket and a straw picnic basket.
    this.box(1.7, .018, 1.25, 2.1, .092, 6.3, this.materials.rug('#ead8c8', '#cb9e96', 'stripe'), .04);
    this.box(.42, .33, .31, 2.5, .26, 6.3, '#c6a379', .055);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.16, .019, 6, 16, Math.PI), this.materials.colour('#ba9469'));
    handle.position.set(2.5, .43, 6.3); this.content.add(handle);
    // A pastel pram, waiting beside the front step.
    const pram = this.group();
    this.box(.68, .28, .92, -1.37, .57, 4.2, '#d5bfcc', .15, pram);
    const hood = this.sphere(.36, .42, .36, -1.37, .86, 3.97, '#c6adbf', pram); hood.scale.z = .85;
    for (const x of [-1.67, -1.07]) for (const z of [3.9, 4.54]) {
      const wheel = this.cylinder(.12, .12, .047, x, .21, z, '#887d79', pram, 16); wheel.rotation.z = Math.PI / 2;
    }
    this.box(.04, .5, .04, -1.07, .72, 4.62, '#b4a892', .01, pram).rotation.x = .4;
    this.box(.04, .5, .04, -1.67, .72, 4.62, '#b4a892', .01, pram).rotation.x = .4;
    this.box(.64, .035, .04, -1.37, .95, 4.71, '#ac9a86', .01, pram);
    this.tag(pram, 'bench');
  }

  private makeHearts() {
    const group = new THREE.Group(), shape = new THREE.Shape();
    shape.moveTo(0, .02); shape.bezierCurveTo(-.1, .12, -.19, .01, -.12, -.08);
    shape.lineTo(0, -.2); shape.lineTo(.12, -.08); shape.bezierCurveTo(.19, .01, .1, .12, 0, .02);
    for (let i = 0; i < 7; i++) {
      const heart = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: i % 2 ? '#eac0cd' : '#f3d7a5', transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
      heart.scale.setScalar(.48 + i % 2 * .15); group.add(heart);
    }
    group.visible = false; return group;
  }

  private decor(p: Placement) {
    const item = FURNITURE.find(i => i.id === p.itemId)!;
    const g = new THREE.Group(); g.position.set(p.x, roomAt(p.x, p.z) === 'garden' ? -.14 : 0, p.z); g.rotation.y = p.rotation; this.furniture.add(g);
    switch (item.kind) {
      case 'plant': this.plant(0, 0, .9, g); break;
      case 'flowers': this.flowers(0, .28, 0, g, item.colour); break;
      case 'rug': this.box(1.65, .02, 1.38, 0, .34, 0, this.materials.rug(item.colour, '#f7ebd6', 'dots'), .12, g); break;
      case 'ottoman': this.cylinder(.37, .39, .41, 0, .53, 0, item.colour, g, 32); this.cylinder(.34, .34, .06, 0, .76, 0, '#e9cbd0', g); break;
      case 'lamp': {
        this.cylinder(.19, .21, .04, 0, .31, 0, '#d3bb97', g);
        this.cylinder(.016, .02, .95, 0, .78, 0, '#bda180', g);
        this.sphere(.25, .26, .14, 0, 1.37, 0, item.colour, g);
        this.sphere(.19, .24, .15, .12, 1.42, .04, '#f4edf7', g);
        break;
      }
      case 'toy': {
        for (let i = 0; i < 5; i++) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(.38 - i * .065, .029, 7, 20, Math.PI), this.materials.colour(['#d8a7a4', '#e1c598', '#bfc6a0', '#a8bdaf', '#c1afd0'][i]));
          arc.position.set(0, .35, 0); g.add(arc);
        } break;
      }
      case 'shelf': {
        for (const x of [-.42, .42]) this.box(.07, 1.18, .43, x, .88, 0, item.colour, .025, g);
        for (const y of [.35, .88, 1.45]) this.box(.91, .05, .43, 0, y, 0, item.colour, .025, g);
        for (let i = 0; i < 7; i++) this.box(.09, .28 + i % 2 * .08, .27, -.32 + i * .105, 1.08, 0, ['#c7adc8', '#b2c3ae', '#e2c398'][i % 3], .008, g);
        this.flowers(.17, 1.48, 0, g); break;
      }
    }
    this.tag(g, `decor:${p.id}`);
  }

  update(state: GameState) {
    this.state = state;
    const inClinic = state.location === 'clinic';
    if (this.locationKey !== state.location) {
      this.homeObjects.forEach(o => { o.visible = !inClinic; }); this.clinic.visible = inClinic; this.furniture.visible = !inClinic;
      this.points = []; this.arrived = undefined; this.mother.group.position.set(inClinic ? -.7 : -1.15, .26, inClinic ? 1.0 : 1.3);
      this.partner.group.position.set(inClinic ? .95 : -.8, .26, inClinic ? 2.6 : 2.4);
      this.targetFocus.set(0, .4, inClinic ? .35 : .55); this.targetZoom = inClinic ? 1.32 : 1.25; this.targetAngle = -.38;
      this.locationKey = state.location;
    }
    const avatarKey = JSON.stringify(state.avatar);
    if (avatarKey !== this.avatarKey) {
      const position = this.mother.group.position.clone(), rotation = this.mother.group.rotation.clone();
      this.content.remove(this.mother.group); this.disposeGroup(this.mother.group, false);
      this.mother = new Character(this.materials, state.avatar); this.mother.group.position.copy(position); this.mother.group.rotation.copy(rotation); this.content.add(this.mother.group);
      this.avatarKey = avatarKey;
    }
    this.mother.setPregnant(state.pregnancy.born ? false : simulationWeek(state)); this.mother.setChildPresent(state.pregnancy.born); this.mother.setActivity(state.activity?.id ?? null);
    const pose = state.activity?.id ?? null;
    if (pose !== this.poseKey) {
      if (this.standingPosition) { this.mother.group.position.copy(this.standingPosition); this.standingPosition = undefined; }
      if (pose && ['rest', 'feed', 'skin', 'scan'].includes(pose)) {
        this.standingPosition = this.mother.group.position.clone();
        if (inClinic) this.mother.group.position.set(pose === 'scan' ? -2.1 : 3, pose === 'scan' ? .50 : .41, pose === 'scan' ? -2.5 : .55);
        else this.mother.group.position.set(pose === 'rest' ? -3.65 : 1.2, .15, pose === 'rest' ? .42 : -.8);
        this.mother.group.rotation.y = 0;
      }
      this.poseKey = pose;
    }
    this.partner.setActivity(state.activity?.id === 'help' ? 'talk' : null);
    const baby = state.pregnancy.born, holding = ['feed', 'lullaby', 'read', 'skin', 'soothe'].includes(state.activity?.id ?? '');
    const exploring = baby && state.chapter >= 12 && !holding;
    this.cribBaby.visible = baby && !inClinic && !holding && state.activity?.id !== 'play' && !exploring;
    this.playBaby.visible = baby && !inClinic && state.activity?.id === 'play' && state.chapter < 12;
    this.playBaby.scale.setScalar(state.chapter >= 12 ? 1.06 : .90);
    this.playBaby.rotation.x = state.chapter >= 12 ? .25 : -Math.PI / 2;
    this.birthBaby.visible = inClinic && baby && !holding;
    this.toddler.visible = !inClinic && state.chapter >= 13 && !holding;
    this.sittingBaby.visible = !inClinic && state.chapter === 12 && !holding;
    const cribReady = state.missions.completed.includes('build-crib') || state.chapter >= 7;
    this.preparedCrib.visible = !inClinic && cribReady;
    this.cribParts.visible = !inClinic && !cribReady;
    this.packedBag.visible = !inClinic && state.missions.completed.some(id => ['pack-essentials', 'final-bag'].includes(id));
    this.livedIn.visible = !inClinic && state.totalActions > 1;
    this.doctor.setActivity(inClinic && state.activity ? 'talk' : null);
    if (this.themeKey !== state.theme) {
      const theme = THEME[state.theme];
      this.themedWalls.forEach(m => { m.material = this.materials.colour(theme.wall); });
      this.themedSofa.forEach(m => { m.material = this.materials.colour(theme.sofa); });
      this.themeKey = state.theme;
    }
    const pk = JSON.stringify(state.placements);
    if (pk !== this.placementKey) {
      this.disposeGroup(this.furniture, false); this.furniture.clear(); state.placements.forEach(p => this.decor(p)); this.placementKey = pk;
    }
    this.hearts.visible = Boolean(state.activity) && !state.settings.reducedMotion;
  }

  walkTo(id: string, onArrive?: () => void) {
    const target = worldObjects(this.state.location).find(o => o.id === id);
    if (!target) { onArrive?.(); return; }
    this.points = findPath({ x: this.mother.group.position.x, z: this.mother.group.position.z }, target.approach, this.state.placements, this.state.location);
    this.arrived = onArrive;
    if (!this.points.length) { this.arrived = undefined; onArrive?.(); }
    this.select(id);
  }

  cancelWalk() { this.points = []; this.arrived = undefined; this.mother.setWalking(false); }
  select(id: string | null) {
    this.selected = id; const target = worldObjects(this.state.location).find(o => o.id === id);
    this.ring.visible = Boolean(target) && !this.photoMode;
    if (target) this.ring.position.set(target.approach.x, .335, target.approach.z);
  }

  focusRoom(room: Room | 'home') {
    const targets = { home: [0, .2, .75], living: [-2.5, .4, 1.25], kitchen: [-2.7, .6, -2.2], nursery: [2.65, .5, .5],
      garden: [0, .3, 5.2], bathroom: [2.75, .6, -3.25], bedroom: [-2.5, .4, 1.25], clinic: [0, .5, .2], lakeside: [0, .4, 4], market: [0, .4, 1], cafe: [0, .4, 1] };
    const p = targets[room]; this.targetFocus.set(p[0], p[1], p[2]); this.targetZoom = room === 'home' ? 1 : 1.72;
    if (room === 'home') this.resetCamera();
  }

  private resetCamera() {
    this.targetAngle = -.38;
    const landscape = this.element.clientWidth / this.element.clientHeight > 1.3;
    this.targetZoom = landscape ? .84 : this.state.location === 'clinic' ? 1.32 : 1.25;
    this.targetFocus.set(landscape ? -1.5 : 0, .4, this.state.location === 'clinic' ? .35 : .55);
  }

  focusActivity(id: string) {
    const object = worldObjects(this.state.location).find(o => o.id === id);
    if (!object) return;
    this.targetFocus.set(object.approach.x, .75, object.approach.z); this.targetZoom = 1.75;
  }

  setPhotoMode(value: boolean) { this.photoMode = value; this.ring.visible = !value && Boolean(this.selected); }
  setPlacing(value: string | null) { this.placing = value; }
  setPaused(value: boolean) { this.paused = value; }
  setVisible(value: boolean) { this.visible = value; }

  capture(): string {
    this.renderer.render(this.scene, this.camera);
    const source = this.renderer.domElement, canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / source.width); canvas.width = source.width * scale; canvas.height = source.height * scale;
    const c = canvas.getContext('2d')!, gradient = c.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#eee8f3'); gradient.addColorStop(1, '#e9e7dc'); c.fillStyle = gradient; c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(source, 0, 0, canvas.width, canvas.height);
    const size = Math.max(14, canvas.width / 24); c.fillStyle = '#695676'; c.font = `800 ${size}px Nunito, system-ui`;
    c.textAlign = 'center'; c.fillText('Mommy Simulator', canvas.width / 2, canvas.height - size * 2.7);
    c.font = `600 ${size * .58}px Nunito, system-ui`; c.fillStyle = '#9a86a5'; c.fillText('a little world by Anacan', canvas.width / 2, canvas.height - size * 1.6);
    return canvas.toDataURL('image/jpeg', .78);
  }

  private resize() {
    const w = this.element.clientWidth, h = this.element.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h); const aspect = w / h;
    const visibleWidth = aspect > 1.3 ? 24.5 * aspect / 1.6 : 20.0;
    const height = visibleWidth / aspect;
    this.camera.left = -visibleWidth / 2; this.camera.right = visibleWidth / 2;
    this.camera.top = height / 2; this.camera.bottom = -height / 2; this.camera.updateProjectionMatrix();
    this.resetCamera();
  }

  private down = (event: PointerEvent) => {
    this.renderer.domElement.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pointerStart = this.lastPointer = { x: event.clientX, y: event.clientY }; this.moved = false;
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); this.moved = true; }
  };
  private move = (event: PointerEvent) => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch > 0) this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * distance / this.pinch, .85, 2.6);
      this.pinch = distance; this.moved = true;
    } else if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 7) {
    this.targetAngle = THREE.MathUtils.clamp(this.targetAngle - (event.clientX - this.lastPointer.x) * .005, -.9, .9); this.moved = true;
    }
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };
  private up = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    if (!this.moved) this.click(event.clientX, event.clientY);
    this.pinch = 0;
  };
  private cancelPointer = (event: PointerEvent) => { this.pointers.delete(event.pointerId); this.moved = true; this.pinch = 0; };
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * (event.deltaY > 0 ? .94 : 1.06), .85, 2.6); };

  private click(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1); this.ray.setFromCamera(this.pointer, this.camera);
    const visible = (o: THREE.Object3D): boolean => o.visible && (!o.parent || o.parent === this.scene || visible(o.parent));
    const hit = this.ray.intersectObjects([this.content, this.furniture], true).find(h => h.object.userData.interactive && visible(h.object));
    if (hit && !this.photoMode && !this.placing) { this.callbacks.onObject(hit.object.userData.interactive); return; }
    const point = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.floorPlane, point)) {
      this.callbacks.onFloor({ x: point.x, z: point.z });
      if (walkable(point.x, point.z, this.state.placements, .16, this.state.location) && !this.photoMode && !this.placing && !this.state.activity) {
        this.points = findPath({ x: this.mother.group.position.x, z: this.mother.group.position.z }, { x: point.x, z: point.z }, this.state.placements, this.state.location);
      }
    }
  }

  private animate = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (document.hidden || !this.visible) { this.last = time; return; }
    if (time - this.last < 1000 / 30) return;
    const dt = Math.min((time - (this.last || time)) / 1000, .7); this.last = time; this.tick += dt;
    const reduced = this.state.settings.reducedMotion, motionDt = this.paused ? 0 : dt;
    if (this.points.length && !this.paused) {
      const target = this.points[0], position = this.mother.group.position, dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
      const step = motionDt * 1.65 * (this.state.settings.speed || 1);
      if (distance <= step) { position.x = target.x; position.z = target.z; this.points.shift(); }
      else { position.x += dx / distance * step; position.z += dz / distance * step; }
      position.y = THREE.MathUtils.lerp(position.y, this.state.location === 'home' && roomAt(position.x, position.z) === 'garden' ? .06 : .26, .2);
      this.mother.group.rotation.y = THREE.MathUtils.lerp(this.mother.group.rotation.y, Math.atan2(dx, dz), .25);
      if (!this.points.length) { const done = this.arrived; this.arrived = undefined; done?.(); }
    }
    this.mother.setWalking(this.points.length > 0); this.mother.animate(motionDt, reduced); this.partner.animate(motionDt, reduced); this.doctor.animate(motionDt, reduced);
    if (this.state.activity && !this.points.length && !this.standingPosition) {
      const target = worldObjects(this.state.location).find(o => o.id === this.selected);
      if (target) {
        const angle = Math.atan2(target.x - this.mother.group.position.x, target.z - this.mother.group.position.z);
        this.mother.group.rotation.y = THREE.MathUtils.lerp(this.mother.group.rotation.y, angle, .05);
      }
    }
    if (!reduced && !this.paused) {
      this.trees.forEach((tree, i) => { tree.rotation.z = Math.sin(this.tick * .6 + i) * .012; });
      this.hearts.children.forEach((heart, i) => {
        const progress = ((this.tick * .35 + i / 7) % 1);
        heart.position.set(this.mother.group.position.x + Math.sin(i * 2.4) * (.2 + progress * .4), 1.85 + progress * .9, this.mother.group.position.z + Math.cos(i * 2.4) * .3);
        heart.quaternion.copy(this.camera.quaternion); (heart as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>).material.opacity = Math.sin(progress * Math.PI) * .7;
      });
      this.fireflies.children.forEach((fly, i) => { fly.position.y = .8 + Math.sin(this.tick * .7 + i) * .35; });
      this.ring.scale.setScalar(1 + Math.sin(this.tick * 2.4) * .06);
    }
    this.playBaby.rotation.y = Math.sin(this.tick * .9) * .08;
    if (this.toddler.visible && !reduced && !this.paused) {
      this.toddler.position.x = 1.4 + Math.sin(this.tick * .28) * .45;
      this.toddler.rotation.y = Math.cos(this.tick * .28) * .7;
      const legs = this.toddler.userData.legs as THREE.Group[]; legs.forEach((leg, i) => { leg.rotation.x = Math.sin(this.tick * 5.5 + i * Math.PI) * .2; });
    }
    const evening = THREE.MathUtils.smoothstep(this.state.time, 17 * 60, 22 * 60);
    this.sun.intensity = 3.0 - evening * 1.3; this.sun.color.set(evening > .5 ? '#f1c1a6' : '#fff0d1');
    this.ambient.intensity = 1.5 - evening * .4; this.fireflies.visible = evening > .2 && this.state.location === 'home';
    const lerp = reduced ? 1 : .065;
    this.angle = THREE.MathUtils.lerp(this.angle, this.targetAngle, lerp); this.zoom = THREE.MathUtils.lerp(this.zoom, this.targetZoom, lerp);
    this.focus.lerp(this.targetFocus, lerp); this.camera.zoom = this.zoom; this.camera.updateProjectionMatrix();
    this.camera.position.set(this.focus.x + Math.sin(this.angle) * 24, this.focus.y + 19, this.focus.z + Math.cos(this.angle) * 24);
    this.camera.lookAt(this.focus); this.renderer.render(this.scene, this.camera);
    this.overlayTime += dt;
    if (this.overlayTime > .16) {
      this.overlayTime = 0; const positions: Record<string, { x: number; y: number; visible: boolean }> = {};
      const w = this.element.clientWidth, h = this.element.clientHeight;
      for (const o of worldObjects(this.state.location)) {
        const p = new THREE.Vector3(o.x, 1.35, o.z).project(this.camera), x = (p.x + 1) * w / 2, y = (1 - p.y) * h / 2;
        positions[o.id] = { x, y, visible: x > 14 && x < w - 14 && y > 14 && y < h - 14 };
      }
      const mother = this.mother.group.position.clone(); mother.y += 2.28; const m = mother.project(this.camera);
      positions.mother = { x: (m.x + 1) * w / 2, y: (1 - m.y) * h / 2, visible: true };
      if (this.placing) PLACEMENT_SPOTS.forEach((spot, index) => {
        const p = new THREE.Vector3(spot.x, .32, spot.z).project(this.camera), x = (p.x + 1) * w / 2, y = (1 - p.y) * h / 2;
        positions[`slot-${index}`] = { x, y, visible: canPlace(spot.x, spot.z, this.placing!, this.state.placements) && x > 14 && x < w - 14 && y > 14 && y < h - 14 };
      });
      this.callbacks.onPositions(positions);
    }
  };

  private mergeStaticMeshes() {
    // Keep animated characters and props independent. Static geometry is baked
    // by material and object ID, cutting hundreds of draw calls on a phone.
    const excluded = new Set<THREE.Object3D>();
    for (const group of [this.mother.group, this.partner.group, this.cribBaby, this.playBaby, this.ring, this.hearts,
      this.preparedCrib, this.fireflies, ...this.trees, ...this.themedWalls, ...this.themedSofa]) group.traverse(object => excluded.add(object));
    this.content.updateMatrixWorld(true);
    const batches = new Map<string, { geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; material: THREE.Material; id?: string }>();
    this.content.traverse(object => {
      if (!(object instanceof THREE.Mesh) || excluded.has(object) || Array.isArray(object.material) || object.material.transparent) return;
      const id = object.userData.interactive as string | undefined, key = `${object.material.uuid}:${id ?? 'scenery'}`;
      const batch: { geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; material: THREE.Material; id?: string }
        = batches.get(key) ?? { geometries: [], meshes: [], material: object.material, id };
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      if (geometry.getAttribute('uv1')) geometry.deleteAttribute('uv1');
      batch.geometries.push(geometry); batch.meshes.push(object); batches.set(key, batch);
    });
    for (const batch of batches.values()) {
      if (batch.geometries.length < 2) { batch.geometries.forEach(g => g.dispose()); continue; }
      const geometry = mergeGeometries(batch.geometries, false);
      batch.geometries.forEach(g => g.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, batch.material); mesh.castShadow = true; mesh.receiveShadow = true;
      if (batch.id) mesh.userData.interactive = batch.id;
      this.staticContent.add(mesh);
      batch.meshes.forEach(mesh => { mesh.parent?.remove(mesh); mesh.geometry.dispose(); });
    }
    this.content.add(this.staticContent);
  }

  private disposeGroup(group: THREE.Object3D, disposeMaterials: boolean) {
    group.traverse(o => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (disposeMaterials) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }
    });
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.down); canvas.removeEventListener('pointermove', this.move);
    canvas.removeEventListener('pointerup', this.up); canvas.removeEventListener('pointercancel', this.cancelPointer); canvas.removeEventListener('wheel', this.wheel);
    this.disposeGroup(this.scene, true); this.materials.dispose(); this.renderer.dispose(); canvas.remove();
  }
}
