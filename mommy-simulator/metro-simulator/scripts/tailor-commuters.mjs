import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Original sewn garment geometry, skinned to the licensed commuter rig. The
// clothes have continuous hems/cuffs/collar instead of cut body triangles.
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'assets/characters');
const records = [];
for (const name of ['partner', 'mother']) {
  const gltf = JSON.parse(await readFile(join(directory, `${name}.gltf`), 'utf8'));
  let bin = await readFile(join(directory, `${name}.bin`));
  const bodyMesh = gltf.meshes[gltf.nodes.find(node => /Super/i.test(node.name) && node.mesh !== undefined).mesh];
  const body = bodyMesh.primitives[0];
  const accessor = index => {
    const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
    return { ...a, offset: (view.byteOffset || 0) + (a.byteOffset || 0), stride: view.byteStride || ({ VEC2: 2, VEC3: 3, VEC4: 4, SCALAR: 1 }[a.type]) * (a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1) };
  };
  const p = accessor(body.attributes.POSITION), j = accessor(body.attributes.JOINTS_0), wt = accessor(body.attributes.WEIGHTS_0);
  const vertexPositions = Array.from({ length: p.count }, (_, i) => [0, 1, 2].map(axis => bin.readFloatLE(p.offset + i * p.stride + axis * 4)));
  const nearestWeight = point => {
    let nearest = 0, distance = Infinity;
    for (let index = 0; index < vertexPositions.length; index++) {
      const source = vertexPositions[index];
      const d = source.reduce((sum, value, axis) => sum + (value - point[axis]) ** 2, 0);
      if (d < distance) { nearest = index; distance = d; }
    }
    const joints = [0, 1, 2, 3].map(axis => j.componentType === 5123 ? bin.readUInt16LE(j.offset + nearest * j.stride + axis * 2) : bin.readUInt8(j.offset + nearest * j.stride + axis));
    const weights = [0, 1, 2, 3].map(axis => bin.readFloatLE(wt.offset + nearest * wt.stride + axis * 4));
    return { joints, weights };
  };
  const append = (data, componentType, count, type, target) => {
    const pad = Buffer.alloc((4 - bin.length % 4) % 4), offset = bin.length + pad.length;
    bin = Buffer.concat([bin, pad, data]);
    const bufferView = gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, target }) - 1;
    return gltf.accessors.push({ bufferView, componentType, count, type }) - 1;
  };
  function meshBuilder() {
    const vertices = [], indices = [];
    const addVertex = (point, normal, uv, detail = 0) => {
      const skin = nearestWeight(point);
      vertices.push({ point, normal, uv, detail, ...skin });
      return vertices.length - 1;
    };
    const ringSurface = (rings, segments, point, normal, detail = 0) => {
      const start = vertices.length;
      for (let ring = 0; ring < rings; ring++) for (let segment = 0; segment <= segments; segment++) {
        const a = segment * Math.PI * 2 / segments;
        addVertex(point(ring, a), normal(ring, a), [segment / segments, ring / (rings - 1)], detail);
      }
      for (let ring = 0; ring < rings - 1; ring++) for (let segment = 0; segment < segments; segment++) {
        const a = start + ring * (segments + 1) + segment, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    };
    const finish = material => {
      const floats = (key, width) => {
        const bytes = Buffer.alloc(vertices.length * width * 4);
        vertices.forEach((v, index) => v[key].forEach((value, axis) => bytes.writeFloatLE(value, (index * width + axis) * 4)));
        return bytes;
      };
      const joints = Buffer.alloc(vertices.length * 8), colors = Buffer.alloc(vertices.length * 16);
      vertices.forEach((v, index) => {
        v.joints.forEach((value, axis) => joints.writeUInt16LE(value, index * 8 + axis * 2));
        [v.detail, 0, 0, 1].forEach((value, axis) => colors.writeFloatLE(value, index * 16 + axis * 4));
      });
      const triangles = Buffer.alloc(indices.length * 2);
      indices.forEach((value, index) => triangles.writeUInt16LE(value, index * 2));
      return { attributes: {
        POSITION: append(floats('point', 3), 5126, vertices.length, 'VEC3', 34962),
        NORMAL: append(floats('normal', 3), 5126, vertices.length, 'VEC3', 34962),
        TEXCOORD_0: append(floats('uv', 2), 5126, vertices.length, 'VEC2', 34962),
        JOINTS_0: append(joints, 5123, vertices.length, 'VEC4', 34962),
        WEIGHTS_0: append(floats('weights', 4), 5126, vertices.length, 'VEC4', 34962),
        COLOR_0: append(colors, 5126, vertices.length, 'VEC4', 34962),
      }, indices: append(triangles, 5123, indices.length, 'SCALAR', 34963), material };
    };
    return { ringSurface, finish, vertices };
  }
  const female = name === 'mother';
  const torso = [
    [0.885, 0.246, 0.161], [0.91, 0.248, 0.163], [1.02, 0.244, 0.177], [1.16, 0.257, 0.181],
    [1.32, 0.288, 0.181], [1.445, 0.291, 0.167], [1.505, 0.258, 0.148], [1.55, 0.112, 0.100],
  ];
  const shirt = meshBuilder();
  const circumference = (rx, rz, a) => [Math.cos(a) / rx, 0, Math.sin(a) / rz];
  shirt.ringSurface(torso.length, 40,
    (i, a) => {
      const [y, rx, rz] = torso[i];
      const fold = Math.sin(a * 7 + y * 30) * .003 + Math.sin(a * 13 - y * 28) * .002;
      return [(rx * (female ? .94 : 1) + fold) * Math.cos(a), y, (rz + fold) * Math.sin(a) - .012];
    },
    (i, a) => { const normal = circumference(torso[i][1], torso[i][2], a); const length = Math.hypot(...normal); return normal.map(v => v / length); });
  // Long sleeves are in the original T-pose; copied rig weights bend elbow/cuff.
  for (const side of [-1, 1]) {
    shirt.ringSurface(9, 24,
      (i, a) => {
        const x = side * (.245 + i * .051), radius = .105 - i * .004;
        return [x, 1.455 + Math.cos(a) * radius, -.045 + Math.sin(a) * radius * .98];
      }, (_, a) => [0, Math.cos(a), Math.sin(a)]);
    shirt.ringSurface(2, 24,
      (i, a) => [side * (.639 + i * .027), 1.455 + Math.cos(a) * .075, -.045 + Math.sin(a) * .072],
      (_, a) => [0, Math.cos(a), Math.sin(a)], .3);
  }
  shirt.ringSurface(2, 40, (i, a) => [.113 * Math.cos(a), 1.545 + i * .022, .103 * Math.sin(a) - .012], (_, a) => [Math.cos(a), 0, Math.sin(a)], .3);
  shirt.ringSurface(2, 40, (i, a) => [.25 * Math.cos(a), .888 + i * .022, .165 * Math.sin(a) - .012], (_, a) => [Math.cos(a), 0, Math.sin(a)], .18);
  const jerseyMesh = gltf.meshes.find(mesh => mesh.name === 'Jersey');
  jerseyMesh.primitives = [shirt.finish(body.material)];
  const trousers = meshBuilder();
  for (const side of [-1, 1]) {
    trousers.ringSurface(12, 24,
      (i, a) => {
        const y = .13 + i * .067, rx = .083 + i * .0022, rz = .082 + i * .0053;
        const fold = .0035 * Math.sin(a * 5 + i * 1.4);
        return [side * (.114 - Math.max(0, i - 8) * .004) + (rx + fold) * Math.cos(a), y, -.036 + (rz + fold) * Math.sin(a)];
      }, (_, a) => [Math.cos(a), 0, Math.sin(a)]);
  }
  const trouserMesh = gltf.meshes.find(mesh => mesh.name === 'Trousers');
  trouserMesh.primitives = [trousers.finish(body.material)];
  // Remove covered body surfaces; a sweater is a garment, not bodypaint over
  // chest anatomy. Keep face, neck, hands and shoes from the original CC0 mesh.
  const color = accessor(body.attributes.COLOR_0), originalIndices = accessor(body.indices);
  const retained = [];
  for (let i = 0; i < originalIndices.count; i += 3) {
    const triangle = [0, 1, 2].map(axis => originalIndices.componentType === 5125 ? bin.readUInt32LE(originalIndices.offset + (i + axis) * originalIndices.stride) : bin.readUInt16LE(originalIndices.offset + (i + axis) * originalIndices.stride));
    const clothing = triangle.reduce((sum, vertex) => sum + bin.readFloatLE(color.offset + vertex * color.stride) + bin.readFloatLE(color.offset + vertex * color.stride + 4), 0);
    if (clothing < 2) retained.push(...triangle);
  }
  const retainedIndices = Buffer.alloc(retained.length * 2);
  retained.forEach((value, index) => retainedIndices.writeUInt16LE(value, index * 2));
  body.indices = append(retainedIndices, 5123, retained.length, 'SCALAR', 34963);
  gltf.buffers[0].byteLength = bin.length;
  await writeFile(join(directory, `${name}.bin`), bin);
  await writeFile(join(directory, `${name}.gltf`), JSON.stringify(gltf));
  records.push({ character: name, garmentVertices: shirt.vertices.length + trousers.vertices.length, bufferSHA256: createHash('sha256').update(bin).digest('hex') });
}
await writeFile(join(directory, 'GARMENT_PROVENANCE.json'), JSON.stringify({ author: 'METRO Simulator', description: 'Original continuous, sewn, skinned knit tops and trousers; based on CC0 rig only.', records }, null, 2) + '\n');
console.log('METRO: original tailored skinned sweaters, collars, cuffs and trousers prepared.');
