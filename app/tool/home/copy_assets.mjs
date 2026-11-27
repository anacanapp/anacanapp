// Ported from: (tooling) — copies the bundled home images of the React app into the Flutter app.
//
//   node app/tool/home/copy_assets.mjs
//
// * src/assets/fetus/month-{1..9}.svg → app/assets/images/fetus/month-{n}.svg
//   flutter_svg ignores <style> blocks, so the Illustrator class rules (`.cls-1, .cls-2 { fill: …; }`) are
//   inlined as presentation attributes on every element carrying those classes (later rules win, as in CSS).
// Re-running reproduces the files byte for byte.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(toolDir, '../..');
const repoDir = path.resolve(appDir, '..');

/** Parses `.a, .b { prop: value; }` rules of one <style> block into class → {prop: value}. */
export function parseClassRules(css) {
  const out = new Map();
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(ruleRe)) {
    const selectors = m[1].split(',').map((s) => s.trim()).filter((s) => /^\.[\w-]+$/.test(s));
    const decls = m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
    });
    for (const sel of selectors) {
      const name = sel.slice(1);
      const props = out.get(name) ?? {};
      for (const [k, v] of decls) props[k] = v;
      out.set(name, props);
    }
  }
  return out;
}

/** Inlines class rules as attributes and drops the <style> element. */
export function inlineSvgStyles(svg) {
  const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) return svg;
  const rules = parseClassRules(styleMatch[1]);
  let result = svg.replace(styleMatch[0], '');
  result = result.replace(/<([a-zA-Z][\w:-]*)([^<>]*?)\sclass="([^"]+)"([^<>]*?)(\/?)>/g, (all, tag, before, cls, after, selfClose) => {
    const props = {};
    // CSS cascade: a class rule declared later in the sheet wins; approximate with sheet order.
    const order = [...rules.keys()];
    const names = cls.split(/\s+/).filter(Boolean).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    for (const n of names) Object.assign(props, rules.get(n) ?? {});
    let attrs = `${before}${after}`;
    for (const [k, v] of Object.entries(props)) {
      const re = new RegExp(`\\s${k}="[^"]*"`);
      if (re.test(attrs)) continue; // an explicit attribute is weaker than CSS in browsers, but none collide here
      attrs += ` ${k}="${v}"`;
    }
    return `<${tag}${attrs}${selfClose}>`;
  });
  return result;
}

function main() {
  const srcDir = path.join(repoDir, 'src/assets/fetus');
  const outDir = path.join(appDir, 'assets/images/fetus');
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.svg')).sort();
  for (const f of files) {
    const svg = readFileSync(path.join(srcDir, f), 'utf8');
    writeFileSync(path.join(outDir, f), inlineSvgStyles(svg));
  }
  console.log(`fetus: ${files.length} files → ${path.relative(repoDir, outDir)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
