// Ported from: src/lib/web-premium-client.ts
//
// Premium bought on anacan.az (Epoint) is invisible to the store SDK: the `web-premium` function reports its
// source and lets the app stop / restart renewals. Used by the billing screen (and later the Epoint option).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/data/data.dart';

/// anacan.az subscription cabinet (cards, cancel, resume) for Premium bought on the website (Epoint).
const String webPremiumCabinetUrl = 'https://anacan.az/website/premium/hesab/index.html';

class WebPremiumState {
  const WebPremiumState({required this.active, this.source, this.renews = false, this.expiresAt, this.plan});
  final bool active;

  /// 'web_subscription' (renewing Epoint), 'web_pass', 'store', 'promotional' or null.
  final String? source;
  final bool renews;
  final String? expiresAt;
  final String? plan;
}

/// 'ok' | 'refused' | 'failed'
typedef WebRenewalResult = String;

const Duration _timeout = Duration(milliseconds: 10000);

/// `supabase.functions.invoke('web-premium', { body: { action } })` as `{data, error, status}`.
typedef WebPremiumInvoker = Future<DbResult<Object?>> Function(String action);

class WebPremiumClient {
  WebPremiumClient(this._invoke, {Future<void> Function(Uri uri)? openExternal}) : _open = openExternal ?? _launch;
  final WebPremiumInvoker _invoke;
  final Future<void> Function(Uri uri) _open;

  static Future<void> _launch(Uri uri) async {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<DbResult<Object?>> _call(String action) async {
    try {
      return await _invoke(action).timeout(_timeout, onTimeout: () => DbResult<Object?>(error: TimeoutException('timeout')));
    } catch (error) {
      return DbResult<Object?>(error: error);
    }
  }

  /// Current Premium source as the web-premium function sees it (signed-in user session). null when unreadable.
  Future<WebPremiumState?> fetchState() async {
    final res = await _call('status');
    final data = res.data;
    final premium = res.error == null && data is Map && data['ok'] == true ? data['premium'] : null;
    if (premium is! Map || premium['active'] is! bool) return null;
    String? str(String k) => premium[k] is String ? premium[k] as String : null;
    return WebPremiumState(
      active: premium['active'] as bool,
      source: str('source'),
      renews: premium['renews'] == true,
      expiresAt: str('expires_at'),
      plan: str('plan'),
    );
  }

  /// Stop ('cancel') or restart ('resume') renewals of the anacan.az subscription. Premium stays until the paid
  /// period ends. 'refused' = the server does not accept this action from the app; the caller opens the cabinet.
  Future<WebRenewalResult> setRenewal(String action) async {
    final res = await _call(action);
    final data = res.data;
    if (res.error == null && data is Map && data['ok'] == true) return 'ok';
    final status = res.error == null ? null : res.status;
    if (status == 403 || (data is Map && data['error'] == 'origin_not_allowed')) return 'refused';
    return 'failed';
  }

  Future<void> openCabinet() => _open(Uri.parse(webPremiumCabinetUrl));
}

final webPremiumClientProvider = Provider<WebPremiumClient>(
  (ref) => WebPremiumClient((action) => ref.read(dbProvider).invoke('web-premium', body: {'action': action})),
);
