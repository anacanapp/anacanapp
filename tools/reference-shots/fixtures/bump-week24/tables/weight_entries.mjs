export default (ctx) => [58, 58.6, 59.4, 60.3, 61.1, 62.0, 62.8, 63.5].map((weight, i, a) => ({
  id: `79000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, weight,
  entry_date: ctx.date(-(a.length - 1 - i) * 21), notes: null, created_at: ctx.iso(`-${(a.length - 1 - i) * 21}d`),
})).reverse();
