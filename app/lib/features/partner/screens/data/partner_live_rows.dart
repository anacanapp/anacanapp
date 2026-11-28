// Ported from: the fetch + realtime effects of src/components/partner/v2/{PartnerBabyDayScreen,
//              LiveContractionsScreen}.tsx
//
// Her rows of today (baby_logs) / the last 24 hours (contractions), refetched whenever she changes one (realtime
// filtered by her user_id on the server). Only used while she shares the data.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../domain/js_compat.dart' show DomainClock;
import '../../data/partner_backend.dart';
import 'screens_backend.dart';

/// 'baby-day' (baby_logs since local midnight) | 'contractions' (contractions of the last 24 h).
typedef LiveRowsArgs = ({String kind, String userId});

@immutable
class LiveRowsState {
  const LiveRowsState({this.rows = const [], this.loading = true});
  final List<Map<String, dynamic>> rows;
  final bool loading;
}

final partnerLiveRowsProvider = NotifierProvider.autoDispose.family<PartnerLiveRowsController, LiveRowsState, LiveRowsArgs>(PartnerLiveRowsController.new);

class PartnerLiveRowsController extends Notifier<LiveRowsState> {
  PartnerLiveRowsController(this.args);
  final LiveRowsArgs args;

  @override
  LiveRowsState build() {
    final userId = args.userId;
    final contractions = args.kind == 'contractions';
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetch());
    });
    ref.read(partnerBackendProvider).subscribe(ref,
        channelPrefix: contractions ? 'partner-contractions-$userId' : 'partner-baby-day-$userId',
        table: contractions ? 'contractions' : 'baby_logs',
        filter: 'user_id=eq.$userId',
        onChange: (_) => unawaited(fetch()));
    return const LiveRowsState();
  }

  Future<void> fetch() async {
    final backend = ref.read(partnerScreensBackendProvider);
    final now = DomainClock.now();
    try {
      final rows = args.kind == 'contractions'
          ? await backend.contractionsSince(args.userId, now.subtract(const Duration(hours: 24)).toUtc().toIso8601String())
          : await backend.babyLogsSince(args.userId, DateTime(now.year, now.month, now.day).toUtc().toIso8601String());
      if (ref.mounted) state = LiveRowsState(rows: rows, loading: false);
    } catch (error) {
      debugPrint('partner live rows (${args.kind}): $error');
      if (ref.mounted) state = LiveRowsState(rows: state.rows, loading: false);
    }
  }
}
