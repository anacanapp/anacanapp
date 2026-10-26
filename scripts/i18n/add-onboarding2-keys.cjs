const fs = require('fs');
const KEYS = {
  // Ümumi
  ponb2_subtitle: { az: 'Bir neçə qısa sual — hər şey sizə görə fərdiləşəcək', en: 'A few quick questions — everything will be personalized for you', ru: 'Несколько коротких вопросов — всё будет настроено под вас', tr: 'Birkaç kısa soru — her şey size göre kişiselleştirilecek' },
  ponb2_takes_minute: { az: 'Cəmi 1 dəqiqə çəkir', en: 'Takes just 1 minute', ru: 'Займёт всего 1 минуту', tr: 'Sadece 1 dakika sürer' },
  // Əkizlik
  ponb2_multiples_title: { az: 'Neçə körpə gözləyirsiniz?', en: 'How many babies are you expecting?', ru: 'Сколько малышей вы ожидаете?', tr: 'Kaç bebek bekliyorsunuz?' },
  ponb2_multiples_sub: { az: 'Bələdçi və icma qrupları buna görə seçilir', en: 'Guides and community groups are chosen accordingly', ru: 'Гиды и группы сообщества подбираются соответственно', tr: 'Rehberler ve topluluk grupları buna göre seçilir' },
  ponb2_multiples_single: { az: 'Tək körpə', en: 'One baby', ru: 'Один малыш', tr: 'Tek bebek' },
  ponb2_multiples_twins: { az: 'Əkiz', en: 'Twins', ru: 'Двойня', tr: 'İkiz' },
  ponb2_multiples_triplets: { az: 'Üçəm və ya çox', en: 'Triplets or more', ru: 'Тройня или больше', tr: 'Üçüz veya daha fazla' },
  // İlk hamiləlik
  ponb2_firstpreg_title: { az: 'Bu, ilk hamiləliyinizdir?', en: 'Is this your first pregnancy?', ru: 'Это ваша первая беременность?', tr: 'Bu ilk hamileliğiniz mi?' },
  ponb2_firstpreg_sub: { az: 'Məzmun təcrübənizə uyğunlaşır', en: 'Content adapts to your experience', ru: 'Контент адаптируется к вашему опыту', tr: 'İçerik deneyiminize göre uyarlanır' },
  ponb2_firstpreg_yes: { az: 'Bəli, ilk dəfədir', en: 'Yes, first time', ru: 'Да, впервые', tr: 'Evet, ilk kez' },
  ponb2_firstpreg_no: { az: 'Xeyr, təcrübəm var', en: 'No, I have experience', ru: 'Нет, у меня есть опыт', tr: 'Hayır, deneyimim var' },
  // Qidalanma üsulu
  ponb2_feeding_title: { az: 'Körpəniz necə qidalanır?', en: 'How is your baby fed?', ru: 'Как питается ваш малыш?', tr: 'Bebeğiniz nasıl besleniyor?' },
  ponb2_feeding_sub: { az: 'Qidalanma izləyicisi buna görə qurulur', en: 'The feeding tracker is set up accordingly', ru: 'Трекер кормления настраивается соответственно', tr: 'Beslenme takibi buna göre kurulur' },
  ponb2_feeding_breast: { az: 'Ana südü', en: 'Breastfeeding', ru: 'Грудное вскармливание', tr: 'Anne sütü' },
  ponb2_feeding_formula: { az: 'Süd əvəzedicisi', en: 'Formula', ru: 'Смесь', tr: 'Mama' },
  ponb2_feeding_mixed: { az: 'Qarışıq', en: 'Mixed', ru: 'Смешанное', tr: 'Karışık' },
  ponb2_feeding_solid: { az: 'Əlavə qidaya keçib', en: 'On solids', ru: 'На прикорме', tr: 'Ek gıdaya geçti' },
  // Gecə oyanmaları
  ponb2_nightwakes_title: { az: 'Körpəniz gecə neçə dəfə oyanır?', en: 'How often does your baby wake at night?', ru: 'Как часто малыш просыпается ночью?', tr: 'Bebeğiniz gece kaç kez uyanıyor?' },
  ponb2_nightwakes_sub: { az: 'Yuxu məsləhətləri buna görə fərdiləşir', en: 'Sleep advice is personalized accordingly', ru: 'Советы по сну персонализируются соответственно', tr: 'Uyku önerileri buna göre kişiselleştirilir' },
  ponb2_nightwakes_rare: { az: '0-1 dəfə', en: '0-1 times', ru: '0-1 раз', tr: '0-1 kez' },
  ponb2_nightwakes_sometimes: { az: '2-3 dəfə', en: '2-3 times', ru: '2-3 раза', tr: '2-3 kez' },
  ponb2_nightwakes_often: { az: '4+ dəfə', en: '4+ times', ru: '4+ раз', tr: '4+ kez' },
  ponb2_nightwakes_varies: { az: 'Hər gecə fərqlidir', en: 'Varies every night', ru: 'Каждую ночь по-разному', tr: 'Her gece farklı' },
  // Flow məqsəd
  ponb2_goal_title: { az: 'Əsas məqsədiniz nədir?', en: 'What is your main goal?', ru: 'Какова ваша главная цель?', tr: 'Ana hedefiniz nedir?' },
  ponb2_goal_sub: { az: 'Proqnozlar və məsləhətlər buna görə qurulur', en: 'Predictions and advice are built accordingly', ru: 'Прогнозы и советы строятся соответственно', tr: 'Tahminler ve öneriler buna göre kurulur' },
  ponb2_goal_track: { az: 'Periodumu izləmək', en: 'Track my period', ru: 'Отслеживать менструацию', tr: 'Reglimi takip etmek' },
  ponb2_goal_conceive: { az: 'Hamilə qalmaq istəyirəm', en: 'I want to get pregnant', ru: 'Хочу забеременеть', tr: 'Hamile kalmak istiyorum' },
  ponb2_goal_health: { az: 'Sağlamlığımı anlamaq', en: 'Understand my health', ru: 'Понять своё здоровье', tr: 'Sağlığımı anlamak' },
  ponb2_goal_symptoms: { az: 'Simptomlarımı idarə etmək', en: 'Manage my symptoms', ru: 'Управлять симптомами', tr: 'Semptomlarımı yönetmek' },
  // Müntəzəmlik
  ponb2_regularity_title: { az: 'Tsikliniz müntəzəmdir?', en: 'Is your cycle regular?', ru: 'Ваш цикл регулярный?', tr: 'Döngünüz düzenli mi?' },
  ponb2_regularity_sub: { az: 'Proqnoz dəqiqliyi buna görə tənzimlənir', en: 'Prediction accuracy is tuned accordingly', ru: 'Точность прогнозов настраивается соответственно', tr: 'Tahmin doğruluğu buna göre ayarlanır' },
  ponb2_regularity_yes: { az: 'Bəli, müntəzəmdir', en: 'Yes, regular', ru: 'Да, регулярный', tr: 'Evet, düzenli' },
  ponb2_regularity_no: { az: 'Qeyri-müntəzəmdir', en: 'Irregular', ru: 'Нерегулярный', tr: 'Düzensiz' },
  ponb2_regularity_unsure: { az: 'Əmin deyiləm', en: 'Not sure', ru: 'Не уверена', tr: 'Emin değilim' },
  // Bump simptomları
  ponb2_bsymptoms_title: { az: 'Hazırda sizi nə narahat edir?', en: 'What bothers you right now?', ru: 'Что вас беспокоит сейчас?', tr: 'Şu anda sizi ne rahatsız ediyor?' },
  ponb2_bsymptoms_sub: { az: 'Bir neçəsini seçə bilərsiniz', en: 'You can select several', ru: 'Можно выбрать несколько', tr: 'Birkaçını seçebilirsiniz' },
  ponb2_bsym_nausea: { az: 'Ürəkbulanma', en: 'Nausea', ru: 'Тошнота', tr: 'Bulantı' },
  ponb2_bsym_fatigue: { az: 'Yorğunluq', en: 'Fatigue', ru: 'Усталость', tr: 'Yorgunluk' },
  ponb2_bsym_backpain: { az: 'Bel ağrısı', en: 'Back pain', ru: 'Боль в спине', tr: 'Bel ağrısı' },
  ponb2_bsym_insomnia: { az: 'Yuxusuzluq', en: 'Insomnia', ru: 'Бессонница', tr: 'Uykusuzluk' },
  ponb2_bsym_heartburn: { az: 'Qıcqırma', en: 'Heartburn', ru: 'Изжога', tr: 'Mide yanması' },
  ponb2_bsym_swelling: { az: 'Şişkinlik', en: 'Swelling', ru: 'Отёки', tr: 'Şişlik' },
  ponb2_sym_none: { az: 'Heç biri', en: 'None', ru: 'Ничего', tr: 'Hiçbiri' },
  // Bump maraqları
  ponb2_binterests_title: { az: 'Sizə ən çox nə maraqlıdır?', en: 'What interests you most?', ru: 'Что вам интереснее всего?', tr: 'En çok ne ilginizi çekiyor?' },
  ponb2_binterests_sub: { az: 'Ana səhifəniz buna görə qurulacaq', en: 'Your home screen will be built accordingly', ru: 'Ваш главный экран будет построен соответственно', tr: 'Ana sayfanız buna göre kurulacak' },
  ponb2_bint_development: { az: 'Körpənin inkişafı', en: "Baby's development", ru: 'Развитие малыша', tr: 'Bebeğin gelişimi' },
  ponb2_bint_nutrition: { az: 'Qidalanma', en: 'Nutrition', ru: 'Питание', tr: 'Beslenme' },
  ponb2_bint_exercise: { az: 'Hamiləlik məşqləri', en: 'Pregnancy exercises', ru: 'Упражнения для беременных', tr: 'Hamilelik egzersizleri' },
  ponb2_bint_birthprep: { az: 'Doğuşa hazırlıq', en: 'Birth preparation', ru: 'Подготовка к родам', tr: 'Doğuma hazırlık' },
  ponb2_bint_names: { az: 'Körpə adları', en: 'Baby names', ru: 'Имена для малыша', tr: 'Bebek isimleri' },
  ponb2_bint_shopping: { az: 'Alış-veriş siyahısı', en: 'Shopping list', ru: 'Список покупок', tr: 'Alışveriş listesi' },
  // Mommy maraqları
  ponb2_minterests_title: { az: 'Sizə ən çox nə lazımdır?', en: 'What do you need most?', ru: 'Что вам нужнее всего?', tr: 'En çok neye ihtiyacınız var?' },
  ponb2_minterests_sub: { az: 'Ana səhifəniz buna görə qurulacaq', en: 'Your home screen will be built accordingly', ru: 'Ваш главный экран будет построен соответственно', tr: 'Ana sayfanız buna göre kurulacak' },
  ponb2_mint_sleep: { az: 'Yuxu rejimi', en: 'Sleep schedule', ru: 'Режим сна', tr: 'Uyku düzeni' },
  ponb2_mint_feeding: { az: 'Qidalanma izləmə', en: 'Feeding tracking', ru: 'Трекер кормления', tr: 'Beslenme takibi' },
  ponb2_mint_milestones: { az: 'İnkişaf mərhələləri', en: 'Milestones', ru: 'Этапы развития', tr: 'Gelişim aşamaları' },
  ponb2_mint_vaccines: { az: 'Peyvənd təqvimi', en: 'Vaccine schedule', ru: 'Календарь прививок', tr: 'Aşı takvimi' },
  ponb2_mint_teething: { az: 'Diş çıxarma', en: 'Teething', ru: 'Прорезывание зубов', tr: 'Diş çıkarma' },
  ponb2_mint_games: { az: 'Yaşa uyğun oyunlar', en: 'Age-appropriate games', ru: 'Игры по возрасту', tr: 'Yaşa uygun oyunlar' },
  // Flow simptomları
  ponb2_fsymptoms_title: { az: 'Period dövründə nə yaşayırsınız?', en: 'What do you experience during your period?', ru: 'Что вы испытываете во время менструации?', tr: 'Regl döneminde neler yaşıyorsunuz?' },
  ponb2_fsymptoms_sub: { az: 'Bir neçəsini seçə bilərsiniz', en: 'You can select several', ru: 'Можно выбрать несколько', tr: 'Birkaçını seçebilirsiniz' },
  ponb2_fsym_cramps: { az: 'Sancı / ağrı', en: 'Cramps / pain', ru: 'Спазмы / боль', tr: 'Kramp / ağrı' },
  ponb2_fsym_mood: { az: 'Əhval dəyişikliyi', en: 'Mood changes', ru: 'Перепады настроения', tr: 'Ruh hali değişimi' },
  ponb2_fsym_bloating: { az: 'Şişkinlik', en: 'Bloating', ru: 'Вздутие', tr: 'Şişkinlik' },
  ponb2_fsym_headache: { az: 'Baş ağrısı', en: 'Headache', ru: 'Головная боль', tr: 'Baş ağrısı' },
  ponb2_fsym_acne: { az: 'Dəri problemləri', en: 'Skin problems', ru: 'Проблемы с кожей', tr: 'Cilt sorunları' },
  // Ad / cins / doğum
  ponb2_name_title: { az: 'Körpənizin adı nədir?', en: "What is your baby's name?", ru: 'Как зовут вашего малыша?', tr: 'Bebeğinizin adı ne?' },
  ponb2_name_sub: { az: 'Bütün bələdçi onun adı ilə danışacaq', en: 'The whole guide will speak using their name', ru: 'Весь гид будет обращаться по имени', tr: 'Tüm rehber onun adıyla konuşacak' },
  ponb2_gender_title: { az: '{name} — qız, yoxsa oğlan?', en: '{name} — girl or boy?', ru: '{name} — девочка или мальчик?', tr: '{name} — kız mı, erkek mi?' },
  ponb2_gender_title_noname: { az: 'Qız, yoxsa oğlan?', en: 'Girl or boy?', ru: 'Девочка или мальчик?', tr: 'Kız mı, erkek mi?' },
  ponb2_birth_title: { az: '{name} nə vaxt doğulub?', en: 'When was {name} born?', ru: 'Когда родился(ась) {name}?', tr: '{name} ne zaman doğdu?' },
  ponb2_birth_baby: { az: 'Körpəniz', en: 'Your baby', ru: 'Ваш малыш', tr: 'Bebeğiniz' },
  // Tsikl parametrləri
  ponb2_cycle_title: { az: 'Tsikl parametrləriniz', en: 'Your cycle settings', ru: 'Параметры вашего цикла', tr: 'Döngü ayarlarınız' },
  ponb2_cycle_sub: { az: 'Əmin deyilsinizsə, olduğu kimi saxlayın — sonra dəqiqləşəcək', en: "If unsure, keep as is — it'll refine over time", ru: 'Если не уверены, оставьте как есть — со временем уточнится', tr: 'Emin değilseniz olduğu gibi bırakın — zamanla netleşecek' },
  // Bildirişlər
  ponb2_notif_title: { az: 'Heç nəyi qaçırmayın', en: "Don't miss anything", ru: 'Ничего не пропустите', tr: 'Hiçbir şeyi kaçırmayın' },
  ponb2_notif_sub_bump: { az: 'Həftəlik inkişaf xəbərləri, su və vitamin xatırlatmaları', en: 'Weekly development updates, water and vitamin reminders', ru: 'Еженедельные новости развития, напоминания о воде и витаминах', tr: 'Haftalık gelişim haberleri, su ve vitamin hatırlatmaları' },
  ponb2_notif_sub_mommy: { az: 'Gündəlik inkişaf məsləhətləri, peyvənd və qulluq xatırlatmaları', en: 'Daily development tips, vaccine and care reminders', ru: 'Ежедневные советы по развитию, напоминания о прививках и уходе', tr: 'Günlük gelişim önerileri, aşı ve bakım hatırlatmaları' },
  ponb2_notif_sub_flow: { az: 'Period yaxınlaşanda və ovulyasiya günlərində xəbərdarlıq', en: 'Alerts when your period is near and on ovulation days', ru: 'Оповещения о приближении менструации и днях овуляции', tr: 'Regl yaklaşırken ve yumurtlama günlerinde uyarı' },
  ponb2_notif_b1: { az: 'Gündəlik fərdi məsləhətlər', en: 'Daily personalized tips', ru: 'Ежедневные персональные советы', tr: 'Günlük kişisel öneriler' },
  ponb2_notif_b1_flow: { az: 'Period 2 gün qalmış xəbərdarlıq', en: 'Alert 2 days before your period', ru: 'Оповещение за 2 дня до менструации', tr: 'Regl 2 gün kala uyarı' },
  ponb2_notif_b2: { az: 'Su və vitamin xatırlatmaları', en: 'Water and vitamin reminders', ru: 'Напоминания о воде и витаминах', tr: 'Su ve vitamin hatırlatmaları' },
  ponb2_notif_b3: { az: 'Vacib mərhələ bildirişləri', en: 'Important milestone alerts', ru: 'Уведомления о важных этапах', tr: 'Önemli aşama bildirimleri' },
  ponb2_notif_allow: { az: 'Bildirişlərə icazə ver', en: 'Allow notifications', ru: 'Разрешить уведомления', tr: 'Bildirimlere izin ver' },
  ponb2_notif_skip: { az: 'İndi yox', en: 'Not now', ru: 'Не сейчас', tr: 'Şimdi değil' },
};

for (const [f, lang] of [['src/locales/az.json', 'az'], ['src/locales/en.json', 'en'], ['scripts/i18n/ru.seed.json', 'ru'], ['scripts/i18n/tr.seed.json', 'tr']]) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(KEYS)) if (!d[k]) { d[k] = v[lang]; n++; }
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  console.log('✓', f, '+' + n);
}

const esc = (s) => s.replace(/'/g, "''");
const rows = [];
for (const [k, v] of Object.entries(KEYS)) {
  for (const l of ['ru', 'tr', 'en']) rows.push(`  ('${k}', '${l}', '${esc(v[l])}', 'common')`);
}
const sql = [
  '-- Onboarding v2 (sual-əsaslı) UI açarları (ru/tr/en) — idempotent',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/migrations/20260813150030_onboarding_v2_ui_keys.sql', sql);
fs.copyFileSync('supabase/migrations/20260813150030_onboarding_v2_ui_keys.sql', 'supabase/son/Son12.sql');
console.log('✓ Son12.sql +', rows.length, 'sətir');
