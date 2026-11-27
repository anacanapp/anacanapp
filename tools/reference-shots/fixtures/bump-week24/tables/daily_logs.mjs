export default (ctx) => [0, 1, 2, 3, 4, 5].map((n) => ({
  id: `7b000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, log_date: ctx.date(-n),
  mood: [4, 5, 3, 4, 4, 5][n], symptoms: [['back_pain'], [], ['fatigue', 'heartburn'], [], ['swelling'], []][n], water_intake: [5, 8, 7, 6, 8, 7][n],
  sleep_hours: [7, 8, 6, 7.5, 7, 8][n], sleep_quality: 4, notes: null, bleeding: null, temperature: null, created_at: ctx.iso(`-${n}d`),
}));
