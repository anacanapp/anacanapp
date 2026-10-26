import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = join(root, 'godot', 'assets');
const headers = { 'User-Agent': 'MommySimulator-AssetBuilder/0.3.1' };
const manifest = { provider: 'Poly Haven', license: 'CC0-1.0', licenseURL: 'https://polyhaven.com/license', models: [], textures: [], environments: [] };
const digest = (bytes, kind = 'sha256') => createHash(kind).update(bytes).digest('hex');
async function download(path, file) {
  const absolute = resolve(assets, path); if (!absolute.startsWith(assets + sep)) throw new Error('Unexpected asset path');
  await mkdir(dirname(absolute), { recursive: true });
  let bytes; try { bytes = await readFile(absolute); } catch {}
  if (!bytes || digest(bytes, 'md5') !== file.md5) {
    const response = await fetch(file.url, { headers }); if (!response.ok) throw new Error(`Asset download HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes, 'md5') !== file.md5) throw new Error(`Asset checksum mismatch: ${path}`);
    await writeFile(absolute, bytes);
  }
  return { file: path, bytes: bytes.length, sha256: digest(bytes), source: file.url };
}
async function metadata(id) {
  const responses = await Promise.all(['info', 'files'].map(type => fetch(`https://api.polyhaven.com/${type}/${id}`, { headers })));
  if (responses.some(response => !response.ok)) throw new Error(`Missing asset: ${id}`);
  return Promise.all(responses.map(response => response.json()));
}
for (const id of ['sofa_02', 'modern_arm_chair_01', 'modern_coffee_table_01', 'potted_plant_04',
  'wooden_bookshelf_worn', 'wooden_bowl_02', 'ceramic_vase_01', 'food_apple_01', 'wicker_basket_02', 'rock_face_01']) {
  const [info, files] = await metadata(id), gltf = files.gltf['1k'].gltf, downloaded = [];
  downloaded.push(await download(`${id}/${id}.gltf`, gltf));
  for (const [path, file] of Object.entries(gltf.include)) downloaded.push(await download(`${id}/${path}`, file));
  manifest.models.push({ id, name: info.name, authors: info.authors, triangles: info.polycount, files: downloaded });
  console.log(`${id}: ${downloaded.length} verified files`);
}
for (const id of ['wood_floor_deck', 'wood_floor', 'painted_plaster_wall', 'fabric_pattern_07', 'grass_ground', 'concrete_pavement',
  'rough_linen', 'cliff_side', 'bark_brown_02']) {
  const [info, files] = await metadata(id), maps = {};
  for (const [role, key] of Object.entries({ albedo: files.Diffuse ? 'Diffuse' : 'col_1', normal: 'nor_gl', roughness: 'Rough' })) {
    maps[role] = await download(`materials/${id}/${role}.jpg`, files[key]['1k'].jpg);
  }
  manifest.textures.push({ id, name: info.name, authors: info.authors, maps }); console.log(`${id}: 3 verified PBR maps`);
}
for (const id of ['kloofendal_48d_partly_cloudy_puresky']) {
  const [info, files] = await metadata(id);
  const file = await download(`environments/${id}.hdr`, files.hdri['1k'].hdr);
  manifest.environments.push({ id, name: info.name, authors: info.authors, file });
  console.log(`${id}: verified 1K HDR lighting environment`);
}
await writeFile(join(assets, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n');
