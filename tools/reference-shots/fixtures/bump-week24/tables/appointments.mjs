export default (ctx) => [
  ['Həkim müayinəsi', 'Dr. Aynur Məmmədova, 2 saylı doğum evi', '+3', '10:30', 'doctor'],
  ['Qlükoza testi (OGTT)', 'Ac qarına gəlmək', '+10', '09:00', 'test'],
  ['USM — 28 həftə', null, '+27', '11:15', 'ultrasound'],
].map(([title, description, d, time, type], i) => ({
  id: `78000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id, title, description,
  event_date: ctx.date(d), event_time: time, event_type: type, reminder_enabled: true, created_at: ctx.iso('-20d'),
}));
