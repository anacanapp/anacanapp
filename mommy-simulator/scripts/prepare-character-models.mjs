import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url)), directory = join(root, 'godot/assets/characters');
await mkdir(directory, { recursive: true });
const archive = join(root, 'artifacts/character-source/universal-base-characters.zip');
const prefix = 'Universal Base Characters[Standard]/Base Characters/Godot - UE/';
const extract = (zip, member) => execFileSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);p=sys.argv[2];p=p if p in z.namelist() else p.replace("_png.png",".png");sys.stdout.buffer.write(z.read(p))', zip, member], { maxBuffer: 30 * 1024 * 1024 });
const manifest = { provider: 'Quaternius / Tomás Laulhé', license: 'CC0-1.0', source: 'https://quaternius.com/packs/universalbasecharacters.html', modifications: 'Mobile 1K textures; separately skinned relaxed jersey and trouser shell geometry, clothing masks; only required models and animations extracted', files: [] };
async function output(name, bytes) {
  const path = join(directory, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  manifest.files.push({ file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const [source, name] of [['Superhero_Female_FullBody', 'mother'], ['Superhero_Male_FullBody', 'partner']]) {
  const data = JSON.parse(extract(archive, prefix + source + '.gltf').toString());
  for (const buffer of data.buffers) {
    let bytes = extract(archive, prefix + buffer.uri); buffer.uri = `${name}.bin`;
    const bodyMeshes = new Set(data.nodes.filter(node => /Super/i.test(node.name ?? '') && node.mesh !== undefined).map(node => node.mesh));
    for (const [meshIndex, mesh] of data.meshes.entries()) if (bodyMeshes.has(meshIndex) || /Super/i.test(mesh.name)) for (const primitive of mesh.primitives) {
      const accessor = data.accessors[primitive.attributes.POSITION], view = data.bufferViews[accessor.bufferView], colours = Buffer.alloc(accessor.count * 16);
      for (let index = 0; index < accessor.count; index++) {
        const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + index * (view.byteStride ?? 12);
        const x = bytes.readFloatLE(offset), y = bytes.readFloatLE(offset + 4), z = bytes.readFloatLE(offset + 8);
        const shirt = y > .89 && y < 1.565 && Math.abs(x) < .35 || Math.abs(x) >= .24 && Math.abs(x) < .65 && y > 1.30;
        const trousers = y > .10 && y <= 1.02 && Math.abs(x) < .26;
        const belly = name === 'mother' && z > .015 && Math.abs(x) < .20 && y > .86 && y < 1.30 ? Math.max(0, 1 - ((y - 1.06) / .24) ** 2) * Math.max(0, 1 - (x / .22) ** 2) : 0;
        colours.writeFloatLE(shirt ? 1 : 0, index * 16); colours.writeFloatLE(!shirt && trousers ? 1 : 0, index * 16 + 4);
        colours.writeFloatLE(!shirt && !trousers ? 1 : 0, index * 16 + 8); colours.writeFloatLE(belly, index * 16 + 12);
      }
      const padding = Buffer.alloc((4 - bytes.length % 4) % 4), offset = bytes.length + padding.length;
      bytes = Buffer.concat([bytes, padding, colours]);
      const bufferView = data.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: colours.length, target: 34962 }) - 1;
      primitive.attributes.COLOR_0 = data.accessors.push({ bufferView, componentType: 5126, count: accessor.count, type: 'VEC4' }) - 1;
      const bodyNodeIndex = data.nodes.findIndex(node => node.mesh === meshIndex);
      const bodyNode = data.nodes[bodyNodeIndex];
      const indexAccessor = data.accessors[primitive.indices], indexView = data.bufferViews[indexAccessor.bufferView];
      const indexWidth = indexAccessor.componentType === 5125 ? 4 : 2;
      const triangles = Array.from({ length: indexAccessor.count }, (_, index) => {
        const at = (indexView.byteOffset ?? 0) + (indexAccessor.byteOffset ?? 0) + index * indexWidth;
        return indexWidth === 4 ? bytes.readUInt32LE(at) : bytes.readUInt16LE(at);
      });
      for (const [role, channel] of [['Jersey', 0], ['Trousers', 1]]) {
        const selected = [];
        for (let index = 0; index < triangles.length; index += 3) {
          const triangle = triangles.slice(index, index + 3);
          if (triangle.reduce((sum, vertex) => sum + colours.readFloatLE(vertex * 16 + channel * 4), 0) >= 2) selected.push(...triangle);
        }
        const positions = Array.from({ length: accessor.count }, (_, vertex) => {
          const at = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + vertex * (view.byteStride ?? 12);
          return [bytes.readFloatLE(at), bytes.readFloatLE(at + 4), bytes.readFloatLE(at + 8)];
        });
        const neighbours = new Map();
        for (let index = 0; index < selected.length; index += 3) for (const vertex of selected.slice(index, index + 3)) {
          if (!neighbours.has(vertex)) neighbours.set(vertex, new Set());
          selected.slice(index, index + 3).filter(other => other !== vertex).forEach(other => neighbours.get(vertex).add(other));
        }
        // Smooth anatomical grooves to a looser textile silhouette while retaining the rig/UVs.
        for (let iteration = 0; iteration < 7; iteration++) {
          const previous = positions.map(position => [...position]);
          for (const [vertex, adjacent] of neighbours) {
            const blend = channel === 0 ? .38 : .23;
            for (let axis = 0; axis < 3; axis++) positions[vertex][axis] = previous[vertex][axis] * (1 - blend) + [...adjacent].reduce((sum, other) => sum + previous[other][axis], 0) / adjacent.size * blend;
          }
        }
        const normalAccessor = data.accessors[primitive.attributes.NORMAL], normalView = data.bufferViews[normalAccessor.bufferView];
        const shell = Buffer.alloc(accessor.count * 12);
        for (let vertex = 0; vertex < accessor.count; vertex++) for (let axis = 0; axis < 3; axis++) {
          const at = (normalView.byteOffset ?? 0) + (normalAccessor.byteOffset ?? 0) + vertex * (normalView.byteStride ?? 12) + axis * 4;
          shell.writeFloatLE(positions[vertex][axis] + bytes.readFloatLE(at) * .026, vertex * 12 + axis * 4);
        }
        const indices = Buffer.alloc(selected.length * 2); selected.forEach((vertex, index) => indices.writeUInt16LE(vertex, index * 2));
        const append = (payload, componentType, count, type, target) => {
          const padding = Buffer.alloc((4 - bytes.length % 4) % 4), at = bytes.length + padding.length;
          bytes = Buffer.concat([bytes, padding, payload]);
          const bufferView = data.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: payload.length, target }) - 1;
          return data.accessors.push({ bufferView, componentType, count, type }) - 1;
        };
        const attributes = { ...primitive.attributes, POSITION: append(shell, 5126, accessor.count, 'VEC3', 34962) };
        const shellMesh = data.meshes.push({ name: role, primitives: [{ attributes, indices: append(indices, 5123, selected.length, 'SCALAR', 34963), material: primitive.material }] }) - 1;
        const nodeIndex = data.nodes.push({ ...bodyNode, name: role, mesh: shellMesh, children: undefined }) - 1;
        const parent = data.nodes.find(node => node.children?.includes(bodyNodeIndex));
        if (parent) parent.children.push(nodeIndex); else data.scenes[data.scene].nodes.push(nodeIndex);
      }
    }
    buffer.byteLength = bytes.length; await output(buffer.uri, bytes);
  }
  for (const image of data.images ?? []) {
    const bytes = extract(archive, prefix + decodeURIComponent(image.uri));
    const dest = decodeURIComponent(image.uri).replace(/[^a-zA-Z0-9_.-]/g, '_'); image.uri = dest;
    await output(dest, await sharp(bytes).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).png().toBuffer());
  }
  await output(`${name}.gltf`, Buffer.from(JSON.stringify(data)));
}
const hairPrefix = 'Universal Base Characters[Standard]/Hairstyles/Origin at 0/glTF (Godot)/';
for (const name of ['Hair_Buns', 'Hair_SimpleParted', 'Eyebrows_Female', 'Eyebrows_Regular']) {
  const data = JSON.parse(extract(archive, hairPrefix + name + '.gltf').toString());
  for (const buffer of data.buffers) await output(buffer.uri, extract(archive, hairPrefix + buffer.uri));
  for (const image of data.images ?? []) {
    const dest = decodeURIComponent(image.uri); image.uri = dest;
    await output(dest, await sharp(extract(archive, hairPrefix + dest)).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).png().toBuffer());
  }
  await output(name + '.gltf', Buffer.from(JSON.stringify(data)));
}
await output('animations.glb', extract(join(root, 'artifacts/character-source/universal-animation-library.zip'), 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'));
await output('LICENSE.txt', extract(archive, 'Universal Base Characters[Standard]/License_Standard.txt'));
await output('ANIMATION_LICENSE.txt', extract(join(root, 'artifacts/character-source/universal-animation-library.zip'), 'Universal Animation Library[Standard]/License.txt'));
await output('ANIMATION_README.txt', extract(join(root, 'artifacts/character-source/universal-animation-library.zip'), 'Universal Animation Library[Standard]/README.txt'));
await writeFile(join(directory, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(root, 'godot/assets/icon.png'), await readFile(join(root, 'public/assets/icon-1024.png')));
console.log('Rigged mother/partner, hairstyles and official animation library prepared.');
