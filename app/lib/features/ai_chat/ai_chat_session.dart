// Ported from: src/components/AIChatScreen.tsx (sendMessage, stopGeneration, clearChat, the 80 ms stream flush,
//              the idle timer, the abort / timeout / error branches)
//
// The chat state machine without widgets: messages, loading, Stop. The screen owns one session and renders it.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../core/i18n/tr.dart';
import '../../core/net/network_timeout.dart';
import '../../domain/billing/usage_limits.dart' show UsageDecision;
import 'ai_chat_history.dart';
import 'ai_chat_inputs.dart' show AiPickedImage;
import 'ai_chat_logic.dart';
import 'ai_chat_stream.dart';

/// Everything one send needs from the app (bound by the screen; fakes in tests).
class AiChatSessionDeps {
  const AiChatSessionDeps({
    required this.history,
    required this.consume,
    required this.accessToken,
    required this.backend,
    required this.client,
    required this.upload,
    required this.buildBody,
    required this.userId,
    this.timerFactory = Timer.new,
    this.connectTimeout = aiStreamConnectTimeout,
    this.idleTimeout = aiStreamIdleTimeout,
    this.flushInterval = const Duration(milliseconds: 80),
    this.now = DateTime.now,
  });

  final AiChatHistory history;
  final Future<UsageDecision> Function() consume;
  final Future<String?> Function() accessToken;
  final ({String url, String publishableKey})? Function() backend;
  final http.Client client;
  final Future<String?> Function(String path, Uint8List bytes) upload;

  /// `JSON.stringify({ messages, lifeStage, … })` for the conversation and the optional photo.
  final Map<String, Object?> Function(List<Map<String, String>> conversation, String? imageBase64) buildBody;
  final String? userId;
  final TimerFactory timerFactory;
  final Duration connectTimeout;
  final Duration idleTimeout;
  final Duration flushInterval;
  final DateTime Function() now;
}

/// UI effects requested by a send.
abstract interface class AiChatSessionUi {
  void showPremium();
  void toast({required String title, String? description, bool destructive = false});

  /// The user just sent: pin the list to the bottom.
  void pinToBottom();

  /// `setInput('')`.
  void clearInput();

  /// `clearAttachedImage()`.
  void clearAttachedImage();
}

class AiChatSession extends ChangeNotifier {
  AiChatSession(this.deps, this.ui);
  final AiChatSessionDeps deps;
  final AiChatSessionUi ui;

  List<AiMessage> messages = const [];
  bool isLoading = false;
  AiAbortController? _abort;
  bool _disposed = false;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _set(List<AiMessage> next) {
    messages = next;
    _notify();
  }

  void _update(String id, AiMessage Function(AiMessage m) f) => _set([for (final m in messages) m.id == id ? f(m) : m]);

  /// Restored history or the welcome message.
  void initialize(List<AiHistoryRow> saved, String welcome) {
    if (saved.isNotEmpty) {
      _set([
        for (final m in saved)
          AiMessage(
            id: '${m['id']}',
            role: m['role'] == 'user' ? 'user' : 'assistant',
            content: '${m['content'] ?? ''}',
            timestamp: DateTime.tryParse('${m['created_at']}')?.toLocal() ?? deps.now(),
            imageUrl: m['image_url'] as String?,
          ),
      ]);
    } else {
      _set([AiMessage(id: 'welcome', role: 'assistant', content: welcome, timestamp: deps.now())]);
    }
  }

  /// `clearChat()`.
  Future<void> clear(String welcome) async {
    await deps.history.clearHistory();
    _set([AiMessage(id: 'welcome', role: 'assistant', content: welcome, timestamp: deps.now())]);
  }

  /// `stopGeneration()`.
  void stop() => _abort?.abort();

  String _id(String prefix) => '$prefix-${deps.now().millisecondsSinceEpoch}';

  Future<void> send(String rawText, {AiPickedImage? image}) async {
    final text = rawText.trim().isNotEmpty ? rawText.trim() : (image != null ? tr('aichat_photo_placeholder', '📷 Şəkil') : '');
    if ((text.isEmpty && image == null) || isLoading) return;

    // Free plan: the daily question limit (the paywall's "unlimited AI" promise).
    final decision = await deps.consume();
    if (!decision.allowed) {
      ui.showPremium();
      return;
    }
    if (decision.remaining.isFinite && decision.remaining <= 2) {
      ui.toast(
        title: tr('aichat_limit_warn_title', 'Pulsuz limit azalır'),
        description: tr('aichat_limit_warn_desc', 'Bu gün {n} pulsuz sualınız qalıb. Premium ilə limitsizdir.').replaceAll('{n}', _jsNum(decision.remaining)),
      );
    }

    String? imageBase64;
    String? imageUrl;
    if (image != null) {
      try {
        imageBase64 = base64Encode(image.bytes);
        final uid = deps.userId;
        if (uid != null) {
          imageUrl = await deps.upload('$uid/ai_${deps.now().millisecondsSinceEpoch}.jpg', image.bytes);
        }
      } catch (_) {
        ui.toast(title: tr('aichat_image_failed', 'Şəkil hazırlana bilmədi'), destructive: true);
        return;
      }
      ui.clearAttachedImage();
    }

    final userMessage = AiMessage(
      id: _id('user'),
      role: 'user',
      content: text,
      timestamp: deps.now(),
      imageUrl: imageUrl,
      previewBytes: imageUrl == null ? image?.bytes : null,
    );
    final assistantId = _id('assistant');
    final before = messages;
    _set([...messages, userMessage, AiMessage(id: assistantId, role: 'assistant', content: '', timestamp: deps.now(), isStreaming: true)]);
    ui.pinToBottom();

    // The DB write runs in the background; it does not delay the request.
    unawaited(deps.history.addMessage('user', text, imageUrl));
    ui.clearInput();
    isLoading = true;
    _notify();

    final abort = _abort = AiAbortController();
    String? pending;
    Timer? flushTimer;
    void cancelFlush() {
      flushTimer?.cancel();
      flushTimer = null;
      pending = null;
    }

    void flush() {
      final content = pending;
      cancelFlush();
      if (content == null) return;
      _update(assistantId, (m) => m.copyWith(content: content));
    }

    void schedule(String content) {
      pending = content;
      flushTimer ??= deps.timerFactory(deps.flushInterval, flush);
    }

    try {
      final conversation = [
        for (final m in before)
          if (m.id != 'welcome') {'role': m.role, 'content': m.content},
        {'role': 'user', 'content': text},
      ];
      final token = await deps.accessToken();
      if (token == null) throw const AiChatNoSession();
      final backend = deps.backend();
      if (backend == null) throw const AiChatNoSession();
      final full = await streamDrAnacanChat(
        deps.client,
        AiStreamRequest(backendUrl: backend.url, publishableKey: backend.publishableKey, accessToken: token, body: deps.buildBody(conversation, imageBase64)),
        abort: abort,
        onContent: schedule,
        connectTimeout: deps.connectTimeout,
        idleTimeout: deps.idleTimeout,
        timerFactory: deps.timerFactory,
      );
      cancelFlush();
      final finalContent = full.isNotEmpty ? full : tr('aichatscreen_bagislayin_cavab_ala_bilmedim_4078bf', 'Bağışlayın, cavab ala bilmədim.');
      _update(assistantId, (m) => m.copyWith(isStreaming: false, content: finalContent));
      if (full.isNotEmpty) await deps.history.addMessage('assistant', full);
    } catch (error) {
      // Stop: keep the partial answer, no error. Timeout (no headers in time / silent stream): keep the
      // partial answer and say why.
      final timedOut = error is AiStreamIdleTimeout || isRequestTimeoutError(error);
      if (timedOut) {
        ui.toast(
          title: tr('aichatscreen_xeta_3cdbb6', 'Xəta'),
          description: tr('netsync_timeout_retry', 'Bağlantı zəifdir, cavab gecikdi. Yenidən cəhd edin.'),
          destructive: true,
        );
      }
      if (error is AiStreamAborted || timedOut) {
        flush();
        final partial = messages.where((m) => m.id == assistantId).firstOrNull?.content ?? '';
        if (partial.isNotEmpty) {
          unawaited(deps.history.addMessage('assistant', partial));
          _update(assistantId, (m) => m.copyWith(isStreaming: false));
        } else if (timedOut) {
          _update(assistantId, (m) => m.copyWith(isStreaming: false, content: tr('netsync_timeout_retry', 'Bağlantı zəifdir, cavab gecikdi. Yenidən cəhd edin.')));
        } else {
          _set([for (final m in messages) if (m.id != assistantId) m]);
        }
      } else {
        cancelFlush();
        ui.toast(
          title: tr('aichatscreen_xeta_3cdbb6', 'Xəta'),
          description: tr('aichatscreen_mesaj_gonderile_bilmedi_yeniden_cehd_edi_aa6662', 'Mesaj göndərilə bilmədi. Yenidən cəhd edin.'),
          destructive: true,
        );
        _update(assistantId, (m) => m.copyWith(isStreaming: false, content: tr('aichatscreen_bagislayin_texniki_xeta_bas_verdi_zehmet_feb7d7', 'Bağışlayın, texniki xəta baş verdi. Zəhmət olmasa yenidən cəhd edin. 🙏')));
      }
    } finally {
      cancelFlush();
      if (identical(_abort, abort)) _abort = null;
      isLoading = false;
      _notify();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _abort?.abort();
    super.dispose();
  }
}

String _jsNum(double n) => n == n.roundToDouble() ? n.toInt().toString() : n.toString();
