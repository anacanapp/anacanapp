// Ported from: src/components/AIChatScreen.tsx, src/styles/anacan-design.css (.a-chat-header*, .a-chat-status-dot,
//              .a-chat-warn*, .a-chat-msg-row, .a-chat-avatar, .a-chat-bubble*, .a-chat-time, .a-chat-suggest-*,
//              .a-chat-input, .a-chat-send, .a-icon-btn)
//
// Anacan.AI (woman) / Ata AI (partner) chat: restored history or the welcome message, the streamed answer with
// Stop, photo questions, copy, suggested questions, the medical warning banner and the "jump to latest" button.
// The shell gives this tab the viewport height minus the nav clearance (`fillsViewport`).
import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/i18n/tr.dart';
import '../../core/offline/connectivity.dart' show onlineStatusProvider;
import '../../design/design.dart';
import '../../domain/dates/local_date.dart' show storedDateKey;
import '../../domain/health/emergency.dart' show fillEmergencyNumber;
import '../../shell/widgets/bottom_nav_capsule.dart' show kPbNav;
import '../../state/persisted_store.dart' show localStoreProvider;
import '../../state/user_store.dart';
import '../baby/locale_format.dart' show localeTimeHm;
import '../home/data/pregnancy_content.dart';
import '../legal/content/content_typography.dart' show ContentVariant;
import '../legal/content/markdown_content.dart';
import '../legal/medical_disclaimer.dart' show emergencyNumberProvider;
import 'ai_chat_history.dart';
import 'ai_chat_inputs.dart';
import 'ai_chat_logic.dart';
import 'ai_chat_session.dart';
import 'chat_media.dart';
import 'copy/ai_copy.dart';

const String kAiWarnDismissedKey = 'anacan_ai_warn_dismissed';
const int _maxImageBytes = 15 * 1024 * 1024;
const Color _white = Color(0xFFFFFFFF);

class AIChatScreen extends ConsumerStatefulWidget {
  const AIChatScreen({super.key, this.partner});

  /// Ata AI: the woman's context for the partner persona.
  final AiPartnerContext? partner;

  @override
  ConsumerState<AIChatScreen> createState() => _AIChatScreenState();
}

class _AIChatScreenState extends ConsumerState<AIChatScreen> implements AiChatSessionUi {
  late final AiChatHistory _history;
  late final AiChatSession _session;
  final TextEditingController _input = TextEditingController();
  final FocusNode _focus = FocusNode();
  final ScrollController _scroll = ScrollController();
  bool _pinned = true;
  bool _showJumpDown = false;
  bool _warnExpanded = false;
  late bool _warnVisible;
  AiPickedImage? _attached;
  String? _copiedId;
  Timer? _copiedTimer;

  AiPartnerContext? get _partner => widget.partner;

  @override
  void initState() {
    super.initState();
    _warnVisible = ref.read(localStoreProvider).getItem(kAiWarnDismissedKey) == null;
    final userId = ref.read(authUserProvider)?.id;
    _history = AiChatHistory(ref.read(aiChatHistoryStoreProvider), userId: userId, chatType: _partner != null ? 'partner' : 'woman');
    _session = AiChatSession(
      AiChatSessionDeps(
        history: _history,
        consume: ref.read(aiChatConsumeProvider),
        accessToken: ref.read(aiChatAccessTokenProvider),
        backend: () => ref.read(aiChatBackendProvider),
        client: ref.read(aiChatHttpClientProvider),
        upload: ref.read(aiChatUploadProvider),
        buildBody: _buildBody,
        userId: userId,
      ),
      this,
    )..addListener(_onSession);
    _input.addListener(() => setState(() {}));
    _focus.addListener(_onFocus);
    _scroll.addListener(_onScroll);
    final prompt = ref.read(aiChatPendingPromptProvider);
    if (prompt != null) {
      _input.text = prompt;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(aiChatPendingPromptProvider.notifier).take();
      });
    }
    unawaited(_history.load().then((_) {
      if (!mounted || userId == null) return;
      _session.initialize(_history.messages, _welcome());
      _scrollToBottomSoon();
    }));
  }

  @override
  void dispose() {
    _copiedTimer?.cancel();
    _session
      ..removeListener(_onSession)
      ..dispose();
    _input.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // ── session UI ──
  @override
  void showPremium() {
    if (mounted) unawaited(ref.read(aiPremiumModalProvider)(context));
  }

  @override
  void toast({required String title, String? description, bool destructive = false}) {
    if (mounted) AToastHost.of(context).show(title: title, description: description, destructive: destructive);
  }

  @override
  void pinToBottom() {
    _pinned = true;
    if (_showJumpDown) setState(() => _showJumpDown = false);
    _scrollToBottomSoon();
  }

  @override
  void clearInput() => _input.clear();

  @override
  void clearAttachedImage() {
    if (mounted) setState(() => _attached = null);
  }

  void _onSession() {
    if (!mounted) return;
    setState(() {});
    // Streaming: while pinned, stay at the bottom on every update.
    if (_pinned) _scrollToBottomSoon();
  }

  void _scrollToBottomSoon({bool smooth = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      final max = _scroll.position.maxScrollExtent;
      if (smooth) {
        unawaited(_scroll.animateTo(max, duration: const Duration(milliseconds: 300), curve: Curves.easeOut));
      } else {
        _scroll.jumpTo(max);
      }
    });
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final p = _scroll.position;
    final pinned = p.maxScrollExtent - p.pixels < 90;
    _pinned = pinned;
    if (_showJumpDown == pinned) setState(() => _showJumpDown = !pinned);
  }

  void _onFocus() {
    if (!_focus.hasFocus) return;
    // Keyboard opened: stay at the bottom when pinned.
    Timer(const Duration(milliseconds: 250), () {
      if (mounted && _pinned) _scrollToBottomSoon();
    });
  }

  // ── data ──
  String _welcome() {
    final user = ref.read(userStoreProvider);
    final partner = _partner;
    final lifeStage = partner != null ? partner.lifeStage : user.lifeStage;
    final preg = lifeStage == 'bump' ? user.getPregnancyData() : null;
    String? fruit;
    if (preg != null) {
      final day = PregnancyDayNavigation.of(partner != null ? partner.lastPeriodDate : user.lastPeriodDate).actualCurrentDay;
      final dayContent = ref.read(pregnancyContentByDayQuery(day > 0 ? day : null)).data;
      fruit = getDynamicFruitData(ref.read(fruitImagesQuery).data ?? const [], day, preg.currentWeek, dayContent).fruit;
    }
    final multiples = ref.read(authProfileProvider)?.row['multiples_type'];
    return aiWelcomeMessage(
      name: user.name,
      partner: partner != null,
      lifeStage: lifeStage,
      language: user.language.isEmpty ? 'az' : user.language,
      isMultiple: multiples is String && multiples.isNotEmpty && multiples != 'single',
      currentWeek: preg?.currentWeek,
      fruit: fruit,
    );
  }

  Map<String, Object?> _buildBody(List<Map<String, String>> conversation, String? imageBase64) {
    final user = ref.read(userStoreProvider);
    final partner = _partner;
    final profile = ref.read(authProfileProvider)?.row;
    final multiples = profile?['multiples_type'];
    final babyCount = profile?['baby_count'];
    return buildDrAnacanBody(
      conversation: conversation,
      lifeStage: partner != null ? partner.lifeStage : user.lifeStage,
      pregnancyWeek: user.getPregnancyData()?.currentWeek,
      partner: partner,
      language: user.language,
      imageBase64: imageBase64,
      profile: AiProfileInput(
        name: user.name,
        dueDate: storedDateKey(user.dueDate),
        babyName: user.babyName,
        babyBirthDate: storedDateKey(user.babyBirthDate),
        lastPeriodDate: storedDateKey(user.lastPeriodDate),
        cycleLength: user.cycleLength,
        periodLength: user.periodLength,
        multiplesType: multiples is String ? multiples : null,
        babyCount: babyCount is num ? babyCount.toInt() : null,
      ),
      woman: partner != null ? const AiWomanContext() : ref.read(aiWomanContextProvider),
    );
  }

  // ── actions ──
  void _send([String? text]) => unawaited(_session.send(text ?? _input.text, image: _attached));

  Future<void> _clearChat() => _session.clear(_welcome());

  Future<void> _pickImage() async {
    final picked = await ref.read(aiImagePickerProvider)();
    if (picked == null || !mounted) return;
    if (!picked.mimeType.startsWith('image/')) return;
    if (picked.originalBytes > _maxImageBytes) {
      toast(title: tr('aichat_image_too_big', 'Şəkil çox böyükdür (max 15MB)'), destructive: true);
      return;
    }
    setState(() => _attached = picked);
  }

  Future<void> _copy(String id, String content) async {
    try {
      await Clipboard.setData(ClipboardData(text: content));
      if (!mounted) return;
      setState(() => _copiedId = id);
      _copiedTimer?.cancel();
      _copiedTimer = Timer(const Duration(milliseconds: 1600), () {
        if (mounted) setState(() => _copiedId = null);
      });
    } catch (_) {
      toast(title: tr('aichat_copy_failed', 'Kopyalanmadı'), destructive: true);
    }
  }

  void _dismissWarn() {
    setState(() => _warnVisible = false);
    ref.read(localStoreProvider).setItem(kAiWarnDismissedKey, '1');
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final partner = _partner;
    final user = ref.watch(userStoreProvider);
    final lifeStage = partner != null ? partner.lifeStage : user.lifeStage;
    final online = ref.watch(onlineStatusProvider);
    final emergency = ref.watch(emergencyNumberProvider);
    if (partner == null) ref.watch(aiWomanContextProvider);
    // Day content + fruit images for the welcome message (`usePregnancyContentByDay`, `useFruitImages`).
    if (lifeStage == 'bump') {
      final day = PregnancyDayNavigation.of(partner != null ? partner.lastPeriodDate : user.lastPeriodDate).actualCurrentDay;
      ref.watch(pregnancyContentByDayQuery(day > 0 ? day : null));
      ref.watch(fruitImagesQuery);
    }
    final dynamicQuestions = [
      for (final q in ref.watch(aiSuggestedQuestionsQuery((lifeStage ?? 'bump', partner != null ? 'partner' : 'mother'))).data ?? const <Map<String, dynamic>>[])
        if (q['question'] is String) q['question'] as String,
    ];
    final suggested = aiSuggestedQuestions(dynamicQuestions: dynamicQuestions, partner: partner, lifeStage: lifeStage);
    final cardBuilder = ref.watch(aiAnswerCardProvider);
    final messages = _session.messages;
    final loading = _session.isLoading;

    final media = MediaQuery.of(context);
    // The tab ends above the nav; the keyboard covers more than that.
    final keyboard = math.max(0.0, media.viewInsets.bottom - (kPbNav + media.padding.bottom));

    final rows = <Widget>[];
    for (var i = 0; i < messages.length; i++) {
      final m = messages[i];
      rows.add(_AiMessageRow(key: ValueKey(m.id), message: m, copied: _copiedId == m.id, onCopy: _copy));
      final answered = !m.isUser && !m.isStreaming && m.content.isNotEmpty && i > 0 && messages[i - 1].isUser;
      if (answered && cardBuilder != null) {
        final card = cardBuilder(context, question: messages[i - 1].content, partner: partner);
        if (card != null) rows.add(KeyedSubtree(key: ValueKey('${m.id}-card'), child: card));
      }
    }

    final list = ListView(
      key: const ValueKey('ai-chat-list'),
      controller: _scroll,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      children: [
        Padding(padding: const EdgeInsets.only(top: 4, bottom: 16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows)),
        if (messages.length <= 1 && !loading) _Suggestions(questions: suggested, onTap: _send),
      ],
    );

    return ColoredBox(
      color: a.bg,
      child: Padding(
        padding: EdgeInsets.only(bottom: keyboard),
        child: Stack(children: [
          Column(children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                _Header(partner: partner != null, online: online, onReset: () => unawaited(_clearChat())),
                if (_warnVisible)
                  _WarnBanner(
                    expanded: _warnExpanded,
                    text: _warnExpanded
                        ? fillEmergencyNumber(
                            tr('aichatscreen_medical_disclaimer_banner',
                                'Anacan.AI tibbi məsləhət, diaqnoz və ya müalicə əvəzi DEYİL. Verilən məlumatlar yalnız informasiya xarakterli olub yalnız təhsil məqsədi daşıyır. Hər hansı tibbi qərar verməzdən əvvəl mütləq həkiminizə və ya ixtisaslı tibb işçisinə müraciət edin. Təcili hallarda {emergency} nömrəsinə zəng edin.'),
                            emergency)
                        : tr('aichatscreen_warn_short', 'Tibbi məsləhət əvəzi deyil — ətraflı üçün toxunun'),
                    onToggle: () => setState(() => _warnExpanded = !_warnExpanded),
                    onDismiss: _dismissWarn,
                  ),
              ]),
            ),
            Expanded(child: list),
            _InputArea(
              controller: _input,
              focus: _focus,
              loading: loading,
              attached: _attached,
              onPick: () => unawaited(_pickImage()),
              onRemoveImage: clearAttachedImage,
              onSend: () => _send(),
              onStop: _session.stop,
            ),
          ]),
          if (_showJumpDown)
            PositionedDirectional(
              end: 18,
              bottom: 86,
              child: _JumpDown(
                loading: loading,
                onTap: () {
                  _pinned = true;
                  setState(() => _showJumpDown = false);
                  _scrollToBottomSoon(smooth: true);
                },
              ),
            ),
        ]),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.partner, required this.online, required this.onReset});
  final bool partner;
  final bool online;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final disclaimer = tr('aichatscreen_hekim_mesleheti_evezi_deyil_a1808c', '⚕️ Həkim məsləhəti əvəzi deyil').replaceFirst('⚕️ ', '');
    return Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 12),
      child: Row(children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(gradient: a.gradLav, shape: BoxShape.circle),
          child: Center(child: AIcon(AIcons.sparkles, size: 19, color: a.lavInk)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Semantics(
              header: true,
              child: Text(
                partner ? aiFeature37Text('pm_ata_ai') : tr('bottomnav_anacan_ai', 'Anacan.AI'),
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.02 * 16, color: a.ink, height: 1.5),
              ),
            ),
            const SizedBox(height: 2),
            Row(children: [
              Container(
                key: const ValueKey('ai-status-dot'),
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: online ? a.green2 : a.inkSoft,
                  shape: BoxShape.circle,
                  // `0 0 0 3px rgba(99, 189, 139, 0.22)` (one-off literal of anacan-design.css).
                  boxShadow: online ? const [BoxShadow(color: Color.fromRGBO(99, 189, 139, 0.22), spreadRadius: 3)] : null,
                ),
              ),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  '${online ? tr('untranslated_onlayn_xfaffi', 'Onlayn') : tr('aichat_status_offline', 'Oflayn')} · $disclaimer',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: a.inkSoft, height: 1.5),
                ),
              ),
            ]),
          ]),
        ),
        const SizedBox(width: 12),
        _IconBtn(semanticLabel: 'Reset', onTap: onReset, child: AIcon(AIcons.refreshCw, size: 15, color: a.ink)),
      ]),
    );
  }
}

/// `.a-icon-btn` (38×38, radius 12, surface, 1px `--a-btn-border`, `0 6px 14px -8px rgba(217,108,74,.35)`).
class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.child, required this.onTap, required this.semanticLabel});
  final Widget child;
  final VoidCallback onTap;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: GestureDetector(
        key: const ValueKey('ai-reset'),
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: a.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: a.btnBorder),
            boxShadow: const [BoxShadow(color: Color.fromRGBO(217, 108, 74, 0.35), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
          ),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _WarnBanner extends StatelessWidget {
  const _WarnBanner({required this.expanded, required this.text, required this.onToggle, required this.onDismiss});
  final bool expanded;
  final String text;
  final VoidCallback onToggle;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      key: const ValueKey('ai-warn'),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: a.yellow1,
        // `1px solid rgba(255, 201, 77, 0.4)` (one-off literal of anacan-design.css).
        border: Border.all(color: const Color.fromRGBO(255, 201, 77, 0.4)),
        borderRadius: BorderRadius.circular(a.radiusMd),
      ),
      child: Semantics(
        button: true,
        expanded: expanded,
        child: GestureDetector(
          key: const ValueKey('ai-warn-toggle'),
          behavior: HitTestBehavior.opaque,
          onTap: onToggle,
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('⚕️', style: TextStyle(fontSize: 15, height: 1)),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                text,
                maxLines: expanded ? null : 1,
                overflow: expanded ? null : TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: a.warnInk, height: 1.5),
              ),
            ),
            const SizedBox(width: 9),
            Row(mainAxisSize: MainAxisSize.min, children: [
              Opacity(opacity: 0.6, child: AIcon(expanded ? AIcons.chevronUp : AIcons.chevronDown, size: 13, strokeWidth: 2.2, color: a.warnInk)),
              const SizedBox(width: 6),
              Semantics(
                button: true,
                label: tr('aichatscreen_warn_close', 'Xəbərdarlığı bağla'),
                child: GestureDetector(
                  key: const ValueKey('ai-warn-close'),
                  onTap: onDismiss,
                  child: Container(
                    width: 20,
                    height: 20,
                    // `rgba(0,0,0,0.06)` (one-off literal of AIChatScreen.tsx).
                    decoration: const BoxDecoration(color: Color.fromRGBO(0, 0, 0, 0.06), shape: BoxShape.circle),
                    child: Center(child: AIcon(AIcons.x, size: 11, strokeWidth: 2.4, color: a.warnInk)),
                  ),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

/// `ChatMessageRow`.
class _AiMessageRow extends StatelessWidget {
  const _AiMessageRow({super.key, required this.message, required this.copied, required this.onCopy});
  final AiMessage message;
  final bool copied;
  final void Function(String id, String content) onCopy;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final user = message.isUser;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final avatar = Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(gradient: user ? a.gradPeach : a.gradLav, shape: BoxShape.circle),
      child: Center(child: AIcon(user ? AIcons.user : AIcons.bot, size: 13, strokeWidth: 2.2, color: user ? a.accentInk : a.lavInk)),
    );
    final hasImage = message.previewBytes != null || (message.imageUrl != null && message.imageUrl!.isNotEmpty);
    final Widget body;
    if (message.isStreaming && message.content.isEmpty) {
      body = Semantics(label: tr('aichat_thinking', 'Düşünür...'), child: const _TypingDots());
    } else if (!user && !message.isStreaming) {
      body = MarkdownContent(content: message.content, variant: ContentVariant.chat, textColor: a.ink);
    } else {
      body = Text.rich(TextSpan(children: [
        TextSpan(text: message.content),
        if (message.isStreaming && message.content.isNotEmpty) const WidgetSpan(alignment: PlaceholderAlignment.middle, child: _Cursor()),
      ]));
    }
    final bubble = Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: user ? a.ink : a.surface,
        border: user ? null : Border.all(color: a.line),
        // border-bottom-left / -right radius are physical in the CSS.
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(18),
          topRight: const Radius.circular(18),
          bottomLeft: Radius.circular(user ? 18 : 4),
          bottomRight: Radius.circular(user ? 4 : 18),
        ),
        boxShadow: user ? null : a.cardShadow,
      ),
      child: DefaultTextStyle.merge(
        style: TextStyle(fontSize: 13, height: 1.55, color: user ? a.bg : a.ink),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          if (hasImage)
            Padding(
              padding: EdgeInsets.only(bottom: message.content.isNotEmpty ? 6 : 0),
              child: _BubbleImage(message: message),
            ),
          body,
        ]),
      ),
    );
    final time = message.isStreaming
        ? null
        : Padding(
            padding: const EdgeInsets.only(top: 5, left: 3, right: 3),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(localeTimeHm(message.timestamp), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: a.inkFaint, height: 1.5)),
              if (!user && message.content.isNotEmpty) ...[
                const SizedBox(width: 8),
                Semantics(
                  button: true,
                  label: tr('aichat_copy', 'Kopyala'),
                  child: GestureDetector(
                    key: ValueKey('ai-copy-${message.id}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => onCopy(message.id, message.content),
                    child: Opacity(
                      opacity: 0.75,
                      child: Padding(
                        padding: const EdgeInsets.all(2),
                        child: copied
                            ? Row(mainAxisSize: MainAxisSize.min, children: [
                                AIcon(AIcons.check, size: 11, strokeWidth: 2.4, color: a.greenInk),
                                const SizedBox(width: 3),
                                Text(tr('aichat_copied', 'Kopyalandı'), style: TextStyle(fontSize: 9.5, color: a.greenInk, fontWeight: FontWeight.w700)),
                              ])
                            : AIcon(AIcons.copy, size: 11, strokeWidth: 2.2, color: a.inkFaint),
                      ),
                    ),
                  ),
                ),
              ],
            ]),
          );
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: LayoutBuilder(builder: (context, c) {
        final wrap = ConstrainedBox(
          constraints: BoxConstraints(maxWidth: c.maxWidth * 0.8),
          child: Column(
            crossAxisAlignment: user ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [bubble, ?time],
          ),
        );
        // `flex-direction: row-reverse` for the user's row.
        final children = user ? [wrap, const SizedBox(width: 8), avatar] : [avatar, const SizedBox(width: 8), wrap];
        return Row(
          mainAxisAlignment: user ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
          children: children,
        );
      }),
    );
  }
}

class _BubbleImage extends ConsumerWidget {
  const _BubbleImage({required this.message});
  final AiMessage message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Widget? image;
    final bytes = message.previewBytes;
    if (bytes != null) {
      image = Image.memory(bytes, fit: BoxFit.cover, gaplessPlayback: true);
    } else if (message.imageUrl != null) {
      final src = ref.watch(chatMediaSrcProvider(message.imageUrl!)).value;
      if (src != null) image = CachedNetworkImage(imageUrl: src, fit: BoxFit.cover);
    }
    if (image == null) return const SizedBox.shrink();
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 220, maxHeight: 260),
      child: ClipRRect(borderRadius: BorderRadius.circular(12), child: image),
    );
  }
}

/// `animate-pulse` (opacity 1 → .5 → 1, 2 s, cubic-bezier(.4, 0, .6, 1)) with a delay.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child, this.delay = Duration.zero});
  final Widget child;
  final Duration delay;

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));
  Timer? _start;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!infiniteAnimationsAllowed(context)) {
      _start?.cancel();
      _c.stop();
      return;
    }
    if (_c.isAnimating || _start != null) return;
    _start = Timer(widget.delay, () {
      if (mounted) _c.repeat();
    });
  }

  @override
  void dispose() {
    _start?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final v = _c.value;
          final k = const Cubic(0.4, 0, 0.6, 1).transform(v < 0.5 ? v * 2 : (1 - v) * 2);
          return Opacity(opacity: 1 - 0.5 * k, child: child);
        },
        child: widget.child,
      );
}

class _TypingDots extends StatelessWidget {
  const _TypingDots();

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          _Pulse(
            delay: Duration(milliseconds: i * 150),
            child: Container(width: 6, height: 6, decoration: BoxDecoration(color: a.peach2, shape: BoxShape.circle)),
          ),
        ],
      ]),
    );
  }
}

class _Cursor extends StatelessWidget {
  const _Cursor();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(start: 4),
        child: _Pulse(
          child: Container(width: 6, height: 14, decoration: BoxDecoration(color: context.a.peach2, borderRadius: BorderRadius.circular(2))),
        ),
      );
}

class _Suggestions extends StatelessWidget {
  const _Suggestions({required this.questions, required this.onTap});
  final List<String> questions;
  final void Function(String question) onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 10),
          child: Text(
            tr('aichatscreen_meslehet_ucun_sual_secin_3c0236', 'Məsləhət üçün sual seçin:'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: a.inkSoft, height: 1.5),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (var i = 0; i < questions.length; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              PressScale(
                scale: 0.97,
                onTap: () => onTap(questions[i]),
                child: Semantics(
                  button: true,
                  child: Container(
                    key: ValueKey('ai-suggest-$i'),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(999)),
                    child: Text(questions[i], textAlign: TextAlign.start, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: a.ink, height: 1.5)),
                  ),
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _JumpDown extends StatelessWidget {
  const _JumpDown({required this.loading, required this.onTap});
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      label: tr('aichat_jump_down', 'Ən son mesaja keç'),
      child: GestureDetector(
        key: const ValueKey('ai-jump-down'),
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: a.surface,
            shape: BoxShape.circle,
            border: Border.all(color: a.line),
            // `0 10px 24px -8px rgba(217, 108, 74, 0.45)` (one-off literal of AIChatScreen.tsx).
            boxShadow: const [BoxShadow(color: Color.fromRGBO(217, 108, 74, 0.45), offset: Offset(0, 10), blurRadius: 24, spreadRadius: -8)],
          ),
          child: Center(child: AIcon(AIcons.arrowDown, size: 16, strokeWidth: 2.4, color: a.accentInk)),
        ),
      ),
    );
  }
}

class _InputArea extends StatelessWidget {
  const _InputArea({
    required this.controller,
    required this.focus,
    required this.loading,
    required this.attached,
    required this.onPick,
    required this.onRemoveImage,
    required this.onSend,
    required this.onStop,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final bool loading;
  final AiPickedImage? attached;
  final VoidCallback onPick;
  final VoidCallback onRemoveImage;
  final VoidCallback onSend;
  final VoidCallback onStop;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final canSend = controller.text.trim().isNotEmpty || attached != null;
    final image = attached;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (image != null)
          Container(
            key: const ValueKey('ai-attached'),
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(width: 42, height: 42, child: Image.memory(image.bytes, fit: BoxFit.cover, gaplessPlayback: true)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tr('aichat_image_attached', 'Şəkil qoşuldu — sualınızı yazın və göndərin'),
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, color: a.inkSoft, height: 1.5),
                ),
              ),
              const SizedBox(width: 8),
              Semantics(
                button: true,
                label: tr('aichat_image_remove', 'Şəkli sil'),
                child: GestureDetector(
                  key: const ValueKey('ai-attached-remove'),
                  onTap: onRemoveImage,
                  child: Padding(padding: const EdgeInsets.all(4), child: AIcon(AIcons.x, size: 15, strokeWidth: 2.2, color: a.inkFaint)),
                ),
              ),
            ]),
          ),
        Container(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 6, 6, 6),
          decoration: BoxDecoration(
            color: a.surface,
            border: Border.all(color: a.line),
            borderRadius: BorderRadius.circular(24),
            // `0 16px 32px -18px rgba(23, 21, 15, 0.3)` (one-off literal of anacan-design.css).
            boxShadow: const [BoxShadow(color: Color.fromRGBO(23, 21, 15, 0.3), offset: Offset(0, 16), blurRadius: 32, spreadRadius: -18)],
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Semantics(
              button: true,
              enabled: !loading,
              label: tr('aichat_attach_image', 'Şəkil əlavə et'),
              child: GestureDetector(
                key: const ValueKey('ai-attach'),
                onTap: loading ? null : onPick,
                child: Opacity(
                  opacity: loading ? 0.5 : 1,
                  child: Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(0, 6, 4, 6),
                    child: AIcon(AIcons.imagePlus, size: 17, strokeWidth: 2.1, color: image != null ? a.peach2 : a.inkFaint),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Opacity(
                opacity: loading ? 0.5 : 1,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 34, maxHeight: 100),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Stack(children: [
                      if (controller.text.isEmpty)
                        IgnorePointer(
                          child: Text(tr('aichat_input_ph', 'Anacan.AI-yə sualınızı yazın...'),
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: a.inkFaint, height: 18 / 13)),
                        ),
                      Semantics(
                        textField: true,
                        label: tr('aichat_input_ph', 'Anacan.AI-yə sualınızı yazın...'),
                        child: EditableText(
                          key: const ValueKey('ai-input'),
                          controller: controller,
                          focusNode: focus,
                          readOnly: loading,
                          maxLines: null,
                          keyboardType: TextInputType.multiline,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => onSend(),
                          style: TextStyle(fontSize: 13, color: a.ink, height: 18 / 13),
                          cursorColor: a.ink,
                          backgroundCursorColor: a.inkFaint,
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (loading)
              _SendButton(
                key: const ValueKey('ai-stop'),
                label: tr('aichat_stop', 'Dayandır'),
                enabled: true,
                onTap: onStop,
                child: Container(width: 10, height: 10, decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.circular(2))),
              )
            else
              _SendButton(
                key: const ValueKey('ai-send'),
                label: 'Send',
                enabled: canSend,
                onTap: onSend,
                child: const AIcon(AIcons.send, size: 15, strokeWidth: 2.2, color: _white),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// `.a-chat-send` (38 px peach circle; disabled opacity .4 without shadow; `:active` scale .92).
class _SendButton extends StatelessWidget {
  const _SendButton({super.key, required this.label, required this.enabled, required this.onTap, required this.child});
  final String label;
  final bool enabled;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(bottom: 1),
      child: Semantics(
        button: true,
        enabled: enabled,
        label: label,
        child: PressScale.css(
          scale: 0.92,
          enabled: enabled,
          onTap: enabled ? onTap : null,
          child: Opacity(
            opacity: enabled ? 1 : 0.4,
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: a.peach2,
                shape: BoxShape.circle,
                // `0 6px 14px -6px rgba(255, 90, 95, 0.55)` (one-off literal of anacan-design.css).
                boxShadow: enabled ? const [BoxShadow(color: Color.fromRGBO(255, 90, 95, 0.55), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -6)] : null,
              ),
              child: Center(child: child),
            ),
          ),
        ),
      ),
    );
  }
}
