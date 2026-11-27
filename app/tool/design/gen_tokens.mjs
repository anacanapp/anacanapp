#!/usr/bin/env node
// Design-token generator: CSS custom properties + Tailwind theme -> Dart.
//
//   node app/tool/design/gen_tokens.mjs          write app/lib/design/tokens/*.g.dart + token_report.md
//   node app/tool/design/gen_tokens.mjs --check  exit 1 if any generated file is stale (CI)
//
// Sources (read-only): src/index.css, src/styles/anacan-design.css, src/styles/onboarding.css,
// tailwind.config.ts (+ tailwindcss defaultTheme/colors from node_modules).
// Only dependencies already in the repo's node_modules are used (postcss, tailwindcss).
// Output is deterministic: no timestamps, stable ordering (source order).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const require = createRequire(path.join(REPO, 'package.json'));
const postcss = require('postcss');

const OUT_DIR = path.join(REPO, 'app/lib/design/tokens');
const REPORT = path.join(REPO, 'app/tool/design/token_report.md');
const HEADER = '// GENERATED — do not edit; run node app/tool/design/gen_tokens.mjs';

const CSS_SOURCES = [
  { file: 'src/index.css', rootGroup: 'shadcn' },
  { file: 'src/styles/anacan-design.css', rootGroup: 'a' },
  { file: 'src/styles/onboarding.css', rootGroup: null },
];

// Dart class + prefix stripped from the CSS name for each token group.
const GROUPS = {
  shadcn: { cls: 'ShadcnTokens', prefix: '', doc: 'shadcn/Tailwind HSL variables (src/index.css @layer base :root / .dark).' },
  a: { cls: 'ATokens', prefix: 'a-', doc: 'Redesign `--a-*` variables (src/styles/anacan-design.css :root / .dark).' },
  navCapsule: { cls: 'NavCapsuleTokens', prefix: 'nav-', doc: 'Capsule bottom-nav variables (.a-nav.capsule, src/styles/anacan-design.css).' },
  onboarding: { cls: 'OnboardingTokens', prefix: 'onb-', doc: 'Onboarding variables (.onboarding, src/styles/onboarding.css).' },
  aRing: { cls: 'ARingCssTokens', prefix: '', doc: 'Component-local default of .a-ring (src/styles/anacan-design.css).' },
};
const SELECTOR_GROUPS = { '.a-nav.capsule': 'navCapsule', '.onboarding': 'onboarding', '.a-ring': 'aRing' };

const report = { unconverted: [], notes: [], scopes: [] };

// ───────────────────────────── colour parsing ─────────────────────────────
const NAMED = { transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1] };

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function alphaOf(s) {
  if (s === undefined) return 1;
  s = s.trim();
  return s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s);
}

/** Parses one CSS colour; returns [r,g,b,a] (0-255 floats, a 0-1) or null. */
function parseColor(raw) {
  const v = raw.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v].slice();
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^(rgba?|hsla?)\((.*)\)$/.exec(v);
  if (!m) return null;
  const fn = m[1];
  let body = m[2].trim();
  let alpha;
  if (body.includes('/')) { const [a, b] = body.split('/'); body = a.trim(); alpha = b; }
  const parts = body.includes(',') ? body.split(',').map((s) => s.trim()) : body.split(/\s+/);
  if (parts.length === 4) alpha = parts.pop();
  if (parts.length !== 3) return null;
  if (fn.startsWith('rgb')) {
    const c = parts.map((p) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p)));
    if (c.some(Number.isNaN)) return null;
    return [...c, alphaOf(alpha)];
  }
  const h = parseFloat(parts[0]); const s = parseFloat(parts[1]); const l = parseFloat(parts[2]);
  if ([h, s, l].some(Number.isNaN)) return null;
  return [...hslToRgb(h, s, l), alphaOf(alpha)];
}

const HSL_TRIPLET = /^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/;
const RGB_TRIPLET = /^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/;

function argbHex(c) {
  const cl = (x) => Math.max(0, Math.min(255, Math.round(x)));
  const a = cl(c[3] * 255);
  return '0x' + [a, cl(c[0]), cl(c[1]), cl(c[2])].map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join('');
}

// ───────────────────────────── value parsing ─────────────────────────────
function splitTop(s, sep = ',') {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) { if (cur.trim() || sep !== ' ') out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((x) => x !== '');
}

function lengthPx(s) {
  const m = /^(-?[\d.]+)(px|rem)?$/.exec(s.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === 'rem') return n * 16;
  if (!m[2] && n !== 0) return null;
  return n;
}

function parseGradient(v) {
  const m = /^linear-gradient\((.*)\)$/s.exec(v.trim());
  if (!m) return null;
  const args = splitTop(m[1]);
  let angle = 180;
  const first = args[0].trim();
  const SIDES = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to top right': 45, 'to right top': 45, 'to bottom right': 135, 'to right bottom': 135, 'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 };
  const am = /^(-?[\d.]+)(deg|turn|rad)$/.exec(first);
  if (am) {
    angle = parseFloat(am[1]);
    if (am[2] === 'turn') angle *= 360;
    if (am[2] === 'rad') angle = (angle * 180) / Math.PI;
    args.shift();
  } else if (SIDES[first] !== undefined) {
    angle = SIDES[first];
    args.shift();
    if (first.split(' ').length === 3) report.notes.push(`corner keyword "${first}" approximated as ${angle}deg (CSS corner keywords depend on box aspect)`);
  }
  const stops = [];
  for (const a of args) {
    const parts = splitTop(a, ' ');
    const col = parseColor(parts[0]);
    if (!col) return null;
    const positions = parts.slice(1).map((p) => (p.endsWith('%') ? parseFloat(p) / 100 : NaN));
    if (positions.some(Number.isNaN)) return null;
    if (positions.length === 0) stops.push({ color: col, pos: null });
    for (const p of positions) stops.push({ color: col, pos: p });
  }
  if (stops.length < 2) return null;
  // CSS stop fix-up: first/last default to 0/1, gaps are distributed evenly, positions are monotonic.
  if (stops[0].pos === null) stops[0].pos = 0;
  if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
  for (let i = 1; i < stops.length; i++) if (stops[i].pos !== null && stops[i].pos < stops[i - 1].pos) stops[i].pos = stops[i - 1].pos;
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].pos !== null) continue;
    let j = i; while (stops[j].pos === null) j++;
    const a = stops[i - 1].pos; const b = stops[j].pos; const n = j - i + 1;
    for (let k = i; k < j; k++) stops[k].pos = a + ((b - a) * (k - i + 1)) / n;
  }
  return { kind: 'gradient', angle, stops };
}

function parseShadow(v) {
  if (v.trim() === 'none') return { kind: 'shadow', layers: [] };
  const layers = [];
  for (const layer of splitTop(v)) {
    const toks = splitTop(layer, ' ');
    let inset = false; let color = null; const lens = [];
    for (const t of toks) {
      if (t === 'inset') { inset = true; continue; }
      const l = lengthPx(t);
      if (l !== null) { lens.push(l); continue; }
      const c = parseColor(t);
      if (c && !color) { color = c; continue; }
      return null;
    }
    if (lens.length < 2 || lens.length > 4) return null;
    layers.push({ inset, x: lens[0], y: lens[1], blur: lens[2] ?? 0, spread: lens[3] ?? 0, color: color ?? [0, 0, 0, 1] });
  }
  return { kind: 'shadow', layers };
}

/** Classifies a fully var()-resolved value. */
function parseValue(v) {
  v = v.trim();
  let m = /^cubic-bezier\(([^)]*)\)$/.exec(v);
  if (m) {
    const n = m[1].split(',').map((x) => parseFloat(x));
    if (n.length === 4 && !n.some(Number.isNaN)) return { kind: 'cubic', n };
  }
  if (/^linear-gradient\(/.test(v)) return parseGradient(v) ?? { kind: 'unknown', why: 'unparsable linear-gradient' };
  if (/^(radial|conic|repeating-[a-z]+)-gradient\(/.test(v)) return { kind: 'unknown', why: 'non-linear gradient' };
  m = HSL_TRIPLET.exec(v);
  if (m) return { kind: 'color', color: [...hslToRgb(+m[1], +m[2], +m[3]), 1], form: 'hsl-triplet' };
  m = RGB_TRIPLET.exec(v);
  if (m) return { kind: 'color', color: [+m[1], +m[2], +m[3], 1], form: 'rgb-triplet' };
  const c = parseColor(v);
  if (c) return { kind: 'color', color: c };
  const l = /^(-?[\d.]+)(px|rem)$/.exec(v);
  if (l) return { kind: 'length', px: lengthPx(v) };
  if (/^-?[\d.]+$/.test(v)) return { kind: 'number', n: parseFloat(v) };
  m = /^(-?[\d.]+)(ms|s)$/.exec(v);
  if (m) return { kind: 'duration', ms: m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]) };
  const sh = parseShadow(v);
  if (sh) return sh;
  return { kind: 'unknown', why: 'unrecognised value' };
}

// ───────────────────────────── var() resolution ─────────────────────────────
function resolveVars(value, env, seen = new Set()) {
  let out = ''; let i = 0;
  while (i < value.length) {
    const j = value.indexOf('var(', i);
    if (j < 0) { out += value.slice(i); break; }
    out += value.slice(i, j);
    let depth = 0; let k = j + 3;
    for (; k < value.length; k++) { if (value[k] === '(') depth++; if (value[k] === ')') { depth--; if (depth === 0) break; } }
    const inner = value.slice(j + 4, k);
    const comma = splitTop(inner)[0] === inner.trim() ? -1 : inner.indexOf(',');
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
    if (env[name] !== undefined && !seen.has(name)) {
      out += resolveVars(env[name].value, env, new Set([...seen, name]));
    } else if (fallback !== null) {
      out += resolveVars(fallback, env, seen);
    } else {
      throw new Error(`unresolved ${name}`);
    }
    i = k + 1;
  }
  return out;
}

// ───────────────────────────── naming ─────────────────────────────
const DART_RESERVED = new Set(['in', 'is', 'new', 'default', 'switch', 'class', 'const', 'final', 'var', 'void', 'null', 'true', 'false', 'this', 'super', 'return', 'if', 'else', 'for', 'do', 'while', 'with', 'enum', 'extends', 'case', 'catch', 'try', 'throw', 'assert', 'break', 'continue', 'operator', 'get', 'set']);
function camel(s) {
  const out = s.replace(/^-+/, '').replace(/[-_ ]+([a-z0-9])/gi, (_, c) => c.toUpperCase());
  return out;
}
function fieldName(cssName, group) {
  let n = cssName.replace(/^--/, '');
  const p = GROUPS[group].prefix;
  if (p && n.startsWith(p)) n = n.slice(p.length);
  n = camel(n);
  if (/^[0-9]/.test(n)) n = 'v' + n;
  if (DART_RESERVED.has(n)) n += 'Token';
  return n;
}

// ───────────────────────────── collect declarations ─────────────────────────────
let declarationsFound = 0;
const decls = []; // {group, theme, variant, name, value, file, line}

function classify(selector, ctx, rootGroup) {
  const out = selector.split(',').map((sel) => {
    let s = sel.trim(); let variant = 'base'; let theme = 'light';
    if (/^html\.a-noblur/.test(s)) { variant = 'noBlur'; s = s.replace(/^html\.a-noblur/, '').trim(); }
    if (/^\.dark(\s|$)/.test(s)) { theme = 'dark'; s = s.replace(/^\.dark/, '').trim(); }
    if (ctx.length) {
      if (ctx.length === 1 && /^@supports not .*backdrop-filter/.test(ctx[0]) && variant === 'base') variant = 'noBackdrop';
      else if (!(ctx.length === 1 && ctx[0].startsWith('@layer'))) return null;
    }
    let group;
    if (s === ':root' || s === '') group = rootGroup;
    else group = SELECTOR_GROUPS[s];
    if (!group) return null;
    return `${group}|${theme}|${variant}`;
  });
  if (out.some((x) => x === null) || new Set(out).size !== 1) return null;
  const [group, theme, variant] = out[0].split('|');
  return { group, theme, variant };
}

for (const src of CSS_SOURCES) {
  const css = fs.readFileSync(path.join(REPO, src.file), 'utf8');
  const root = postcss.parse(css, { from: src.file });
  root.walkDecls(/^--/, (d) => {
    declarationsFound++;
    const ctx = [];
    for (let q = d.parent.parent; q && q.type !== 'root'; q = q.parent) if (q.type === 'atrule') ctx.unshift(`@${q.name} ${q.params}`);
    const where = `${src.file}:${d.source.start.line}`;
    const cl = d.parent.type === 'rule' ? classify(d.parent.selector, ctx, src.rootGroup) : null;
    if (!cl) {
      report.unconverted.push({ name: d.prop, where, value: d.value, why: `scope not mapped: ${ctx.join(' ')} ${d.parent.selector ?? d.parent.name}` });
      return;
    }
    decls.push({ ...cl, name: d.prop, value: d.value.replace(/\s+/g, ' ').trim(), where });
  });
}

// Build per-group theme/variant maps (source order, later wins).
const groups = {};
for (const d of decls) {
  const g = (groups[d.group] ??= { names: [], layers: {} });
  if (!g.names.includes(d.name)) g.names.push(d.name);
  const key = `${d.theme}|${d.variant}`;
  (g.layers[key] ??= {})[d.name] = { value: d.value, where: d.where };
}

function layer(g, theme, variant) { return groups[g]?.layers[`${theme}|${variant}`] ?? {}; }
function instanceMap(g, theme, variant) {
  // Cascade: base light < base dark < variant light < variant dark.
  let m = { ...layer(g, 'light', 'base') };
  if (theme === 'dark') m = { ...m, ...layer(g, 'dark', 'base') };
  if (variant !== 'base') {
    m = { ...m, ...layer(g, 'light', variant) };
    if (theme === 'dark') m = { ...m, ...layer(g, 'dark', variant) };
  }
  return m;
}
function envFor(g, theme, variant) {
  return { ...instanceMap('shadcn', theme, 'base'), ...instanceMap('a', theme, 'base'), ...instanceMap(g, theme, variant) };
}

// Tokens declared only under .dark (no light default) would be a source bug; record them.
for (const [gname, g] of Object.entries(groups)) {
  const light = new Set(Object.keys(layer(gname, 'light', 'base')));
  for (const n of Object.keys(layer(gname, 'dark', 'base'))) if (!light.has(n)) report.notes.push(`${n} (${gname}) is declared under .dark only`);
}

// ───────────────────────────── Dart emitters ─────────────────────────────
const fmtNum = (n) => {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? `${r}.0` : `${r}`;
};
const dColor = (c) => `Color(${argbHex(c)})`;
// CSS blur radius B -> Gaussian sigma B/2. Flutter BoxShadow.blurRadius r -> sigma r*0.57735+0.5.
const flutterBlur = (b) => (b <= 0 ? 0 : Math.max(0, (b / 2 - 0.5) / 0.57735));
function dShadow(l) {
  return `BoxShadow(color: ${dColor(l.color)}, offset: Offset(${fmtNum(l.x)}, ${fmtNum(l.y)}), blurRadius: ${fmtNum(flutterBlur(l.blur))}, spreadRadius: ${fmtNum(l.spread)})`;
}
function dGradient(gr) {
  return `CssLinearGradient(angle: ${fmtNum(gr.angle)}, colors: <Color>[${gr.stops.map((s) => dColor(s.color)).join(', ')}], stops: <double>[${gr.stops.map((s) => fmtNum(s.pos)).join(', ')}])`;
}

const DART_TYPE = { color: 'Color', gradient: 'Gradient', shadow: 'List<BoxShadow>', length: 'double', number: 'double', cubic: 'Cubic', duration: 'Duration' };

function convertGroup(gname) {
  const g = groups[gname];
  const variants = ['base', ...new Set(Object.keys(g.layers).map((k) => k.split('|')[1]).filter((v) => v !== 'base'))];
  const instances = [];
  for (const variant of variants) for (const theme of ['light', 'dark']) instances.push({ theme, variant, id: variant === 'base' ? theme : `${theme}${variant[0].toUpperCase()}${variant.slice(1)}` });
  const fields = [];
  for (const name of g.names) {
    const per = instances.map((inst) => {
      const m = instanceMap(gname, inst.theme, inst.variant);
      const raw = m[name];
      if (!raw) return { inst, parsed: { kind: 'missing' } };
      let resolved;
      try { resolved = resolveVars(raw.value, envFor(gname, inst.theme, inst.variant)); } catch (e) { return { inst, raw, parsed: { kind: 'unknown', why: e.message } }; }
      return { inst, raw, resolved, parsed: parseValue(resolved) };
    });
    const kinds = new Set(per.map((p) => p.parsed.kind));
    let kind = null;
    if (kinds.size === 1) kind = [...kinds][0];
    else if ([...kinds].every((k) => k === 'gradient' || k === 'color')) kind = 'gradient';
    else if ([...kinds].every((k) => k === 'length' || k === 'number')) kind = 'length';
    const bad = per.find((p) => p.parsed.kind === 'unknown' || p.parsed.kind === 'missing');
    if (!kind || bad) {
      const b = bad ?? per[0];
      report.unconverted.push({ name: `${name} (${gname})`, where: b.raw?.where ?? '', value: b.resolved ?? b.raw?.value ?? '', why: bad ? (bad.parsed.why ?? bad.parsed.kind) : `mixed kinds ${[...kinds].join('/')}` });
      continue;
    }
    const values = {};
    const hasInset = per.some((p) => p.parsed.kind === 'shadow' && p.parsed.layers.some((l) => l.inset));
    const insetValues = {};
    for (const p of per) {
      const pv = p.parsed;
      let dv;
      if (kind === 'gradient') {
        if (pv.kind === 'color') {
          dv = dGradient({ angle: 180, stops: [{ color: pv.color, pos: 0 }, { color: pv.color, pos: 1 }] });
          report.notes.push(`${name} (${gname}, ${p.inst.id}) is a flat colour \`${p.resolved}\` → emitted as a 2-stop CssLinearGradient of that colour`);
        } else dv = dGradient(pv);
      } else if (kind === 'color') dv = dColor(pv.color);
      else if (kind === 'shadow') {
        dv = `<BoxShadow>[${pv.layers.filter((l) => !l.inset).map(dShadow).join(', ')}]`;
        insetValues[p.inst.id] = `<BoxShadow>[${pv.layers.filter((l) => l.inset).map(dShadow).join(', ')}]`;
      } else if (kind === 'length') dv = fmtNum(pv.px ?? pv.n);
      else if (kind === 'number') dv = fmtNum(pv.n);
      else if (kind === 'cubic') dv = `Cubic(${pv.n.map(fmtNum).join(', ')})`;
      else if (kind === 'duration') dv = `Duration(milliseconds: ${Math.round(pv.ms)})`;
      values[p.inst.id] = dv;
      if (pv.form === 'rgb-triplet') report.notes.push(`${name} (${gname}) is a bare RGB triplet \`${p.resolved}\` (for rgba(var(), a)); emitted as an opaque Color`);
    }
    if (hasInset) report.notes.push(`${name} (${gname}) has inset shadow layers → emitted separately as \`${fieldName(name, gname)}Inset\` (Flutter BoxShadow has no inset; paint with AInsetShadow)`);
    const rawDoc = per.filter((p, i) => i === 0 || p.raw?.value !== per[0].raw?.value).map((p) => `${p.inst.id}: \`${p.raw.value}\``);
    fields.push({ css: name, field: fieldName(name, gname), type: DART_TYPE[kind], kind, values, where: per[0].raw.where, rawDoc });
    if (hasInset) fields.push({ css: `${name} (inset layers)`, field: `${fieldName(name, gname)}Inset`, type: 'List<BoxShadow>', kind: 'shadowInset', values: insetValues, where: per[0].raw.where, rawDoc: [] });
  }
  return { gname, instances, fields };
}

const converted = Object.keys(groups).map(convertGroup);

function emitGroupClass(cg) {
  const { cls, doc } = GROUPS[cg.gname];
  const L = [];
  L.push(`/// ${doc}`);
  L.push('@immutable');
  L.push(`class ${cls} {`);
  L.push(`  const ${cls}({`);
  for (const f of cg.fields) L.push(`    required this.${f.field},`);
  L.push('  });');
  L.push('');
  for (const f of cg.fields) {
    L.push(`  /// \`${f.css}\` — ${f.where}${f.rawDoc.length ? '' : ''}`);
    for (const r of f.rawDoc) L.push(`  /// * ${r.replace(/\*\//g, '* /')}`);
    L.push(`  final ${f.type} ${f.field};`);
  }
  L.push('');
  for (const inst of cg.instances) {
    L.push(`  static const ${cls} ${inst.id} = ${cls}(`);
    for (const f of cg.fields) L.push(`    ${f.field}: ${f.values[inst.id]},`);
    L.push('  );');
  }
  L.push('');
  L.push('  /// CSS custom-property name → value (inset layers keyed `<name>:inset`).');
  L.push('  Map<String, Object> get byCssName => <String, Object>{');
  for (const f of cg.fields) L.push(`    '${f.kind === 'shadowInset' ? f.css.replace(' (inset layers)', ':inset') : f.css}': ${f.field},`);
  L.push('  };');
  L.push('}');
  return L.join('\n');
}

const files = {};
const PRE = (imports) => `${HEADER}\n// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names\n\n${imports}\n`;

files['css_tokens.g.dart'] = PRE("import 'package:flutter/animation.dart';\nimport 'package:flutter/painting.dart';\nimport 'package:flutter/foundation.dart';\n\nimport 'css_types.dart';") +
  '\n' + converted.map(emitGroupClass).join('\n\n') + '\n';

// ───────────────────────────── Tailwind ─────────────────────────────
async function loadTailwindConfig() {
  let src = fs.readFileSync(path.join(REPO, 'tailwind.config.ts'), 'utf8');
  src = src.replace(/^import type .*$/m, '').replace(/\}\s*satisfies\s+Config\s*;?\s*$/, '};').replace(/require\(["']tailwindcss-animate["']\)/g, 'null');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  return mod.default;
}
const tw = await loadTailwindConfig();
const defaultTheme = require('tailwindcss/defaultTheme');
const twColors = require('tailwindcss/colors');

const shadcnLight = instanceMap('shadcn', 'light', 'base');
function evalTwLength(v) {
  const r = resolveVars(v, shadcnLight);
  let m = /^calc\(\s*([\d.]+(?:px|rem))\s*([-+])\s*([\d.]+(?:px|rem))\s*\)$/.exec(r);
  if (m) return m[2] === '-' ? lengthPx(m[1]) - lengthPx(m[3]) : lengthPx(m[1]) + lengthPx(m[3]);
  m = lengthPx(r);
  if (m !== null) return m;
  if (r === '9999px') return 9999;
  return null;
}

const twL = [PRE("import 'package:flutter/animation.dart';\nimport 'package:flutter/painting.dart';\n\nimport 'css_types.dart';")];
// Radii
const radii = { ...defaultTheme.borderRadius, ...tw.theme.extend.borderRadius };
twL.push('/// Tailwind `rounded-*` radii (defaultTheme merged with tailwind.config.ts extend; px).');
twL.push('abstract final class TwRadius {');
for (const [k, v] of Object.entries(radii)) {
  const px = evalTwLength(v);
  const n = k === 'DEFAULT' ? 'base' : k === 'none' ? 'none' : /^[0-9]/.test(k) ? `r${k}` : k;
  if (px === null) { report.unconverted.push({ name: `borderRadius.${k}`, where: 'tailwind.config.ts', value: v, why: 'unparsable radius' }); continue; }
  twL.push(`  /// \`rounded${k === 'DEFAULT' ? '' : '-' + k}\` = \`${v}\``);
  twL.push(`  static const double ${n} = ${fmtNum(px)};`);
}
twL.push('}\n');
// Font sizes
twL.push('/// Tailwind `text-*` sizes: font size and line height, both in logical px (1 CSS px = 1 dp).');
twL.push('abstract final class TwFontSize {');
for (const [k, v] of Object.entries(defaultTheme.fontSize)) {
  const size = lengthPx(v[0]);
  const lh = v[1].lineHeight;
  const lhPx = lengthPx(lh);
  const lineHeightPx = lhPx !== null ? lhPx : parseFloat(lh) * size;
  const n = /^[0-9]/.test(k) ? `t${k}` : k;
  twL.push(`  /// \`text-${k}\`: ${v[0]} / line-height ${lh}`);
  twL.push(`  static const TwTextSize ${n} = TwTextSize(${fmtNum(size)}, ${fmtNum(lineHeightPx)});`);
}
twL.push('}\n');
twL.push('/// Tailwind `font-*` weights.');
twL.push('abstract final class TwFontWeight {');
for (const [k, v] of Object.entries(defaultTheme.fontWeight)) twL.push(`  static const FontWeight ${k} = FontWeight.w${v};`);
twL.push('}\n');
// Font families
twL.push('/// Font stacks: tailwind.config.ts fontFamily + the CSS scopes (bundled families first).');
twL.push('abstract final class TwFontFamily {');
for (const [k, v] of Object.entries(tw.theme.extend.fontFamily)) twL.push(`  /// \`font-${k}\`: ${v.join(', ')}\n  static const List<String> ${k} = <String>[${v.map((x) => `'${x}'`).join(', ')}];`);
twL.push('}\n');
// Palette
const PALETTE = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
twL.push('/// Tailwind v3 default palette (consumer code uses e.g. `text-gray-600`, `bg-rose-50`).');
twL.push('abstract final class TwColors {');
twL.push(`  static const Color white = ${dColor(parseColor(twColors.white))};`);
twL.push(`  static const Color black = ${dColor(parseColor(twColors.black))};`);
for (const p of PALETTE) for (const [shade, hex] of Object.entries(twColors[p])) twL.push(`  static const Color ${p}${shade} = ${dColor(parseColor(hex))};`);
twL.push('}\n');

// Keyframes
const EASE = { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };
function timing(s, env) {
  s = s.trim();
  if (EASE[s]) return `Cubic(${EASE[s].map(fmtNum).join(', ')})`;
  const r = resolveVars(s, env);
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(r);
  if (m) return `Cubic(${m[1].split(',').map((x) => fmtNum(parseFloat(x))).join(', ')})`;
  return null;
}
function camelStyle(p) { return p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()); }
function parseFrameProps(props, label, where = '') {
  const f = { raw: {} };
  for (const [prop, val] of Object.entries(props)) {
    const p = camelStyle(prop);
    if (p === 'opacity') { f.opacity = parseFloat(val); continue; }
    if (p === 'transform') {
      let ok = true;
      for (const fn of val.match(/[a-zA-Z0-9]+\([^)]*\)/g) ?? []) {
        const m = /^([a-zA-Z0-9]+)\(([^)]*)\)$/.exec(fn);
        const args = m[2].split(',').map((x) => x.trim());
        const len = (a) => { if (a.endsWith('%')) { f.translatePercent = true; return parseFloat(a); } const l = lengthPx(a); if (l === null) ok = false; return l; };
        switch (m[1]) {
          case 'translateY': f.translateY = len(args[0]); break;
          case 'translateX': f.translateX = len(args[0]); break;
          case 'translate': case 'translate3d': f.translateX = len(args[0]); f.translateY = len(args[1] ?? '0'); break;
          case 'scale': f.scale = parseFloat(args[0]); break;
          case 'rotate': f.rotateDeg = parseFloat(args[0]); break;
          default: ok = false;
        }
      }
      if (!ok) { f.raw[p] = val; report.unconverted.push({ name: `@keyframes ${label} transform`, where, value: val, why: 'unsupported transform function/unit (kept raw)' }); }
      continue;
    }
    f.raw[p] = val;
    report.unconverted.push({ name: `@keyframes ${label} ${p}`, where, value: val, why: 'non-transform/opacity property kept as raw string' });
  }
  return f;
}
function dFrame(offset, f, implicit) {
  const a = [`offset: ${fmtNum(offset)}`];
  if (f.opacity !== undefined) a.push(`opacity: ${fmtNum(f.opacity)}`);
  if (f.translateX !== undefined) a.push(`translateX: ${fmtNum(f.translateX)}`);
  if (f.translateY !== undefined) a.push(`translateY: ${fmtNum(f.translateY)}`);
  if (f.translatePercent) a.push('translateIsPercent: true');
  if (f.scale !== undefined) a.push(`scale: ${fmtNum(f.scale)}`);
  if (f.rotateDeg !== undefined) a.push(`rotateDeg: ${fmtNum(f.rotateDeg)}`);
  if (implicit) a.push('implicit: true');
  const raw = Object.entries(f.raw);
  if (raw.length) a.push(`raw: <String, String>{${raw.map(([k, v]) => `'${k}': '${v.replace(/'/g, "\\'")}'`).join(', ')}}`);
  return `CssKeyframe(${a.join(', ')})`;
}
function framesFrom(obj, label, where) {
  const out = [];
  for (const [sel, props] of Object.entries(obj)) {
    const f = parseFrameProps(props, label, where);
    for (const s of sel.split(',').map((x) => x.trim())) out.push({ offset: s === 'from' ? 0 : s === 'to' ? 1 : parseFloat(s) / 100, f });
  }
  out.sort((a, b) => a.offset - b.offset);
  // CSS: missing 0%/100% frames take the element's own (identity) value.
  if (!out.length || out[0].offset !== 0) out.unshift({ offset: 0, f: { raw: {} }, implicit: true });
  if (out[out.length - 1].offset !== 1) out.push({ offset: 1, f: { raw: {} }, implicit: true });
  return out.map((x) => dFrame(x.offset, x.f, x.implicit));
}

twL.push('/// Tailwind `animate-*` (tailwind.config.ts extend.keyframes + extend.animation).');
twL.push('abstract final class TwAnimations {');
const animNames = [];
for (const [name, def] of Object.entries(tw.theme.extend.animation)) {
  const [kf, dur, ...rest] = def.split(/\s+/);
  const infinite = rest.includes('infinite');
  const ease = rest.filter((x) => x !== 'infinite').join(' ') || 'ease';
  const ms = dur.endsWith('ms') ? parseFloat(dur) : parseFloat(dur) * 1000;
  const frames = framesFrom(tw.theme.extend.keyframes[kf], kf, 'tailwind.config.ts');
  const id = camel(name);
  animNames.push([name, id]);
  twL.push(`  /// \`animate-${name}\`: \`${def}\``);
  twL.push(`  static const CssAnimationSpec ${id} = CssAnimationSpec(name: '${kf}', duration: Duration(milliseconds: ${Math.round(ms)}), curve: ${timing(ease, shadcnLight)}, infinite: ${infinite}, frames: <CssKeyframe>[\n    ${frames.join(',\n    ')},\n  ]);`);
}
twL.push(`  static const Map<String, CssAnimationSpec> byName = <String, CssAnimationSpec>{${animNames.map(([n, id]) => `'${n}': ${id}`).join(', ')}};`);
twL.push('}\n');

// CSS @keyframes from the three stylesheets (timing lives on the using rule, so frames only).
twL.push('/// `@keyframes` declared in the CSS sources (frames only; duration/easing live on the rule using them).');
twL.push('abstract final class CssKeyframes {');
const cssKf = [];
for (const src of CSS_SOURCES) {
  const root = postcss.parse(fs.readFileSync(path.join(REPO, src.file), 'utf8'));
  root.walkAtRules('keyframes', (at) => {
    const obj = {};
    at.each((rule) => { if (rule.type !== 'rule') return; const props = {}; rule.walkDecls((d) => { props[d.prop] = d.value; }); obj[rule.selector] = { ...(obj[rule.selector] ?? {}), ...props }; });
    const id = camel(at.params);
    if (cssKf.some(([, i]) => i === id)) return; // duplicate definitions (e.g. shimmer twice): first wins
    cssKf.push([at.params, id]);
    twL.push(`  /// \`@keyframes ${at.params}\` — ${src.file}:${at.source.start.line}`);
    twL.push(`  static const List<CssKeyframe> ${id} = <CssKeyframe>[\n    ${framesFrom(obj, at.params, `${src.file}:${at.source.start.line}`).join(',\n    ')},\n  ];`);
  });
}
twL.push('}\n');
files['tailwind.g.dart'] = twL.join('\n');

// ───────────────────────────── life-stage palettes ─────────────────────────────
const shadcnConv = converted.find((c) => c.gname === 'shadcn');
const sf = (css) => shadcnConv.fields.find((f) => f.css === css);
const lsL = [PRE("import 'package:flutter/painting.dart';\n\nimport 'css_types.dart';")];
lsL.push('/// Life-stage palette (tailwind `flow` / `bump` / `mommy` / `partner` colours + `gradient-*`).');
lsL.push('/// Note: `--gradient-partner` is blue while `--partner` is orange — faithful to src/index.css.');
lsL.push('class ALifeStagePalette {');
lsL.push('  const ALifeStagePalette({required this.base, required this.light, required this.dark, required this.gradient});');
lsL.push('  /// `--<stage>` (tailwind `bg-<stage>`).');
lsL.push('  final Color base;');
lsL.push('  /// `--<stage>-light`.');
lsL.push('  final Color light;');
lsL.push('  /// `--<stage>-dark`.');
lsL.push('  final Color dark;');
lsL.push('  /// `--gradient-<stage>`.');
lsL.push('  final Gradient gradient;');
lsL.push('}\n');
lsL.push('abstract final class ALifeStagePalettes {');
for (const theme of ['light', 'dark']) {
  lsL.push(`  static const Map<String, ALifeStagePalette> ${theme} = <String, ALifeStagePalette>{`);
  for (const st of ['flow', 'bump', 'mommy', 'partner']) {
    lsL.push(`    '${st}': ALifeStagePalette(base: ${sf('--' + st).values[theme]}, light: ${sf(`--${st}-light`).values[theme]}, dark: ${sf(`--${st}-dark`).values[theme]}, gradient: ${sf('--gradient-' + st).values[theme]}),`);
  }
  lsL.push('  };');
}
lsL.push('}');
files['life_stage.g.dart'] = lsL.join('\n') + '\n';

// ───────────────────────────── manifest (for tests) ─────────────────────────────
const emittedCount = converted.reduce((n, c) => n + c.fields.filter((f) => f.kind !== 'shadowInset').length, 0);
const uniqueCount = Object.values(groups).reduce((n, g) => n + g.names.length, 0);
const scopeUnconverted = report.unconverted.filter((u) => u.why.startsWith('scope'));
const valueUnconverted = report.unconverted.filter((u) => /\((shadcn|a|navCapsule|onboarding|aRing)\)$/.test(u.name));
const mL = [PRE('')];
mL.push('/// Counts written by the generator; test/design/tokens_test.dart checks them against the CSS.');
mL.push('abstract final class TokenManifest {');
mL.push(`  static const List<String> sources = <String>[${CSS_SOURCES.map((s) => `'${s.file}'`).join(', ')}];`);
mL.push(`  /// Every \`--*\` declaration found by postcss in [sources] (including repeats across themes).`);
mL.push(`  static const int declarationsFound = ${declarationsFound};`);
mL.push(`  /// Declarations mapped to a token group/theme/variant.`);
mL.push(`  static const int declarationsMapped = ${decls.length};`);
mL.push(`  /// Declarations whose scope (selector/at-rule) is not mapped — listed in token_report.md.`);
mL.push(`  static const int declarationsUnmappedScope = ${scopeUnconverted.length};`);
mL.push(`  /// Distinct custom properties per mapped group.`);
mL.push(`  static const int uniqueTokens = ${uniqueCount};`);
mL.push(`  /// Tokens emitted as Dart fields (excluding generated \`*Inset\` companions).`);
mL.push(`  static const int emittedTokens = ${emittedCount};`);
mL.push(`  /// Tokens that could not be converted (value) — listed in token_report.md.`);
mL.push(`  static const int unconvertedTokens = ${valueUnconverted.length};`);
mL.push('  static const Map<String, List<String>> namesByGroup = <String, List<String>>{');
for (const [gname, g] of Object.entries(groups)) mL.push(`    '${gname}': <String>[${g.names.map((n) => `'${n}'`).join(', ')}],`);
mL.push('  };');
mL.push('}');
files['token_manifest.g.dart'] = mL.join('\n') + '\n';

// ───────────────────────────── report ─────────────────────────────
const R = ['<!-- GENERATED — do not edit; run node app/tool/design/gen_tokens.mjs -->', '# Token conversion report', ''];
R.push(`- CSS custom-property declarations found: **${declarationsFound}** (${CSS_SOURCES.map((s) => s.file).join(', ')})`);
R.push(`- Mapped to groups: ${decls.length}; distinct tokens: ${uniqueCount}; emitted Dart fields: ${emittedCount}`);
R.push(`- Groups: ${converted.map((c) => `${GROUPS[c.gname].cls} (${c.fields.length} fields × ${c.instances.map((i) => i.id).join('/')})`).join('; ')}`);
R.push('');
R.push('## Not converted');
R.push('');
if (!report.unconverted.length) R.push('_none_');
else {
  R.push('| token / construct | where | value | reason |');
  R.push('|---|---|---|---|');
  for (const u of report.unconverted) R.push(`| \`${u.name}\` | ${u.where} | \`${String(u.value).replace(/\|/g, '\\|')}\` | ${u.why} |`);
}
R.push('');
R.push('## Conversion notes (converted with a caveat)');
R.push('');
for (const n of [...new Set(report.notes)]) R.push(`- ${n}`);
R.push('- Shadows: CSS blur radius B is converted to Flutter `blurRadius` so both give Gaussian sigma B/2 ((B/2 − 0.5) / 0.57735).');
R.push('- Gradients: `CssLinearGradient` reproduces the CSS gradient line (angle + box-dependent length); colour interpolation is Flutter\'s (non-premultiplied), CSS interpolates premultiplied — differs only for stops with alpha.');
R.push('');
const reportText = R.join('\n') + '\n';

// ───────────────────────────── write / check ─────────────────────────────
const outputs = Object.entries(files).map(([f, c]) => [path.join(OUT_DIR, f), c]);
outputs.push([REPORT, reportText]);
const check = process.argv.includes('--check');
let stale = 0;
for (const [p, content] of outputs) {
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  if (cur === content) continue;
  if (check) { console.error(`stale: ${path.relative(REPO, p)}`); stale++; } else { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); console.log(`wrote ${path.relative(REPO, p)}`); }
}
if (check && stale) { console.error(`${stale} generated file(s) are stale; run node app/tool/design/gen_tokens.mjs`); process.exit(1); }
console.log(`tokens: ${declarationsFound} declarations, ${uniqueCount} distinct, ${emittedCount} emitted, ${report.unconverted.length} report rows${check ? ' — up to date' : ''}`);
