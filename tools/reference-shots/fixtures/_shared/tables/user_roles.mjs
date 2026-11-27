export default (ctx) => ctx.persona.user ? [{ id: '76000000-0000-4000-8000-000000000001', user_id: ctx.persona.user.id, role: 'user', created_at: '2026-01-01T00:00:00Z' }] : [];
