const POSTS = [
  ['ikinci-trimestr', 'pregnancy', 'bump', 'İkinci trimestrdə nələri bilməlisiniz', 'What to know in the second trimester', 'Что важно знать во втором триместре', 'ما يجب معرفته في الثلث الثاني'],
  ['hamilelikde-demir', 'nutrition', 'bump', 'Hamiləlikdə dəmir: nə qədər və haradan?', 'Iron in pregnancy: how much and where from?', 'Железо при беременности: сколько и откуда?', 'الحديد أثناء الحمل: كم ومن أين؟'],
  ['korpe-yuxusu', 'baby-care', 'mommy', 'Altı aylıq körpənin yuxu rejimi', 'Sleep routine for a six-month-old', 'Режим сна шестимесячного малыша', 'روتين النوم لطفل بعمر ستة أشهر'],
  ['elave-qida', 'nutrition', 'mommy', 'Əlavə qidaya necə başlamalı', 'How to start solid foods', 'Как начать прикорм', 'كيف تبدئين الأطعمة الصلبة'],
  ['sikl-fazalari', 'pregnancy', 'flow', 'Menstrual siklin dörd fazası', 'The four phases of your cycle', 'Четыре фазы цикла', 'المراحل الأربع للدورة'],
];
export default (ctx) => POSTS.map(([slug, cat, stage, az, en, ru, ar], i) => ({
  id: `75000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, slug, category: cat, category_en: cat, life_stage: stage,
  title: az, title_az: az, title_en: en, title_ru: ru, title_ar: ar,
  excerpt: `${az} — mütəxəssis tövsiyələri.`, excerpt_az: `${az} — mütəxəssis tövsiyələri.`, excerpt_en: `${en} — expert advice.`, excerpt_ru: `${ru} — советы экспертов.`, excerpt_ar: `${ar} — نصائح الخبراء.`,
  content: `## ${az}\n\nMütəxəssislərimiz bu mövzuda ən vacib məqamları topladı.`, content_az: `## ${az}\n\nMütəxəssislərimiz bu mövzuda ən vacib məqamları topladı.`,
  content_en: `## ${en}\n\nOur experts collected the key points on this topic.`, content_ru: `## ${ru}\n\nНаши эксперты собрали главное по этой теме.`, content_ar: `## ${ar}\n\nجمع خبراؤنا أهم النقاط حول هذا الموضوع.`,
  cover_image_url: `https://api.anacan.az/storage/v1/object/public/blog-covers/${slug}.jpg`, author_name: 'Dr. Aynur Məmmədova', author_avatar_url: null,
  is_published: true, is_featured: i === 0, reading_time: 4 + i, likes_count: 120 - i * 13, comments_count: 8 + i, saves_count: 30 + i, view_count: 1500 - i * 100,
  tags: [], tags_en: [], countries_include: null, countries_exclude: null, editorial_metadata: null,
  blog_post_categories: [{ category_id: `74000000-0000-4000-8000-00000000000${cat === 'pregnancy' ? 1 : cat === 'nutrition' ? 2 : 3}`, blog_categories: { slug: cat } }],
  created_at: ctx.iso(`-${i * 2 + 1}d`), updated_at: ctx.iso(`-${i * 2 + 1}d`),
}));
