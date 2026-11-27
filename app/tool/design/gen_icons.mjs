#!/usr/bin/env node
// Icon exporter: every lucide-react icon imported by consumer code -> SVG asset + typed Dart constants.
//
//   node app/tool/design/gen_icons.mjs          write app/assets/icons/** + app/lib/design/icons.g.dart
//   node app/tool/design/gen_icons.mjs --check  exit 1 if outputs are stale
//
// Consumer code = src/** minus console-only code (admin, brand portal, website, public blog,
// moderator console, admin/debug pages) and tests. SVGs are rebuilt from the icon node arrays
// shipped in node_modules/lucide-react (exact installed version) with lucide's default
// attributes. Also exported: the single react-icons glyph (RiApps2AiLine, BottomNav) and
// sonner's four built-in toast type icons (used by AToast).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const NM = path.join(REPO, 'node_modules');
const LUCIDE = path.join(NM, 'lucide-react');
const OUT_SVG = path.join(REPO, 'app/assets/icons');
const OUT_DART = path.join(REPO, 'app/lib/design/icons.g.dart');
const HEADER = '// GENERATED — do not edit; run node app/tool/design/gen_icons.mjs';

const EXCLUDE = [
  /^src\/components\/admin\//,
  /^src\/brand-portal\//,
  /^src\/website\//,
  /^src\/public-blog\//,
  /^src\/components\/moderation\/(ModeratorPanel|AdModerationWorkspace)\.tsx$/,
  /^src\/pages\/(AdminPage|AdmobAdminPage|ModeratorPage|RevenueCatDebug)\.tsx$/,
  /^src\/web-entry\/admin\.ts$/,
  /\.test\.(ts|tsx|mjs)$/,
  /^src\/test\//,
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts)$/.test(e.name)) out.push(path.relative(REPO, p).split(path.sep).join('/'));
  }
  return out;
}

// export name -> icon file (kebab) from lucide-react's ESM barrel.
const version = JSON.parse(fs.readFileSync(path.join(LUCIDE, 'package.json'), 'utf8')).version;
const barrel = fs.readFileSync(path.join(LUCIDE, 'dist/esm/lucide-react.js'), 'utf8');
const exportToFile = new Map();
for (const m of barrel.matchAll(/export \{([^}]*)\} from '\.\/icons\/([a-z0-9-]+)\.js';/g)) {
  for (const part of m[1].split(',')) {
    const am = /default as (\w+)/.exec(part.trim());
    if (am) exportToFile.set(am[1], m[2]);
  }
}

const NON_ICON = new Set(['LucideIcon', 'LucideProps', 'Icon', 'createLucideIcon', 'icons', 'IconNode']);
const used = new Map(); // kebab -> Set(import names)
const usedBy = new Map(); // kebab -> count of files
const unknown = [];
const files = walk(path.join(REPO, 'src')).filter((f) => !EXCLUDE.some((re) => re.test(f)));
for (const f of files) {
  const src = fs.readFileSync(path.join(REPO, f), 'utf8');
  for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    if (m[1]) continue;
    for (let spec of m[2].split(',')) {
      spec = spec.trim();
      if (!spec || spec.startsWith('type ')) continue;
      const name = spec.split(/\s+as\s+/)[0].trim();
      if (NON_ICON.has(name)) continue;
      const file = exportToFile.get(name);
      if (!file) { unknown.push(`${name} (${f})`); continue; }
      if (!used.has(file)) used.set(file, new Set());
      used.get(file).add(name);
      usedBy.set(file, (usedBy.get(file) ?? new Set()).add(f));
    }
  }
}

// DB-driven names (src/lib/dynamicIcon.ts ICON_MAP keys) -> must be included and looked up by name.
const dyn = fs.readFileSync(path.join(REPO, 'src/lib/dynamicIcon.ts'), 'utf8');
const mapBody = /const ICON_MAP[^=]*=\s*\{([^}]*)\}/.exec(dyn)[1];
const dynamicNames = mapBody.split(',').map((s) => s.trim()).filter(Boolean);
const dynamicFallback = /fallback: LucideIcon = (\w+)/.exec(dyn)[1];
for (const n of [...dynamicNames, dynamicFallback]) {
  const file = exportToFile.get(n);
  if (!file) throw new Error(`dynamic icon ${n} not in lucide-react ${version}`);
  if (!used.has(file)) used.set(file, new Set());
  used.get(file).add(n);
}

// Lucide SVG from node arrays.
const ATTR = (k) => (k === 'viewBox' ? k : k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function lucideSvg(file) {
  const js = fs.readFileSync(path.join(LUCIDE, 'dist/esm/icons', `${file}.js`), 'utf8');
  const m = /createLucideIcon\("[^"]+",\s*(\[[\s\S]*\])\);/.exec(js);
  const nodes = Function(`"use strict"; return (${m[1]});`)();
  const children = nodes.map(([tag, attrs]) => {
    const a = Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${ATTR(k)}="${esc(v)}"`).join(' ');
    return `  <${tag} ${a} />`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${children.join('\n')}\n</svg>\n`;
}

// react-icons RiApps2AiLine (GenIcon tree).
function reactIconSvg(pkg, name) {
  const js = fs.readFileSync(path.join(NM, 'react-icons', pkg, 'index.mjs'), 'utf8');
  const m = new RegExp(`export function ${name} \\(props\\) \\{\\s*return GenIcon\\((\\{.*\\})\\)\\(props\\);`).exec(js);
  const tree = JSON.parse(m[1]);
  const render = (n) => `<${n.tag} ${Object.entries(n.attr).map(([k, v]) => `${ATTR(k)}="${esc(v)}"`).join(' ')}${n.child?.length ? `>${n.child.map(render).join('')}</${n.tag}>` : ' />'}`;
  // flutter_svg does not inherit a root-level fill="currentColor" through SvgTheme, so the fill
  // is moved onto each child shape.
  const { fill, ...rootAttr } = tree.attr;
  const withFill = (n) => ({ ...n, attr: { ...n.attr, fill: n.attr.fill ?? fill }, child: (n.child ?? []).map(withFill) });
  const svg = render({ ...tree, attr: { xmlns: 'http://www.w3.org/2000/svg', ...rootAttr }, child: tree.child.map(withFill) });
  return svg + '\n';
}

// sonner's built-in type icons (success / warning / info / error), from its dist bundle.
function sonnerIcons() {
  const js = fs.readFileSync(path.join(NM, 'sonner/dist/index.mjs'), 'utf8');
  const out = {};
  const re = /(\w+)=E\.createElement\("svg",\{xmlns:"http:\/\/www\.w3\.org\/2000\/svg",viewBox:"([^"]+)",fill:"currentColor",height:"20",width:"20"\},E\.createElement\("path",\{fillRule:"evenodd",d:"([^"]+)",clipRule:"evenodd"\}\)\)/g;
  const found = [...js.matchAll(re)].map((m) => ({ viewBox: m[2], d: m[3] }));
  // Order in sonner 1.7.x source: success, warning, info, error.
  const names = ['success', 'warning', 'info', 'error'];
  if (found.length !== 4) throw new Error(`expected 4 sonner icons, found ${found.length}`);
  found.forEach((f, i) => {
    out[names[i]] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f.viewBox}" width="20" height="20"><path fill="currentColor" fill-rule="evenodd" d="${f.d}" clip-rule="evenodd" /></svg>\n`;
  });
  return out;
}

const outputs = new Map();
const lucideFiles = [...used.keys()].sort();
for (const f of lucideFiles) outputs.set(path.join(OUT_SVG, 'lucide', `${f}.svg`), lucideSvg(f));
outputs.set(path.join(OUT_SVG, 'remix', 'ri-apps-2-ai-line.svg'), reactIconSvg('ri', 'RiApps2AiLine'));
const sonner = sonnerIcons();
for (const [n, svg] of Object.entries(sonner)) outputs.set(path.join(OUT_SVG, 'sonner', `${n}.svg`), svg);

// Dart
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const dartId = (kebab) => { let n = camel(kebab); if (/^[0-9]/.test(n)) n = 'i' + n; if (['switch', 'in', 'is', 'new', 'default', 'class'].includes(n)) n += 'Icon'; return n; };
const D = [HEADER, '// ignore_for_file: constant_identifier_names', '//', `// lucide-react ${version}: ${lucideFiles.length} icons used by consumer code (+ ${dynamicNames.length} DB-driven names).`, '', "import 'a_icon.dart';", "export 'a_icon.dart';", ''];
D.push('/// Every icon the consumer app uses. Pass to [AIcon].');
D.push('abstract final class AIcons {');
for (const f of lucideFiles) {
  const names = [...used.get(f)].sort();
  D.push(`  /// lucide \`${f}\` — imported as ${names.map((n) => `\`${n}\``).join(', ')}${usedBy.has(f) ? ` (${usedBy.get(f).size} file${usedBy.get(f).size > 1 ? 's' : ''})` : ' (DB-driven only)'}`);
  D.push(`  static const AIconData ${dartId(f)} = AIconData('assets/icons/lucide/${f}.svg', name: '${f}');`);
}
D.push('');
D.push('  /// react-icons `RiApps2AiLine` (src/components/BottomNav.tsx, "tools" tab). Filled glyph.');
D.push("  static const AIconData riApps2AiLine = AIconData('assets/icons/remix/ri-apps-2-ai-line.svg', name: 'ri-apps-2-ai-line', filled: true);");
D.push('');
D.push('  /// sonner built-in toast type icons (20×20, filled).');
for (const n of Object.keys(sonner)) D.push(`  static const AIconData sonner${n[0].toUpperCase()}${n.slice(1)} = AIconData('assets/icons/sonner/${n}.svg', name: 'sonner-${n}', filled: true);`);
D.push('');
D.push('  /// lucide-react import name (PascalCase, incl. aliases like `AlertTriangle`) → icon.');
D.push('  static const Map<String, AIconData> byImportName = <String, AIconData>{');
const pairs = [];
for (const f of lucideFiles) for (const n of used.get(f)) pairs.push([n, dartId(f)]);
pairs.sort((a, b) => a[0].localeCompare(b[0]));
for (const [n, id] of pairs) D.push(`    '${n}': ${id},`);
D.push('  };');
D.push('');
D.push('  /// DB-driven names: src/lib/dynamicIcon.ts ICON_MAP (admin-configured icon strings).');
D.push(`  static const Map<String, AIconData> dynamicMap = <String, AIconData>{${dynamicNames.map((n) => `'${n}': ${dartId(exportToFile.get(n))}`).join(', ')}};`);
D.push('');
D.push(`  /// Port of getDynamicIcon(name, fallback = ${dynamicFallback}).`);
D.push(`  static AIconData dynamic(String? name, {AIconData fallback = ${dartId(exportToFile.get(dynamicFallback))}}) {`);
D.push('    if (name == null || name.isEmpty) return fallback;');
D.push('    return dynamicMap[name] ?? fallback;');
D.push('  }');
D.push('}');
outputs.set(OUT_DART, D.join('\n') + '\n');

const check = process.argv.includes('--check');
let stale = 0;
// Remove SVGs no longer used (write mode) / flag them (check mode).
for (const sub of ['lucide', 'remix', 'sonner']) {
  const dir = path.join(OUT_SVG, sub);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (!outputs.has(p)) { if (check) { console.error(`orphan: ${path.relative(REPO, p)}`); stale++; } else fs.unlinkSync(p); }
  }
}
for (const [p, content] of outputs) {
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (cur === content) continue;
  if (check) { console.error(`stale: ${path.relative(REPO, p)}`); stale++; continue; }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
if (unknown.length) console.warn(`not found in lucide-react ${version}: ${unknown.join(', ')}`);
if (check && stale) { console.error(`${stale} icon output(s) stale; run node app/tool/design/gen_icons.mjs`); process.exit(1); }
console.log(`icons: ${lucideFiles.length} lucide (${pairs.length} import names, ${dynamicNames.length} DB-driven) + 1 react-icons + ${Object.keys(sonner).length} sonner; scanned ${files.length} consumer files${check ? ' — up to date' : ''}`);
