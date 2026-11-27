export default (ctx) => [0, 1, 2, 4, 7, 9].map((n, i) => ({ id: `f4000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id,
  log_date: ctx.date(-n), mood: [4, 4, 5, 3, 3, 2][i], energy_level: [4, 4, 5, 3, 2, 2][i], pain_level: n >= 7 ? 3 : 0, flow_intensity: n >= 7 ? 'medium' : null,
  symptoms: n >= 7 ? ['cramps'] : [], cervical_mucus: n === 0 ? 'egg_white' : null, ovulation_test: n === 0 ? 'positive' : null, libido: 3, sexual_activity: null,
  sleep_hours: 7.5, sleep_quality: 4, temperature: n === 0 ? 36.7 : null, water_glasses: 6, notes: null, created_at: ctx.iso(`-${n}d`), updated_at: ctx.iso(`-${n}d`) }));
