export default (ctx) => [['smile', -140], ['head', -100], ['roll', -60], ['sit', 0]].map(([key, d], i) => ({
  id: `a4000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, child_id: 'a1000000-0000-4000-8000-000000000001',
  milestone_key: key, milestone_id: key, achieved_at: ctx.iso(`${d}d`), notes: null, created_at: ctx.iso(`${d}d`) }));
