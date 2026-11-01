import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useUserStore } from '@/store/userStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useWidgetText, type WidgetText } from '@/data/widgets';
import { Switch } from '@/components/ui/switch';
import PremiumModal from '@/components/PremiumModal';
import { readWidgetSettings, saveWidgetSettings, type WidgetSettings } from '@/lib/home-widgets';
import '@/styles/care.css';

type Size = 'small' | 'medium' | 'large' | 'lock';

/** Settings + live preview for the home-screen widgets (the native widgets mirror this design). */
export default function WidgetSettingsScreen({ onBack }: { onBack: () => void }) {
  useScrollToTop();
  const language = useUserStore((s) => s.language);
  const t = useWidgetText(language);
  if (!t) return <div className="a-scope cx-page" />;
  return <Content t={t} onBack={onBack} />;
}

function Content({ t, onBack }: { t: WidgetText; onBack: () => void }) {
  const lifeStage = useUserStore((s) => s.lifeStage);
  const { isPremium } = useSubscription();
  const [settings, setSettings] = useState<WidgetSettings>(readWidgetSettings);
  const [size, setSize] = useState<Size>('medium');
  const [paywall, setPaywall] = useState(false);
  const [how, setHow] = useState(false);
  const platform = Capacitor.getPlatform();
  const update = (next: WidgetSettings) => {
    setSettings(next);
    saveWidgetSettings(next);
    window.dispatchEvent(new Event('anacan-widgets-changed'));
  };
  const row = (icon: string, bg: string, title: string, sub: string, key: keyof WidgetSettings, premium = false) =>
  <div className="cx-li">
      <span className="cx-icon" style={{ background: bg }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}><b>{title}{premium && !isPremium && <span className="cx-pill" style={{ marginInlineStart: 6, padding: '2px 8px', background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>👑 {t.premium_badge}</span>}</b><small>{sub}</small></div>
      <Switch checked={settings[key]} onCheckedChange={(v) => update({ ...settings, [key]: v })} aria-label={title} className="data-[state=checked]:bg-[var(--a-peach-2)]" />
    </div>;

  return (
    <div className="a-scope cx-page safe-top">
      <div className="a-sky" aria-hidden><span className="a-cloud c1" /><span className="a-cloud c2" /></div>
      <div className="cx-wrap">
        <div className="cx-head">
          <button type="button" onClick={onBack} className="a-icon-btn" style={{ width: 44, height: 44 }} aria-label="‹"><ArrowLeft className="rtl:rotate-180" size={18} /></button>
          <div className="cx-titles"><p className="cx-eyebrow">{t.settings_eyebrow}</p><h1 className="cx-title">{t.settings_title}</h1></div>
        </div>

        {platform === 'web' && <div className="cx-warn" style={{ marginBottom: 12 }}>{t.native_only}</div>}

        <div className="cx-card" style={{ background: 'linear-gradient(160deg, var(--a-surface), var(--a-surface-soft))' }}>
          <p className="cx-eyebrow" style={{ marginBottom: 10 }}>{t.preview}</p>
          <motion.div key={size} initial={{ scale: .96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'flex', justifyContent: 'center' }}>
            <Preview t={t} size={size} premium={isPremium} settings={settings} bump={lifeStage === 'bump'} />
          </motion.div>
          <div className="cx-seg" style={{ marginTop: 14 }}>
            {(['small', 'medium', 'large', 'lock'] as Size[]).map((s) => <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)}>{t.sizes[s]}</button>)}
          </div>
        </div>

        <p className="cx-section">{t.show_title}</p>
        <div className="cx-card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div className="cx-list">
            {row('🍼', 'var(--a-peach-1)', t.show_feed, t.show_feed_sub, 'showFeed', true)}
            {row('🌙', 'var(--a-lav-1)', t.show_nap, t.show_nap_sub, 'showNap', true)}
            {row('⚡', 'var(--a-green-1)', t.show_actions, t.show_actions_sub, 'showActions', true)}
            {row('🔒', 'var(--a-blue-1)', t.privacy, t.privacy_sub, 'privacy')}
          </div>
        </div>

        {!isPremium &&
        <button type="button" className="cx-card cx-row cx-gap" style={{ width: '100%', textAlign: 'start', cursor: 'pointer', border: 0, background: 'linear-gradient(135deg, var(--a-peach-1), var(--a-surface))' }} onClick={() => setPaywall(true)}>
            <span className="cx-icon" style={{ background: 'var(--a-surface)' }}><Crown size={18} style={{ color: 'var(--a-accent-ink)' }} /></span>
            <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 14, color: 'var(--a-ink)' }}>{t.premium_title}</b><span className="cx-sub">{t.premium_note}</span></span>
          </button>
        }

        <div className="cx-card cx-gap">
          <div className="cx-row">
            <span className="cx-icon" style={{ background: 'var(--a-yellow-1)' }}>💡</span>
            <b style={{ flex: 1, fontSize: 14, color: 'var(--a-ink)' }}>{t.how_title}</b>
            <button type="button" className="a3-btn sm ghost" onClick={() => setHow((h) => !h)}>{t.show}</button>
          </div>
          {how &&
          <ol className="cx-sub" style={{ margin: '10px 0 0', paddingInlineStart: 20, fontSize: 13.5, color: 'var(--a-ink)' }}>
              <li>{platform === 'android' ? t.how_android : t.how_ios}</li>
              {platform !== 'android' && <li style={{ marginTop: 6 }}>{t.how_lock}</li>}
            </ol>
          }
        </div>
      </div>
      <PremiumModal isOpen={paywall} onClose={() => setPaywall(false)} feature={t.premium_title} />
    </div>);
}

/** Static preview of the native widgets (sample values, real labels). */
function Preview({ t, size, premium, settings, bump }: { t: WidgetText; size: Size; premium: boolean; settings: WidgetSettings; bump: boolean }) {
  const card = { borderRadius: 24, boxShadow: '0 12px 28px -14px rgba(217,108,74,.55)', background: 'linear-gradient(135deg,#fff,#ffe9e3)', color: '#333', overflow: 'hidden' } as const;
  const title = bump ? t.pregnancy_week.replace('{w}', '24').replace('{d}', '3') : t.baby_months.replace('{m}', '3').replace('{d}', '12');
  if (size === 'lock') {
    return (
      <div style={{ width: 300, borderRadius: 26, padding: '22px 14px', background: 'linear-gradient(170deg,#f7a99b,#d58fbd 55%,#7d74c9)', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1 }}>14:10</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
          <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'grid', placeItems: 'center', fontSize: 24 }}>{bump ? '🌽' : '🌙'}</div>
          <div style={{ width: 150, borderRadius: 16, background: 'rgba(255,255,255,.25)', padding: '8px 10px', textAlign: 'start', fontSize: 12, lineHeight: 1.3 }}>
            {settings.privacy ? <b>Anacan</b> : premium && !bump ? <><b>🍼 1:40</b><br />{t.sides.left}<br />{t.next_nap} 14:35</> : <><b>{title}</b><br />{bump ? t.baby_size.replace('{fruit}', '🌽') : ''}</>}
          </div>
        </div>
      </div>);
  }
  if (size === 'small') {
    return (
      <div style={{ ...card, width: 160, height: 160, padding: 14, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 34 }}>{bump ? '🌽' : '👶'}</div>
        <div style={{ marginTop: 'auto', fontSize: 10, fontWeight: 800, color: '#b22255' }}>{bump ? t.trimester.replace('{n}', '2').toUpperCase() : 'MURAD'}</div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
      </div>);
  }
  if (!premium) {
    return (
      <div style={{ ...card, width: size === 'large' ? 300 : 320, height: size === 'large' ? 300 : 150, background: 'linear-gradient(135deg,#ff8a8e,#ff5a5f)', color: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 16 }}>
        <div><div style={{ fontSize: 30 }}>👑</div><b style={{ fontSize: 16 }}>{t.premium_title}</b><div style={{ fontSize: 12, opacity: .9, marginTop: 4 }}>{t.premium_body}</div></div>
      </div>);
  }
  return (
    <div style={{ ...card, width: size === 'large' ? 300 : 320, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: '#ffdcdd', display: 'grid', placeItems: 'center', fontSize: 20 }}>👶</span>
        <div><div style={{ fontSize: 10, fontWeight: 800, color: '#b22255' }}>{settings.privacy ? 'ANACAN' : 'MURAD'}</div><b style={{ fontSize: 16 }}>{settings.privacy ? '' : t.baby_months.replace('{m}', '3').replace('{d}', '12')}</b></div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, borderRadius: 16, background: '#ddf3e3', padding: 10 }}><div style={{ fontSize: 9.5, fontWeight: 800, color: '#1c7a4d' }}>🍼 {t.last_feed.toUpperCase()}</div><b style={{ fontSize: 17 }}>{settings.showFeed ? t.hours_minutes.replace('{h}', '1').replace('{m}', '40') : '—'}</b><div style={{ fontSize: 11, color: '#8c8177' }}>{settings.showFeed ? t.sides.left : ''}</div></div>
        <div style={{ flex: 1, borderRadius: 16, background: '#e9ddfc', padding: 10 }}><div style={{ fontSize: 9.5, fontWeight: 800, color: '#5b3aa5' }}>🌙 {t.next_nap.toUpperCase()}</div><b style={{ fontSize: 17 }}>{settings.showNap ? '14:35' : '—'}</b><div style={{ fontSize: 11, color: '#8c8177' }}>{settings.showNap ? '14:35–14:55' : ''}</div></div>
      </div>
      {size === 'large' && <div style={{ borderRadius: 14, background: '#fff', padding: '8px 10px', fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#8c8177' }}>{t.today.toUpperCase()}</span><span>🍼 6 · 😴 9:20 · 🧷 5</span></div>}
      {settings.showActions &&
      <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ flex: 1, textAlign: 'center', borderRadius: 14, padding: '9px 0', background: '#ff5a5f', color: '#fff', fontSize: 12, fontWeight: 800 }}>🍼 {t.btn_feed}</span>
          <span style={{ flex: 1, textAlign: 'center', borderRadius: 14, padding: '9px 0', background: '#7c5cd6', color: '#fff', fontSize: 12, fontWeight: 800 }}>😴 {t.btn_sleep}</span>
          <span style={{ flex: 1, textAlign: 'center', borderRadius: 14, padding: '9px 0', background: '#ffe7e1', color: '#7c2726', fontSize: 12, fontWeight: 800 }}>🧷 {t.btn_diaper}</span>
        </div>
      }
    </div>);
}
