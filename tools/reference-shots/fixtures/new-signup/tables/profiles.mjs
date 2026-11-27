// Fresh profile created by the signup trigger: no life stage. persona.profile overrides columns (extending personas).
export default (ctx) => [{
  id: ctx.vars.profile_id, user_id: ctx.vars.user_id, name: ctx.vars.user_name, email: ctx.vars.email, life_stage: null,
  last_period_date: null, due_date: null, cycle_length: 28, period_length: 5, baby_count: 1, multiples_type: null, baby_name: null,
  baby_gender: null, baby_birth_date: null, country_code: 'AZ', is_premium: false, premium_until: null, is_verified: false, verified_until: null,
  partner_code: null, linked_partner_id: null, avatar_url: null, bio: null, badge_type: null, onboarding_answers: null, delivery_type: null,
  start_weight: null, pregnancy_day: null, role: 'user', created_at: ctx.iso('-5m'), updated_at: ctx.iso('-5m'),
  ...(ctx.persona.profile || {}),
}];
