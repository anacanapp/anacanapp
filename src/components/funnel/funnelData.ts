import type { LifeStage } from '@/types/anacan';

import { tr } from '@/lib/tr';
export interface QuizQuestion {
  id: string;
  question: string;
  options: {id: string;label: string;emoji: string;}[];
  multiSelect?: boolean;
}

export interface SymptomMapping {
  painPoint: string;
  solution: string;
  emoji: string;
  toolId: string;
  isPremium: boolean;
}

export interface Review {
  name: string;
  context: string;
  text: string;
  rating: number;
}

export interface Feature {
  title: string;
  description: string;
  emoji: string;
  /** lucide icon adı (FeaturesStep-də emoji əvəzinə səliqəli icon) */
  icon?: string;
}

// ─── Quiz Questions by Life Stage ───
export const QUIZ_QUESTIONS: Record<LifeStage, QuizQuestion[]> = {
  bump: [
  {
    id: 'worry',
    question: tr("funneldata_hamileliyiniz_haqqinda_en_cox_ne_narahat_2b74c9", "Hamiləliyiniz haqqında ən çox nə narahat edir?"),
    options: [
    { id: 'birth_fear', label: tr("funneldata_dogus_qorxusu_172b00", "Doğuş qorxusu"), emoji: '😰' },
    { id: 'baby_health', label: tr("funneldata_korpenin_saglamligi_c767da", "Körpənin sağlamlığı"), emoji: '🤱' },
    { id: 'body_changes', label: tr("funneldata_beden_deyisiklikleri_33b640", "Bədən dəyişiklikləri"), emoji: '🪞' },
    { id: 'financial', label: tr("funneldata_maddi_meseleler_f6a8d9", "Maddi məsələlər"), emoji: '💰' }]

  },
  {
    id: 'sleep',
    question: tr("funneldata_geceler_yuxunuz_necedir_b33006", "Gecələr yuxunuz necədir?"),
    options: [
    { id: 'good', label: tr("funneldata_rahat_yatiram_0a68b9", "Rahat yatıram"), emoji: '😴' },
    { id: 'interrupted', label: tr("funneldata_tez_tez_oyaniram_0f221b", "Tez-tez oyanıram"), emoji: '😵‍💫' },
    { id: 'bad', label: tr("funneldata_demek_olar_yata_bilmirem_10aaf6", "Demək olar yata bilmirəm"), emoji: '🥱' }]

  },
  {
    id: 'support',
    question: tr("funneldata_etrafinizdan_kifayet_qeder_destek_alirsi_a6308d", "Ətrafınızdan kifayət qədər dəstək alırsınız?"),
    options: [
    { id: 'yes', label: tr("funneldata_beli_cox_96d658", "Bəli, çox"), emoji: '💕' },
    { id: 'partial', label: tr("funneldata_qismen_825ca6", "Qismən"), emoji: '🤔' },
    { id: 'no', label: tr("funneldata_demek_olar_hec_3133dc", "Demək olar heç"), emoji: '😔' }]

  },
  {
    id: 'stress',
    question: tr("funneldata_gundelik_stres_seviyyeniz_necedir_88a723", "Gündəlik stres səviyyəniz necədir?"),
    options: [
    { id: 'low', label: tr("funneldata_asagi_1c27f1", "Aşağı"), emoji: '😌' },
    { id: 'medium', label: tr("common_orta", "Orta"), emoji: '😐' },
    { id: 'high', label: tr("funneldata_yuksek_492584", "Yüksək"), emoji: '😣' },
    { id: 'very_high', label: tr("funneldata_cox_yuksek_c4d475", "Çox yüksək"), emoji: '🤯' }]

  }],

  mommy: [
  {
    id: 'struggle',
    question: tr("funneldata_analiqda_en_cox_hansi_movzu_sizi_yorur_c719dc", "Analıqda ən çox hansı mövzu sizi yorur?"),
    options: [
    { id: 'sleep', label: tr("funneldata_yuxusuzluq_label", "Yuxusuzluq"), emoji: '😴' },
    { id: 'loneliness', label: tr("funneldata_tenhaliq_hissi_d0e57e", "Tənhalıq hissi"), emoji: '💔' },
    { id: 'feeding', label: tr("funneldata_korpenin_qidalanmasi_a1d9db", "Körpənin qidalanması"), emoji: '🍼' },
    { id: 'no_time', label: tr("funneldata_oz_vaxtimin_olmamasi_a3f3e9", "Öz vaxtımın olmaması"), emoji: '⏰' }]

  },
  {
    id: 'emotional',
    question: tr("funneldata_dogusdan_sonra_ozunuzu_emosional_olaraq__9508b7", "Doğuşdan sonra özünüzü emosional olaraq necə hiss edirsiniz?"),
    options: [
    { id: 'strong', label: tr("funneldata_guclu_ve_xosbext_b21c78", "Güclü və xoşbəxt"), emoji: '💪' },
    { id: 'sometimes_hard', label: tr("funneldata_bezen_cetin_f90a21", "Bəzən çətin"), emoji: '🥲' },
    { id: 'very_hard', label: tr("funneldata_cox_cetin_gunlerim_olur_63086f", "Çox çətin günlərim olur"), emoji: '😢' }]

  },
  {
    id: 'development',
    question: tr("funneldata_korpenizin_inkisafi_haqqinda_narahatliql_be54e9", "Körpənizin inkişafı haqqında narahatlıqlarınız var?"),
    options: [
    { id: 'none', label: tr("funneldata_xeyr_her_sey_yaxsidir_72925d", "Xeyr, hər şey yaxşıdır"), emoji: '✅' },
    { id: 'some', label: tr("funneldata_bezi_suallarim_var_479fd7", "Bəzi suallarım var"), emoji: '🤔' },
    { id: 'serious', label: tr("funneldata_ciddi_narahatliqlarim_var_a287d8", "Ciddi narahatlıqlarım var"), emoji: '😟' }]

  }],

  flow: [
  {
    id: 'pain',
    question: tr("funneldata_menstruasiya_dovrunde_en_cox_ne_sizi_nar_7e0928", "Menstruasiya dövründə ən çox nə sizi narahat edir?"),
    options: [
    { id: 'physical', label: tr("funneldata_fiziki_agrilar_fa1134", "Fiziki ağrılar"), emoji: '😣' },
    { id: 'mood', label: tr("funneldata_ehval_deyisiklikleri_67202f", "Əhval dəyişiklikləri"), emoji: '🎭' },
    { id: 'irregular', label: tr("funneldata_qeyri_muntezemlik_9e36dc", "Qeyri-müntəzəmlik"), emoji: '📅' },
    { id: 'none', label: tr("funneldata_hec_biri_dd2cee", "Heç biri"), emoji: '😊' }]

  },
  {
    id: 'awareness',
    question: tr("funneldata_reproduktiv_saglamliginizla_bagli_meluma_287540", "Reproduktiv sağlamlığınızla bağlı məlumatlılıq səviyyəniz?"),
    options: [
    { id: 'high', label: tr("funneldata_cox_bilirem_b798d9", "Çox bilirəm"), emoji: '🧠' },
    { id: 'medium', label: tr("common_orta", "Orta"), emoji: '📖' },
    { id: 'low', label: tr("funneldata_az_bilirem_0f191a", "Az bilirəm"), emoji: '🤷‍♀️' }]

  },
  {
    id: 'importance',
    question: tr("funneldata_tsiklinizi_duzgun_izlemek_sizin_ucun_ne__46b605", "Tsiklinizi düzgün izləmək sizin üçün nə qədər vacibdir?"),
    options: [
    { id: 'very', label: tr("funneldata_cox_vacib_24d1a3", "Çox vacib"), emoji: '⭐' },
    { id: 'medium', label: tr("common_orta", "Orta"), emoji: '👌' },
    { id: 'low', label: tr("funneldata_o_qeder_de_yox_e54ae3", "O qədər də yox"), emoji: '🤷‍♀️' }]

  }],

  partner: [] // Partner skips funnel
};

// ─── Symptom → Feature Mapping ───
export const SYMPTOM_MAPPINGS: Record<string, SymptomMapping> = {
  // bump answers
  birth_fear: { painPoint: tr("funneldata_dogus_qorxusu_172b00", "Do\u011Fu\u015F qorxusu"), solution: tr("funneldata_xestexana_cantasi_dogusa_hazir_a2f062", "X\u0259st\u0259xana \xC7antas\u0131 & Do\u011Fu\u015Fa Haz\u0131rl\u0131q"), emoji: '🏥', toolId: 'hospital-bag', isPremium: true },
  baby_health: { painPoint: tr("funneldata_korpe_saglamligi_narahatligi_841d88", "K\xF6rp\u0259 sa\u011Flaml\u0131\u011F\u0131 narahatl\u0131\u011F\u0131"), solution: tr("funneldata_heftelik_i_nkisaf_hesabati_d701fa", "H\u0259ft\u0259lik \u0130nki\u015Faf Hesabat\u0131"), emoji: '📊', toolId: 'weekly-report', isPremium: true },
  body_changes: { painPoint: tr("funneldata_beden_deyisiklikleri_33b640", "B\u0259d\u0259n d\u0259yi\u015Fiklikl\u0259ri"), solution: tr("funneldata_ceki_i_zleyicisi_qidalanma_477cd4", "\xC7\u0259ki \u0130zl\u0259yicisi & Qidalanma"), emoji: '⚖️', toolId: 'weight-tracker', isPremium: false },
  financial: { painPoint: tr("funneldata_maddi_planlasdirma_18435a", "Maddi planla\u015Fd\u0131rma"), solution: tr("funneldata_alis_veris_siyahisi_magaza_b3e1f8", "Al\u0131\u015F-veri\u015F Siyah\u0131s\u0131 & Ma\u011Faza"), emoji: '🛒', toolId: 'shopping-list', isPremium: false },
  // sleep
  interrupted: { painPoint: tr("funneldata_yuxu_problemleri_627bba", "Yuxu probleml\u0259ri"), solution: tr("funneldata_yuxu_sesleri_ag_kuy_5e05f1", "Yuxu S\u0259sl\u0259ri & A\u011F K\xFCy"), emoji: '🎵', toolId: 'white-noise', isPremium: true },
  bad: { painPoint: tr("funneldata_ciddi_yuxusuzluq_painpoint", "Ciddi yuxusuzluq"), solution: tr("funneldata_yuxu_sesleri_meditasiya_fb635f", "Yuxu S\u0259sl\u0259ri & Meditasiya"), emoji: '🌙', toolId: 'white-noise', isPremium: true },
  // support
  partial: { painPoint: tr("funneldata_destek_ehtiyaci_7b31a6", "D\u0259st\u0259k ehtiyac\u0131"), solution: tr("funneldata_ana_cemiyyeti_partnyor_baglant_f72b92", "Ana C\u0259miyy\u0259ti & Partnyor Ba\u011Flant\u0131s\u0131"), emoji: '🤝', toolId: 'community', isPremium: false },
  no: { painPoint: tr("funneldata_destek_catismazligi_e5147a", "D\u0259st\u0259k \xE7at\u0131\u015Fmazl\u0131\u011F\u0131"), solution: tr("funneldata_24_7_anacan_ai_asistan", "24/7 Anacan.AI Asistan"), emoji: '🤖', toolId: 'ai-chat', isPremium: true },
  // stress
  high: { painPoint: tr("funneldata_yuksek_stres_a96d92", "Y\xFCks\u0259k stres"), solution: tr("funneldata_nefes_mesqleri_meditasiya_225210", "N\u0259f\u0259s M\u0259\u015Fql\u0259ri & Meditasiya"), emoji: '🧘', toolId: 'breathing', isPremium: true },
  very_high: { painPoint: tr("funneldata_cox_yuksek_stres_26e2b3", "\xC7ox y\xFCks\u0259k stres"), solution: tr("funneldata_ai_asistan_nefes_mesqleri_f00217", "AI Asistan & N\u0259f\u0259s M\u0259\u015Fql\u0259ri"), emoji: '🆘', toolId: 'ai-chat', isPremium: true },
  // mommy answers
  sleep: { painPoint: tr("funneldata_yuxusuzluq_painpoint", "Yuxusuzluq"), solution: tr("funneldata_yuxu_i_zleyicisi_ag_kuy_39d4f4", "Yuxu \u0130zl\u0259yicisi & A\u011F K\xFCy"), emoji: '😴', toolId: 'white-noise', isPremium: true },
  loneliness: { painPoint: tr("funneldata_tenhaliq_hissi_d0e57e", "T\u0259nhal\u0131q hissi"), solution: tr("funneldata_ana_cemiyyeti_ffc4bd", "Ana C\u0259miyy\u0259ti"), emoji: '👩‍👩‍👦', toolId: 'community', isPremium: false },
  feeding: { painPoint: tr("funneldata_qidalanma_cetinliyi_3b7f06", "Qidalanma \xE7\u0259tinliyi"), solution: tr("funneldata_emizdirme_i_zleyicisi_b0137e", "\u018Fmizdirm\u0259 \u0130zl\u0259yicisi"), emoji: '🍼', toolId: 'feeding-tracker', isPremium: false },
  no_time: { painPoint: tr("funneldata_vaxt_catismazligi_259e8d", "Vaxt \xE7at\u0131\u015Fmazl\u0131\u011F\u0131"), solution: tr("funneldata_gundelik_planlasdirma_a6d707", "G\xFCnd\u0259lik Planla\u015Fd\u0131rma"), emoji: '📋', toolId: 'daily-summary', isPremium: true },
  sometimes_hard: { painPoint: tr("funneldata_emosional_cetinlikler_1d2e9f", "Emosional \xE7\u0259tinlikl\u0259r"), solution: tr("funneldata_ehval_gundeliyi_ai_destek_d0d78c", "\u018Fhval G\xFCnd\u0259liyi & AI D\u0259st\u0259k"), emoji: '💛', toolId: 'mood-diary', isPremium: true },
  very_hard: { painPoint: tr("funneldata_postpartum_cetinlik_79dfea", "Postpartum \xE7\u0259tinlik"), solution: tr("funneldata_24_7_ai_asistan_cemiyyet_811e00", "24/7 AI Asistan & C\u0259miyy\u0259t"), emoji: '🫂', toolId: 'ai-chat', isPremium: true },
  some: { painPoint: tr("funneldata_i_nkisaf_suallari_68c826", "\u0130nki\u015Faf suallar\u0131"), solution: tr("funneldata_i_nkisaf_i_zleyicisi_milestone_0101fa", "\u0130nki\u015Faf \u0130zl\u0259yicisi & Milestones"), emoji: '🎯', toolId: 'baby-growth', isPremium: true },
  serious: { painPoint: tr("funneldata_ciddi_narahatliqlar_18a34d", "Ciddi narahatl\u0131qlar"), solution: tr("funneldata_ai_asistan_hekim_hesabati_c33072", "AI Asistan & H\u0259kim Hesabat\u0131"), emoji: '🏥', toolId: 'ai-chat', isPremium: true },
  // flow answers
  physical: { painPoint: tr("funneldata_fiziki_agrilar_fa1134", "Fiziki a\u011Fr\u0131lar"), solution: tr("funneldata_simptom_i_zleyicisi_nefes_mesq_7d13ee", "Simptom \u0130zl\u0259yicisi & N\u0259f\u0259s M\u0259\u015Fql\u0259ri"), emoji: '💊', toolId: 'breathing', isPremium: true },
  mood: { painPoint: tr("funneldata_ehval_deyisiklikleri_67202f", "\u018Fhval d\u0259yi\u015Fiklikl\u0259ri"), solution: tr("funneldata_ehval_gundeliyi_831844", "\u018Fhval G\xFCnd\u0259liyi"), emoji: '🎭', toolId: 'mood-diary', isPremium: true },
  irregular: { painPoint: tr("funneldata_qeyri_muntezem_tsikl_84f14c", "Qeyri-m\xFCnt\u0259z\u0259m tsikl"), solution: tr("funneldata_period_teqvimi_analitika_209bf3", "Period T\u0259qvimi & Analitika"), emoji: '📅', toolId: 'flow-calendar', isPremium: false },
  low: { painPoint: tr("funneldata_melumat_catismazligi_afccc5", "M\u0259lumat \xE7at\u0131\u015Fmazl\u0131\u011F\u0131"), solution: '24/7 AI Asistan', emoji: '📚', toolId: 'ai-chat', isPremium: true },
  very: { painPoint: tr("funneldata_tsikl_izleme_ehtiyaci_3c538c", "Tsikl izl\u0259m\u0259 ehtiyac\u0131"), solution: tr("funneldata_etrafli_tsikl_analitikasi_d746a2", "\u018Ftrafl\u0131 Tsikl Analitikas\u0131"), emoji: '📊', toolId: 'flow-calendar', isPremium: true }
};

// ─── Results Templates ───
export const RESULTS_TEMPLATES: Record<LifeStage, (name: string, weekOrAge: number, answers: Record<string, string>) => string[]> = {
  bump: (name, week, answers) => {
    const lines: string[] = [];
    lines.push(`${name}, ${week}${tr("funnel_week_stats", "-ci həftədə olan hamilə qadınların 78%-i müəyyən narahatlıqlar yaşayır.")}`);
    if (answers.sleep === 'interrupted' || answers.sleep === 'bad') {
      lines.push(tr("funneldata_yuxu_problemleri_3_cu_trimestr_32906e", "Yuxu probleml\u0259ri 3-c\xFC trimestrd\u0259 \xE7ox yay\u0131lm\u0131\u015F hald\u0131r \u2014 siz t\u0259k deyilsiniz."));
    }
    if (answers.stress === 'high' || answers.stress === 'very_high') {
      lines.push(tr("funneldata_stres_seviyyeniz_yuksekdir_bu__b3ef51", "Stres s\u0259viyy\u0259niz y\xFCks\u0259kdir \u2014 bu, h\u0259m sizin, h\u0259m d\u0259 k\xF6rp\u0259nizin sa\u011Flaml\u0131\u011F\u0131na t\u0259sir ed\u0259 bil\u0259r."));
    }
    if (answers.support === 'no' || answers.support === 'partial') {
      lines.push(tr("funneldata_destek_sebekesi_zeifdir_amma_b_1f2af0", "D\u0259st\u0259k \u015F\u0259b\u0259k\u0259si z\u0259ifdir \u2014 amma biz buraday\u0131q."));
    }
    lines.push(tr("funneldata_anacan_sizin_ucun_ferdi_hell_p_15bc53", "Anacan sizin \xFC\xE7\xFCn f\u0259rdi h\u0259ll plan\u0131 haz\u0131rlad\u0131. \uD83D\uDC95"));
    return lines;
  },
  mommy: (name, ageMonths, answers) => {
    const lines: string[] = [];
    lines.push(`${name}, ${ageMonths} ${tr("funnel_month_stats", "aylıq körpəsi olan anaların 82%-i oxşar çətinliklərlə üzləşir.")}`);
    if (answers.emotional === 'very_hard') {
      lines.push(tr("funneldata_dogusdan_sonraki_emosional_cet_a584c9", "Do\u011Fu\u015Fdan sonrak\u0131 emosional \xE7\u0259tinlikl\u0259r tamamil\u0259 normald\u0131r \u2014 k\xF6m\u0259k almaq g\xFCcd\xFCr."));
    }
    if (answers.struggle === 'sleep') {
      lines.push(tr("funneldata_yuxusuzluq_yeni_analarin_en_bo_dc4168", "Yuxusuzluq \u2014 yeni analar\u0131n \u0259n b\xF6y\xFCk problemidir."));
    }
    lines.push(tr("funneldata_sizin_ucun_ferdi_destek_plani__cb5933", "Sizin \xFC\xE7\xFCn f\u0259rdi d\u0259st\u0259k plan\u0131 haz\u0131rd\u0131r. \uD83C\uDF38"));
    return lines;
  },
  flow: (name, cycleLen, answers) => {
    const lines: string[] = [];
    lines.push(`${name}, ${cycleLen} ${tr("funnel_cycle_stats", "günlük tsiklinizə əsasən fərdi təhlil hazırladıq.")}`);
    if (answers.pain === 'physical') {
      lines.push(tr("funneldata_qadinlarin_65_i_menstruasiya_z_08edb4", "Qad\u0131nlar\u0131n 65%-i menstruasiya zaman\u0131 fiziki a\u011Fr\u0131larla m\xFCbariz\u0259 apar\u0131r."));
    }
    if (answers.awareness === 'low') {
      lines.push(tr("funneldata_reproduktiv_saglamliq_haqqinda_e1d680", "Reproduktiv sa\u011Flaml\u0131q haqq\u0131nda m\u0259lumat \u2014 sa\u011Flam g\u0259l\u0259c\u0259yin t\u0259m\u0259lidir."));
    }
    lines.push(tr("funneldata_anacan_tsiklinizi_anlayir_ve_s_8e4fb1", "Anacan tsiklinizi anlay\u0131r v\u0259 siz\u0259 k\xF6m\u0259k etm\u0259y\u0259 haz\u0131rd\u0131r. \u2728"));
    return lines;
  },
  partner: () => []
};

// ─── Reviews ───
export const REVIEWS: Record<LifeStage, Review[]> = {
  bump: [
  { name: tr("funneldata_gunel_ad877a", "Günel"), context: tr("funneldata_32_hefte_262acf", "32 h\u0259ft\u0259"), text: tr("funneldata_anacan_sayesinde_hamileliyimi_stressiz_k_f5652f", "Anacan sayəsində hamiləliyimi stressiz keçirdim. Həftəlik hesabatlar çox faydalıdır!"), rating: 5 },
  { name: 'Aynur', context: tr("funneldata_28_hefte_904b85", "28 h\u0259ft\u0259"), text: tr("funneldata_ai_asistan_gece_3_de_bele_suallarima_cav_7eac40", "AI Asistan gecə 3-də belə suallarıma cavab verir. Həqiqi dost kimi!"), rating: 5 },
  { name: 'Nigar', context: tr("funneldata_36_hefte_b86bcd", "36 h\u0259ft\u0259"), text: tr("funneldata_partnyor_hesabi_ile_heyat_yoldasim_da_he_0b0bd4", "Partnyor hesabı ilə həyat yoldaşım da hər şeyi izləyir. Əla fikir!"), rating: 5 }],

  mommy: [
  { name: tr("funneldata_ayten_cb2a8e", "Aytən"), context: tr("funneldata_4_ayliq_ana_ca3cbc", "4 ayl\u0131q ana"), text: tr("funneldata_korpemin_yuxu_cedvelini_izlemek_heyatimi_1ec80e", "Körpəmin yuxu cədvəlini izləmək həyatımı dəyişdi. Artıq nə vaxt oyanacağını bilirəm."), rating: 5 },
  { name: tr("funneldata_sebine_310bef", "Səbinə"), context: tr("funneldata_7_ayliq_ana_beede1", "7 ayl\u0131q ana"), text: tr("funneldata_inkisaf_izleyicisi_sayesinde_korpemin_he_148227", "İnkişaf izləyicisi sayəsində körpəmin hər addımını qeyd edirəm."), rating: 5 },
  { name: tr("funneldata_lamiye_fbb845", "Lamiyə"), context: tr("funneldata_2_ayliq_ana_2022a1", "2 ayl\u0131q ana"), text: tr("funneldata_dogusdan_sonra_cox_cetin_idi_amma_ai_asi_49ef0d", "Doğuşdan sonra çox çətin idi, amma AI Asistan və cəmiyyət mənə güc verdi."), rating: 5 }],

  flow: [
  { name: tr("funneldata_leman_566115", "Ləman"), context: tr("funneldata_aktiv_istifadeci_98044e", "Aktiv istifad\u0259\xE7i"), text: tr("funneldata_tsiklimi_izlemeye_baslayandan_beri_beden_6ddd52", "Tsiklimi izləməyə başlayandan bəri bədənimi daha yaxşı tanıyıram."), rating: 5 },
  { name: 'Fidan', context: tr("funneldata_6_aydir_istifade_edir_853466", "6 ayd\u0131r istifad\u0259 edir"), text: tr("funneldata_ovulyasiya_gunlerini_deqiq_bilirem_planl_bf94ea", "Ovulyasiya günlərini dəqiq bilirəm. Planlaşdırma çox asanlaşdı!"), rating: 5 },
  { name: tr("funneldata_gunay_38e69c", "Günay"), context: tr("funneldata_premium_istifadeci_125a87", "Premium istifad\u0259\xE7i"), text: tr("funneldata_vitamin_izleyicisi_ve_qidalanma_meslehet_a8ec35", "Vitamin izləyicisi və qidalanma məsləhətləri əvəzsizdir."), rating: 5 }],

  partner: []
};

// ─── Feature Showcase ───
export const FEATURES: Feature[] = [
{ title: tr("funneldata_ai_fotosessiya_title", "AI Fotosessiya"), description: tr("funneldata_korpenizin_professional_fotolarini_suni__ec1b0b", "Körpənizin professional fotolarını süni intellekt ilə yaradın"), emoji: '📸', icon: 'Camera' },
{ title: tr("funneldata_partnyor_hesabi_ba746f", "Partnyor Hesabı"), description: tr("funneldata_heyat_yoldasinizi_baglayin_birlikde_izle_762187", "Həyat yoldaşınızı bağlayın, birlikdə izləyin"), emoji: '💑', icon: 'HeartHandshake' },
{ title: tr("funneldata_ai_asistan_title", "24/7 AI Asistan"), description: tr("funneldata_istenilen_sualiniza_derhal_cavab_alin_8938d5", "İstənilən sualınıza dərhal cavab alın"), emoji: '🤖', icon: 'Bot' },
{ title: tr("funneldata_heftelik_hesabat_283d76", "Həftəlik Hesabat"), description: tr("funneldata_hamileliyin_ve_ya_korpenin_heftelik_inki_ad5912", "Hamiləliyin və ya körpənin həftəlik inkişaf hesabatı"), emoji: '📊', icon: 'BarChart3' }];


// ─── Milestone Plan ───
export const PLAN_MILESTONES: Record<LifeStage, {week: string;label: string;}[]> = {
  bump: [
  { week: tr("funneldata_hefte_1_1efd81", "H\u0259ft\u0259 1"), label: tr("funneldata_hamilelik_izlemeye_basla_5c2941", "Hamiləlik izləməyə başla") },
  { week: tr("funneldata_ay_1", "Ay 1"), label: tr("funneldata_stres_seviyyesini_azalt_6bf5de", "Stres səviyyəsini azalt") },
  { week: tr("funneldata_ay_3", "Ay 3"), label: tr("funneldata_dogusa_tam_hazir_ol_58a0df", "Doğuşa tam hazır ol") }],

  mommy: [
  { week: tr("funneldata_hefte_1_1efd81", "H\u0259ft\u0259 1"), label: tr("funneldata_korpe_izlemeye_basla_bd8634", "Körpə izləməyə başla") },
  { week: tr("funneldata_ay_1", "Ay 1"), label: tr("funneldata_rutin_qur_rahatla_label", "Rutin qur, rahatla") },
  { week: tr("funneldata_ay_3", "Ay 3"), label: tr("funneldata_tam_nezaretde_ol_2630cf", "Tam nəzarətdə ol") }],

  flow: [
  { week: tr("funneldata_hefte_1_1efd81", "H\u0259ft\u0259 1"), label: tr("funneldata_tsikl_izlemeye_basla_3faf9b", "Tsikl izləməyə başla") },
  { week: tr("funneldata_ay_1", "Ay 1"), label: tr("funneldata_bedenini_tani_dca5a1", "Bədənini tanı") },
  { week: tr("funneldata_ay_3", "Ay 3"), label: tr("funneldata_saglamligini_idare_et_1680af", "Sağlamlığını idarə et") }],

  partner: []
};