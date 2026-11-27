export default (ctx) => [[0, 3.3, 50, 34.5], [30, 4.4, 54, 37], [61, 5.5, 58, 39], [91, 6.3, 61.5, 40.5], [122, 6.9, 63.5, 41.5], [152, 7.4, 65.5, 42.3], [180, 7.8, 67, 43]].map(([d, w, h, hc], i) => ({
  id: `a3000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, child_id: 'a1000000-0000-4000-8000-000000000001',
  entry_date: ctx.date(-183 + d), weight_kg: w, height_cm: h, head_cm: hc, notes: null, created_at: ctx.iso(`${-183 + d}d`) })).reverse();
