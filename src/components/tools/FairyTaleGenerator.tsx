import { useEffect, useState, CSSProperties, ReactNode } from 'react';
import { Sparkles, Heart, Trash2, Loader2, Wand2, Clock, BookOpenCheck, Globe, X, Baby, PenLine, ListChecks } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFairyTales, useFairyTaleThemes, useGenerateFairyTale, useToggleFavorite, useDeleteFairyTale, useIncrementPlayCount, FairyTale } from '@/hooks/useFairyTales';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import MarkdownContent from '@/components/MarkdownContent';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr, getPersistedLanguage } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';
import { APP_LANGUAGES, normalizeAppLanguage } from '@/lib/app-languages';
import { useUserStore } from '@/store/userStore';
import { followupText } from '@/lib/followup-i18n';
import { exampleChildName } from '@/lib/fiction-names';

interface FairyTaleGeneratorProps {
  onBack: () => void;
}

const getMoralLessons = () => [
  { value: 'sharing', label: tr("fairytalegenerator_bolusmek_df3fa9", 'Bölüşmək'), emoji: '🤝' },
  { value: 'kindness', label: tr("fairytalegenerator_mehribanliq_7e25e6", 'Mehribanlıq'), emoji: '💕' },
  { value: 'bravery', label: tr("fairytalegenerator_cesaret_326b71", 'Cəsarət'), emoji: '🦁' },
  { value: 'honesty', label: tr("fairytalegenerator_durustluk_3d6ddb", 'Dürüstlük'), emoji: '✨' },
  { value: 'brushing_teeth', label: tr("fairytalegenerator_dis_fircalamaq_da9acc", 'Diş fırçalamaq'), emoji: '🦷' },
  { value: 'eating_vegetables', label: tr("fairytalegenerator_terevez_yemek_888a56", 'Tərəvəz yemək'), emoji: '🥦' },
  { value: 'sleeping', label: tr("fairytalegenerator_yatmaq_3c7a2d", "Yatmaq"), emoji: '😴' },
  { value: 'friendship', label: tr("fairytalegenerator_dostluq_3c7a2d", "Dostluq"), emoji: '👫' },
  { value: 'patience', label: tr("fairytalegenerator_sebir_831276", 'Səbir'), emoji: '🧘' },
  { value: 'gratitude', label: tr("fairytalegenerator_minnetdarliq_31b225", 'Minnətdarlıq'), emoji: '🙏' },
  { value: 'responsibility', label: tr("fairytalegenerator_mesuliyyet_6e6cbe", 'Məsuliyyət'), emoji: '🎯' },
  { value: 'respect', label: tr("fairytalegenerator_hormet_45e147", 'Hörmət'), emoji: '🙌' },
  { value: 'teamwork', label: tr("fairytalegenerator_birlikde_is_01f136", 'Birlikdə iş'), emoji: '🤜🤛' },
  { value: 'self_confidence', label: tr("fairytalegenerator_ozune_inam_9828d6", 'Özünə inam'), emoji: '💪' },
  { value: 'helping_others', label: tr("fairytalegenerator_basqalarina_komek_d0e8f6", 'Başqalarına kömək'), emoji: '🫶' },
  { value: 'nature_love', label: tr("fairytalegenerator_tebiet_sevgisi_801736", 'Təbiət sevgisi'), emoji: '🌿' }];


const getHeroSuggestions = () => [
  { emoji: '🧸', label: tr("fairytalegenerator_ayi_balasi_f0fdaa", 'Ayı Balası') },
  { emoji: '🦄', label: followupText('fairytale_unicorn') },
  { emoji: '🐰', label: tr("fairytalegenerator_dovsan_a53a5c", 'Dovşan') },
  { emoji: '🦋', label: tr("fairytalegenerator_kepenek_d4da32", 'Kəpənək') },
  { emoji: '🐱', label: tr("fairytalegenerator_pisik_be8848", 'Pişik') },
  { emoji: '🦊', label: tr("fairytalegenerator_tulku_c6f151", 'Tülkü') },
  { emoji: '🐶', label: tr("fairytalegenerator_bala_it_3c7a2d", "Bala it") },
  { emoji: '🌟', label: tr("fairytalegenerator_ulduz_3c7a2d", "Ulduz") },
  { emoji: '🐢', label: tr("fairytalegenerator_tisbaga_c66f32", 'Tısbağa') },
  { emoji: '🦉', label: tr("fairytalegenerator_bayqus_d690dd", 'Bayquş') },
  { emoji: '🐝', label: tr("fairytalegenerator_ari_b3e5dd", 'Arı') },
  { emoji: '🦅', label: tr("fairytalegenerator_qartal_3c7a2d", "Qartal") },
  { emoji: '🐿️', label: tr("fairytalegenerator_sincab_3c7a2d", "Sincab") },
  { emoji: '🐬', label: tr("fairytalegenerator_delfin_3c7a2d", "Delfin") },
  { emoji: '🦜', label: tr("fairytalegenerator_tutuqusu_d3f34f", 'Tutuquşu') },
  { emoji: '🐉', label: tr("fairytalegenerator_ejdaha_b4feca", 'Əjdaha') }];


const getAgeRanges = () => [
  { value: '0-2', label: tr("fairytalegenerator_0_2_yas_0fca24", '0-2 yaş'), emoji: '👶', desc: tr("fairytalegenerator_cox_sade_fbc365", "\xC7ox sad\u0259") },
  { value: '3-5', label: tr("fairytalegenerator_3_5_yas_023631", '3-5 yaş'), emoji: '🧒', desc: tr("fairytalegenerator_sade_620f92", "Sad\u0259") },
  { value: '6-9', label: tr("fairytalegenerator_6_9_yas_345fa4", '6-9 yaş'), emoji: '👧', desc: tr("fairytalegenerator_orta_3c7a2d", "Orta") },
  { value: '10-12', label: tr("fairytalegenerator_10_12_yas_c393ca", '10-12 yaş'), emoji: '🧑', desc: tr("fairytalegenerator_murekkeb_43a904", "M\xFCr\u0259kk\u0259b") }];


const getStoryStyles = () => [
  { value: '', label: tr("fairytalegenerator_klassik_3c7a2d", "Klassik"), emoji: '📖' },
  { value: 'funny', label: tr("fairytalegenerator_gulmeli_8f7f56", 'Gülməli'), emoji: '😂' },
  { value: 'adventure', label: tr("fairytalegenerator_macera_bc3bdc", 'Macəra'), emoji: '🗺️' },
  { value: 'educational', label: tr("fairytalegenerator_oyredici_b51c23", 'Öyrədici'), emoji: '🎓' },
  { value: 'lullaby', label: tr("fairytalegenerator_laylay_3c7a2d", "Laylay"), emoji: '🌙' }];


const LANGUAGES = APP_LANGUAGES.map(item => ({ code: item.code, label: item.native_name, flag: item.flag }));


// Shared select-pill styles (lav accent)
const pillOn: CSSProperties = { background: 'var(--a-lav-2)', color: 'var(--a-lav-ink)', border: '1px solid transparent', cursor: 'pointer' };
const pillOff: CSSProperties = { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', border: '1px solid transparent', cursor: 'pointer' };

const FairyTaleGenerator = ({ onBack }: FairyTaleGeneratorProps) => {
  useScreenAnalytics('FairyTaleGenerator', 'Tools');
  const isRtl = useIsRtl();
  const language = normalizeAppLanguage(useUserStore(state => state.language));
  const MORAL_LESSONS = getMoralLessons(), HERO_SUGGESTIONS = getHeroSuggestions(), AGE_RANGES = getAgeRanges(), STORY_STYLES = getStoryStyles();
  const [selectedTale, setSelectedTale] = useState<FairyTale | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'wizard' | 'direct'>('wizard');
  const [createStep, setCreateStep] = useState(1);
  const [customPrompt, setCustomPrompt] = useState('');
  const [directChildName, setDirectChildName] = useState('');
  const [directLanguage, setDirectLanguage] = useState<string>(language);
  const [directAgeRange, setDirectAgeRange] = useState('3-5');
  const [formData, setFormData] = useState({
    child_name: '',
    theme: '',
    hero: '',
    moral_lesson: '',
    language: language as string,
    age_range: '3-5',
    story_style: ''
  });
  useEffect(() => {
    if (!showCreate) { setDirectLanguage(language); setFormData(value => ({ ...value, language })); }
  }, [language, showCreate]);

  const { data: tales = [], isLoading } = useFairyTales();
  const { data: themes = [] } = useFairyTaleThemes();
  const generateTale = useGenerateFairyTale();
  const toggleFavorite = useToggleFavorite();
  const deleteTale = useDeleteFairyTale();
  const incrementPlayCount = useIncrementPlayCount();
  const { peekRemainingDaily } = useSubscription();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleGenerate = async () => {
    // The server owns consumption; an invalid form must not spend an allowance.
    if (createMode === 'direct' ? !customPrompt.trim() : !formData.child_name.trim() || !formData.theme) return;
    const { remaining } = await peekRemainingDaily('fairy_tale');
    if (remaining <= 0) {
      setShowPremiumModal(true);
      return;
    }
    if (createMode === 'direct') {
      if (!customPrompt.trim()) {
        toast.error(tr("fairytalegenerator_nagil_tesviri_yazilmalidir_24773e", "Na\u011F\u0131l t\u0259sviri yaz\u0131lmal\u0131d\u0131r"));
        return;
      }
      try {
        const result = await generateTale.mutateAsync({
          child_name: directChildName || exampleChildName(directLanguage),
          language: directLanguage,
          age_range: directAgeRange,
          custom_prompt: customPrompt
        });
        setShowCreate(false);
        setSelectedTale(result);
        setCustomPrompt('');
        setDirectChildName('');
      } catch (error) {

        // Error handled in hook
      } return;
    }

    if (!formData.child_name || !formData.theme) {
      toast.error(tr("fairytalegenerator_usagin_adi_ve_movzu_secilmelid_50f47b", "U\u015Fa\u011F\u0131n ad\u0131 v\u0259 m\xF6vzu se\xE7ilm\u0259lidir"));
      return;
    }

    try {
      const result = await generateTale.mutateAsync({
        child_name: formData.child_name,
        theme: formData.theme,
        hero: formData.hero,
        moral_lesson: formData.moral_lesson,
        language: formData.language,
        age_range: formData.age_range,
        story_style: formData.story_style
      });
      setShowCreate(false);
      setSelectedTale(result);
      setFormData({ child_name: '', theme: '', hero: '', moral_lesson: '', language, age_range: '3-5', story_style: '' });
      setCreateStep(1);
    } catch (error) {

      // Error handled in hook
    }
  };

  const resetCreate = () => {
    setShowCreate(false);
    setCreateStep(1);
    setCreateMode('wizard');
    setCustomPrompt('');
    setDirectChildName('');
    setFormData({ child_name: '', theme: '', hero: '', moral_lesson: '', language, age_range: '3-5', story_style: '' });
  };

  const favoriteTales = tales.filter((t) => t.is_favorite);

  const getReadingTime = (content: string) => {
    const words = content.split(/\s+/).length;
    return Math.ceil(words / 150);
  };

  const tabTriggerClass =
  "rounded-full py-1.5 text-[11.5px] font-bold border-0 shadow-none data-[state=active]:shadow-none data-[state=active]:bg-[var(--a-lav-1)] data-[state=active]:text-[var(--a-lav-ink)] text-[var(--a-ink-soft)]";

  const fieldLabel = (text: string, icon?: ReactNode) =>
  <p className="font-bold text-sm flex items-center gap-2 a-heading" style={{ margin: 0, color: 'var(--a-ink)' }}>
      {icon}{text}
    </p>;

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("fairytalegenerator_usaginizin_adi_ile_sehrli_bir_hekaye_7896ac", "Uşağınızın adı ilə sehrli bir hekayə")}
        title={tr("fairytalegenerator_agilli_nagillar_3f1901", "A\u011F\u0131ll\u0131 Na\u011F\u0131llar")} />

      {/* Create Button - Hero Card */}
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <div
          className="a-card mb-4 overflow-hidden cursor-pointer relative"
          style={{ background: 'var(--a-grad-lav)', border: 'none', padding: 24 }}
          onClick={() => setShowCreate(true)}>

          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(8)].map((_, i) =>
              <motion.div
                key={i}
                className="absolute"
                style={{ insetInlineStart: `${10 + i * 12}%`, top: `${20 + i % 3 * 25}%`, opacity: 0.35 }}
                animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.3, 1] }}
                transition={{ duration: 2 + i * 0.3, repeat: 2, delay: i * 0.2 }}>

                ✨
              </motion.div>
            )}
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <motion.div
              className="p-4 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.35)' }}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: 2 }}>

              <Sparkles className="h-10 w-10" style={{ color: 'var(--a-lav-ink)' }} />
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold mb-1 a-heading" style={{ margin: '0 0 4px', color: 'var(--a-lav-ink)' }}>{tr("fairytalegenerator_yeni_nagil_yarat_081219", "Yeni Nağıl Yarat")}</h2>
              <p className="text-sm" style={{ margin: 0, color: 'var(--a-lav-ink)', opacity: 0.8 }}>{tr("fairytalegenerator_usaginizin_adi_ile_sehrli_bir_hekaye_7896ac", "Uşağınızın adı ilə sehrli bir hekayə")}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      {tales.length > 0 &&
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-lav-1)' }}>
            <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-lav-ink)' }}>{tales.length}</p>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-lav-ink)', opacity: 0.8 }}>{tr("fairytalegenerator_nagil_1f5665", "Nağıl")}</p>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-pink-1)' }}>
            <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-alert-ink)' }}>{favoriteTales.length}</p>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-berry-ink)', opacity: 0.9 }}>{tr("fairytalegenerator_sevimli_3c7a2d", "Sevimli")}</p>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-yellow-1)' }}>
            <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-warn-ink)' }}>
              {tales.reduce((sum, t) => sum + (t.play_count || 0), 0)}
            </p>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.8 }}>{tr("untranslated_oxunub_u7g1tz", "Oxunub")}</p>
          </div>
        </div>
      }

      {/* Tales Library */}
      <Tabs defaultValue="all">
        <TabsList className="w-full grid grid-cols-2 h-auto rounded-full p-[3px] border-0 mb-4" style={{ background: 'var(--a-surface-soft)' }}>
          <TabsTrigger value="all" className={tabTriggerClass}>{tr("fairytalegenerator_hamisi_3ff72c", "Ham\u0131s\u0131 (")}{tales.length})</TabsTrigger>
          <TabsTrigger value="favorites" className={tabTriggerClass}>
            <Heart className="h-3.5 w-3.5 me-1" />
            ({favoriteTales.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          {isLoading ?
            <div className="a-card text-center" style={{ padding: '34px 18px' }}>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: 'var(--a-lav-2)' }} />
              <p className="a-list-sub" style={{ margin: 0 }}>{tr("fairytalegenerator_nagillar_yuklenir_44f0f1", "Nağıllar yüklənir...")}</p>
            </div> :
            tales.length === 0 ?
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="a-card text-center"
                style={{ padding: '34px 18px' }}>

                <div className="text-6xl mb-4">📚</div>
                <h3 className="a-list-title mb-2" style={{ margin: '0 0 8px' }}>{tr("fairytalegenerator_hele_nagil_yoxdur_f0166c", "Hələ nağıl yoxdur")}</h3>
                <p className="a-list-sub mb-4" style={{ margin: '0 0 16px', whiteSpace: 'normal' }}>{tr("fairytalegenerator_ilk_sehrli_nagilinizi_yaradin_efa8d2", "İlk sehrli nağılınızı yaradın!")}</p>
                <button data-fairytale-create onClick={() => setShowCreate(true)} className="a-cta-btn mx-auto" style={{ background: 'var(--a-lav-2)', color: '#fff' }}>
                  <Sparkles size={15} strokeWidth={2.2} />
                  {tr("fairytalegenerator_nagil_yarat_11707d", "Na\u011F\u0131l Yarat")}
                </button>
              </motion.div> :

              <div className="a-list-card">
                <AnimatePresence>
                  {tales.map((tale, index) =>
                    <motion.button
                      key={tale.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.3) }}
                      className="a-list-row w-full text-start"
                      style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer' }}
                      onClick={() => setSelectedTale(tale)}>

                      <span className="a-list-icon" style={{ background: 'var(--a-grad-lav)', fontSize: 18 }}>
                        {themes.find((t) => t.name === tale.theme)?.emoji || '📖'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="a-list-title truncate">{tale.title}</p>
                          {tale.is_favorite &&
                            <Heart className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--a-pink-2)', fill: 'var(--a-pink-2)' }} />
                          }
                        </div>
                        <p className="a-list-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tale.child_name} {tr("fairytalegenerator_ucun_yazildi_a6b83f", "\xFC\xE7\xFCn yaz\u0131ld\u0131")} · <Clock className="h-3 w-3 inline" /> {getReadingTime(tale.content)} {tr("fairytalegenerator_deq_780a5c", "d\u0259q")} · <BookOpenCheck className="h-3 w-3 inline" /> {tale.play_count || 0}×
                        </p>
                      </div>
                      <span className="a-list-trail">
                        <p className="a-list-time">{format(new Date(tale.created_at), 'd MMM', { locale: getCurrentDateLocale() })}</p>
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
          }
        </TabsContent>

        <TabsContent value="favorites" className="space-y-3">
          {favoriteTales.length === 0 ?
            <div className="a-card text-center" style={{ padding: '34px 18px' }}>
              <Heart className="h-12 w-12 mx-auto mb-2" style={{ color: 'var(--a-ink-faint)' }} />
              <p className="a-list-title" style={{ margin: 0 }}>{tr("fairytalegenerator_sevimli_nagil_yoxdur_756411", "Sevimli nağıl yoxdur")}</p>
              <p className="a-list-sub mt-1" style={{ margin: '4px 0 0', whiteSpace: 'normal' }}>{tr("fairytalegenerator_nagillari_oxuyarken_vurun_2acb44", "Nağılları oxuyarkən ❤️ vurun")}</p>
            </div> :

            <div className="a-list-card">
              {favoriteTales.map((tale) =>
                <button
                  key={tale.id}
                  className="a-list-row w-full text-start"
                  style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer' }}
                  onClick={() => setSelectedTale(tale)}>

                  <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)', fontSize: 18 }}>
                    {themes.find((t) => t.name === tale.theme)?.emoji || '📖'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="a-list-title truncate">{tale.title}</p>
                    <p className="a-list-sub">{tale.child_name} {tr("fairytalegenerator_ucun_0b2db5", "\xFC\xE7\xFCn")}</p>
                  </div>
                  <Heart className="h-5 w-5 shrink-0" style={{ color: 'var(--a-pink-2)', fill: 'var(--a-pink-2)' }} />
                </button>
              )}
            </div>
          }
        </TabsContent>
      </Tabs>

      {/* Create Modal - Multi-step wizard */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && resetCreate()}>
        <DialogContent className="a-scope max-w-md max-h-[85vh] overflow-y-auto rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <Wand2 className="h-5 w-5" style={{ color: 'var(--a-lav-2)' }} />
              {tr("fairytalegenerator_yeni_nagil_yarat_081219", "Yeni Na\u011F\u0131l Yarat")}
            </DialogTitle>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="a-tabs w-full mb-2" style={{ display: 'flex' }}>
            <button
              onClick={() => setCreateMode('wizard')}
              className={`a-tab flex-1 ${createMode === 'wizard' ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>

              <ListChecks className="h-3.5 w-3.5" />
              {tr("fairytalegenerator_secimle_9ee0cf", "Se\xE7iml\u0259")}
            </button>
            <button
              onClick={() => setCreateMode('direct')}
              className={`a-tab flex-1 ${createMode === 'direct' ? 'active' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>

              <PenLine className="h-3.5 w-3.5" />
              {tr("fairytalegenerator_serbest_yaz_4498e0", "S\u0259rb\u0259st yaz")}
            </button>
          </div>

          {createMode === 'direct' ? (
            /* Direct Prompt Mode */
            <motion.div
              key="direct"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4">

              <div>
                {fieldLabel(tr("fairytalegenerator_usagin_adi_80632b", "Uşağın adı"))}
                <p className="a-list-sub mb-2" style={{ margin: '2px 0 8px' }}>{tr("fairytalegenerator_isteye_bagli_nagilda_istifade_olunacaq_2d77bd", "İstəyə bağlı - nağılda istifadə olunacaq")}</p>
                <input
                  className="a-input w-full"
                  value={directChildName}
                  onChange={(e) => setDirectChildName(e.target.value)}
                  placeholder={followupText('fairytale_name_placeholder', language, { name: exampleChildName(directLanguage) })} />

              </div>

              <div>
                {fieldLabel(tr("fairytalegenerator_nagil_tesviri_4aad0a", "Nağıl təsviri *"))}
                <p className="a-list-sub mb-2" style={{ margin: '2px 0 8px' }}>{tr("fairytalegenerator_nagilin_nece_olmasini_istediyinizi_yazin_1a89d4", "Nağılın necə olmasını istədiyinizi yazın")}</p>
                <textarea
                  className="a-input w-full resize-none"
                  style={{ height: 'auto', minHeight: 96, fontFamily: 'inherit' }}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={tr("fairytalegenerator_meselen_1_yasina_hazirlasan_balaca_aslan_e692b9", "Məsələn: 1 yaşına hazırlaşan balaca aslan haqqında nağıl yaz, meşədə dostları ilə ad günü keçirsin...")}
                  rows={4} />

              </div>

              {/* Dil — tam eni, bərabər 4 sütun (sığmayan söz problemi yoxdur) */}
              <div>
                {fieldLabel(tr("untranslated_dil_g90qr5", "Dil"))}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {LANGUAGES.map((lang) =>
                    <button
                      key={lang.code}
                      type="button"
                      data-story-language={lang.code}
                      aria-label={lang.label}
                      aria-pressed={directLanguage === lang.code}
                      onClick={() => setDirectLanguage(lang.code)}
                      className="rounded-xl transition-all flex flex-col items-center justify-center gap-1"
                      style={{ ...(directLanguage === lang.code ? pillOn : pillOff), height: 56, padding: 0 }}>
                      <img src={`https://flagcdn.com/w40/${lang.flag}.png`} alt={lang.code} style={{ width: 24, height: 17, objectFit: 'cover', borderRadius: 3 }} />
                      <span className="text-[10.5px] font-semibold leading-tight px-1 break-words">{lang.label}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Yaş — eyni üslubda 4 sütun */}
              <div>
                {fieldLabel(tr("fairytalegenerator_yas_95595b", "Yaş"))}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {AGE_RANGES.map((age) =>
                    <button
                      key={age.value}
                      type="button"
                      onClick={() => setDirectAgeRange(age.value)}
                      className="rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 min-w-0"
                      style={{ ...(directAgeRange === age.value ? pillOn : pillOff), height: 56, padding: 0 }}>
                      <span className="text-base leading-none">{age.emoji}</span>
                      <span className="text-[10.5px] font-semibold whitespace-nowrap truncate max-w-full px-1">{age.label}</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                className="a-cta-btn w-full"
                style={{ justifyContent: 'center', height: 46, background: 'var(--a-lav-2)', color: '#fff', opacity: generateTale.isPending || !customPrompt.trim() ? 0.6 : 1 }}
                onClick={handleGenerate}
                disabled={generateTale.isPending || !customPrompt.trim()}>

                {generateTale.isPending ?
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr("fairytalegenerator_sehr_hazirlanir_04519a", "Nağıl hazırlanır...")}
                  </> :

                  <>
                    <Sparkles size={15} strokeWidth={2.2} />
                    {tr("fairytalegenerator_nagil_yarat_11707d", "Na\u011F\u0131l Yarat")}
                  </>
                }
              </button>
            </motion.div>) : (

            /* Wizard Mode */
            <>
              <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'var(--a-line-strong)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${createStep / 5 * 100}%`, background: 'var(--a-grad-lav)' }} />
              </div>
              <p className="a-list-sub text-center mb-2" style={{ margin: '0 0 8px' }}>
                {tr("fairytalegenerator_addim_9346cd", "Add\u0131m")} {createStep} / 5
              </p>
              <AnimatePresence mode="wait">
                {createStep === 1 &&
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                    className="space-y-4">

                    <div>
                      {fieldLabel(tr("fairytalegenerator_usagin_adi_163b8d", "Uşağın adı *"))}
                      <p className="a-list-sub mb-2" style={{ margin: '2px 0 8px' }}>{tr("fairytalegenerator_nagilda_esas_qehreman_kimi_olacaq_25a4c8", "Nağılda əsas qəhrəman kimi olacaq")}</p>
                      <input
                        className="a-input w-full text-lg"
                        value={formData.child_name}
                        onChange={(e) => setFormData({ ...formData, child_name: e.target.value })}
                        placeholder={followupText('fairytale_name_placeholder', language, { name: exampleChildName(formData.language) })}
                        autoFocus />

                    </div>

                    {/* Age Range */}
                    <div>
                      {fieldLabel(tr("fairytalegenerator_yas_qrupu_54b8f9", "Ya\u015F qrupu"), <Baby className="h-4 w-4" />)}
                      <p className="a-list-sub mb-2" style={{ margin: '2px 0 8px' }}>{tr("fairytalegenerator_nagilin_cetinlik_seviyyesi_49f08d", "Nağılın çətinlik səviyyəsi")}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {AGE_RANGES.map((age) =>
                          <button
                            key={age.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, age_range: age.value })}
                            className="p-2 rounded-xl text-center transition-all"
                            style={formData.age_range === age.value ? pillOn : pillOff}>

                            <span className="text-lg block">{age.emoji}</span>
                            <span className="text-xs font-semibold">{age.label}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Language Selection — vahid 4 sütunlu dizayn */}
                    <div>
                      {fieldLabel(tr("fairytalegenerator_nagilin_dili_04ad3e", "Na\u011F\u0131l\u0131n dili"), <Globe className="h-4 w-4" />)}
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {LANGUAGES.map((lang) =>
                          <button
                            key={lang.code}
                            type="button"
                            data-story-language={lang.code}
                            aria-label={lang.label}
                            aria-pressed={formData.language === lang.code}
                            onClick={() => setFormData({ ...formData, language: lang.code })}
                            className="rounded-xl transition-all flex flex-col items-center justify-center gap-1"
                            style={{ ...(formData.language === lang.code ? pillOn : pillOff), height: 58, padding: 0 }}>
                            <img src={`https://flagcdn.com/w40/${lang.flag}.png`} alt={lang.code} style={{ width: 26, height: 18, objectFit: 'cover', borderRadius: 3 }} />
                            <span className="text-[10.5px] font-semibold leading-tight px-1 break-words">{lang.label}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      className="a-cta-btn w-full"
                      style={{ justifyContent: 'center', height: 44, background: 'var(--a-lav-2)', color: '#fff', opacity: !formData.child_name.trim() ? 0.5 : 1 }}
                      onClick={() => setCreateStep(2)}
                      disabled={!formData.child_name.trim()}>{tr("untranslated_davam_et_rchhd5", "Davam et")}</button>
                  </motion.div>
                }

                {/* Step 2: Theme */}
                {createStep === 2 &&
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                    className="space-y-4">

                    <div>
                      {fieldLabel(tr("fairytalegenerator_nagilin_movzusu_f10323", "Nağılın mövzusu *"))}
                      <p className="a-list-sub mb-3" style={{ margin: '2px 0 12px' }}>{tr("fairytalegenerator_hansi_dunyada_macera_olsun_e7e752", "Hansı dünyada macəra olsun?")}</p>
                      <div className="grid grid-cols-3 gap-3">
                        {themes.map((theme) =>
                          <motion.button
                            key={theme.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, theme: theme.name })}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-4 rounded-xl text-center transition-all"
                            style={formData.theme === theme.name ?
                            { background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer', border: 'none' } :
                            pillOff}>

                            <span className="text-3xl block mb-1">{theme.emoji}</span>
                            <span className="text-xs font-semibold">{theme.name}</span>
                          </motion.button>
                        )}
                      </div>
                    </div>

                    {/* Story Style */}
                    <div>
                      {fieldLabel(tr("fairytalegenerator_nagilin_uslubu_9f0076", "Nağılın üslubu"))}
                      <p className="a-list-sub mb-2" style={{ margin: '2px 0 8px' }}>{tr("fairytalegenerator_hansi_terzde_yazilsin_43fa45", "Hansı tərzdə yazılsın?")}</p>
                      <div className="flex flex-wrap gap-2">
                        {STORY_STYLES.map((style) =>
                          <button
                            key={style.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, story_style: style.value })}
                            className="px-3 py-1.5 rounded-full text-sm transition-all font-semibold"
                            style={formData.story_style === style.value ? pillOn : pillOff}>

                            {style.emoji} {style.label}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="a-btn-soft" style={{ height: 44, padding: '0 18px' }} onClick={() => setCreateStep(1)}>{tr("common_geri", "Geri")}</button>
                      <button
                        className="a-cta-btn flex-1"
                        style={{ justifyContent: 'center', height: 44, background: 'var(--a-lav-2)', color: '#fff', opacity: !formData.theme ? 0.5 : 1 }}
                        onClick={() => setCreateStep(3)}
                        disabled={!formData.theme}>{tr("untranslated_davam_et_rchhd5", "Davam et")}</button>
                    </div>
                  </motion.div>
                }

                {/* Step 3: Hero */}
                {createStep === 3 &&
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                    className="space-y-4">

                    <div>
                      {fieldLabel(tr("fairytalegenerator_komekci_qehreman_077b6f", "Köməkçi qəhrəman"))}
                      <p className="a-list-sub mb-2" style={{ margin: '2px 0 8px' }}>{tr("fairytalegenerator_isteye_bagli_usagin_dostu_f51381", "İstəyə bağlı - uşağın dostu")}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {HERO_SUGGESTIONS.map((hero) =>
                          <button
                            key={hero.label}
                            type="button"
                            onClick={() => setFormData({ ...formData, hero: hero.label })}
                            className="px-3 py-1.5 rounded-full text-sm transition-all font-semibold"
                            style={formData.hero === hero.label ? pillOn : pillOff}>

                            {hero.emoji} {hero.label}
                          </button>
                        )}
                      </div>
                      <input
                        className="a-input w-full"
                        value={formData.hero}
                        onChange={(e) => setFormData({ ...formData, hero: e.target.value })}
                        placeholder={followupText('fairytale_hero_placeholder', language)} />

                    </div>

                    <div className="flex gap-2">
                      <button className="a-btn-soft" style={{ height: 44, padding: '0 18px' }} onClick={() => setCreateStep(2)}>{tr("common_geri", "Geri")}</button>
                      <button
                        className="a-cta-btn flex-1"
                        style={{ justifyContent: 'center', height: 44, background: 'var(--a-lav-2)', color: '#fff' }}
                        onClick={() => setCreateStep(4)}>{tr("untranslated_davam_et_rchhd5", "Davam et")}</button>
                    </div>
                  </motion.div>
                }

                {/* Step 4: Moral lesson */}
                {createStep === 4 &&
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                    className="space-y-4">

                    <div>
                      {fieldLabel(tr("fairytalegenerator_terbiyevi_mesaj_6bdeb6", "Tərbiyəvi mesaj"))}
                      <p className="a-list-sub mb-2" style={{ margin: '2px 0 8px' }}>{tr("fairytalegenerator_nagilin_sonunda_hansi_ders_olsun_4d833e", "Nağılın sonunda hansı dərs olsun?")}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {MORAL_LESSONS.map((lesson) =>
                          <button
                            key={lesson.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, moral_lesson: lesson.value })}
                            className="p-2 rounded-lg text-start text-sm transition-all font-semibold"
                            style={formData.moral_lesson === lesson.value ? pillOn : pillOff}>

                            {lesson.emoji} {lesson.label}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="a-btn-soft" style={{ height: 44, padding: '0 18px' }} onClick={() => setCreateStep(3)}>{tr("common_geri", "Geri")}</button>
                      <button
                        className="a-cta-btn flex-1"
                        style={{ justifyContent: 'center', height: 44, background: 'var(--a-lav-2)', color: '#fff' }}
                        onClick={() => setCreateStep(5)}>{tr("untranslated_davam_et_rchhd5", "Davam et")}</button>
                    </div>
                  </motion.div>
                }

                {/* Step 5: Summary & Generate */}
                {createStep === 5 &&
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: rtlX(20, isRtl) }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
                    className="space-y-4">

                    <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--a-surface-soft)' }}>
                      <h3 className="font-bold text-sm mb-3 a-heading" style={{ margin: '0 0 12px', color: 'var(--a-ink)' }}>{tr("fairytalegenerator_nagil_xulasesi_07d402", "📋 Nağıl xülasəsi")}</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span style={{ color: 'var(--a-ink-soft)' }}>{tr("fairytalegenerator_usaq_b70dbc", "Uşaq:")}</span>
                          <p className="font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>{formData.child_name}</p>
                        </div>
                        <div>
                          <span style={{ color: 'var(--a-ink-soft)' }}>{tr("fairytalegenerator_yas_8ef26c", "Yaş:")}</span>
                          <p className="font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>{AGE_RANGES.find((a) => a.value === formData.age_range)?.label}</p>
                        </div>
                        <div>
                          <span style={{ color: 'var(--a-ink-soft)' }}>{tr("fairytalegenerator_movzu_5a3526", "Mövzu:")}</span>
                          <p className="font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>{themes.find((t) => t.name === formData.theme)?.name || formData.theme}</p>
                        </div>
                        <div>
                          <span style={{ color: 'var(--a-ink-soft)' }}>{tr("untranslated_dil_rfnolb", "Dil:")}</span>
                          <p className="font-semibold flex items-center gap-2" style={{ margin: 0, color: 'var(--a-ink)' }}>
                            <img src={`https://flagcdn.com/w40/${LANGUAGES.find((l) => l.code === formData.language)?.flag}.png`} alt="" className="w-5 h-auto rounded-sm shadow-sm" />
                            {LANGUAGES.find((l) => l.code === formData.language)?.label}
                          </p>
                        </div>
                        {formData.hero &&
                          <div>
                            <span style={{ color: 'var(--a-ink-soft)' }}>{tr("fairytalegenerator_qehreman_aea468", "Qəhrəman:")}</span>
                            <p className="font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>{formData.hero}</p>
                          </div>
                        }
                        {formData.moral_lesson &&
                          <div>
                            <span style={{ color: 'var(--a-ink-soft)' }}>{tr("untranslated_mesaj_x98xat", "Mesaj:")}</span>
                            <p className="font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>{MORAL_LESSONS.find((m) => m.value === formData.moral_lesson)?.label}</p>
                          </div>
                        }
                        {formData.story_style &&
                          <div>
                            <span style={{ color: 'var(--a-ink-soft)' }}>{tr("fairytalegenerator_uslub_b96040", "Üslub:")}</span>
                            <p className="font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>{STORY_STYLES.find((s) => s.value === formData.story_style)?.label}</p>
                          </div>
                        }
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="a-btn-soft" style={{ height: 44, padding: '0 18px' }} onClick={() => setCreateStep(4)}>{tr("common_geri", "Geri")}</button>
                      <button
                        className="a-cta-btn flex-1"
                        style={{ justifyContent: 'center', height: 44, background: 'var(--a-lav-2)', color: '#fff', opacity: generateTale.isPending ? 0.6 : 1 }}
                        onClick={handleGenerate}
                        disabled={generateTale.isPending}>

                        {generateTale.isPending ?
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {tr("fairytalegenerator_sehr_hazirlanir_04519a", "Nağıl hazırlanır...")}
                          </> :

                          <>
                            <Sparkles size={15} strokeWidth={2.2} />
                            {tr("fairytalegenerator_nagil_yarat_11707d", "Na\u011F\u0131l Yarat")}
                          </>
                        }
                      </button>
                    </div>
                  </motion.div>
                }
              </AnimatePresence>
            </>)
          }
        </DialogContent>
      </Dialog>

      {/* Tale Reader Modal */}
      <Dialog open={!!selectedTale} onOpenChange={(open) => {
        if (!open) setSelectedTale(null);
      }}>
        <DialogContent className="a-scope max-w-md max-h-[90vh] overflow-y-auto p-0 rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          {selectedTale &&
            <>
              {/* Header with gradient */}
              <div className="p-6 sticky top-0 z-20 isolate" style={{ background: 'var(--a-grad-lav)' }}>
                {/* Close button */}
                <button
                  onClick={() => setSelectedTale(null)}
                  className="absolute top-3 end-3 z-30 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.35)' }}>

                  <X className="h-5 w-5" style={{ color: 'var(--a-lav-ink)' }} />
                </button>

                <div className="flex items-center gap-3 mb-4 relative z-20 pe-8">
                  <div className="text-4xl">
                    {themes.find((t) => t.name === selectedTale.theme)?.emoji || '📖'}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg a-heading" style={{ margin: 0, color: 'var(--a-lav-ink)' }}>{selectedTale.title}</h2>
                    <p className="text-sm" style={{ margin: 0, color: 'var(--a-lav-ink)', opacity: 0.8 }}>{selectedTale.child_name} {tr("fairytalegenerator_ucun_0b2db5", "\xFC\xE7\xFCn")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--a-lav-ink)', opacity: 0.8 }}>
                  <Clock className="h-4 w-4" />
                  <span>{getReadingTime(selectedTale.content)} {tr("fairytalegenerator_deqiqelik_oxu_1896a5", "d\u0259qiq\u0259lik oxu")}</span>
                  <span className="mx-2">•</span>
                  <span>{format(new Date(selectedTale.created_at), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}</span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed" style={{ color: 'var(--a-body-text)' }}>
                  <MarkdownContent content={selectedTale.content} />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-4 sticky bottom-0 pb-2" style={{ borderTop: '1px solid var(--a-line)', background: 'var(--a-surface)' }}>
                  <button
                    className="a-icon-btn"
                    style={{ width: 40, height: 40 }}
                    onClick={() => {
                      toggleFavorite.mutate({ id: selectedTale.id, isFavorite: !selectedTale.is_favorite });
                      setSelectedTale({ ...selectedTale, is_favorite: !selectedTale.is_favorite });
                    }}>

                    <Heart
                      className="h-4 w-4"
                      style={selectedTale.is_favorite ? { fill: 'var(--a-pink-2)', color: 'var(--a-pink-2)' } : undefined} />
                  </button>
                  <button
                    className="a-icon-btn"
                    style={{ width: 40, height: 40 }}
                    onClick={() => {
                      deleteTale.mutate(selectedTale.id);
                      setSelectedTale(null);
                    }}>

                    <Trash2 className="h-4 w-4" style={{ color: 'var(--a-pink-ink)' }} />
                  </button>
                  <div className="flex-1" />
                  <button className="a-btn-soft" style={{ height: 40, padding: '0 16px' }} onClick={() => setSelectedTale(null)}>
                    <X size={13} strokeWidth={2.2} />
                    {tr("fairytalegenerator_bagla_84bdc9", "Ba\u011Fla")}
                  </button>
                </div>
              </div>
            </>
          }
        </DialogContent>
      </Dialog>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="fairy_tale" />
    </ToolPage>);

};

export default FairyTaleGenerator;
