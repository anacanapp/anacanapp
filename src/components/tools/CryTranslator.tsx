import { useState, useRef, useEffect, useCallback, CSSProperties } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, AlertCircle, CheckCircle, Clock, Loader2, History, Info, AlertTriangle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
import { createAudioRecorder, getAudioErrorToast, openMicrophone, releaseAudioRecording } from '@/lib/audioRecording';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { tr, getPersistedLanguage } from "@/lib/tr";
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { ToolPage, ToolHeader } from './anacan/ToolKit';

interface CryTranslatorProps {
  onBack: () => void;
}

interface CryAnalysis {
  cryType: string;
  confidence: number;
  explanation: string;
  recommendations: string[];
  urgency: 'low' | 'medium' | 'high';
  isCryDetected?: boolean;
}

type AnalysisStage = 'idle' | 'recording' | 'processing' | 'analyzing' | 'complete' | 'no_cry' | 'false_positive' | 'error';

// Cry type → anacan palette (gradient + ink)
const cryTypeLabels: Record<string, {label: string;emoji: string;grad: string;ink: string;}> = {
  hungry: { label: tr("crytranslator_ac_baba8d", 'Ac'), emoji: '🍼', grad: 'var(--a-grad-peach)', ink: 'var(--a-accent-ink)' },
  tired: { label: tr("crytranslator_yuxulu_90ba1f", 'Yuxulu'), emoji: '😴', grad: 'var(--a-grad-lav)', ink: 'var(--a-lav-ink)' },
  pain: { label: tr("crytranslator_agri_76d612", 'Ağrı'), emoji: '😢', grad: 'var(--a-grad-pink)', ink: 'var(--a-alert-ink)' },
  discomfort: { label: tr("crytranslator_narahatliq_33f05c", 'Narahatlıq'), emoji: '😣', grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' },
  colic: { label: tr("crytranslator_kolik_29d81f", 'Kolik'), emoji: '😫', grad: 'var(--a-grad-lav)', ink: 'var(--a-lav-ink)' },
  attention: { label: tr("crytranslator_diqqet_isteyir_d50473", 'Diqqət istəyir'), emoji: '🤗', grad: 'var(--a-grad-blue)', ink: 'var(--a-blue-ink)' },
  overstimulated: { label: tr("crytranslator_hedden_artiq_yorulub_7849bb", 'Həddən artıq yorulub'), emoji: '🥱', grad: 'linear-gradient(135deg, var(--a-surface-soft), var(--a-line-strong))', ink: 'var(--a-ink-soft)' },
  sick: { label: tr("crytranslator_xestelik_7c06be", 'Xəstəlik'), emoji: '🤒', grad: 'var(--a-grad-pink)', ink: 'var(--a-alert-ink)' },
  no_cry_detected: { label: tr("crytranslator_aglama_askarlanmadi_15a23e", 'Ağlama aşkarlanmadı'), emoji: '🔇', grad: 'linear-gradient(135deg, var(--a-surface-soft), var(--a-line-strong))', ink: 'var(--a-ink-soft)' },
  false_positive: { label: tr("crytranslator_saxta_ses_3db067", 'Saxta səs'), emoji: '📺', grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' }
};

const stageMessages: Record<AnalysisStage, string> = {
  idle: tr("crytranslator_yazmaga_baslayin_55a5eb", "Yazma\u011Fa ba\u015Flay\u0131n"),
  recording: tr("crytranslator_ses_yazilir_c555e8", "S\u0259s yaz\u0131l\u0131r..."),
  processing: tr("crytranslator_ses_emal_edilir_918818", "S\u0259s emal edilir..."),
  analyzing: tr("crytranslator_ai_analiz_edir_daba4c", "AI analiz edir..."),
  complete: tr("crytranslator_analiz_tamamlandi_7dd77f", "Analiz tamamland\u0131"),
  no_cry: tr("crytranslator_aglama_askarlanmadi_15a23e", "A\u011Flama a\u015Fkarlanmad\u0131"),
  false_positive: tr("crytranslator_saxta_ses_askarlandi_d6f6bf", "Saxta s\u0259s a\u015Fkarland\u0131"),
  error: tr("crytranslator_xeta_bas_verdi_f22fba", "Xəta baş verdi")
};

const CryTranslator = ({ onBack }: CryTranslatorProps) => {
  useScreenAnalytics('CryTranslator', 'Tools');
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysis, setAnalysis] = useState<CryAnalysis | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Tables<'cry_analyses'>[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const recordingTimeRef = useRef(0);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { toast } = useToast();
  const { checkAndConsume } = useSubscription();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { profile } = useAuth();

  const isRecording = stage === 'recording';
  const isProcessing = stage === 'processing' || stage === 'analyzing';

  const loadHistory = useCallback(async () => {
    if (!profile?.user_id) return;
    const { data } = await supabase.
    from('cry_analyses').
    select('*').
    eq('user_id', profile.user_id).
    order('created_at', { ascending: false }).
    limit(10);
    if (data && mountedRef.current) setHistory(data);
  }, [profile?.user_id]);

  useEffect(() => {
    mountedRef.current = true;
    const background = () => {
      if (document.visibilityState === 'hidden' && (mediaRecorderRef.current?.state === 'recording' || streamRef.current)) {
        recordingControllerRef.current?.abort(); recordingControllerRef.current = null; cleanup();
        setStage(previous => previous === 'recording' ? 'idle' : previous);
      }
    };
    document.addEventListener('visibilitychange', background);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', background);
      recordingControllerRef.current?.abort();
      recordingControllerRef.current = null;
      cleanup();
    };
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const cleanup = () => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    timerRef.current = null;
    animationRef.current = null;
    analyserRef.current = null;
    releaseAudioRecording(mediaRecorderRef.current, streamRef.current);
    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioChunksRef.current = [];
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const cancelRecording = () => {
    recordingControllerRef.current?.abort();
    recordingControllerRef.current = null;
    cleanup();
  };

  const startRecording = async () => {
    if (recordingControllerRef.current || !mountedRef.current) return;
    const controller = new AbortController();
    recordingControllerRef.current = controller;
    let stream: MediaStream | null = null;
    try {
      if (typeof AudioContext === 'undefined') {
        throw new DOMException('Audio analysis is unavailable', 'NotSupportedError');
      }
      stream = await openMicrophone();
      if (controller.signal.aborted) {
        releaseAudioRecording(null, stream);
        return;
      }
      streamRef.current = stream;

      // Set up audio analyzer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animate audio level
      const updateLevel = () => {
        if (controller.signal.aborted || !analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // The deployed analyze-cry endpoint accepts WebM only.
      const mediaRecorder = createAudioRecorder(stream, ['audio/webm']);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (!controller.signal.aborted && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onerror = (error) => {
        if (controller.signal.aborted) return;
        cancelRecording();
        setStage('error');
        toast(getAudioErrorToast(error, 'audio'));
      };

      mediaRecorder.start(100);
      setStage('recording');
      recordingTimeRef.current = 0;
      setRecordingTime(0);
      setAnalysis(null);

      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
        if (recordingTimeRef.current >= 10) stopRecording();
      }, 1000);

    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Recording error:', error);
      cancelRecording();
      setStage('error');
      toast(getAudioErrorToast(error, stream ? 'audio' : 'microphone'));
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    const controller = recordingControllerRef.current;
    if (!recorder || recorder.state !== 'recording' || !controller) return;

    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;

    const duration = recordingTimeRef.current;
    if (duration < 3) {
      toast({
        title: tr("crytranslator_cox_qisa_12bf93", 'Çox qısa'),
        description: tr("crytranslator_minimum_3_saniye_ses_yazin_1b5970", 'Minimum 3 saniyə səs yazın'),
        variant: 'destructive'
      });
      cancelRecording();
      setStage('idle');
      return;
    }

    setStage('processing');

    recorder.onstop = () => {
      if (controller.signal.aborted) return;
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || audioChunksRef.current[0]?.type });
      cleanup();
      void analyzeAudio(audioBlob, duration, controller.signal);
    };

    try {
      recorder.stop();
    } catch (error) {
      cancelRecording();
      setStage('error');
      toast(getAudioErrorToast(error, 'audio'));
    }
  };

  const analyzeAudio = async (audioBlob: Blob, duration: number, signal: AbortSignal) => {
    try {
      if (signal.aborted) return;
      if (!audioBlob.size || !audioBlob.type) throw new Error('No recorded audio or MIME type');
      // Gündəlik pulsuz limit (premium → limitsiz)
      const { allowed } = await checkAndConsume('cry_translator');
      if (signal.aborted) return;
      if (!allowed) {
        setStage('idle');
        setShowPremiumModal(true);
        return;
      }
      setStage('analyzing');

      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(reader.error || new Error('Audio read failed'));
        reader.readAsDataURL(audioBlob);
      });
      if (signal.aborted) return;

      // Calculate baby age in months and days
      let babyContext = {};
      if (profile?.baby_birth_date) {
        const { getRealCalendarAge } = await import('@/lib/pregnancy-utils');
        const age = getRealCalendarAge(profile.baby_birth_date);
        babyContext = {
          babyName: profile.baby_name || tr("crytranslator_korpe_fa2b51", "K\xF6rp\u0259"),
          babyAgeMonths: age.months,
          babyAgeDays: age.totalDays,
          babyGender: profile.baby_gender
        };
      }
      if (signal.aborted) return;

      const { data, error } = await supabase.functions.invoke('analyze-cry', {
        body: {
          audioBase64: base64Audio,
          audioDuration: duration,
          userContext: babyContext,
          language: getPersistedLanguage()
        },
        signal
      });
      if (signal.aborted) return;
      if (error) throw error;

      if (data.success && data.analysis) {
        const result = data.analysis as CryAnalysis;
        setAnalysis(result);

        // Determine final stage based on result
        if (result.cryType === 'no_cry_detected') {
          setStage('no_cry');
        } else if (result.cryType === 'false_positive') {
          setStage('false_positive');
        } else {
          setStage('complete');
        }

        loadHistory();
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error('Analysis error:', error);
      setStage('error');
      toast({
        title: tr("crytranslator_analiz_xetasi_daba4a", 'Analiz xətası'),
        description: tr("crytranslator_yeniden_cehd_edin_0040c9", 'Yenidən cəhd edin'),
        variant: 'destructive'
      });
    } finally {
      if (recordingControllerRef.current?.signal === signal) recordingControllerRef.current = null;
    }
  };

  const resetAnalysis = () => {
    cancelRecording();
    setStage('idle');
    setAnalysis(null);
    setRecordingTime(0);
    setAudioLevel(0);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':return 'var(--a-pink-2)';
      case 'medium':return 'var(--a-yellow-2)';
      default:return 'var(--a-green-2)';
    }
  };

  const cryInfo = analysis ? cryTypeLabels[analysis.cryType] || cryTypeLabels.attention : null;

  const renderButtonContent = () => {
    switch (stage) {
      case 'processing':
      case 'analyzing':
        return <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#fff' }} />;
      case 'recording':
        return <Square className="w-10 h-10" style={{ color: '#fff' }} />;
      default:
        return <Mic className="w-12 h-12" style={{ color: 'var(--a-accent-ink)' }} />;
    }
  };

  const getButtonStyle = (): CSSProperties => {
    if (stage === 'recording') {
      return { background: 'var(--a-pink-2)', boxShadow: '0 14px 30px -12px rgba(255, 138, 164, 0.7)' };
    }
    if (isProcessing) {
      return { background: 'var(--a-peach-2)', opacity: 0.75, cursor: 'not-allowed', boxShadow: 'none' };
    }
    return { background: 'var(--a-grad-cta)', border: '1px solid var(--a-btn-border)', boxShadow: 'var(--a-card-shadow)' };
  };

  return (
    <ToolPage>
      <ToolHeader
        onBack={() => { cancelRecording(); onBack(); }}
        eyebrow={tr("crytranslator_ai_ile_korpe_aglamasini_analiz_edin_e2e23c", "AI ilə körpə ağlamasını analiz edin")}
        title={tr("adminanalytics_aglama_analizi_0713b3", "Ağlama Analizi")}
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
              {tr("crytranslator_korpeniz_aglayanda_3_10_saniye_1b26e1", "K\xF6rp\u0259niz a\u011Flayanda 3-10 saniy\u0259 s\u0259s yaz\u0131n. AI a\u011Flaman\u0131n s\u0259b\u0259bini analiz ed\u0259c\u0259k.")}
            </p>
          </div>
        </div>

        {/* Recording Section */}
        <div className="a-card" style={{ padding: 24 }}>
          <div className="flex flex-col items-center">
            {/* Recording Button */}
            <motion.button
              onClick={isRecording ? stopRecording : isProcessing ? undefined : startRecording}
              disabled={isProcessing}
              className="relative w-32 h-32 rounded-full flex items-center justify-center transition-all"
              style={getButtonStyle()}
              whileTap={isProcessing ? {} : { scale: 0.95 }}
              animate={isRecording ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: isRecording ? Infinity : 0, duration: 1 }}>
              
              {/* Audio level ring */}
              {isRecording &&
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '4px solid rgba(255,255,255,0.35)' }}
                animate={{ scale: 1 + audioLevel * 0.3, opacity: 0.5 + audioLevel * 0.5 }} />

              }
              
              {renderButtonContent()}
            </motion.button>

            {/* Timer */}
            <div className="mt-4 flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: 'var(--a-ink-soft)' }} />
              <span className="text-2xl font-mono font-bold" style={{ color: 'var(--a-ink)' }}>
                {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                {String(recordingTime % 60).padStart(2, '0')}
              </span>
              <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>/10s</span>
            </div>

            {/* Status Message */}
            <div className="mt-2 flex items-center gap-2">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--a-peach-2)' }} />}
              <p className="text-sm font-semibold" style={{ color: 'var(--a-ink-soft)' }}>
                {stageMessages[stage]}
              </p>
            </div>

            {/* Progress bar for recording */}
            {isRecording &&
            <div className="w-full mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'var(--a-line-strong)' }}>
                <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--a-pink-2)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${recordingTime / 10 * 100}%` }}
                transition={{ duration: 0.5 }} />
              
              </div>
            }

            {/* Processing stages indicator */}
            {isProcessing &&
            <div className="w-full mt-4 flex justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${stage === 'processing' ? 'animate-pulse' : ''}`} style={{ background: 'var(--a-peach-2)' }} />
                <div className={`w-3 h-3 rounded-full ${stage === 'analyzing' ? 'animate-pulse' : ''}`} style={{ background: stage === 'analyzing' ? 'var(--a-peach-2)' : 'var(--a-line-strong)' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--a-line-strong)' }} />
              </div>
            }
          </div>
        </div>

        {/* No Cry Detected Card */}
        <AnimatePresence>
          {stage === 'no_cry' && analysis &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}>
            
              <div className="a-card overflow-hidden" style={{ padding: 0 }}>
                <div style={{ height: 8, background: cryTypeLabels.no_cry_detected.grad }} />
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: cryTypeLabels.no_cry_detected.grad }}>
                      🔇
                    </div>
                    <div className="flex-1">
                      <h3 className="a-heading" style={{ margin: 0, fontSize: 19 }}>{tr("crytranslator_aglama_askarlanmadi_15a23e", "Ağlama aşkarlanmadı")}</h3>
                      <p className="a-list-sub mt-1" style={{ margin: 0, whiteSpace: 'normal' }}>
                        {tr("crytranslator_ortamda_korpe_aglamasi_esidilm_6b36d5", "Ortamda k\xF6rp\u0259 a\u011Flamas\u0131 e\u015Fidilm\u0259di")}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                    <p className="a-cta-text" style={{ margin: 0 }}>{analysis.explanation}</p>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'var(--a-yellow-1)' }}>
                    <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--a-warn-ink)' }} />
                    <p className="text-sm" style={{ margin: 0, color: 'var(--a-warn-ink)' }}>
                      {tr("crytranslator_korpeniz_agladigi_zaman_yenide_e6c4db", "K\xF6rp\u0259niz a\u011Flad\u0131\u011F\u0131 zaman yenid\u0259n c\u0259hd edin. M\xFCmk\xFCn q\u0259d\u0259r yax\u0131ndan v\u0259 ayd\u0131n s\u0259s yaz\u0131n.")}
                    </p>
                  </div>

                  <button onClick={resetAnalysis} className="a-cta-btn w-full" style={{ justifyContent: 'center', height: 44 }}>
                    <Mic size={15} strokeWidth={2.2} />
                    {tr("crytranslator_yeniden_cehd_et_d273ac", "Yenid\u0259n c\u0259hd et")}
                  </button>
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* False Positive Card */}
        <AnimatePresence>
          {stage === 'false_positive' && analysis &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}>
            
              <div className="a-card overflow-hidden" style={{ padding: 0 }}>
                <div style={{ height: 8, background: cryTypeLabels.false_positive.grad }} />
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: cryTypeLabels.false_positive.grad }}>
                      📺
                    </div>
                    <div className="flex-1">
                      <h3 className="a-heading" style={{ margin: 0, fontSize: 19 }}>{tr("crytranslator_saxta_ses_askarlandi_d6f6bf", "Saxta səs aşkarlandı")}</h3>
                      <p className="a-list-sub mt-1" style={{ margin: 0, whiteSpace: 'normal' }}>
                        {tr("crytranslator_bu_ses_heqiqi_korpe_aglamasi_d_ea2e8c", "Bu s\u0259s h\u0259qiqi k\xF6rp\u0259 a\u011Flamas\u0131 deyil")}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                    <p className="a-cta-text" style={{ margin: 0 }}>{analysis.explanation}</p>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'var(--a-yellow-1)' }}>
                    <XCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--a-warn-ink)' }} />
                    <p className="text-sm" style={{ margin: 0, color: 'var(--a-warn-ink)' }}>
                      {tr("crytranslator_tv_telefon_ve_ya_imitasiya_ses_1867b6", "TV, telefon v\u0259 ya imitasiya s\u0259sl\u0259ri a\u015Fkarland\u0131. H\u0259qiqi k\xF6rp\u0259 a\u011Flamas\u0131 il\u0259 yenid\u0259n c\u0259hd edin.")}
                    </p>
                  </div>

                  <button onClick={resetAnalysis} className="a-cta-btn w-full" style={{ justifyContent: 'center', height: 44 }}>
                    <Mic size={15} strokeWidth={2.2} />
                    {tr("crytranslator_yeniden_cehd_et_d273ac", "Yenid\u0259n c\u0259hd et")}
                  </button>
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* Success Analysis Result */}
        <AnimatePresence>
          {stage === 'complete' && analysis && cryInfo && analysis.isCryDetected !== false &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}>
            
              <div className="a-card overflow-hidden" style={{ padding: 0 }}>
                <div style={{ height: 8, background: cryInfo.grad }} />
                <div className="p-4 space-y-4">
                  {/* Main Result */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: cryInfo.grad }}>
                      {cryInfo.emoji}
                    </div>
                    <div className="flex-1">
                      <h3 className="a-heading" style={{ margin: 0, fontSize: 19, color: cryInfo.ink }}>{cryInfo.label}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: getUrgencyColor(analysis.urgency) }} />
                        <span className="a-list-sub" style={{ margin: 0 }}>
                          {analysis.confidence}{tr("crytranslator_eminlik_5cf4fa", "% \u0259minlik")}
                        </span>
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
                      {tr("crytranslator_tovsiyeler_17a8f7", "T\xF6vsiy\u0259l\u0259r")}
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

                  {/* Urgency Warning */}
                  {analysis.urgency === 'high' &&
                <div className="a-alert-card" style={{ margin: 0 }}>
                      <AlertCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--a-alert-ink)' }} />
                      <p className="text-sm" style={{ margin: 0, color: 'var(--a-alert-ink)' }}>
                        {tr("crytranslator_diqqet_bu_simptomlar_ciddi_ola_805dc6", "Diqq\u0259t! Bu simptomlar ciddi ola bil\u0259r. H\u0259kim\u0259 m\xFCraci\u0259t etm\u0259yi d\xFC\u015F\xFCn\xFCn.")}
                      </p>
                    </div>
                }

                  <button onClick={resetAnalysis} className="a-btn-soft w-full" style={{ justifyContent: 'center', height: 44 }}>
                    <Mic size={15} strokeWidth={2.2} />
                    {tr("crytranslator_yeni_analiz_3c7a2d", "Yeni analiz")}
                  </button>
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
              {tr("crytranslator_son_analizler_76b144", "Son analizl\u0259r")}
            </h3>
            <div className="space-y-2">
              {history.map((item) => {
              const info = cryTypeLabels[item.cry_type] || cryTypeLabels.attention;
              return (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                    <span className="a-list-icon" style={{ width: 36, height: 36, borderRadius: 12, background: info.grad, fontSize: 16 }}>{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="a-list-title" style={{ margin: 0 }}>{info.label}</p>
                      <p className="a-list-sub" style={{ margin: 0 }}>
                        {new Date(item.created_at).toLocaleDateString(getLocaleTag())}
                      </p>
                    </div>
                    <span className="a-list-time">
                      {item.confidence_score}%
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
        feature="cry_translator" />
    </ToolPage>);

};

export default CryTranslator;
