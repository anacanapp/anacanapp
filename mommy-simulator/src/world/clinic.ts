import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Materials } from './materials';

export function buildClinic(materials: Materials): THREE.Group {
  const group = new THREE.Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, colour: string, radius = .035) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), materials.colour(colour));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const cylinder = (r: number, h: number, x: number, y: number, z: number, colour: string) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), materials.colour(colour)); mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh); return mesh;
  };
  const tag = (object: THREE.Object3D, id: string) => { object.userData.interactive = id; };
  box(11.5, .44, 9.6, 0, -.01, .2, '#c7ccc5', .16);
  box(11.4, .07, 9.5, 0, .25, .2, '#e7e8df', .03);
  for (let x = -5.5; x < 5.7; x += .65) box(.008, .009, 9.25, x, .295, .2, '#d5d9d0', 0);
  for (let z = -4.4; z < 4.9; z += .65) box(11.2, .009, .008, 0, .295, z, '#d5d9d0', 0);
  box(11.4, 3.05, .18, 0, 1.8, -4.55, '#e6e8df');
  box(.18, 3.05, 9.4, -5.6, 1.8, .2, '#dde5dd');
  box(.18, 1.1, 9.4, 5.6, .81, .2, '#e6e8df');
  box(.18, .8, 3.8, .2, .71, -2.6, '#d3ddda');
  box(.18, .8, 2.2, .2, .71, 3.7, '#d3ddda');
  box(11.45, .065, .23, 0, 3.34, -4.55, '#fbf7ef');
  // Clinic windows and soft Roman blinds.
  for (const x of [-3.9, 3.75]) {
    box(2.1, 1.1, .07, x, 2.25, -4.42, '#f9f7f0'); box(1.95, .95, .04, x, 2.25, -4.36, '#c0d4d7');
    box(.035, .95, .035, x, 2.25, -4.31, '#f7f7ee'); box(2.08, .18, .16, x, 2.86, -4.34, '#e5decc');
    box(2.16, .06, .27, x, 1.66, -4.31, '#f5f2e9');
  }
  // Birth bed: wheels, adjustable back, rails, linen and pillows.
  const birthObjects: THREE.Mesh[] = [];
  for (const x of [2.15, 3.85]) for (const z of [-.3, 2.05]) {
    birthObjects.push(cylinder(.105, .055, x, .36, z, '#778986')); birthObjects[birthObjects.length - 1].rotation.z = Math.PI / 2;
    birthObjects.push(box(.065, .35, .065, x, .57, z, '#abb7ad'));
  }
  birthObjects.push(box(1.85, .21, 2.6, 3, .83, .95, '#c0cbc0', .12));
  birthObjects.push(box(1.68, .16, 2.43, 3, 1.01, .95, '#f3f0e4', .11));
  birthObjects.push(box(1.6, .08, 1.3, 3, 1.13, 1.35, '#b0c8be', .07));
  birthObjects.push(box(1.5, .16, .58, 3, 1.18, -.02, '#fbf4e8', .09));
  for (const x of [2.03, 3.97]) {
    birthObjects.push(box(.042, .048, 2.1, x, 1.24, 1.08, '#b2b9a8', .012));
    for (const z of [.18, 1.93]) birthObjects.push(box(.042, .40, .035, x, 1.05, z, '#b2b9a8', .01));
  }
  birthObjects.forEach(o => tag(o, 'birthbed'));
  // CTG monitor cart and screen with a real waveform illustration.
  box(.64, .055, .52, 4.67, 1.2, -.7, '#b9c6bd'); cylinder(.043, .83, 4.67, .8, -.7, '#9dab9f');
  box(.6, .43, .08, 4.67, 1.55, -.88, '#586c68');
  const screen = document.createElement('canvas'); screen.width = 320; screen.height = 180;
  const c = screen.getContext('2d')!; c.fillStyle = '#203f3e'; c.fillRect(0, 0, 320, 180);
  c.strokeStyle = '#3c5c54'; c.lineWidth = 1;
  for (let x = 0; x < 320; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 180); c.stroke(); }
  for (let y = 0; y < 180; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(320, y); c.stroke(); }
  c.strokeStyle = '#a1d3b2'; c.lineWidth = 2; c.beginPath();
  for (let x = 0; x < 320; x++) { const spike = x % 75; const y = 88 + (spike > 25 && spike < 32 ? -Math.sin((spike - 25) / 7 * Math.PI) * 44 : Math.sin(x * .2) * 3); if (!x) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
  c.fillStyle = '#c8e0cb'; c.font = 'bold 22px sans-serif'; c.fillText('ANACAN', 15, 28);
  const tex = new THREE.CanvasTexture(screen); tex.colorSpace = THREE.SRGBColorSpace;
  const monitor = new THREE.Mesh(new THREE.PlaneGeometry(.54, .34), new THREE.MeshBasicMaterial({ map: tex })); monitor.position.set(4.67, 1.56, -.83); group.add(monitor);
  // Sonography examination couch and probe trolley.
  const scannerObjects: THREE.Mesh[] = [];
  scannerObjects.push(box(1.05, .27, 2.1, -2.1, .95, -2.48, '#c3d1c8', .10));
  scannerObjects.push(box(1.02, .095, 1.94, -2.1, 1.14, -2.48, '#f3eedf', .08));
  scannerObjects.push(box(.8, .09, .36, -2.1, 1.24, -3.2, '#fff6e5', .065));
  for (const z of [-3.1, -1.7]) scannerObjects.push(box(.08, .64, .08, -2.1, .57, z, '#adb8ac'));
  scannerObjects.push(box(.83, .84, .63, -3.7, .7, -2.5, '#d7ded4', .08));
  scannerObjects.push(box(.75, .095, .62, -3.7, 1.2, -2.48, '#b8c5b7'));
  scannerObjects.push(box(.77, .6, .10, -3.7, 1.65, -2.65, '#5e7775'));
  scannerObjects.push(box(.66, .48, .04, -3.7, 1.66, -2.58, '#899c8f'));
  scannerObjects.push(box(.6, .026, .26, -3.7, 1.265, -2.23, '#aebca9'));
  for (let i = 0; i < 7; i++) scannerObjects.push(box(.026, .01, .024, -3.95 + i * .073, 1.29, -2.24, '#f1eee2', .003));
  scannerObjects.forEach(o => tag(o, 'scanner'));
  const wire = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.45, 1.2, -2.5), new THREE.Vector3(-3.13, .4, -2.3), new THREE.Vector3(-2.75, .6, -2.0), new THREE.Vector3(-2.9, 1.28, -2.3)]);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(wire, 25, .011, 6, false), materials.colour('#6b8076')); group.add(cord); tag(cord, 'scanner');
  // Doctor desk, drawers, clipboard and a chair.
  const doctorObjects: THREE.Mesh[] = [];
  doctorObjects.push(box(1.82, .09, .88, -3.72, 1.04, 1.46, '#c8b492', .08));
  for (const x of [-4.43, -3.01]) doctorObjects.push(box(.10, .7, .68, x, .67, 1.46, '#b3bba8'));
  doctorObjects.push(box(.32, .045, .4, -3.9, 1.12, 1.40, '#b1c3b9'));
  doctorObjects.push(box(.29, .008, .36, -3.9, 1.15, 1.40, '#f5eedc'));
  doctorObjects.push(box(.56, .35, .055, -3.3, 1.29, 1.22, '#677e76'));
  doctorObjects.push(box(.4, .06, .4, -3.8, .73, 2.3, '#b8c9be'));
  doctorObjects.push(box(.43, .53, .07, -3.8, .99, 2.48, '#b8c9be'));
  doctorObjects.forEach(o => tag(o, 'doctor'));
  // A proper bassinet and changing station for the post-birth chapter.
  for (const x of [1.0, 1.6]) for (const z of [2.8, 3.8]) box(.035, .65, .035, x, .65, z, '#b7bdae');
  box(.78, .16, 1.14, 1.3, 1.01, 3.3, '#e8e2ce', .12);
  box(.70, .055, 1.04, 1.3, 1.115, 3.3, '#f4eadb', .09);
  const dresser = box(1.36, .8, .76, 4.5, .72, 3.8, '#d1d7c6', .06); tag(dresser, 'clinicdresser');
  tag(box(1.42, .045, .82, 4.5, 1.15, 3.8, '#e5dcc4'), 'clinicdresser');
  tag(box(.88, .06, .52, 4.38, 1.21, 3.8, '#d9c6d5', .07), 'clinicdresser');
  // Reception bench, door, signage and floor runner.
  const reception = box(1.68, .40, .65, -1.74, .54, 3.8, '#ccbfa4', .09); tag(reception, 'reception');
  tag(box(1.68, .36, .14, -1.74, .88, 4.04, '#d2c7b1', .08), 'reception');
  box(.85, .012, 3.4, -.35, .302, 1.8, '#c7d4c5', .05);
  box(1.1, 2.40, .07, -.40, 1.56, -4.4, '#b9c8bd');
  box(.83, .5, .025, -.40, 2.05, -4.34, '#cedddc');
  box(.07, .16, .04, -.05, 1.30, -4.30, '#a1a58b');
  const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 128;
  const sc = signCanvas.getContext('2d')!; sc.fillStyle = '#f3f0e5'; sc.fillRect(0, 0, 512, 128); sc.fillStyle = '#6d8980'; sc.font = 'bold 46px sans-serif'; sc.textAlign = 'center'; sc.fillText('ANACAN', 256, 58); sc.font = '18px sans-serif'; sc.fillText('FAMILY CLINIC', 256, 95);
  const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .45), new THREE.MeshBasicMaterial({ map: signTexture })); sign.position.set(1.4, 2.5, -4.42); group.add(sign);
  for (const [x, z] of [[-5.0, 3.8], [4.8, -3.6]]) {
    cylinder(.18, .35, x, .46, z, '#bca484'); cylinder(.018, .75, x, .98, z, '#909870');
    for (let i = 0; i < 6; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), materials.colour('#9bac8d')); leaf.scale.set(.12, .2, .04); leaf.position.set(x + Math.sin(i * 2.4) * .12, .9 + i * .06, z + Math.cos(i * 2.4) * .1); leaf.rotation.z = Math.cos(i) * .7; group.add(leaf); }
  }
  return group;
}
