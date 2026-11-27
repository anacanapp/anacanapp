// Ported from: src/components/chat/ChatMemberPicker.tsx
//
// People search for group creation / invitations (used by the community groups port).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../copy/chat_copy.dart';
import '../data/chat_backend.dart';
import 'chat_widgets.dart';

final chatMemberSearchQuery = queryProviderFamily<List<ChatRow>, String>((ref, term) {
  final user = ref.watch(authUserProvider);
  final backend = ref.watch(chatBackendProvider);
  return QueryOptions<List<ChatRow>>(
    queryKey: ['chat-member-search', ref.watch(chatBackendUrlProvider), user?.id, term],
    enabled: user != null && term.length >= 2,
    staleTime: const Duration(seconds: 10),
    queryFn: (_) => searchPublicProfileCards(backend, term.replaceAll(RegExp(r'[%,_\\]'), ''), 20),
  );
}, name: 'chatMemberSearchQuery');

class ChatMemberPicker extends ConsumerStatefulWidget {
  const ChatMemberPicker({super.key, required this.selected, required this.onChange, this.excluded = const []});

  /// Public profile cards (`{user_id, name, avatar_url}`).
  final List<ChatRow> selected;
  final ValueChanged<List<ChatRow>> onChange;
  final List<String> excluded;

  @override
  ConsumerState<ChatMemberPicker> createState() => _ChatMemberPickerState();
}

class _ChatMemberPickerState extends ConsumerState<ChatMemberPicker> {
  final TextEditingController _search = TextEditingController();
  String _term = '';
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _search.addListener(() {
      _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 250), () {
        if (mounted) setState(() => _term = _search.text.trim());
      });
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  bool _isSelected(String id) => widget.selected.any((item) => item['user_id'] == id);

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final userId = ref.watch(authUserProvider)?.id;
    final query = ref.watch(chatMemberSearchQuery(_term));
    final people = [
      for (final person in query.data ?? const <ChatRow>[])
        if (person['user_id'] != userId && !widget.excluded.contains(person['user_id'])) person,
    ];
    final hint = chatTr('chat_find_member', 'Ad ilə istifadəçi axtarın');
    final style = px(13, color: a.ink);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      // .a-search
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: a.line),
          boxShadow: a.cardShadow,
        ),
        child: Row(children: [
          AIcon(AIcons.search, size: 16, color: a.inkSoft),
          const SizedBox(width: 10),
          Expanded(
            child: Semantics(
              label: hint,
              child: Material(
                type: MaterialType.transparency,
                child: TextField(
                controller: _search,
                maxLength: 80,
                style: style,
                cursorColor: a.peach2,
                decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, counterText: '', hintText: hint, hintStyle: style.copyWith(color: a.inkFaint)),
                ),
              ),
            ),
          ),
        ]),
      ),
      if (widget.selected.isNotEmpty) ...[
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final person in widget.selected)
            GestureDetector(
              onTap: () => widget.onChange([for (final item in widget.selected) if (item['user_id'] != person['user_id']) item]),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: s.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('${person['name'] ?? ''}', style: px(12, height: 16 / 12)),
                  const SizedBox(width: 6),
                  const AIcon(AIcons.x, size: 12),
                ]),
              ),
            ),
        ]),
      ],
      if (query.isFetching) ...[const SizedBox(height: 12), const Center(child: ALoader(size: 18))],
      if (_term.length < 2) ...[
        const SizedBox(height: 12),
        Text(chatTr('chat_search_two_letters', 'Axtarış üçün ən azı 2 hərf yazın.'), style: px(12, color: s.mutedForeground, height: 16 / 12)),
      ],
      const SizedBox(height: 12),
      ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 288),
        child: ListView(shrinkWrap: true, padding: EdgeInsets.zero, children: [
          for (final person in people)
            () {
              final id = '${person['user_id']}';
              final checked = _isSelected(id);
              final name = person['name'] as String?;
              return Semantics(
                container: true,
                button: true,
                checked: checked,
                label: name ?? '',
                excludeSemantics: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    if (checked) {
                      widget.onChange([for (final item in widget.selected) if (item['user_id'] != id) item]);
                    } else {
                      widget.onChange([...widget.selected, person].take(50).toList());
                    }
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    child: Row(children: [
                      ChatAvatar(size: 36, url: person['avatar_url'] as String?, fallback: Text(charAt0(name))),
                      const SizedBox(width: 12),
                      Expanded(child: Text(name ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w600, height: 20 / 14))),
                      Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: checked ? s.primary : null,
                          border: Border.all(color: checked ? s.primary : s.border),
                        ),
                        alignment: Alignment.center,
                        child: checked ? const AIcon(AIcons.check, size: 13, color: Color(0xFFFFFFFF)) : null,
                      ),
                    ]),
                  ),
                ),
              );
            }(),
        ]),
      ),
      if (_term.length >= 2 && !query.isFetching && people.isEmpty)
        Text(chatTr('chat_no_members_found', 'İstifadəçi tapılmadı.'), style: px(12, color: s.mutedForeground, height: 16 / 12)),
    ]);
  }
}
