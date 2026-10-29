import { useState } from 'react';
import { ArrowLeft, ArrowRight, Star, Share2, Sparkles, Users, Moon, Sun, Compass, Flame, Droplets, Wind, Mountain, Clock, Calendar as CalendarIcon, Loader2, Heart, Zap, Book, Palette, Hash, Check, Baby, User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DatePickerWheel } from '@/components/ui/date-picker-wheel';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
import { useZodiacSigns, useSaveHoroscopeReading, ZodiacSign } from '@/hooks/useHoroscope';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr, getPersistedLanguage } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';

interface HoroscopeCompatibilityProps {
  onBack: () => void;
}

interface PersonData {
  birthDate: Date | undefined;
  birthTime: string;
  hasBirthTime: boolean;
}

interface AIAnalysisResult {
  charts: {
    mom: ChartData;
    dad: ChartData | null;
    baby: ChartData | null;
  };
  analysis: {
    overallScore: number;
    keywords: string[];
    momAnalysis: string;
    dadAnalysis: string;
    babyAnalysis: string;
    familyDynamics: string;
    momBabyConnection: string;
    dadBabyConnection: string;
    parentCompatibility: string;
    recommendations: string[];
    luckyColors: string[];
    luckyDays: string[];
    luckyNumbers: string[];
  };
}

interface ChartData {
  sun: {sign: string;signAz: string;symbol: string;element: string;};
  moon: {sign: string;signAz: string;symbol: string;};
  rising: {sign: string;signAz: string;symbol: string;} | null;
  birthDate: string;
  birthTime?: string;
  isExpected?: boolean;
}

const ELEMENT_ICONS: Record<string, any> = {
  fire: Flame,
  water: Droplets,
  air: Wind,
  earth: Mountain
};

const ELEMENT_NAMES: Record<string, string> = {
  fire: tr("horoscope_element_fire", "Od"),
  water: tr("horoscope_element_water", "Su"),
  air: tr("horoscope_element_air", "Hava"),
  earth: tr("horoscope_element_earth", "Torpaq")
};

// Ulduz fonu: deterministik mövqelər (hər renderdə Math.random yox) və CSS pulse
// (50 sonsuz framer animasiyası zəif cihazları dondururdu)
const LOADING_STARS = Array.from({ length: 50 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 61 + 13) % 100,
  size: 4 + (i * 29) % 17,
  duration: 1.5 + (i * 7) % 20 / 10,
  delay: (i * 11) % 20 / 10
}));

const LOADING_STEPS = [
{ icon: Star, text: tr("horoscope_reading_stars", "Ulduzlar oxunur..."), color: 'text-yellow-500' },
{ icon: Moon, text: tr("horoscopecompatibility_ay_fazasi_hesablanir_63cb3c", "Ay fazası hesablanır..."), color: 'text-blue-400' },
{ icon: Sun, text: tr("horoscopecompatibility_gunes_movqeyi_teyin_edilir_bfba89", "Günəş mövqeyi təyin edilir..."), color: 'text-orange-500' },
{ icon: Compass, text: tr("horoscopecompatibility_yukselen_burc_axtarilir_f2408d", "Yüksələn bürc axtarılır..."), color: 'text-purple-400' },
{ icon: Heart, text: tr("horoscopecompatibility_uygunluq_analiz_edilir_bca7bd", "Uyğunluq analiz edilir..."), color: 'text-pink-400' },
{ icon: Sparkles, text: tr("horoscopecompatibility_kosmik_tovsiyeler_hazirlanir_25cfbf", "Kosmik tövsiyələr hazırlanır..."), color: 'text-cyan-400' }];


const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
[`${h.toString().padStart(2, '0')}:00`, `${h.toString().padStart(2, '0')}:30`]
).flat();

const STEPS = [
{ id: 1, title: tr("common_ana", 'Ana'), icon: User, emoji: '👩' },
{ id: 2, title: tr("common_ata", 'Ata'), icon: User, emoji: '👨' },
{ id: 3, title: tr("horoscopecompatibility_korpe_fa2b51", 'Körpə'), icon: Baby, emoji: '👶' }];


// Score → anacan palette
const getScoreStyle = (score: number) => {
  if (score >= 80) return { grad: 'var(--a-grad-green)', ink: 'var(--a-green-ink)' };
  if (score >= 60) return { grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' };
  if (score >= 40) return { grad: 'var(--a-grad-peach)', ink: 'var(--a-accent-ink)' };
  return { grad: 'var(--a-grad-pink)', ink: 'var(--a-alert-ink)' };
};

const HoroscopeCompatibility = ({ onBack }: HoroscopeCompatibilityProps) => {
  useScreenAnalytics('HoroscopeCompatibility', 'Tools');
  const isRtl = useIsRtl();
  const { profile } = useAuthContext();
  const [currentStep, setCurrentStep] = useState(1);
  const [momData, setMomData] = useState<PersonData>({
    birthDate: undefined,
    birthTime: '',
    hasBirthTime: false
  });
  const [dadData, setDadData] = useState<PersonData>({
    birthDate: undefined,
    birthTime: '',
    hasBirthTime: false
  });
  const [babyData, setBabyData] = useState<PersonData>({
    birthDate: profile?.baby_birth_date ? new Date(profile.baby_birth_date) : undefined,
    birthTime: '',
    hasBirthTime: false
  });
  const [isBabyExpected, setIsBabyExpected] = useState(!profile?.baby_birth_date);
  const [expectedDueDate, setExpectedDueDate] = useState<Date | undefined>(
    (profile as any)?.expected_due_date ? new Date((profile as any).expected_due_date) : undefined
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);

  const { data: zodiacSigns = [] } = useZodiacSigns();
  const saveReading = useSaveHoroscopeReading();
  const { checkAndConsume } = useSubscription();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const getZodiacForDate = (date: Date | undefined) => {
    if (!date || zodiacSigns.length === 0) return null;
    const monthDay = format(date, 'MM-dd');
    return zodiacSigns.find((s) => {
      if (s.start_date > s.end_date) {
        return monthDay >= s.start_date || monthDay <= s.end_date;
      }
      return monthDay >= s.start_date && monthDay <= s.end_date;
    });
  };

  const handleAnalyze = async () => {
    if (!momData.birthDate) {
      toast.error(tr("horoscopecompatibility_ananin_dogum_tarixini_daxil_ed_d186ab", "Anan\u0131n do\u011Fum tarixini daxil edin"));
      return;
    }

    // Gündəlik pulsuz limit (premium → limitsiz)
    const { allowed } = await checkAndConsume('horoscope');
    if (!allowed) {
      setShowPremiumModal(true);
      return;
    }

    setIsAnalyzing(true);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => prev < LOADING_STEPS.length - 1 ? prev + 1 : prev);
    }, 1200);

    try {
      const payload: Record<string, string | undefined> = {
        mom_birth_date: format(momData.birthDate, 'yyyy-MM-dd'),
        mom_birth_time: momData.hasBirthTime ? momData.birthTime : undefined
      };

      if (dadData.birthDate) {
        payload.dad_birth_date = format(dadData.birthDate, 'yyyy-MM-dd');
        if (dadData.hasBirthTime) payload.dad_birth_time = dadData.birthTime;
      }

      if (isBabyExpected && expectedDueDate) {
        payload.baby_due_date = format(expectedDueDate, 'yyyy-MM-dd');
      } else if (babyData.birthDate) {
        payload.baby_birth_date = format(babyData.birthDate, 'yyyy-MM-dd');
        if (babyData.hasBirthTime) payload.baby_birth_time = babyData.birthTime;
      }

      const { data, error } = await supabase.functions.invoke('analyze-horoscope', {
        body: {
          ...payload,
          language: getPersistedLanguage()
        }
      });

      clearInterval(stepInterval);

      if (error) throw error;

      setAnalysisResult(data);

      await saveReading.mutateAsync({
        mom_sign: data.charts.mom.sun.sign,
        dad_sign: data.charts.dad?.sun.sign,
        baby_sign: data.charts.baby?.sun.sign,
        compatibility_result: data
      });

      toast.success(tr("horoscopecompatibility_analiz_tamamlandi_cd8c9d", "Analiz tamamland\u0131!"));
    } catch (error) {
      console.error('Horoscope analysis error:', error);
      toast.error(tr("horoscopecompatibility_analiz_zamani_xeta_bas_verdi_66508c", "Analiz zaman\u0131 x\u0259ta ba\u015F verdi"));
      clearInterval(stepInterval);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleShare = async () => {
    if (!analysisResult) return;

    const { charts, analysis } = analysisResult;
    const text = `${tr("horoscope_share_title", "✨ Ailə Doğum Xəritəsi Analizi ✨")}

👩 ${tr("horoscope_share_mom", "Ana")}: ${charts.mom.sun.symbol} ${charts.mom.sun.signAz}
${charts.dad ? `👨 ${tr("horoscope_share_dad", "Ata")}: ${charts.dad.sun.symbol} ${charts.dad.sun.signAz}` : ''}
${charts.baby ? `👶 ${charts.baby.isExpected ? tr("horoscopecompatibility_gozlenilen_4885bf", "G\xF6zl\u0259nil\u0259n") : ''} ${tr("horoscope_share_baby", "Körpə")}: ${charts.baby.sun.symbol} ${charts.baby.sun.signAz}` : ''}

🌟 ${tr("horoscope_share_compatibility", "Ümumi Uyğunluq")}: ${analysis.overallScore}%

${tr("horoscope_share_footer", "Anacan tətbiqi ilə yaradılıb 💜")}`;

    const { nativeShare } = await import('@/lib/native');
    await nativeShare({ text });
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return tr("horoscopecompatibility_mukemmel_kosmik_harmoniya_d98359", "\uD83D\uDCAB M\xFCk\u0259mm\u0259l kosmik harmoniya!");
    if (score >= 80) return tr("horoscopecompatibility_ela_uygunluq_3b4329", "\uD83C\uDF1F \u018Fla uy\u011Funluq!");
    if (score >= 70) return tr("horoscopecompatibility_cox_yaxsi_enerji_axini_17ac98", "\u2728 \xC7ox yax\u015F\u0131 enerji ax\u0131n\u0131");
    if (score >= 60) return tr("horoscopecompatibility_guclu_bag_555d3b", "\uD83D\uDCAA G\xFCcl\xFC ba\u011F");
    if (score >= 50) return tr("horoscopecompatibility_tarazli_elaqe_8d9302", "\uD83E\uDD1D Tarazl\u0131 \u0259laq\u0259");
    return tr("horoscopecompatibility_ferqlilik_gucunuzdur_67c1a4", "\uD83D\uDC9D F\u0259rqlilik g\xFCc\xFCn\xFCzd\xFCr!");
  };

  // Step content renderer
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: rtlX(20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
            className="space-y-4">
            
            <PersonInput
              label={tr("horoscopecompatibility_ananin_dogum_melumatlari_61548b", "Ananın Doğum Məlumatları")}
              emoji="👩"
              data={momData}
              setData={setMomData}
              zodiacSigns={zodiacSigns}
              isRequired />
            
          </motion.div>);

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: rtlX(20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
            className="space-y-4">
            
            <PersonInput
              label={tr("horoscopecompatibility_atanin_dogum_melumatlari_fef9a1", "Atanın Doğum Məlumatları")}
              emoji="👨"
              data={dadData}
              setData={setDadData}
              zodiacSigns={zodiacSigns}
              isOptional />
            
          </motion.div>);

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: rtlX(20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: rtlX(-20, isRtl) }}
            className="space-y-4">
            
            <div className="a-card flex items-center justify-between" style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤰</span>
                <span className="a-list-title" style={{ margin: 0 }}>{tr("horoscopecompatibility_korpe_hele_dogulmayib_b729e6", "Körpə hələ doğulmayıb")}</span>
              </div>
              <Switch checked={isBabyExpected} onCheckedChange={setIsBabyExpected} />
            </div>

            {isBabyExpected ?
            <div className="a-card space-y-3" style={{ background: 'var(--a-pink-1)', border: 'none' }}>
                <p className="font-bold flex items-center gap-2" style={{ margin: 0, color: 'var(--a-berry-ink)' }}>
                  <CalendarIcon className="h-4 w-4" />
                  {tr("horoscopecompatibility_gozlenilen_dogum_tarixi_a01877", "G\xF6zl\u0259nil\u0259n Do\u011Fum Tarixi")}
                </p>
                <DatePickerWheel
                value={expectedDueDate}
                onChange={setExpectedDueDate}
                minYear={new Date().getFullYear()}
                maxYear={new Date().getFullYear() + 1}
                disabled={(date) => date < new Date()}
                placeholder={tr("horoscopecompatibility_gozlenilen_tarix_secin_fdf25e", "Gözlənilən tarix seçin")} />
              
              </div> :

            <PersonInput
              label={tr("horoscopecompatibility_korpenin_dogum_melumatlari_4ef9a4", "Körpənin Doğum Məlumatları")}
              emoji="👶"
              data={babyData}
              setData={setBabyData}
              zodiacSigns={zodiacSigns}
              isOptional />

            }
          </motion.div>);

      default:
        return null;
    }
  };

  // If we have results, show the results view
  if (analysisResult) {
    const scoreStyle = getScoreStyle(analysisResult.analysis.overallScore);
    return (
      <ToolPage>
        {/* Result Header */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={() => setAnalysisResult(null)} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label="Back">
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div style={{ minWidth: 0 }}>
              <p className="a-eyebrow">{tr("horoscopecompatibility_ulduz_fali_344189", "Ulduz Fal\u0131")}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("horoscopecompatibility_neticeniz_d14591", "Nəticəniz")}</p>
            </div>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="a-card text-center mb-3"
          style={{ background: scoreStyle.grad, border: 'none', padding: '26px 18px' }}>
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="a-heading"
            style={{ fontSize: 56, color: scoreStyle.ink }}>
            
            {analysisResult.analysis.overallScore}%
          </motion.div>
          <p className="text-xl font-bold a-heading" style={{ margin: 0, color: scoreStyle.ink }}>{getScoreMessage(analysisResult.analysis.overallScore)}</p>
          
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            {analysisResult.analysis.keywords.map((keyword, i) =>
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="px-4 py-1.5 rounded-full text-sm font-semibold"
              style={{ background: 'var(--a-chip-overlay)', color: scoreStyle.ink }}>
              
                {keyword}
              </motion.span>
            )}
          </div>
        </motion.div>

        <div className="space-y-3">
          <div className="rounded-2xl px-3 py-2" style={{ background: 'var(--a-lav-1)' }}>
            <p className="text-[11px] leading-relaxed" style={{ margin: 0, color: 'var(--a-lav-ink)' }}>
              ✨ {tr('horoscope_entertainment_disclaimer', 'Ulduz falı yalnız əyləncə məqsədi daşıyır. Tibbi, psixoloji və ya valideynlik qərarları üçün ixtisaslı mütəxəssisə (həkim/psixoloq) müraciət edin.')}
            </p>
          </div>

          {/* Birth Charts */}
          <div className="a-card space-y-4">
            <h3 className="a-card-title a-heading flex items-center gap-2" style={{ margin: 0 }}>
              <Sun className="h-5 w-5" style={{ color: 'var(--a-yellow-2)' }} />
              {tr("horoscopecompatibility_dogum_xeriteleri_c9a3ce", "Do\u011Fum X\u0259rit\u0259l\u0259ri")}
            </h3>
            
            <BirthChartCard chart={analysisResult.charts.mom} label={tr("common_ana", "Ana")} emoji="👩" />
            {analysisResult.charts.dad &&
            <BirthChartCard chart={analysisResult.charts.dad} label={tr("common_ata", "Ata")} emoji="👨" />
            }
            {analysisResult.charts.baby &&
            <BirthChartCard
              chart={analysisResult.charts.baby}
              label={analysisResult.charts.baby.isExpected ? tr("horoscopecompatibility_gozlenilen_korpe_62132c", "G\xF6zl\u0259nil\u0259n K\xF6rp\u0259") : tr("horoscopecompatibility_korpe_fa2b51", "K\xF6rp\u0259")}
              emoji="👶" />

            }
          </div>

          {/* Analysis Sections */}
          {analysisResult.analysis.momAnalysis &&
          <AnalysisCard
            title={tr("horoscope_ana_analizi", "Ana Analizi")}
            emoji="👩"
            content={analysisResult.analysis.momAnalysis}
            bg="var(--a-pink-1)"
            ink="var(--a-berry-ink)" />

          }

          {analysisResult.analysis.dadAnalysis && analysisResult.charts.dad &&
          <AnalysisCard
            title={tr("horoscope_ata_analizi", "Ata Analizi")}
            emoji="👨"
            content={analysisResult.analysis.dadAnalysis}
            bg="var(--a-blue-1)"
            ink="var(--a-blue-ink)" />

          }

          {analysisResult.analysis.babyAnalysis && analysisResult.charts.baby &&
          <AnalysisCard
            title={analysisResult.charts.baby.isExpected ? tr("horoscopecompatibility_korpe_proqnozu_3079df", "K\xF6rp\u0259 Proqnozu") : tr("horoscopecompatibility_korpe_analizi_f790ae", "K\xF6rp\u0259 Analizi")}
            emoji="👶"
            content={analysisResult.analysis.babyAnalysis}
            bg="var(--a-yellow-1)"
            ink="var(--a-warn-ink)" />

          }

          {analysisResult.analysis.familyDynamics &&
          <AnalysisCard
            title={tr("horoscopecompatibility_aile_dinamikasi_ee22f4", "Ailə Dinamikası")}
            icon={<Users className="h-5 w-5" />}
            content={analysisResult.analysis.familyDynamics}
            bg="var(--a-lav-1)"
            ink="var(--a-lav-ink)" />

          }

          {analysisResult.analysis.momBabyConnection && analysisResult.charts.baby &&
          <AnalysisCard
            title={tr("horoscopecompatibility_ana_korpe_kosmik_bagi_deb848", "Ana-Körpə Kosmik Bağı")}
            icon={<Heart className="h-5 w-5" />}
            content={analysisResult.analysis.momBabyConnection}
            bg="var(--a-pink-1)"
            ink="var(--a-berry-ink)" />

          }

          {analysisResult.analysis.parentCompatibility && analysisResult.charts.dad &&
          <AnalysisCard
            title={tr("horoscopecompatibility_valideynler_uygunlugu_27180e", "Valideynlər Uyğunluğu")}
            icon={<Zap className="h-5 w-5" />}
            content={analysisResult.analysis.parentCompatibility}
            bg="var(--a-peach-1)"
            ink="var(--a-accent-ink)" />

          }

          {/* Recommendations */}
          {analysisResult.analysis.recommendations.length > 0 &&
          <div className="a-card">
              <h3 className="a-card-title a-heading flex items-center gap-2 mb-3" style={{ margin: '0 0 12px' }}>
                <Book className="h-5 w-5" style={{ color: 'var(--a-lav-2)' }} />
                {tr("horoscopecompatibility_kosmik_tovsiyeler_d95708", "Kosmik T\xF6vsiy\u0259l\u0259r")}
              </h3>
              <ul className="space-y-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {analysisResult.analysis.recommendations.map((rec, i) =>
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 text-sm"
                style={{ color: 'var(--a-body-text)' }}>
                
                    <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' }}>
                      {i + 1}
                    </span>
                    {rec}
                  </motion.li>
              )}
              </ul>
            </div>
          }

          {/* Lucky Items */}
          <div className="grid grid-cols-3 gap-3">
            {analysisResult.analysis.luckyColors.length > 0 &&
            <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-pink-1)' }}>
                <Palette className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--a-berry-ink)' }} />
                <p className="text-xs mb-1" style={{ margin: '0 0 4px', color: 'var(--a-berry-ink)', opacity: 0.8 }}>{tr("horoscopecompatibility_ugurlu_rengler_e52ad0", "Uğurlu rənglər")}</p>
                <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-alert-ink)' }}>{analysisResult.analysis.luckyColors.join(', ')}</p>
              </div>
            }
            {analysisResult.analysis.luckyDays.length > 0 &&
            <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-blue-1)' }}>
                <CalendarIcon className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--a-blue-ink)' }} />
                <p className="text-xs mb-1" style={{ margin: '0 0 4px', color: 'var(--a-blue-ink)', opacity: 0.8 }}>{tr("horoscopecompatibility_ugurlu_gunler_6caab8", "Uğurlu günlər")}</p>
                <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>{analysisResult.analysis.luckyDays.join(', ')}</p>
              </div>
            }
            {analysisResult.analysis.luckyNumbers.length > 0 &&
            <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-green-1)' }}>
                <Hash className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--a-green-ink)' }} />
                <p className="text-xs mb-1" style={{ margin: '0 0 4px', color: 'var(--a-green-ink)', opacity: 0.8 }}>{tr("horoscopecompatibility_xosbext_reqemler_4d0da9", "Xoşbəxt rəqəmlər")}</p>
                <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-green-ink)' }}>{analysisResult.analysis.luckyNumbers.join(', ')}</p>
              </div>
            }
          </div>

          {/* Share Button */}
          <button className="a-btn-soft w-full" style={{ justifyContent: 'center', height: 48 }} onClick={handleShare}>
            <Share2 size={15} strokeWidth={2.2} />
            {tr("horoscopecompatibility_neticeni_paylas_28650c", "N\u0259tic\u0259ni Payla\u015F")}
          </button>
        </div>
      </ToolPage>);

  }

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("horoscopecompatibility_aile_dinamikasi_ee22f4", "Ailə Dinamikası")}
        title={tr("horoscopecompatibility_ulduz_fali_344189", "Ulduz Fal\u0131")} />

      {/* Step Indicators */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map((step) =>
        <motion.button
          key={step.id}
          onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-bold transition-all"
          style={
          currentStep === step.id ?
          { background: 'var(--a-lav-2)', color: '#fff', cursor: 'pointer' } :
          currentStep > step.id ?
          { background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)', cursor: 'pointer' } :
          { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)' }}
          whileTap={{ scale: 0.98 }}>
          
            {currentStep > step.id ?
          <Check className="h-3 w-3" /> :

          <span>{step.emoji}</span>
          }
            {step.title}
          </motion.button>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl px-3 py-2" style={{ background: 'var(--a-lav-1)' }}>
          <p className="text-[11px] leading-relaxed" style={{ margin: 0, color: 'var(--a-lav-ink)' }}>
            ✨ {tr('horoscope_entertainment_disclaimer', 'Ulduz falı yalnız əyləncə məqsədi daşıyır. Tibbi, psixoloji və ya valideynlik qərarları üçün ixtisaslı mütəxəssisə (həkim/psixoloq) müraciət edin.')}
          </p>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-2">
          {currentStep > 1 &&
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="a-btn-soft flex-1"
            style={{ justifyContent: 'center', height: 48 }}>
            
              <ArrowLeft className="rtl:rotate-180" size={15} strokeWidth={2.2} />
              {tr("horoscope_back", "Geri")}
            </button>
          }
          
          {currentStep < 3 ?
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="a-cta-btn flex-1"
            style={{ justifyContent: 'center', height: 48, background: 'var(--a-lav-2)', color: '#fff', opacity: currentStep === 1 && !momData.birthDate ? 0.5 : 1 }}
            disabled={currentStep === 1 && !momData.birthDate}>
              {tr("horoscopecompatibility_novbeti_6e8661", "N\xF6vb\u0259ti")}
              
            <ArrowRight className="rtl:rotate-180" size={15} strokeWidth={2.2} />
            </button> :

          <button
            onClick={handleAnalyze}
            disabled={!momData.birthDate || isAnalyzing}
            className="a-cta-btn flex-1"
            style={{ justifyContent: 'center', height: 48, background: 'var(--a-lav-2)', color: '#fff', opacity: !momData.birthDate || isAnalyzing ? 0.6 : 1 }}>
              {isAnalyzing ?
            <Loader2 className="h-5 w-5 animate-spin" /> :

            <Sparkles size={16} strokeWidth={2.2} />
            }
              {tr("horoscope_analyze_now", "Analiz Et")}
            </button>
          }
        </div>

        {/* Zodiac Grid */}
        <div className="a-card">
          <h3 className="a-card-title a-heading mb-3 flex items-center gap-2" style={{ margin: '0 0 12px' }}>
            <Star className="h-4 w-4" style={{ color: 'var(--a-yellow-2)' }} />
            {tr("horoscopecompatibility_burcler_bb45a3", "B\xFCrcl\u0259r")}
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {zodiacSigns.map((sign) => {
              return (
                <div
                  key={sign.id}
                  className="text-center p-2 rounded-xl transition-colors"
                  style={{ background: 'var(--a-surface-soft)' }}>
                  
                  <span className="text-xl block">{sign.symbol}</span>
                  <p className="text-[10px] mt-1" style={{ margin: '4px 0 0', color: 'var(--a-ink-soft)' }}>{sign.name}</p>
                </div>);

            })}
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isAnalyzing &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #2a1d4d 0%, #3c2e5c 50%, #4a2331 100%)' }}>
          
            <div className="absolute inset-0 overflow-hidden">
              {LOADING_STARS.map((star, i) =>
            <div
              key={i}
              className="absolute text-white/20 animate-pulse"
              style={{
                insetInlineStart: `${star.left}%`,
                top: `${star.top}%`,
                fontSize: `${star.size}px`,
                animationDuration: `${star.duration}s`,
                animationDelay: `${star.delay}s`
              }}>

                  ✦
                </div>
            )}
            </div>

            <div className="relative z-10 text-center text-white px-8">
              <div className="w-28 h-28 mx-auto mb-8 relative">
              
                <div className="absolute inset-0 rounded-full border-2 border-white/30" />
                <div className="absolute inset-3 rounded-full border border-white/20" />
                <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: 2 }}>
                
                  {LOADING_STEPS[loadingStep]?.icon &&
                <motion.div
                  key={loadingStep}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className={LOADING_STEPS[loadingStep].color}>
                  
                      {(() => {
                    const Icon = LOADING_STEPS[loadingStep].icon;
                    return <Icon className="h-10 w-10" />;
                  })()}
                    </motion.div>
                }
                </motion.div>
              </div>

              <motion.div
              key={loadingStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2">
              
                <p className="text-xl font-semibold">{LOADING_STEPS[loadingStep]?.text}</p>
                <p className="text-white/60 text-sm">{tr("horoscopecompatibility_addim_9346cd", "Add\u0131m")} {loadingStep + 1} / {LOADING_STEPS.length}</p>
              </motion.div>

              <div className="flex justify-center gap-2 mt-6">
                {LOADING_STEPS.map((_, i) =>
              <motion.div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i <= loadingStep ? "bg-white" : "bg-white/30"
                )}
                animate={i === loadingStep ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5, repeat: 2 }} />

              )}
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="horoscope" />
    </ToolPage>);

};

// Person Input Component
const PersonInput = ({
  label,
  emoji,
  data,
  setData,
  zodiacSigns,
  isRequired = false,
  isOptional = false








}: {label: string;emoji: string;data: PersonData;setData: (data: PersonData) => void;zodiacSigns: ZodiacSign[];isRequired?: boolean;isOptional?: boolean;}) => {
  const getZodiacForDate = (date: Date | undefined) => {
    if (!date || zodiacSigns.length === 0) return null;
    const monthDay = format(date, 'MM-dd');
    return zodiacSigns.find((s) => {
      if (s.start_date > s.end_date) {
        return monthDay >= s.start_date || monthDay <= s.end_date;
      }
      return monthDay >= s.start_date && monthDay <= s.end_date;
    });
  };

  const selectedSign = getZodiacForDate(data.birthDate);

  return (
    <div className="a-card space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-bold flex items-center gap-2 a-heading" style={{ margin: 0, color: 'var(--a-ink)' }}>
          <span className="text-2xl">{emoji}</span>
          {label}
        </p>
        {isOptional &&
        <span className="a-rank-tag" style={{ margin: 0, background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>{tr("horoscopecompatibility_ixtiyari_4d9763", "İxtiyari")}</span>
        }
      </div>

      {/* Date Picker */}
      <div className="space-y-2">
        <p className="a-list-sub flex items-center gap-1" style={{ margin: 0 }}>
          <CalendarIcon className="h-3 w-3" />
          {tr("horoscopecompatibility_dogum_tarixi_d96907", "Do\u011Fum tarixi")} {isRequired && <span style={{ color: 'var(--a-pink-2)' }}>*</span>}
        </p>
        <DatePickerWheel
          value={data.birthDate}
          onChange={(date) => setData({ ...data, birthDate: date })}
          disabled={(date) => date > new Date()}
          placeholder={tr("horoscopecompatibility_dogum_tarixini_secin_825730", "Doğum tarixini seçin")} />
        
      </div>

      {/* Birth Time Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="a-list-sub flex items-center gap-1" style={{ margin: 0 }}>
            <Clock className="h-3 w-3" />
            {tr("horoscopecompatibility_dogum_saati_6ecf09", "Do\u011Fum saat\u0131")}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{tr("horoscopecompatibility_bilirem_fa9716", "Bilirəm")}</span>
            <Switch
              checked={data.hasBirthTime}
              onCheckedChange={(checked) => setData({ ...data, hasBirthTime: checked, birthTime: checked ? '12:00' : '' })} />
            
          </div>
        </div>

        <AnimatePresence>
          {data.hasBirthTime &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}>
            
              <Select
              value={data.birthTime}
              onValueChange={(value) => setData({ ...data, birthTime: value })}>
              
                <SelectTrigger className="w-full h-12 rounded-xl" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)' }}>
                  <SelectValue placeholder={tr("horoscopecompatibility_saat_secin_c24ec4", "Saat seçin")} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIME_OPTIONS.map((time) =>
                <SelectItem key={time} value={time}>{time}</SelectItem>
                )}
                </SelectContent>
              </Select>
              <p className="text-xs mt-2 flex items-center gap-1" style={{ margin: '8px 0 0', color: 'var(--a-ink-soft)' }}>
                <Compass className="h-3 w-3" />
                {tr("horoscopecompatibility_yukselen_burcun_hesablanmasi_u_94af5d", "Y\xFCks\u0259l\u0259n b\xFCrc\xFCn hesablanmas\u0131 \xFC\xE7\xFCn laz\u0131md\u0131r")}
              </p>
            </motion.div>
          }
        </AnimatePresence>
      </div>

      {/* Show detected sign */}
      {selectedSign &&
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-3 rounded-xl"
        style={{ background: 'var(--a-surface-soft)' }}>
        
          <span className="text-3xl">{selectedSign.symbol}</span>
          <div className="flex-1">
            <p className="a-list-title" style={{ margin: 0 }}>{selectedSign.name}</p>
            <p className="a-list-sub flex items-center gap-1" style={{ margin: 0 }}>
              {selectedSign.element && ELEMENT_ICONS[selectedSign.element] &&
            <>
                  {(() => {
                const Icon = ELEMENT_ICONS[selectedSign.element];
                return <Icon className="h-3 w-3" />;
              })()}
                  {ELEMENT_NAMES[selectedSign.element]} elementi
                </>
            }
            </p>
          </div>
          {data.hasBirthTime &&
        <div className="text-end">
              <p className="text-xs" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("horoscopecompatibility_yukselen_b35c71", "Yüksələn")}</p>
              <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-lav-2)' }}>{tr("untranslated_hesablanacaq_w6pf63", "Hesablanacaq ↗")}</p>
            </div>
        }
        </motion.div>
      }
    </div>);

};

// Birth Chart Card Component
const BirthChartCard = ({ chart, label, emoji }: {chart: ChartData;label: string;emoji: string;}) =>
<div className="p-4 rounded-2xl" style={{ background: 'var(--a-surface-soft)' }}>
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xl">{emoji}</span>
      <span className="a-list-title" style={{ margin: 0 }}>{label}</span>
      {chart.isExpected &&
    <span className="a-rank-tag ms-auto" style={{ margin: '0 0 0 auto', background: 'var(--a-lav-1)', color: 'var(--a-lav-ink)' }}>
          {tr("horoscopecompatibility_gozlenilen_4885bf", "G\xF6zl\u0259nil\u0259n")}
        </span>
    }
    </div>
    
    <div className="grid grid-cols-3 gap-2">
      <div className="text-center p-3 rounded-xl" style={{ background: 'var(--a-yellow-1)' }}>
        <Sun className="h-4 w-4 mx-auto mb-1" style={{ color: 'var(--a-warn-ink)' }} />
        <span className="text-2xl block">{chart.sun.symbol}</span>
        <p className="text-xs font-bold mt-1" style={{ margin: '4px 0 0', color: 'var(--a-warn-ink)' }}>{chart.sun.signAz}</p>
        <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.75 }}>{tr("horoscopecompatibility_gunes_b7b2ab", "Günəş")}</p>
      </div>

      <div className="text-center p-3 rounded-xl" style={{ background: 'var(--a-blue-1)' }}>
        <Moon className="h-4 w-4 mx-auto mb-1" style={{ color: 'var(--a-blue-ink)' }} />
        <span className="text-2xl block">{chart.moon.symbol}</span>
        <p className="text-xs font-bold mt-1" style={{ margin: '4px 0 0', color: 'var(--a-blue-ink)' }}>{chart.moon.signAz}</p>
        <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-blue-ink)', opacity: 0.75 }}>{tr("untranslated_ay_m6wwbp", "Ay")}</p>
      </div>

      <div
      className="text-center p-3 rounded-xl"
      style={chart.rising ?
      { background: 'var(--a-lav-1)' } :
      { background: 'var(--a-surface)', border: '1px dashed var(--a-line-strong)' }}>
        <Compass className="h-4 w-4 mx-auto mb-1" style={{ color: chart.rising ? 'var(--a-lav-ink)' : 'var(--a-ink-faint)' }} />
        {chart.rising ?
      <>
            <span className="text-2xl block">{chart.rising.symbol}</span>
            <p className="text-xs font-bold mt-1" style={{ margin: '4px 0 0', color: 'var(--a-lav-ink)' }}>{chart.rising.signAz}</p>
          </> :

      <>
            <span className="text-lg block" style={{ color: 'var(--a-ink-faint)' }}>?</span>
            <p className="text-xs mt-1" style={{ margin: '4px 0 0', color: 'var(--a-ink-soft)' }}>{tr("untranslated_bilinmir_iqd3o8", "Bilinmir")}</p>
          </>
      }
        <p className="text-[10px]" style={{ margin: 0, color: chart.rising ? 'var(--a-lav-ink)' : 'var(--a-ink-soft)', opacity: 0.75 }}>{tr("horoscopecompatibility_yukselen_b35c71", "Yüksələn")}</p>
      </div>
    </div>
  </div>;


// Analysis Card Component
const AnalysisCard = ({
  title,
  emoji,
  icon,
  content,
  bg,
  ink







}: {title: string;emoji?: string;icon?: React.ReactNode;content: string;bg: string;ink: string;}) =>
<div className="a-card" style={{ background: bg, border: 'none' }}>
    <h3 className="font-bold flex items-center gap-2 mb-2 a-heading" style={{ margin: '0 0 8px', color: ink }}>
      {emoji && <span className="text-xl">{emoji}</span>}
      {icon}
      {title}
    </h3>
    <p className="text-sm leading-relaxed" style={{ margin: 0, color: ink, opacity: 0.85 }}>{content}</p>
  </div>;


export default HoroscopeCompatibility;
