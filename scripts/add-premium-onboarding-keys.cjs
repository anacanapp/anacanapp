/**
 * Premium Onboarding (ponb_*) — translation keys.
 * Run: node scripts/add-premium-onboarding-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  ponb_title: { az: 'Sizi tanıyaq', en: 'Let\u2019s get to know you' },
  ponb_subtitle: { az: 'Hansı mərhələdəsiniz? Hər şey buna görə fərdiləşəcək.', en: 'Which stage are you in? Everything gets personalized around it.' },

  ponb_stage_bump: { az: 'Hamiləyəm', en: 'I\u2019m pregnant' },
  ponb_stage_bump_sub: { az: 'Həftə-həftə körpənizin inkişafını izləyin', en: 'Follow your baby\u2019s development week by week' },
  ponb_stage_mommy: { az: 'Anayam', en: 'I\u2019m a mom' },
  ponb_stage_mommy_sub: { az: 'Körpənizin qulluq və inkişaf bələdçisi', en: 'Care and development guide for your baby' },
  ponb_stage_flow: { az: 'Tsiklimi izləyirəm', en: 'I\u2019m tracking my cycle' },
  ponb_stage_flow_sub: { az: 'Ağıllı period və ovulyasiya proqnozları', en: 'Smart period and ovulation predictions' },

  ponb_bump_title: { az: 'Tarixi qeyd edək', en: 'Let\u2019s set the date' },
  ponb_bump_sub: { az: 'Bir tarix kifayətdir — qalanını biz hesablayırıq', en: 'One date is enough — we calculate the rest' },
  ponb_bump_lmp: { az: 'Son menstruasiya', en: 'Last period' },
  ponb_bump_due: { az: 'Doğuş tarixi (USM)', en: 'Due date (ultrasound)' },
  ponb_bump_lmp_label: { az: 'Son menstruasiyanın ilk günü', en: 'First day of your last period' },
  ponb_bump_due_label: { az: 'Gözlənilən doğuş tarixi', en: 'Expected due date' },

  ponb_mommy_title: { az: 'Körpənizi tanıyaq', en: 'Tell us about your baby' },
  ponb_mommy_sub: { az: 'İnkişaf bələdçisi yaşa görə fərdiləşir', en: 'The development guide is personalized by age' },
  ponb_mommy_name: { az: 'Körpənin adı', en: 'Baby\u2019s name' },
  ponb_mommy_name_ph: { az: 'məs. Aylin', en: 'e.g. Aylin' },
  ponb_mommy_gender: { az: 'Cinsi', en: 'Gender' },
  ponb_mommy_birth: { az: 'Doğum tarixi', en: 'Birth date' },
  ponb_gender_girl: { az: 'Qız', en: 'Girl' },
  ponb_gender_boy: { az: 'Oğlan', en: 'Boy' },

  ponb_flow_title: { az: 'Tsiklinizi quraq', en: 'Let\u2019s set up your cycle' },
  ponb_flow_sub: { az: 'Proqnozlar istifadə etdikcə avtomatik dəqiqləşir', en: 'Predictions get smarter automatically as you log' },
  ponb_flow_lmp: { az: 'Son periodun ilk günü', en: 'First day of your last period' },
  ponb_flow_cycle: { az: 'Tsikl uzunluğu', en: 'Cycle length' },
  ponb_flow_period: { az: 'Period uzunluğu', en: 'Period length' },
  ponb_flow_days: { az: '{n} gün', en: '{n} days' },

  ponb_continue: { az: 'Davam et', en: 'Continue' },
  ponb_saving: { az: 'Saxlanılır...', en: 'Saving...' },
  ponb_change_later: { az: 'Bütün məlumatları sonra parametrlərdən dəyişə bilərsiniz', en: 'You can change everything later in settings' },
  ponb_error: { az: 'Xəta baş verdi', en: 'Something went wrong' },
  ponb_error_desc: { az: 'Məlumatlar saxlanıla bilmədi — yenidən cəhd edin', en: 'Could not save — please try again' },
};

for (const lang of ['az', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0;
  let updated = 0;
  for (const [key, values] of Object.entries(KEYS)) {
    if (!(key in json)) {
      json[key] = values[lang];
      added++;
    } else if (json[key] !== values[lang]) {
      json[key] = values[lang];
      updated++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${lang}.json: ${added} added, ${updated} updated (${Object.keys(json).length} total)`);
}
