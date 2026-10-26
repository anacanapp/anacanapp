// Birdəfəlik codemod: send-daily-notifications pickLang çağırışlarını yeni imzaya keçirir.
const fs = require('fs');
const p = 'supabase/functions/send-daily-notifications/index.ts';
let s = fs.readFileSync(p, 'utf8');
const before = s;
s = s
  .split("pickLang(dn.title, dn.title_en, user.language)")
  .join("pickLang(dn as unknown as Record<string, unknown>, 'title', user.language)")
  .split("pickLang(dn.body, dn.body_en, user.language)")
  .join("pickLang(dn as unknown as Record<string, unknown>, 'body', user.language)")
  .split("pickLang(match.title, match.title_en, user.language)")
  .join("pickLang(match as unknown as Record<string, unknown>, 'title', user.language)")
  .split("pickLang(match.body, match.body_en, user.language)")
  .join("pickLang(match as unknown as Record<string, unknown>, 'body', user.language)");
fs.writeFileSync(p, s, 'utf8');
const leftovers = (s.match(/pickLang\([a-z]+\.(title|body),/g) || []).length;
console.log('dəyişdi:', before !== s, '| qalan köhnə çağırış:', leftovers);
