import { MEMBERS, card } from '../../_lib/community.mjs';
export default (ctx, args) => {
  const self = ctx.persona.user ? [{ user_id: ctx.persona.user.id, name: ctx.persona.user.name, life_stage: ctx.persona.store?.lifeStage, badge_type: null, is_premium: !!ctx.persona.premium }] : [];
  const all = [...MEMBERS, ...self];
  return (args.p_user_ids || []).map((id) => all.find((m) => m.user_id === id)).filter(Boolean).map(card);
};
