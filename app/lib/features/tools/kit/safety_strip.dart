// Ported from: src/components/tools/anacan/SafetyStrip.tsx (SafetyStrip, SafetyMore), src/hooks/useEmergencyNumber.ts
//              (via features/legal emergencyNumberProvider), src/styles/anacan-design.css (.a-safety-strip,
//              .a-safety-strip-icon, .a-safety-strip-text, .a-safety-strip-call, .a-safety-more)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../legal/medical_disclaimer.dart' show emergencyNumberProvider;

/// Opens a `tel:` link (`<a href="tel:…">`). Tests override it.
final safetyCallLauncherProvider = Provider<Future<void> Function(Uri uri)>((ref) => (uri) async {
      await launchUrl(uri);
    });

/// `<SafetyStrip signs />`: "danger signs + call" row at the bottom of a tool: a small warning icon, one line of
/// already-translated signs and a compact red `tel:` pill with the user's country emergency number.
class SafetyStrip extends ConsumerWidget {
  const SafetyStrip({super.key, required this.signs});

  /// One short, already-translated line of tool-specific danger signs ("Zəng edin: …").
  final String signs;

  /// `.a-safety-strip-call { background: #c4262e; color: #ffffff }` (literal in anacan-design.css).
  static const Color callBackground = Color(0xFFC4262E);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final number = ref.watch(emergencyNumberProvider);
    final label = tr('safety_call_number', 'Zəng et {number}').replaceFirst('{number}', number);
    // role="note"
    return Semantics(
      container: true,
      child: Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsetsDirectional.fromSTEB(12, 6, 6, 6),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: a.line)),
        child: Row(
          children: [
            // `color: var(--a-coral-text, #c4262e)`: the variable is always defined.
            AIcon(AIcons.triangleAlert, size: 15, strokeWidth: 2.2, color: a.coralText),
            const SizedBox(width: 8),
            Expanded(
              child: Text(signs,
                  style: TextStyle(fontSize: 12, height: 1.35, fontWeight: FontWeight.w600, color: a.bodyText, leadingDistribution: TextLeadingDistribution.even)),
            ),
            const SizedBox(width: 8),
            Semantics(
              link: true,
              label: label,
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: number)),
                child: Container(
                  key: const ValueKey('safety-strip-call'),
                  constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: callBackground, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const AIcon(AIcons.phone, size: 13, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
                    const SizedBox(width: 5),
                    // <bdi>: the label keeps its own direction inside RTL text.
                    Text(label,
                        maxLines: 1,
                        softWrap: false,
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF), height: 1.5)),
                  ]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// `<SafetyMore summary text />`: one collapsed `<details>` line under the strip ("check with your doctor first").
/// The summary toggles the text; the browser's disclosure triangle is drawn as ▸ / ▾.
class SafetyMore extends StatefulWidget {
  const SafetyMore({super.key, required this.summary, required this.text});
  final String summary;
  final String text;

  @override
  State<SafetyMore> createState() => _SafetyMoreState();
}

class _SafetyMoreState extends State<SafetyMore> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final base = TextStyle(fontSize: 12, height: 1.4, color: a.bodyText, leadingDistribution: TextLeadingDistribution.even);
    return Padding(
      padding: const EdgeInsets.only(top: 6, left: 12, right: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            button: true,
            expanded: _open,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _open = !_open),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 13),
                child: Text('${_open ? '▾' : '▸'} ${widget.summary}', style: base.copyWith(fontWeight: FontWeight.w700)),
              ),
            ),
          ),
          if (_open) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(widget.text, style: base)),
        ],
      ),
    );
  }
}
