import fn from '../../bump-week24/tables/appointments.mjs';
export default (ctx) => fn({ ...ctx, vars: { ...ctx.vars, user_id: ctx.vars.woman_user_id } });
