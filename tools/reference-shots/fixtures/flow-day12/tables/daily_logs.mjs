export default (ctx) => [0, 1, 2, 3, 4, 7, 8, 9, 10, 11].map((n, i) => ({
  id: `f2000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, log_date: ctx.date(-n),
  mood: [4, 4, 5, 3, 4, 3, 2, 3, 2, 3][i], symptoms: n >= 7 ? ['cramps'] : n === 0 ? ['discharge'] : [], bleeding: n >= 7 ? ['light', 'medium', 'heavy', 'heavy', 'medium'][n - 7] : null,
  water_intake: 6, sleep_hours: 7.5, sleep_quality: 4, temperature: n === 0 ? 36.7 : null, notes: null, created_at: ctx.iso(`-${n}d`),
}));
