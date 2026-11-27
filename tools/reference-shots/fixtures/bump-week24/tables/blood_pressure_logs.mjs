export default (ctx) => [[112, 72, 78, 0], [118, 76, 82, 2], [110, 70, 75, 5], [121, 79, 80, 9], [115, 74, 77, 14]].map(([systolic, diastolic, pulse, d], i) => ({
  id: `88000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, systolic, diastolic, pulse, notes: null,
  measured_at: ctx.iso(`-${d}d`), created_at: ctx.iso(`-${d}d`) }));
