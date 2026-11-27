// Ported from: src/hooks/usePartnerMessages.ts (the realtime `toast(...)` of the shared channel) and its always-
//              mounted BottomNav consumer (keeps the channel open)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/partner_messages.dart';
import 'ui/chat_widgets.dart';

/// Keeps [partnerMessagesProvider] (the shared realtime channel) alive and shows its arrival toasts.
class PartnerMessageToastListener extends ConsumerStatefulWidget {
  const PartnerMessageToastListener({super.key, this.child = const SizedBox.shrink()});
  final Widget child;
  @override
  ConsumerState<PartnerMessageToastListener> createState() => _PartnerMessageToastListenerState();
}

class _PartnerMessageToastListenerState extends ConsumerState<PartnerMessageToastListener> {
  StreamSubscription<ChatToast>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = ref.read(partnerMessageToastsProvider).stream.listen((toast) {
      if (mounted) showChatToast(context, toast);
    });
  }

  @override
  void dispose() {
    unawaited(_sub?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(partnerMessagesProvider.select((s) => s.loading));
    return widget.child;
  }
}
