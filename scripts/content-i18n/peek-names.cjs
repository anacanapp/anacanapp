const s = require('fs').readFileSync('supabase/migrations/20260813150021_baby_names_tr_ru_seed.sql', 'utf8').split('\n');
const tr = s.filter((l) => l.endsWith("lang = 'tr');"));
const ru = s.filter((l) => l.endsWith("lang = 'ru');"));
[tr[0], tr[65], tr[130], ru[0], ru[65], ru[125]].forEach((l) => console.log((l || '').slice(24, 200)));
console.log('tr:', tr.length, '| ru:', ru.length);
