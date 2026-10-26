/**
 * Partner dashboard baby/pregnancy info cards — translation keys (az + en).
 * Run: node scripts/add-partner-babyinfo-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const KEYS = {
  // Week info card (bump)
  partnerv2_hefte_korpeniz: { az: 'həftə — körpəniz', en: 'week — your baby' },
  partnerv2_texminen: { az: 'Təxminən', en: 'About the size of' },
  partnerv2_boyukluyunde: { az: 'böyüklüyündə', en: '' },
  partnerv2_davamini_oxu: { az: 'Davamını oxu', en: 'Read more' },

  // Crisis card (mommy)
  partnerv2_kriz_dovru: { az: 'Kriz dövrü', en: 'Crisis period' },
  partnerv2_hefte_short: { az: 'həftə', en: 'week' },
  partnerv2_kriz_partner_mesaj: { az: '{baby} bu dövrdə daha narahat ola bilər — ana da yorulur. Gecə növbəsi və səbir sənin növbəndir. 💪', en: '{baby} may be fussier during this period — mom gets tired too. Night shifts and patience are on you. 💪' },
  partnerv2_butun_tovsiyeler: { az: 'Bütün tövsiyələr', en: 'All tips' },
  partnerv2_novbeti_kriz: { az: 'Növbəti kriz dövrü', en: 'Next crisis period' },
  partnerv2_hefte_sonra: { az: 'həftə sonra', en: 'weeks away' },
  partnerv2_hazir_ol: { az: 'hazır ol', en: 'be ready' },

  // Baby today strip (mommy)
  partnerv2_bu_gun_lower: { az: 'bu gün', en: 'today' },
  partnerv2_indi_yatir: { az: 'indi yatır', en: 'sleeping now' },
  partnerv2_yatir: { az: 'Yatır', en: 'Asleep' },
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
