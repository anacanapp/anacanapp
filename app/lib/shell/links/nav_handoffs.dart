// Ported from: src/lib/parenting-target.ts, src/lib/parenting-nav.ts (parentingTargetFromDeeplink,
//              PARTNER_PARENTING_SCREEN, MENTAL_HEALTH_TOOL), src/lib/widget-actions.ts
//
// One-shot hand-offs a navigation leaves for the screen it opens (read once on mount).
import 'package:flutter/foundation.dart';

import 'deeplink.dart';

/// `ParentingTarget`.
@immutable
class ParentingTarget {
  const ParentingTarget(this.kind, this.id, {this.child});

  /// `sos` | `article` | `programme`.
  final String kind;
  final String id;
  final String? child;

  @override
  bool operator ==(Object other) => other is ParentingTarget && other.kind == kind && other.id == id && other.child == child;
  @override
  int get hashCode => Object.hash(kind, id, child);
  @override
  String toString() => 'ParentingTarget($kind, $id${child == null ? '' : ', $child'})';
}

const String kPartnerParentingScreen = 'partner-parenting';
const String kMentalHealthTool = 'mental-health';

final RegExp _parentingId = RegExp(r'^[a-z0-9-]{1,60}$');
final RegExp _childId = RegExp(r'^[A-Za-z0-9-]{1,64}$');

/// Module-level `pending` of parenting-target.ts.
class ParentingTargetStore {
  ParentingTarget? _pending;

  /// `setParentingTarget`: a malformed id clears the target.
  void set(ParentingTarget? target) {
    if (target == null || !_parentingId.hasMatch(target.id)) {
      _pending = null;
      return;
    }
    final child = target.child;
    _pending = child != null && _childId.hasMatch(child)
        ? ParentingTarget(target.kind, target.id, child: child)
        : ParentingTarget(target.kind, target.id);
  }

  ParentingTarget? peek() => _pending;
  void clear() => _pending = null;
}

/// `parentingTargetFromDeeplink(parsed)`.
ParentingTarget? parentingTargetFromDeeplink(ParsedDeeplink? parsed) {
  if (parsed == null || parsed.action != 'tool' || parsed.params['tool_id'] != 'parenting') return null;
  final kind = parsed.params['parenting_kind'];
  final id = parsed.params['parenting_id'] ?? '';
  if (!const ['sos', 'article', 'programme'].contains(kind) || !_parentingId.hasMatch(id)) return null;
  return ParentingTarget(kind!, id);
}

/// `WidgetAction` (`feed` | `sleep` | `diaper`) left by a home-screen widget deeplink.
class WidgetActionStore {
  WidgetActionStore({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;
  final DateTime Function() _clock;
  ({String action, DateTime at})? _pending;

  /// `setPendingWidgetAction`.
  void set(String? action) {
    _pending = (action == 'feed' || action == 'sleep' || action == 'diaper') ? (action: action!, at: _clock()) : null;
  }

  /// `consumeWidgetAction`: the action if fresh (< 30 s), cleared on read.
  String? consume() {
    final p = _pending;
    _pending = null;
    return p != null && _clock().difference(p.at) < const Duration(seconds: 30) ? p.action : null;
  }
}
