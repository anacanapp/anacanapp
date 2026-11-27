// Ported from: src/hooks/use-toast.ts as called by the community / moderation mutations (`toast({ title, description,
//              variant })` from inside useMutation callbacks)
//
// Mutations run in providers without a BuildContext. They post toasts to [communityToastsProvider]; the newest mounted
// [CommunityToastListener] (community tab, user profile overlay, moderator enforcement) shows them through the
// app's AToastHost.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../settings/ui/settings_ui.dart' show toasts;

@immutable
class CommunityToast {
  const CommunityToast({required this.title, this.description, this.destructive = false});
  final String title;
  final String? description;
  final bool destructive;
  @override
  String toString() => 'CommunityToast($title, $description, destructive: $destructive)';
}

class CommunityToasts {
  final List<void Function(CommunityToast toast)> _listeners = [];

  /// Toasts posted while no listener was attached (tests read them).
  final List<CommunityToast> history = [];

  void show(CommunityToast toast) {
    history.add(toast);
    if (history.length > 50) history.removeAt(0);
    if (_listeners.isNotEmpty) _listeners.last(toast);
  }

  void Function() attach(void Function(CommunityToast toast) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }
}

final communityToastsProvider = Provider<CommunityToasts>((ref) => CommunityToasts());

/// Shows the community toasts through the nearest AToastHost while mounted.
class CommunityToastListener extends ConsumerStatefulWidget {
  const CommunityToastListener({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<CommunityToastListener> createState() => _CommunityToastListenerState();
}

class _CommunityToastListenerState extends ConsumerState<CommunityToastListener> {
  void Function()? _detach;

  @override
  void initState() {
    super.initState();
    _detach = ref.read(communityToastsProvider).attach((toast) {
      if (!mounted) return;
      try {
        toasts(context).show(title: toast.title, description: toast.description, destructive: toast.destructive);
      } catch (_) {
        // No toast host above (previews).
      }
    });
  }

  @override
  void dispose() {
    _detach?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
