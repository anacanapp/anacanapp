// Ported from: (golden of src/components/CommunityScreen.tsx for the reference shot bump.tabs__community,
//              390×844 light az; feed rows follow tools/reference-shots/fixtures/_lib/community.mjs)
import 'package:anacan/core/auth/auth.dart' show Profile;
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:anacan/features/community/community_slots.dart';
import 'package:anacan/features/community/ui/community_post_feed.dart' show communityOnlineProvider;
import 'package:anacan/features/community/ui/community_screen.dart';
import 'package:flutter/painting.dart' show debugDisableShadows;
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../design/harness.dart';
import '../support/community_fakes.dart';

void main() {
  setUpAll(() async {
    await loadAnacanFonts();
    // The real-async SVG settle lets useActiveBlock reach the (fail-open) backend client, which reads prefs.
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('golden: community feed (reference shot bump.tabs__community, 390×844 light az)', (tester) async {
    // flutter_test paints BoxShadows without blur (debugDisableShadows), which hides the CSS card shadows.
    debugDisableShadows = false;
    addTearDown(() => debugDisableShadows = true);
    final now = DateTime.now().toUtc();
    String ago(num hours) => now.subtract(Duration(minutes: (hours * 60).round())).toIso8601String();
    final members = <Map<String, dynamic>>[
      {'user_id': 'm1', 'name': 'Günel Əliyeva', 'life_stage': 'bump', 'badge_type': null, 'is_premium': true, 'is_verified': false},
      {'user_id': 'm2', 'name': 'Nərmin Hüseynova', 'life_stage': 'mommy', 'badge_type': 'expert', 'is_premium': false, 'is_verified': true},
      {'user_id': 'm3', 'name': 'Aysel Quliyeva', 'life_stage': 'mommy', 'badge_type': null, 'is_premium': true, 'is_verified': false},
      {'user_id': 'm4', 'name': 'Sevinc Məmmədli', 'life_stage': 'flow', 'badge_type': null, 'is_premium': false, 'is_verified': false},
    ];
    const texts = [
      '24-cü həftədəyik! Kimdə bel ağrısı var, nə kömək edir? 🤰',
      'Qızım bu gün ilk dəfə öz-özünə oturdu 😍 6 ay necə tez keçdi!',
      'Əlavə qidaya brokkolidən başladıq. Siz nədən başlamısınız?',
      'Bakıda yaxşı uşaq həkimi tövsiyə edə bilərsinizmi?',
    ];
    final posts = <Map<String, dynamic>>[
      for (var i = 0; i < 4; i++)
        {
          'id': 'post-$i', 'user_id': members[i]['user_id'], 'content': texts[i], 'language': 'az', 'media_urls': <String>[], //
          'is_anonymous': false, 'is_active': true, 'is_pinned': false, 'comments_locked': false, 'group_id': null,
          'tagged_group_ids': <String>[], 'likes_count': [24, 57, 13, 6][i], 'comments_count': [8, 15, 4, 2][i],
          'created_at': ago([1.5, 3, 7, 20][i]), 'updated_at': ago([1.5, 3, 7, 20][i]),
        },
    ];
    final cards = <String, Map<String, dynamic>>{for (final m in members) '${m['user_id']}': m};
    final backend = FakeCommunityBackend();
    backend.onGetUser = () async => 'viewer';
    backend.onProfileCards = (ids) async => cards;
    backend.onRpc = (fn, params) async => fn == 'get_community_feed_v2' ? posts : null;
    await pumpCommunity(
      tester,
      const CommunityScreenPage(screen: CommunityScreen(onOpenNotifications: _noop)),
      overrides: [
        ...communityOverrides(
          backend: backend,
          userId: 'viewer',
          profile: Profile({'id': 'p-viewer', 'user_id': 'viewer', 'name': 'Leyla'}),
          client: QueryClient(defaults: const QueryDefaults(retry: noRetry)),
        ),
        communityOnlineProvider.overrideWithValue(true),
        communityNotificationsUnreadProvider.overrideWithValue(2),
        communityDmUnreadProvider.overrideWithValue(0),
      ],
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 20));
    }
    await settleSvgs(tester);
    await expectLater(find.byType(GalleryFrame), matchesGoldenFile('goldens/community_feed_light.png'));
    await flushCommunity(tester);
    debugDisableShadows = true;
  });
}

void _noop() {}
