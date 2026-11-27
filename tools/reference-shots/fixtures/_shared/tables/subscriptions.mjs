export default (ctx) => ctx.persona.premium ? [{
  id: '76000000-0000-4000-8000-000000000003', user_id: ctx.persona.user.id, plan_type: 'yearly', status: 'active', is_trial: false,
  started_at: ctx.iso('-165d'), expires_at: ctx.iso('+200d'), cancelled_at: null, created_at: ctx.iso('-165d'), updated_at: ctx.iso('-165d'),
}] : [];
