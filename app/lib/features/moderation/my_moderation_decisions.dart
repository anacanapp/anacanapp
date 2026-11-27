// Ported from: src/components/moderation/MyModerationDecisions.tsx
//
// The user's own moderation decisions (`my_moderator_decisions_v1`, 30 latest) with one appeal each
// (`submit_moderator_appeal_v1`, idempotent per backend + text through a stable `p_id`).
import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/offline/offline_outbox.dart' show newClientId;
import '../../design/design.dart';
import '../../state/shell_bindings.dart' show backendUrlProvider;
import '../../state/user_store.dart';
import '../settings/ui/settings_ui.dart' show ALoader, ShadButton, ShadButtonVariant, Tw, toasts;
import 'moderation_queries.dart';
import 'moderator.dart';

class MyModerationDecisions extends ConsumerStatefulWidget {
  const MyModerationDecisions({super.key, this.onBack});
  final VoidCallback? onBack;

  @override
  ConsumerState<MyModerationDecisions> createState() => _MyModerationDecisionsState();
}

class _MyModerationDecisionsState extends ConsumerState<MyModerationDecisions> {
  String? _selected;
  final TextEditingController _text = TextEditingController();
  ({String key, String id})? _request;
  bool _pending = false;

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  String _backend() {
    try {
      return ref.read(backendUrlProvider);
    } catch (_) {
      return '';
    }
  }

  void _reset() {
    _selected = null;
    _text.clear();
    _request = null;
  }

  Future<void> _appeal(String id, String language) async {
    final args = <String, dynamic>{'p_actor': ref.read(authUserProvider)?.id, 'p_action': id, 'p_body': _text.text.trim()};
    final key = jsonEncode([_backend(), args]);
    if (_request?.key != key) _request = (key: key, id: newClientId());
    setState(() => _pending = true);
    final toast = toasts(context);
    final result = await ref.read(moderatorMutationProvider)('submit_moderator_appeal_v1', {...args, 'p_id': _request!.id});
    if (!mounted) return;
    setState(() => _pending = false);
    if (result.error != null) {
      toast.show(title: moderatorError(result.error, language), destructive: true);
      return;
    }
    toast.show(title: moderatorText('saved', language));
    setState(() {
      _selected = null;
      _text.clear();
    });
    unawaited(ref.read(myModerationDecisionsQuery.notifier).refetch());
  }

  @override
  Widget build(BuildContext context) {
    // A different account or backend starts clean (React: effect on [user?.id, backend]).
    ref.listen(authUserProvider.select((u) => u?.id), (_, _) => setState(_reset));
    final a = context.a;
    final s = context.tokens.shadcn;
    final language = ref.watch(userStoreProvider.select((st) => st.language));
    final query = ref.watch(myModerationDecisionsQuery);
    final items = query.data;

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
          // header.a-topbar.px-4: min-height 64, padding-block 12, gap 12; ghost icon button 40×40.
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: <Widget>[
                if (widget.onBack != null) ...<Widget>[
                  ShadButton(
                    key: const ValueKey<String>('moderation-back'),
                    variant: ShadButtonVariant.ghost,
                    icon: true,
                    onPressed: widget.onBack,
                    child: AIcon(AIcons.arrowLeft, size: 16, color: s.foreground, mirrorInRtl: true),
                  ),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(moderatorText('user_history', language),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, height: 1.5, fontWeight: FontWeight.w700)),
                ),
              ]),
            ),
          ),
          Expanded(
            child: ListView(
              key: const ValueKey<String>('moderation-list'),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: <Widget>[
                if (query.isPending)
                  Padding(
                    key: const ValueKey<String>('moderation-loading'),
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: Semantics(
                      liveRegion: true,
                      child: Row(children: <Widget>[
                        const ALoader(size: 24),
                        const SizedBox(width: 8),
                        Flexible(child: Text(moderatorText('loading', language), style: const TextStyle(fontSize: 16, height: 1.5))),
                      ]),
                    ),
                  ),
                if (query.isError)
                  Semantics(liveRegion: true, child: Text(moderatorError(query.error, language), style: const TextStyle(fontSize: 16, height: 1.5))),
                if (items != null)
                  for (var i = 0; i < items.length; i++) ...<Widget>[
                    if (i > 0) const SizedBox(height: 12),
                    _decision(context, items[i], language),
                  ],
                if (items != null && items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Text(moderatorText('empty', language),
                        textAlign: TextAlign.center, style: TextStyle(fontSize: 16, height: 1.5, color: s.mutedForeground)),
                  ),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Widget _decision(BuildContext context, Map<String, dynamic> item, String language) {
    final s = context.tokens.shadcn;
    final id = '${item['id']}';
    final appeal = item['appeal'] is Map ? Map<String, dynamic>.from(item['appeal'] as Map) : null;
    final detail = item['public_detail'];
    final body = detail is String && detail.isNotEmpty ? detail : moderatorReason(item['reason'] as String?, language, true);

    Widget tail;
    if (appeal?['state'] == 'open') {
      tail = Text(moderatorText('appeal_pending', language), style: Tw.sm.copyWith(color: s.mutedForeground));
    } else if (appeal?['response'] is String && (appeal!['response'] as String).isNotEmpty) {
      tail = Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(12)),
        child: Text(appeal['response'] as String, style: Tw.sm),
      );
    } else if (_selected == id) {
      final canSend = !_pending && _text.text.trim().length >= 10;
      tail = Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        Semantics(
          label: moderatorText('appeal_text', language),
          textField: true,
          child: Container(
            constraints: const BoxConstraints(minHeight: 80),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: s.background, borderRadius: BorderRadius.circular(6), border: Border.all(color: s.input)),
            child: Material(
              type: MaterialType.transparency,
              child: TextField(
                key: ValueKey<String>('moderation-appeal-$id'),
                controller: _text,
                maxLength: 2000,
                minLines: 4,
                maxLines: 4,
                style: Tw.sm.copyWith(color: s.foreground),
                cursorColor: s.primary,
                decoration: const InputDecoration(isCollapsed: true, border: InputBorder.none, counterText: ''),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        ShadButton(
          key: ValueKey<String>('moderation-send-$id'),
          onPressed: canSend ? () => unawaited(_appeal(id, language)) : null,
          child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
            AIcon(AIcons.send, size: 16, color: s.primaryForeground),
            const SizedBox(width: 8),
            Flexible(child: Text(moderatorText('appeal_send', language))),
          ]),
        ),
      ]);
    } else {
      tail = Align(
        alignment: AlignmentDirectional.centerStart,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: _OutlineWrapButton(
            key: ValueKey<String>('moderation-appeal-open-$id'),
            label: moderatorText('appeal', language),
            onTap: () => setState(() {
              _selected = id;
              _text.clear();
            }),
          ),
        ),
      );
    }

    return ACard(
      key: ValueKey<String>('moderation-item-$id'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        Text(moderatorReason(item['reason'] as String?, language), style: Tw.sm.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Text(body, style: const TextStyle(fontSize: 14, height: 1.625)),
        const SizedBox(height: 12),
        tail,
      ]),
    );
  }
}

/// `<Button variant="outline" className="min-h-11 h-auto whitespace-normal">` (wraps its label).
class _OutlineWrapButton extends StatelessWidget {
  const _OutlineWrapButton({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final s = context.tokens.shadcn;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: s.background, borderRadius: BorderRadius.circular(6), border: Border.all(color: s.input)),
          child: Text(label, textAlign: TextAlign.center, style: Tw.sm.copyWith(fontWeight: FontWeight.w500, color: s.foreground)),
        ),
      ),
    );
  }
}
