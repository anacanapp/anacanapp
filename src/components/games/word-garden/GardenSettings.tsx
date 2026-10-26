import { Check, Volume2, Vibrate, Contrast, Sparkles, Flower2, Waves, Moon } from 'lucide-react';
import type { GardenPreferences } from './model';
import type { GardenText } from './useGardenText';

export default function GardenSettings({ preferences, onChange, t }: { preferences: GardenPreferences; onChange: (next: GardenPreferences) => void; t: GardenText }) {
  const switches = [
    { key: 'sound', icon: Volume2, title: 'sound', description: 'soundDescription' },
    { key: 'haptics', icon: Vibrate, title: 'haptics', description: 'hapticsDescription' },
    { key: 'highContrast', icon: Contrast, title: 'highContrast', description: 'contrastDescription' },
    { key: 'reducedMotion', icon: Sparkles, title: 'reducedMotion', description: 'motionDescription' },
  ] as const;
  return <div className="wg-settings">
    {switches.map(({ key, icon: Icon, title, description }) => <div className="wg-setting" key={key}>
      <span className="wg-setting-icon"><Icon size={19} /></span>
      <div><strong id={`wg-${key}-label`}>{t(title)}</strong><p>{t(description)}</p></div>
      <button type="button" role="switch" aria-checked={preferences[key]} aria-labelledby={`wg-${key}-label`}
        onClick={() => onChange({ ...preferences, [key]: !preferences[key] })} className="wg-switch"><span /></button>
    </div>)}
    <h3>{t('scenery')}</h3>
    <div className="wg-theme-options">{([{ theme: 'garden', icon: Flower2 }, { theme: 'lake', icon: Waves }, { theme: 'night', icon: Moon }] as const).map(({ theme, icon: Icon }) =>
      <button key={theme} type="button" aria-pressed={preferences.theme === theme} onClick={() => onChange({ ...preferences, theme })} className={`wg-theme-preview wg-preview-${theme}`}>
        <Icon size={24} /><span>{t(theme)}</span>{preferences.theme === theme && <Check size={13} className="wg-theme-check" />}
      </button>)}</div>
  </div>;
}
