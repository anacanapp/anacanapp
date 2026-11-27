// Ported from: src/components/chat/ConversationScreen.tsx, src/styles/chat.css, src/styles/stickers.css
//              (.chat-message.chat-message-sticker)
//
// The full-screen conversation (`createPortal(<section className="chat-screen">, document.body)` → an
// [OverlayPortal] over the whole app). The message list is reversed (offset 0 = newest), which keeps the view
// pinned to the bottom while media load and keeps the position when older pages are prepended.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../core/offline/offline_outbox.dart' show newClientId;
import '../../../design/design.dart';
import '../../../shell/shell.dart';
import '../../baby/locale_format.dart' show localeTimeHm;
import '../../baby/widgets/child_selector.dart' show showConfirmDialog;
import '../../moderation/moderation_queries.dart' show myModerationStatusQuery;
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../copy/chat_copy.dart';
import '../data/chat.dart';
import '../data/chat_backend.dart';
import '../data/chat_messages.dart';
import '../data/partner_messages.dart' show ChatToast;
import '../data/stickers.dart';
import '../platform/chat_audio.dart';
import '../platform/chat_media_picker.dart';
import 'chat_media_attachment.dart';
import 'chat_widgets.dart';
import 'sticker_picker.dart';
import 'voice_message.dart';

/// `Intl.DateTimeFormat(getLocaleTag(), { day: 'numeric', month: 'long' })`.
String chatDayLabel(DateTime date, {String? language}) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final local = date.toLocal();
  try {
    if (isPackLanguage(lang)) return formatIntlDateTemplate(lang, 'dm', local);
    return DateFormat.MMMMd(appLanguage(lang).intlLocale).format(local);
  } catch (_) {
    return '${local.day} ${getTranslatedMonth(local.month - 1)}';
  }
}

bool _sameDay(DateTime a, DateTime b) {
  final x = a.toLocal(), y = b.toLocal();
  return x.year == y.year && x.month == y.month && x.day == y.day;
}

DateTime _date(String iso) => DateTime.tryParse(iso) ?? DateTime.fromMillisecondsSinceEpoch(0);

const List<String> _composerEmoji = ['😊', '❤️', '😂', '👍', '🙏', '😘', '🥰', '🎉'];

/// `<ConversationScreen kind target title avatar subtitle onBack onDetails canModerate readOnly />`. Keyed by
/// kind, target and the signed-in user, so an account switch starts a fresh conversation.
class ConversationScreen extends ConsumerWidget {
  const ConversationScreen({
    super.key,
    required this.kind,
    required this.target,
    required this.title,
    this.avatar,
    this.subtitle,
    required this.onBack,
    this.onDetails,
    this.canModerate = false,
    this.readOnly = false,
  });
  final ChatKind kind;
  final String target;
  final String title;
  final String? avatar;
  final String? subtitle;
  final VoidCallback onBack;
  final VoidCallback? onDetails;
  final bool canModerate;
  final bool readOnly;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(authUserProvider)?.id;
    return _Conversation(key: ValueKey('${kind.name}:$target:$userId'), screen: this);
  }
}

class _Conversation extends ConsumerStatefulWidget {
  const _Conversation({super.key, required this.screen});
  final ConversationScreen screen;
  @override
  ConsumerState<_Conversation> createState() => _ConversationState();
}

class _ConversationState extends ConsumerState<_Conversation> {
  ConversationScreen get w => widget.screen;
  late final ChatScope _scope = ChatScope(w.kind, w.target);

  final TextEditingController _text = TextEditingController();
  final FocusNode _input = FocusNode();
  final ScrollController _scroller = ScrollController();
  final OverlayPortalController _portal = OverlayPortalController();
  final LayerLink _menuLink = LayerLink();
  final Map<String, GlobalKey> _messageKeys = {};

  ChatMessage? _reply, _editing;
  ChatAttachment? _attachment;
  String? _attachmentUrl, _actionsFor, _profile;
  ({String id, String url})? _photo;
  bool _uploading = false, _recording = false, _showAttachments = false, _emojiComposer = false, _stickers = false, _moreReactions = false;
  int _recordedSeconds = 0, _newMessages = 0;

  ChatAbort? _controller;
  bool _alive = true, _atBottom = true;
  String? _lastMessage;
  ChatAudioRecorder? _recorder;
  Timer? _timer;
  DateTime _recordingStarted = DateTime.now();
  ({String fingerprint, String id})? _retry;
  ChatAttachment? _attachmentRef;
  bool _sendAttempted = false;
  VoidCallback? _releaseBack;
  AppLifecycleListener? _lifecycle;
  ProviderSubscription<ChatConversationState>? _messagesSub;

  ChatConversationController get _chat => ref.read(chatConversationProvider(_scope).notifier);
  ChatBackend get _backend => ref.read(chatBackendProvider);

  @override
  void initState() {
    super.initState();
    _portal.show();
    _text.addListener(_textChanged);
    _scroller.addListener(_onScroll);
    _releaseBack = ref.read(backDispatcherProvider).push(() {
      if (_photo != null) {
        _setState(() => _photo = null);
      } else if (_profile != null) {
        _setState(() => _profile = null);
      } else if (_actionsFor != null) {
        _closeActions();
      } else {
        _cancelRecording();
        w.onBack();
      }
      return true;
    });
    _lifecycle = AppLifecycleListener(onHide: _cancelRecording, onPause: _cancelRecording);
    _messagesSub = ref.listenManual<ChatConversationState>(chatConversationProvider(_scope), (_, next) => _onMessages(next));
  }

  @override
  void dispose() {
    _alive = false;
    _cancelRecording();
    final pending = _attachmentRef;
    if (pending != null && !_sendAttempted) unawaited(discardChatAttachment(_backend, pending.path));
    _releaseBack?.call();
    _lifecycle?.dispose();
    _messagesSub?.close();
    _text.dispose();
    _input.dispose();
    _scroller.dispose();
    super.dispose();
  }

  void _setState(VoidCallback change) {
    if (_alive && mounted) setState(change);
  }

  void _textChanged() => _setState(() {});

  void _onScroll() {
    if (!_scroller.hasClients) return;
    _atBottom = _scroller.offset < 90;
    if (_atBottom && _newMessages != 0) _setState(() => _newMessages = 0);
  }

  void _onMessages(ChatConversationState chat) {
    if (chat.messages.isEmpty) return;
    final latest = chat.messages.last;
    if (latest.id == _lastMessage) return;
    if (_lastMessage == null || _atBottom || latest.senderId == chat.actor) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroller.hasClients) _scroller.jumpTo(0);
      });
    } else {
      _setState(() => _newMessages++);
    }
    _lastMessage = latest.id;
  }

  void _closeActions() => _setState(() {
        _actionsFor = null;
        _moreReactions = false;
      });

  void _reportFailure(Object? error) {
    if (!mounted) return;
    showChatToast(context, ChatToast(title: chatError(error), destructive: true));
  }

  void _toast(ChatToast toast) {
    if (mounted) showChatToast(context, toast);
  }

  // ── recording ──

  void _cleanupRecording() {
    _timer?.cancel();
    _timer = null;
    final recorder = _recorder;
    _recorder = null;
    if (recorder != null) unawaited(recorder.release());
  }

  void _cancelRecording() {
    _controller?.abort();
    _controller = null;
    _cleanupRecording();
    if (_alive && mounted && (_recording || _uploading || _recordedSeconds != 0)) {
      setState(() {
        _recording = false;
        _uploading = false;
        _recordedSeconds = 0;
      });
    }
  }

  bool get _readOnly {
    final status = ref.read(myModerationStatusQuery).data;
    return w.readOnly || _truthy(status?['message']);
  }

  static bool _truthy(Object? value) => value != null && value != false && value != 0 && value != '';

  Future<void> _upload(ChatMediaFile file, ChatMediaType type, {ChatAbort? own, int? durationMs}) async {
    final chat = ref.read(chatConversationProvider(_scope));
    final actor = chat.actor;
    final controller = own ?? ChatAbort();
    if (actor == null || _uploading || chat.sending || _readOnly) return;
    _controller = controller;
    _setState(() {
      _uploading = true;
      _showAttachments = false;
    });
    try {
      final result = await uploadChatMedia(_backend, actor, w.kind, w.target, file, type, signal: controller);
      if (result == null || !_alive || controller.aborted) return;
      final uploaded = result.withDuration(durationMs);
      _attachmentRef = uploaded;
      _sendAttempted = false;
      _setState(() => _attachment = uploaded);
      final url = await resolveChatMedia(_backend, ref.read(chatBackendUrlProvider), ChatMessage({
        'id': 'preview', 'sender_id': actor, 'created_at': '', 'message_type': type.name, 'content': '', //
        'media_path': result.path, 'media_mime': result.mime,
      }));
      if (_alive && !controller.aborted) _setState(() => _attachmentUrl = url);
    } catch (error) {
      if (!controller.aborted && _alive) _reportFailure(error);
    } finally {
      if (identical(_controller, controller)) _controller = null;
      if (_alive && !controller.aborted) _setState(() => _uploading = false);
    }
  }

  Future<void> _beginRecording() async {
    final chat = ref.read(chatConversationProvider(_scope));
    if (_controller != null || _uploading || _attachment != null || chat.sending || _readOnly) return;
    final own = ChatAbort();
    _controller = own;
    var captured = false;
    final recorder = ref.read(chatAudioRecorderProvider)();
    try {
      await recorder.open();
      captured = true;
      if (own.aborted || !_alive) {
        unawaited(recorder.release());
        return;
      }
      _recorder = recorder;
      await recorder.start();
      _recordingStarted = DateTime.now();
      _setState(() {
        _recording = true;
        _recordedSeconds = 0;
      });
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        final elapsed = DateTime.now().difference(_recordingStarted).inSeconds;
        _setState(() => _recordedSeconds = elapsed);
        if (elapsed >= 180 && identical(_recorder, recorder)) unawaited(_stopRecording());
      });
    } catch (error) {
      if (!own.aborted) {
        if (!identical(_recorder, recorder)) unawaited(recorder.release());
        _cancelRecording();
        _toast(getAudioErrorToast(error, source: captured ? 'audio' : 'microphone'));
      }
    }
  }

  Future<void> _stopRecording() async {
    final recorder = _recorder, own = _controller;
    if (recorder == null || own == null) return;
    try {
      _timer?.cancel();
      _timer = null;
      final recorded = await recorder.stop();
      if (own.aborted) return;
      final elapsed = DateTime.now().difference(_recordingStarted).inMilliseconds;
      final durationMs = elapsed < 180000 ? elapsed : 180000;
      final file = recorded ?? ChatMediaFile(Uint8List(0), '');
      _cleanupRecording();
      _setState(() => _recording = false);
      unawaited(_upload(file, ChatMediaType.audio, own: own, durationMs: durationMs));
    } catch (error) {
      _cancelRecording();
      _toast(getAudioErrorToast(error, source: 'audio'));
    }
  }

  // ── sending ──

  Future<void> _send() async {
    final chat = ref.read(chatConversationProvider(_scope));
    final editing = _editing;
    if (editing != null) {
      final content = _text.text.trim();
      if (content.isEmpty || chat.editing) return;
      try {
        await _chat.edit(editing, content);
        if (_alive) {
          _setState(() => _editing = null);
          _text.clear();
        }
      } catch (error) {
        if (_alive) _reportFailure(error);
      }
      return;
    }
    final text = _text.text.trim();
    if (_uploading || chat.sending || _readOnly || (text.isEmpty && _attachment == null)) return;
    final attachment = _attachment;
    final replyTo = _reply?.id;
    final fingerprint = jsonEncode({'text': text, 'attachment': attachment?.toJson(), 'replyTo': replyTo});
    final previous = _retry;
    final attempt = previous != null && previous.fingerprint == fingerprint ? previous : (fingerprint: fingerprint, id: newClientId());
    _retry = attempt;
    _sendAttempted = true;
    try {
      await _chat.send(id: attempt.id, text: text, attachment: attachment, replyTo: replyTo);
      if (!_alive) return;
      _text.clear();
      _setState(() {
        _reply = null;
        _attachment = null;
        _attachmentUrl = null;
      });
      _attachmentRef = null;
      _retry = null;
      _atBottom = true;
      _input.requestFocus();
    } catch (error) {
      if (_alive) _reportFailure(error);
    }
  }

  Future<void> _sendSticker(String id) async {
    final chat = ref.read(chatConversationProvider(_scope));
    if (_uploading || chat.sending || _readOnly || _editing != null) return;
    try {
      await _chat.send(id: newClientId(), text: stickerMessage(id), replyTo: _reply?.id);
      if (!_alive) return;
      _setState(() {
        _reply = null;
        _stickers = false;
      });
      _atBottom = true;
    } catch (error) {
      if (_alive) _reportFailure(error);
    }
  }

  Future<String?> _renew(ChatMessage message) => _chat.renewMedia(message);

  void _selectEmoji(String emoji) {
    final value = _text.value;
    final start = value.selection.isValid ? value.selection.start : value.text.length;
    final end = value.selection.isValid ? value.selection.end : start;
    final next = value.text.replaceRange(start, end, emoji);
    _text.value = TextEditingValue(text: next, selection: TextSelection.collapsed(offset: start + emoji.length));
    _input.requestFocus();
  }

  Future<void> _pick(ChatMediaType type) async {
    final picker = ref.read(chatMediaPickerProvider);
    ChatMediaFile? file;
    try {
      file = type == ChatMediaType.image ? await picker.pickImage() : await picker.pickVideo();
    } catch (error) {
      _reportFailure(error);
      return;
    }
    if (file != null) unawaited(_upload(file, type));
  }

  void _scrollToMessage(String id) {
    final target = _messageKeys[id]?.currentContext;
    if (target != null) unawaited(Scrollable.ensureVisible(target, alignment: 0.5, duration: const Duration(milliseconds: 300)));
  }

  // ── build ──

  @override
  Widget build(BuildContext context) {
    ref.listen(myModerationStatusQuery, (_, next) {
      if (w.readOnly || _truthy(next.data?['message'])) _cancelRecording();
    });
    return FullScreenChatLease(
      child: OverlayPortal(
        controller: _portal,
        overlayChildBuilder: (context) => _section(context),
        child: const SizedBox.shrink(),
      ),
    );
  }

  Widget _section(BuildContext context) {
    final a = context.a;
    final insets = MediaQuery.viewInsetsOf(context);
    final photo = _photo;
    Widget content;
    final profile = _profile;
    if (profile != null) {
      final builder = ref.watch(featureRegistryProvider).overlay(ShellOverlayId.userProfile);
      final args = ShellOverlayArgs(onClose: () => _setState(() => _profile = null), userId: profile);
      // The chat overlay is full screen; only its own top bar had the status-bar inset.
      content = Padding(
        padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
        child: builder != null ? builder(context, args) : ShellPlaceholder(kind: 'overlay', id: 'userProfile:$profile', onBack: args.onClose),
      );
    } else {
      content = _conversation(context);
    }
    return Semantics(
      label: w.title,
      container: true,
      explicitChildNodes: true,
      child: AScope(
        child: Material(
          type: MaterialType.transparency,
          child: Container(
            color: a.bg,
            padding: EdgeInsets.only(bottom: insets.bottom),
            child: Stack(children: [
              Positioned.fill(child: content),
              if (photo != null) Positioned.fill(child: ref.watch(chatPhotoViewerProvider)(context, photo.url, () => _setState(() => _photo = null))),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _conversation(BuildContext context) {
    final chat = ref.watch(chatConversationProvider(_scope));
    final status = ref.watch(myModerationStatusQuery).data;
    final restricted = _truthy(status?['message']);
    final readOnly = w.readOnly || restricted;
    final active = _actionsFor;
    ChatMessage? activeMessage;
    if (active != null) {
      for (final m in chat.messages) {
        if (m.id == active) activeMessage = m;
      }
    }
    return Stack(children: [
      Positioned.fill(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _topbar(context),
          Expanded(child: _history(context, chat)),
          if (_newMessages > 0)
            ChatNotice(
              onTap: () {
                if (_scroller.hasClients) _scroller.jumpTo(0);
                _setState(() => _newMessages = 0);
              },
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                AIcon(AIcons.chevronDown, size: 15, color: context.a.inkSoft),
                const SizedBox(width: 4),
                Text('${groupTr('chat_new_messages', 'Yeni mesajlar')} · $_newMessages'),
              ]),
            ),
          readOnly ? _readOnlyFooter(context, restricted) : _composer(context, chat),
        ]),
      ),
      if (activeMessage != null && activeMessage.deletedAt == null) ...[
        // .chat-menu-backdrop: rgba(43, 29, 27, 0.18) over the whole chat screen
        Positioned.fill(
          child: GestureDetector(
            key: const ValueKey('chat-menu-backdrop'),
            behavior: HitTestBehavior.opaque,
            onTap: _closeActions,
            child: const ColoredBox(color: Color(0x2E2B1D1B)),
          ),
        ),
        CompositedTransformFollower(
          link: _menuLink,
          showWhenUnlinked: false,
          targetAnchor: _menuAnchor(context, activeMessage.senderId == chat.actor),
          followerAnchor: _menuAnchor(context, activeMessage.senderId == chat.actor),
          child: Align(
            alignment: _menuAnchor(context, activeMessage.senderId == chat.actor),
            child: _menu(context, chat, activeMessage),
          ),
        ),
      ],
    ]);
  }

  Alignment _menuAnchor(BuildContext context, bool own) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return (own != rtl) ? Alignment.topRight : Alignment.topLeft;
  }

  Widget _topbar(BuildContext context) {
    final a = context.a;
    final top = MediaQuery.paddingOf(context).top;
    final isGroup = w.kind == ChatKind.group;
    return Container(
      padding: EdgeInsets.fromLTRB(16, top + 10, 16, 12),
      decoration: BoxDecoration(color: a.navBg, border: Border(bottom: BorderSide(color: a.line))),
      child: Row(children: [
        ChatIconButton(
          icon: AIcons.arrowLeft,
          label: tr('common_geri', 'Geri'),
          onTap: () {
            _cancelRecording();
            w.onBack();
          },
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Semantics(
            container: true,
            button: true,
            label: groupTr('chat_view_profile', 'Profilə bax'),
            excludeSemantics: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => isGroup ? w.onDetails?.call() : _setState(() => _profile = w.target),
              child: Row(children: [
                ChatAvatar(size: 40, url: w.avatar, fallback: Text(charAt0(w.title).isNotEmpty ? charAt0(w.title) : '💬')),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(w.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(15, weight: FontWeight.w700, color: a.ink)),
                    const SizedBox(height: 2),
                    Text(w.subtitle != null && w.subtitle!.isNotEmpty ? w.subtitle! : groupTr('chat_profile_hint', 'Profilə baxmaq üçün toxunun'),
                        style: px(11, color: a.inkSoft)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        if (isGroup) ...[
          const SizedBox(width: 12),
          ChatIconButton(icon: AIcons.ellipsis, label: groupTr('chat_group_details', 'Qrup məlumatları'), onTap: w.onDetails),
        ],
      ]),
    );
  }

  Widget _history(BuildContext context, ChatConversationState chat) {
    final a = context.a;
    final column = reactionColumn(w.kind);
    final reactionsByMessage = <String, List<ChatReaction>>{};
    for (final reaction in chat.reactions) {
      final id = reaction.messageId(column);
      if (id == null || id.isEmpty) continue;
      (reactionsByMessage[id] ??= []).add(reaction);
    }
    final items = <Widget>[
      if (chat.hasOlder)
        ChatNotice(
          enabled: !chat.loadingOlder,
          onTap: () => unawaited(_chat.loadOlder()),
          child: Text(chat.loadingOlder ? '…' : groupTr('chat_older', 'Əvvəlki mesajları göstər')),
        ),
      if (chat.loading)
        const ChatEmpty(children: [ALoader(size: 24)])
      else if (chat.error != null)
        ChatEmpty(alert: true, children: [
          Text(chatError(chat.error)),
          GestureDetector(onTap: () => unawaited(_chat.refetch()), child: Text(groupTr('chat_retry', 'Yenidən cəhd et'))),
        ])
      else if (chat.messages.isEmpty)
        ChatEmpty(children: [
          ChatAvatar(size: 64, url: w.avatar, fallback: Text(charAt0(w.title))),
          Text(w.title, style: px(13, weight: FontWeight.w700, color: a.inkSoft)),
          Text(groupTr('chat_empty', 'İlk mesajı göndərin. Söhbət buradan başlayır.')),
        ]),
      for (var i = 0; i < chat.messages.length; i++) _message(context, chat, i, reactionsByMessage[chat.messages[i].id] ?? const []),
    ];
    return ListView.builder(
      controller: _scroller,
      reverse: true,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
      itemCount: items.length,
      itemBuilder: (context, index) => Center(
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 760), child: items[items.length - 1 - index]),
      ),
    );
  }

  Widget _message(BuildContext context, ChatConversationState chat, int index, List<ChatReaction> reactions) {
    final a = context.a;
    final message = chat.messages[index];
    final own = message.senderId == chat.actor;
    final quoted = message.replyToId != null ? chat.allMessages[message.replyToId] : null;
    final deleted = message.deletedAt != null && message.deletedAt!.isNotEmpty;
    final author = chat.authors[message.senderId];
    final url = chat.media[message.id];
    final created = _date(message.createdAt);
    final previous = index > 0 ? chat.messages[index - 1] : null;
    final showDate = previous == null || !_sameDay(_date(previous.createdAt), created);
    final grouped = <String>[];
    for (final r in reactions) {
      if (!grouped.contains(r.emoji)) grouped.add(r.emoji);
    }
    final isGroup = w.kind == ChatKind.group;
    final sticker = message.messageType == 'text' ? stickerFromMessage(message.content) : null;
    final mediaType = ChatMediaType.tryParse(message.messageType);
    final textStyle = px(14, color: a.ink, height: 1.55);
    final textBuilder = ref.watch(chatTextBuilderProvider);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final r18 = const Radius.circular(18), r5 = const Radius.circular(5);
    final ownShape = !rtl;
    BorderRadius radius(bool own) => (own == ownShape)
        ? BorderRadius.only(topLeft: r18, topRight: r18, bottomLeft: r18, bottomRight: r5)
        : BorderRadius.only(topLeft: r18, topRight: r18, bottomLeft: r5, bottomRight: r18);

    Widget authorAvatar() => Semantics(
          container: true,
          button: true,
          label: groupTr('chat_view_profile', 'Profilə bax'),
          excludeSemantics: true,
          child: GestureDetector(
            onTap: () => _setState(() => _profile = message.senderId),
            child: ChatAvatar(
              size: 28,
              url: author?['avatar_url'] as String?,
              fallback: Text(charAt0(author?['name'] as String?).isNotEmpty ? charAt0(author?['name'] as String?) : '•', style: px(11)),
            ),
          ),
        );

    Widget bubble;
    if (deleted) {
      bubble = Opacity(
        opacity: 0.7,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 9, 12, 6),
          decoration: BoxDecoration(
            color: own ? a.peach1 : a.surface,
            border: Border.all(color: own ? const Color(0x00000000) : a.line),
            borderRadius: radius(own),
          ),
          child: Text(chatFeature37Text('chat_deleted'), style: textStyle.copyWith(fontStyle: FontStyle.italic)),
        ),
      );
    } else {
      final body = <Widget>[
        if (isGroup && !own)
          GestureDetector(
            onTap: () => _setState(() => _profile = message.senderId),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                (author?['name'] as String?)?.isNotEmpty == true ? author!['name'] as String : groupTr('chat_member', 'Üzv'),
                style: px(11, weight: FontWeight.w700, color: a.accentInk),
              ),
            ),
          ),
        if (quoted != null)
          GestureDetector(
            onTap: () => _scrollToMessage(quoted.id),
            child: _ReplyPreview(
              title: quoted.senderId == chat.actor
                  ? groupTr('chat_you', 'Siz')
                  : ((chat.authors[quoted.senderId]?['name'] as String?)?.isNotEmpty == true ? chat.authors[quoted.senderId]!['name'] as String : w.title),
              text: chatPreview(quoted.messageType, quoted.content),
            ),
          ),
        if (mediaType != null)
          url != null
              ? ChatMediaAttachment(
                  src: url,
                  type: mediaType,
                  own: own,
                  onRenew: () => _renew(message),
                  onPhoto: (source) => _setState(() => _photo = (id: message.id, url: source)),
                )
              : ChatNotice(onTap: () => _renew(message).catchError((Object e) { _reportFailure(e); return null; }), child: Text(groupTr('chat_load_media', 'Faylı yüklə')))
        else if (sticker != null)
          StickerImage(id: sticker, size: 140)
        else
          textBuilder(context, message.messageType == 'love' ? '❤️' : message.content ?? '', textStyle),
        if ((message.mediaPath?.isNotEmpty ?? false) && (message.content?.isNotEmpty ?? false))
          Padding(padding: const EdgeInsets.only(top: 4), child: textBuilder(context, message.content!, textStyle)),
        Padding(
          padding: const EdgeInsets.only(top: 3),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 14),
            child: DefaultTextStyle.merge(
              style: px(9, color: a.inkSoft),
              child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.end, children: [
                if (message.editedAt != null && message.editedAt!.isNotEmpty) ...[
                  Opacity(opacity: 0.75, child: Text(chatFeature37Text('chat_edited'), style: px(10.5, color: a.inkSoft).copyWith(fontStyle: FontStyle.italic))),
                  const SizedBox(width: 8),
                ],
                Text(localeTimeHm(created)),
                if (own && !isGroup) ...[
                  const SizedBox(width: 4),
                  // text-sky-600 (Tailwind) for the read ticks
                  message.isRead ? const AIcon(AIcons.checkCheck, size: 13, color: Color(0xFF0284C7)) : AIcon(AIcons.check, size: 12, color: a.inkSoft),
                ],
                const SizedBox(width: 4),
                ChatIconButton(
                  icon: AIcons.ellipsis,
                  small: true,
                  label: groupTr('chat_message_actions', 'Mesaj seçimləri'),
                  onTap: () => _setState(() {
                    _actionsFor = _actionsFor == message.id ? null : message.id;
                    if (_actionsFor == null) _moreReactions = false;
                  }),
                ),
              ]),
            ),
          ),
        ),
      ];
      bubble = GestureDetector(
        onLongPress: () => _setState(() => _actionsFor = message.id),
        child: Container(
          padding: sticker != null ? EdgeInsets.zero : const EdgeInsets.fromLTRB(12, 9, 12, 6),
          decoration: sticker != null
              ? null
              : BoxDecoration(
                  color: own ? a.peach1 : a.surface,
                  border: Border.all(color: own ? const Color(0x00000000) : a.line),
                  borderRadius: radius(own),
                  // 0 2px 5px rgb(0 0 0 / 2%)
                  boxShadow: const [BoxShadow(color: Color(0x05000000), offset: Offset(0, 2), blurRadius: 5)],
                ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: body),
        ),
      );
    }

    final stack = Column(crossAxisAlignment: own ? CrossAxisAlignment.end : CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      IntrinsicWidth(child: bubble),
      if (grouped.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Wrap(spacing: 3, runSpacing: 3, children: [
            for (final emoji in grouped)
              () {
                final selected = reactions.any((r) => r.userId == chat.actor && r.emoji == emoji);
                final count = reactions.where((r) => r.emoji == emoji).length;
                return Semantics(
                  container: true,
                  button: true,
                  enabled: !chat.reacting,
                  selected: selected,
                  child: GestureDetector(
                    onTap: chat.reacting ? null : () => _chat.react(message.id, selected ? null : emoji).catchError(_reportFailure),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: selected ? a.peach1 : a.surface,
                        border: Border.all(color: selected ? a.peach2 : a.line),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text('$emoji $count', style: px(12, color: a.ink)),
                    ),
                  ),
                );
              }(),
          ]),
        ),
      if (_actionsFor == message.id && !deleted)
        // Reserves the inline space of the menu; the visible copy is drawn above the backdrop (CompositedTransform).
        CompositedTransformTarget(
          link: _menuLink,
          child: IgnorePointer(child: ExcludeSemantics(child: Opacity(opacity: 0, child: _menu(context, chat, message)))),
        ),
    ]);

    return KeyedSubtree(
      key: _messageKeys.putIfAbsent(message.id, GlobalKey.new),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (showDate)
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 18),
            child: Text(chatDayLabel(created), textAlign: TextAlign.center, style: px(10, weight: FontWeight.w600, color: a.inkSoft)),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            mainAxisAlignment: own ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (isGroup && !own) ...[authorAvatar(), const SizedBox(width: 7)],
              Flexible(
                child: LayoutBuilder(builder: (context, constraints) {
                  final rowWidth = constraints.maxWidth + (isGroup && !own ? 35 : 0);
                  final max = rowWidth * 0.84 < 440 ? rowWidth * 0.84 : 440.0;
                  return ConstrainedBox(constraints: BoxConstraints(maxWidth: max), child: stack);
                }),
              ),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _menu(BuildContext context, ChatConversationState chat, ChatMessage message) {
    final a = context.a;
    final own = message.senderId == chat.actor;
    final reactions = chat.reactions.where((r) => r.messageId(reactionColumn(w.kind)) == message.id).toList();
    final sticker = stickerFromMessage(message.content);
    final emojis = _moreReactions ? [...kChatReactions, ...kChatMoreReactions] : kChatReactions.take(6).toList();
    final hasContent = message.content != null && message.content!.isNotEmpty;

    Widget action(AIconData icon, String label, VoidCallback? onTap, {bool danger = false, bool enabled = true, bool first = false}) {
      final color = danger ? a.bad : a.ink;
      return Semantics(
        container: true,
        button: true,
        enabled: enabled,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: enabled ? onTap : null,
          child: Opacity(
            opacity: enabled ? 1 : 0.5,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
              child: Row(children: [
                AIcon(icon, size: 17, color: color),
                const SizedBox(width: 10),
                Expanded(child: Text(label, style: px(14, weight: FontWeight.w600, color: color, height: 1.3))),
              ]),
            ),
          ),
        ),
      );
    }

    final actions = <Widget>[
      action(AIcons.reply, groupTr('chat_reply', 'Cavab ver'), () {
        _setState(() {
          _reply = message;
          _actionsFor = null;
          _moreReactions = false;
        });
        _input.requestFocus();
      }, first: true),
      if (own && message.messageType == 'text' && hasContent && sticker == null)
        action(AIcons.pencil, chatFeature37Text('chat_edit'), () {
          _text.text = message.content ?? '';
          _setState(() {
            _editing = message;
            _reply = null;
            _actionsFor = null;
            _moreReactions = false;
          });
          _input.requestFocus();
        }),
      if (hasContent && message.messageType != 'love' && sticker == null)
        action(AIcons.copy, chatFeature37Text('chat_copy'), () {
          unawaited(Clipboard.setData(ClipboardData(text: message.content ?? '')).then((_) {
            _toast(ChatToast(title: chatFeature37Text('chat_copied')));
          }, onError: (Object _) {}));
          _closeActions();
        }),
      if (own || (w.kind == ChatKind.group && w.canModerate))
        action(AIcons.trash2, chatFeature37Text('chat_delete'), () async {
          if (!await showConfirmDialog(context, chatFeature37Text('chat_delete_confirm'))) return;
          try {
            await _chat.remove(message.id);
            _closeActions();
            if (_reply?.id == message.id) _setState(() => _reply = null);
          } catch (error) {
            _reportFailure(error);
          }
        }, danger: true, enabled: !chat.removing),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: own ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
        Semantics(
          label: groupTr('chat_react', 'Reaksiya ver'),
          container: true,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: a.surface,
                border: Border.all(color: a.line),
                borderRadius: BorderRadius.circular(22),
                boxShadow: a.cardShadow,
              ),
              child: Wrap(spacing: 3, runSpacing: 3, children: [
                for (final emoji in emojis)
                  Semantics(
                    container: true,
                    button: true,
                    enabled: !chat.reacting,
                    label: emoji,
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: chat.reacting
                          ? null
                          : () {
                              final selected = reactions.any((r) => r.userId == chat.actor && r.emoji == emoji);
                              _chat.react(message.id, selected ? null : emoji).then((_) => _closeActions(), onError: _reportFailure);
                            },
                      child: SizedBox(width: 31, height: 31, child: Center(child: Text(emoji, style: const TextStyle(fontSize: 20, height: 1.2)))),
                    ),
                  ),
                if (!_moreReactions)
                  Semantics(
                    container: true,
                    button: true,
                    label: chatFeature37Text('chat_more_reactions'),
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: () => _setState(() => _moreReactions = true),
                      child: Container(
                        width: 31,
                        height: 31,
                        decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: AIcon(AIcons.plus, size: 18, color: a.inkSoft),
                      ),
                    ),
                  ),
              ]),
            ),
          ),
        ),
        const SizedBox(height: 6),
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 190),
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: a.surface,
              border: Border.all(color: a.line),
              borderRadius: BorderRadius.circular(16),
              boxShadow: a.cardShadow,
            ),
            child: IntrinsicWidth(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: actions)),
          ),
        ),
      ]),
    );
  }

  Widget _readOnlyFooter(BuildContext context, bool restricted) {
    final a = context.a;
    return Container(
      padding: EdgeInsets.fromLTRB(12, 8, 12, 9 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: a.surface, border: Border(top: BorderSide(color: a.line))),
      child: ChatNotice(child: restricted ? ref.watch(chatRestrictionNoteProvider)(context) : Text(groupTr('group_admins_only'))),
    );
  }

  Widget _composer(BuildContext context, ChatConversationState chat) {
    final a = context.a;
    final editing = _editing, reply = _reply, attachment = _attachment;
    final hasText = _text.text.trim().isNotEmpty;
    final sendBusy = _uploading || chat.sending;
    Widget sendButton({required String label, required Widget child, required VoidCallback? onTap, required bool enabled}) => Semantics(
          container: true,
          button: true,
          enabled: enabled,
          label: label,
          excludeSemantics: true,
          child: GestureDetector(
            onTap: enabled ? onTap : null,
            child: Opacity(
              opacity: enabled ? 1 : 0.35,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: a.ink, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: IconTheme.merge(data: IconThemeData(color: a.bg), child: child),
              ),
            ),
          ),
        );

    final children = <Widget>[
      if (editing != null)
        Row(children: [
          Expanded(child: _ReplyPreview(title: chatFeature37Text('chat_editing'), text: chatPreview(editing.messageType, editing.content))),
          const SizedBox(width: 8),
          ChatIconButton(
            icon: AIcons.x,
            label: groupTr('common_legv_et', 'Ləğv et'),
            onTap: () {
              _text.clear();
              _setState(() => _editing = null);
            },
          ),
        ]),
      if (reply != null)
        Row(children: [
          Expanded(
            child: _ReplyPreview(
              title: '${groupTr('chat_reply', 'Cavab ver')} · ${reply.senderId == chat.actor ? groupTr('chat_you', 'Siz') : ((chat.authors[reply.senderId]?['name'] as String?)?.isNotEmpty == true ? chat.authors[reply.senderId]!['name'] as String : w.title)}',
              text: chatPreview(reply.messageType, reply.content),
            ),
          ),
          const SizedBox(width: 8),
          ChatIconButton(icon: AIcons.x, label: groupTr('chat_cancel_reply', 'Cavabı ləğv et'), onTap: () => _setState(() => _reply = null)),
        ]),
      if (attachment != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            Expanded(
              child: attachment.type == ChatMediaType.audio && _attachmentUrl != null
                  ? VoiceMessage(src: _attachmentUrl!)
                  : ChatNotice(
                      textAlign: TextAlign.start,
                      child: Text('${chatPreview(attachment.type.name, '')} · ${groupTr('chat_ready_to_send', 'Göndərməyə hazırdır')}'),
                    ),
            ),
            const SizedBox(width: 8),
            ChatIconButton(
              icon: AIcons.x,
              label: groupTr('chat_remove_attachment', 'Faylı sil'),
              onTap: () {
                final pending = _attachmentRef;
                if (pending != null && !_sendAttempted) unawaited(discardChatAttachment(_backend, pending.path));
                _attachmentRef = null;
                _setState(() {
                  _attachment = null;
                  _attachmentUrl = null;
                });
              },
            ),
          ]),
        ),
      if (_showAttachments)
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 7, 4, 12),
          child: Row(children: [
            _AttachmentOption(icon: AIcons.imagePlus, label: groupTr('chat_image', 'Şəkil'), onTap: () => unawaited(_pick(ChatMediaType.image))),
            const SizedBox(width: 10),
            _AttachmentOption(icon: AIcons.video, label: groupTr('chat_video', 'Video'), onTap: () => unawaited(_pick(ChatMediaType.video))),
          ]),
        ),
      if (_stickers)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: StickerPicker(onPick: (id) => unawaited(_sendSticker(id)), onClose: () => _setState(() => _stickers = false), disabled: chat.sending),
        ),
      if (_emojiComposer)
        Container(
          margin: const EdgeInsets.symmetric(vertical: 5),
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
          child: Wrap(spacing: 3, runSpacing: 3, children: [
            for (final emoji in _composerEmoji)
              Semantics(
                container: true,
                button: true,
                label: emoji,
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: () => _selectEmoji(emoji),
                  child: SizedBox(width: 31, height: 31, child: Center(child: Text(emoji, style: const TextStyle(fontSize: 20, height: 1.2)))),
                ),
              ),
          ]),
        ),
      if (_recording)
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 42),
          child: Row(children: [
            const _RecordingDot(),
            const SizedBox(width: 12),
            Text('${_recordedSeconds ~/ 60}:${(_recordedSeconds % 60).toString().padLeft(2, '0')}',
                style: px(14, color: a.ink).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            const SizedBox(width: 12),
            Expanded(child: Text(groupTr('chat_recording', 'Səs yazılır…'), style: px(12, color: a.ink))),
            const SizedBox(width: 12),
            ChatIconButton(icon: AIcons.x, label: groupTr('common_legv_et', 'Ləğv et'), onTap: _cancelRecording),
            const SizedBox(width: 12),
            sendButton(
              label: groupTr('chat_stop_recording', 'Səs yazısını bitir'),
              enabled: true,
              onTap: () => unawaited(_stopRecording()),
              child: const AIcon(AIcons.square, size: 16),
            ),
          ]),
        )
      else
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          ChatIconButton(
            icon: AIcons.plus,
            label: groupTr('chat_attach', 'Fayl əlavə et'),
            enabled: !(sendBusy || attachment != null),
            onTap: () => _setState(() => _showAttachments = !_showAttachments),
          ),
          const SizedBox(width: 6),
          Expanded(child: _inputField(context, chat)),
          const SizedBox(width: 6),
          if (editing == null) ...[
            Semantics(
              toggled: _stickers,
              child: ChatIconButton(
                icon: AIcons.sticker,
                label: stickerText('stickers'),
                enabled: !(chat.sending || _uploading || attachment != null),
                onTap: () => _setState(() {
                  _stickers = !_stickers;
                  _emojiComposer = false;
                  _showAttachments = false;
                }),
              ),
            ),
            const SizedBox(width: 6),
          ],
          ChatIconButton(
            icon: AIcons.smile,
            label: groupTr('chat_emoji', 'Emoji'),
            enabled: !chat.sending,
            onTap: () => _setState(() {
              _emojiComposer = !_emojiComposer;
              _stickers = false;
            }),
          ),
          const SizedBox(width: 6),
          if (!hasText && attachment == null && !_uploading && editing == null)
            sendButton(
              label: groupTr('conversationlistscreen_ses_mesaji_acd8d9', '🎤 Səs mesajı'),
              enabled: !chat.sending,
              onTap: () => unawaited(_beginRecording()),
              child: const AIcon(AIcons.mic, size: 20),
            )
          else
            sendButton(
              label: groupTr('directmessagescreen_send', 'Göndər'),
              enabled: !(sendBusy || chat.editing || (!hasText && attachment == null)),
              onTap: () => unawaited(_send()),
              child: sendBusy ? ALoader(size: 19, color: a.bg) : const AIcon(AIcons.send, size: 18),
            ),
        ]),
      if (_uploading)
        Semantics(liveRegion: true, child: ChatNotice(child: Text(groupTr('chat_uploading', 'Fayl yüklənir…')))),
    ];

    return Container(
      padding: EdgeInsets.fromLTRB(12, 8, 12, 9 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: a.surface, border: Border(top: BorderSide(color: a.line))),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
        ),
      ),
    );
  }

  Widget _inputField(BuildContext context, ChatConversationState chat) {
    final a = context.a;
    final style = DefaultTextStyle.of(context).style.merge(px(14, color: a.ink, height: 20 / 14));
    return Container(
      constraints: const BoxConstraints(minHeight: 40, maxHeight: 130),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(21)),
      child: CallbackShortcuts(
        bindings: {
          const SingleActivator(LogicalKeyboardKey.enter): () => unawaited(_send()),
        },
        child: TextField(
          key: const ValueKey('chat-text-input'),
          controller: _text,
          focusNode: _input,
          enabled: !chat.sending,
          minLines: 1,
          maxLines: null,
          maxLength: 10000,
          maxLengthEnforcement: MaxLengthEnforcement.enforced,
          keyboardType: TextInputType.multiline,
          textInputAction: TextInputAction.send,
          onSubmitted: (_) => unawaited(_send()),
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(
            isCollapsed: true,
            border: InputBorder.none,
            counterText: '',
            hintText: tr('directmessagescreen_mesaj_yazin_e69f84', 'Mesaj yazın…'),
            hintStyle: style.copyWith(color: a.inkFaint),
          ),
        ),
      ),
    );
  }
}

/// `.chat-reply-preview` (3px `--a-peach-2` start border, 6/9 padding, radius 7, rgb(0 0 0 / 3%)).
class _ReplyPreview extends StatelessWidget {
  const _ReplyPreview({required this.title, required this.text});
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(color: const Color(0x08000000), borderRadius: BorderRadius.circular(7)),
      clipBehavior: Clip.antiAlias,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: a.peach2, width: 3))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: px(11, weight: FontWeight.w700, color: a.accentInk)),
          Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(11, color: a.inkSoft)),
        ]),
      ),
    );
  }
}

/// `.chat-attachment-options button` (radius 14, surface-soft, 9/12, 12px, gap 7).
class _AttachmentOption extends StatelessWidget {
  const _AttachmentOption({required this.icon, required this.label, required this.onTap});
  final AIconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      container: true,
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(icon, size: 18, color: a.ink),
            const SizedBox(width: 7),
            Text(label, style: px(12, color: a.ink)),
          ]),
        ),
      ),
    );
  }
}

/// `.chat-recording-dot` (9 px, #df536d, `chat-pulse` 1 s; static under reduced motion).
class _RecordingDot extends StatefulWidget {
  const _RecordingDot();
  @override
  State<_RecordingDot> createState() => _RecordingDotState();
}

class _RecordingDotState extends State<_RecordingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      unawaited(_c.repeat());
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          // keyframes chat-pulse { 50% { opacity: .35 } }, ease-in-out
          final opacity = 1 - 0.65 * Curves.easeInOut.transform(t < 0.5 ? t * 2 : (1 - t) * 2);
          return Opacity(
            opacity: opacity,
            child: Container(width: 9, height: 9, decoration: const BoxDecoration(color: Color(0xFFDF536D), shape: BoxShape.circle)),
          );
        },
      );
}
