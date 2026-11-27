import { uuid } from '../../_lib/text.mjs';
const G = [['🤰', 'Noyabr 2026 hamilələri', 'Pregnant in November 2026', 'due_date', 412], ['👶', 'Yeni analar', 'New mums', 'life_stage', 1280],
  ['🥦', 'Əlavə qida', 'Starting solids', 'topic', 356], ['🌸', 'Sikl və sağlamlıq', 'Cycle and health', 'topic', 208]];
export default (ctx) => G.map(([icon_emoji, name, name_en, group_type, member_count], i) => ({
  id: uuid('c2000000', i + 1), name, name_en, description: `${name} — sual verin, təcrübə bölüşün.`, description_en: `${name_en} — ask and share.`,
  icon_emoji, group_type, member_count, is_active: true, is_auto_join: false, auto_join_criteria: null, discovery_language: 'az',
  cover_image_url: null, chat_posting_policy: 'members', chat_visibility: 'members', created_by: null, created_at: '2026-02-01T00:00:00Z', updated_at: ctx.iso('-2d') }));
