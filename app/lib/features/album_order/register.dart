// Ported from: src/components/baby/BabyMonthlyAlbum.tsx (`<AlbumOrderScreen albumType="baby" onBack />`),
//              src/components/tools/PregnancyAlbum.tsx (`<AlbumOrderScreen albumType="pregnancy" onBack />`)
//
// The album order flow of the shop (the admin Shop screen itself stays on the web). Nothing to register in the
// shell; wiring (docs/flutter/WIRING.md):
//   featureWiringOverrides(): ...albumOrderWiringOverrides()
//   PregnancyToolSlots(albumOrderScreen: pregnancyAlbumOrderSlot, …)
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/feature_registry.dart';
import '../tools/baby_album/baby_monthly_album.dart' show babyAlbumOrderSlotProvider;
import 'album_order_screen.dart';

/// No shell entries: the order screen opens from the album tools.
void registerAlbumOrderFeature(FeatureRegistry r) {}

/// `PregnancyToolSlots.albumOrderScreen`.
Widget pregnancyAlbumOrderSlot(BuildContext context, VoidCallback onBack) => AlbumOrderScreen(albumType: 'pregnancy', onBack: onBack);

/// `featureWiringOverrides()` entries of the album order.
List<Override> albumOrderWiringOverrides() => [
      babyAlbumOrderSlotProvider.overrideWithValue((context, {required albumType, required onBack}) => AlbumOrderScreen(albumType: albumType, onBack: onBack)),
    ];
