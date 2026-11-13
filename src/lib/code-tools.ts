/**
 * Tools whose screen, name and access live in code (not in a tool_configs row of their own until 2026-11-09).
 * Their tool_configs rows exist only for ordering and per-stage visibility in Admin → Alət sıralaması, and are
 * stored with is_active = false so older native builds (which read only is_active rows and add these tiles
 * themselves) never show a duplicate. Visibility for these rows = the stage flag (flow/bump/mommy_active).
 * Migration: supabase/migrations/20261109120000_code_tool_rows.sql.
 */
export const CODE_TOOL_IDS = new Set<string>(['cakes', 'mini-games', 'baby-tracker', 'sleep-training', 'solid-food-guide', 'parenting', 'play-together', 'daily-quiz']);
export const isCodeTool = (toolId: string) => CODE_TOOL_IDS.has(toolId);

/** Row is part of the app's tool list (before the stage filter): normal rows need is_active, code rows do not. */
export const isToolRowLive = (row: { tool_id: string; is_active?: boolean | null }) => row.is_active === true || isCodeTool(row.tool_id);
