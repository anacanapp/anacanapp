export default (ctx) => ctx.persona.user ? [{
  id: '76000000-0000-4000-8000-000000000002', user_id: ctx.persona.user.id, language: null, timezone: 'Asia/Baku',
  privacy_profile_visible: true, privacy_show_in_community: true, privacy_allow_messages: true, privacy_share_analytics: false,
  privacy_location_sharing: false, privacy_notification_sounds: true, notifications_enabled: true, push_enabled: true,
  push_comments: true, push_community: true, push_likes: true, push_messages: true, daily_push_enabled: true,
  sound_enabled: true, vibration_enabled: true, silent_hours_enabled: false, silent_hours_start: '22:00', silent_hours_end: '07:00',
  water_reminder: true, vitamin_reminder: true, vitamin_time: '09:00', exercise_reminder: false, exercise_days: [1, 3, 5],
  feed_languages: ['az'], white_noise_volume: 0.6, white_noise_timer: 30, last_white_noise_sound: null,
  created_at: '2026-06-20T10:00:00Z', updated_at: '2026-11-01T10:00:00Z',
}] : [];
