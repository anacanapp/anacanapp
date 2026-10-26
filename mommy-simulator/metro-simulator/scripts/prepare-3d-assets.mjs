import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = fileURLToPath(new URL('../../godot/assets/', import.meta.url));
const manifest = { version: 2, sources: [], original: 'Train, platform, station architecture, props and clothing accessories are original procedural 3D meshes.', files: [] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function output(relative, bytes, attribution) {
  const path = join(root, 'assets', relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  manifest.files.push({ file: `assets/${relative}`, bytes: bytes.length, sha256: hash(bytes), ...attribution });
}
const characterNames = ['mother.gltf', 'mother.bin', 'partner.gltf', 'partner.bin', 'animations.glb',
  'Hair_Buns.gltf', 'Hair_Buns.bin', 'Hair_SimpleParted.gltf', 'Hair_SimpleParted.bin',
  'T_Eye_Brown.png', 'T_Eye_Normal_png.png', 'T_Hair_1_BaseColor.png', 'T_Hair_1_Normal_png.png', 'T_Hair_1_Normal.png',
  'T_Hair_2_BaseColor.png', 'T_Hair_2_Normal.png', 'T_Superhero_Male_Dark.png', 'T_Superhero_Male_Normal.png',
  'T_Superhero_Male_Roughness.png', 'T_Superhero_Female_Dark_BaseColor.png', 'T_Superhero_Female_Normal.png',
  'T_Superhero_Female_Roughness.png', 'LICENSE.txt', 'ANIMATION_LICENSE.txt'];
for (const name of characterNames) {
  const bytes = await readFile(join(source, 'characters', name));
  await output(`characters/${name}`, bytes, { source: 'https://quaternius.com/packs/universalbasecharacters.html', license: 'CC0-1.0' });
}
await output('materials/fabric-normal.png', await readFile(join(source, 'details/cotton-normal.png')), { source: 'Original procedural cotton weave', license: 'Original project artwork' });
for (const [texture, localName] of [['concrete_pavement', 'concrete'], ['painted_plaster_wall', 'plaster'], ['rough_linen', 'fabric']]) {
  for (const map of ['albedo', 'normal', 'roughness']) {
    await output(`materials/${localName}/${map}.jpg`, await readFile(join(source, `materials/${texture}/${map}.jpg`)), { source: `https://polyhaven.com/a/${texture}`, license: 'CC0-1.0' });
  }
}
for (const [id, local] of [['marble_01', 'marble'], ['metal_plate', 'metal']]) {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!response.ok) throw new Error(`PBR manifest ${id}: ${response.status}`);
  const files = await response.json();
  for (const [key, name] of [['Diffuse', 'albedo'], ['nor_gl', 'normal'], ['Rough', 'roughness']]) {
    const record = files[key]['1k'].jpg;
    const path = join(root, `assets/materials/${local}/${name}.jpg`);
    let bytes;
    try { bytes = await readFile(path); } catch {
      const download = await fetch(record.url);
      if (!download.ok) throw new Error(`PBR ${id}/${key}: ${download.status}`);
      bytes = Buffer.from(await download.arrayBuffer());
    }
    if (createHash('md5').update(bytes).digest('hex') !== record.md5) throw new Error(`PBR checksum ${id}/${key}`);
    await output(`materials/${local}/${name}.jpg`, bytes, { source: record.url, license: 'CC0-1.0' });
  }
}
// Soft shadows and scratches are original textures; no screen-space blur assets.
const shadowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><radialGradient id="s"><stop stop-color="#000" stop-opacity=".7"/><stop offset=".45" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><circle cx="128" cy="128" r="126" fill="url(#s)"/></svg>`;
await output('materials/contact-shadow.png', await sharp(Buffer.from(shadowSvg)).png().toBuffer(), { source: 'Original radial contact shadow' });
await writeFile(join(root, 'assets/3d-provenance.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`METRO 3D: ${manifest.files.length} licensed model/animation/PBR maps ready.`);
