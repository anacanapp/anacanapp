import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Check } from 'lucide-react';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { tr } from '@/lib/tr';

/**
 * Ananın öz yuxusunu qeyd etmək üçün widget (Mommy/Bump dashboard).
 * Əvvəllər YALNIZ körpənin yuxusu izlənirdi (baby_logs) — doğuşdan sonrakı
 * yuxusuzluq PPD üçün əsas risk faktoru olduğu üçün bu boşluq doldurulur.
 * WaterWidget.tsx-in 'anacan' variantı ilə eyni vizual dil.
 */

const SLEEP_QUALITY = [
{ value: 1, emoji: '😫' },
{ value: 2, emoji: '😴' },
{ value: 3, emoji: '😐' },
{ value: 4, emoji: '😌' },
{ value: 5, emoji: '😇' }];

export default function MotherSleepWidget() {
  const { todayLog, logs, updateSleep } = useDailyLogs();
  const [expanded, setExpanded] = useState(false);
  const [hours, setHours] = useState<string>('');
  const [quality, setQuality] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loggedToday = todayLog?.sleep_hours != null;
  const todayEmoji = SLEEP_QUALITY.find((q) => q.value === todayLog?.sleep_quality)?.emoji || '💤';

  // Son 7 günün ortalaması (varsa) — trend konteksti üçün
  const recentWithSleep = logs.filter((l) => l.sleep_hours != null).slice(0, 7);
  const weekAvg = recentWithSleep.length > 0 ?
  Math.round(recentWithSleep.reduce((sum, l) => sum + (l.sleep_hours || 0), 0) / recentWithSleep.length * 10) / 10 :
  null;

  const handleOpen = () => {
    setHours(todayLog?.sleep_hours != null ? String(todayLog.sleep_hours) : '');
    setQuality(todayLog?.sleep_quality ?? null);
    setExpanded(true);
  };

  const handleSave = async () => {
    const h = parseFloat(hours);
    if (!h || h <= 0) return;
    setSaving(true);
    await updateSleep(h, quality);
    setSaving(false);
    setExpanded(false);
  };

  return (
    <div className="a-card a-fade-in">
      <div className="a-card-head">
        <h3 className="a-card-title a-heading">{tr('mother_sleep_title', 'Mənim yuxum')}</h3>
        {weekAvg !== null &&
        <span className="a-section-link" style={{ color: 'var(--a-ink-soft)' }}>
            {tr('mother_sleep_week_avg', 'həftəlik ort.')} {weekAvg} {tr('health_hour_short', 'saat')}
          </span>
        }
      </div>

      <button
        onClick={handleOpen}
        className="w-full text-start"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div className="flex items-center gap-3">
          <span className="a-list-icon shrink-0" style={{ background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)' }}>
            {loggedToday ? <span style={{ fontSize: 17 }}>{todayEmoji}</span> : <Moon size={17} strokeWidth={2} />}
          </span>
          <div className="flex-1 min-w-0">
            {loggedToday ?
            <>
                <p className="a-list-title" style={{ fontSize: 14 }}>{todayLog?.sleep_hours} {tr('health_hour_short', 'saat')}</p>
                <p className="a-list-sub">{tr('mother_sleep_logged_tap_edit', 'Bu gün qeyd olundu · dəyişmək üçün toxunun')}</p>
              </> :
            <>
                <p className="a-list-title" style={{ fontSize: 14 }}>{tr('mother_sleep_cta', 'Yuxunuzu qeyd edin')}</p>
                <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{tr('mother_sleep_hint', 'Bugünkü yuxu müddəti və keyfiyyəti')}</p>
              </>
            }
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden">
            <div style={{ paddingTop: 14, marginTop: 14, borderTop: '1px solid var(--a-line)' }}>
              <div className="flex items-center gap-3 mb-3">
                <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="7.5"
                className="a-input"
                style={{ width: 90, textAlign: 'center' }} />
                <span style={{ fontSize: 12.5, color: 'var(--a-ink-soft)', fontWeight: 600 }}>{tr('health_hour_short', 'saat')}</span>
                <div className="flex gap-1 flex-1 justify-end">
                  {SLEEP_QUALITY.map((q) =>
                  <button
                    key={q.value}
                    onClick={() => setQuality(q.value)}
                    style={{
                      width: 32, height: 32, borderRadius: 999, fontSize: 16,
                      display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer',
                      background: quality === q.value ? 'var(--a-lav-1)' : 'transparent',
                      transform: quality === q.value ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s'
                    }}>
                      {q.emoji}
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !hours}
                className="a-cta-btn w-full"
                style={{ justifyContent: 'center', height: 44, opacity: !hours ? 0.5 : 1 }}>
                <Check size={15} strokeWidth={2.2} />
                {saving ? tr('common_saxlanilir', 'Saxlanılır...') : tr('common_saxla', 'Saxla')}
              </button>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>
  );
}
