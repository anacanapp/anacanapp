// Ported from: src/components/pregnancy-loss/LossMemoriesScreen.tsx
//
// "Xatirələrim": everything from the pregnancy stays, out of sight, until she wants it. The album (its own tool,
// where photos can be deleted), the baby chat kept on this device (read or delete), a private letter kept on this
// device, the recovery guide and the "Hazır olanda" choices.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../../design/design.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../baby_chat/baby_chat.dart' show BabyChatThreads, deleteThreads, loadThreads;
import '../../settings/ui/settings_ui.dart' show px, toasts;
import '../common/health_format.dart';
import 'loss_ui.dart';
import 'pregnancy_loss.dart';
import 'ready_choices.dart';

class LossMemoriesScreen extends ConsumerStatefulWidget {
  const LossMemoriesScreen({super.key, required this.onBack, required this.onNavigate, required this.onOpenTool});
  final VoidCallback onBack;
  final void Function(String screen) onNavigate;
  final void Function(String tool) onOpenTool;
  @override
  ConsumerState<LossMemoriesScreen> createState() => _LossMemoriesScreenState();
}

class _LossMemoriesScreenState extends ConsumerState<LossMemoriesScreen> {
  String? _loadedFor;
  BabyChatThreads _threads = {};
  final TextEditingController _letter = TextEditingController();
  bool _chatOpen = false;
  bool _letterOpen = false;
  bool _confirmDelete = false;

  @override
  void dispose() {
    _letter.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = ref.watch(pregnancyLossTextProvider);
    final t = text.sub('ui');
    final language = ref.watch(appLanguageProvider);
    final userId = ref.watch(authUserProvider)?.id ?? 'local';
    final store = ref.watch(localStoreProvider);
    if (_loadedFor != userId) {
      _loadedFor = userId;
      _threads = loadThreads(store, userId);
      _letter.text = loadLossLetter(store, userId);
    }
    final days = _threads.keys.where((d) => _threads[d]?.isNotEmpty ?? false).toList()..sort();
    final a = context.a;
    final l = LossTokens.of(context);
    const white = Color(0xFFFFFFFF);

    return LossPage(
      onBack: widget.onBack,
      backLabel: t.s('back'),
      title: '${t.s('memories_title')} 🤍',
      children: [
        lossStack([
          LossCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(t.s('mem_intro'), style: lossBody(context))),
              LossRow(leading: const LossRowIcon(icon: AIcons.images), title: t.s('mem_album'), sub: t.s('mem_album_sub'), onTap: () => widget.onOpenTool('pregnancy-album')),
              LossRow(
                leading: const LossRowIcon(icon: AIcons.messageCircleHeart),
                title: t.s('mem_chat'),
                sub: days.isNotEmpty ? t.s('mem_chat_sub').replaceFirst('{n}', '${days.length}') : t.s('mem_chat_empty'),
                expanded: _chatOpen,
                onTap: () => setState(() => _chatOpen = !_chatOpen),
              ),
              if (_chatOpen && days.isNotEmpty)
                Container(
                  margin: const EdgeInsets.fromLTRB(0, 2, 0, 10),
                  padding: const EdgeInsets.all(10),
                  constraints: const BoxConstraints(maxHeight: 360),
                  decoration: BoxDecoration(color: l.soft, borderRadius: BorderRadius.circular(16)),
                  child: SingleChildScrollView(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      for (final day in days)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(0, 4, 0, 6),
                              child: Text(
                                fmtDayMonthYearLong(DateTime.tryParse('${day}T12:00:00') ?? DateTime.now(), language),
                                textAlign: TextAlign.center,
                                style: px(10.5, weight: FontWeight.w800, color: a.inkFaint),
                              ),
                            ),
                            for (final m in _threads[day]!)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Align(
                                  alignment: m.from == 'mom' ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                                  child: FractionallySizedBox(
                                    widthFactor: 0.82,
                                    alignment: m.from == 'mom' ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                                    child: Align(
                                      alignment: m.from == 'mom' ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                                        decoration: BoxDecoration(color: m.from == 'mom' ? l.accent : a.surface, borderRadius: BorderRadius.circular(14)),
                                        child: Text(m.text, style: px(12.5, color: m.from == 'mom' ? white : a.ink, height: 1.45)),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ]),
                        ),
                      if (_confirmDelete)
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14)),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            Text(t.s('mem_chat_delete_confirm'), style: lossBody(context, 12.5)),
                            const SizedBox(height: 8),
                            Row(children: [
                              Expanded(
                                child: _FlatButton(
                                  label: t.s('mem_chat_delete'),
                                  background: a.alertInk,
                                  color: white,
                                  weight: FontWeight.w800,
                                  onTap: () {
                                    deleteThreads(store, userId);
                                    setState(() {
                                      _threads = {};
                                      _confirmDelete = false;
                                      _chatOpen = false;
                                    });
                                    toasts(context).show(title: t.s('mem_deleted'));
                                  },
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(child: _FlatButton(label: t.s('ready_no'), color: a.inkSoft, onTap: () => setState(() => _confirmDelete = false))),
                            ]),
                          ]),
                        )
                      else
                        Center(
                          child: Semantics(
                            button: true,
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => setState(() => _confirmDelete = true),
                              child: Padding(
                                padding: const EdgeInsets.all(6),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  AIcon(AIcons.trash2, size: 14, color: a.alertInk),
                                  const SizedBox(width: 8),
                                  Text(t.s('mem_chat_delete'), style: px(12.5, weight: FontWeight.w700, color: a.alertInk)),
                                ]),
                              ),
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),
              LossRow(
                leading: const LossRowIcon(icon: AIcons.notebookPen),
                title: t.s('mem_letter'),
                sub: t.s('mem_letter_sub'),
                expanded: _letterOpen,
                onTap: () => setState(() => _letterOpen = !_letterOpen),
              ),
              if (_letterOpen)
                Padding(
                  padding: const EdgeInsets.fromLTRB(0, 2, 0, 10),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: l.soft, borderRadius: BorderRadius.circular(16)),
                      child: Material(
                        type: MaterialType.transparency,
                        child: TextField(
                          controller: _letter,
                          minLines: 7,
                          maxLines: 12,
                          maxLength: 5000,
                          style: px(14, color: a.ink, height: 1.55),
                          decoration: InputDecoration(
                            isCollapsed: true,
                            border: InputBorder.none,
                            counterText: '',
                            hintText: t.s('mem_letter_placeholder'),
                            hintStyle: px(14, color: a.inkFaint, height: 1.55),
                            semanticCounterText: t.s('mem_letter'),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    LossButton(
                      label: t.s('mem_save'),
                      padding: 11,
                      fontSize: 13.5,
                      onTap: () => toasts(context).show(title: saveLossLetter(store, userId, _letter.text) ? t.s('mem_saved') : t.s('sheet_error')),
                    ),
                  ]),
                ),
              LossRow(
                leading: const LossRowIcon(icon: AIcons.leaf),
                title: t.s('mem_guide'),
                sub: t.s('mem_guide_sub'),
                last: true,
                onTap: () => widget.onNavigate('loss-guide'),
              ),
            ]),
          ),
          ReadyChoices(text: text, onNavigate: widget.onNavigate),
        ]),
      ],
    );
  }
}

class _FlatButton extends StatelessWidget {
  const _FlatButton({required this.label, required this.onTap, required this.color, this.background, this.weight = FontWeight.w700});
  final String label;
  final VoidCallback onTap;
  final Color color;
  final Color? background;
  final FontWeight weight;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(12)),
            child: Text(label, textAlign: TextAlign.center, style: px(13, weight: weight, color: color, height: 1.3)),
          ),
        ),
      );
}
