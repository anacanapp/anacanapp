export default (ctx) => [11, 10, 9, 8, 7].map((n, i) => ({ id: `f3000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id,
  log_date: ctx.date(-n), flow_intensity: ['light', 'medium', 'heavy', 'medium', 'light'][i], notes: null, created_at: ctx.iso(`-${n}d`) }));
