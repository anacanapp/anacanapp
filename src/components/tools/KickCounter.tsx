import { useState, useEffect, useRef, forwardRef } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Footprints, Info, Phone } from 'lucide-react';
import { formatTr } from '@/lib/tr';
import { useEmergencyNumber } from '@/hooks/useEmergencyNumber';
import { todayKey, daysAgoKey } from '@/lib/local-date';
import {
  type ActiveKickSession,
  newKickSession,
  kickElapsedSeconds,
  loadActiveKickSession,
  saveActiveKickSession,
  kickSessionDayKey } from
'@/lib/kickSession';
import { useKickSessions } from '@/hooks/useKickSessions';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { hapticFeedback } from '@/lib/native';
import { formatDateAz } from '@/lib/date-utils';
import { ToolPage, ToolHeader } from './anacan/ToolKit';

interface KickCounterProps {
  onBack: () => void;
}

const KickCounter = forwardRef<HTMLDivElement, KickCounterProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('KickCounter', 'Tools');

  const { profile, user } = useAuth();
  const userId = user?.id ?? null;
  const emergencyNumber = useEmergencyNumber();
  // Əkiz/üçüz/dördüz hamiləlikdə YALNIZI göstərilir — tək hamiləlikdə bu bölmə
  // heç görünmür, UI əvvəlki kimi tam eyni qalır.
  const isMultiple = !!profile?.multiples_type && profile.multiples_type !== 'single';

  // The running session lives in ONE object timed from its start timestamp, so a
  // locked screen does not stop the clock, and every start is a fresh session.
  const [session, setSessionState] = useState<ActiveKickSession | null>(() => loadActiveKickSession(userId));
  const [now, setNow] = useState(() => Date.now());
  const savingRef = useRef(false);
  const isActive = session !== null;
  const kicks = session?.kicks ?? 0;
  const time = kickElapsedSeconds(session, now);

  const setSession = (next: ActiveKickSession | null) => {
    setSessionState(next);
    saveActiveKickSession(userId, next);
  };

  // Mövqeyə-əsaslı İXTİYARİ ayırma (yalnız əkiz/üçüz) — kimlik deyil, mövqedir
  // (ana hansı körpənin təpik atdığını dəqiq bilə bilməz, yalnız tərəfi hiss edə bilər)
  const [trackPosition, setTrackPosition] = useState(() => !!session?.position);
  const [selectedPosition, setSelectedPosition] = useState<'left' | 'right' | null>(() => session?.position ?? null);

  const { sessions, addSession, getTodayStats, loading } = useKickSessions();

  // Restore the unfinished session once the signed-in user is known.
  useEffect(() => {
    const restored = loadActiveKickSession(userId);
    setSessionState(restored);
    if (restored?.position) {
      setTrackPosition(true);
      setSelectedPosition(restored.position);
    }
  }, [userId]);

  // Display tick only; the elapsed time itself is computed from startedAt.
  useEffect(() => {
    if (!isActive) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isActive]);

  // Keep the chosen side with the stored session.
  useEffect(() => {
    if (session && (session.position ?? null) !== (trackPosition ? selectedPosition : null)) {
      setSession({ ...session, position: trackPosition ? selectedPosition : null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackPosition, selectedPosition]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKick = async () => {
    void hapticFeedback.medium();
    const at = Date.now();
    setNow(at);
    const position = trackPosition ? selectedPosition : null;
    // Functional update so fast taps are never lost. Tapping while idle starts a NEW
    // session with this first kick.
    setSessionState((prev) => {
      const base = prev ?? { ...newKickSession(at), position };
      const next = { ...base, kicks: base.kicks + 1 };
      saveActiveKickSession(userId, next);
      return next;
    });
  };

  const handleStart = () => {
    const at = Date.now();
    setNow(at);
    setSession({ ...newKickSession(at), position: trackPosition ? selectedPosition : null });
  };

  const handleStop = async () => {
    if (!session || savingRef.current) return;
    const finished = session;
    const duration = kickElapsedSeconds(finished, Date.now());
    // Clear first: the next start can never continue from (and re-save) this count.
    setSession(null);
    setSelectedPosition(null);
    if (finished.kicks > 0) {
      savingRef.current = true;
      try {
        await addSession(finished.kicks, duration, trackPosition ? finished.position ?? null : null, finished.startedAt);
      } finally {
        savingRef.current = false;
      }
    }
  };

  const handleReset = () => {
    setSession(null);
    setSelectedPosition(null);
  };

  const getKickMessage = () => {
    if (kicks === 0) return tr("kickcounter_baslamaq_ucun_duymeye_toxunun_38b541", "Ba\u015Flamaq \xFC\xE7\xFCn d\xFCym\u0259y\u0259 toxunun");
    if (kicks < 5) return tr("kickcounter_davam_edin_izleyirsiniz_815868", "Davam edin, izl\u0259yirsiniz! \uD83D\uDC76");
    if (kicks < 10) return isMultiple ? tr("kickcounter_ela_gedir_korpeleriniz_aktivdir", "Əla gedir! Körpələriniz aktivdir 💪") : tr("kickcounter_ela_gedir_korpeniz_aktivdir_b54853", "\u018Fla gedir! K\xF6rp\u0259niz aktivdir \uD83D\uDCAA");
    return tr("kickcounter_super_10_tepike_catdiniz_22fdc0", "Super! 10 t\u0259pik\u0259 \xE7atd\u0131n\u0131z! \uD83C\uDF89");
  };

  const todayStats = getTodayStats();

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={<>{tr("kickcounter_bugunku_umumi_bc878f", "Bugünkü ümumi")}: {todayStats.totalKicks} {tr("kickcounter_tepik_6483fe", "t\u0259pik")}</>}
        title={tr("kickcounter_tepik_saygaci_85e455", "Təpik Sayğacı")} />

      {/* Əkiz/üçüz üçün təhsil banneri — ÜMUMİ hərəkətə fikir vermək vacibdir,
          hansı körpənin təpik atdığını dəqiq ayırmaq həmişə mümkün deyil */}
      {isMultiple &&
      <motion.div
        className="a-card a-fade-in"
        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--a-blue-1)' }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}>
        
          <Info size={16} style={{ color: 'var(--a-blue-ink)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="a-today-info-eyebrow" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>{tr("kickcounter_multiples_info_title", "Əkiz/üçüz hamiləlikdə təpiklər")}</p>
            <p className="a-list-sub" style={{ whiteSpace: 'normal', marginTop: 4 }}>
              {tr("kickcounter_multiples_info_desc", "Hansı körpənin təpik atdığını dəqiq ayırmaq həmişə mümkün deyil. Buna görə ÜMUMİ hərəkət nümunənizə fikir verin — adi vəziyyətinizlə müqayisədə azalma hiss etsəniz, hansı tərəfdən asılı olmayaraq dərhal həkiminizlə əlaqə saxlayın.")}
            </p>
          </div>
        </motion.div>
      }

      {/* Main Counter Card */}
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: isMultiple ? 10 : 0 }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}>
        
        {/* Mövqeyə görə İXTİYARİ ayırma — yalnız əkiz/üçüz */}
        {isMultiple &&
        <div style={{ marginBottom: 14 }}>
            <button
            type="button"
            onClick={() => {
              setTrackPosition((v) => !v);
              setSelectedPosition(null);
            }}
            className="a-tag"
            style={{ cursor: 'pointer' }}>
            
              <span style={{ width: 12, height: 12, borderRadius: 999, border: trackPosition ? '1px solid var(--a-peach-2)' : '1px solid var(--a-ink-faint)', background: trackPosition ? 'var(--a-peach-2)' : 'transparent' }} />
              {tr("kickcounter_position_toggle_label", "Mövqeyə görə qeyd et")}
            </button>
            <p className="a-list-sub" style={{ marginTop: 4, whiteSpace: 'normal' }}>
              {tr("kickcounter_position_toggle_desc", "Hansı tərəfdən hiss etdiyinizi ayıra bilirsinizsə")}
            </p>

            {trackPosition &&
          <div className="flex gap-2" style={{ marginTop: 10 }}>
                <button
              type="button"
              onClick={() => setSelectedPosition('left')}
              className="flex-1"
              style={{
                height: 40,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                border: selectedPosition === 'left' ? '2px solid var(--a-peach-2)' : '1px solid var(--a-line-strong)',
                background: selectedPosition === 'left' ? 'var(--a-peach-1)' : 'var(--a-surface)',
                color: selectedPosition === 'left' ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)'
              }}>
              
                  {tr("kickcounter_position_left", "Sol tərəf")}
                </button>
                <button
              type="button"
              onClick={() => setSelectedPosition('right')}
              className="flex-1"
              style={{
                height: 40,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                border: selectedPosition === 'right' ? '2px solid var(--a-peach-2)' : '1px solid var(--a-line-strong)',
                background: selectedPosition === 'right' ? 'var(--a-peach-1)' : 'var(--a-surface)',
                color: selectedPosition === 'right' ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)'
              }}>
              
                  {tr("kickcounter_position_right", "Sağ tərəf")}
                </button>
              </div>
          }
          </div>
        }

        {/* Timer */}
        <div className="text-center mb-4">
          <p className="a-today-info-eyebrow" style={{ marginBottom: 2 }}>{tr("kickcounter_kecen_vaxt_0258bf", "Keçən vaxt")}</p>
          <p className="font-mono a-heading" style={{ margin: 0, fontSize: 30, color: 'var(--a-ink)' }}>{formatTime(time)}</p>
        </div>

        {/* Kick Button */}
        <motion.button
          onClick={handleKick}
          className="w-36 h-36 mx-auto rounded-full flex flex-col items-center justify-center mb-4 relative overflow-hidden"
          style={{ background: 'var(--a-grad-peach)', border: 'none', cursor: 'pointer', boxShadow: '0 18px 32px -14px rgba(255, 157, 99, 0.7)' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}>
          
          {isActive &&
          <span
            className="absolute inset-0 animate-ping"
            style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 999 }} />

          }
          <Footprints size={44} strokeWidth={1.8} style={{ color: 'var(--a-accent-ink)', marginBottom: 2 }} />
          <span className="a-heading" style={{ fontSize: 44, fontWeight: 800, color: 'var(--a-accent-ink)' }}>{kicks}</span>
        </motion.button>

        {/* Message */}
        <p className="a-list-sub text-center mb-4" style={{ whiteSpace: 'normal' }}>
          {getKickMessage()}
        </p>

        {/* Controls */}
        <div className="flex gap-2.5">
          {isActive ?
          <motion.button
            onClick={handleStop}
            className="a-cta-btn flex-1"
            style={{ justifyContent: 'center', height: 46, background: 'var(--a-pink-2)' }}
            whileTap={{ scale: 0.98 }}>
            
              <Pause size={15} strokeWidth={2.2} />
              {tr("kickcounter_dayandir_b2ea06", "Dayand\u0131r")}
            </motion.button> :

          <motion.button
            onClick={handleStart}
            className="a-cta-btn flex-1"
            style={{ justifyContent: 'center', height: 46 }}
            whileTap={{ scale: 0.98 }}>
            
              <Play size={15} strokeWidth={2.2} />
              {tr("kickcounter_basla_4820bc", "Ba\u015Fla")}
            </motion.button>
          }
          <motion.button
            onClick={handleReset}
            className="a-icon-btn"
            style={{ width: 46, height: 46 }}
            whileTap={{ scale: 0.9 }}>
            
            <RotateCcw size={16} strokeWidth={2} />
          </motion.button>
        </div>
      </motion.div>

      {/* Today's Stats */}
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: 12 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}>
        
        <div className="a-card-head" style={{ marginBottom: 10 }}>
          <h3 className="a-card-title a-heading">{tr("kickcounter_bugunku_umumi_bc878f", "Bugünkü ümumi")}</h3>
          <span className="a-section-link" style={{ color: 'var(--a-accent-ink)' }}>{todayStats.totalKicks} {tr("kickcounter_tepik_6483fe", "t\u0259pik")}</span>
        </div>
        {/* Current guidance (NHS/RCOG/ACOG): know the usual pattern, act on any change the same day */}
        <p className="a-teaser" style={{ whiteSpace: 'normal' }}>
          {tr("kick_guidance_pattern", "Körpənizin adi hərəkət ritmini tanıyın. Hərəkətlər azalsa, dəyişsə və ya dayansa, növbəti günü gözləməyin: dərhal doğum evinizlə və ya həkiminizlə əlaqə saxlayın.")}
        </p>
        <a
          href={`tel:${emergencyNumber}`}
          className="a-btn-soft"
          style={{ height: 34, padding: '0 14px', fontSize: 11.5, textDecoration: 'none', marginTop: 8, display: 'inline-flex' }}>
          <Phone size={13} strokeWidth={2.2} />
          {formatTr('weaning_call_emergency', 'Təcili yardım: {emergency}', { emergency: emergencyNumber })}
        </a>
      </motion.div>

      {/* Recent Sessions - Grouped by Day */}
      {sessions.length > 0 &&
      <section className="a-section pb-8">
          <div className="a-section-head">
            <h2 className="a-section-title a-heading">{tr("kick_recent_sessions", "Son sessiyalar")}</h2>
          </div>
          {(() => {
          // Group sessions by date
          const grouped: {[date: string]: typeof sessions;} = {};
          sessions.forEach((session) => {
            const date = kickSessionDayKey(session);
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(session);
          });

          const formatDateLabel = (dateStr: string) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const date = new Date(y, (m || 1) - 1, d || 1);
            const today = todayKey();
            const yesterday = daysAgoKey(1);

            if (dateStr === today) return tr("kickcounter_bu_gun_786fd4", "Bu gün");
            if (dateStr === yesterday) return tr("kickcounter_dunen_52b701", "Dünən");
            return formatDateAz(date);
          };

          return Object.entries(grouped).slice(0, 5).map(([date, daySessions]) =>
          <div key={date} className="mb-4">
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="a-today-info-eyebrow" style={{ margin: 0 }}>{formatDateLabel(date)}</span>
                  <span className="a-list-time" style={{ margin: 0 }}>
                    ({daySessions.reduce((sum, s) => sum + s.kick_count, 0)} {tr("kickcounter_tepik_c35745", "t\u0259pik)")}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--a-line-strong)' }} />
                </div>
                
                <div className="a-list-card">
                  {daySessions.map((session, index) =>
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
                className="a-list-row">
                
                      <span className="a-list-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                        <Footprints size={17} strokeWidth={2} />
                      </span>
                      <div>
                        <p className="a-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {session.kick_count} {tr("kickcounter_tepik_6483fe", "t\u0259pik")}
                          {session.position &&
                      <span className="a-rank-tag" style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)', fontSize: 10 }}>
                              {session.position === 'left' ? tr("kickcounter_position_chip_left", "◀ Sol") : tr("kickcounter_position_chip_right", "Sağ ▶")}
                            </span>
                      }
                        </p>
                        <p className="a-list-sub">
                          {new Date(session.created_at).toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="a-list-trail">
                        <p className="a-list-value font-mono">{formatTime(session.duration_seconds)}</p>
                      </span>
                    </motion.div>
              )}
                </div>
              </div>
          );
        })()}
        </section>
      }
    </ToolPage>);

});

KickCounter.displayName = 'KickCounter';

export default KickCounter;