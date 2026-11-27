// Shared community cast (other mothers) used by feed, stories, profile cards and messages fixtures.
export const MEMBERS = [
  { user_id: 'c0000000-0000-4000-8000-000000000001', name: 'Günel Əliyeva', life_stage: 'bump', badge_type: null, is_premium: true },
  { user_id: 'c0000000-0000-4000-8000-000000000002', name: 'Nərmin Hüseynova', life_stage: 'mommy', badge_type: 'expert', is_premium: false },
  { user_id: 'c0000000-0000-4000-8000-000000000003', name: 'Aysel Quliyeva', life_stage: 'mommy', badge_type: null, is_premium: true },
  { user_id: 'c0000000-0000-4000-8000-000000000004', name: 'Sevinc Məmmədli', life_stage: 'flow', badge_type: null, is_premium: false },
];
const TEXT = {
  az: ['24-cü həftədəyik! Kimdə bel ağrısı var, nə kömək edir? 🤰', 'Qızım bu gün ilk dəfə öz-özünə oturdu 😍 6 ay necə tez keçdi!', 'Əlavə qidaya brokkolidən başladıq. Siz nədən başlamısınız?', 'Bakıda yaxşı uşaq həkimi tövsiyə edə bilərsinizmi?'],
  en: ['We are at week 24! Who else has back pain, what helps? 🤰', 'My daughter sat up on her own today 😍 Six months flew by!', 'We started solids with broccoli. What did you start with?', 'Can anyone recommend a good paediatrician in Baku?'],
  ru: ['У нас 24 неделя! У кого болит спина, что помогает? 🤰', 'Дочка сегодня впервые села сама 😍 Полгода пролетели!', 'Начали прикорм с брокколи. А вы с чего начинали?', 'Посоветуйте хорошего педиатра в Баку?'],
  ar: ['نحن في الأسبوع 24! من تعاني من ألم الظهر، ما الذي يساعد؟ 🤰', 'ابنتي جلست وحدها اليوم لأول مرة 😍 مرت ستة أشهر بسرعة!', 'بدأنا الأطعمة الصلبة بالبروكلي. بماذا بدأتن؟', 'هل يمكن أن تنصحنني بطبيب أطفال جيد في باكو؟'],
};
export function posts(ctx, language = 'az') {
  const texts = TEXT[language] || TEXT.en;
  return MEMBERS.map((m, i) => ({
    id: `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: m.user_id, content: texts[i], language,
    media_urls: [], is_anonymous: false, is_active: true, is_pinned: false, comments_locked: false, group_id: null, tagged_group_ids: [],
    likes_count: [24, 57, 13, 6][i], comments_count: [8, 15, 4, 2][i], created_at: ctx.iso(`-${[1.5, 3, 7, 20][i]}h`), updated_at: ctx.iso(`-${[1.5, 3, 7, 20][i]}h`),
    moderation_version: 0, moderation_removed_at: null, ad_moderation_state: null,
  }));
}
export function card(m) {
  return { user_id: m.user_id, name: m.name, avatar_url: null, badge_type: m.badge_type, life_stage: m.life_stage, is_premium: m.is_premium,
    is_verified: m.badge_type === 'expert', verified_until: null, created_at: '2026-03-01T10:00:00Z', can_share_links: false };
}
