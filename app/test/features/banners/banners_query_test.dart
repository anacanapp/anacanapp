// Ported from: src/hooks/useBanners.test.tsx
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/banners/data/banner.dart';
import 'package:anacan/features/banners/data/banners_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class CountingSource implements BannersSource {
  final List<(String, Map<String, Object?>)> calls = [];
  @override
  Future<List<Map<String, dynamic>>> rpc(String name, Map<String, Object?> args) async {
    calls.add((name, args));
    return const [];
  }

  @override
  Future<List<Map<String, dynamic>>> table({String? placement, String? lifeStage, required String language, String? countryCode}) async => const [];
  @override
  Future<List<Map<String, dynamic>>> impressions(String userId, List<String> bannerIds) async => const [];
  @override
  Future<void> incrementClick(String id) async {}
  @override
  Future<void> incrementImpression(String id) async {}
}

Future<QueryResult<List<Banner>>> settle(ProviderContainer container, String placement) async {
  final sub = container.listen(bannersQuery(placement), (_, _) {});
  for (var i = 0; i < 20 && !container.read(bannersQuery(placement)).isSuccess; i++) {
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
  final result = container.read(bannersQuery(placement));
  sub.close();
  return result;
}

void main() {
  late CountingSource source;
  late QueryClient client;
  late ProviderContainer container;

  setUp(() {
    resetBannerInventoryMemory();
    source = CountingSource();
    client = QueryClient();
    container = ProviderContainer(overrides: [
      queryClientProvider.overrideWithValue(client),
      bannersSourceProvider.overrideWithValue(source),
      bannersInputsProvider.overrideWithValue((backend: 'http://backend', language: 'az', lifeStage: 'bump', countryCode: 'AZ', userId: 'u1')),
    ]);
  });

  tearDown(() {
    container.dispose();
    client.clear();
  });

  group('useBanners inventory caching', () {
    test('fetches inventory once per placement and serves repeat mounts from cache', () async {
      final first = await settle(container, 'home_top');
      expect(first.isSuccess, isTrue);
      expect(source.calls, hasLength(1));
      expect(source.calls.first.$1, 'get_banner_inventory_v3');
      // A second BannerSlot for the same placement must not re-fire the RPC within staleTime.
      final second = await settle(container, 'home_top');
      expect(second.isSuccess, isTrue);
      expect(source.calls, hasLength(1));
      expect(second.isStale, isFalse);
    });

    test('keys the cache per placement', () async {
      expect((await settle(container, 'home_top')).isSuccess, isTrue);
      expect((await settle(container, 'home_bottom')).isSuccess, isTrue);
      expect(source.calls, hasLength(2));
      expect(source.calls.map((c) => c.$2).toList(), [
        {'p_actor': 'u1', 'p_placement': 'home_top', 'p_language': 'az'},
        {'p_actor': 'u1', 'p_placement': 'home_bottom', 'p_language': 'az'},
      ]);
    });
  });
}
