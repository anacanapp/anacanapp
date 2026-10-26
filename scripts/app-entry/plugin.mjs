import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

/** Navigation-only code runs before the large consumer application and also
 * inside prerendered article HTML, without any session or backend request. */
export function appEntryPlugin() {
  let native = false, compiled;
  async function compile() {
    if (!compiled) {
      const result = await build({ entryPoints: [fileURLToPath(new URL('../../src/web-entry/early.js', import.meta.url))],
        outfile: '/virtual/app-entry.js', bundle: true, minify: true, target: 'es2020', format: 'iife', write: false, legalComments: 'none' });
      const javascript = result.outputFiles.find(file => file.path.endsWith('.js'))?.text;
      const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text;
      if (!javascript || !css) throw new Error('APP_ENTRY_BUNDLE_MISSING');
      const hash = createHash('sha256').update(javascript + css).digest('hex').slice(0,16);
      compiled = { javascript, css, script: `app-entry-${hash}.js`, style: `app-entry-${hash}.css` };
    }
    return compiled;
  }
  return { name: 'anacan-app-entry', enforce: 'pre',
    configResolved(config) { native = config.env.VITE_NATIVE_BUILD === 'true' || process.env.VITE_NATIVE_BUILD === 'true'; },
    async transformIndexHtml(html) {
      if (native) return html;
      const entry = await compile();
      return { html, tags: [
        { tag: 'script', attrs: { src: '/' + entry.script }, injectTo: 'head-prepend' },
        { tag: 'link', attrs: { rel: 'stylesheet', href: '/' + entry.style }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name:'apple-itunes-app', content:'app-id=6758301924' }, injectTo:'head-prepend' },
        { tag: 'style', children: 'html.anacan-launching,html.anacan-launching body,html.anacan-launching #root{position:static;inset:auto;overflow:visible;min-height:100vh;height:auto;background:#fff5ef;display:block}html.anacan-launching #root>*{visibility:hidden}html.anacan-launching #root>[data-app-launcher]{visibility:visible}', injectTo:'head-prepend' },
      ] };
    },
    async generateBundle() {
      if (native) return;
      const entry = await compile();
      this.emitFile({ type:'asset',fileName:entry.script,source:entry.javascript });
      this.emitFile({ type:'asset',fileName:entry.style,source:entry.css });
    },
  };
}
