import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft, Bell, Moon, Sun, Lock,
  Smartphone, Trash2, ChevronRight,
  Volume2, Vibrate, Droplets, Dumbbell, Pill,
  BellOff, Heart, MessageCircle, Users, Download, AlertTriangle, Loader2, HeartPulse, Megaphone } from
'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { useSilentHours } from '@/hooks/useSilentHours';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { tr } from "@/lib/tr";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
'@/components/ui/alert-dialog';
import AppLockSetupSheet from '@/components/security/AppLockSetupSheet';
import { isLockEnabled } from '@/lib/appLock';

interface SettingsScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

// Switch vurÄŸu rÉ™ngi (dizayn sistemi)
const SWITCH_CLS = "data-[state=checked]:bg-[var(--a-peach-2)]";

const SettingsScreen = ({ onBack, onNavigate }: SettingsScreenProps) => {
  useScrollToTop();
  useScreenAnalytics('Settings', 'Settings');

  const {
    settings,
    loading,
    updateSetting,
    initializeReminders,
    isNative
  } = useNotificationSettings();

  const { settings: silentSettings, updateSettings: updateSilentSettings } = useSilentHours();
  const { settings: pushSettings, updateSetting: updatePushSetting, loading: pushLoading } = usePushNotifications();
  const { user, signOut } = useAuth();
  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showLockSheet, setShowLockSheet] = useState(false);
  const [lockActive, setLockActive] = useState(() => isLockEnabled());

  // Initialize reminders on mount
  useEffect(() => {
    initializeReminders();
  }, []);

  // â”€â”€ Data Export â”€â”€
  const handleDataExport = async () => {
    if (!user) return;
    setIsExporting(true);

    try {
      const tables = [
      { name: 'profiles', label: tr("untranslated_profil_v8b0sk", 'Profil') },
      { name: 'daily_logs', label: tr("settingsscreen_gundelik_qeydler_285ea0", 'GÃ¼ndÉ™lik qeydlÉ™r') },
      { name: 'appointments', label: tr("settingsscreen_randevular_a452fc", 'Randevular') },
      { name: 'baby_growth', label: tr("settingsscreen_korpe_inkisafi_8816ce", 'KÃ¶rpÉ™ inkiÅŸafÄ±') },
      { name: 'baby_logs', label: tr("settingsscreen_korpe_qeydleri_8d99a2", 'KÃ¶rpÉ™ qeydlÉ™ri') },
      { name: 'weight_entries', label: tr("settingsscreen_ceki_qeydleri_43f237", 'Ã‡É™ki qeydlÉ™ri') },
      { name: 'cycle_history', label: tr("settingsscreen_tsikl_tarixi_f723ad", 'Tsikl tarixi') },
      { name: 'kick_sessions', label: tr("settingsscreen_tepik_sessiyalari_87edad", 'TÉ™pik sessiyalarÄ±') },
      { name: 'contractions', label: tr("settingsscreen_buzusmeler_1ec368", 'BÃ¼zÃ¼ÅŸmÉ™lÉ™r') },
      { name: 'blood_sugar_logs', label: tr("settingsscreen_qan_sekeri_c922e6", 'Qan ÅŸÉ™kÉ™ri') }];


      const exportData: Record<string, any> = {
        export_date: new Date().toISOString(),
        user_email: user.email
      };

      for (const table of tables) {
        try {
          const { data } = await supabase.
          from(table.name as any).
          select('*').
          eq('user_id', user.id);
          if (data && data.length > 0) {
            exportData[table.name] = data;
          }
        } catch {

          // Skip tables that don't exist or have errors
        }}

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `anacan-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(tr("settingsscreen_melumatlariniz_ugurla_yuklendi_80afed", "M\u0259lumatlar\u0131n\u0131z u\u011Furla y\xFCkl\u0259ndi!"));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(tr("settingsscreen_melumat_ixraci_zamani_xeta_bas_97bbb5", "M\u0259lumat ixrac\u0131 zaman\u0131 x\u0259ta ba\u015F verdi"));
    } finally {
      setIsExporting(false);
    }
  };

  // â”€â”€ Delete Account â”€â”€
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== tr("settingsscreen_delete_confirm_keyword", "SÄ°L")) return;
    setIsDeleting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(tr("settingsscreen_sessiya_tapilmadi_2d6594", "Sessiya tap\u0131lmad\u0131"));
        return;
      }

      const { error } = await supabase.functions.invoke('delete-user-account', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;

      toast.success(tr("settingsscreen_hesabiniz_ugurla_silindi_a6ad6e", "Hesab\u0131n\u0131z u\u011Furla silindi"));
      await signOut();
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error(tr("settingsscreen_hesab_silinerken_xeta_bas_verd_426be6", "Hesab silin\u0259rk\u0259n x\u0259ta ba\u015F verdi"));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const SettingRow = ({
    icon: Icon,
    label,
    description,
    children,
    onClick,
    danger = false,
    tintBg,
    tintInk
  }: {icon: any;label: string;description?: string;children?: React.ReactNode;onClick?: () => void;danger?: boolean;tintBg?: string;tintInk?: string;}) =>
  <motion.div
    className={`flex items-center gap-3 ${onClick ? 'cursor-pointer' : ''}`}
    style={{ padding: '12px 16px' }}
    onClick={onClick}
    whileTap={onClick ? { scale: 0.99 } : undefined}>

      <div className="flex items-center justify-center shrink-0"
    style={{
      width: 36, height: 36, borderRadius: 12,
      background: danger ? 'var(--a-alert-bg)' : tintBg || 'var(--a-surface-soft)'
    }}>
        <Icon size={16} style={{ color: danger ? 'var(--a-alert-ink)' : tintInk || 'var(--a-ink-soft)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13, fontWeight: 600, color: danger ? 'var(--a-alert-ink)' : 'var(--a-ink)' }}>{label}</p>
        {description &&
      <p style={{ fontSize: 11, color: 'var(--a-ink-soft)', marginTop: 1 }}>{description}</p>
      }
      </div>
      {children}
    </motion.div>;

  const SectionCard = ({ title, children }: {title: string;children: React.ReactNode;}) =>
  <div style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)', overflow: 'hidden', paddingBottom: 4 }}>
      <div style={{ padding: '14px 16px 4px' }}>
        <h2 style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--a-ink-soft)' }}>{title}</h2>
      </div>
      {children}
    </div>;


  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <div className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
      </div>);

  }

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("settingsscreen_tenzimlemeler_085659", "TÉ™nzimlÉ™mÉ™lÉ™r")}</p>
          </div>
        </header>

        <div className="space-y-3">
          {onNavigate && <SectionCard title={tr('ads_preferences_title', 'Reklam seçimləri')}>
            <SettingRow icon={Megaphone} label={tr('ads_preferences_title', 'Reklam seçimləri')}
              description={tr('ads_settings_description', 'Reklamsız fasilə və məxfilik seçimləri')}
              onClick={() => onNavigate('ad-preferences')} tintBg="var(--a-lav-1)" tintInk="var(--a-lav-ink)">
              <ChevronRight size={16} className="rtl:rotate-180" />
            </SettingRow>
          </SectionCard>}
          {/* Native App Indicator */}
          {!isNative &&
          <motion.div
            className="flex items-center gap-3"
            style={{ background: 'var(--a-yellow-1)', borderRadius: 'var(--a-radius-md)', padding: '14px 16px' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}>

              <Smartphone size={18} style={{ color: 'var(--a-warn-ink)' }} className="shrink-0" />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--a-warn-ink)' }}>{tr("settingsscreen_web_rejiminde_calisirsiniz_157028", "Web rejimindÉ™ Ã§alÄ±ÅŸÄ±rsÄ±nÄ±z")}</p>
                <p style={{ fontSize: 11, color: 'var(--a-warn-ink)', opacity: 0.8 }}>{tr("settingsscreen_bildirisler_yalniz_mobil_tetbiqde_isleyi_64cd56", "BildiriÅŸlÉ™r yalnÄ±z mobil tÉ™tbiqdÉ™ iÅŸlÉ™yir")}</p>
              </div>
            </motion.div>
          }

          {/* Notifications */}
          <SectionCard title={tr("settingsscreen_bildirisler_54eb88", "BildiriÅŸlÉ™r")}>
            <SettingRow icon={Bell} label={tr("settingsscreen_bildirisler_54eb88", "BildiriÅŸlÉ™r")} description={tr("settingsscreen_butun_bildirisleri_aktivlesdirin_beb91d", "BÃ¼tÃ¼n bildiriÅŸlÉ™ri aktivlÉ™ÅŸdirin")}
            tintBg="var(--a-peach-1)" tintInk="var(--a-accent-ink)">
              <Switch className={SWITCH_CLS}
              checked={settings.notifications_enabled}
              onCheckedChange={(checked) => updateSetting('notifications_enabled', checked)} />
            </SettingRow>
            <SettingRow icon={Volume2} label={tr("settingsscreen_ses_9b06b5", "SÉ™s")} description={tr("settingsscreen_bildiris_sesleri_fc9269", "BildiriÅŸ sÉ™slÉ™ri")}
            tintBg="var(--a-blue-1)" tintInk="var(--a-blue-ink)">
              <Switch className={SWITCH_CLS}
              checked={settings.sound_enabled}
              onCheckedChange={(checked) => updateSetting('sound_enabled', checked)}
              disabled={!settings.notifications_enabled} />
            </SettingRow>
            <SettingRow icon={Vibrate} label={tr("settingsscreen_titreme_6c5b87", "TitrÉ™mÉ™")} description={tr("settingsscreen_titreme_bildirisleri_bdf642", "TitrÉ™mÉ™ bildiriÅŸlÉ™ri")}
            tintBg="var(--a-lav-1)" tintInk="var(--a-lav-ink)">
              <Switch className={SWITCH_CLS}
              checked={settings.vibration_enabled}
              onCheckedChange={(checked) => updateSetting('vibration_enabled', checked)}
              disabled={!settings.notifications_enabled} />
            </SettingRow>
          </SectionCard>


          {/* Silent Hours */}
          <SectionCard title={tr("untranslated_sakit_saatlar_myw4sq", "Sakit saatlar")}>
            <SettingRow
              icon={BellOff}
              label={tr("settingsscreen_sakit_rejim_8a42bd", "Sakit rejim")}
              description={silentSettings.enabled ? `${silentSettings.startTime} - ${silentSettings.endTime} ${tr("settingsscreen_silent_hours_desc", "arasÄ± bildiriÅŸ yoxdur")}` : tr("settingsscreen_gece_saatlarinda_bildirisleri__45007d", "GecÉ™ saatlarÄ±nda bildiriÅŸlÉ™ri sÃ¶ndÃ¼r")}
              tintBg="var(--a-lav-1)" tintInk="var(--a-lav-ink)">

              <Switch className={SWITCH_CLS}
              checked={silentSettings.enabled}
              onCheckedChange={(checked) => {
                updateSilentSettings({ enabled: checked });
                toast.success(checked ? tr("settingsscreen_sakit_saatlar_aktivlesdirildi_2ab4f3", "Sakit saatlar aktivlÉ™ÅŸdirildi") : tr("settingsscreen_sakit_saatlar_deaktiv_edildi_f723bc", "Sakit saatlar deaktiv edildi"));
              }}
              disabled={!settings.notifications_enabled} />
            </SettingRow>
            {silentSettings.enabled &&
            <>
                <SettingRow
                icon={Moon}
                label={tr("settingsscreen_baslama_vaxti_b3791d", "BaÅŸlama vaxtÄ±")}
                description={tr("settingsscreen_bildirisler_susacaq_c5cd6d", "BildiriÅŸlÉ™r susacaq")}
                onClick={() => setShowTimeEdit(true)}
                tintBg="var(--a-blue-1)" tintInk="var(--a-blue-ink)">

                  <div className="flex items-center gap-2">
                    <input
                    type="time"
                    value={silentSettings.startTime}
                    onChange={(e) => {
                      updateSilentSettings({ startTime: e.target.value });
                    }}
                    style={{ background: 'var(--a-surface-soft)', borderRadius: 10, padding: '4px 8px', fontSize: 13, fontWeight: 600, color: 'var(--a-ink)', border: 'none' }} />

                  </div>
                </SettingRow>
                <SettingRow
                icon={Sun}
                label={tr("settingsscreen_bitme_vaxti_624d01", "BitmÉ™ vaxtÄ±")}
                description={tr("settingsscreen_bildirisler_yeniden_baslayacaq_37c49d", "BildiriÅŸlÉ™r yenidÉ™n baÅŸlayacaq")}
                tintBg="var(--a-yellow-1)" tintInk="var(--a-yellow-ink)">

                  <div className="flex items-center gap-2">
                    <input
                    type="time"
                    value={silentSettings.endTime}
                    onChange={(e) => {
                      updateSilentSettings({ endTime: e.target.value });
                    }}
                    style={{ background: 'var(--a-surface-soft)', borderRadius: 10, padding: '4px 8px', fontSize: 13, fontWeight: 600, color: 'var(--a-ink)', border: 'none' }} />

                  </div>
                </SettingRow>
              </>
            }
          </SectionCard>

          {/* Reminders */}
          <SectionCard title={tr("settingsscreen_xatirlatmalar_ddd8e7", "XatÄ±rlatmalar")}>
            <SettingRow icon={Droplets} label={tr("settingsscreen_su_xatirlatmasi_ca127e", "Su xatÄ±rlatmasÄ±")} description={tr("settingsscreen_her_2_saatda_bir_08_00_20_00_bc7ea9", "HÉ™r 2 saatda bir (08:00-20:00)")}
            tintBg="var(--a-blue-1)" tintInk="var(--a-blue-ink)">
              <Switch className={SWITCH_CLS}
              checked={settings.water_reminder}
              onCheckedChange={(checked) => updateSetting('water_reminder', checked)}
              disabled={!settings.notifications_enabled} />
            </SettingRow>
            <SettingRow icon={Pill} label={tr("settingsscreen_vitamin_xatirlatmasi_531a3d", "Vitamin xatÄ±rlatmasÄ±")} description={`${tr("settingsscreen_every_day_at", "HÉ™r gÃ¼n saat")} ${settings.vitamin_time}`}
            tintBg="var(--a-green-1)" tintInk="var(--a-green-ink)">
              <Switch className={SWITCH_CLS}
              checked={settings.vitamin_reminder}
              onCheckedChange={(checked) => updateSetting('vitamin_reminder', checked)}
              disabled={!settings.notifications_enabled} />
            </SettingRow>
            <SettingRow icon={Dumbbell} label={tr("settingsscreen_mesq_xatirlatmasi_399c4f", "MÉ™ÅŸq xatÄ±rlatmasÄ±")} description={tr("settingsscreen_b_e_c_c_gunleri_saat_10_00_40d25b", "B.e., Ã‡., C. gÃ¼nlÉ™ri saat 10:00")}
            tintBg="var(--a-peach-1)" tintInk="var(--a-accent-ink)">
              <Switch className={SWITCH_CLS}
              checked={settings.exercise_reminder}
              onCheckedChange={(checked) => updateSetting('exercise_reminder', checked)}
              disabled={!settings.notifications_enabled} />
            </SettingRow>
          </SectionCard>

          {/* Push Notification Settings */}
          <SectionCard title={tr("settingsscreen_push_bildirisleri_c44832", "Push BildiriÅŸlÉ™ri")}>
            <SettingRow icon={Bell} label={tr("settingsscreen_push_bildirisler_e7cb34", "Push bildiriÅŸlÉ™r")} description={tr("settingsscreen_tetbiq_bagli_olsa_bele_bildiris_alin_01f6eb", "TÉ™tbiq baÄŸlÄ± olsa belÉ™ bildiriÅŸ alÄ±n")}
            tintBg="var(--a-peach-1)" tintInk="var(--a-accent-ink)">
              <Switch className={SWITCH_CLS}
              checked={pushSettings.push_enabled}
              onCheckedChange={(checked) => {
                updatePushSetting('push_enabled', checked);
                toast.success(checked ? tr("settingsscreen_push_bildirisler_aktivlesdiril_9147d9", "Push bildiri\u015Fl\u0259r aktivl\u0259\u015Fdirildi") : tr("settingsscreen_push_bildirisler_deaktiv_edild_e3832a", "Push bildiri\u015Fl\u0259r deaktiv edildi"));
              }} />
            </SettingRow>
            <SettingRow icon={MessageCircle} label={tr("settingsscreen_mesaj_bildirisleri_c8fd7b", "Mesaj bildiriÅŸlÉ™ri")} description={tr("settingsscreen_yeni_mesajlar_ucun_bildiris_e7e1c9", "Yeni mesajlar Ã¼Ã§Ã¼n bildiriÅŸ")}
            tintBg="var(--a-blue-1)" tintInk="var(--a-blue-ink)">
              <Switch className={SWITCH_CLS}
              checked={pushSettings.push_messages}
              onCheckedChange={(checked) => updatePushSetting('push_messages', checked)}
              disabled={!pushSettings.push_enabled} />
            </SettingRow>
            <SettingRow icon={Heart} label={tr("settingsscreen_beyenme_bildirisleri_a6b18f", "BÉ™yÉ™nmÉ™ bildiriÅŸlÉ™ri")} description={tr("settingsscreen_paylasimlariniza_beyenme_734537", "PaylaÅŸÄ±mlarÄ±nÄ±za bÉ™yÉ™nmÉ™")}
            tintBg="var(--a-pink-1)" tintInk="var(--a-pink-ink)">
              <Switch className={SWITCH_CLS}
              checked={pushSettings.push_likes}
              onCheckedChange={(checked) => updatePushSetting('push_likes', checked)}
              disabled={!pushSettings.push_enabled} />
            </SettingRow>
            <SettingRow icon={MessageCircle} label={tr("settingsscreen_serh_bildirisleri_6588b5", "ÅžÉ™rh bildiriÅŸlÉ™ri")} description={tr("settingsscreen_paylasimlariniza_serhler_ad5c16", "PaylaÅŸÄ±mlarÄ±nÄ±za ÅŸÉ™rhlÉ™r")}
            tintBg="var(--a-green-1)" tintInk="var(--a-green-ink)">
              <Switch className={SWITCH_CLS}
              checked={pushSettings.push_comments}
              onCheckedChange={(checked) => updatePushSetting('push_comments', checked)}
              disabled={!pushSettings.push_enabled} />
            </SettingRow>
            <SettingRow icon={Users} label={tr("settingsscreen_cemiyyet_bildirisleri_fa4a16", "CÉ™miyyÉ™t bildiriÅŸlÉ™ri")} description={tr("settingsscreen_qrup_fealiyyetleri_4d13e7", "Qrup fÉ™aliyyÉ™tlÉ™ri")}
            tintBg="var(--a-lav-1)" tintInk="var(--a-lav-ink)">
              <Switch className={SWITCH_CLS}
              checked={pushSettings.push_community}
              onCheckedChange={(checked) => updatePushSetting('push_community', checked)}
              disabled={!pushSettings.push_enabled} />
            </SettingRow>
          </SectionCard>

          {/* Privacy & Data */}
          <SectionCard title={tr("settingsscreen_mexfilik_ve_melumat_f15bb1", "MÉ™xfilik vÉ™ MÉ™lumat")}>
            <SettingRow icon={Lock} label={tr("settingsscreen_sifre_ile_qoruma_152a0e", "ÅžifrÉ™ ilÉ™ qoruma")}
            description={lockActive ? tr("applock_status_on", "Aktiv â€” PIN ilÉ™ qorunur") : tr("applock_status_off", "PIN vÉ™ ya biometrika ilÉ™ qoruyun")}
            onClick={() => setShowLockSheet(true)}
            tintBg="var(--a-blue-1)" tintInk="var(--a-blue-ink)">
              <span className="flex items-center gap-1.5">
                {lockActive &&
                <span style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)', borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 800 }}>
                    {tr("paywall_aktiv", "Aktiv")}
                  </span>
                }
                <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-ink-faint)' }} />
              </span>
            </SettingRow>
            <SettingRow
              icon={HeartPulse}
              label={tr("settingsscreen_health_sync", "SaÄŸlamlÄ±q inteqrasiyasÄ±")}
              description={Capacitor.getPlatform() === 'android' ?
                tr('health_android_cycle_only', 'Health Connect: yalnız period qeydlərinin yazılması') :
                tr("settingsscreen_health_sync_desc", "Apple Health / Health Connect â€” addÄ±m vÉ™ aktivlik")}
              onClick={() => onNavigate?.('health-sync')}
              tintBg="var(--a-pink-1)" tintInk="var(--a-pink-ink)">

              <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-ink-faint)' }} />
            </SettingRow>
            <SettingRow
              icon={Download}
              label={tr("settingsscreen_melumat_ixraci_988684", "MÉ™lumat ixracÄ±")}
              description={tr("settingsscreen_butun_melumatlarinizi_json_formatinda_yu_0c02e5", "BÃ¼tÃ¼n mÉ™lumatlarÄ±nÄ±zÄ± JSON formatÄ±nda yÃ¼klÉ™yin")}
              onClick={isExporting ? undefined : handleDataExport}
              tintBg="var(--a-green-1)" tintInk="var(--a-green-ink)">

              {isExporting ?
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--a-peach-2)' }} /> :

              <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-ink-faint)' }} />
              }
            </SettingRow>
            <SettingRow
              icon={Trash2}
              label={tr("settingsscreen_hesabi_sil_95d759", "HesabÄ± sil")}
              description={tr("settingsscreen_butun_melumatlari_geri_donmez_sekilde_si_35b4d6", "BÃ¼tÃ¼n mÉ™lumatlarÄ± geri dÃ¶nmÉ™z ÅŸÉ™kildÉ™ silin")}
              onClick={() => setShowDeleteDialog(true)}
              danger>

              <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-alert-ink)' }} />
            </SettingRow>
          </SectionCard>
        </div>
      </div>

      {/* TÉ™hlÃ¼kÉ™sizlik kilidi quraÅŸdÄ±rma/idarÉ™etmÉ™ */}
      <AppLockSetupSheet
        open={showLockSheet}
        onClose={() => setShowLockSheet(false)}
        onChanged={() => setLockActive(isLockEnabled())} />

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="a-scope max-w-sm mx-4 rounded-[22px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: 16, background: 'var(--a-alert-bg)' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: 'var(--a-alert-ink)' }} />
              </div>
              <AlertDialogTitle className="text-lg" style={{ color: 'var(--a-ink)' }}>{tr("settingsscreen_hesabi_sil_95d759", "HesabÄ± sil")}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm space-y-3">
              <p>
                {tr("settingsscreen_bu_emeliyyat_61940b", "Bu \u0259m\u0259liyyat")} <strong style={{ color: 'var(--a-alert-ink)' }}>{tr("settingsscreen_geri_qaytarila_bilmez_700864", "geri qaytarÄ±la bilmÉ™z")}</strong>{tr("settingsscreen_hesabiniz_ve_butun_melumatlari_99630e", ". \n                Hesab\u0131n\u0131z v\u0259 b\xFCt\xFCn m\u0259lumatlar\u0131n\u0131z h\u0259mi\u015F\u0259lik silin\u0259c\u0259k:")}

              </p>
              <ul className="list-disc list-inside space-y-1 text-xs" style={{ color: 'var(--a-ink-soft)' }}>
                <li>{tr("settingsscreen_profil_melumatlari_82c76c", "Profil mÉ™lumatlarÄ±")}</li>
                <li>{tr("settingsscreen_butun_qeydler_ve_izleme_tarixcesi_5544e4", "BÃ¼tÃ¼n qeydlÉ™r vÉ™ izlÉ™mÉ™ tarixÃ§É™si")}</li>
                <li>{tr("settingsscreen_cemiyyet_paylasimlari_ve_serhler_655338", "CÉ™miyyÉ™t paylaÅŸÄ±mlarÄ± vÉ™ ÅŸÉ™rhlÉ™r")}</li>
                <li>{tr("settingsscreen_ai_sohbet_tarixcesi_9acf70", "AI sÃ¶hbÉ™t tarixÃ§É™si")}</li>
                <li>{tr("settingsscreen_premium_abunelik_eger_varsa_ce1645", "Premium abunÉ™lik (É™gÉ™r varsa)")}</li>
              </ul>
              <div className="pt-2">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--a-ink)' }}>
                  {tr("settingsscreen_tesdiqlemek_ucun_fd471c", "T\u0259sdiql\u0259m\u0259k \xFC\xE7\xFCn")} <strong>{tr("settingsscreen_sil_27792d", "\"SÄ°L\"")}</strong> {tr("settingsscreen_yazin_e343c0", "yaz\u0131n:")}
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={tr("settingsscreen_si_l_903c4d", "SÄ°L")}
                  className="a-input w-full text-center font-mono tracking-widest" />

              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={() => setDeleteConfirmText('')}
              className="rounded-full">
              {tr("settingsscreen_legv_et_b5e49c", "L\u0259\u011Fv et")}

            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== tr("settingsscreen_delete_confirm_keyword", "SÄ°L") || isDeleting}
              className="bg-destructive hover:bg-destructive/90 rounded-full">

              {isDeleting ?
              <Loader2 className="w-4 h-4 animate-spin me-2" /> :

              <Trash2 className="w-4 h-4 me-2" />
              }
              {tr("settingsscreen_hesabi_sil_95d759", "Hesab\u0131 sil")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

};

export default SettingsScreen;
