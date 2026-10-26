import { motion } from 'framer-motion';
import { ArrowLeft, Sun, Moon, Monitor, Check, Palette } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { tr } from "@/lib/tr";

interface AppearanceScreenProps {
  onBack: () => void;
}

const AppearanceScreen = ({ onBack }: AppearanceScreenProps) => {
  useScrollToTop();
  useScreenAnalytics('Appearance', 'Settings');

  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const currentTheme = theme === 'system' ? systemTheme : theme;

  const themeOptions = [
  {
    id: 'light',
    label: tr("appearancescreen_aciq_rejim_800daa", 'AÃ§Ä±q rejim'),
    description: tr("appearancescreen_klassik_aciq_rengler_7c8359", 'Klassik aÃ§Ä±q rÉ™nglÉ™r'),
    icon: Sun,
    preview: 'linear-gradient(135deg, #ffe7e1, #ffe4c4)',
    previewInk: 'var(--a-accent-ink)'
  },
  {
    id: 'dark',
    label: tr("appearancescreen_qaranliq_rejim_ef2f9f", 'QaranlÄ±q rejim'),
    description: tr("appearancescreen_gozlere_rahat_qaranliq_tema_4d59d5", 'GÃ¶zlÉ™rÉ™ rahat qaranlÄ±q tema'),
    icon: Moon,
    preview: 'linear-gradient(135deg, #201512, #34241d)',
    previewInk: '#ffc79e'
  },
  {
    id: 'system',
    label: tr("appearancescreen_sistem_label", "Sistem"),
    description: tr("appearancescreen_cihazinizin_ayarina_uygun_9b4fa7", 'CihazÄ±nÄ±zÄ±n ayarÄ±na uyÄŸun'),
    icon: Monitor,
    preview: 'linear-gradient(90deg, #ffe7e1 0%, #ffe4c4 50%, #201512 50%, #34241d 100%)',
    previewInk: 'var(--a-accent-ink)'
  }];


  return (
    <div className="a-scope safe-top min-h-screen pb-28 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr("appearancescreen_tema_ve_reng_secimleri_f46e36", "Tema vÉ™ rÉ™ng seÃ§imlÉ™ri")}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("appearancescreen_gorunus_165fe3", "GÃ¶rÃ¼nÃ¼ÅŸ")}</p>
            </div>
          </div>
        </header>

        <div className="space-y-3.5">
          {/* Theme Selection */}
          <motion.div
            className="a-card"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}>

            <h3 className="a-card-title flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Palette size={16} style={{ color: 'var(--a-accent-ink)' }} />
              {tr("appearancescreen_tema_secimi_73a672", "Tema Se\xE7imi")}
            </h3>

            <div className="space-y-2.5">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.id;

                return (
                  <motion.button
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className="w-full flex items-center gap-4 transition-all"
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      background: isSelected ? 'var(--a-peach-1)' : 'var(--a-surface-soft)',
                      border: isSelected ? '2px solid var(--a-peach-2)' : '2px solid transparent'
                    }}
                    whileTap={{ scale: 0.98 }}>

                    {/* Preview */}
                    <div className="w-14 h-14 flex items-center justify-center shrink-0"
                    style={{ borderRadius: 14, background: option.preview, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08)' }}>
                      <Icon size={22} style={{ color: option.previewInk }} />
                    </div>

                    <div className="flex-1 text-start">
                      <p style={{ fontSize: 14, fontWeight: 700, color: isSelected ? 'var(--a-accent-ink)' : 'var(--a-ink)' }}>{option.label}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 1 }}>{option.description}</p>
                    </div>

                    {isSelected &&
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'var(--a-peach-2)' }}>

                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      </motion.div>
                    }
                  </motion.button>);

              })}
            </div>
          </motion.div>

          {/* Current Theme Preview */}
          <motion.div
            className="a-card"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}>

            <h3 className="a-card-title" style={{ marginBottom: 14 }}>{tr("appearancescreen_cari_gorunus_aeba05", "Cari GÃ¶rÃ¼nÃ¼ÅŸ")}</h3>

            <div className="space-y-3">
              {/* Color samples */}
              <div className="flex gap-2">
                <div className="flex-1 h-12 flex items-center justify-center" style={{ borderRadius: 14, background: 'var(--a-bg)', border: '1px solid var(--a-line-strong)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--a-on-bg-soft)' }}>{tr("appearancescreen_fon", "Fon")}</span>
                </div>
                <div className="flex-1 h-12 flex items-center justify-center" style={{ borderRadius: 14, background: 'var(--a-surface-soft)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("appearancescreen_seth", "SÉ™th")}</span>
                </div>
                <div className="flex-1 h-12 flex items-center justify-center" style={{ borderRadius: 14, background: 'var(--a-peach-2)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>{tr("appearancescreen_vurgu", "VurÄŸu")}</span>
                </div>
              </div>

              {/* Sample card */}
              <div style={{ padding: 14, borderRadius: 16, background: 'var(--a-surface-soft)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-peach-1)' }}>
                    <Sun size={18} style={{ color: 'var(--a-accent-ink)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("appearancescreen_numune_kart_1dac7f", "NÃ¼munÉ™ kart")}</p>
                    <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{tr("appearancescreen_bu_cari_temanizin_gorunusudur_2e30a3", "Bu cari temanÄ±zÄ±n gÃ¶rÃ¼nÃ¼ÅŸÃ¼dÃ¼r")}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)', borderRadius: 'var(--a-radius-md)', padding: 16 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}>

            <p className="text-center" style={{ fontSize: 12.5, color: 'var(--a-disclaimer-ink)' }}>
              {theme === 'system' ?
              tr("appearancescreen_system_theme_in_use", "Hal-hazÄ±rda sistem temasÄ± ({theme}) istifadÉ™ olunur.").replace("{theme}", currentTheme === 'dark' ? tr("appearancescreen_qaranliq_affa8e", "qaranlÄ±q") : tr("appearancescreen_aciq_79bf9c", "aÃ§Ä±q")) :
              tr("appearancescreen_theme_activated", "{theme} rejim aktiv edilib.").replace("{theme}", theme === 'dark' ? tr("appearancescreen_qaranliq_34c5e3", "QaranlÄ±q") : tr("appearancescreen_aciq_306cc4", "AÃ§Ä±q"))
              }
            </p>
          </motion.div>
        </div>
      </div>
    </div>);

};

export default AppearanceScreen;
