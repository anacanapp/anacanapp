// Ported from: src/pages/NotFound.tsx
//
// The 404 page of the outer router (any path that is neither a native route nor a known app path; AppPathLink's
// "known path" branch is shell/router.dart). "Return to Home" is `<a href="/">`: the app root.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../../features/startup/widgets/a_sky.dart';

class NotFoundPage extends StatefulWidget {
  const NotFoundPage({super.key, required this.path, this.onHome});

  /// `location.pathname` the user tried (logged like React's console.error).
  final String path;

  /// Defaults to `GoRouter.of(context).go('/')`.
  final VoidCallback? onHome;

  @override
  State<NotFoundPage> createState() => _NotFoundPageState();
}

class _NotFoundPageState extends State<NotFoundPage> {
  void _log() => debugPrint('404 Error: User attempted to access non-existent route: ${widget.path}');

  @override
  void initState() {
    super.initState();
    _log();
  }

  @override
  void didUpdateWidget(NotFoundPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.path != widget.path) _log();
  }

  void _home() {
    final onHome = widget.onHome;
    if (onHome != null) {
      onHome();
      return;
    }
    GoRouter.of(context).go('/');
  }

  @override
  Widget build(BuildContext context) {
    final a = AnacanTokens.of(context).a;
    return ColoredBox(
      color: a.bg,
      child: Stack(
        children: [
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ACard(
                padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 44),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                      child: const Text('🧭', style: TextStyle(fontSize: 28)),
                    ),
                    const SizedBox(height: 16),
                    Text('404',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: 40 * -0.03, color: a.ink, height: 1.5)),
                    const SizedBox(height: 8),
                    Text(tr('notfound_oops_page_not_found', 'Oops! Page not found'),
                        textAlign: TextAlign.center, style: TextStyle(fontSize: 15, color: a.inkSoft, height: 1.5)),
                    const SizedBox(height: 20),
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _home,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 26),
                        decoration: BoxDecoration(
                          color: a.peach2,
                          borderRadius: BorderRadius.circular(999),
                          // NotFound.tsx inline boxShadow '0 14px 28px -12px rgba(217, 108, 74, 0.55)'.
                          boxShadow: const [BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12)],
                        ),
                        child: Text(tr('notfound_return_to_home', 'Return to Home'),
                            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF))),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
