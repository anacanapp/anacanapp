// One row per pregnancy day (src/hooks: pregnancy_day=eq.N, fallback pregnancy_day=lt.N order desc limit 1).
export default () => Array.from({ length: 280 }, (_, i) => {
  const day = i + 1, week = Math.floor((day - 1) / 7) + 1;
  return {
    id: `73000000-0000-4000-8000-${String(day).padStart(12, '0')}`, pregnancy_day: day, day_number: day, week_number: week,
    days_until_birth: 280 - day, is_active: true, image_url: null, video_url: null, baby_weight_gram: Math.round(Math.max(1, (week / 40) ** 3 * 3400)),
    baby_size_fruit: 'qarğıdalı', baby_size_fruit_en: 'corn', baby_size_fruit_ru: 'кукуруза', baby_size_fruit_ar: 'ذرة',
    baby_development: 'Körpənin eşitmə qabiliyyəti inkişaf edir: o, sizin səsinizi və ürək döyüntülərinizi eşidir.',
    baby_development_en: 'Your baby\'s hearing is developing: they can hear your voice and heartbeat.',
    baby_development_ru: 'У малыша развивается слух: он слышит ваш голос и сердцебиение.',
    baby_development_ar: 'يتطور سمع طفلك: يمكنه سماع صوتك ونبضات قلبك.',
    baby_message: 'Ana, bu gün səsini eşitdim! Mənə mahnı oxu 💛', baby_message_en: 'Mum, I heard your voice today! Sing to me 💛',
    baby_message_ru: 'Мама, я сегодня слышал твой голос! Спой мне 💛', baby_message_ar: 'ماما، سمعت صوتك اليوم! غنّي لي 💛',
    body_changes: 'Bel ağrısı və ayaqlarda yüngül şişkinlik ola bilər.', body_changes_en: 'You may notice back pain and mild swelling in your feet.',
    body_changes_ru: 'Возможны боли в спине и лёгкая отёчность ног.', body_changes_ar: 'قد تلاحظين ألماً في الظهر وتورماً خفيفاً في القدمين.',
    daily_tip: 'Ayaqlarınızı qaldırıb dincəlin.', daily_tip_en: 'Rest with your feet up.', daily_tip_ru: 'Отдыхайте, приподняв ноги.', daily_tip_ar: 'استريحي مع رفع قدميك.',
    mother_tips: 'Rahat ayaqqabı geyinin.', mother_tips_en: 'Wear comfortable shoes.', mother_tips_ru: 'Носите удобную обувь.', mother_tips_ar: 'ارتدي حذاءً مريحاً.',
    nutrition_tip: 'Kalsium üçün qatıq və pendir yeyin.', nutrition_tip_en: 'Eat yoghurt and cheese for calcium.', nutrition_tip_ru: 'Ешьте йогурт и сыр ради кальция.', nutrition_tip_ar: 'تناولي الزبادي والجبن للكالسيوم.',
    exercise_tip: 'Hamiləlik yoqası bel ağrısını azaldır.', exercise_tip_en: 'Prenatal yoga eases back pain.', exercise_tip_ru: 'Йога для беременных облегчает боль в спине.', exercise_tip_ar: 'تخفف يوغا الحمل آلام الظهر.',
    emotional_tip: null, partner_tip: null, doctor_visit_tip: null, mother_warnings: null, multiples_tip_az: null,
    mother_symptoms: ['Bel ağrısı', 'Ayaq şişkinliyi'], mother_symptoms_en: ['Back pain', 'Swollen feet'], mother_symptoms_ru: ['Боль в спине', 'Отёки ног'], mother_symptoms_ar: ['ألم الظهر', 'تورم القدمين'],
    recommended_foods: ['Qatıq', 'Ispanaq', 'Qoz'], recommended_foods_en: ['Yoghurt', 'Spinach', 'Walnuts'], recommended_foods_ru: ['Йогурт', 'Шпинат', 'Грецкие орехи'], recommended_foods_ar: ['زبادي', 'سبانخ', 'جوز'],
    foods_to_avoid: ['Çiy balıq'], foods_to_avoid_en: ['Raw fish'], foods_to_avoid_ru: ['Сырая рыба'], foods_to_avoid_ar: ['السمك النيء'],
    recommended_exercises: ['Gəzinti'], recommended_exercises_en: ['Walking'], recommended_exercises_ru: ['Ходьба'], recommended_exercises_ar: ['المشي'],
    created_at: '2026-01-01T00:00:00Z',
  };
});
