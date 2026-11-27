// Ported from: src/lib/code-tools.ts
//
// Tools whose screen, name and access live in code. Their tool_configs rows exist only for ordering and per-stage
// visibility (Admin → Alət sıralaması) and are stored with is_active = false so older native builds never show a
// duplicate. Visibility for these rows = the stage flag (flow/bump/mommy_active).
// Migration: supabase/migrations/20261109120000_code_tool_rows.sql.

/// `CODE_TOOL_IDS` (insertion order kept: it is the `tool_id.in.(…)` list of the query).
const List<String> kCodeToolIds = [
  'cakes', 'mini-games', 'baby-tracker', 'sleep-training', 'solid-food-guide', 'parenting', 'play-together', 'kid-exercises',
];

/// `isCodeTool(toolId)`.
bool isCodeTool(String toolId) => kCodeToolIds.contains(toolId);

/// `isToolRowLive(row)`: normal rows need `is_active`, code rows do not.
bool isToolRowLive(Map<String, dynamic> row) => row['is_active'] == true || isCodeTool('${row['tool_id']}');
