// Ported from: src/lib/parenting-search.test.ts ('Tərbiyə search normalisation'), src/data/play-together/tile.ts and
//              src/data/kid-exercises/tile.ts (fallbacks; tile/registry agreement of kid-exercises-i18n.test.ts against
//              the generated table), src/lib/feature37-i18n.ts / src/lib/followup-i18n.ts (generated subset), and the
//              access / availability / hint rules of src/components/ToolsHub.tsx
import 'dart:convert';
import 'dart:io';

import 'package:anacan/design/icons.g.dart';
import 'package:anacan/features/tools/hub/fold_text.dart';
import 'package:anacan/features/tools/hub/hub_copy.dart';
import 'package:anacan/features/tools/hub/hub_copy.g.dart';
import 'package:anacan/features/tools/hub/hub_model.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../support/tools_harness.dart';

Map<String, dynamic> _json(String path) => jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  setUp(installTestI18n);

  group('Tərbiyə search normalisation', () {
    test('folds Azerbaijani letters and diacritics', () {
      expect(foldText('Uşaq YATMIR, gecə qorxur!'), 'usaq yatmir gece qorxur');
      expect(foldText('ƏŞÇĞÖÜİI əşçğöüıi'), 'escgouii escgouii');
      expect(foldText('“Səni sevmirəm!” — dedi'), 'seni sevmirem dedi');
      expect(foldText('Éducation à l’école'), 'education a l ecole');
    });

    test('foldWords and the Aptek query fold', () {
      expect(foldWords('  Ağlama,  tərcüməçisi '), ['aglama', 'tercumecisi']);
      expect(foldQuery('  Vitamin Ə '), 'vitamin ə');
      expect(foldQuery('Café'), 'cafe');
    });
  });

  group('generated hub copy', () {
    test('matches scripts/i18n feature37 / followup copy', () {
      final f37 = _json('../scripts/i18n/feature37-copy.json')['languages'] as Map<String, dynamic>;
      final f36 = _json('../scripts/i18n/followup36-copy.json')['languages'] as Map<String, dynamic>;
      for (final lang in f37.keys) {
        for (final key in ['sfg_home_title', 'sfg_tool_desc']) {
          expect(kHubFeature37Copy[lang]?[key], (f37[lang] as Map)[key], reason: '$lang $key');
        }
        expect(kHubFollowupCopy[lang]?['names_country'], (f36[lang] as Map)['names_country'], reason: lang);
      }
    });

    test('tile text and content languages list the same languages', () {
      expect(kPlayTileText.keys.toSet(), kPlayContentLanguages.toSet());
      expect(kKidExTileText.keys.toSet(), kKidExContentLanguages.toSet());
      expect(kKidExContentLanguages, hasLength(25));
    });

    test('lookups and fallbacks', () {
      expect(hasPlayContent('az'), isTrue);
      expect(hasPlayContent(null), isFalse);
      expect(hasKidExContent('xx'), isFalse);
      expect(playTileText('xx'), playTileText('en'));
      expect(kidExTileText('xx'), kidExTileText('en'));
      expect(hubFeature37Text('sfg_home_title', 'en'), 'Solid Food Guide');
      expect(hubFollowupText('names_country', 'en', {'country': 'Azerbaijan'}), 'Baby names used in Azerbaijan');
      expect(hubFollowupText('names_country', 'en'), 'Baby names used in {country}');
      expect(weaningTileText('weaning_tool_name'), 'Süddən ayırma');
      expect(parentingTileText('par_tool_name'), 'Tərbiyə');
    });
  });

  group('hub model', () {
    const mommy = HubContext(lifeStage: 'mommy', language: 'az', disabledTools: ['kid-exercises']);

    test('access uses the DB row (premium flag, admin premium_type, stage lock) when loaded', () {
      final rows = configs([
        cfg('first-aid', 'İlk yardım', {'is_premium': false}),
        cfg('doctors', 'Həkimlər', {'is_premium': false, 'mommy_locked': true}),
        cfg('horoscope', 'Bürc'),
      ]);
      expect(hubAccessFor('first-aid', rows, 'mommy'), 'free');
      expect(hubAccessFor('doctors', rows, 'mommy'), 'premium');
      expect(hubAccessFor('doctors', rows, 'bump'), 'free');
      expect(hubAccessFor('horoscope', rows, 'mommy'), 'limited');
      expect(hubAccessFor('whitenoise', rows, 'mommy'), 'preview');
      expect(hubAccessFor('kick', const [], 'mommy'), 'premium');
    });

    test('names tile description names the regional country; partner names when linked', () {
      final rows = configs([
        cfg('names', 'Adlar', {'is_premium': false, 'life_stages': ['bump']}),
        cfg('shopping', 'Alış-veriş', {'requires_partner': true, 'partner_name': 'Birgə alış', 'partner_description': 'Partnyorla'}),
      ]);
      final tools = buildHubTools(rows, const HubContext(lifeStage: 'bump', language: 'en', countryCode: 'TR', hasPartner: true));
      expect(tools[0].description, startsWith('Baby names used in '));
      expect(tools[1].name, 'Birgə alış');
      expect(tools[1].description, 'Partnyorla');
      final solo = buildHubTools(rows, const HubContext(lifeStage: 'bump'));
      expect(solo[1].name, 'Alış-veriş');
    });

    test('code tools keep their own eligibility', () {
      final rows = configs([
        cfg('cakes', 'row', {'is_premium': false}),
        cfg('solid-food-guide', 'row'),
        cfg('play-together', 'row', {'is_premium': false}),
        cfg('sleep-training', 'row'),
      ]);
      expect(buildHubTools(rows, const HubContext(lifeStage: 'flow')).map((t) => t.id), isEmpty);
      expect(buildHubTools(rows, mommy).map((t) => t.id), ['cakes', 'solid-food-guide', 'play-together']);
      expect(buildHubTools(rows, const HubContext(lifeStage: 'mommy', profileCountryCode: 'TR', disabledTools: ['kid-exercises'])).map((t) => t.id),
          ['solid-food-guide', 'play-together']);
      final withBaby = HubContext(lifeStage: 'mommy', childBirthDate: '2026-08-01', now: DateTime(2026, 11, 27), disabledTools: const ['kid-exercises']);
      expect(buildHubTools(rows, withBaby).map((t) => t.id), contains('sleep-training'));
      expect(buildHubTools(rows, const HubContext(lifeStage: 'flow', isAdmin: true)).map((t) => t.id), ['cakes', 'play-together', 'kid-exercises']);
    });

    test('availability and hints', () {
      const tool = HubTool(id: 'kick', name: 'Təpik', description: '', icon: _icon, stages: ['bump'], minWeek: 20);
      expect(isHubToolAvailable(tool, const HubContext(lifeStage: 'bump', currentWeek: 19)), isFalse);
      expect(isHubToolAvailable(tool, const HubContext(lifeStage: 'bump', currentWeek: 20)), isTrue);
      expect(isHubToolAvailable(tool, const HubContext(lifeStage: 'mommy')), isFalse);
      expect(isHubToolAvailable(tool, const HubContext(lifeStage: 'mommy', isAdmin: true)), isTrue);
      expect(unavailableHint(tool, 'bump'), '20. həftədən');
      expect(unavailableHint(tool, 'mommy'), 'Başqa mərhələ üçün');
    });

    test('lists: merged-away children hidden where the host is listed; hero order; search', () {
      final rows = configs([
        cfg('whitenoise', 'Ağ səs', {'is_premium': false}),
        cfg('noise-meter', 'Səs ölçən', {'is_premium': false}),
        cfg('mood', 'Əhval', {'is_premium': false}),
        cfg('first-aid', 'İlk yardım', {'is_premium': false, 'is_hero': true, 'hero_order': 1}),
      ]);
      final tools = buildHubTools(rows, mommy);
      final lists = hubLists(tools, rows, '');
      expect(lists.displayed.map((t) => t.id), ['whitenoise', 'mood', 'first-aid']);
      expect(lists.free.map((t) => t.id), ['first-aid', 'mood']);
      expect(lists.premium.map((t) => t.id), ['whitenoise']);
      expect(hubLists(tools, rows, 'ILK').displayed.map((t) => t.id), ['first-aid']);
    });
  });
}

const _icon = AIcons.wrench;
