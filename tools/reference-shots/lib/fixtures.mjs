// Fixture loading: fixtures/<persona>/{persona.json,tables/,rpc/,functions/} with fallback to fixtures/_shared/.
// A persona may `extends` another persona (its tables/rpc/functions are searched first, then the parent's).
// JSON fixtures may use template tokens relative to the frozen clock; .mjs fixtures export default (ctx, args) => value.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url));

const pad = (n) => String(n).padStart(2, '0');
/** Calendar date in the app's reference timezone (Asia/Baku, UTC+4, no DST). */
export function bakuDate(ms) {
  const d = new Date(ms + 4 * 3600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function offsetMs(spec) {
  const m = /^([+-]?\d+(?:\.\d+)?)([dhmw]?)$/.exec(spec.trim());
  if (!m) throw new Error(`bad time offset "${spec}"`);
  const unit = { d: 86400_000, h: 3600_000, m: 60_000, w: 7 * 86400_000, '': 86400_000 }[m[2]];
  return Number(m[1]) * unit;
}

export function makeContext(persona, nowMs) {
  const vars = { ...(persona.vars || {}) };
  const ctx = {
    now: nowMs, vars, persona,
    date: (spec = '0') => bakuDate(nowMs + offsetMs(String(spec))),
    iso: (spec = '0') => new Date(nowMs + offsetMs(String(spec))).toISOString(),
  };
  return ctx;
}

export function expandTemplates(value, ctx) {
  if (typeof value === 'string') {
    const whole = /^\{\{([^}]+)\}\}$/.exec(value);
    const sub = (expr) => {
      expr = expr.trim();
      if (expr.startsWith('date:')) return ctx.date(expr.slice(5));
      if (expr === 'date') return ctx.date('0');
      if (expr.startsWith('iso:')) return ctx.iso(expr.slice(4));
      if (expr === 'iso') return ctx.iso('0');
      if (expr.startsWith('json:')) return JSON.stringify(ctx.vars[expr.slice(5)]);
      if (expr in ctx.vars) return ctx.vars[expr];
      throw new Error(`unknown fixture token {{${expr}}}`);
    };
    if (whole) {
      const v = sub(whole[1]);
      return v;
    }
    return value.replace(/\{\{([^}]+)\}\}/g, (_, e) => String(sub(e)));
  }
  if (Array.isArray(value)) return value.map((v) => expandTemplates(v, ctx));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = expandTemplates(v, ctx);
    return out;
  }
  return value;
}

export function loadPersona(name) {
  const file = join(FIXTURES_DIR, name, 'persona.json');
  if (!existsSync(file)) throw new Error(`persona "${name}" has no ${file}`);
  const persona = JSON.parse(readFileSync(file, 'utf8'));
  persona.name = name;
  persona.chain = [name];
  if (persona.extends) {
    const parent = loadPersona(persona.extends);
    persona.chain.push(...parent.chain);
    for (const key of ['vars', 'store', 'localStorage', 'user', 'session']) {
      if (parent[key] && typeof parent[key] === 'object') persona[key] = { ...parent[key], ...(persona[key] || {}) };
    }
    for (const key of Object.keys(parent)) if (!(key in persona)) persona[key] = parent[key];
  }
  persona.chain.push('_shared');
  return persona;
}

const moduleCache = new Map();
async function loadModule(file) {
  if (!moduleCache.has(file)) moduleCache.set(file, import(pathToFileURL(file).href).then((m) => m.default));
  return moduleCache.get(file);
}

/**
 * Resolve fixtures/<persona chain>/<kind>/<name>.{mjs,json}. Returns { found, value }.
 * kind: 'tables' | 'rpc' | 'functions'. For .mjs the default export is called with (ctx, args).
 */
export async function resolveFixture(persona, ctx, kind, name, args) {
  for (const dir of persona.chain) {
    const base = join(FIXTURES_DIR, dir, kind, name);
    if (existsSync(base + '.mjs')) {
      const fn = await loadModule(base + '.mjs');
      const value = typeof fn === 'function' ? await fn(ctx, args) : fn;
      return { found: true, value: expandTemplates(value, ctx), source: `${dir}/${kind}/${name}.mjs` };
    }
    if (existsSync(base + '.json')) {
      const value = JSON.parse(readFileSync(base + '.json', 'utf8'));
      return { found: true, value: expandTemplates(value, ctx), source: `${dir}/${kind}/${name}.json` };
    }
  }
  return { found: false, value: undefined };
}
