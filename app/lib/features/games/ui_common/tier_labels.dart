// Ported from: src/components/games/tierLabels.ts
//
// Difficulty tier names come from the level configs as Azerbaijani strings (also persisted in section labels);
// they are translated at render time.
library;

import '../../../core/i18n/tr.dart';

const Map<String, String> _tierKeys = {
  'Rahat': 'games_tier_rahat',
  'Orta': 'games_tier_orta',
  'Çətin': 'games_tier_cetin',
  'Ekspert': 'games_tier_ekspert',
  'Asan': 'games_tier_asan',
  'Usta': 'games_tier_usta',
  'Əfsanə': 'games_tier_efsane',
};

String trTierName(String name) {
  final key = _tierKeys[name];
  return key != null ? tr(key, name) : name;
}
