// Ported from: src/components/stickers/StickerPicker.tsx, src/styles/stickers.css
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../settings/ui/settings_ui.dart' show px;
import '../copy/chat_copy.dart';
import '../data/stickers.dart';

const Map<StickerGroup, String> _groupLabel = {
  StickerGroup.ritm: 'Ritm',
  StickerGroup.tumurcuq: 'Tumurcuq',
  StickerGroup.qucaq: 'Qucaq',
  StickerGroup.trio: '♥',
};

// One-off brand colours of StickerPicker.tsx GROUP_COLOR.
const Map<StickerGroup, Color> _groupColor = {
  StickerGroup.ritm: Color(0xFFEF4452),
  StickerGroup.tumurcuq: Color(0xFF9A4FE0),
  StickerGroup.qucaq: Color(0xFF14A889),
  StickerGroup.trio: Color(0xFFFF5A5F),
};

/// Compact sticker tray used by community comments and every chat composer.
class StickerPicker extends ConsumerStatefulWidget {
  const StickerPicker({super.key, required this.onPick, required this.onClose, this.disabled = false});
  final ValueChanged<String> onPick;
  final VoidCallback onClose;
  final bool disabled;

  @override
  ConsumerState<StickerPicker> createState() => _StickerPickerState();
}

class _StickerPickerState extends ConsumerState<StickerPicker> {
  StickerGroup? _group; // null = 'all'
  late final List<String> _recent = recentStickers(ref.read(localStoreProvider));

  void _pick(String id) {
    if (widget.disabled) return;
    rememberSticker(ref.read(localStoreProvider), id);
    widget.onPick(id);
  }

  Widget _tab(String label, bool selected, VoidCallback onTap, {Color? selectedColor}) {
    final a = context.a;
    return Semantics(
      container: true,
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            // .sticker-picker-tabs button[aria-selected=true] { background: #FF5A5F } (inline group colour wins)
            color: selected ? (selectedColor ?? const Color(0xFFFF5A5F)) : a.surfaceSoft,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(label, style: px(12.5, weight: FontWeight.w700, color: selected ? const Color(0xFFFFFFFF) : a.inkSoft, height: 1.2)),
        ),
      ),
    );
  }

  Widget _cell(String id, {String keyPrefix = ''}) => Semantics(
        key: ValueKey('sticker-$keyPrefix$id'),
        button: true,
        enabled: !widget.disabled,
        label: stickerText('send'),
        excludeSemantics: true,
        child: PressScale.css(
          scale: 0.92,
          duration: const Duration(milliseconds: 120),
          enabled: !widget.disabled,
          onTap: () => _pick(id),
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: Image.asset(stickerAsset(id), fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.expand()),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final group = _group;
    final list = group == null ? kStickers : kStickers.where((s) => s.group == group).toList();
    final ids = [
      if (group == null) ..._recent.map((id) => ('r-', id)),
      for (final s in list)
        if (group != null || !_recent.contains(s.id)) ('', s.id),
    ];
    return Semantics(
      label: stickerText('stickers'),
      container: true,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.fromLTRB(10, 10, 10, 6),
        decoration: BoxDecoration(
          color: a.surface,
          border: Border.all(color: a.line),
          borderRadius: BorderRadius.circular(20),
          // box-shadow: 0 18px 40px -20px rgba(158,43,46,.35) (stickers.css)
          boxShadow: const [BoxShadow(color: Color(0x599E2B2E), offset: Offset(0, 18), blurRadius: 40, spreadRadius: -20)],
        ),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 2, 4, 8),
            child: Row(children: [
              Expanded(child: Text(stickerText('stickers'), style: px(14, weight: FontWeight.w800, color: a.ink, height: 1.3))),
              Semantics(
                container: true,
                button: true,
                label: stickerText('close'),
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: widget.onClose,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: AIcon(AIcons.x, size: 16, color: a.ink),
                  ),
                ),
              ),
            ]),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(2, 0, 2, 8),
            child: Row(children: [
              _tab(stickerText('all'), group == null, () => setState(() => _group = null)),
              for (final item in kStickerGroups) ...[
                const SizedBox(width: 6),
                _tab(_groupLabel[item]!, group == item, () => setState(() => _group = item), selectedColor: _groupColor[item]),
              ],
            ]),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 248),
            child: GridView.count(
              shrinkWrap: true,
              padding: const EdgeInsets.all(2),
              crossAxisCount: 4,
              mainAxisSpacing: 6,
              crossAxisSpacing: 6,
              children: [for (final (prefix, id) in ids) _cell(id, keyPrefix: prefix)],
            ),
          ),
        ]),
      ),
    );
  }
}

/// Renders a sent sticker (no bubble chrome).
class StickerImage extends StatelessWidget {
  const StickerImage({super.key, required this.id, this.size = 132});
  final String id;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
        image: true,
        label: '${stickerText('sticker')} ${int.parse(id)}',
        excludeSemantics: true,
        child: Container(
          width: size,
          height: size,
          // .sticker-image { filter: drop-shadow(0 6px 10px rgba(0,0,0,.08)) } — approximated by the image itself.
          alignment: Alignment.center,
          child: Image.asset(stickerAsset(id), width: size, height: size, fit: BoxFit.contain, errorBuilder: (_, _, _) => SizedBox.square(dimension: size)),
        ),
      );
}
