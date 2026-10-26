import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Volume2, Mic, MicOff, Moon, AlertTriangle, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useNoiseThresholdsDB } from '@/hooks/useMentalHealthData';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr } from "@/lib/tr";
import { getAudioErrorToast, openMicrophone, releaseAudioRecording } from '@/lib/audioRecording';

interface NoiseMeterProps {
  onBack: () => void;
}

// Fallback thresholds if DB is empty
const FALLBACK_NOISE_THRESHOLDS = {
  ideal: 40,
  acceptable: 50,
  warning: 60,
  danger: 70
};

const NoiseMeter = ({ onBack }: NoiseMeterProps) => {
  useScrollToTop();
  useScreenAnalytics('NoiseMeter', 'Tools');

  // Fetch thresholds from database
  const { data: noiseThresholdsDB = [] } = useNoiseThresholdsDB();

  // Build thresholds from DB or use fallback
  const NOISE_THRESHOLDS = useMemo(() => {
    if (noiseThresholdsDB.length > 0) {
      const getThresholdValue = (key: string, defaultVal: number) => {
        const t = noiseThresholdsDB.find((n) => n.threshold_key === key);
        return t ? t.min_db : defaultVal;
      };
      return {
        ideal: getThresholdValue('quiet', 40),
        acceptable: getThresholdValue('moderate', 50),
        warning: getThresholdValue('loud', 60),
        danger: getThresholdValue('very_loud', 70)
      };
    }
    return FALLBACK_NOISE_THRESHOLDS;
  }, [noiseThresholdsDB]);

  const [isListening, setIsListening] = useState(false);
  const [hasMeasurement, setHasMeasurement] = useState(false);
  const [currentDb, setCurrentDb] = useState(0);
  const [avgDb, setAvgDb] = useState(0);
  const [maxDb, setMaxDb] = useState(0);
  const [showWhiteNoisePrompt, setShowWhiteNoisePrompt] = useState(false);
  const [history, setHistory] = useState<{db: number;time: Date;}[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const listeningControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const animationRef = useRef<number | null>(null);
  const dbHistoryRef = useRef<number[]>([]);

  const { toast } = useToast();
  const { profile } = useAuth();

  const saveToDatabase = useCallback(async (db: number) => {
    if (!profile?.user_id) return;

    const isTooLoud = db > NOISE_THRESHOLDS.acceptable;

    await supabase.from('noise_measurements').insert({
      user_id: profile.user_id,
      decibel_level: db,
      is_too_loud: isTooLoud
    });
  }, [profile?.user_id, NOISE_THRESHOLDS.acceptable]);

  const startListening = async () => {
    if (listeningControllerRef.current || !mountedRef.current) return;
    const controller = new AbortController();
    listeningControllerRef.current = controller;
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

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      dbHistoryRef.current = [];
      setHasMeasurement(false);
      setCurrentDb(0);
      setAvgDb(0);
      setMaxDb(0);

      const updateLevel = () => {
        if (controller.signal.aborted || !analyserRef.current) return;

        const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatTimeDomainData(dataArray);

        // Calculate RMS value
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);

        // Convert to dB (with calibration offset)
        // The formula: dB = 20 * log10(rms) + calibration
        // We add a calibration factor to approximate real-world dB levels
        const db = Math.max(0, Math.min(120, 20 * Math.log10(rms) + 94));

        setCurrentDb(Math.round(db));
        setHasMeasurement(true);

        // Update history for averaging
        dbHistoryRef.current.push(db);
        if (dbHistoryRef.current.length > 100) {
          dbHistoryRef.current.shift();
        }

        // Calculate average
        const avg = dbHistoryRef.current.reduce((a, b) => a + b, 0) / dbHistoryRef.current.length;
        setAvgDb(Math.round(avg));

        // Track maximum (dəyirmiləşdirilmiş — 25.0446593493 kimi uzun onluq nömrələr əvəzinə "XX")
        setMaxDb((prev) => Math.max(prev, Math.round(db)));

        // Check if too loud for baby sleep
        if (db > NOISE_THRESHOLDS.warning && !showWhiteNoisePrompt) {
          setShowWhiteNoisePrompt(true);
        }

        animationRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

    } catch (error) {
      if (controller.signal.aborted) return;
      cleanup();
      setIsListening(false);
      toast(getAudioErrorToast(error, stream ? 'audio' : 'microphone'));
    }
  };

  const cleanup = () => {
    listeningControllerRef.current?.abort();
    listeningControllerRef.current = null;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    analyserRef.current = null;
    releaseAudioRecording(null, streamRef.current);
    streamRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const stopListening = async () => {
    const wasListening = !!streamRef.current;
    cleanup();
    setIsListening(false);

    // Keep the result locally even when the database is slow or unavailable.
    // A measured 0 dB is a result too; it is not the initial idle state.
    if (wasListening && dbHistoryRef.current.length > 0 && mountedRef.current) {
      setCurrentDb(avgDb);
      setHistory((prev) => [...prev.slice(-9), { db: avgDb, time: new Date() }]);
      await saveToDatabase(avgDb);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const background = () => {
      if (document.visibilityState === 'hidden') { cleanup(); setIsListening(false); }
    };
    document.addEventListener('visibilitychange', background);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', background);
      cleanup();
    };
  }, []);

  // Noise level → anacan palette
  const getNoiseLevel = (db: number) => {
    if (db < NOISE_THRESHOLDS.ideal) return { label: tr("noisemeter_mukemmel_ae2244", 'Mükəmməl'), color: 'var(--a-green-ink)', dot: 'var(--a-green-2)', soft: 'var(--a-green-1)' };
    if (db < NOISE_THRESHOLDS.acceptable) return { label: tr("noisemeter_yaxsi_9d8595", 'Yaxşı'), color: 'var(--a-green-ink)', dot: 'var(--a-green-2)', soft: 'var(--a-green-1)' };
    if (db < NOISE_THRESHOLDS.warning) return { label: tr("noisemeter_qebulolunandir_0cab62", 'Qəbulolunandır'), color: 'var(--a-warn-ink)', dot: 'var(--a-yellow-2)', soft: 'var(--a-yellow-1)' };
    if (db < NOISE_THRESHOLDS.danger) return { label: tr("noisemeter_yuksek_492584", 'Yüksək'), color: 'var(--a-accent-ink)', dot: 'var(--a-peach-2)', soft: 'var(--a-peach-1)' };
    return { label: tr("noisemeter_cox_yuksek_86dadc", 'Çox yüksək!'), color: 'var(--a-pink-ink)', dot: 'var(--a-pink-2)', soft: 'var(--a-pink-1)' };
  };

  const noiseLevel = getNoiseLevel(currentDb);
  const gaugePercentage = Math.min(100, currentDb / 100 * 100);

  const navigateToWhiteNoise = () => {
    stopListening();
    onBack();
    // The parent will handle navigation
  };

  return (
    <ToolPage>
      <ToolHeader
        onBack={() => { cleanup(); onBack(); }}
        eyebrow={tr("noisemeter_korpe_yuxusu_ucun_ideal_muhit_4a6c06", "Körpə yuxusu üçün ideal mühit")}
        title={tr("noisemeter_ses_kuy_olcer_68f0b6", "Səs-Küy Ölçər")} />

      <div className="space-y-3">
        {/* Main Gauge */}
        <div className="a-card" style={{ padding: 24 }}>
          <div className="flex flex-col items-center">
            {/* Circular Gauge */}
            <div className="relative w-48 h-48">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--a-line-strong)"
                  strokeWidth="8" />
                
                {/* Progress circle */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={noiseLevel.dot}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${gaugePercentage * 2.64} 264`}
                  animate={{ strokeDasharray: `${gaugePercentage * 2.64} 264` }}
                  transition={{ duration: 0.3 }} />
                
              </svg>
              
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-5xl font-bold a-heading"
                  style={{ color: noiseLevel.color }}
                  key={currentDb}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}>
                  
                  {currentDb}
                </motion.span>
                <span className="text-lg" style={{ color: 'var(--a-ink-soft)' }}>dB</span>
              </div>
            </div>

            {/* Status Label */}
            <div className="mt-4 px-4 py-2 rounded-full" style={{ background: hasMeasurement ? noiseLevel.soft : 'var(--a-surface-soft)' }}>
              <span className="font-bold" style={{ color: hasMeasurement ? noiseLevel.color : 'var(--a-ink-soft)' }}>
                {hasMeasurement ? noiseLevel.label : tr("noisemeter_olcum_basladilmayib_46107a", 'Ölçüm başladılmayıb')}
              </span>
            </div>

            {/* Control Button */}
            <motion.button
              className="mt-6 w-32 h-32 rounded-full flex items-center justify-center"
              style={isListening ?
              { background: 'var(--a-pink-2)', border: 'none', color: '#fff', boxShadow: '0 14px 30px -12px rgba(255, 138, 164, 0.7)', cursor: 'pointer' } :
              { background: 'var(--a-grad-cta)', border: '1px solid var(--a-btn-border)', color: 'var(--a-accent-ink)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' }}
              whileTap={{ scale: 0.95 }}
              aria-label={isListening ? tr("noisemeter_dayandirmaq_ucun_toxunun_d02de1", "Dayandırmaq üçün toxunun") : tr("noisemeter_baslamaq_ucun_toxunun_ee2514", "Başlamaq üçün toxunun")}
              onClick={isListening ? stopListening : startListening}>
              
              {isListening ?
              <MicOff className="w-12 h-12" /> :

              <Mic className="w-12 h-12" />
              }
            </motion.button>
            <p className="mt-2 text-sm font-semibold" style={{ margin: '8px 0 0', color: 'var(--a-ink-soft)' }}>
              {isListening ? tr("noisemeter_dayandirmaq_ucun_toxunun_d02de1", "Dayand\u0131rmaq \xFC\xE7\xFCn toxunun") : tr("noisemeter_baslamaq_ucun_toxunun_ee2514", "Ba\u015Flamaq \xFC\xE7\xFCn toxunun")}
            </p>

            {/* Live statistics stay directly below the control after stopping. */}
            {hasMeasurement &&
            <div className="mt-4 w-full max-w-xs" role={isListening ? undefined : 'status'}>
                {!isListening && <p className="a-list-title text-center mb-2">{tr('noisemeter_last_result', 'Son ölçmənin nəticəsi')}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                    <p className="a-list-sub" style={{ margin: 0 }}>{tr("untranslated_orta_yslkg0", "Orta")}</p>
                    <p className="a-heading" style={{ margin: 0, fontSize: 20 }}>{avgDb} dB</p>
                  </div>
                  <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                    <p className="a-list-sub" style={{ margin: 0 }}>{tr("untranslated_maks_6z8ju8", "Maks")}</p>
                    <p className="a-heading" style={{ margin: 0, fontSize: 20 }}>{maxDb} dB</p>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        {/* White Noise Prompt */}
        {showWhiteNoisePrompt && isListening &&
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}>
          
            <div className="a-card" style={{ background: 'var(--a-peach-1)', border: 'none' }}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 shrink-0" style={{ color: 'var(--a-accent-ink)' }} />
                <div className="flex-1">
                  <h3 className="font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{tr("noisemeter_ses_seviyyesi_yuksekdir_f91956", "Səs səviyyəsi yüksəkdir")}</h3>
                  <p className="text-sm mt-1" style={{ margin: '4px 0 0', color: 'var(--a-accent-ink)', opacity: 0.85 }}>
                    {tr("noisemeter_bu_seviyye_derin_yuxu_ucun_cox_b27a60", "Bu s\u0259viyy\u0259 d\u0259rin yuxu \xFC\xE7\xFCn \xE7ox y\xFCks\u0259kdir. A\u011F s\u0259s a\xE7\u0131m?")}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                    className="a-cta-btn"
                    style={{ height: 38, padding: '0 16px', fontSize: 11.5 }}
                    onClick={navigateToWhiteNoise}>
                    
                      <Volume2 size={13} strokeWidth={2.2} />
                      {tr("noisemeter_ag_ses_ac_06be65", "A\u011F s\u0259s a\xE7")}
                    </button>
                    <button
                    className="a-btn-soft"
                    style={{ height: 38, padding: '0 16px', fontSize: 11.5 }}
                    onClick={() => setShowWhiteNoisePrompt(false)}>
                    
                      {tr("untranslated_sonra_1f3m9s", "Sonra")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        }

        {/* Noise Level Guide */}
        <div className="a-card">
          <h3 className="a-card-title a-heading mb-3 flex items-center gap-2" style={{ margin: '0 0 12px' }}>
            <Moon className="w-4 h-4" style={{ color: 'var(--a-lav-2)' }} />
            {tr("noisemeter_korpe_yuxusu_ucun_ses_seviyyel_d8f4f9", "K\xF6rp\u0259 yuxusu \xFC\xE7\xFCn s\u0259s s\u0259viyy\u0259l\u0259ri")}
          </h3>
          <div className="space-y-2">
            {[
            { dot: 'var(--a-green-2)', range: '0-40 dB', label: tr("noisemeter_mukemmel_ae2244", "Mükəmməl") },
            { dot: '#8fd19e', range: '40-50 dB', label: tr("noisemeter_yaxsi_9d8595", "Yaxşı") },
            { dot: 'var(--a-yellow-2)', range: '50-60 dB', label: tr("noisemeter_qebulolunandir_0cab62", "Qəbulolunandır") },
            { dot: 'var(--a-peach-2)', range: '60-70 dB', label: tr("noisemeter_yuksek_492584", "Yüksək") },
            { dot: 'var(--a-pink-2)', range: '70+ dB', label: tr("noisemeter_cox_yuksek_c4d475", "Çox yüksək") }].
            map((row) =>
            <div key={row.range} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ background: row.dot }} />
                <span className="text-sm flex-1 font-semibold" style={{ color: 'var(--a-ink)' }}>{row.range}</span>
                <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{row.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent History */}
        {history.length > 0 &&
        <div className="a-card">
            <h3 className="a-card-title a-heading mb-3 flex items-center gap-2" style={{ margin: '0 0 12px' }}>
              <History className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
              {tr("noisemeter_son_olcmeler_b024cf", "Son \xF6l\xE7m\u0259l\u0259r")}
            </h3>
            <div className="space-y-2">
              {history.slice().reverse().map((item, idx) => {
              const level = getNoiseLevel(item.db);
              return (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--a-surface-soft)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: level.dot }} />
                    <span className="a-list-title" style={{ margin: 0 }}>{item.db} dB</span>
                    <span className="a-list-time ms-auto" style={{ margin: '0 0 0 auto' }}>
                      {item.time.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>);

            })}
            </div>
          </div>
        }
      </div>
    </ToolPage>);

};

export default NoiseMeter;
