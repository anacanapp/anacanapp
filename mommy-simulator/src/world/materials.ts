import * as THREE from 'three';

export class Materials {
  private colours = new Map<string, THREE.MeshStandardMaterial>();
  private patterns = new Map<string, THREE.MeshStandardMaterial>();
  textures: THREE.Texture[] = [];

  colour(colour: string, roughness = .86, metalness = 0) {
    const key = `${colour}:${roughness}:${metalness}`;
    if (!this.colours.has(key)) this.colours.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness, metalness }));
    return this.colours.get(key)!;
  }

  fabric(colour: string, knitted = false) {
    const key = `fabric:${colour}:${knitted}`;
    if (this.patterns.has(key)) return this.patterns.get(key)!;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = '#a8a8a8'; c.fillRect(0, 0, 256, 256);
    let seed = 247;
    const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    for (let y = 0; y < 256; y += knitted ? 9 : 4) for (let x = 0; x < 256; x += knitted ? 7 : 4) {
      c.strokeStyle = `rgba(255,255,255,${.18 + random() * .3})`; c.lineWidth = knitted ? 2.1 : 1.1;
      c.beginPath(); c.moveTo(x + 1, y); c.quadraticCurveTo(x + (knitted ? 7 : 4), y + 3, x + 1, y + (knitted ? 8 : 3)); c.stroke();
      c.fillStyle = `rgba(35,35,35,${random() * .22})`; c.fillRect(x, y, 1, knitted ? 5 : 2);
    }
    const bump = new THREE.CanvasTexture(canvas); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(3, 3); bump.anisotropy = 4; this.textures.push(bump);
    const material = new THREE.MeshStandardMaterial({ color: colour, roughness: 1, bumpMap: bump, bumpScale: knitted ? .035 : .017 });
    this.patterns.set(key, material); return material;
  }

  wallpaper(base: string, accent: string) {
    const key = `wallpaper:${base}:${accent}`;
    if (this.patterns.has(key)) return this.patterns.get(key)!;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512; const c = canvas.getContext('2d')!;
    c.fillStyle = base; c.fillRect(0, 0, 512, 512);
    for (let x = 48; x < 512; x += 104) for (let y = 44; y < 512; y += 103) {
      const tx = x + (Math.floor(y / 103) % 2 ? 36 : 0); c.fillStyle = '#f5efda';
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.ellipse(tx + Math.cos(a) * 10, y + Math.sin(a) * 10, 9, 6, a, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = accent; c.beginPath(); c.arc(tx, y, 6, 0, Math.PI * 2); c.fill();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.8, 1); texture.anisotropy = 4; this.textures.push(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .93 }); this.patterns.set(key, material); return material;
  }

  wood(base: string, grain: string) {
    const key = `wood:${base}:${grain}`;
    if (this.patterns.has(key)) return this.patterns.get(key)!;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = base; c.fillRect(0, 0, 256, 256);
    let random = 773;
    const rand = () => { random = (random * 1664525 + 1013904223) >>> 0; return random / 4294967296; };
    for (let plank = 0; plank < 8; plank++) {
      const y = plank * 32;
      c.fillStyle = `rgba(255,255,255,${rand() * .13})`; c.fillRect(0, y, 256, 32);
      c.strokeStyle = grain; c.globalAlpha = .12; c.lineWidth = .65;
      for (let j = 0; j < 7; j++) {
        c.beginPath(); c.moveTo(0, y + j * 4 + 3); c.bezierCurveTo(75, y + j * 4 + rand() * 3, 170, y + j * 4 + rand() * 3, 256, y + j * 4 + 3); c.stroke();
      }
      c.globalAlpha = .24; c.fillStyle = grain; c.fillRect(0, y, 256, 1);
      c.fillRect(plank % 2 ? 70 : 160, y, 1, 32);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2);
    texture.anisotropy = 4; this.textures.push(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .86 });
    this.patterns.set(key, material); return material;
  }

  rug(base: string, accent: string, kind: 'stripe' | 'flower' | 'dots' = 'stripe') {
    const key = `rug:${base}:${accent}:${kind}`;
    if (this.patterns.has(key)) return this.patterns.get(key)!;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d')!; c.fillStyle = base; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = accent; c.fillStyle = accent; c.globalAlpha = .55; c.lineWidth = 4;
    if (kind === 'stripe') {
      for (let i = 20; i < 256; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); }
      c.globalAlpha = .8; c.strokeRect(14, 14, 228, 228);
    } else if (kind === 'dots') {
      for (let x = 14; x < 256; x += 32) for (let y = 14; y < 256; y += 32) { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
      c.lineWidth = 8; c.strokeRect(10, 10, 236, 236);
    } else {
      c.translate(128, 128);
      for (let i = 0; i < 8; i++) {
        c.rotate(Math.PI / 4); c.beginPath(); c.ellipse(0, 54, 20, 50, 0, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#fff9e9'; c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = .06; c.fillStyle = '#ffffff';
    for (let y = 0; y < 256; y += 3) c.fillRect(0, y, 256, 1);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(texture); const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
    this.patterns.set(key, material); return material;
  }

  dispose() { this.colours.forEach(m => m.dispose()); this.patterns.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); }
}
