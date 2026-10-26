import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Emit reviewed dictionaries as hashed ESM assets. Their default export stays
 * unchanged, but Rollup no longer retains/minifies all large locale strings. */
export function publicContentAssetsPlugin({ directory = fileURLToPath(new URL('./content/', import.meta.url)) } = {}) {
  const contentRoot = resolve(directory), modules = new Map(); let base = '/';
  return {
    name: 'anacan-public-content-assets', apply: 'build', enforce: 'pre',
    configResolved(config) { base = config.base; },
    buildStart() { modules.clear(); },
    async resolveId(source, importer) {
      if (!importer || !source.endsWith('.json') || base.startsWith('.')) return null;
      const file = isAbsolute(source) ? resolve(source) : resolve(dirname(importer), source);
      if (dirname(file) !== contentRoot || !/^[a-z]{2}\.json$/.test(basename(file))) return null;
      if (!modules.has(file)) modules.set(file, (async () => {
        const json = await readFile(file, 'utf8');
        const code = `export default JSON.parse(${JSON.stringify(json)});\n`;
        const name = `assets/${basename(file,'.json')}-${createHash('sha256').update(code).digest('hex').slice(0,16)}.js`;
        this.emitFile({ type: 'asset', fileName: name, source: code });
        return base.replace(/\/$/, '') + '/' + name;
      })());
      return { id: await modules.get(file), external: 'absolute' };
    },
  };
}
