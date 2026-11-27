import { posts } from '../../_lib/community.mjs';
export default (ctx, args) => (['recent', 'popular'].includes(args.p_view) && !args.p_group_id && !args.p_search ? posts(ctx, args.p_language || 'az') : []);
