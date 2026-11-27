// Ported from: src/lib/stories.test.ts, src/lib/server-stories.test.ts
import 'dart:convert';

import 'package:anacan/features/stories/data/story_illustrations.g.dart';
import 'package:anacan/features/stories/stories.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final tables = StoryTables.az;
  const tools = {
    'fetal-growth',
    'kick',
    'nutrition',
    'danger-signs',
    'baby-growth',
    'whitenoise',
    'solid-food-guide',
    'mental-health',
    'exercise',
    'vitamin-tracker',
    'mood',
    'hospital',
    'blood-sugar',
    'blood-pressure',
    'safety',
    'contraction',
    'names',
    'baby-tracker',
    'teething',
    'cry-translator',
    'sleep-training',
    'first-aid',
    'mini-games',
    'vaccine-calendar',
    'weather-clothing',
    'noise-meter',
    'blog',
    'fairy-tale',
    'doctors',
    'shopping',
  };
  const screens = {'calendar', 'partner-sharing', 'billing', 'doctor-report', 'recovery'};

  group('story helpers', () {
    test('builds Azerbaijani ordinals', () {
      expect([1, 3, 6, 9, 10, 12, 20, 23, 26, 30, 40].map((n) => '$n${azOrdinal(n)}').toList(), [
        '1-ci',
        '3-cü',
        '6-cı',
        '9-cu',
        '10-cu',
        '12-ci',
        '20-ci',
        '23-cü',
        '26-cı',
        '30-cu',
        '40-cı',
      ]);
    });
    test('parses markers without HTML', () {
      expect(parseStoryText('Körpən ==banan== __boydadır__ **indi**'), [
        (text: 'Körpən ', kind: StoryTextKind.plain),
        (text: 'banan', kind: StoryTextKind.mark),
        (text: ' ', kind: StoryTextKind.plain),
        (text: 'boydadır', kind: StoryTextKind.hl),
        (text: ' ', kind: StoryTextKind.plain),
        (text: 'indi', kind: StoryTextKind.bold),
      ]);
    });
    test('is shown to admins in admin mode, to everyone when on, and only in Azerbaijani', () {
      expect(storiesEnabledFor('admin', isAdmin: true, language: 'az'), isTrue);
      expect(storiesEnabledFor('admin', isAdmin: false, language: 'az'), isFalse);
      expect(storiesEnabledFor('on', isAdmin: false, language: 'az'), isTrue);
      expect(storiesEnabledFor('on', isAdmin: false, language: 'ru'), isFalse);
      expect(storiesEnabledFor('on', isAdmin: true, language: 'az', role: 'partner'), isFalse);
      expect(storiesEnabledFor('off', isAdmin: true, language: 'az'), isFalse);
    });
  });

  group('story audience', () {
    List<Object?> pick(StoryContext ctx) => [
      for (final s in tables.stories)
        if (storyMatches(s, ctx, storyVars(ctx, tables))) s['id'],
    ];
    test('fits the pregnancy week', () {
      final w10 = pick(const StoryContext(stage: 'bump', week: 10));
      final w34 = pick(const StoryContext(stage: 'bump', week: 34));
      expect(w10, contains('bump-folic'));
      expect(w10, isNot(contains('bump-bag')));
      expect(w34, contains('bump-bag'));
      expect(w34, isNot(contains('bump-folic')));
      expect(w34, isNot(contains('mom-hunger')));
    });
    test('fits the baby age and hides personal stories without data', () {
      expect(pick(const StoryContext(stage: 'mommy', babyMonths: 7, babyName: 'Nuray')), contains('mom-teething'));
      expect(pick(const StoryContext(stage: 'mommy', babyMonths: 1)), isNot(contains('mom-teething')));
      expect(pick(const StoryContext(stage: 'mommy')), isNot(contains('mom-this-month')));
    });
    test('fits the cycle phase', () {
      expect(pick(const StoryContext(stage: 'flow', cycleDay: 2)), contains('flow-iron'));
      expect(pick(const StoryContext(stage: 'flow', cycleDay: 20)), isNot(contains('flow-iron')));
      expect(pick(const StoryContext(stage: 'flow', cycleDay: 20)), contains('flow-pms'));
    });
    test('hides the Premium promo from Premium users', () {
      expect(pick(const StoryContext(stage: 'mommy', babyMonths: 3, isPremium: true)), isNot(contains('all-premium')));
      expect(pick(const StoryContext(stage: 'mommy', babyMonths: 3, isPremium: false)), contains('all-premium'));
    });
    test('uses the exact fruit size for the week when the app has it', () {
      final v = storyVars(const StoryContext(stage: 'bump', week: 26, fruit: (name: 'Gül kələm', lengthCm: 35.6, weightG: 760)), tables);
      expect([v['weekLabel'], v['fruit'], v['lengthCm'], v['weightG']], ['26-cı həftə', 'gül kələm', '36', '760']);
    });
    test('fills the week story from the table', () {
      final v = storyVars(const StoryContext(stage: 'bump', week: 24), tables);
      expect(v['weekLabel'], '24-cü həftə');
      expect(v['fruit'], 'qarğıdalı');
    });
  });

  group('story data', () {
    test('has many stories with valid themes, art, templates, links and plain copy', () {
      expect(tables.stories.length, greaterThanOrEqualTo(80));
      final ids = <Object?>{};
      for (final s in tables.stories) {
        expect(ids.contains(s['id']), isFalse, reason: '${s['id']}');
        ids.add(s['id']);
        expect(storyThemes[s['theme']], isNotNull, reason: '${s['id']}');
        expect(illustrationTemplates.keys, contains(s['illus']), reason: '${s['id']}');
        expect(RegExp('[—–<>]').hasMatch(jsonEncode(s)), isFalse, reason: '${s['id']}');
        for (final sl in (s['slides'] as List).cast<Map<String, dynamic>>()) {
          if (sl['illus'] != null) expect(illustrationTemplates.keys, contains(sl['illus']), reason: '${s['id']}');
          if (sl['t'] == 'quiz') expect((sl['correct'] as num) >= 0 && (sl['correct'] as num) < (sl['options'] as List).length, isTrue);
          final cta = sl['cta'] as Map?;
          if (cta != null) {
            final n = cta['nav'] as Map;
            final ok = n['tool'] != null
                ? tools.contains(n['tool'])
                : n['tab'] != null
                ? ['ai', 'community'].contains(n['tab'])
                : screens.contains(n['screen']);
            expect(ok, isTrue, reason: '${s['id']} $n');
          }
        }
        const allowed = [
          'week',
          'weekLabel',
          'fruit',
          'lengthCm',
          'weightG',
          'weekNote',
          'babyName',
          'babyMonths',
          'milestone',
          'milestoneShort',
          'cycleDay',
          'cycleLabel',
          'phase',
          'phaseTip',
        ];
        expect(storyVarsUsed(s).every(allowed.contains), isTrue, reason: '${s['id']}');
      }
    });
  });

  // ── server-stories.test.ts ──
  final bundled = <Story>[
    {
      'id': 'aa',
      'module': 'bump',
      'title': 'A',
      'theme': 'coral',
      'illus': 'fruit',
      'slides': [
        {'t': 'cover', 'title': 'A'},
      ],
    },
    {
      'id': 'bb',
      'module': 'all',
      'title': 'B',
      'theme': 'lime',
      'illus': 'heart',
      'slides': [
        {'t': 'cover', 'title': 'B'},
      ],
    },
  ];
  Map<String, Object?> row(String id, Object? story, [Map<String, Object?> extra = const {}]) => {
    'id': id,
    'action': 'show',
    'story': story,
    ...extra,
  };

  group('server stories', () {
    test('keeps a valid story and drops unknown fields', () {
      final s = sanitizeStory('new-one', {
        'module': 'mommy',
        'title': 'Yeni',
        'theme': 'nope',
        'illus': 'x',
        'evil': '<script>',
        'slides': [
          {'t': 'fact', 'value': '7', 'body': 'ok', 'html': '<b>'},
        ],
      });
      expect(s?['id'], 'new-one');
      expect(s?['module'], 'mommy');
      expect(s?['theme'], 'coral');
      expect(s?['slides'], [
        {'t': 'fact', 'body': 'ok', 'value': '7'},
      ]);
      expect(jsonEncode(s), isNot(contains('script')));
      expect(jsonEncode(s), isNot(contains('html')));
    });
    test('rejects bad ids, modules and empty slide lists', () {
      expect(
        sanitizeStory('Bad ID', {
          'module': 'all',
          'title': 'x',
          'slides': [
            {'t': 'cover', 'title': 'x'},
          ],
        }),
        isNull,
      );
      expect(
        sanitizeStory('ok-id', {
          'module': 'boss',
          'title': 'x',
          'slides': [
            {'t': 'cover', 'title': 'x'},
          ],
        }),
        isNull,
      );
      expect(
        sanitizeStory('ok-id', {
          'module': 'all',
          'title': 'x',
          'slides': [
            {'t': 'video', 'title': 'x'},
          ],
        }),
        isNull,
      );
    });
    test('drops broken quiz and cta slides and unsafe navigation', () {
      expect(
        sanitizeSlide({
          't': 'quiz',
          'title': 'q',
          'options': ['a', 'b'],
          'correct': 5,
        }),
        isNull,
      );
      expect(
        sanitizeSlide({
          't': 'cta',
          'title': 'c',
          'cta': {
            'label': 'Go',
            'nav': {'tool': 'javascript:alert(1)'},
          },
        }),
        isNull,
      );
      expect(
        ((sanitizeSlide({
                  't': 'cta',
                  'title': 'c',
                  'cta': {
                    'label': 'Go',
                    'nav': {'tool': 'fetal-growth'},
                  },
                })?['cta']
                as Map)['nav']
            as Map)['tool'],
        'fetal-growth',
      );
    });
    test('merges: replace in place, hide, new ones first by sort', () {
      final server = parseServerStories([
        row('bb', {
          'module': 'all',
          'title': 'B2',
          'slides': [
            {'t': 'cover', 'title': 'B2'},
          ],
        }),
        {'id': 'aa', 'action': 'hide'},
        row(
          'n1',
          {
            'module': 'all',
            'title': 'N1',
            'slides': [
              {'t': 'cover', 'title': 'N1'},
            ],
          },
          {'sort': 1},
        ),
        row(
          'n2',
          {
            'module': 'all',
            'title': 'N2',
            'slides': [
              {'t': 'cover', 'title': 'N2'},
            ],
          },
          {'sort': 5},
        ),
        row('bad', {'module': 'all'}),
      ]);
      expect([for (final s in mergeStories(bundled, server)) s['title']], ['N2', 'N1', 'B2']);
    });
    test('falls back to bundled stories without server data', () {
      expect(identical(mergeStories(bundled, null), bundled), isTrue);
      expect(mergeStories(bundled, parseServerStories('nonsense')), bundled);
    });
  });
}
