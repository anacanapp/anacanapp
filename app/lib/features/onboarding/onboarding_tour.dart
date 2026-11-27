// Ported from: src/lib/onboardingTour.ts
//
// In-app onboarding tour (Glass guided tour after the first full app open, docs/INAPP_ONBOARDING_JOURNEY.md):
// who sees it, which steps they get and when push permission is asked. Pure rules only.

import '../../domain/billing/freemium.dart' show isToolFree;

const int tourVersion = 1;
const int tourMaxAccountAgeDays = 14;
const String moodTool = 'mood';

/// 'granted' | 'denied' | 'prompt' | 'unsupported'
typedef TourPush = String;

/// 'home' | 'tools' | 'ai' | 'community'
typedef TourTab = String;

class TourNav {
  const TourNav({required this.tab, this.tool, this.hasTool = false});

  /// `{ tab, tool: null }` (tool explicitly cleared) vs `{ tab }` (tool untouched).
  const TourNav.clearTool(this.tab)
      : tool = null,
        hasTool = true;
  const TourNav.tool(this.tab, String this.tool) : hasTool = true;

  final TourTab tab;
  final String? tool;

  /// Whether the `tool` key is present (JSON.stringify keeps `tool: null`).
  final bool hasTool;

  /// `JSON.stringify(nav)` (identity of a navigation).
  String get key => hasTool ? '{"tab":"$tab","tool":${tool == null ? 'null' : '"$tool"'}}' : '{"tab":"$tab"}';

  @override
  bool operator ==(Object other) => other is TourNav && other.key == key;
  @override
  int get hashCode => key.hashCode;
  @override
  String toString() => key;
}

class TourTool {
  const TourTool({required this.id, required this.name, this.description, required this.open});
  final String id;
  final String name;
  final String? description;
  final bool open;
}

/// 'card' | 'spot' | 'coach' | 'push'
typedef TourSubKind = String;

class TourSub {
  const TourSub({required this.kind, required this.nav, this.target, required this.copy, this.toolId});
  final TourSubKind kind;

  /// Screen the app must show for this sub-step.
  final TourNav nav;

  /// `data-tour` target to highlight (spot only). Tapping it advances the tour.
  final String? target;

  /// Copy id inside GlassTour, or a tool id for tool pages.
  final String copy;
  final String? toolId;
}

/// 'welcome' | 'mood' | 'tools' | 'ai' | 'premium' | 'final'
typedef TourStepId = String;

class TourStep {
  const TourStep({required this.id, required this.subs});
  final TourStepId id;
  final List<TourSub> subs;
}

/// Same rule as the Tools page: free only when no DB flag, stage lock or freemium rule gates it.
bool isToolOpenForUser({required String toolId, bool? isPremiumFlag, required bool stageLocked, required bool isPremium}) {
  if (isPremium) return true;
  return isPremiumFlag != true && !stageLocked && isToolFree(toolId);
}

/// Ask for push only when the OS can still show its permission dialog.
bool shouldAskPush(TourPush push) => push == 'prompt';

const Map<String, ({List<String> free, List<String> premium})> _featured = {
  'mommy': (free: ['vaccine-calendar', 'danger-signs', 'baby-album', 'doctors', 'blog'], premium: ['baby-growth', 'growth-tracker', 'teething', 'vaccine-calendar', 'doctors']),
  'bump': (free: ['hospital', 'pregnancy-album', 'danger-signs', 'doctors', 'blog'], premium: ['kick', 'contraction', 'weight', 'fetal-growth', 'hospital']),
  'flow': (free: ['doctors', 'blog'], premium: ['vitamin-tracker', 'recipes', 'nutrition', 'doctors']),
};

/// The steps this user gets. Premium users get no Premium step; push is asked at most once.
List<TourStep> buildTourPlan({required String stage, required bool isPremium, required TourPush push, required List<TourTool> tools}) {
  final open = {for (final t in tools.where((t) => t.open)) t.id: t};
  final steps = <TourStep>[const TourStep(id: 'welcome', subs: [TourSub(kind: 'card', nav: TourNav(tab: 'home'), copy: 'welcome')])];
  var pushPlaced = false;
  List<TourSub> pushSub(TourNav nav) {
    if (pushPlaced || !shouldAskPush(push)) return const [];
    pushPlaced = true;
    return [TourSub(kind: 'push', nav: nav, copy: 'push')];
  }

  if (open.containsKey(moodTool)) {
    const moodNav = TourNav.tool('tools', moodTool);
    steps.add(TourStep(id: 'mood', subs: [
      const TourSub(kind: 'spot', nav: TourNav(tab: 'home'), target: 'tab-tools', copy: 'mood_tab'),
      const TourSub(kind: 'spot', nav: TourNav.clearTool('tools'), target: 'tool-$moodTool', copy: 'mood_tile'),
      const TourSub(kind: 'coach', nav: moodNav, copy: 'mood_log', toolId: moodTool),
      ...pushSub(moodNav),
    ]));
  }

  final featured = _featured[stage]!;
  final ids = (isPremium ? featured.premium : featured.free).where((id) => open.containsKey(id) && id != moodTool).take(2).toList();
  final toolsSubs = <TourSub>[];
  if (!steps.any((s) => s.id == 'mood')) toolsSubs.add(const TourSub(kind: 'spot', nav: TourNav(tab: 'home'), target: 'tab-tools', copy: 'tools_tab'));
  toolsSubs.add(TourSub(
    kind: 'spot',
    nav: const TourNav.clearTool('tools'),
    target: isPremium ? 'tools-premium' : 'tools-free',
    copy: isPremium ? 'tools_list_premium' : 'tools_list_free',
  ));
  for (final id in ids) {
    toolsSubs.add(TourSub(kind: 'coach', nav: TourNav.tool('tools', id), copy: 'tool_page', toolId: id));
  }
  steps.add(TourStep(id: 'tools', subs: toolsSubs));

  // Anacan AI is Premium only (2026-11-11): free users would land on its paywall, so their tour skips it.
  steps.add(TourStep(id: 'ai', subs: [
    if (isPremium) ...const [
      TourSub(kind: 'spot', nav: TourNav.clearTool('tools'), target: 'tab-ai', copy: 'ai_tab'),
      TourSub(kind: 'coach', nav: TourNav(tab: 'ai'), copy: 'ai_screen_premium'),
    ],
    TourSub(kind: 'spot', nav: isPremium ? const TourNav(tab: 'ai') : const TourNav.clearTool('tools'), target: 'tab-community', copy: 'community_tab'),
    const TourSub(kind: 'coach', nav: TourNav(tab: 'community'), copy: 'community_screen'),
    ...pushSub(const TourNav(tab: 'community')),
  ]));

  if (!isPremium) steps.add(const TourStep(id: 'premium', subs: [TourSub(kind: 'card', nav: TourNav(tab: 'home'), copy: 'premium')]));
  steps.add(const TourStep(id: 'final', subs: [TourSub(kind: 'card', nav: TourNav(tab: 'home'), copy: 'final')]));
  return steps;
}

/// Visible step count (welcome and final cards are not counted).
int countedSteps(List<TourStep> plan) => plan.where((s) => s.id != 'welcome' && s.id != 'final').length;

double _parse(Object? v) {
  final d = v is String ? DateTime.tryParse(v) : null;
  return d == null ? double.nan : d.millisecondsSinceEpoch.toDouble();
}

/// Who sees the tour: switched on, new account (after `since`, younger than 14 days), never seen it, not a
/// partner, not in loss mode.
bool isTourEligible({
  required Object? setting,
  required Object? since,
  required String? accountCreatedAt,
  required Object? journey,
  required String? role,
  required String? lifeStage,
  required bool? lossRecoveryActive,
  required bool onboarded,
  int? now,
}) {
  if (setting != 'on') return false;
  if (journey != null) return false;
  if (!onboarded || role == 'partner' || lossRecoveryActive == true) return false;
  if (lifeStage != 'mommy' && lifeStage != 'bump' && lifeStage != 'flow') return false;
  final created = _parse(accountCreatedAt ?? '');
  final from = _parse(since is String ? since : '');
  if (!created.isFinite || !from.isFinite || created < from) return false;
  return (now ?? DateTime.now().millisecondsSinceEpoch) - created < tourMaxAccountAgeDays * 86400000;
}

/// Accounts younger than a day: the funnel and the tour own the first push prompt, not the daily auto-prompt.
bool isNewAccount(String? createdAt, [int? now]) {
  final created = _parse(createdAt ?? '');
  return created.isFinite && (now ?? DateTime.now().millisecondsSinceEpoch) - created < 86400000;
}

/// Admin-only preview (Admin → "Turu sınaqla"): runs the tour ignoring eligibility, writes nothing. The request is
/// kept until the host mounts (or delivered live to a mounted host).
class TourPreviewRequests {
  bool? _pending;
  void Function(bool premium)? _listener;

  void request(bool premium) {
    _pending = premium;
    _listener?.call(premium);
  }

  bool? take() {
    final p = _pending;
    _pending = null;
    return p;
  }

  void listen(void Function(bool premium)? listener) => _listener = listener;
}

/// Process-wide preview hand-off (`requestTourPreview` / `takePendingTourPreview`).
final TourPreviewRequests tourPreviewRequests = TourPreviewRequests();
