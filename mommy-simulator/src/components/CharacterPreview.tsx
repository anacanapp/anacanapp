import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Character } from '../world/character';
import { Materials } from '../world/materials';
import type { Avatar } from '../game/types';

export function CharacterPreview({ avatar, pregnant = true }: { avatar: Avatar; pregnant?: boolean }) {
  const container = useRef<HTMLDivElement>(null), current = useRef({ avatar, pregnant }); current.current = { avatar, pregnant };
  const refresh = useRef<() => void>();
  useEffect(() => {
    const element = container.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, .1, 30), materials = new Materials();
    scene.add(new THREE.HemisphereLight('#fffae8', '#abbba7', 2.2));
    const light = new THREE.DirectionalLight('#fff0d2', 3); light.position.set(-2, 4, 4); scene.add(light);
    const rim = new THREE.DirectionalLight('#e8e6ff', 1.5); rim.position.set(3, 3, -3); scene.add(rim);
    let character: Character;
    const rebuild = () => {
      if (character) { scene.remove(character.group); character.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }
      character = new Character(materials, current.current.avatar); character.setPregnant(current.current.pregnant ? 26 : false);
      character.group.rotation.y = -.24; scene.add(character.group);
    };
    refresh.current = rebuild; rebuild();
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.48, .53, .065, 40), materials.colour('#dae0ce')); pedestal.position.y = -.025; scene.add(pedestal);
    camera.position.set(.1, 1.24, 4.7); camera.lookAt(0, 1.10, 0);
    const resize = () => { renderer.setSize(element.clientWidth, element.clientHeight); camera.aspect = element.clientWidth / element.clientHeight; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let frame = 0, last = 0, angle = -.24, drag = false, pointer = 0;
    const down = (event: PointerEvent) => { drag = true; pointer = event.clientX; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (drag) { angle += (event.clientX - pointer) * .012; pointer = event.clientX; } };
    const up = () => { drag = false; };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up);
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate); if (document.hidden || now - last < 1000 / 30) return;
      const dt = Math.min(.08, (now - (last || now)) / 1000); last = now;
      character.group.rotation.y = angle; character.animate(dt, false); renderer.render(scene, camera);
    }; frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); refresh.current = undefined; observer.disconnect(); scene.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); materials.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  useEffect(() => { refresh.current?.(); }, [avatar, pregnant]);
  return <div className="character-preview-3d" ref={container} aria-label={`${avatar.name} · 3D character`}><span className="character-preview-badge">3D</span></div>;
}
