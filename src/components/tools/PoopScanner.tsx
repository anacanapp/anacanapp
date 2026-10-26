import { useState, useRef, useEffect } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, AlertTriangle, CheckCircle, AlertCircle, Loader2, History, Info, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
import { takePhoto, pickFromGallery, readImageFileAsDataUrl } from '@/lib/permissions';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { tr, getPersistedLanguage } from "@/lib/tr";
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { ToolPage, ToolHeader } from './anacan/ToolKit';

interface PoopScannerProps {
  onBack: () => void;
}

interface PoopAnalysis {
  colorDetected: string;
  consistency: string;
  isNormal: boolean;
  concernLevel: 'normal' | 'attention' | 'warning' | 'urgent';
  explanation: string;
  recommendations: string[];
  shouldSeeDoctor: boolean;
  doctorUrgency: 'none' | 'soon' | 'today' | 'immediate';
}

const colorLabels: Record<string, {label: string;emoji: string;}> = {
  brown: { label: tr("poopscanner_qehveyi_b14379", 'Qəhvəyi'), emoji: '🟤' },
  yellow: { label: tr("poopscanner_sari_30ba0d", 'Sarı'), emoji: '🟡' },
  green: { label: tr("poopscanner_yasil_b257f4", 'Yaşıl'), emoji: '🟢' },
  black: { label: tr("poopscanner_qara_3c7a2d", "Qara"), emoji: '⚫' },
  red: { label: tr("poopscanner_qirmizi_ea111d", 'Qırmızı'), emoji: '🔴' },
  white: { label: tr("poopscanner_ag_solgun_984851", 'Ağ/Solğun'), emoji: '⚪' },
  unknown: { label: tr("poopscanner_namelum_134662", 'Naməlum'), emoji: '❓' }
};

// Concern level → anacan palette
const concernStyles: Record<string, {grad: string;soft: string;solid: string;ink: string;onSolid: string;}> = {
  urgent: { grad: 'var(--a-grad-pink)', soft: 'var(--a-pink-1)', solid: 'var(--a-pink-2)', ink: 'var(--a-alert-ink)', onSolid: '#fff' },
  warning: { grad: 'var(--a-grad-peach)', soft: 'var(--a-peach-1)', solid: 'var(--a-peach-2)', ink: 'var(--a-accent-ink)', onSolid: '#fff' },
  attention: { grad: 'var(--a-grad-yellow)', soft: 'var(--a-yellow-1)', solid: 'var(--a-yellow-2)', ink: 'var(--a-warn-ink)', onSolid: '#5a3d00' },
  normal: { grad: 'var(--a-grad-green)', soft: 'var(--a-green-1)', solid: 'var(--a-green-2)', ink: 'var(--a-green-ink)', onSolid: '#fff' }
};

const PoopScanner = ({ onBack }: PoopScannerProps) => {
  useScreenAnalytics('PoopScanner', 'Tools');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PoopAnalysis | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { checkAndConsume } = useSubscription();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    if (!profile?.user_id) return;
    const { data } = await supabase.
    from('poop_analyses').
    select('*').
    eq('user_id', profile.user_id).
    order('created_at', { ascending: false }).
    limit(10);
    if (data) setHistory(data);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: tr("poopscanner_fayl_cox_boyukdur_f5cf61", 'Fayl çox böyükdür'),
        description: tr("poopscanner_maksimum_10mb_sekil_secin_caf529", 'Maksimum 10MB şəkil seçin'),
        variant: 'destructive'
      });
      return;
    }

    // Yaddaş: ~1280px-ə kiçildilmiş JPEG data URL (çox-MB base64 state-də qalmasın)
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setSelectedImage(dataUrl);
      setAnalysis(null);
    } catch { /* oxuna bilmədi — əvvəlki kimi səssiz */ }
  };

  const handleCameraCapture = async () => {
    try {
      const image = await takePhoto();
      if (image) {
        setSelectedImage(image);
        setAnalysis(null);
      } else {
        // Fallback to file input for web or if native returned null
        cameraInputRef.current?.click();
      }
    } catch (error: any) {
      console.error('Camera capture error:', error);
      const errorMsg = error.message?.toLowerCase() || '';

      if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        toast({
          title: tr("poopscanner_kamera_icazesi_lazimdir_a300cc", 'Kamera icazəsi lazımdır'),
          description: tr("poopscanner_tetbiq_parametrlerinden_kamera_icazesini_7a6f09", 'Tətbiq parametrlərindən kamera icazəsini aktivləşdirin'),
          variant: 'destructive'
        });
      } else if (!errorMsg.includes('cancel')) {
        // Fallback to web file input on any other error
        cameraInputRef.current?.click();
      }
    }
  };

  const handleGalleryPick = async () => {
    try {
      const image = await pickFromGallery();
      if (image) {
        setSelectedImage(image);
        setAnalysis(null);
      } else {
        // Fallback to file input for web or if native returned null
        fileInputRef.current?.click();
      }
    } catch (error: any) {
      console.error('Gallery pick error:', error);
      const errorMsg = error.message?.toLowerCase() || '';

      if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        toast({
          title: tr("poopscanner_sekil_icazesi_lazimdir_ce5b8c", 'Şəkil icazəsi lazımdır'),
          description: tr("poopscanner_tetbiq_parametrlerinden_foto_kitabxanasi_f9ffae", 'Tətbiq parametrlərindən foto kitabxanası icazəsini aktivləşdirin'),
          variant: 'destructive'
        });
      } else if (!errorMsg.includes('cancel')) {
        // Fallback to web file input on any other error
        fileInputRef.current?.click();
      }
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    // Gündəlik pulsuz limit (premium → limitsiz)
    const { allowed } = await checkAndConsume('poop_scanner');
    if (!allowed) {
      setShowPremiumModal(true);
      return;
    }

    setIsAnalyzing(true);

    try {
      const base64Image = selectedImage.split(',')[1];

      // Calculate baby age in months and days
      let babyContext = {};
      if (profile?.baby_birth_date) {
        const birthDate = new Date(profile.baby_birth_date);
        const today = new Date();
        const { getRealCalendarAge } = await import('@/lib/pregnancy-utils');
        const age = getRealCalendarAge(profile.baby_birth_date);
        babyContext = {
          babyName: profile.baby_name || tr("poopscanner_korpe_fa2b51", "K\xF6rp\u0259"),
          babyAgeMonths: age.months,
          babyAgeDays: age.totalDays,
          babyGender: profile.baby_gender
        };
      }

      const { data, error } = await supabase.functions.invoke('analyze-poop', {
        body: {
          imageBase64: base64Image,
          userContext: babyContext,
          language: getPersistedLanguage()
        }
      });

      if (error) throw error;

      if (data.success) {
        // Check if image was valid for analysis
        if (data.isValidImage === false) {
          toast({
            title: tr("poopscanner_sekil_uygun_deyil_ec1a66", 'Şəkil uyğun deyil'),
            description: data.validation?.message || tr("poopscanner_bu_sekil_korpe_bezi_deyil_duzg_674a4f", "Bu \u015F\u0259kil k\xF6rp\u0259 bezi deyil. D\xFCzg\xFCn \u015F\u0259kil se\xE7in."),
            variant: 'destructive'
          });
          setSelectedImage(null);
          return;
        }

        if (data.analysis) {
          setAnalysis(data.analysis);
          loadHistory();
        }
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      toast({
        title: tr("poopscanner_analiz_xetasi_daba4a", 'Analiz xətası'),
        description: tr("poopscanner_yeniden_cehd_edin_0040c9", 'Yenidən cəhd edin'),
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConcernStyle = (level: string) => concernStyles[level] || concernStyles.normal;

  const getConcernLabel = (level: string) => {
    switch (level) {
      case 'urgent':return tr("poopscanner_tecili_ab784b", "T\u0259cili");
      case 'warning':return tr("poopscanner_diqqet_764567", "Diqq\u0259t");
      case 'attention':return tr("poopscanner_i_zleyin_54759b", "\u0130zl\u0259yin");
      default:return tr("common_normal", "Normal");
    }
  };

  const colorInfo = analysis ? colorLabels[analysis.colorDetected] || colorLabels.unknown : null;

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("poopscanner_ai_ile_korpe_necisini_analiz_edin_06fb84", "AI ilə körpə nəcisini analiz edin")}
        title={tr("poopscanner_necis_skaneri_dadd90", "Nəcis Skaneri")}
        actions={
        <button className="a-icon-btn" onClick={() => setShowHistory(!showHistory)} aria-label="History">
            <History size={16} strokeWidth={2} />
          </button>
        } />

      <div className="space-y-3">
        <MedicalDisclaimer variant="anacan" />

        {/* Info Card */}
        <div className="a-card" style={{ padding: '12px 14px' }}>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--a-peach-2)' }} />
            <p className="a-cta-text" style={{ margin: 0 }}>
              {tr("poopscanner_korpenizin_bezinin_seklini_cek_498c04", "K\xF6rp\u0259nizin bezinin \u015F\u0259klini \xE7\u0259kin v\u0259 ya y\xFCkl\u0259yin. AI r\u0259ng v\u0259 konsistensiyaya \u0259sas\u0259n analiz ed\u0259c\u0259k.")}
            </p>
          </div>
        </div>

        {/* Image Selection */}
        <div className="a-card">
          {!selectedImage ?
          <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                whileTap={{ scale: 0.96 }}
                className="h-28 rounded-2xl flex flex-col items-center justify-center gap-2"
                style={{ background: 'var(--a-surface-soft)', border: '1px dashed var(--a-line-strong)', cursor: 'pointer' }}
                onClick={handleCameraCapture}>
                
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)' }}>
                    <Camera size={18} strokeWidth={2.2} style={{ color: 'var(--a-accent-ink)' }} />
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--a-ink)' }}>{tr("untranslated_kamera_qucuxi", "Kamera")}</span>
                </motion.button>
                <motion.button
                whileTap={{ scale: 0.96 }}
                className="h-28 rounded-2xl flex flex-col items-center justify-center gap-2"
                style={{ background: 'var(--a-surface-soft)', border: '1px dashed var(--a-line-strong)', cursor: 'pointer' }}
                onClick={handleGalleryPick}>
                
                  <span className="a-list-icon" style={{ background: 'var(--a-grad-blue)' }}>
                    <Upload size={18} strokeWidth={2.2} style={{ color: 'var(--a-blue-ink)' }} />
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--a-ink)' }}>{tr("untranslated_qalereyadan_w37f0m", "Qalereyadan")}</span>
                </motion.button>
              </div>
              
              {/* Hidden file inputs as fallback for web */}
              <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelect} />
            
              <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect} />
            
            </div> :

          <div className="space-y-4">
              <div className="relative aspect-square rounded-2xl overflow-hidden" style={{ background: 'var(--a-surface-soft)' }}>
                <img
                src={selectedImage}
                alt="Selected"
                className="w-full h-full object-cover" />
              
                {isAnalyzing &&
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                    <p className="text-sm font-semibold">{tr("untranslated_analiz_edilir_hf0m1t", "Analiz edilir...")}</p>
                  </div>
                </div>
                }
              </div>
              
              <div className="flex gap-2">
                <button
                className="a-btn-soft flex-1"
                style={{ justifyContent: 'center', height: 44 }}
                onClick={() => {
                  setSelectedImage(null);
                  setAnalysis(null);
                }}>
                  {tr("poopscanner_yeniden_sec_c56bbc", "Yenid\u0259n se\xE7")}
                
              </button>
                <button
                className="a-cta-btn flex-1"
                style={{ justifyContent: 'center', height: 44, opacity: isAnalyzing ? 0.7 : 1 }}
                onClick={analyzeImage}
                disabled={isAnalyzing}>
                
                  {isAnalyzing ?
                <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {tr("common_analiz_loading", 'Analiz...')}
                    </> :

                tr("poopscanner_analiz_et", 'Analiz et')
                }
                </button>
              </div>
            </div>
          }
        </div>

        {/* Analysis Result */}
        <AnimatePresence>
          {analysis && colorInfo &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}>
            
              <div className="a-card overflow-hidden" style={{ padding: 0 }}>
                <div style={{ height: 8, background: getConcernStyle(analysis.concernLevel).grad }} />
                <div className="p-4 space-y-4">
                  {/* Main Result */}
                  <div className="p-4 rounded-2xl" style={{ background: getConcernStyle(analysis.concernLevel).soft }}>
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{colorInfo.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="a-heading" style={{ margin: 0, fontSize: 19, color: getConcernStyle(analysis.concernLevel).ink }}>{colorInfo.label}</h3>
                          <span
                          className="a-rank-tag"
                          style={{
                            margin: 0,
                            background: analysis.isNormal ? 'var(--a-green-1)' : 'var(--a-pink-1)',
                            color: analysis.isNormal ? 'var(--a-green-ink)' : 'var(--a-pink-ink)'
                          }}>
                            {analysis.isNormal ? tr("common_normal", "Normal") : tr("poopscanner_diqqet_764567", "Diqqət")}
                          </span>
                        </div>
                        <p className="text-sm mt-1" style={{ margin: 0, color: getConcernStyle(analysis.concernLevel).ink, opacity: 0.8 }}>
                          Konsistensiya: {analysis.consistency}
                        </p>
                      </div>
                      <div
                      className="px-3 py-1 rounded-full text-sm font-bold shrink-0"
                      style={{ background: getConcernStyle(analysis.concernLevel).solid, color: getConcernStyle(analysis.concernLevel).onSolid }}>
                        {getConcernLabel(analysis.concernLevel)}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="p-3 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                    <p className="a-cta-text" style={{ margin: 0 }}>{analysis.explanation}</p>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--a-ink)' }}>
                      <CheckCircle className="w-4 h-4" style={{ color: 'var(--a-green-2)' }} />
                      {tr("poopscanner_tovsiyeler_17a8f7", "T\xF6vsiy\u0259l\u0259r")}
                    </h4>
                    {analysis.recommendations.map((rec, idx) =>
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                        <span
                      className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                          {idx + 1}
                        </span>
                        <p className="a-cta-text" style={{ margin: 0 }}>{rec}</p>
                      </div>
                  )}
                  </div>

                  {/* Doctor Warning */}
                  {analysis.shouldSeeDoctor &&
                <div
                  className="p-4 rounded-2xl"
                  style={{ background: analysis.doctorUrgency === 'immediate' ? 'var(--a-alert-bg)' : 'var(--a-peach-1)' }}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                      className="w-6 h-6 shrink-0"
                      style={{ color: analysis.doctorUrgency === 'immediate' ? 'var(--a-alert-ink)' : 'var(--a-accent-ink)' }} />
                        <div>
                          <h4
                        className="font-bold"
                        style={{ margin: 0, color: analysis.doctorUrgency === 'immediate' ? 'var(--a-alert-ink)' : 'var(--a-accent-ink)' }}>
                            {analysis.doctorUrgency === 'immediate' ? tr("poopscanner_teci_li_heki_me_muraci_et_edi__dc0cac", "T\u018FC\u0130L\u0130 H\u018FK\u0130M\u018F M\xDCRAC\u0130\u018FT ED\u0130N!") : tr("poopscanner_hekime_muraciet_edin_9504e2", "H\u0259kim\u0259 m\xFCraci\u0259t edin")

                        }
                          </h4>
                          <p className="text-sm mt-1" style={{ margin: 0, color: analysis.doctorUrgency === 'immediate' ? 'var(--a-alert-soft)' : 'var(--a-accent-ink)', opacity: 0.85 }}>
                            {analysis.doctorUrgency === 'immediate' ? tr("poopscanner_bu_simptomlar_ciddi_ola_biler__4229fb", "Bu simptomlar ciddi ola bil\u0259r. D\u0259rhal tibbi yard\u0131m al\u0131n.") :

                        analysis.doctorUrgency === 'today' ? tr("poopscanner_bu_gun_hekimle_meslehetlesin_284d77", "Bu g\xFCn h\u0259kiml\u0259 m\u0259sl\u0259h\u0259tl\u0259\u015Fin.") : tr("poopscanner_yaxin_vaxtda_hekime_muraciet_e_cb6380", "Yax\u0131n vaxtda h\u0259kim\u0259 m\xFCraci\u0259t edin.")

                        }
                          </p>
                        </div>
                      </div>
                      
                      {analysis.doctorUrgency === 'immediate' &&
                  <button
                    className="a-cta-btn w-full mt-3"
                    style={{ justifyContent: 'center', height: 44, background: 'var(--a-pink-2)' }}
                    onClick={() => window.open('tel:103', '_blank')}>
                    
                          <Phone size={15} strokeWidth={2.2} />
                          {tr("poopscanner_tecili_yardim_103_176a98", "T\u0259cili yard\u0131m - 103")}
                        </button>
                  }
                    </div>
                }

                  {/* Disclaimer */}
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--a-ink-soft)' }} />
                    <p className="text-xs" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>
                      {tr("poopscanner_bu_analiz_yalniz_melumat_meqse_ea8e7e", "Bu analiz yaln\u0131z m\u0259lumat m\u0259qs\u0259di da\u015F\u0131y\u0131r v\u0259 tibbi diaqnoz deyil. \n                      Narahatl\u0131q yaranarsa h\u0259kim\u0259 m\xFCraci\u0259t edin.")}
                    
                  </p>
                  </div>
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* History */}
        {showHistory && history.length > 0 &&
        <div className="a-card">
            <h3 className="a-card-title a-heading mb-3 flex items-center gap-2">
              <History className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
              {tr("poopscanner_son_analizler_76b144", "Son analizl\u0259r")}
            </h3>
            <div className="space-y-2">
              {history.map((item) => {
              const info = colorLabels[item.color_detected] || colorLabels.unknown;
              return (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                    <span className="text-xl">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="a-list-title" style={{ margin: 0 }}>{info.label}</p>
                      <p className="a-list-sub" style={{ margin: 0 }}>
                        {new Date(item.created_at).toLocaleDateString(getLocaleTag())}
                      </p>
                    </div>
                    <span
                    className="a-rank-tag"
                    style={{
                      margin: 0,
                      background: item.is_normal ? 'var(--a-green-1)' : 'var(--a-pink-1)',
                      color: item.is_normal ? 'var(--a-green-ink)' : 'var(--a-pink-ink)'
                    }}>
                      {item.is_normal ? tr("common_normal", "Normal") : tr("poopscanner_diqqet_764567", "Diqqət")}
                    </span>
                  </div>);

            })}
            </div>
          </div>
        }
      </div>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="poop_scanner" />
    </ToolPage>);

};

export default PoopScanner;
