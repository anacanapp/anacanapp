// Ported from: src/lib/paywall-stage-copy.ts
//
// Stage-specific paywall value copy (flow = cycle/TTC, bump = pregnancy, mommy = baby). Only features that
// are Premium in code; ad-free is always last; no free-trial promise. Changed texts use new keys (the live
// `translations` overlay would otherwise replace the seed values of old keys).

import '../../core/i18n/tr.dart';

/// 'flow' | 'bump' | 'mommy' | 'general'
typedef PaywallStage = String;

PaywallStage paywallStage(String? lifeStage) => lifeStage == 'flow' || lifeStage == 'bump' || lifeStage == 'mommy' ? lifeStage! : 'general';

class PaywallFeature {
  const PaywallFeature(this.icon, this.title);
  final String icon;
  final String title;
}

String paywallHeadline(PaywallStage stage) => switch (stage) {
      'bump' => tr('pw_head_bump', 'Təpiklər, sancılar və həkim hesabatı bir yerdə'),
      'mommy' => tr('pw_head_mommy', 'Körpənizin qidalanması, yuxusu və böyüməsi bir yerdə'),
      'flow' => tr('pw_head_flow', 'Tsiklinizi qeydlərlə daha dəqiq tanıyın'),
      _ => tr('pw_head_general', 'Mərhələnizə uyğun bütün alətlər bir yerdə'),
    };

List<PaywallFeature> paywallFeatures(PaywallStage stage) {
  final reports = PaywallFeature('📄', tr('pw_feat_reports', 'Həkim üçün PDF hesabatlar'));
  final ai = PaywallFeature('🤖', tr('pw_feat_ai_daily', 'Gündəlik limitsiz Anacan AI'));
  final household = PaywallFeature('💑', tr('pw_feat_household', 'Partnyorla ortaq Premium'));
  final sounds = PaywallFeature('🎵', tr('pw_feat_whitenoise', 'Ağ səs və yuxu səsləri'));
  final noAds = PaywallFeature('🚫', tr('pw_feat_noads', 'Tam reklamsız təcrübə'));
  return switch (stage) {
    'bump' => [
        PaywallFeature('🦶', tr('pw_feat_kicks', 'Təpik və sancı sayğacı')),
        PaywallFeature('⚖️', tr('pw_feat_body', 'Çəki, təzyiq və şəkər qeydləri')),
        reports, ai, household, noAds,
      ],
    'mommy' => [
        PaywallFeature('🍼', tr('pw_feat_babycare', 'Qidalanma, yuxu və bez qeydləri')),
        PaywallFeature('📈', tr('pw_feat_growth', 'ÜST boy-çəki əyriləri')),
        sounds, reports, ai, noAds,
      ],
    'flow' => [
        PaywallFeature('📝', tr('pw_feat_flow_log', 'Gündəlik qeydlə dəqiq proqnoz')),
        PaywallFeature('🧠', tr('pw_feat_symptoms', 'Fazalara görə simptom analizi')),
        PaywallFeature('📊', tr('pw_feat_cycle_stats', 'Tsikl statistikası və trendlər')),
        reports, ai, noAds,
      ],
    _ => [
        PaywallFeature('🛠️', tr('pw_feat_tools', 'Bütün alətlərə tam giriş')),
        reports, ai, household, sounds, noAds,
      ],
  };
}

/// Real public figures (2026-11): 46 000+ downloads, App Store rating 4.84. Never invent numbers.
({String rating, String downloads}) paywallSocialProof() =>
    (rating: tr('pw_social_rating', '4,84★ App Store reytinqi'), downloads: tr('pw_social_downloads', '46 000+ yükləmə'));
