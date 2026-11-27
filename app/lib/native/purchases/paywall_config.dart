// Ported from: src/hooks/usePaywallConfig.ts
//
// Admin-editable paywall / billing copy (`app_settings.premium_paywall_config`, `billing_page_config`). Defaults
// are resolved lazily with `tr` so they follow the language. A single-language admin value only applies to az;
// other languages use `paywallcfg_<field>` / `billingcfg_<field>` translations or their own default. Free trial
// presentation is always off (no new purchase advertises or auto-selects a trial).

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/i18n.dart';
import 'app_setting.dart';

class PaywallPill {
  const PaywallPill({required this.icon, required this.text});
  final String icon;
  final String text;
  @override
  bool operator ==(Object other) => other is PaywallPill && other.icon == icon && other.text == text;
  @override
  int get hashCode => Object.hash(icon, text);
}

/// `PaywallConfig` as a string/value map with typed accessors (admin JSON keys unchanged).
class PaywallConfig {
  const PaywallConfig(this.values, this.pills);
  final Map<String, Object?> values;
  final List<PaywallPill> pills;

  String s(String key) => '${values[key] ?? ''}';
  String get title => s('title');
  String get subtitle => s('subtitle');
  String get ctaNewUser => s('cta_new_user');
  String get yearlyLabel => s('yearly_label');
  String get monthlyLabel => s('monthly_label');
  String get savingsBadge => s('savings_badge');
  String get yearlySuffix => s('yearly_suffix');
  String get monthlySuffix => s('monthly_suffix');
  String get yearlyTotalSuffix => s('yearly_total_suffix');
  String get featureLockText => s('feature_lock_text');
  String get restoreText => s('restore_text');
  String get termsLabel => s('terms_label');
  String get privacyLabel => s('privacy_label');
  String get cancelNotice => s('cancel_notice');
  String get nativeNotice => s('native_notice');
  String get nonNativeNotice => s('non_native_notice');
  String get purchasingText => s('purchasing_text');
  bool get freeTrialEnabled => values['free_trial_enabled'] == true;
  num get freeTrialDays => (values['free_trial_days'] as num?) ?? 0;
  String get gradientFrom => s('gradient_from');
}

Map<String, Object?> defaultPaywallValues() => {
      'title': 'Anacan Premium',
      'subtitle': tr('usepaywallconfig_subtitle_v2', 'Sizə uyğun tam Anacan təcrübəsi'),
      'cta_new_user': tr('usepaywallconfig_premium_a_kec_2e8b0e', 'Premium-a Keç'),
      'cta_upgrade': tr('usepaywallconfig_plani_yenile_3ad3f4', 'Planı Yenilə'),
      'cta_switch_yearly': tr('usepaywallconfig_i_llik_plana_kec_bdf27a', 'İllik Plana Keç'),
      'yearly_label': tr('usepaywallconfig_illik', 'İllik'),
      'monthly_label': tr('usepaywallconfig_ayliq_6f265e', 'Aylıq'),
      'savings_badge': tr('usepaywallconfig_percent_qenaet_a627e2', '{percent}% QƏNAƏT'),
      'yearly_suffix': tr('usepaywallconfig_yearly_suffix', '/ay'),
      'monthly_suffix': tr('usepaywallconfig_monthly_suffix', '/ay'),
      'yearly_total_suffix': tr('usepaywallconfig_yearly_total_suffix', '/il'),
      'feature_lock_text': tr('usepaywallconfig_feature_ucun_premium_lazimdir_4800ff', '{feature} üçün Premium lazımdır'),
      'restore_text': tr('usepaywallconfig_berpa_et_6c3210', 'Bərpa et'),
      'terms_label': tr('usepaywallconfig_sertler_d86d4e', 'Şərtlər'),
      'privacy_label': tr('usepaywallconfig_mexfilik_b641fc', 'Məxfilik'),
      'cancel_notice': tr('usepaywallconfig_i_stenilen_vaxt_legv_ede_biler_cc073d', 'İstənilən vaxt ləğv edə bilərsiniz • Avtomatik yenilənir'),
      'native_notice': '',
      'non_native_notice': tr('usepaywallconfig_app_store_google_play_den_yukl_1a75c6', 'App Store / Google Play-dən yükləyin'),
      'free_trial_enabled': false,
      'free_trial_days': 0,
      'free_trial_badge': '',
      'free_trial_cta': '',
      'free_trial_note': '',
      'purchasing_text': tr('paywall_emal_edilir', 'Emal edilir...'),
      'gradient_from': '#FF8D89',
      'gradient_via': '#FF5A5F',
      'gradient_to': '#D93A40',
    };

/// Only real Premium features: AI has no daily limit (free: 10 a day), ad-free last.
List<PaywallPill> defaultPaywallPills() => [
      PaywallPill(icon: 'Sparkles', text: tr('paywall_pill_ai_daily', 'Gündəlik limitsiz AI')),
      PaywallPill(icon: 'Users', text: tr('pw_feat_household', 'Partnyorla ortaq Premium')),
      PaywallPill(icon: 'Shield', text: tr('usepaywallconfig_reklamsiz_cc4ba5', 'Reklamsız')),
    ];

PaywallConfig getDefaultPaywallConfig() => PaywallConfig(defaultPaywallValues(), defaultPaywallPills());

Map<String, Object?> defaultBillingValues() => {
      'page_title': tr('usepaywallconfig_abuneliyim_f6c8ed', 'Abunəliyim'),
      'free_plan_name': tr('paywall_pulsuz_plan', 'Pulsuz Plan'),
      'premium_monthly_name': tr('usepaywallconfig_premium_ayliq_7f604a', 'Premium Aylıq'),
      'premium_yearly_name': tr('usepaywallconfig_premium_illik', 'Premium İllik'),
      'active_badge': tr('paywall_aktiv', 'Aktiv'),
      'cancelled_badge': tr('usepaywallconfig_legv_edilib_24db12', 'Ləğv edilib'),
      'start_date_label': tr('usepaywallconfig_baslama_9f32b6', 'Başlama'),
      'renewal_label': tr('usepaywallconfig_yenilenme_8e3032', 'Yenilənmə'),
      'expiry_label': tr('paywall_premium_bitir', 'Premium bitir'),
      'cancelled_notice': tr('usepaywallconfig_date_tarixine_qeder_premium_ak_9c0a37', '{date} tarixinə qədər Premium aktiv qalacaq.'),
      'features_title': tr('usepaywallconfig_planiniza_daxildir_4a6141', 'Planınıza daxildir'),
      'upgrade_cta': tr('usepaywallconfig_i_llik_plana_kec_bdf27a', 'İllik Plana Keç'),
      'upgrade_savings': tr('usepaywallconfig_percent_qenaet_5a6e02', '{percent}% qənaət'),
      'restore_cta': tr('usepaywallconfig_abuneliyi_berpa_et_9e9e21', 'Abunəliyi Bərpa Et'),
      'cancel_cta': tr('usepaywallconfig_abuneliyi_legv_et_83e5de', 'Abunəliyi Ləğv Et'),
      'get_premium_cta': tr('usepaywallconfig_premium_a_kec_2e8b0e', 'Premium-a Keç'),
      'payment_title': tr('usepaywallconfig_son_odenis_23031a', 'Son ödəniş'),
      'paid_label': tr('usepaywallconfig_odenildi_504c21', 'Ödənildi'),
      'support_text': tr('usepaywallconfig_suallariniz_ucun_872f23', 'Suallarınız üçün:'),
      'support_email': 'info@anacan.az',
      'header_gradient_from': '#FF8D89',
      'header_gradient_via': '#FF5A5F',
      'header_gradient_to': '#D93A40',
      'header_free_from': '#475569',
      'header_free_via': '#334155',
      'header_free_to': '#1e293b',
    };

List<PaywallPill> defaultBillingFeatures() => [
      PaywallPill(icon: 'Zap', text: tr('usepaywallconfig_limitsiz_ai', 'Limitsiz AI')),
      PaywallPill(icon: 'Shield', text: tr('usepaywallconfig_reklamsiz_cc4ba5', 'Reklamsız')),
      PaywallPill(icon: 'Crown', text: tr('usepaywallconfig_premium_fonlar', 'Premium fonlar')),
      PaywallPill(icon: 'Sparkles', text: tr('usepaywallconfig_prioritet_destek_3f6f91', 'Prioritet dəstək')),
    ];

PaywallConfig getDefaultBillingConfig() => PaywallConfig(defaultBillingValues(), defaultBillingFeatures());

const List<String> paywallTextFields = [
  'title', 'subtitle', 'cta_new_user', 'cta_upgrade', 'cta_switch_yearly', //
  'yearly_label', 'monthly_label', 'savings_badge', 'yearly_suffix', 'monthly_suffix',
  'yearly_total_suffix', 'feature_lock_text', 'restore_text', 'terms_label', 'privacy_label',
  'cancel_notice', 'native_notice', 'non_native_notice', 'free_trial_badge', 'free_trial_cta',
  'free_trial_note', 'purchasing_text',
];

const List<String> billingTextFields = [
  'page_title', 'free_plan_name', 'premium_monthly_name', 'premium_yearly_name', //
  'active_badge', 'cancelled_badge', 'start_date_label', 'renewal_label', 'expiry_label',
  'cancelled_notice', 'features_title', 'upgrade_cta', 'upgrade_savings', 'restore_cta',
  'cancel_cta', 'get_premium_cta', 'payment_title', 'paid_label', 'support_text',
];

/// `getCachedTranslation(key, language)`.
typedef CachedTranslation = String? Function(String key, String language);

String? _cached(String key, String language) => I18nRuntime.instance.store.lookup(key, language);

String _localizeText(String prefix, String field, Object? value, String fallback, String language, CachedTranslation lookup) {
  if (value is! String) return fallback;
  if (value.trim().isEmpty || language == 'az') return value;
  final localized = lookup('${prefix}_$field', language);
  return localized != null && localized.trim().isNotEmpty && localized != value ? localized : fallback;
}

PaywallConfig _resolve(Object? raw, String language, PaywallConfig defaults, List<String> fields, String prefix, String listKey,
    String itemPrefix, CachedTranslation lookup) {
  if (raw is! Map) return defaults;
  final merged = <String, Object?>{...defaults.values, ...raw.cast<String, Object?>()};
  for (final f in fields) {
    if (raw.containsKey(f)) merged[f] = _localizeText(prefix, f, raw[f], '${defaults.values[f] ?? ''}', language, lookup);
  }
  var list = defaults.pills;
  final rawList = raw[listKey];
  if (rawList is List) {
    final out = <PaywallPill>[];
    var i = 0;
    for (final p in rawList) {
      if (p is! Map) continue; // filtered before indexing, as in the TypeScript
      final fallback = i < defaults.pills.length ? defaults.pills[i].text : '';
      final text = _localizeText(prefix, '$itemPrefix${i + 1}', p['text'], fallback, language, lookup);
      i++;
      if (text.isNotEmpty) out.add(PaywallPill(icon: '${p['icon'] ?? ''}', text: text));
    }
    list = out;
  }
  return PaywallConfig(merged, list);
}

/// `usePaywallConfig()` for an admin value [raw] and [language].
PaywallConfig resolvePaywallConfig(Object? raw, String language, {CachedTranslation lookup = _cached}) {
  final defaults = getDefaultPaywallConfig();
  final merged = _resolve(raw, language, defaults, paywallTextFields, 'paywallcfg', 'pills', 'pill_', lookup);
  // Retired presentation keys stay readable for old admin configurations; nothing advertises a trial.
  return PaywallConfig({
    ...merged.values,
    'free_trial_enabled': false,
    'free_trial_days': 0,
    'free_trial_badge': '',
    'free_trial_cta': '',
    'free_trial_note': '',
  }, merged.pills);
}

/// `useBillingConfig()` (features list in [PaywallConfig.pills]).
PaywallConfig resolveBillingConfig(Object? raw, String language, {CachedTranslation lookup = _cached}) =>
    _resolve(raw, language, getDefaultBillingConfig(), billingTextFields, 'billingcfg', 'features', 'feature_', lookup);

final paywallConfigProvider = Provider<PaywallConfig>((ref) =>
    resolvePaywallConfig(ref.watch(appSettingProvider('premium_paywall_config')), ref.watch(appLanguageProvider)));

final billingConfigProvider = Provider<PaywallConfig>((ref) =>
    resolveBillingConfig(ref.watch(appSettingProvider('billing_page_config')), ref.watch(appLanguageProvider)));
