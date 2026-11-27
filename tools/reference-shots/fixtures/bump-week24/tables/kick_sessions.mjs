export default (ctx) => [[10, 1260, '-0'], [10, 1580, '-1'], [10, 1120, '-2'], [8, 1800, '-3']].map(([kick_count, duration_seconds, d], i) => ({
  id: `7a000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, kick_count, duration_seconds,
  session_date: ctx.date(d), position: null, created_at: ctx.iso(`${d}d`),
}));
