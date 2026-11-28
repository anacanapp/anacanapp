// Ported from: src/components/community/StoryCropEditor.tsx, src/styles/anacan-design.css (.story-editor-*)
//
// The full-screen story editor: drag / pinch / rotate the photo or video inside the 9:16 frame, zoom slider, fit /
// fill / rotate, background swatches, up to 8 captions (font, alignment, background, colour, size). Images are
// exported to a 1080×1920 picture; videos keep their file and send the scene as `editor_layout`.
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../community/data/community_env.dart' show communityUuidProvider;
import '../../settings/ui/settings_ui.dart' show ALoader, px, toasts;
import '../ui/story_video_layout.dart';
import 'story_painter.dart';
import 'story_scene.dart';

/// `{ image, scene }`: [image] is null for videos.
class StoryEditorResult {
  const StoryEditorResult({required this.image, required this.scene});
  final StoryImageFile? image;
  final StoryScene scene;
}

/// The picked media: image bytes, or a local video path.
class StoryEditorMedia {
  const StoryEditorMedia.image(Uint8List this.bytes) : video = false, path = null;
  const StoryEditorMedia.video(String this.path) : video = true, bytes = null;
  final bool video;
  final Uint8List? bytes;
  final String? path;
}

const List<String> _colors = ['#ffffff', '#111827', '#ff658b', '#ffd166', '#6ee7b7', '#60a5fa', '#c4b5fd'];
const List<String> _backgrounds = ['#18181b', '#000000', '#ffffff', '#f5d8ce', '#b9d6e5', '#cbbde2'];

// Literals of .story-editor-* (anacan-design.css) and the dialog's #09090b.
const Color _editorBg = Color(0xFF09090B);
const Color _white = Color(0xFFFFFFFF);
const Color _ink = Color(0xFF18181B);

class StoryCropEditor extends ConsumerStatefulWidget {
  const StoryCropEditor({super.key, required this.media, required this.onConfirm, required this.onCancel});
  final StoryEditorMedia media;
  final Future<void> Function(StoryEditorResult result) onConfirm;
  final VoidCallback onCancel;

  @override
  ConsumerState<StoryCropEditor> createState() => _StoryCropEditorState();
}

class _StoryCropEditorState extends ConsumerState<StoryCropEditor> {
  StoryScene? _scene;
  String? _selectedId;
  bool _saving = false;
  bool _loadError = false;
  ui.Image? _image;
  List<StoryTextBox> _boxes = const [];
  final Map<int, StoryPoint> _pointers = {};
  ({StoryScene scene, List<StoryPoint> points, String? target})? _gesture;
  final GlobalKey _stageKey = GlobalKey();
  final TextEditingController _text = TextEditingController();
  final FocusNode _textFocus = FocusNode();
  final FocusNode _stageFocus = FocusNode();
  bool _mounted = true;

  StoryTextLayer? get _selected => _scene?.texts.where((t) => t.id == _selectedId).firstOrNull;

  @override
  void initState() {
    super.initState();
    if (!widget.media.video) unawaited(_loadImage());
  }

  Future<void> _loadImage() async {
    try {
      final codec = await ui.instantiateImageCodec(widget.media.bytes!);
      final frame = await codec.getNextFrame();
      codec.dispose();
      final image = frame.image;
      if (!_mounted) {
        image.dispose();
        return;
      }
      if (image.width == 0 || image.height == 0) {
        setState(() => _loadError = true);
        return;
      }
      setState(() {
        _image = image;
        _scene = initialStoryScene(image.width.toDouble(), image.height.toDouble());
      });
    } catch (_) {
      if (_mounted) setState(() => _loadError = true);
    }
  }

  @override
  void dispose() {
    _mounted = false;
    _image?.dispose();
    _text.dispose();
    _textFocus.dispose();
    _stageFocus.dispose();
    super.dispose();
  }

  void _update(StoryScene Function(StoryScene scene) change) {
    final scene = _scene;
    if (scene == null || _saving) return;
    setState(() => _scene = change(scene));
  }

  void _selectText(String? id) {
    if (_saving) return;
    setState(() {
      _selectedId = id;
      final layer = _selected;
      if (layer != null && _text.text != layer.text) _text.text = layer.text;
    });
  }

  void _updateText(StoryTextLayer Function(StoryTextLayer layer) change) =>
      _update((scene) => scene.copyWith(texts: [for (final t in scene.texts) t.id == _selectedId ? change(t) : t]));

  StoryPoint _point(Offset global) {
    final box = _stageKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return const StoryPoint(0, 0);
    final local = box.globalToLocal(global);
    return StoryPoint(local.dx / box.size.width * kStoryWidth, local.dy / box.size.height * kStoryHeight);
  }

  void _restartGesture([String? target]) {
    final scene = _scene;
    _gesture = scene != null && _pointers.isNotEmpty ? (scene: scene, points: [..._pointers.values], target: target ?? _selectedId) : null;
  }

  void _addText() {
    final scene = _scene;
    if (scene == null || scene.texts.length >= 8 || _saving) return;
    final id = ref.read(communityUuidProvider)();
    _update(
      (s) => s.copyWith(
        texts: [
          ...s.texts,
          StoryTextLayer(id: id, text: '', x: 0.5, y: 0.5, size: 60, rotation: 0, color: '#ffffff', font: 'sans', align: 'center', background: 'none'),
        ],
      ),
    );
    _selectText(id);
    _textFocus.requestFocus();
  }

  Future<void> _confirm() async {
    final scene = _scene;
    if (scene == null || (!widget.media.video && _image == null) || _saving) return;
    setState(() => _saving = true);
    try {
      final current = scene.copyWith(
        texts: [
          for (final t in scene.texts)
            if (t.text.trim().isNotEmpty) t,
        ],
      );
      final image = widget.media.video ? null : await exportStoryImage(_image!, current, encoder: ref.read(storyImageEncoderProvider));
      if (!_mounted) return;
      await widget.onConfirm(StoryEditorResult(image: image, scene: current));
    } catch (_) {
      if (_mounted && mounted) {
        try {
          toasts(context)
              .show(title: tr('story_editor_save_error', 'Story paylaşıla bilmədi. Düzəlişləriniz saxlanılıb, yenidən cəhd edin.'), destructive: true);
        } catch (_) {
          // No toast host (previews).
        }
      }
    } finally {
      if (_mounted) setState(() => _saving = false);
    }
  }

  // ── stage gestures ──

  void _onDown(PointerDownEvent e) {
    if (_saving || _scene == null || _pointers.length >= 2) return;
    if (_textFocus.hasFocus) {
      _textFocus.unfocus();
      return;
    }
    _stageFocus.requestFocus();
    final p = _point(e.position);
    if (_pointers.isEmpty) _selectText(hitStoryText(_boxes, p));
    _pointers[e.pointer] = p;
    _restartGesture();
  }

  void _onMove(PointerMoveEvent e) {
    final start = _gesture;
    if (!_pointers.containsKey(e.pointer) || start == null) return;
    _pointers[e.pointer] = _point(e.position);
    _update((_) => applyStoryGesture(start.scene, start.target, start.points, [..._pointers.values]));
  }

  void _onUp(int pointer) {
    _pointers.remove(pointer);
    _restartGesture();
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) return KeyEventResult.ignored;
    final delta = HardwareKeyboard.instance.isShiftPressed ? 40.0 : 12.0;
    final movement = <LogicalKeyboardKey, StoryPoint>{
      LogicalKeyboardKey.arrowLeft: StoryPoint(-delta, 0),
      LogicalKeyboardKey.arrowRight: StoryPoint(delta, 0),
      LogicalKeyboardKey.arrowUp: StoryPoint(0, -delta),
      LogicalKeyboardKey.arrowDown: StoryPoint(0, delta),
    }[event.logicalKey];
    if (movement == null) return KeyEventResult.ignored;
    _update((scene) => applyStoryGesture(scene, _selectedId, const [StoryPoint(0, 0)], [movement]));
    return KeyEventResult.handled;
  }

  // ── widgets ──

  Widget _iconButton({required AIconData icon, required String label, VoidCallback? onTap, bool enabled = true, double size = 22}) => Semantics(
    button: true,
    enabled: enabled,
    label: label,
    excludeSemantics: true,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1 : 0.45,
        child: Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(color: Color(0x18FFFFFF), shape: BoxShape.circle),
          alignment: Alignment.center,
          child: AIcon(icon, size: size, color: _white),
        ),
      ),
    ),
  );

  Widget _choice({required Widget child, String? label, bool? pressed, required VoidCallback onTap}) {
    final on = pressed == true;
    return Semantics(
      button: true,
      enabled: !_saving,
      label: label,
      toggled: pressed,
      excludeSemantics: label != null,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _saving ? null : onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
          decoration: BoxDecoration(
            color: on ? _white : const Color(0x15FFFFFF),
            border: Border.all(color: const Color(0x25FFFFFF)),
            borderRadius: BorderRadius.circular(999),
          ),
          child: IconTheme.merge(
            data: IconThemeData(color: on ? _ink : _white),
            child: DefaultTextStyle.merge(
              style: px(12, color: on ? _ink : _white, height: 1.2),
              child: Row(mainAxisSize: MainAxisSize.min, children: [child]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _swatches(List<String> values, String? current, String labelPrefix, void Function(String value) onPick) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      for (var i = 0; i < values.length; i++) ...[
        if (i > 0) const SizedBox(width: 14),
        Semantics(
          button: true,
          toggled: current == values[i],
          label: '$labelPrefix ${values[i]}',
          excludeSemantics: true,
          child: GestureDetector(
            onTap: _saving ? null : () => onPick(values[i]),
            child: Container(
              width: 35,
              height: 35,
              alignment: Alignment.center,
              decoration: current == values[i]
                  ? BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: _white, width: 2),
                    )
                  : null,
              child: Container(
                width: 25,
                height: 25,
                decoration: BoxDecoration(
                  color: storyColor(values[i]),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0x70FFFFFF), width: 2),
                ),
              ),
            ),
          ),
        ),
      ],
    ],
  );

  Widget _slider({
    required double value,
    required double min,
    required double max,
    double? step,
    required String label,
    required ValueChanged<double> onChanged,
    bool enabled = true,
  }) => Semantics(
    label: label,
    child: SliderTheme(
      data: const SliderThemeData(
        activeTrackColor: _white,
        thumbColor: _white,
        inactiveTrackColor: Color(0x40FFFFFF),
        overlayShape: RoundSliderOverlayShape(overlayRadius: 14),
      ),
      child: Slider(
        value: value.clamp(min, max).toDouble(),
        min: min,
        max: max,
        divisions: step == null ? null : ((max - min) / step).round(),
        onChanged: enabled && !_saving ? onChanged : null,
      ),
    ),
  );

  Widget _controls(BuildContext context) {
    final selected = _selected;
    final scene = _scene;
    if (selected != null) {
      return Column(
        key: ValueKey('text:${selected.id}'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0x10FFFFFF),
                    border: Border.all(color: const Color(0x40FFFFFF)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Semantics(
                    label: tr('story_editor_text', 'Story mətni'),
                    child: TextField(
                      controller: _text,
                      focusNode: _textFocus,
                      enabled: !_saving,
                      maxLength: 280,
                      minLines: 2,
                      maxLines: 2,
                      cursorColor: _white,
                      style: px(16, color: _white, height: 1.4),
                      onChanged: (value) => _updateText((t) => t.copyWith(text: value)),
                      decoration: InputDecoration(
                        isCollapsed: true,
                        border: InputBorder.none,
                        counterText: '',
                        hintText: tr('story_editor_text_placeholder', 'Mətn yaz...'),
                        hintStyle: px(16, color: const Color(0x80FFFFFF), height: 1.4),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _iconButton(
                icon: AIcons.check,
                label: tr('common_hazir', 'Hazır'),
                enabled: !_saving,
                onTap: () {
                  _textFocus.unfocus();
                  _selectText(null);
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          // .story-editor-options never wraps; on narrow phones the row scrolls instead of clipping.
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final font in kStoryFonts) ...[
                  _choice(
                    pressed: selected.font == font,
                    onTap: () => _updateText((t) => t.copyWith(font: font)),
                    child: Text(
                      trInline(
                        'StoryCropEditor.tsx',
                        font == 'sans'
                            ? 'Aa'
                            : font == 'serif'
                            ? 'Serif'
                            : 'Mono',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                _iconButton(
                  icon: selected.align == 'left'
                      ? AIcons.alignLeft
                      : selected.align == 'center'
                      ? AIcons.alignCenter
                      : AIcons.alignRight,
                  size: 19,
                  label: tr('story_editor_align', 'Mətn düzülüşü'),
                  enabled: !_saving,
                  onTap: () => _updateText(
                    (t) => t.copyWith(
                      align: t.align == 'left'
                          ? 'center'
                          : t.align == 'center'
                          ? 'right'
                          : 'left',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _choice(
                  label: tr('story_editor_text_background', 'Mətn fonu'),
                  onTap: () => _updateText((t) {
                    final background = t.background == 'none'
                        ? 'dark'
                        : t.background == 'dark'
                        ? 'light'
                        : 'none';
                    return t.copyWith(background: background, color: background == 'light' ? '#111827' : '#ffffff');
                  }),
                  child: Text(trInline('StoryCropEditor.tsx', 'A▣')),
                ),
                const SizedBox(width: 8),
                _iconButton(
                  icon: AIcons.trash2,
                  size: 18,
                  label: tr('community_delete_text', 'Mətni sil'),
                  enabled: !_saving,
                  onTap: () {
                    final id = _selectedId;
                    _update(
                      (s) => s.copyWith(
                        texts: [
                          for (final t in s.texts)
                            if (t.id != id) t,
                        ],
                      ),
                    );
                    _selectText(null);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          _swatches(_colors, selected.color, tr('story_editor_color', 'Rəng'), (color) => _updateText((t) => t.copyWith(color: color))),
          const SizedBox(height: 10),
          _slider(
            value: selected.size,
            min: 28,
            max: 120,
            step: 1,
            label: tr('story_editor_text_size', 'Mətn ölçüsü'),
            onChanged: (v) => _updateText((t) => t.copyWith(size: v)),
          ),
        ],
      );
    }
    return Column(
      key: const ValueKey('media'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            const AIcon(AIcons.zoomOut, size: 18, color: _white),
            Expanded(
              child: _slider(
                value: scene?.media.zoom ?? 1,
                min: kStoryMinZoom,
                max: kStoryMaxZoom,
                step: 0.01,
                label: tr('story_editor_zoom', 'Yaxınlaşdırma'),
                enabled: scene != null,
                onChanged: (v) => _update((s) => s.copyWith(media: s.media.copyWith(zoom: v))),
              ),
            ),
            const AIcon(AIcons.zoomIn, size: 18, color: _white),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _choice(
              onTap: () => _update(fitStoryMedia),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [const AIcon(AIcons.image, size: 16), const SizedBox(width: 5), Text(tr('story_editor_fit', 'Tam şəkil'))],
              ),
            ),
            _choice(
              onTap: () => _update((s) => fitStoryMedia(s, cover: true)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [const AIcon(AIcons.expand, size: 16), const SizedBox(width: 5), Text(tr('story_editor_fill', 'Doldur'))],
              ),
            ),
            _iconButton(
              icon: AIcons.rotateCw,
              size: 20,
              label: tr('story_editor_rotate', 'Döndər'),
              enabled: !_saving,
              onTap: () => _update((s) => fitStoryMedia(s.copyWith(media: s.media.copyWith(rotation: (s.media.rotation + 90) % 360)))),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _swatches(
          _backgrounds,
          scene?.background,
          tr('story_editor_background', 'Story fonu'),
          (background) => _update((s) => s.copyWith(background: background)),
        ),
        const SizedBox(height: 10),
        Text(
          tr('story_editor_gesture_hint', 'Sürüşdürün · İki barmaqla ölçünü və bucağı dəyişin'),
          textAlign: TextAlign.center,
          style: px(11, color: const Color(0xB3FFFFFF)),
        ),
      ],
    );
  }

  Widget _stage(BuildContext context, BoxConstraints slot) {
    final stageWidth = math.max(1.0, math.min(slot.maxWidth - 24, (slot.maxHeight - 8) * 9 / 16));
    final scene = _scene;
    return Focus(
      focusNode: _stageFocus,
      onKeyEvent: _onKey,
      child: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: _onDown,
        onPointerMove: _onMove,
        onPointerUp: (e) => _onUp(e.pointer),
        onPointerCancel: (e) => _onUp(e.pointer),
        child: GestureDetector(
          onDoubleTapDown: (d) {
            final id = hitStoryText(_boxes, _point(d.globalPosition));
            if (id != null) {
              _selectText(id);
              _textFocus.requestFocus();
            }
          },
          onDoubleTap: () {},
          child: Container(
            key: _stageKey,
            width: stageWidth,
            height: stageWidth * 16 / 9,
            decoration: BoxDecoration(color: _ink, borderRadius: BorderRadius.circular(16)),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (widget.media.video)
                  StoryVideoLayout(
                    src: widget.media.path!,
                    localFile: true,
                    layout: scene,
                    muted: true,
                    renderText: false,
                    loop: true,
                    onError: () {
                      if (mounted) setState(() => _loadError = true);
                    },
                    onVideoSize: (size) {
                      if (_scene == null && size.width > 0 && size.height > 0 && mounted) {
                        setState(() => _scene = initialStoryScene(size.width, size.height));
                      }
                    },
                  ),
                if (scene != null)
                  Semantics(
                    image: true,
                    label: tr('story_editor_preview', 'Story önizləməsi'),
                    child: CustomPaint(
                      painter: _ScenePainter(
                        scene: scene,
                        image: _image,
                        textOnly: widget.media.video,
                        selectedId: _selectedId,
                        placeholder: tr('story_editor_text_placeholder', 'Mətn yaz...'),
                        onBoxes: (boxes) => _boxes = boxes,
                      ),
                    ),
                  ),
                if (scene == null) const Center(child: ALoader(size: 28, color: _white)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final scene = _scene;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onCancel();
      },
      child: Semantics(
        scopesRoute: true,
        namesRoute: true,
        explicitChildNodes: true,
        label: tr('story_editor_title', 'Story redaktoru'),
        hint: tr('story_editor_help', 'Şəkli sürüşdürün, iki barmaqla yaxınlaşdırın və mətn əlavə edin.'),
        child: Material(
          color: _editorBg,
          child: DefaultTextStyle.merge(
            style: const TextStyle(color: _white),
            child: Padding(
              // The visual viewport: the keyboard shortens the editor.
              padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
              child: Column(
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(14, math.max(10, media.padding.top), 14, 8),
                    child: Row(
                      children: [
                        _iconButton(icon: AIcons.x, label: tr('common_close', 'Bağla'), size: 23, onTap: widget.onCancel),
                        const SizedBox(width: 10),
                        _iconButton(
                          icon: AIcons.type,
                          size: 24,
                          label: tr('story_editor_add_text', 'Mətn əlavə et'),
                          enabled: scene != null && !_saving && scene.texts.length < 8,
                          onTap: _addText,
                        ),
                        const Spacer(),
                        Semantics(
                          button: true,
                          enabled: scene != null && !_saving && !_loadError,
                          child: GestureDetector(
                            onTap: scene != null && !_saving && !_loadError ? () => unawaited(_confirm()) : null,
                            child: Opacity(
                              opacity: scene != null && !_saving && !_loadError ? 1 : 0.45,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.circular(999)),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    _saving ? const ALoader(size: 18, color: _ink) : const AIcon(AIcons.check, size: 18, color: _ink),
                                    const SizedBox(width: 7),
                                    Text(
                                      _saving ? tr('story_editor_saving', 'Paylaşılır...') : tr('story_editor_share', 'Paylaş'),
                                      style: px(14, weight: FontWeight.w700, color: _ink, height: 1.2),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: ClipRect(
                      child: LayoutBuilder(
                        builder: (context, constraints) => Center(
                          child: _loadError
                              ? Semantics(
                                  liveRegion: true,
                                  child: Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: Text(
                                      tr('story_editor_load_error', 'Bu fayl açıla bilmədi. Başqa şəkil və ya video seçin.'),
                                      textAlign: TextAlign.center,
                                      style: px(14, color: _white),
                                    ),
                                  ),
                                )
                              : _stage(context, constraints),
                        ),
                      ),
                    ),
                  ),
                  LayoutBuilder(
                    builder: (context, _) {
                      final available = media.size.height - media.viewInsets.bottom;
                      return ConstrainedBox(
                        constraints: BoxConstraints(maxWidth: 480, maxHeight: math.min(226, available * 0.45)),
                        child: SizedBox(
                          height: math.min(226, available * 0.45),
                          child: SingleChildScrollView(padding: EdgeInsets.fromLTRB(16, 10, 16, math.max(12, media.padding.bottom)), child: _controls(context)),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ScenePainter extends CustomPainter {
  _ScenePainter({required this.scene, required this.image, required this.textOnly, required this.selectedId, required this.placeholder, required this.onBoxes});
  final StoryScene scene;
  final ui.Image? image;
  final bool textOnly;
  final String? selectedId;
  final String placeholder;
  final void Function(List<StoryTextBox> boxes) onBoxes;

  @override
  void paint(Canvas canvas, Size size) {
    onBoxes(drawStoryScene(canvas, size, image, scene, textOnly: textOnly, selectedId: selectedId, placeholder: placeholder));
  }

  @override
  bool shouldRepaint(_ScenePainter old) =>
      old.scene != scene || old.image != image || old.textOnly != textOnly || old.selectedId != selectedId || old.placeholder != placeholder;
}

/// Opens the editor as a full-screen route (Radix Dialog, z-200).
Future<void> pushStoryCropEditor(BuildContext context, WidgetBuilder builder) => Navigator.of(context, rootNavigator: true).push<void>(
  PageRouteBuilder<void>(
    opaque: true,
    transitionDuration: const Duration(milliseconds: 200),
    reverseTransitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (ctx, _, _) => builder(ctx),
    transitionsBuilder: (ctx, animation, _, child) => FadeTransition(opacity: animation, child: child),
  ),
);
