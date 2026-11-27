// src/hooks/usePremiumEntitlement.ts: protocol, userId match and a lease of at most 31 s after checkedAt.
export default (ctx, args) => {
  const premium = ctx.persona.premium === true;
  const householdPremium = ctx.persona.householdPremium === true;
  const until = ctx.iso('+200d');
  return {
    protocol: 'anacan-premium-access-v1', userId: args.p_user_id ?? ctx.persona.user?.id,
    own: { active: premium, expiresAt: premium ? until : null, source: premium ? 'store' : 'none' },
    household: { active: householdPremium, expiresAt: householdPremium ? until : null, source: householdPremium ? 'partner' : 'none' },
    checkedAt: ctx.iso('0'), validUntil: new Date(ctx.now + 25_000).toISOString(),
  };
};
