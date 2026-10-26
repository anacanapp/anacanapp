import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { rollup } from 'rollup';
import { publicContentAssetsPlugin } from './public-content-assets.mjs';

test('builds a small lazy loader and an immutable ESM dictionary with identical Unicode data', async () => {
  const directory = await mkdtemp('/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/locale-build-');
  const data = { schema:'anacan-content-translations-v1',language:'fr',values:{ text:'Grossesse — bébé 🧡', html:'<p>3 mg</p>', list:['Un','Deux'] } };
  let bundle;
  try {
    await writeFile(join(directory,'fr.json'),JSON.stringify(data));
    const entry = join(directory,'entry.js'); await writeFile(entry, 'export const load = () => import("./fr.json").then(module => module.default);');
    bundle = await rollup({ input: entry, plugins:[publicContentAssetsPlugin({directory})] });
    const { output } = await bundle.generate({ format:'es' });
    const asset = output.find(item=>item.type==='asset'); const loader = output.find(item=>item.type==='chunk');
    assert.match(asset.fileName,/^assets\/fr-[a-f0-9]{16}\.js$/);
    assert.ok(loader.code.includes('/'+asset.fileName)); assert.ok(!loader.code.includes('Grossesse'));
    const module = await import('data:text/javascript;base64,'+Buffer.from(asset.source).toString('base64'));
    assert.deepEqual(module.default,data);
  } finally { await bundle?.close(); await rm(directory,{recursive:true,force:true}); }
});
