// Ported from: src/lib/premium-funnel.test.ts, src/hooks/usePaywallConfig.test.tsx, src/lib/premium-i18n.test.ts
import 'package:anacan/core/i18n/i18n.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';

void main() {
  setUp(installTestI18n);

  group('premium funnel client', () {
    late List<(String, Map<String, Object?>)> calls;
    late String platform;
    String? stage;
    late PremiumFunnel funnel;
    var throwSync = false, rejectAsync = false;
    setUp(() {
      calls = [];
      platform = 'android';
      stage = 'bump';
      throwSync = false;
      rejectAsync = false;
      funnel = PremiumFunnel(
        rpc: (name, args) {
          if (throwSync) throw StateError('offline');
          calls.add((name, args));
          return rejectAsync ? Future.error(StateError('offline')) : Future.value(true);
        },
        platform: () => platform,
        lifeStage: () => stage,
      );
    });

    test('normalises sources like the server', () {
      expect(normaliseFunnelSource('Tool AI'), 'tool_ai');
      expect(normaliseFunnelSource('onboarding:paywall'), 'onboarding:paywall');
      expect(normaliseFunnelSource(''), 'other');
      expect(normaliseFunnelSource(null), 'other');
      expect(normaliseFunnelSource('x' * 80), hasLength(48));
    });
    test('sends the hit with platform and life stage, and throttles paywall_shown per source for 10 minutes', () {
      funnel.funnelHit('paywall_shown', 'tool_ai', 1000);
      funnel.funnelHit('paywall_shown', 'tool_ai', 2000);
      funnel.funnelHit('paywall_shown', 'onboarding', 2000);
      expect(calls, hasLength(2));
      expect(calls.first.$1, 'premium_funnel_hit_v1');
      expect(calls.first.$2, {'p_event': 'paywall_shown', 'p_source': 'tool_ai', 'p_platform': 'android', 'p_life_stage': 'bump'});
      funnel.funnelHit('paywall_shown', 'tool_ai', 1000 + 10 * 60000 + 1);
      expect(calls, hasLength(3));
    });
    test('ignores unknown events and never throws when the client fails', () {
      funnel.funnelHit('nope', 'x');
      expect(calls, isEmpty);
      throwSync = true;
      expect(() => funnel.funnelHit('paywall_clicked', 'x'), returnsNormally);
      throwSync = false;
      rejectAsync = true;
      expect(() => funnel.purchaseIntent('x', 'yearly'), returnsNormally);
    });
    test('records the buy tap with platform and plan; unknown plans become unknown', () {
      platform = 'ios';
      stage = null;
      funnel.purchaseIntent('Billing', 'yearly', 5000);
      funnel.purchaseIntent('Billing', 'yearly', 5500);
      funnel.purchaseIntent('billing', 'weekly', 9000);
      expect(calls.map((c) => c.$1), ['premium_purchase_intent_v1', 'premium_purchase_intent_v1']);
      expect(calls.map((c) => c.$2), [
        {'p_source': 'billing', 'p_platform': 'ios', 'p_plan': 'yearly'},
        {'p_source': 'billing', 'p_platform': 'ios', 'p_plan': 'unknown'},
      ]);
    });
    test('maps a non-native platform to web', () {
      platform = 'electron';
      funnel.funnelHit('restore_clicked', 'billing');
      expect(calls.single.$2['p_platform'], 'web');
    });
  });

  group('localized Premium configuration', () {
    for (final language in kAppLanguageCodesForTest) {
      test('does not replace $language copy with the live Azerbaijani admin configuration', () {
        final defaults = getDefaultPaywallConfig();
        final paywall = resolvePaywallConfig({
          ...defaults.values,
          'subtitle': 'Tam təcrübə · Limitsiz imkanlar',
          'gradient_from': '#123456',
          'free_trial_enabled': true,
          'free_trial_days': 14,
        }, language, lookup: (_, _) => null);
        final billing = resolveBillingConfig({...getDefaultBillingConfig().values, 'header_gradient_from': '#abcdef'}, language, lookup: (_, _) => null);
        expect(paywall.yearlyLabel, defaults.yearlyLabel);
        expect(paywall.monthlyLabel, defaults.monthlyLabel);
        expect(paywall.cancelNotice, defaults.cancelNotice);
        expect(paywall.pills.map((p) => p.text), defaults.pills.map((p) => p.text));
        expect(billing.pills.map((p) => p.text), getDefaultBillingConfig().pills.map((p) => p.text));
        if (language != 'az') expect(paywall.subtitle, defaults.subtitle);
        expect(paywall.gradientFrom, '#123456');
        expect(billing.s('header_gradient_from'), '#abcdef');
        expect(paywall.freeTrialEnabled, isFalse);
        expect(paywall.freeTrialDays, 0);
      });
    }

    test('uses explicit translated admin copy and preserves deliberately empty labels', () {
      final overrides = {'paywallcfg_subtitle': 'Un message personnalisé', 'paywallcfg_pill_1': 'Pour vous'};
      final config = resolvePaywallConfig({
        'subtitle': 'Xüsusi mətn',
        'native_notice': '',
        'pills': [
          {'icon': 'Heart', 'text': 'Xüsusi'},
        ],
      }, 'fr', lookup: (key, _) => overrides[key]);
      expect(config.subtitle, 'Un message personnalisé');
      expect(config.pills, [const PaywallPill(icon: 'Heart', text: 'Pour vous')]);
      expect(config.nativeNotice, '');
    });
  });

  group('public Premium source-bound copy', () {
    final row = <String, dynamic>{'id': '0591890c-70df-4ab3-a153-a0af339f386c', 'title': 'Blood Sugar Tracker', 'title_az': 'Qan Şəkəri', 'title_en': 'Blood Sugar Tracker'};
    // mapRowsTranslation without bundled content: an explicit `<field>_<lang>` column wins.
    List<Map<String, dynamic>> identity(List<Map<String, dynamic>> r, String l, List<String> f) => [
          for (final x in r) {...x, for (final field in f) if (x['${field}_$l'] is String) field: x['${field}_$l']},
        ];
    test('provides Georgian and Kazakh labels without falling back to Russian or Azerbaijani', () {
      expect(localizePremiumRows([row], 'ka', ['title'], mapRows: identity).first['title'], matches(RegExp('[Ⴀ-ჿ]')));
      expect(localizePremiumRows([row], 'kk', ['title'], mapRows: identity).first['title'], matches(RegExp('[Ѐ-ӿ]')));
      expect(localizePremiumRows([row], 'uz', ['title'], mapRows: identity).first['title'], isNot(row['title']));
    });
    test('preserves an explicit server translation', () {
      expect(localizePremiumRows([{...row, 'title_ka': 'ოპერატორის სათაური'}], 'ka', ['title'], mapRows: identity).first['title'], 'ოპერატორის სათაური');
    });
    test('does not reuse a label after any part of its source tuple changes', () {
      final translated = localizePremiumRows([row], 'ka', ['title'], mapRows: identity).first['title'];
      for (final field in ['title', 'title_az', 'title_en']) {
        expect(localizePremiumRows([{...row, field: 'Edited source'}], 'ka', ['title'], mapRows: identity).first['title'], isNot(translated));
      }
    });
  });
}

/// APP_LANGUAGE_CODES.
final List<String> kAppLanguageCodesForTest = [for (final l in kAppLanguages) l.code];
