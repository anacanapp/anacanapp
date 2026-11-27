// Ported from: (no React test) src/lib/chat-i18n.ts, src/lib/group-i18n.ts, date-fns formatDistanceToNow
import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/features/chat/copy/chat_copy.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';

void main() {
  late I18nRuntime runtime;
  setUp(() => runtime = installTestI18n());

  test('chatTr uses the bundled table of the language, English for others, then the fallback', () {
    expect(chatTr('chat_reply', 'x'), 'Cavab ver');
    runtime.setLanguageInMemory('ru');
    expect(chatTr('chat_reply'), 'Ответить');
    runtime.setLanguageInMemory('fr');
    expect(chatTr('chat_reply'), 'Reply');
    expect(chatTr('not_a_chat_key', 'Fallback'), 'Fallback');
  });

  test('groupTr picks the GROUP_LABELS column and Azerbaijani outside the nine group languages', () {
    expect(groupTr('group_invites'), 'Dəvətlər');
    runtime.setLanguageInMemory('en');
    expect(groupTr('group_invites'), 'Invitations');
    runtime.setLanguageInMemory('ja');
    expect(groupTr('group_invites'), 'Dəvətlər');
    expect(groupTr('unknown_group_key'), 'unknown_group_key');
  });

  test('sticker and feature copy fall back to English', () {
    runtime.setLanguageInMemory('az');
    expect(stickerText('close').isNotEmpty, isTrue);
    expect(chatFeature37Text('chat_copy', 'en'), 'Copy');
    expect(chatFollowupText('media_retry', 'en'), 'Reload media');
  });

  test('formatDistanceToNow follows the date-fns buckets', () {
    final now = DateTime.utc(2026, 11, 27, 12);
    String d(Duration ago, [String language = 'en']) => formatDistanceToNow(now.subtract(ago), now: now, language: language);
    expect(d(const Duration(seconds: 20)), 'less than a minute');
    expect(d(const Duration(minutes: 1)), '1 minute');
    expect(d(const Duration(minutes: 30)), '30 minutes');
    expect(d(const Duration(minutes: 50)), 'about 1 hour');
    expect(d(const Duration(hours: 5)), 'about 5 hours');
    expect(d(const Duration(hours: 30)), '1 day');
    expect(d(const Duration(days: 12)), '12 days');
    expect(d(const Duration(days: 45)), 'about 2 months');
    expect(d(const Duration(days: 200)), '7 months');
    expect(d(const Duration(days: 400)), 'about 1 year');
    expect(d(const Duration(days: 500)), 'over 1 year');
    expect(d(const Duration(days: 700)), 'almost 2 years');
    expect(d(const Duration(minutes: 3), 'az'), '3 dəqiqə');
    expect(d(const Duration(minutes: 3), 'tk'), '3 minut');
  });
}
