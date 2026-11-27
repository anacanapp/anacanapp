// The partner's own profile plus the linked woman's profile (bump-week24); linked_partner_id points at the other profile id.
import { readFileSync } from 'node:fs';
export default (ctx) => {
  const v = ctx.vars;
  const woman = JSON.parse(readFileSync(new URL('../../bump-week24/tables/profiles.json', import.meta.url), 'utf8'))[0];
  const womanVars = { user_id: v.woman_user_id, profile_id: v.woman_profile_id, user_name: 'Leyla', email: 'leyla.bump@example.test' };
  const fill = (o) => JSON.parse(JSON.stringify(o).replace(/\{\{(user_id|profile_id|user_name|email)\}\}/g, (_, k) => womanVars[k]));
  return [
    { id: v.profile_id, user_id: v.user_id, name: v.user_name, email: v.email, life_stage: 'partner', last_period_date: null, due_date: null,
      cycle_length: 28, period_length: 5, baby_count: 1, multiples_type: 'single', baby_name: null, baby_gender: null, baby_birth_date: null,
      country_code: 'AZ', is_premium: false, premium_until: null, is_verified: false, verified_until: null, partner_code: 'RESAD01',
      linked_partner_id: v.woman_profile_id, avatar_url: null, bio: null, badge_type: null, onboarding_answers: null, delivery_type: null,
      start_weight: null, pregnancy_day: null, role: 'user', created_at: '2026-07-01T08:00:00Z', updated_at: ctx.iso('-1d') },
    { ...fill(woman), linked_partner_id: v.profile_id },
  ];
};
