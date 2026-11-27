// Ported from: src/lib/promo.ts (normalizePromoCode, savePendingPromo, readPendingPromo — the parts AuthScreen
//              uses), src/data/promo/index.ts (createFeatureText fallback: own → en → az)
import 'dart:async';

import '../../../state/local_store.dart';
import '../data/promo_copy.g.dart';

final RegExp kPromoCodeRe = RegExp(r'^[A-Z0-9][A-Z0-9-]{2,31}$');

/// LocalStore key shared with the promo redeemer (`anacan:promo-code` = `{code, at}`).
const String kPendingPromoKey = 'anacan:promo-code';
const Duration kPendingPromoTtl = Duration(days: 30);

String? normalizePromoCode(String? raw) {
  final code = (raw ?? '').trim().toUpperCase().replaceAll(RegExp(r'\s+'), '');
  return kPromoCodeRe.hasMatch(code) ? code : null;
}

/// Broadcast of `PROMO_PENDING_EVENT` (`anacan:promo-pending`) for the redeemer.
final StreamController<String> promoPendingEvents = StreamController<String>.broadcast();

String? savePendingPromo(LocalStore store, String raw, {DateTime? now}) {
  final code = normalizePromoCode(raw);
  if (code == null) return null;
  store.writeJson(kPendingPromoKey, {'code': code, 'at': (now ?? DateTime.now()).millisecondsSinceEpoch});
  promoPendingEvents.add(code);
  return code;
}

String? readPendingPromo(LocalStore store, {DateTime? now}) {
  final value = store.readJson(kPendingPromoKey);
  if (value is! Map) return null;
  final at = value['at'];
  final t = (now ?? DateTime.now()).millisecondsSinceEpoch;
  if (at is! num || t - at > kPendingPromoTtl.inMilliseconds) {
    store.removeItem(kPendingPromoKey);
    return null;
  }
  return normalizePromoCode(value['code'] as String?);
}

/// `usePromoText(language)` keys AuthScreen reads.
Map<String, String> promoText(String language) => kPromoCopy[language] ?? kPromoCopy['en'] ?? kPromoCopy['az']!;
