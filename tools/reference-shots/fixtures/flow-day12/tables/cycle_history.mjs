export default (ctx) => [1, 2, 3, 4, 5].map((k) => {
  const lens = [28, 29, 27, 28, 28]; let back = 11; for (let i = 0; i < k; i++) back += lens[i];
  return { id: `f1000000-0000-4000-8000-${String(k).padStart(12, '0')}`, user_id: ctx.vars.user_id, cycle_number: 6 - k,
    start_date: ctx.date(-back), end_date: ctx.date(-back + lens[k - 1] - 1), cycle_length: lens[k - 1], period_length: [5, 5, 4, 6, 5][k - 1],
    ovulation_date: ctx.date(-back + lens[k - 1] - 14), notes: null, created_at: ctx.iso(`-${back}d`) };
});
