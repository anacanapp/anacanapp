// Ported from: src/components/community/DirectMessageScreen.tsx
import 'package:flutter/widgets.dart';

import '../data/chat.dart' show ChatKind;
import '../ui/conversation_screen.dart';

/// A direct conversation with [userId] (full screen, above the shell).
class DirectMessageScreen extends StatelessWidget {
  const DirectMessageScreen({super.key, required this.userId, required this.userName, this.userAvatar, required this.onBack});
  final String userId;
  final String userName;
  final String? userAvatar;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) =>
      ConversationScreen(kind: ChatKind.direct, target: userId, title: userName, avatar: userAvatar, onBack: onBack);
}
