import * as THREE from 'three';
import type { ActivityId, Avatar } from '../game/types';
import { Materials } from './materials';

function oval(parent: THREE.Object3D, material: THREE.Material, scale: [number, number, number], position: [number, number, number], segments = 18) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 14), material);
  mesh.scale.set(...scale); mesh.position.set(...position); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function capsule(parent: THREE.Object3D, material: THREE.Material, radius: number, length: number, y: number) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 10), material); mesh.position.y = y; mesh.castShadow = true; parent.add(mesh); return mesh;
}

export function makeBaby(materials: Materials, skin = '#f4cbae', swaddle = '#dcc3d9', sleeping = true) {
  const group = new THREE.Group(), skinMat = materials.colour(skin);
  oval(group, materials.colour(swaddle), [.13, .23, .12], [0, .17, 0]);
  oval(group, materials.colour('#f2e7dc'), [.115, .025, .13], [0, .32, .025]);
  oval(group, skinMat, [.125, .13, .12], [0, .46, 0]);
  oval(group, materials.colour('#b59b83'), [.077, .020, .072], [0, .571, -.025]);
  for (const x of [-.043, .043]) {
    oval(group, materials.colour('#473329'), [sleeping ? .019 : .009, sleeping ? .004 : .012, .007], [x, .462, .117]);
    oval(group, materials.colour('#eab0a0'), [.023, .01, .006], [x * 1.7, .429, .106]);
  }
  oval(group, skinMat, [.014, .017, .015], [0, .445, .12]);
  oval(group, materials.colour('#bd8275'), [.015, .004, .006], [0, .412, .113]);
  for (let i = 0; i < 5; i++) {
    const line = capsule(group, materials.colour('#d3bac7'), .005, .15, .16 + i * .018); line.rotation.z = .8; line.position.x = -.02; line.position.z = .113;
  }
  return group;
}

export function makeChild(materials: Materials, skin = '#f4cbae', toddler = false) {
  const group = new THREE.Group(), s = materials.colour(skin), cloth = materials.colour('#cfba9f'), trousers = materials.colour('#a6bab0');
  const legs: THREE.Group[] = [];
  for (const sign of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sign * .085, toddler ? .34 : .16, 0); group.add(leg); legs.push(leg);
    capsule(leg, trousers, .055, .10, -.09); oval(leg, materials.colour('#f3e8d7'), [.063, .034, .09], [0, -.22, .03]);
  }
  oval(group, cloth, [.16, .19, .11], [0, toddler ? .47 : .3, 0]);
  oval(group, s, [.17, .19, .16], [0, toddler ? .78 : .63, 0]);
  oval(group, materials.colour('#9d7656'), [.155, .085, .13], [0, toddler ? .92 : .77, -.02]);
  for (const sign of [-1, 1]) {
    const arm = capsule(group, s, .04, .12, toddler ? .43 : .28); arm.position.x = sign * .18; arm.rotation.z = sign * .3;
    oval(group, materials.colour('#3d3131'), [.013, .018, .008], [sign * .062, toddler ? .79 : .64, .155]);
    oval(group, materials.colour('#e7a99a'), [.025, .011, .006], [sign * .11, toddler ? .73 : .58, .14]);
  }
  group.userData.legs = legs; return group;
}

export class Character {
  group = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private legs: THREE.Group[] = [];
  private knees: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private elbows: THREE.Group[] = [];
  private belly: THREE.Mesh;
  private heldBaby: THREE.Group;
  private walking = false;
  private activity: ActivityId | null = null;
  private time = 0;
  private pregnancy = 0;
  private childPresent = false;
  private sitting: boolean | null = null;

  constructor(private materials: Materials, avatar: Avatar, private male = false, doctor = false) {
    const skin = materials.colour(avatar.skin, .64), hair = materials.colour(avatar.hair, .49), cloth = materials.fabric(doctor ? '#f2f0e8' : male ? '#d5ccbb' : avatar.outfit, !doctor);
    const pants = materials.colour(male ? '#697b8b' : '#ddd5ca'), white = materials.colour('#f2ede4'), dark = materials.colour('#49352e');
    this.group.add(this.body);
    const casual = male || avatar.outfitStyle === 'casual';

    for (const sign of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sign * .11, .96, 0); this.body.add(leg); this.legs.push(leg);
      capsule(leg, casual ? pants : skin, .07, .29, -.18);
      const knee = new THREE.Group(); knee.position.y = -.42; leg.add(knee); this.knees.push(knee);
      capsule(knee, casual ? pants : skin, .051, .30, -.16);
      oval(knee, white, [.065, .047, .12], [0, -.40, .035]);
      oval(knee, materials.colour('#cbbfae'), [.066, .014, .12], [0, -.44, .037]);
    }
    oval(this.body, casual ? pants : cloth, [.19, .16, .15], [0, .98, 0]);
    oval(this.body, cloth, [male ? .23 : .19, .27, .14], [0, 1.26, -.01]);
    oval(this.body, cloth, [.185, .2, .145], [0, 1.10, .015]);
    if (!casual) {
      const dress = new THREE.Mesh(new THREE.CylinderGeometry(.165, .245, .57, 28, 4), cloth);
      dress.position.set(0, .91, 0); dress.castShadow = true; this.body.add(dress);
      const hem = new THREE.Mesh(new THREE.TorusGeometry(.244, .006, 4, 32), materials.colour('#e6d5df'));
      hem.rotation.x = Math.PI / 2; hem.position.y = .63; this.body.add(hem);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const fold = capsule(this.body, materials.colour(avatar.outfit), .007, .43, .91);
        fold.position.x = Math.sin(a) * .212; fold.position.z = Math.cos(a) * .212; fold.rotation.z = Math.sin(a) * .08;
      }
    } else if (!male) {
      oval(this.body, cloth, [.205, .12, .165], [0, 1.00, .035]);
    }
    this.belly = oval(this.body, cloth, [.18, .18, .13], [0, 1.05, .08]);
    this.belly.visible = false;
    capsule(this.body, skin, .062, .065, 1.60);
    // A neckline, necklace and small buttons give clothes readable detail.
    const neckline = new THREE.Mesh(new THREE.TorusGeometry(.073, .007, 5, 24, Math.PI), materials.colour('#eee0d1'));
    neckline.position.set(0, 1.49, .105); neckline.rotation.x = .5; neckline.rotation.z = Math.PI; this.body.add(neckline);
    if (!male && avatar.outfitStyle === 'knit') {
      for (let i = 0; i < 7; i++) {
        const stripe = capsule(this.body, materials.colour('#dfcbdc'), .003, .31, 1.2); stripe.position.x = -.13 + i * .045; stripe.position.z = .137;
      }
    }
    for (let i = 0; i < 3; i++) oval(this.body, materials.colour('#d7c9b7'), [.009, .009, .008], [0, 1.4 - i * .08, .143]);

    for (const sign of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sign * .205, 1.44, -.005); this.body.add(arm); this.arms.push(arm);
      capsule(arm, cloth, .068, .12, -.08);
      capsule(arm, doctor || male || avatar.outfitStyle === 'knit' ? cloth : skin, .046, .19, -.20);
      const elbow = new THREE.Group(); elbow.position.y = -.34; arm.add(elbow); this.elbows.push(elbow);
      capsule(elbow, doctor || avatar.outfitStyle === 'knit' ? cloth : skin, .038, .22, -.12);
      const hand = oval(elbow, skin, [.043, .068, .023], [0, -.30, .012]);
      oval(elbow, skin, [.02, .035, .019], [sign * -.04, -.278, .014]);
      for (let finger = 0; finger < 4; finger++) capsule(hand, skin, .014, .21, -.5 + finger % 2 * .04).position.x = -.58 + finger * .39;
    }

    this.head.position.set(0, 1.805, 0); this.body.add(this.head);
    oval(this.head, skin, [.175, .221, .164], [0, 0, 0], 28);
    oval(this.head, skin, [.12, .11, .117], [0, -.135, .035]);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * .58), hair);
    cap.scale.set(.184, .232, .18); cap.position.set(0, .01, -.027); cap.castShadow = true; this.head.add(cap);
    for (const sign of [-1, 1]) {
      oval(this.head, skin, [.035, .057, .032], [sign * .17, -.037, -.013]);
      oval(this.head, materials.colour('#eee7df'), [.038, .017, .018], [sign * .064, -.028, .154]);
      oval(this.head, materials.colour('#625346'), [.012, .016, .008], [sign * .064, -.029, .17]);
      oval(this.head, dark, [.006, .012, .006], [sign * .064, -.03, .177]);
      oval(this.head, white, [.004, .004, .004], [sign * .064 - .003, -.023, .181]);
      const eyebrow = oval(this.head, hair, [.038, .006, .008], [sign * .065, .009, .153]); eyebrow.rotation.z = sign * -.08;
      oval(this.head, materials.colour('#dea593'), [.036, .014, .004], [sign * .106, -.082, .133]);
      oval(this.head, hair, [.024, .11, .065], [sign * .16, .055, -.009]);
      if (!male) oval(this.head, materials.colour('#d4b779', .4, .55), [.011, .022, .008], [sign * .178, -.086, -.011]);
    }
    oval(this.head, skin, [.018, .043, .025], [0, -.066, .156]);
    const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.036, -.117, .136), new THREE.Vector3(0, -.138, .158), new THREE.Vector3(.036, -.117, .136));
    this.head.add(new THREE.Mesh(new THREE.TubeGeometry(smile, 12, .0045, 5, false), materials.colour('#a5746a')));
    // Swept fringe and actual strands keep the hairstyle from reading as a cap.
    for (let i = 0; i < 9; i++) {
      const x = -.14 + i * .034, curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x - .035, .18, .06), new THREE.Vector3(x + .016, .18, .173), new THREE.Vector3(x + .025, .085 + Math.abs(x) * .17, .156));
      this.head.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, .009, 6, false), hair));
    }
    if (!male) {
      if (avatar.hairstyle === 'bun') {
        oval(this.head, hair, [.094, .089, .085], [0, .255, -.09]);
        const tie = new THREE.Mesh(new THREE.TorusGeometry(.072, .009, 5, 20), materials.colour('#bcb095'));
        tie.position.set(0, .235, -.09); tie.rotation.x = Math.PI / 2; this.head.add(tie);
      } else {
        const length = avatar.hairstyle === 'long' ? .39 : .22;
        oval(this.head, hair, [.17, length, .077], [0, -.09, -.122]);
        for (const sign of [-1, 1]) {
          oval(this.head, hair, [.054, length * .82, .069], [sign * .15, -.065, -.037]);
          for (let i = 0; i < 3; i++) {
            const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(sign * (.145 + i * .009), .11, -.02), new THREE.Vector3(sign * .19, -.08, .015), new THREE.Vector3(sign * .155, -.05 - length * .85, -.008));
            this.head.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 15, .006, 5, false), hair));
          }
        }
      }
    }
    if (doctor) {
      const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(-.06, 1.58, .06), new THREE.Vector3(-.13, 1.32, .16), new THREE.Vector3(.09, 1.24, .18), new THREE.Vector3(.07, 1.57, .08)]);
      this.body.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 24, .009, 6, false), materials.colour('#607c7d')));
      oval(this.body, materials.colour('#b7bdb6', .5, .4), [.024, .025, .012], [.08, 1.2, .18]);
    }
    this.heldBaby = makeBaby(materials, avatar.skin, '#e0cab4'); this.heldBaby.position.set(.05, 1.10, .24);
    this.heldBaby.rotation.z = -1.18; this.heldBaby.rotation.x = .20; this.heldBaby.visible = false; this.body.add(this.heldBaby);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.19, 24), new THREE.MeshBasicMaterial({ color: '#514a4a', transparent: true, opacity: .11, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .013; shadow.userData.ownedMaterial = true; this.group.add(shadow);
  }

  setPregnant(value: boolean | number) {
    this.pregnancy = this.male ? 0 : typeof value === 'number' ? Math.max(0, Math.min(1, (value - 7) / 32)) : value ? .55 : 0;
    this.belly.visible = this.pregnancy > .01;
    this.belly.scale.set(.18 + this.pregnancy * .07, .17 + this.pregnancy * .11, .08 + this.pregnancy * .19);
    this.belly.position.z = .08 + this.pregnancy * .07;
  }
  setWalking(value: boolean) { this.walking = value; }
  setActivity(value: ActivityId | null) { this.activity = value; }
  setChildPresent(value: boolean) { this.childPresent = value; }
  setSitting(value: boolean | null) { this.sitting = value; }

  animate(dt: number, reducedMotion: boolean) {
    this.time += dt;
    const t = this.time, walking = this.walking && !reducedMotion, sitting = this.sitting ?? ['rest', 'scan', 'feed', 'skin', 'birth'].includes(this.activity ?? '');
    this.body.position.y = sitting ? -.32 : walking ? Math.abs(Math.sin(t * 7.5)) * .018 : reducedMotion ? 0 : Math.sin(t * 1.6) * .003;
    this.body.rotation.z = walking ? Math.sin(t * 7.5) * .012 : 0;
    this.body.rotation.x = this.activity === 'scan' || this.activity === 'birth' ? -.26 : this.activity === 'rest' ? -.08 : 0;
    this.head.rotation.y = walking ? 0 : !reducedMotion ? Math.sin(t * .45) * .035 : 0;
    for (let i = 0; i < 2; i++) {
      this.legs[i].rotation.x = walking ? Math.sin(t * 7.5 + i * Math.PI) * (.27 - this.pregnancy * .06) : sitting ? -1.05 : 0;
      this.knees[i].rotation.x = sitting ? 1.20 : walking ? Math.max(0, -Math.sin(t * 7.5 + i * Math.PI)) * .5 : .015;
      this.arms[i].rotation.x = walking ? Math.sin(t * 7.5 + (1 - i) * Math.PI) * .19 : 0;
      this.arms[i].rotation.z = i === 0 ? -.055 : .055; this.elbows[i].rotation.x = -.06;
    }
    const holding = this.childPresent && !this.male && ['feed', 'lullaby', 'read', 'skin', 'soothe'].includes(this.activity ?? '');
    this.heldBaby.visible = holding;
    if (holding) {
      this.arms[0].rotation.x = -.56; this.arms[0].rotation.z = -.12; this.elbows[0].rotation.x = -1.42;
      this.arms[1].rotation.x = -.48; this.arms[1].rotation.z = .20; this.elbows[1].rotation.x = -1.38;
      this.body.rotation.z = reducedMotion ? 0 : Math.sin(t * 1.65) * .017;
    } else if (['cook', 'pack', 'diaper', 'plant', 'assemble', 'sterilise', 'laundry', 'clean', 'tidy'].includes(this.activity ?? '')) {
      this.arms[0].rotation.x = -.48 + (reducedMotion ? 0 : Math.sin(t * 4.3) * .09); this.elbows[0].rotation.x = -.85;
      this.arms[1].rotation.x = -.55 + (reducedMotion ? 0 : Math.sin(t * 4.3 + 2) * .09); this.elbows[1].rotation.x = -.8;
    } else if (['talk', 'help', 'call', 'appointment'].includes(this.activity ?? '')) {
      this.arms[1].rotation.x = -.25; this.elbows[1].rotation.x = -.7 + (reducedMotion ? 0 : Math.sin(t * 2.7) * .12);
    } else if (['breathe', 'stretch', 'kick', 'birthplan'].includes(this.activity ?? '')) {
      this.arms[0].rotation.x = -.28; this.arms[1].rotation.x = -.28;
      this.elbows[0].rotation.x = -.9; this.elbows[1].rotation.x = -.9;
    }
  }
}
