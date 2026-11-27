// Ported from: src/lib/freemium.ts
//
// Freemium policy, client-side gating only (DB flags unchanged). See the TypeScript header for the dated owner
// decisions behind each list.

const Set<String> _freeToolIds = {
  'cakes',
  'secondhand-market', 'second-hand-market',
  'affiliate', 'affiliate-products',
  'blog',
  'mini-games',
  'first-aid',
  'mental-health',
  'doctors', 'hospital', 'danger-signs', 'vaccine-calendar', 'vaccines-calendar',
  'baby-album', 'pregnancy-album', 'mood', 'mood-diary',
  'weaning',
  'play-together',
  'kid-exercises',
};

bool isToolFree(String toolId) => _freeToolIds.contains(toolId);

/// "Free · limited" tools: open for everyone, the tool enforces its own free limit.
const Set<String> _freeLimitedToolIds = {'recipes', 'horoscope'};

/// "Premium · preview" tools: anyone may open and look; the main action needs Premium.
const Set<String> _previewToolIds = {'whitenoise', 'white-noise', 'photoshoot', 'baby-photoshoot'};

bool isPreviewTool(String toolId) => _previewToolIds.contains(toolId);

/// Admin "limited_*" opens a tool for free users only when the tool enforces a free limit in code.
const Set<String> _selfLimitingToolIds = _freeLimitedToolIds;

bool _adminLimited(String toolId, String? premiumType) => isLimitedPremiumType(premiumType) && _selfLimitingToolIds.contains(toolId);

/// tool_configs.premium_type: none | limited_total | limited_monthly | premium_only | full.
bool isLimitedPremiumType(String? premiumType) => premiumType == 'limited_total' || premiumType == 'limited_monthly';

/// 'free' | 'limited' | 'preview' | 'premium'
typedef ToolAccess = String;

ToolAccess toolAccess({required String toolId, bool? isPremiumFlag, String? premiumType, bool? stageLocked}) {
  if (stageLocked == true) return 'premium';
  if (isToolFree(toolId) && isPremiumFlag != true) return 'free';
  if (_previewToolIds.contains(toolId)) return 'preview';
  if (_freeLimitedToolIds.contains(toolId) || _adminLimited(toolId, premiumType)) return 'limited';
  return 'premium';
}

bool canOpenToolFree(String toolId, [String? premiumType]) =>
    isToolFree(toolId) || _freeLimitedToolIds.contains(toolId) || _previewToolIds.contains(toolId) || _adminLimited(toolId, premiumType);

/// Cakes are only for the Azerbaijan market: language az/ru/kk/uz/ka and country AZ (or unset).
bool isCakesAvailable([String? countryCode, String? language]) {
  final lang = (language == null || language.isEmpty) ? 'az' : language;
  final countryOk = countryCode == null || countryCode == 'AZ';
  final langOk = lang == 'az' || lang == 'ru' || lang == 'kk' || lang == 'uz' || lang == 'ka';
  return countryOk && langOk;
}
