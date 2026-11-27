import { tr } from '@/lib/tr';

/**
 * Mərhələyə uyğun paywall dəyər mətni (flow = tsikl/TTC, bump = hamiləlik, mommy = körpə).
 * Siyahıda YALNIZ kodda həqiqətən Premium olan imkanlar var (bax src/lib/freemium.ts və
 * PremiumGate/PremiumBlurGate istifadələri): həftəlik hamiləlik izləmə, period təqvimi və
 * proqnozlar pulsuzdur; pulsuz istifadəçinin gündə 10 AI sualı var, Premium-da gündəlik
 * limit yoxdur. Reklamsızlıq həmişə sonuncu imkandır. Free trial vədi YOXDUR.
 * Dəyişən mətnlər üçün yeni açarlar istifadə olunur: köhnə açarların canlı DB
 * `translations` overlay-i seed dəyərlərini əvəz edərdi.
 */
export type PaywallStage = 'flow' | 'bump' | 'mommy' | 'general';

export const paywallStage = (lifeStage?: string | null): PaywallStage =>
  lifeStage === 'flow' || lifeStage === 'bump' || lifeStage === 'mommy' ? lifeStage : 'general';

export interface PaywallFeature { icon: string; title: string }

export function paywallHeadline(stage: PaywallStage): string {
  switch (stage) {
    case 'bump': return tr('pw_head_bump', 'Təpiklər, sancılar və həkim hesabatı bir yerdə');
    case 'mommy': return tr('pw_head_mommy', 'Körpənizin qidalanması, yuxusu və böyüməsi bir yerdə');
    case 'flow': return tr('pw_head_flow', 'Tsiklinizi qeydlərlə daha dəqiq tanıyın');
    default: return tr('pw_head_general', 'Mərhələnizə uyğun bütün alətlər bir yerdə');
  }
}

export function paywallFeatures(stage: PaywallStage): PaywallFeature[] {
  const reports = { icon: '📄', title: tr('pw_feat_reports', 'Həkim üçün PDF hesabatlar') };
  const ai = { icon: '🤖', title: tr('pw_feat_ai_daily', 'Gündəlik limitsiz Anacan AI') };
  const household = { icon: '💑', title: tr('pw_feat_household', 'Partnyorla ortaq Premium') };
  const sounds = { icon: '🎵', title: tr('pw_feat_whitenoise', 'Ağ səs və yuxu səsləri') };
  const noAds = { icon: '🚫', title: tr('pw_feat_noads', 'Tam reklamsız təcrübə') };
  switch (stage) {
    case 'bump': return [
      { icon: '🦶', title: tr('pw_feat_kicks', 'Təpik və sancı sayğacı') },
      { icon: '⚖️', title: tr('pw_feat_body', 'Çəki, təzyiq və şəkər qeydləri') },
      reports, ai, household, noAds];
    case 'mommy': return [
      { icon: '🍼', title: tr('pw_feat_babycare', 'Qidalanma, yuxu və bez qeydləri') },
      { icon: '📈', title: tr('pw_feat_growth', 'ÜST boy-çəki əyriləri') },
      sounds, reports, ai, noAds];
    case 'flow': return [
      { icon: '📝', title: tr('pw_feat_flow_log', 'Gündəlik qeydlə dəqiq proqnoz') },
      { icon: '🧠', title: tr('pw_feat_symptoms', 'Fazalara görə simptom analizi') },
      { icon: '📊', title: tr('pw_feat_cycle_stats', 'Tsikl statistikası və trendlər') },
      reports, ai, noAds];
    default: return [
      { icon: '🛠️', title: tr('pw_feat_tools', 'Bütün alətlərə tam giriş') },
      reports, ai, household, sounds, noAds];
  }
}

/** Real ictimai göstəricilər (2026-11): 46 000+ yükləmə, App Store reytinqi 4,84. Başqa rəqəm uydurmayın. */
export const paywallSocialProof = (): { rating: string; downloads: string } => ({
  rating: tr('pw_social_rating', '4,84★ App Store reytinqi'),
  downloads: tr('pw_social_downloads', '46 000+ yükləmə'),
});
