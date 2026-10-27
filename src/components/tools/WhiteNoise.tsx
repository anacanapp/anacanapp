import { useState, useEffect, useRef, forwardRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Volume2, VolumeX, Lock, Timer, Music2 } from 'lucide-react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useSubscription } from '@/hooks/useSubscription';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { PremiumModal } from '@/components/PremiumModal';
import { useWhiteNoiseSounds } from '@/hooks/useDynamicConfig';
import { useWhiteNoiseStore } from '@/store/whiteNoiseStore';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { tr } from "@/lib/tr";

interface Sound {
  id: string;
  name: string;
  emoji: string;
  color: string;
  noiseType: string;
  description: string;
  audioUrl: string | null;
}

// Noise type metadata (anacan palette)
const noiseTypes = [
{
  id: 'white', label: tr("whitenoise_beyaz_kuy_3acf2d", 'Bəyaz Küy'), subtitle: tr("whitenoise_sakitlesdirici_d99d9d", "Sakitləşdirici"),
  description: tr("whitenoise_ana_betnindeki_sese_benzer_monoton_fon_8d1144", 'Ana bətnindəki səsə bənzər monoton fon'), emoji: '⚪',
  bg: 'var(--a-surface)', ink: 'var(--a-ink)', sub: 'var(--a-ink-soft)', badgeBg: 'var(--a-surface-soft)', badgeInk: 'var(--a-ink-soft)'
},
{
  id: 'pink', label: tr("whitenoise_cehrayi_kuy_68573d", 'Çəhrayı Küy'), subtitle: tr("whitenoise_tebiet_effekti_45e038", "Təbiət effekti"),
  description: tr("whitenoise_yungul_yagis_ve_yarpaq_xisiltisi_kimi_d5aea8", 'Yüngül yağış və yarpaq xışıltısı kimi'), emoji: '🌸',
  bg: 'var(--a-pink-1)', ink: 'var(--a-berry-ink)', sub: 'var(--a-berry-ink)', badgeBg: 'var(--a-chip-overlay)', badgeInk: 'var(--a-pink-ink)'
},
{
  id: 'brown', label: tr("whitenoise_qehveyi_kuy_f8e3c6", 'Qəhvəyi Küy'), subtitle: tr("whitenoise_derin_yuxu_b4d583", "Dərin yuxu"),
  description: tr("whitenoise_derin_ve_boguq_sesler_selale_goy_gurultu_47382e", 'Dərin və boğuq səslər — şəlalə, göy gurultusu'), emoji: '🟤',
  bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)', sub: 'var(--a-accent-ink)', badgeBg: 'var(--a-chip-overlay)', badgeInk: 'var(--a-accent-ink)'
}];


const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Geri sayım öz komponentində: hər saniyə yalnız bu kiçik badge render olunur,
// bütün ekran yox (zəif cihazlarda donmanın qarşısı).
const CountdownText = ({ endAt }: { endAt: number }) => {
  const calc = () => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(calc);
  useEffect(() => {
    setSeconds(calc());
    const interval = setInterval(() => setSeconds(calc()), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt]);
  return <span className="text-white font-mono font-bold">{formatTime(seconds)}</span>;
};

// Dalğa animasiyası CSS keyframes ilə (transform: scaleY) — compositor-da işləyir,
// hər kadrda React/JS iş görmür. Deterministik müddət/gecikmə (Math.random yoxdur).
const WAVE_STYLE = `
@keyframes wn-wave { 0%, 100% { transform: scaleY(0.2); } 50% { transform: scaleY(1); } }
.wn-bar { transform-origin: center; animation-name: wn-wave; animation-timing-function: ease-in-out; animation-iteration-count: infinite; will-change: transform; }
@keyframes wn-glow { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.3; } }
.wn-glow { animation: wn-glow 2s ease-in-out infinite; }
@keyframes wn-dot { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
.wn-dot { animation: wn-dot 1s ease-in-out infinite; }
.a-lite .wn-bar, .a-lite .wn-glow, .a-lite .wn-dot { animation-iteration-count: 3; }
@media (prefers-reduced-motion: reduce) { .wn-bar, .wn-glow, .wn-dot { animation: none; } }
`;
const WAVE_BARS = Array.from({ length: 24 }, (_, i) => ({
  height: 22 + (i * 7) % 5 * 5,
  duration: 0.4 + (i * 37) % 10 / 25,
  delay: i * 0.03
}));

interface WhiteNoiseProps {
  onBack: () => void;
}

const WhiteNoise = forwardRef<HTMLDivElement, WhiteNoiseProps>(function WhiteNoiseComponent({ onBack }, ref) {
  useScrollToTop();
  useScreenAnalytics('WhiteNoise', 'Tools');

  const { preferences, loading: prefsLoading, updateWhiteNoiseVolume, updateWhiteNoiseTimer, updateLastWhiteNoiseSound } = useUserPreferences();
  const { isPremium, canUseWhiteNoise, trackWhiteNoiseUsage } = useSubscription();
  const { data: dbSounds, isLoading: soundsLoading } = useWhiteNoiseSounds();

  // Global audio store
  const whiteNoise = useWhiteNoiseStore();

  // Map DB sounds to component format
  const sounds: Sound[] = useMemo(() => {
    if (!dbSounds || dbSounds.length === 0) return [];
    return dbSounds.map((s) => ({
      id: s.id,
      name: s.name,
      emoji: s.emoji,
      color: s.color_gradient || 'from-blue-400 to-cyan-500',
      noiseType: s.noise_type || 'white',
      description: s.description || '',
      audioUrl: s.audio_url || null
    }));
  }, [dbSounds]);

  // Group sounds by noise type
  const groupedSounds = useMemo(() => {
    const groups: Record<string, Sound[]> = {};
    noiseTypes.forEach((nt) => {groups[nt.id] = [];});
    sounds.forEach((s) => {
      if (groups[s.noiseType]) {
        groups[s.noiseType].push(s);
      } else {
        groups['white'].push(s);
      }
    });
    return groups;
  }, [sounds]);

  const [timer, setTimer] = useState<number | null>(null);
  // Taymerin bitmə vaxtı (ms). Hər saniyə state yenilənmir — yalnız start/stop zamanı.
  const [endAt, setEndAt] = useState<number | null>(null);
  const setTimeRemaining = (seconds: number | null) => {
    setEndAt(seconds !== null && Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : null);
  };
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTrackTimeRef = useRef<number>(Date.now());

  const usageInfo = useMemo(() => canUseWhiteNoise(), [canUseWhiteNoise]);

  // Derive active state from global store
  const activeSound = whiteNoise.activeSoundId;
  const volume = whiteNoise.volume;
  const isMuted = whiteNoise.isMuted;

  // Initialize from preferences
  useEffect(() => {
    if (preferences) {
      whiteNoise.setVolume(preferences.white_noise_volume || 70);
      setTimer(preferences.white_noise_timer);
      if (preferences.last_white_noise_sound && !whiteNoise.isPlaying) {
        const { allowed } = canUseWhiteNoise();
        if (allowed || isPremium) {
          // Find and auto-play last sound
          const sound = sounds.find((s) => s.id === preferences.last_white_noise_sound);
          if (sound) {
            whiteNoise.play(sound);
            if (preferences.white_noise_timer) {
              setTimeRemaining(preferences.white_noise_timer * 60);
            } else if (!isPremium) {
              const info = canUseWhiteNoise();
              setTimeRemaining(info.remainingSeconds < Infinity ? info.remainingSeconds : null);
            }
          }
        }
      }
    }
  }, [preferences, isPremium, sounds.length]);

  // Timer countdown
  // Bitmə anında bir dəfə işləyir; yan təsirlər state updater-dən kənardadır
  useEffect(() => {
    if (!activeSound || endAt === null) return;
    const timeout = setTimeout(() => {
      setEndAt(null);
      whiteNoise.stop();
      updateLastWhiteNoiseSound(null);
      if (!isPremium && timer === null) setShowPremiumModal(true);
    }, Math.max(0, endAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [activeSound, endAt, isPremium, timer]);

  // Track usage for free users
  useEffect(() => {
    if (activeSound && !isPremium) {
      trackingIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - lastTrackTimeRef.current) / 1000);
        if (elapsed >= 10) {
          trackWhiteNoiseUsage(10);
          lastTrackTimeRef.current = now;
        }
      }, 10000);
      return () => {
        if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current);
          const now = Date.now();
          const elapsed = Math.floor((now - lastTrackTimeRef.current) / 1000);
          if (elapsed > 0) trackWhiteNoiseUsage(elapsed);
        }
      };
    }
  }, [activeSound, isPremium, trackWhiteNoiseUsage]);

  const handleSoundToggle = async (soundId: string) => {
    if (activeSound === soundId) {
      const now = Date.now();
      const elapsed = Math.floor((now - lastTrackTimeRef.current) / 1000);
      if (elapsed > 0 && !isPremium) await trackWhiteNoiseUsage(elapsed);
      whiteNoise.stop();
      setTimeRemaining(null);
      await updateLastWhiteNoiseSound(null);
    } else {
      const { allowed, remainingSeconds } = canUseWhiteNoise();
      if (!allowed && !isPremium) {setShowPremiumModal(true);return;}
      lastTrackTimeRef.current = Date.now();
      const sound = sounds.find((s) => s.id === soundId);
      if (!sound) return;
      whiteNoise.play(sound);
      await updateLastWhiteNoiseSound(soundId);
      if (isPremium) {setTimeRemaining(timer ? timer * 60 : null);return;}
      const requestedSeconds = timer ? timer * 60 : remainingSeconds;
      setTimeRemaining(Math.min(requestedSeconds, remainingSeconds));
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    whiteNoise.setVolume(newVolume);
    whiteNoise.setMuted(false);
    await updateWhiteNoiseVolume(newVolume);
  };

  const handleTimerChange = async (newTimer: number | null) => {
    if (!isPremium && newTimer === null) {setShowPremiumModal(true);return;}
    setTimer(newTimer);
    await updateWhiteNoiseTimer(newTimer);
    if (!activeSound) {setTimeRemaining(newTimer ? newTimer * 60 : null);return;}
    if (isPremium) {setTimeRemaining(newTimer ? newTimer * 60 : null);return;}
    const info = canUseWhiteNoise();
    if (!info.allowed) {
      whiteNoise.stop();
      await updateLastWhiteNoiseSound(null);
      setShowPremiumModal(true);
      setTimeRemaining(null);
      return;
    }
    if (newTimer) setTimeRemaining(Math.min(newTimer * 60, info.remainingSeconds));
  };

  const timerOptions = isPremium ?
  [
  { value: null, label: tr("common_limitsiz", 'Limitsiz'), icon: '∞' },
  { value: 15, label: tr("whitenoise_15_deq_3ce4c1", '15 dəq'), icon: '15' },
  { value: 30, label: tr("whitenoise_30_deq_15eb1f", '30 dəq'), icon: '30' },
  { value: 60, label: tr("common_1_saat", '1 saat'), icon: '60' }] :

  [
  { value: 10, label: tr("whitenoise_10_deq_b4f9fd", '10 dəq'), icon: '10' },
  { value: 15, label: tr("whitenoise_15_deq_3ce4c1", '15 dəq'), icon: '15' },
  { value: 20, label: tr("whitenoise_20_deq_fb3505", '20 dəq'), icon: '20' }];


  if (prefsLoading || soundsLoading) {
    return <ToolLoading />;
  }

  const remainingMinutes = usageInfo.remainingSeconds === Infinity ? null : Math.floor(usageInfo.remainingSeconds / 60);
  const activeDbSound = sounds.find((s) => s.id === activeSound);

  return (
    <div ref={ref}>
      <ToolPage>
        <ToolHeader
          onBack={onBack}
          eyebrow={tr("whitenoise_kuy_rengleri_ile_derin_yuxu_c4a0f7", "Küy rəngləri ilə dərin yuxu")}
          title={tr("whitenoise_yuxu_sesleri_4b518b", "Yuxu Səsləri")} />

        {/* Free tier usage banner */}
        {!isPremium && remainingMinutes !== null &&
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="a-card mb-4"
          style={{
            background: usageInfo.remainingSeconds < 300 ? 'var(--a-alert-bg)' : 'var(--a-surface)',
            border: 'none'
          }}>
          
            <div className="flex items-center gap-3">
              <span
              className="a-list-icon"
              style={{ background: usageInfo.remainingSeconds < 300 ? 'var(--a-grad-pink)' : 'var(--a-grad-peach)' }}>
                {usageInfo.remainingSeconds < 300 ?
              <Lock size={17} strokeWidth={2.2} style={{ color: 'var(--a-alert-ink)' }} /> :

              <Timer size={17} strokeWidth={2.2} style={{ color: 'var(--a-accent-ink)' }} />
              }
              </span>
              <div className="flex-1 min-w-0">
                <p className="a-list-title" style={{ margin: 0, color: usageInfo.remainingSeconds < 300 ? 'var(--a-alert-ink)' : 'var(--a-ink)' }}>
                  {remainingMinutes} {tr("whitenoise_deqiqe_qalib_da6009", "d\u0259qiq\u0259 qal\u0131b")}
                </p>
                <p className="a-list-sub" style={{ margin: 0, color: usageInfo.remainingSeconds < 300 ? 'var(--a-alert-soft)' : undefined }}>
                  {tr("whitenoise_limitsiz_dinleme_ucun_premium_0f0575", "Limitsiz dinl\u0259m\u0259 \xFC\xE7\xFCn Premium")}
                </p>
              </div>
              <motion.button
              onClick={() => setShowPremiumModal(true)}
              className="a-cta-btn"
              style={{ height: 36, padding: '0 16px', fontSize: 11.5 }}
              whileTap={{ scale: 0.95 }}>
                {tr("whitenoise_kec_19bd66", "Ke\xE7")}
              
            </motion.button>
            </div>
          </motion.div>
        }

        {/* Now Playing Card */}
        <AnimatePresence mode="wait">
          {activeSound && activeDbSound ?
          <motion.div
            key="playing"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="rounded-[26px] p-6 mb-4 relative overflow-hidden"
            style={{ background: 'var(--a-coral-strong)', boxShadow: 'var(--a-coral-shadow)' }}>
            
              <style>{WAVE_STYLE}</style>
              <div className="absolute inset-0 opacity-20">
                <div className="absolute -top-10 -end-10 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)' }} />
                <div className="absolute -bottom-10 -start-10 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)' }} />
              </div>
              
              <div className="relative z-10">
                <div className="text-center mb-4">
                  <motion.div
                  className="text-6xl mb-3 drop-shadow-lg"
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: 1, ease: "easeInOut" }}>
                  
                    {activeDbSound.emoji}
                  </motion.div>
                  <h2 className="text-2xl font-black text-white drop-shadow-md a-heading">{activeDbSound.name}</h2>
                  {activeDbSound.description &&
                <p className="text-white/70 text-xs mt-1">{activeDbSound.description}</p>
                }
                  {endAt !== null &&
                <div className="inline-flex items-center gap-2 mt-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
                      <Timer className="w-4 h-4 text-white/80" />
                      <CountdownText endAt={endAt} />
                    </div>
                }
                </div>

                {/* Waveform Animation */}
                <div className="flex items-center justify-center gap-1 h-12 mb-5">
                  {WAVE_BARS.map((bar, i) =>
                <div
                  key={i}
                  className="wn-bar w-1.5 bg-white/70 rounded-full"
                  style={{
                    height: bar.height,
                    animationDuration: `${bar.duration}s`,
                    animationDelay: `${bar.delay}s`,
                    animationPlayState: whiteNoise.isPlaying ? 'running' : 'paused'
                  }} />
                )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <motion.button
                  onClick={() => whiteNoise.toggleMute()}
                  className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
                  whileTap={{ scale: 0.9 }}>
                  
                    {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                  </motion.button>
                  <motion.button
                  onClick={() => handleSoundToggle(activeSound)}
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--a-surface)', color: 'var(--a-ink)' }}
                  aria-label={tr("mentalhealthtracker_dayandir_b2ea06", "Dayandır")}
                  whileTap={{ scale: 0.9 }}>
                  
                    <Pause className="w-8 h-8" />
                  </motion.button>
                  <div className="w-12 h-12" />
                </div>
              </div>
            </motion.div> :

          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="a-card mb-4 text-center"
            style={{ padding: '26px 18px' }}>
            
              <div
              className="mx-auto mb-3 flex items-center justify-center"
              style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--a-surface-soft)' }}>
                <Music2 className="w-8 h-8" style={{ color: 'var(--a-on-bg-soft)' }} />
              </div>
              <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr("whitenoise_hansi_ses_korpenize_daha_xos_gelir_488ff5", "Hansı səs körpənizə daha xoş gəlir?")}</h3>
              <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("whitenoise_asagidaki_kuy_novlerinden_birini_secerek_ece91d", "Aşağıdakı küy növlərindən birini seçərək başlayın")}</p>
            </motion.div>
          }
        </AnimatePresence>

        {/* Volume Control */}
        <motion.div
          className="a-card mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}>
          
          <div className="flex items-center gap-2 mb-3">
            <Volume2 className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--a-ink)' }}>{tr("whitenoise_ses_seviyyesi_7296d5", "Səs səviyyəsi")}</span>
            <span className="ms-auto text-sm font-bold" style={{ color: 'var(--a-accent-ink)' }}>{isMuted ? 0 : volume}%</span>
          </div>
          <div className="relative">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--a-line-strong)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ width: `${isMuted ? 0 : volume}%`, background: 'var(--a-grad-peach)' }} />
              
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            
          </div>
        </motion.div>

        {/* Timer Options */}
        <motion.div
          className="mb-5"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}>
          
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4" style={{ color: 'var(--a-on-bg-soft)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--a-on-bg)' }}>{tr("untranslated_taymer_uen6sv", "Taymer")}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {timerOptions.map((option) =>
            <motion.button
              key={option.label}
              onClick={() => handleTimerChange(option.value)}
              className="relative py-3 rounded-2xl text-center transition-all"
              style={timer === option.value ?
              { background: 'var(--a-grad-cta)', border: '1px solid var(--a-btn-border)', color: 'var(--a-accent-ink)', boxShadow: 'var(--a-card-shadow)' } :
              { background: 'var(--a-surface)', border: '1px solid var(--a-line)', color: 'var(--a-ink-soft)' }}
              whileTap={{ scale: 0.95 }}>
              
                <span className="text-lg font-bold">{option.icon}</span>
                <p className="text-[10px] mt-0.5 opacity-80 font-semibold">
                  {option.value === null ? tr("common_limitsiz", 'Limitsiz') : tr("whitenoise_deqiqe_94641a", "d\u0259qiq\u0259")}
                </p>
              </motion.button>
            )}
          </div>
          {!isPremium &&
          <p className="text-[10px] mt-2 text-center flex items-center justify-center gap-1" style={{ color: 'var(--a-on-bg-soft)' }}>
              <Lock className="w-3 h-3" />
              {tr("whitenoise_limitsiz_taymer_premium_info", 'Limitsiz taymer Premium-a aiddir')}
            </p>
          }
        </motion.div>

        {/* Sounds by Noise Type */}
        {noiseTypes.map((nt, ntIdx) => {
          const typeSounds = groupedSounds[nt.id] || [];
          if (typeSounds.length === 0) return null;

          return (
            <motion.div
              key={nt.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + ntIdx * 0.08 }}
              className="mb-5">
              
              {/* Section Header */}
              <div className="rounded-2xl p-3 mb-3" style={{ background: nt.bg, boxShadow: 'var(--a-card-shadow)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{nt.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm a-heading" style={{ margin: 0, color: nt.ink }}>{nt.label}</h3>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: nt.badgeBg, color: nt.badgeInk }}>
                        {nt.subtitle}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ margin: 0, color: nt.sub, opacity: 0.8 }}>{nt.description}</p>
                  </div>
                </div>
              </div>

              {/* Sounds Grid */}
              <div className="grid grid-cols-3 gap-3">
                {typeSounds.map((sound, index) => {
                  const isActive = activeSound === sound.id;
                  return (
                    <motion.button
                      key={sound.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 + ntIdx * 0.08 + index * 0.03 }}
                      onClick={() => handleSoundToggle(sound.id)}
                      aria-pressed={isActive}
                      className="relative rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden p-3"
                      style={isActive ?
                      { background: 'var(--a-coral-strong)', boxShadow: 'var(--a-coral-shadow)' } :
                      { background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)' }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}>
                      
                      {isActive &&
                      <>
                          <style>{WAVE_STYLE}</style>
                          <div className="wn-glow absolute inset-0 bg-white/10" />
                        
                          <div className="wn-dot absolute top-2 end-2 w-2.5 h-2.5 rounded-full bg-white shadow-lg" />
                        
                        </>
                      }
                      <span className={`text-3xl mb-1 relative z-10 drop-shadow-sm ${isActive ? 'drop-shadow-lg' : ''}`}>
                        {sound.emoji}
                      </span>
                      <span
                        className="text-[12.5px] font-semibold relative z-10 px-1 text-center leading-tight"
                        style={{ color: isActive ? 'var(--a-on-coral)' : 'var(--a-ink)' }}>
                        {sound.name}
                      </span>
                      {sound.description && !isActive &&
                      <span className="text-[11px] mt-0.5 text-center leading-tight line-clamp-1 px-1" style={{ color: 'var(--a-ink-soft)' }}>
                          {sound.description}
                        </span>
                      }
                      {isActive &&
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                          <div className="flex items-center gap-0.5">
                            {[...Array(3)].map((_, i) =>
                          <div
                            key={i}
                            className="wn-bar w-1 bg-white/80 rounded-full"
                            style={{ height: 8, animationDuration: '0.4s', animationDelay: `${i * 0.1}s` }} />

                          )}
                          </div>
                        </div>
                      }
                    </motion.button>);

                })}
              </div>
            </motion.div>);

        })}

        {/* Premium Modal */}
        <PremiumModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          feature={tr("whitenoise_limitsiz_yuxu_sesleri_b0b439", "Limitsiz yuxu s\u0259sl\u0259ri")} />
        
      </ToolPage>
    </div>);

});

WhiteNoise.displayName = 'WhiteNoise';

export default WhiteNoise;
