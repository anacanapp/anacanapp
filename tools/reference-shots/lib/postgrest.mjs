// Minimal PostgREST semantics over in-memory fixture rows: horizontal filters (eq/neq/gt/gte/lt/lte/in/is/
// like/ilike/cs/cd/ov, not.*, or=(...), and=(...)), order, limit/offset, column projection of top-level
// fields (embedded resources are kept as they appear in the fixture row), single-object responses and counts.
// Unsupported filters are ignored (permissive) and reported back so the caller can log them.

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function splitTopLevel(text, sep = ',') {
  const out = []; let depth = 0, quote = false, cur = '';
  for (const ch of text) {
    if (ch === '"') quote = !quote;
    if (!quote && (ch === '(' || ch === '{' || ch === '[')) depth++;
    if (!quote && (ch === ')' || ch === '}' || ch === ']')) depth--;
    if (!quote && depth === 0 && ch === sep) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const unquote = (v) => (v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);

function parseList(v) {
  const inner = v.replace(/^[({]/, '').replace(/[)}]$/, '');
  return inner === '' ? [] : splitTopLevel(inner).map((x) => unquote(x.trim()));
}

function cmpValues(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (typeof a === 'number' || (typeof a === 'string' && /^-?\d+(\.\d+)?$/.test(a) && /^-?\d+(\.\d+)?$/.test(String(b)))) {
    const x = Number(a), y = Number(b);
    if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  }
  if (typeof a === 'boolean') return String(a) === String(b) ? 0 : (String(a) < String(b) ? -1 : 1);
  const s = String(a), t = String(b);
  return s === t ? 0 : s < t ? -1 : 1;
}

function likeToRegex(pattern, flags) {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, flags);
}

function getField(row, column) {
  // JSON path: col->a->>b
  const parts = column.split(/->>?/);
  let v = row?.[parts[0]];
  for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
  return v;
}

/** Evaluate `op.value` (possibly `not.op.value`) against a row's column. Returns true/false or null if unsupported. */
function evalOp(row, column, expr) {
  let negate = false;
  if (expr.startsWith('not.')) { negate = true; expr = expr.slice(4); }
  const dot = expr.indexOf('.');
  if (dot < 0) return null;
  const op = expr.slice(0, dot); const raw = expr.slice(dot + 1);
  const field = getField(row, column);
  let result;
  switch (op) {
    case 'eq': result = field !== undefined && field !== null && cmpValues(field, unquote(raw)) === 0; break;
    case 'neq': result = field === null || field === undefined || cmpValues(field, unquote(raw)) !== 0; break;
    case 'gt': result = field != null && cmpValues(field, raw) > 0; break;
    case 'gte': result = field != null && cmpValues(field, raw) >= 0; break;
    case 'lt': result = field != null && cmpValues(field, raw) < 0; break;
    case 'lte': result = field != null && cmpValues(field, raw) <= 0; break;
    case 'in': result = parseList(raw).some((v) => field != null && cmpValues(field, v) === 0); break;
    case 'is':
      if (raw === 'null') result = field === null || field === undefined;
      else if (raw === 'true') result = field === true;
      else if (raw === 'false') result = field === false;
      else result = null;
      break;
    case 'like': result = field != null && likeToRegex(raw, '').test(String(field)); break;
    case 'ilike': result = field != null && likeToRegex(raw, 'i').test(String(field)); break;
    case 'cs': { const want = parseList(raw); result = Array.isArray(field) && want.every((w) => field.map(String).includes(w)); break; }
    case 'cd': { const allow = parseList(raw); result = Array.isArray(field) && field.every((f) => allow.includes(String(f))); break; }
    case 'ov': { const any = parseList(raw); result = Array.isArray(field) && field.some((f) => any.includes(String(f))); break; }
    case 'fts': case 'plfts': case 'phfts': case 'wfts': result = null; break;
    default: result = null;
  }
  if (result === null) return null;
  return negate ? !result : result;
}

/** `(a.eq.1,b.gt.2,and(c.is.null,d.eq.x))` */
function evalLogic(row, kind, body, unsupported) {
  const items = splitTopLevel(body.replace(/^\(/, '').replace(/\)$/, ''));
  const results = items.map((item) => {
    item = item.trim();
    const nested = /^(not\.)?(and|or)(\(.*\))$/.exec(item);
    if (nested) { const r = evalLogic(row, nested[2], nested[3], unsupported); return nested[1] ? !r : r; }
    const dot = item.indexOf('.');
    const column = item.slice(0, dot); const expr = item.slice(dot + 1);
    const r = evalOp(row, column, expr);
    if (r === null) { unsupported.add(`${kind}:${item}`); return true; }
    return r;
  });
  return kind === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function project(row, select) {
  if (!select || select.trim() === '*' ) return row;
  const cols = splitTopLevel(select.replace(/\s+/g, ''));
  if (cols.includes('*')) return row;
  const out = {};
  for (let col of cols) {
    // alias:column, column::cast, relation(...) / alias:relation!fk(...)
    let alias = null;
    const embed = /^([^()]+?)\((.*)\)$/.exec(col);
    if (embed) {
      let name = embed[1];
      if (name.includes(':')) [alias, name] = name.split(':');
      name = name.split('!')[0];
      const key = alias || name;
      if (row[key] !== undefined) out[key] = row[key];
      else if (row[name] !== undefined) out[key] = row[name];
      continue;
    }
    col = col.split('::')[0];
    if (col.includes(':')) [alias, col] = col.split(':');
    const base = col.split(/->>?/)[0];
    const key = alias || (col.includes('->') ? col.split(/->>?/).pop() : base);
    const v = col.includes('->') ? getField(row, col) : row[base];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

export function runQuery(rows, params) {
  const unsupported = new Set();
  let result = rows.filter((row) => {
    for (const [key, value] of params) {
      if (RESERVED.has(key)) continue;
      if (key === 'or' || key === 'and') { if (!evalLogic(row, key, value, unsupported)) return false; continue; }
      if (key === 'not.or' || key === 'not.and') { if (evalLogic(row, key.slice(4), value, unsupported)) return false; continue; }
      if (key.includes('.') && !key.includes('->')) { unsupported.add(`embedded:${key}=${value}`); continue; } // embedded filter
      const r = evalOp(row, key, value);
      if (r === null) { unsupported.add(`${key}=${value}`); continue; }
      if (!r) return false;
    }
    return true;
  });
  const order = params.get('order');
  if (order) {
    const keys = splitTopLevel(order).map((spec) => {
      const [col, ...mods] = spec.split('.');
      return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') ? true : mods.includes('nullslast') ? false : null };
    }).filter((k) => !k.col.includes('('));
    result = [...result].sort((a, b) => {
      for (const k of keys) {
        const x = getField(a, k.col), y = getField(b, k.col);
        const xn = x == null, yn = y == null;
        if (xn || yn) {
          if (xn && yn) continue;
          const nullsFirst = k.nullsFirst ?? k.desc; // PostgreSQL default: NULLS LAST for asc, FIRST for desc
          return xn ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1);
        }
        const c = cmpValues(x, y);
        if (c !== 0) return k.desc ? -c : c;
      }
      return 0;
    });
  }
  const total = result.length;
  const offset = Number(params.get('offset') || 0);
  const limit = params.has('limit') ? Number(params.get('limit')) : undefined;
  result = result.slice(offset, limit === undefined ? undefined : offset + limit);
  const select = params.get('select');
  return { rows: result.map((r) => project(r, select)), total, offset, unsupported: [...unsupported] };
}

/** Matching predicate for PATCH/DELETE. */
export function matches(row, params) {
  return runQuery([row], params).rows.length === 1;
}
