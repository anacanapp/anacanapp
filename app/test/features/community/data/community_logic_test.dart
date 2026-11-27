// Ported from: src/lib/community-blog.test.ts, src/lib/community-moderation.test.ts
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/app_languages.dart';
import 'package:anacan/features/community/copy/community_copy.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/data/community_blog.dart';
import 'package:anacan/features/community/data/community_moderation.dart';
import 'package:anacan/shell/links/push_nav.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _copy() {
  final file = File('../scripts/i18n/community-moderation-copy.json');
  return (jsonDecode(file.readAsStringSync()) as Map<String, dynamic>)['languages'] as Map<String, dynamic>;
}

void main() {
  group('community-blog', () {
    test('detects the slash command at the caret and preserves caption boundaries', () {
      const text = 'My caption /Blog sleep\nMore text';
      expect(blogCommand(text, 22), (start: 11, end: 22, search: 'sleep'));
      expect(blogCommand('/Blog'), (start: 0, end: 5, search: ''));
      expect(blogCommand('hello /blog körpə'), (start: 6, end: 17, search: 'körpə'));
      expect(blogCommand('https://anacan.az/Blog'), isNull);
      expect(blogCommand('/Blog sleep\ncaption'), isNull);
    });

    test('keeps the card a validated first-party article rather than arbitrary executable OG input', () {
      expect(validSharedBlog({'id': '11111111-1111-4111-8111-111111111111', 'slug': 'sleep', 'title': 'Sleep'}), isTrue);
      expect(validSharedBlog({'id': 'bad', 'slug': '../account', 'title': 'Title'}), isFalse);
      expect(blogImageUrl('javascript:alert(1)'), isNull);
      expect(blogImageUrl('https://user:password@example.com/a.png'), isNull);
      expect(blogImageUrl('https://example.com/a.png'), 'https://example.com/a.png');
    });
  });

  group('advertising moderation language contract', () {
    final copy = _copy();
    for (final language in kAppLanguageCodes) {
      test('has complete status, decision and reason copy in $language', () {
        final values = copy[language] as Map<String, dynamic>;
        final en = copy['en'] as Map<String, dynamic>;
        expect(values.keys.toList()..sort(), en.keys.toList()..sort());
        for (final value in values.values) {
          expect(value is String && value.trim().isNotEmpty, isTrue);
        }
        expect(values['email_destination'], contains('jamil@anacan.az'));
        for (final reason in kAdReasons) {
          expect(moderationReason(reason, language), values['reason_$reason']);
        }
        for (final state in ['checking', 'review', 'approved', 'rejected']) {
          expect(moderationText('${state}_body', language), values['${state}_body']);
        }
        if (language != 'en') expect(values['review_body'], isNot(en['review_body']));
      });
    }

    test('routes a moderation push to the private post with a validated identifier', () {
      const id = '826fc991-8d57-4b29-8566-9e7b4f1b1d5d';
      final intent = intentFromPushData({'type': 'community_moderation', 'postId': id})!;
      expect(intent.tab, 'community');
      expect(intent.communityTarget, const CommunityDeepLinkTarget(postId: id));
      final invalid = intentFromPushData({'type': 'community_moderation', 'postId': 'https://example.invalid'})!;
      expect(invalid.tab, 'community');
      expect(invalid.communityTarget, isNull);
    });

    test('holds checking/review/rejected posts and distinguishes conflict from installation-unavailable', () {
      for (final state in ['checking', 'review', 'rejected']) {
        expect(isHeldPost(state), isTrue);
      }
      for (final state in [null, 'approved']) {
        expect(isHeldPost(state), isFalse);
      }
      final az = copy['az'] as Map<String, dynamic>;
      expect(moderationError(const CommunityBackendError(code: 'PGRST202'), 'az'), az['unavailable']);
      expect(moderationError(const CommunityBackendError(code: '40001'), 'az'), az['conflict']);
    });
  });
}
