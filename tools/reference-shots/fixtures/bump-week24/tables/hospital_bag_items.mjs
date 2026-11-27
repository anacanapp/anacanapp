import templates from '../../_shared/tables/hospital_bag_templates.mjs';
export default (ctx) => templates().slice(0, 5).map((t, i) => ({ id: `87000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, user_id: ctx.vars.user_id,
  item_id: t.item_id, category: t.category, item_name: t.item_name, item_name_en: t.item_name_en, item_name_ru: t.item_name_ru, is_checked: i < 3,
  priority: t.priority, notes: null, notes_en: null, notes_ru: null, added_by: ctx.vars.user_id, created_at: ctx.iso('-14d'), updated_at: ctx.iso('-2d') }));
