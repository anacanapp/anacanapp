// Cəmiyyət çoxdilli feed + tərcümə UI açarları — locale/seed fayllarına yazır.
// SQL tərəfi əl ilə Son27.sql-də (DDL ilə birlikdə) — bu script yalnız JSON-ları yeniləyir.
const fs = require('fs');
const KEYS = {
  postcard_tercumeni_gor: { az: 'Tərcüməni gör', en: 'See translation', ru: 'Показать перевод', tr: 'Çeviriyi gör' },
  postcard_orijinali_goster: { az: 'Orijinalı göstər', en: 'Show original', ru: 'Показать оригинал', tr: 'Orijinali göster' },
  postcard_tercume_olunur: { az: 'Tərcümə olunur…', en: 'Translating…', ru: 'Переводится…', tr: 'Çevriliyor…' },
  postcard_tercume_xetasi: { az: 'Tərcümə alınmadı — yenidən cəhd edin', en: 'Translation failed — try again', ru: 'Перевод не удался — попробуйте ещё раз', tr: 'Çeviri başarısız — tekrar deneyin' },
  createpost_post_dili: { az: 'Post dili', en: 'Post language', ru: 'Язык поста', tr: 'Gönderi dili' },
  community_feed_dilleri: { az: 'Feed dilləri', en: 'Feed languages', ru: 'Языки ленты', tr: 'Akış dilleri' },
  community_diger_dillerde: { az: 'Digər dillərdə', en: 'In other languages', ru: 'На других языках', tr: 'Diğer dillerde' },
  community_min_bir_dil: { az: 'Ən azı bir dil seçili qalmalıdır', en: 'At least one language must stay selected', ru: 'Должен остаться хотя бы один язык', tr: 'En az bir dil seçili kalmalıdır' },
};
for (const [f, lang] of [['src/locales/az.json', 'az'], ['src/locales/en.json', 'en'], ['scripts/i18n/ru.seed.json', 'ru'], ['scripts/i18n/tr.seed.json', 'tr']]) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(KEYS)) if (!d[k]) { d[k] = v[lang]; n++; }
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  console.log('✓', f, '+' + n);
}
