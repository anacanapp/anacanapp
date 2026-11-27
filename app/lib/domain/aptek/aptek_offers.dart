// Ported from: src/lib/aptek-offers.ts
//
// One rule table decides which Aptek products are offered where. Infant formula is never offered proactively
// (WHO International Code of Marketing of Breast-milk Substitutes).

import '../js_compat.dart';

/// 'colic' | 'feed' | 'weaning' | 'cups' | 'newborn' | 'bag'
typedef OfferContext = String;

class OfferProduct {
  const OfferProduct({
    required this.id,
    required this.sku,
    required this.kind,
    required this.minAgeMonths,
    required this.tags,
    required this.salesCount,
    required this.price,
  });
  final String id;
  final String? sku;
  final String? kind;
  final num? minAgeMonths;
  final List<String> tags;
  final num salesCount;
  final num price;
}

typedef OfferPick = List<OfferProduct> Function(List<OfferProduct> products, num? babyMonths);

class OfferRule {
  const OfferRule({this.bundle, required this.pick});
  final String? bundle;
  final OfferPick pick;
}

const String _formulaDispenser = '54692';
bool _isFormula(OfferProduct p) => p.tags.contains('infant_formula') || p.kind == 'food';
bool _fitsAge(OfferProduct p, num? months, [num slack = 0]) =>
    p.minAgeMonths == null || months == null || p.minAgeMonths! <= months + slack;
int _anti(OfferProduct p) => p.tags.contains('anti_colic') ? 1 : 0;

/// `a || b` for comparator numbers (0 and NaN are falsy).
num _or(num a, num b) => a == 0 || a.isNaN ? b : a;

final Map<OfferContext, OfferRule> offerRules = {
  'colic': OfferRule(
    pick: (ps, _) => jsSorted(ps.where((p) => p.tags.contains('anti_colic')),
        (OfferProduct a, OfferProduct b) => _or((a.minAgeMonths ?? 0) - (b.minAgeMonths ?? 0), b.salesCount - a.salesCount)),
  ),
  'feed': OfferRule(
    bundle: 'night',
    pick: (ps, m) => jsSorted(ps.where((p) => (p.kind == 'bottles' && _fitsAge(p, m, 1)) || p.sku == _formulaDispenser),
        (OfferProduct a, OfferProduct b) => _or(_anti(b) - _anti(a), b.salesCount - a.salesCount)),
  ),
  'weaning': OfferRule(
    bundle: 'weaning',
    pick: (ps, _) => jsSorted(
        ps.where((p) => (p.kind == 'bowls' || p.kind == 'cutlery') && (p.minAgeMonths == null || p.minAgeMonths! <= 6)),
        (OfferProduct a, OfferProduct b) => _or((b.minAgeMonths ?? 0) - (a.minAgeMonths ?? 0), b.salesCount - a.salesCount)),
  ),
  'cups': OfferRule(
    bundle: 'cups',
    pick: (ps, m) => jsSorted(ps.where((p) => p.kind == 'cups' && _fitsAge(p, m, 3)),
        (OfferProduct a, OfferProduct b) => (a.minAgeMonths ?? 0) - (b.minAgeMonths ?? 0)),
  ),
  'newborn': OfferRule(
    bundle: 'newborn',
    pick: (ps, _) => jsSorted(ps.where((p) => p.minAgeMonths == 0 || p.sku == _formulaDispenser), (OfferProduct a, OfferProduct b) => a.price - b.price),
  ),
  'bag': OfferRule(
    bundle: 'newborn',
    pick: (ps, _) => jsSorted(ps.where((p) => p.minAgeMonths == 0 || p.sku == _formulaDispenser), (OfferProduct a, OfferProduct b) => a.price - b.price),
  ),
};

/// Products to offer for a context, or [] when that placement is switched off (`placements[context] === false`).
List<T> offerProducts<T extends OfferProduct>(OfferContext context, List<T> products, Map<String, Object?>? placements,
    [num? babyMonths, int limit = 8]) {
  if (placements == null || placements[context] == false) return [];
  final safe = products.where((p) => !_isFormula(p)).toList();
  return offerRules[context]!.pick(safe, babyMonths).cast<T>().take(limit).toList();
}

/// Context suggested by the mommy home for a baby of this age.
OfferContext? homeOfferContext(String? stage, num? babyMonths) {
  if (stage == 'bump') return 'newborn';
  if (stage != 'mommy' || babyMonths == null) return null;
  if (babyMonths < 4) return 'colic';
  if (babyMonths < 6) return 'feed';
  if (babyMonths < 9) return 'weaning';
  return 'cups';
}
