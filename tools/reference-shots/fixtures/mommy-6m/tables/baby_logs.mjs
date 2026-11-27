// Last 7 days of sleep / feeding / diaper logs for Aylin (start_time >= now-7d is what the dashboard reads).
export default (ctx) => {
  const rows = []; let n = 0;
  const add = (log_type, startH, durMin, extra = {}) => {
    n++;
    const start = ctx.now - startH * 3600_000;
    rows.push({ id: `a2000000-0000-4000-8000-${String(n).padStart(12, '0')}`, user_id: ctx.vars.user_id, child_id: 'a1000000-0000-4000-8000-000000000001',
      log_type, start_time: new Date(start).toISOString(), end_time: durMin ? new Date(start + durMin * 60_000).toISOString() : null,
      amount_ml: null, feed_type: null, diaper_type: null, notes: null, created_at: new Date(start).toISOString(), ...extra });
  };
  for (let d = 0; d < 7; d++) {
    const o = d * 24;
    add('sleep', o + 12, 600); add('sleep', o + 4.5, 75); add('sleep', o + 1.5, 45);
    add('feeding', o + 2, 20, { feed_type: 'breast_left' }); add('feeding', o + 5, 18, { feed_type: 'breast_right' });
    add('feeding', o + 8, 0, { feed_type: 'bottle', amount_ml: 150 }); add('feeding', o + 0.5, 0, { feed_type: 'solid', notes: 'Brokkoli püresi' });
    add('diaper', o + 1, 0, { diaper_type: 'wet' }); add('diaper', o + 6, 0, { diaper_type: 'dirty' }); add('diaper', o + 9, 0, { diaper_type: 'both' });
  }
  return rows.filter((r) => Date.parse(r.start_time) <= ctx.now);
};
