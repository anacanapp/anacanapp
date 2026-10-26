import { useAppSetting, useUpdateAppSetting } from '@/hooks/useAppSettings';

import { tr } from '@/lib/tr';
import { getCachedTranslation } from '@/lib/i18n';
import { useUserStore } from '@/store/userStore';
export interface PaywallConfig {
  // Branding
  title: string;
  subtitle: string;
  // Benefit pills
  pills: {icon: string;text: string;}[];
  // CTA texts
  cta_new_user: string;
  cta_upgrade: string;
  cta_switch_yearly: string;
  // Plan labels
  yearly_label: string;
  monthly_label: string;
  savings_badge: string;
  yearly_suffix: string;
  monthly_suffix: string;
  yearly_total_suffix: string;
  // Feature lock text
  feature_lock_text: string;
  // Footer
  restore_text: string;
  terms_label: string;
  privacy_label: string;
  cancel_notice: string;
  native_notice: string;
  non_native_notice: string;
  // Free trial
  free_trial_enabled: boolean;
  free_trial_days: number;
  free_trial_badge: string;
  free_trial_cta: string;
  free_trial_note: string;
  // Purchasing states
  purchasing_text: string;
  // Gradient colors
  gradient_from: string;
  gradient_via: string;
  gradient_to: string;
}

export interface BillingConfig {
  // Header
  page_title: string;
  // Plan names
  free_plan_name: string;
  premium_monthly_name: string;
  premium_yearly_name: string;
  // Status badges
  active_badge: string;
  cancelled_badge: string;
  // Date labels
  start_date_label: string;
  renewal_label: string;
  expiry_label: string;
  // Cancelled notice template
  cancelled_notice: string; // {date} placeholder
  // Features section
  features_title: string;
  features: {icon: string;text: string;}[];
  // CTA buttons
  upgrade_cta: string;
  upgrade_savings: string; // {percent} placeholder
  restore_cta: string;
  cancel_cta: string;
  get_premium_cta: string;
  // Payment history
  payment_title: string;
  paid_label: string;
  // Support
  support_text: string;
  support_email: string;
  // Header gradient (premium)
  header_gradient_from: string;
  header_gradient_via: string;
  header_gradient_to: string;
  // Header gradient (free)
  header_free_from: string;
  header_free_via: string;
  header_free_to: string;
}

/**
 * LAZY defaults — tr() ÇAĞIRIŞ anında həll olunur.
 * Əvvəllər modul-səviyyəli const idi → import anında (keş hidratasiyasından əvvəl)
 * AZ-da donub qalırdı və paywall bütün dillərdə qarışıq görünürdü.
 */
export const getDefaultPaywallConfig = (): PaywallConfig => ({
  title: 'Anacan Premium',
  subtitle: tr("usepaywallconfig_tam_tecrube_sinirsiz_imkanlar_ce3376", "Tam təcrübə · Sınırsız imkanlar"),
  pills: [
  { icon: 'Zap', text: tr("common_limitsiz", 'Limitsiz') },
  { icon: 'Shield', text: tr("usepaywallconfig_reklamsiz_cc4ba5", "Reklamsız") },
  { icon: 'Sparkles', text: tr("usepaywallconfig_ai_desteyi_934e62", "AI dəstəyi") }],

  cta_new_user: tr("usepaywallconfig_premium_a_kec_2e8b0e", "Premium-a Ke\xE7"),
  cta_upgrade: tr("usepaywallconfig_plani_yenile_3ad3f4", "Plan\u0131 Yenil\u0259"),
  cta_switch_yearly: tr("usepaywallconfig_i_llik_plana_kec_bdf27a", "\u0130llik Plana Ke\xE7"),
  yearly_label: tr("usepaywallconfig_illik", "İllik"),
  monthly_label: tr("usepaywallconfig_ayliq_6f265e", "Ayl\u0131q"),
  savings_badge: tr("usepaywallconfig_percent_qenaet_a627e2", "{percent}% Q\u018FNA\u018FT"),
  yearly_suffix: tr("usepaywallconfig_yearly_suffix", '/ay'),
  monthly_suffix: tr("usepaywallconfig_monthly_suffix", '/ay'),
  yearly_total_suffix: tr("usepaywallconfig_yearly_total_suffix", '/il'),
  feature_lock_text: tr("usepaywallconfig_feature_ucun_premium_lazimdir_4800ff", "{feature} \xFC\xE7\xFCn Premium laz\u0131md\u0131r"),
  restore_text: tr("usepaywallconfig_berpa_et_6c3210", "B\u0259rpa et"),
  terms_label: tr("usepaywallconfig_sertler_d86d4e", "\u015E\u0259rtl\u0259r"),
  privacy_label: tr("usepaywallconfig_mexfilik_b641fc", "M\u0259xfilik"),
  cancel_notice: tr("usepaywallconfig_i_stenilen_vaxt_legv_ede_biler_cc073d", "\u0130st\u0259nil\u0259n vaxt l\u0259\u011Fv ed\u0259 bil\u0259rsiniz \u2022 Avtomatik yenil\u0259nir"),
  native_notice: '',
  non_native_notice: tr("usepaywallconfig_app_store_google_play_den_yukl_1a75c6", "App Store / Google Play-d\u0259n y\xFCkl\u0259yin"),
   free_trial_enabled: false,
   free_trial_days: 0,
   free_trial_badge: '',
   free_trial_cta: '',
   free_trial_note: '',
  purchasing_text: tr("paywall_emal_edilir", 'Emal edilir...'),
  gradient_from: '#d97706',
  gradient_via: '#ea580c',
  gradient_to: '#be123c'
});

/** Geri uyğunluq (PaywallDesignerTab) — hər müraciətdə cari dillə hesablanır */
export const defaultPaywallConfig: PaywallConfig = new Proxy({} as PaywallConfig, {
  get: (_t, prop) => (getDefaultPaywallConfig() as any)[prop],
  ownKeys: () => Reflect.ownKeys(getDefaultPaywallConfig()),
  getOwnPropertyDescriptor: (_t, prop) => ({ enumerable: true, configurable: true, value: (getDefaultPaywallConfig() as any)[prop] }),
});

export const getDefaultBillingConfig = (): BillingConfig => ({
  page_title: tr("usepaywallconfig_abuneliyim_f6c8ed", "Abun\u0259liyim"),
  free_plan_name: tr("paywall_pulsuz_plan", 'Pulsuz Plan'),
  premium_monthly_name: tr("usepaywallconfig_premium_ayliq_7f604a", "Premium Ayl\u0131q"),
  premium_yearly_name: tr("usepaywallconfig_premium_illik", "Premium İllik"),
  active_badge: tr("paywall_aktiv", 'Aktiv'),
  cancelled_badge: tr("usepaywallconfig_legv_edilib_24db12", "L\u0259\u011Fv edilib"),
  start_date_label: tr("usepaywallconfig_baslama_9f32b6", "Ba\u015Flama"),
  renewal_label: tr("usepaywallconfig_yenilenme_8e3032", "Yenil\u0259nm\u0259"),
  expiry_label: tr("paywall_premium_bitir", 'Premium bitir'),
  cancelled_notice: tr("usepaywallconfig_date_tarixine_qeder_premium_ak_9c0a37", "{date} tarixin\u0259 q\u0259d\u0259r Premium aktiv qalacaq."),
  features_title: tr("usepaywallconfig_planiniza_daxildir_4a6141", "Plan\u0131n\u0131za daxildir"),
  features: [
  { icon: 'Zap', text: tr("usepaywallconfig_limitsiz_ai", 'Limitsiz AI') },
  { icon: 'Shield', text: tr("usepaywallconfig_reklamsiz_cc4ba5", "Reklamsız") },
  { icon: 'Crown', text: tr("usepaywallconfig_premium_fonlar", 'Premium fonlar') },
  { icon: 'Sparkles', text: tr("usepaywallconfig_prioritet_destek_3f6f91", "Prioritet dəstək") }],

  upgrade_cta: tr("usepaywallconfig_i_llik_plana_kec_bdf27a", "\u0130llik Plana Ke\xE7"),
  upgrade_savings: tr("usepaywallconfig_percent_qenaet_5a6e02", "{percent}% q\u0259na\u0259t"),
  restore_cta: tr("usepaywallconfig_abuneliyi_berpa_et_9e9e21", "Abun\u0259liyi B\u0259rpa Et"),
  cancel_cta: tr("usepaywallconfig_abuneliyi_legv_et_83e5de", "Abun\u0259liyi L\u0259\u011Fv Et"),
  get_premium_cta: tr("usepaywallconfig_premium_a_kec_2e8b0e", "Premium-a Ke\xE7"),
  payment_title: tr("usepaywallconfig_son_odenis_23031a", "Son \xF6d\u0259ni\u015F"),
  paid_label: tr("usepaywallconfig_odenildi_504c21", "\xD6d\u0259nildi"),
  support_text: tr("usepaywallconfig_suallariniz_ucun_872f23", "Suallar\u0131n\u0131z \xFC\xE7\xFCn:"),
  support_email: 'info@anacan.az',
  header_gradient_from: '#d97706',
  header_gradient_via: '#ea580c',
  header_gradient_to: '#be123c',
  header_free_from: '#475569',
  header_free_via: '#334155',
  header_free_to: '#1e293b'
});

/** Geri uyğunluq (BillingDesignerTab) */
export const defaultBillingConfig: BillingConfig = new Proxy({} as BillingConfig, {
  get: (_t, prop) => (getDefaultBillingConfig() as any)[prop],
  ownKeys: () => Reflect.ownKeys(getDefaultBillingConfig()),
  getOwnPropertyDescriptor: (_t, prop) => ({ enumerable: true, configurable: true, value: (getDefaultBillingConfig() as any)[prop] }),
});

/**
 * Admin config sahələri üçün dinamik tr() sarğısı: admin nə vaxtsa config saxlasa
 * (tək dildə mətnlər), tərcümələr `paywallcfg_<sahə>` / `billingcfg_<sahə>` açarları
 * ilə AdminTranslations-dan idarə olunur. Tərcümə yoxdursa seçilmiş dilin lokal
 * mətni işləyir; təkdilli admin dəyəri digər dillərin UI-sini əvəz etmir.
 */
const localizeText = (prefix: string, field: string, value: unknown, fallback: string, language: string): string => {
  if (typeof value !== 'string') return fallback;
  if (!value.trim() || language === 'az') return value;
  const localized = getCachedTranslation(`${prefix}_${field}`, language);
  return localized?.trim() && localized !== value ? localized : fallback;
};

const PAYWALL_TEXT_FIELDS: (keyof PaywallConfig)[] = [
  'title', 'subtitle', 'cta_new_user', 'cta_upgrade', 'cta_switch_yearly',
  'yearly_label', 'monthly_label', 'savings_badge', 'yearly_suffix', 'monthly_suffix',
  'yearly_total_suffix', 'feature_lock_text', 'restore_text', 'terms_label', 'privacy_label',
  'cancel_notice', 'native_notice', 'non_native_notice', 'free_trial_badge', 'free_trial_cta',
  'free_trial_note', 'purchasing_text'];

const BILLING_TEXT_FIELDS: (keyof BillingConfig)[] = [
  'page_title', 'free_plan_name', 'premium_monthly_name', 'premium_yearly_name',
  'active_badge', 'cancelled_badge', 'start_date_label', 'renewal_label', 'expiry_label',
  'cancelled_notice', 'features_title', 'upgrade_cta', 'upgrade_savings', 'restore_cta',
  'cancel_cta', 'get_premium_cta', 'payment_title', 'paid_label', 'support_text'];

export const usePaywallConfig = (): PaywallConfig => {
  const raw = useAppSetting('premium_paywall_config');
  const language = useUserStore(state => state.language);
  const defaults = getDefaultPaywallConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const merged: PaywallConfig = { ...defaults, ...raw };
  for (const f of PAYWALL_TEXT_FIELDS) {
    // Admin dəyəri defaultdan fərqlidirsə → dinamik açarla lokallaşdırıla bilər
    if ((raw as any)[f] !== undefined) (merged as any)[f] = localizeText('paywallcfg', f as string, (raw as any)[f], String(defaults[f]), language);
  }
  if (Array.isArray((raw as any).pills)) {
    merged.pills = raw.pills.filter((p: unknown) => p && typeof p === 'object').map((p: PaywallConfig['pills'][number], i: number) => ({ ...p,
      text: localizeText('paywallcfg', `pill_${i + 1}`, p.text, defaults.pills[i]?.text || '', language) })).filter((p: PaywallConfig['pills'][number]) => p.text);
  }
  // Retired presentation keys remain readable for old admin configurations.
  // New purchases never advertise or auto-select a free trial.
  return { ...merged, free_trial_enabled: false, free_trial_days: 0, free_trial_badge: '', free_trial_cta: '', free_trial_note: '' };
};

export const useBillingConfig = (): BillingConfig => {
  const raw = useAppSetting('billing_page_config');
  const language = useUserStore(state => state.language);
  const defaults = getDefaultBillingConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const merged: BillingConfig = { ...defaults, ...raw };
  for (const f of BILLING_TEXT_FIELDS) {
    if ((raw as any)[f] !== undefined) (merged as any)[f] = localizeText('billingcfg', f as string, (raw as any)[f], String(defaults[f]), language);
  }
  if (Array.isArray((raw as any).features)) {
    merged.features = raw.features.filter((p: unknown) => p && typeof p === 'object').map((p: BillingConfig['features'][number], i: number) => ({ ...p,
      text: localizeText('billingcfg', `feature_${i + 1}`, p.text, defaults.features[i]?.text || '', language) })).filter((p: BillingConfig['features'][number]) => p.text);
  }
  return merged;
};

export const useUpdatePaywallConfig = () => {
  const updateSetting = useUpdateAppSetting();
  return {
    update: (config: PaywallConfig) => updateSetting.mutateAsync({ key: 'premium_paywall_config', value: config }),
    isPending: updateSetting.isPending
  };
};

export const useUpdateBillingConfig = () => {
  const updateSetting = useUpdateAppSetting();
  return {
    update: (config: BillingConfig) => updateSetting.mutateAsync({ key: 'billing_page_config', value: config }),
    isPending: updateSetting.isPending
  };
};
