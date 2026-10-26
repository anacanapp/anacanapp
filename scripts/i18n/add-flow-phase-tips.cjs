const fs = require('fs');

// ── 1) UI açarları ──
const KEYS = {
  flowdashboard_novbeti_period_b29c4a: { az: 'Növbəti Period', en: 'Upcoming Period', ru: 'Следующая менструация', tr: 'Sonraki Regl' },
  flowdashboard_reproduktiv_dovr_80642c: { az: 'Reproduktiv Dövr', en: 'Fertile Window', ru: 'Фертильное окно', tr: 'Doğurgan Dönem' },
  flowdashboard_ovulyasiya_gunu_811e84: { az: 'Ovulyasiya Günü', en: 'Ovulation Day', ru: 'День овуляции', tr: 'Yumurtlama Günü' },
};

for (const [f, lang] of [['src/locales/az.json', 'az'], ['src/locales/en.json', 'en'], ['scripts/i18n/ru.seed.json', 'ru'], ['scripts/i18n/tr.seed.json', 'tr']]) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(KEYS)) if (!d[k]) { d[k] = v[lang]; n++; }
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  console.log('✓', f, '+' + n);
}

// ── 2) menstruation_phase_tips tərcümələri (34 sətir, Fable tərcüməsi) ──
const T = {
  '834fd4e8-3dbc-429f-8947-3db24a1be46e': { tru: 'Максимум энергии', cru: 'Ваша энергия и уверенность на пике. Идеальное время для сложных задач и важных встреч.', ttr: 'Maksimum Enerji', ctr: 'Enerjiniz ve özgüveniniz zirvede. Zorlu işleri ve önemli görüşmeleri halletmek için ideal zaman.' },
  '3f34eb4c-27d8-4049-bc4a-8a2df68d2e81': { tru: 'Навыки общения', cru: 'Ваше красноречие на высоте. Отличная возможность для презентаций, переговоров и сложных разговоров.', ttr: 'İletişim Becerileri', ctr: 'Hitabet yeteneğiniz yüksek. Sunumlar, müzakereler ve zor konuşmalar için harika bir fırsat.' },
  '1154102c-a3d0-4026-b540-8a6fb7b272f0': { tru: 'Продукты с антиоксидантами', cru: 'Для здоровья яйцеклеток употребляйте антиоксиданты: ягоды, зелень и разноцветные овощи.', ttr: 'Antioksidan Besinler', ctr: 'Yumurta sağlığı için antioksidan tüketin: orman meyveleri, yeşillikler ve rengârenk sebzeler.' },
  'd2e9d59c-44a5-4404-a19f-ac4856a006b5': { tru: 'Повышение либидо', cru: 'Повышение либидо — это нормально. Прислушивайтесь к сигналам своего тела и общайтесь с партнёром.', ttr: 'Libido Artışı', ctr: 'Libidonun yükselmesi normaldir. Bedeninizin sinyallerini dinleyin ve partnerinizle iletişim kurun.' },
  'fda2ecdf-1ca3-418d-aab9-c4ca370581b2': { tru: 'Омега-3 жирные кислоты', cru: 'Поддержите выработку гормонов лососем, грецкими орехами, семенами чиа и льна.', ttr: 'Omega-3 Yağ Asitleri', ctr: 'Hormon üretimini somon, ceviz, chia ve keten tohumu ile destekleyin.' },
  'ffb37116-e486-4f9a-9ddb-340456a05883': { tru: 'Поддержка настроения', cru: 'Испытывать эмоции — это нормально. В этот период не будьте к себе строги и позаботьтесь о себе.', ttr: 'Duygu Desteği', ctr: 'Duygusal hissetmek normaldir. Bu dönemde kendinize karşı sert olmayın ve kendinize özen gösterin.' },
  '179abf2c-3369-4e48-99af-eeca41c63966': { tru: 'Больше магния', cru: 'Магний помогает уменьшить спазмы. Ешьте бананы, миндаль, авокадо или принимайте добавки.', ttr: 'Magnezyumu Artırın', ctr: 'Magnezyum krampları azaltmaya yardımcı olur. Muz, badem, avokado yiyin veya takviye alın.' },
  '37af0e3a-ca24-4172-b150-2e6f7d0332cc': { tru: 'Попробуйте новые тренировки', cru: 'Ваше тело сейчас готово к более интенсивным нагрузкам. Попробуйте HIIT, бег или силовые тренировки.', ttr: 'Yeni Egzersizler Deneyin', ctr: 'Bedeniniz artık daha yoğun antrenmanlara hazır. HIIT, koşu veya ağırlık antrenmanlarını deneyin.' },
  'af156cb3-6771-406d-a5ba-119fa06514b0': { tru: 'Сила белка', cru: 'Поддержите развитие мышц нежирным белком: курицей, рыбой, яйцами и бобовыми.', ttr: 'Protein Gücü', ctr: 'Kas gelişimini tavuk, balık, yumurta ve baklagiller gibi yağsız proteinlerle destekleyin.' },
  '7d44caa7-a394-483d-ad87-5fefe2486f95': { tru: 'Социальная энергия', cru: 'Вы можете чувствовать себя более общительной. Отличное время для встреч и новых знакомств.', ttr: 'Sosyal Enerji', ctr: 'Kendinizi daha sosyal ve girişken hissedebilirsiniz. Sosyalleşmek ve yeni bağlantılar kurmak için harika bir zaman.' },
  'da23fe5a-c574-4029-8ed3-96134a706cd1': { tru: 'Свежие продукты', cru: 'Поддержите эту фазу лёгкой свежей пищей: салатами, ферментированными овощами и цитрусовыми.', ttr: 'Taze Besinler', ctr: 'Bu evreyi salatalar, fermente sebzeler ve turunçgiller gibi hafif, taze besinlerle destekleyin.' },
  'a7ff1aa2-b7c6-4c0d-8891-42e69c021f25': { tru: 'Уход за кожей', cru: 'Эстроген придаёт коже сияние! Хорошее время попробовать новые средства ухода или процедуры для лица.', ttr: 'Cilt Bakımı', ctr: 'Östrojen cildinizi ışıldatır! Yeni cilt bakım ürünlerini denemek veya yüz bakımları için iyi bir zaman.' },
  '003bed47-bde1-443e-9b45-79e0d60d609f': { tru: 'Продукты, богатые железом', cru: 'Чтобы бороться с усталостью, ешьте богатые железом продукты: шпинат, чечевицу, красное мясо и тёмный шоколад.', ttr: 'Demir Açısından Zengin Besinler', ctr: 'Yorgunlukla mücadele için ıspanak, mercimek, kırmızı et ve bitter çikolata gibi demir açısından zengin besinler tüketin.' },
  '56dee5f7-7810-4438-aa5a-ab1810e52b6c': { tru: 'Поддерживайте водный баланс', cru: 'Обильное питьё уменьшает вздутие и спазмы. Старайтесь выпивать 8–10 стаканов воды в день.', ttr: 'Su Dengenizi Koruyun', ctr: 'Bol su içmek şişkinliği ve krampları azaltır. Günde 8-10 bardak su içmeye çalışın.' },
  '207f37d6-46e3-4b26-ac0f-5414965615d5': { tru: 'Лёгкое движение', cru: 'Лёгкая йога, прогулка или растяжка действительно облегчают спазмы и улучшают настроение.', ttr: 'Hafif Hareket', ctr: 'Hafif yoga, yürüyüş veya esneme aslında krampları hafifletir ve ruh halini iyileştirir.' },
  '6e4e2308-e3d0-4383-97d6-f6663eba5f4c': { tru: 'Фокус на гидратации', cru: 'Продолжайте пить воду, а при интенсивных тренировках добавьте электролиты.', ttr: 'Hidrasyon Odağı', ctr: 'Su içmeye devam edin; yoğun egzersiz yapıyorsanız elektrolit ekleyin.' },
  '297deed2-d938-48ee-9861-f26d1b25641e': { tru: 'Пик фертильности', cru: 'Это ваш самый фертильный период. Если вы хотите стать мамой, это оптимальное время.', ttr: 'En Yüksek Doğurganlık', ctr: 'Bu, en doğurgan olduğunuz dönemdir. Anne olmak istiyorsanız bu en uygun zamandır.' },
  'cd8f542f-367c-4e21-ae33-e868cd3cb175': { tru: 'Сложные углеводы', cru: 'Повышение аппетита — это нормально! Выбирайте сложные углеводы: цельные злаки, батат и овсянку.', ttr: 'Kompleks Karbonhidratlar', ctr: 'İştah artışı normaldir! Tam tahıllar, tatlı patates ve yulaf gibi kompleks karbonhidratları seçin.' },
  '18d97298-bf07-46ec-9bc4-c0b5c73f7f3b': { tru: 'Осознанность при ПМС', cru: 'Прогестерон растёт, что может вызывать перепады настроения. Учитывайте это и уделяйте себе больше заботы.', ttr: 'PMS Farkındalığı', ctr: 'Progesteron yükselir; bu da ruh hali dalgalanmalarına neden olabilir. Bunu göz önünde bulundurun ve kendinize daha çok özen gösterin.' },
  '39b82687-e047-4cc0-9a2a-0a7c9f5f6db5': { tru: 'Витамин B6', cru: 'При ПМС употребляйте витамин B6: бананы, нут, картофель и мясо птицы.', ttr: 'B6 Vitamini', ctr: 'PMS için B6 vitamini alın: muz, nohut, patates ve kümes hayvanları eti.' },
  '6d6694a8-7170-43c0-a593-1b8166f83b35': { tru: 'Помощь дневника', cru: 'Записывание мыслей и чувств поможет упорядочить эмоции в этот чувствительный период.', ttr: 'Günlük Tutmanın Yardımı', ctr: 'Düşünce ve duygularınızı yazmak, bu hassas dönemde duygularınızı düzenlemenize yardımcı olabilir.' },
  '905059dd-9edd-41c0-beab-84b185d7a8b0': { tru: 'Меньше кофеина', cru: 'Кофеин может усиливать спазмы и тревожность. Вместо него пейте ромашковый или имбирный чай.', ttr: 'Kafeini Azaltın', ctr: 'Kafein krampları ve huzursuzluğu artırabilir. Bunun yerine papatya veya zencefil çayı için.' },
  'a79419dc-2ba3-4b60-931b-31a3400d5721': { tru: 'Отдых важен', cru: 'Ваше тело интенсивно работает. В первые дни позвольте себе больше отдыха и прислушивайтесь к организму.', ttr: 'Dinlenmek Önemli', ctr: 'Bedeniniz yoğun çalışıyor. İlk günlerde kendinize ekstra dinlenme fırsatı verin ve bedeninizi dinleyin.' },
  'd3ebd14b-d8bd-4ebc-b6bf-b7b9829c360c': { tru: 'Тёплый компресс', cru: 'Чтобы облегчить менструальные спазмы, приложите к низу живота грелку или бутылку с тёплой водой.', ttr: 'Sıcak Kompres', ctr: 'Regl kramplarını hafifletmek için karnınızın alt kısmına ısı yastığı veya sıcak su şişesi koyun.' },
  '99cae289-1465-4a9e-bc82-e0419cab8838': { tru: 'Высокая интенсивность — можно', cru: 'Ваше тело готово к самым тяжёлым тренировкам. Идеальное время для соревнований и личных рекордов.', ttr: 'Yüksek Yoğunluk Uygun', ctr: 'Bedeniniz en zorlu antrenmanların üstesinden gelmeye hazır. Yarışlar ve kişisel rekorlar için ideal zaman.' },
  '586726b9-960a-4a76-bc3e-67dfcbbe1949': { tru: 'Лёгкая боль — это нормально', cru: 'Лёгкая боль при овуляции — это нормально. Если боль сильная, проконсультируйтесь с врачом.', ttr: 'Hafif Ağrı Normaldir', ctr: 'Hafif yumurtlama ağrısı normaldir. Ağrı şiddetliyse doktorunuza danışın.' },
  '27ea4cb6-02ed-49b7-a7fa-9e5d6a34dd5f': { tru: 'Энергия растёт', cru: 'Уровень эстрогена повышается! Отличное время начинать новые проекты и справляться со сложными задачами.', ttr: 'Enerji Yükseliyor', ctr: 'Östrojen seviyesi yükseliyor! Yeni projelere başlamak ve zorlu işlerin üstesinden gelmek için harika bir zaman.' },
  '858fc921-c88d-4bc5-9861-126abdc96a57': { tru: 'Ограничьте алкоголь', cru: 'Алкоголь может обострять симптомы ПМС и нарушать сон. Подумайте о том, чтобы сократить его или отказаться совсем.', ttr: 'Alkolü Sınırlayın', ctr: 'Alkol PMS belirtilerini şiddetlendirebilir ve uykuyu bozabilir. Azaltmayı veya tamamen bırakmayı düşünün.' },
  '94e682fe-2fc7-438c-adb3-79e9bfd3ba0d': { tru: 'Умеренные тренировки', cru: 'Когда энергия снижается, переходите на умеренные нагрузки: плавание, велосипед или пилатес.', ttr: 'Orta Düzey Egzersiz', ctr: 'Enerji azaldıkça yüzme, bisiklet veya pilates gibi orta düzey aktivitelere geçin.' },
  '62415d54-7f54-4f1d-a33f-13bba59fa2f0': { tru: 'Меньше соли', cru: 'Чтобы уменьшить вздутие и задержку жидкости, ограничьте потребление натрия.', ttr: 'Tuzu Azaltın', ctr: 'Şişkinliği ve su tutulmasını azaltmak için sodyum alımını sınırlayın.' },
  'b3959838-1f31-4556-b9bb-43c52418ddc0': { tru: 'Приём кальция', cru: 'Исследования показывают, что кальций уменьшает проявления ПМС. Ешьте молочные продукты и листовую зелень.', ttr: 'Kalsiyum Alımı', ctr: 'Araştırmalar kalsiyumun PMS belirtilerini azalttığını gösteriyor. Süt ürünleri ve yeşil yapraklılar tüketin.' },
  'c9cec764-068d-4cdf-ab7b-a5ae634021ff': { tru: 'Приоритет сна', cru: 'Вам может требоваться больше сна. Прислушивайтесь к телу и старайтесь спать 8–9 часов ночью.', ttr: 'Uyku Önceliği', ctr: 'Daha fazla uykuya ihtiyacınız olabilir. Bedeninizi dinleyin ve gece 8-9 saat uyumaya çalışın.' },
  'c95f20da-f7b4-4e90-8e29-50fe44e8ddf6': { tru: 'Тёмный шоколад', cru: 'Немного тёмного шоколада поднимает настроение и даёт магний. Главное — умеренность!', ttr: 'Bitter Çikolata', ctr: 'Az miktarda bitter çikolata ruh halini yükseltir ve magnezyum sağlar. Ölçülü tüketin!' },
  'a875dc15-f821-40e3-a1f8-5e489767e136': { tru: 'Пик креативности', cru: 'Ваша умственная активность усилилась. Используйте это время для мозгового штурма, учёбы и творчества.', ttr: 'Yaratıcılık Zirvesi', ctr: 'Zihinsel aktiviteniz güçlendi. Bu zamanı beyin fırtınası, öğrenme ve yaratıcı işler için değerlendirin.' },
};

const esc = (s) => s.replace(/'/g, "''");
const lines = [
  '-- ============================================================',
  '-- Son16: Flow (menstruasiya) modulunun ru/tr tərcümələri',
  '-- 1) menstruation_phase_tips: 34 sətir title/content ru+tr (Fable tərcüməsi)',
  '-- 2) UI açarları: Növbəti Period / Reproduktiv Dövr / Ovulyasiya Günü',
  '-- Cəmi 3 bəyanat (editor splitter-inə davamlı format)',
  '-- ============================================================',
  '',
  'UPDATE public.menstruation_phase_tips AS t SET',
  '  title_ru = v.title_ru,',
  '  content_ru = v.content_ru,',
  '  title_tr = v.title_tr,',
  '  content_tr = v.content_tr',
  'FROM (VALUES',
];
const entries = Object.entries(T);
entries.forEach(([id, v], i) => {
  const cast = i === 0 ? '::uuid' : '';
  lines.push(`  ('${id}'${cast}, '${esc(v.tru)}', '${esc(v.cru)}', '${esc(v.ttr)}', '${esc(v.ctr)}')${i < entries.length - 1 ? ',' : ''}`);
});
lines.push(') AS v(id, title_ru, content_ru, title_tr, content_tr)');
lines.push('WHERE t.id = v.id;');
lines.push('');
lines.push('-- UI açarları (idempotent)');
lines.push('INSERT INTO public.translations (key, lang, value, namespace) VALUES');
const rows = [];
for (const [k, v] of Object.entries(KEYS)) {
  for (const l of ['ru', 'tr', 'en']) rows.push(`  ('${k}', '${l}', '${esc(v[l])}', 'common')`);
}
lines.push(rows.join(',\n'));
lines.push('ON CONFLICT (key, lang) DO NOTHING;');
lines.push('');
lines.push('-- Yoxlama: 0 gözlənilir');
lines.push('SELECT count(*) AS terjumesiz FROM public.menstruation_phase_tips WHERE title_ru IS NULL AND is_active = true;');
lines.push('');

fs.writeFileSync('supabase/son/Son16.sql', lines.join('\n'));
const mig = lines.slice(0, lines.indexOf('-- Yoxlama: 0 gözlənilir')).join('\n') + '\n';
fs.writeFileSync('supabase/migrations/20260813150034_flow_phase_tips_ru_tr.sql', mig);
console.log('✓ Son16.sql:', Object.keys(T).length, 'sətir UPDATE +', rows.length, 'UI açar sətri');
