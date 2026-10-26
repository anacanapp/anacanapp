import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Shield, Lock, Trash2,
  Download, AlertTriangle, Unlink, Loader2 } from
'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { usePrivacyPreferences, type PrivacyPrefs } from '@/hooks/usePrivacyPreferences';
import { tr } from "@/lib/tr";

interface PartnerPrivacyScreenProps {
  onBack: () => void;
}

// Partnyor bÃ¶lmÉ™si â€” mavi vurÄŸu
const SWITCH_CLS = "data-[state=checked]:bg-[var(--a-blue-2)]";

const PartnerPrivacyScreen = ({ onBack }: PartnerPrivacyScreenProps) => {
  useScrollToTop();

  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const { error } = await (supabase.rpc as any)('unlink_partners');
      if (error) throw error;
      toast({ title: tr('partnerv2_baglanti_kesildi', 'BaÄŸlantÄ± kÉ™sildi') });
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      console.error(e);
      toast({ title: tr('partnerprivacyscreen_xeta_3cdbb6', 'XÉ™ta'), variant: 'destructive' });
      setUnlinking(false);
      setShowUnlinkDialog(false);
    }
  };

  // DB-persist privacy ayarlarÄ± (É™vvÉ™llÉ™r yalnÄ±z local state idi)
  const { prefs, updatePref, loading: prefsLoading } = usePrivacyPreferences();

  const handleToggle = async (key: keyof PrivacyPrefs, value: boolean) => {
    const ok = await updatePref(key, value);
    toast(ok ?
    { title: tr("partnerprivacyscreen_ayar_yenilendi_f0f876", 'Ayar yenilÉ™ndi') } :
    { title: tr("partnerprivacyscreen_xeta_3cdbb6", 'XÉ™ta'), description: tr('privacy_save_failed', 'Yadda saxlanÄ±lmadÄ± â€” yenidÉ™n cÉ™hd edin.'), variant: 'destructive' });
  };

  const handleExportData = async () => {
    if (!user) return;

    toast({ title: tr("partnerprivacyscreen_melumatlar_hazirlanir_482381", 'MÉ™lumatlar hazÄ±rlanÄ±r...'), description: tr("partnerprivacyscreen_bu_bir_nece_saniye_ceke_biler_49b373", 'Bu bir neÃ§É™ saniyÉ™ Ã§É™kÉ™ bilÉ™r.') });

    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      const { data: messages } = await supabase.from('partner_messages').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      const { data: missions } = await supabase.from('partner_missions').select('*').eq('user_id', user.id);
      const { data: notifications } = await supabase.from('notifications').select('*').eq('user_id', user.id);

      const exportData = {
        profile,
        messages,
        missions,
        notifications,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anacan-partner-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: tr("partnerprivacyscreen_melumatlar_yuklendi_f04800", 'MÉ™lumatlar yÃ¼klÉ™ndi!') });
    } catch (error: any) {
      toast({ title: tr("partnerprivacyscreen_xeta_3cdbb6", 'XÉ™ta'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setDeleting(true);
    try {
      await supabase.from('partner_messages').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      await supabase.from('partner_missions').delete().eq('user_id', user.id);
      await supabase.from('notifications').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('user_id', user.id);

      await signOut();

      toast({ title: 'Hesab silindi', description: tr("partnerprivacyscreen_melumatlariniz_birdefelik_silindi_8f69e7", 'MÉ™lumatlarÄ±nÄ±z birdÉ™fÉ™lik silindi.') });
    } catch (error: any) {
      toast({ title: tr("partnerprivacyscreen_xeta_3cdbb6", 'XÉ™ta'), description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const privacyOptions = [
  {
    icon: Shield,
    title: tr("partnerprivacyscreen_analitik_melumat_paylas_7971ff", 'Analitik mÉ™lumat paylaÅŸ'),
    description: tr("partnerprivacyscreen_anonim_istifade_melumatlarini_paylasin_835e3a", 'Anonim istifadÉ™ mÉ™lumatlarÄ±nÄ± paylaÅŸÄ±n'),
    key: 'privacy_share_analytics' as const,
    bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)'
  },
  {
    icon: Lock,
    title: tr("partnerprivacyscreen_mekan_paylasimi_bf6566", 'MÉ™kan paylaÅŸÄ±mÄ±'),
    description: tr("partnerprivacyscreen_heyat_yoldasiniz_mekaninizi_gore_biler_0fb295", 'HÉ™yat yoldaÅŸÄ±nÄ±z mÉ™kanÄ±nÄ±zÄ± gÃ¶rÉ™ bilÉ™r'),
    key: 'privacy_location_sharing' as const,
    bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)'
  },
  {
    icon: Shield,
    title: tr("partnerprivacyscreen_bildiris_sesleri_fc9269", 'BildiriÅŸ sÉ™slÉ™ri'),
    description: tr("partnerprivacyscreen_bildiris_geldikde_ses_cixsin_a3a866", 'BildiriÅŸ gÉ™ldikdÉ™ sÉ™s Ã§Ä±xsÄ±n'),
    key: 'privacy_notification_sounds' as const,
    bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)'
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
              <p className="a-eyebrow">{tr("partnerprivacyscreen_partner_melumatlarinizi_idare_edin_7c5e99", "Partner mÉ™lumatlarÄ±nÄ±zÄ± idarÉ™ edin")}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("partnerprivacyscreen_gizlilik_tehlukesizlik_67bec6", "Gizlilik & TÉ™hlÃ¼kÉ™sizlik")}</p>
            </div>
          </div>
        </header>

        <div className="space-y-3.5">
          {/* Privacy Settings */}
          <motion.div
            className="a-card"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}>

            <h3 className="a-card-title flex items-center gap-2" style={{ marginBottom: 12 }}>
              <Lock size={16} style={{ color: 'var(--a-blue-ink)' }} />
              {tr("partnerprivacyscreen_gizlilik_ayarlari_4055d3", "Gizlilik Ayarlar\u0131")}
            </h3>

            <div className="space-y-1">
              {privacyOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <div key={index} className="flex items-center justify-between gap-3" style={{ padding: '10px 4px' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: option.bg }}>
                        <Icon size={17} style={{ color: option.ink }} />
                      </div>
                      <div className="min-w-0">
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>{option.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--a-ink-soft)', marginTop: 1 }}>{option.description}</p>
                      </div>
                    </div>
                    <Switch
                      className={SWITCH_CLS}
                      checked={prefs[option.key]}
                      disabled={prefsLoading}
                      onCheckedChange={(checked) => handleToggle(option.key, checked)} />

                  </div>);

              })}
            </div>
          </motion.div>

          {/* Data Management */}
          <motion.div
            className="a-card"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}>

            <h3 className="a-card-title flex items-center gap-2" style={{ marginBottom: 12 }}>
              <Shield size={16} style={{ color: 'var(--a-blue-ink)' }} />
              {tr("partnerprivacyscreen_melumat_i_dareetmesi_19f40f", "M\u0259lumat \u0130dar\u0259etm\u0259si")}
            </h3>

            <div className="space-y-2.5">
              <motion.button
                onClick={handleExportData}
                className="w-full flex items-center gap-4 text-start transition-colors"
                style={{ padding: 14, borderRadius: 16, background: 'var(--a-surface-soft)' }}
                whileTap={{ scale: 0.98 }}>

                <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-green-1)' }}>
                  <Download size={17} style={{ color: 'var(--a-green-ink)' }} />
                </div>
                <div className="flex-1">
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("partnerprivacyscreen_melumatlari_yukle_5cee89", "MÉ™lumatlarÄ± YÃ¼klÉ™")}</p>
                  <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{tr("partnerprivacyscreen_butun_melumatlarinizi_json_formatinda_yu_0c02e5", "BÃ¼tÃ¼n mÉ™lumatlarÄ±nÄ±zÄ± JSON formatÄ±nda yÃ¼klÉ™yin")}</p>
                </div>
              </motion.button>

              <motion.button
                onClick={() => setShowUnlinkDialog(true)}
                className="w-full flex items-center gap-4 text-start transition-colors"
                style={{ padding: 14, borderRadius: 16, background: 'var(--a-surface-soft)' }}
                whileTap={{ scale: 0.98 }}>

                <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-blue-1)' }}>
                  <Unlink size={17} style={{ color: 'var(--a-blue-ink)' }} />
                </div>
                <div className="flex-1">
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{tr("partnerv2_baglantini_kes", "BaÄŸlantÄ±nÄ± kÉ™s")}</p>
                  <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{tr("partnerv2_unlink_partner_side_sub", "HÉ™yat yoldaÅŸÄ±nÄ±zÄ±n mÉ™lumatlarÄ±na giriÅŸi dayandÄ±rÄ±n")}</p>
                </div>
              </motion.button>

              <motion.button
                onClick={() => setShowDeleteDialog(true)}
                className="w-full flex items-center gap-4 text-start transition-colors"
                style={{ padding: 14, borderRadius: 16, background: 'var(--a-alert-bg)' }}
                whileTap={{ scale: 0.98 }}>

                <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-chip-overlay)' }}>
                  <Trash2 size={17} style={{ color: 'var(--a-alert-ink)' }} />
                </div>
                <div className="flex-1">
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-alert-ink)' }}>{tr("partnerprivacyscreen_hesabi_sil_6abf24", "HesabÄ± Sil")}</p>
                  <p style={{ fontSize: 11, color: 'var(--a-alert-soft)' }}>{tr("partnerprivacyscreen_butun_melumatlarinizi_birdefelik_silin_41a068", "BÃ¼tÃ¼n mÉ™lumatlarÄ±nÄ±zÄ± birdÉ™fÉ™lik silin")}</p>
                </div>
              </motion.button>
            </div>
          </motion.div>

          {/* Privacy Policy Link */}
          <motion.div
            style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)', borderRadius: 'var(--a-radius-md)', padding: 16 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}>

            <p className="text-center" style={{ fontSize: 12.5, color: 'var(--a-disclaimer-ink)' }}>
              {tr("partnerprivacyscreen_gizlilik_siyasetimiz_ve_istifa_8c585b", "Gizlilik siyas\u0259timiz v\u0259 istifad\u0259 \u015F\u0259rtl\u0259rimiz haqq\u0131nda \u0259trafl\u0131 m\u0259lumat \xFC\xE7\xFCn")}{' '}
              <a href="#" style={{ color: 'var(--a-disclaimer-strong)', fontWeight: 700 }}>{tr("partnerprivacyscreen_buraya_klikleyin_c20d44", "buraya kliklÉ™yin")}</a>.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Unlink Dialog */}
      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent className="a-scope rounded-[22px]">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--a-ink)' }}>{tr("partnerv2_baglantini_kes", "BaÄŸlantÄ±nÄ± kÉ™s")}?</DialogTitle>
            <DialogDescription>
              {tr("partnerv2_unlink_partner_tesdiq", "Partnyor paneli baÄŸlanacaq vÉ™ hÉ™yat yoldaÅŸÄ±nÄ±zÄ±n mÉ™lumatlarÄ±na giriÅŸ dayandÄ±rÄ±lacaq. YenidÉ™n baÄŸlanmaq Ã¼Ã§Ã¼n kod lazÄ±m olacaq.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowUnlinkDialog(false)} className="flex-1 rounded-full">
              {tr("partnerprivacyscreen_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button variant="destructive" onClick={handleUnlink} disabled={unlinking} className="flex-1 rounded-full">
              {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : tr("partnerv2_beli_kes", "BÉ™li, kÉ™s")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="a-scope rounded-[22px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--a-alert-ink)' }}>
              <AlertTriangle className="w-5 h-5" />
              {tr("partnerprivacyscreen_hesabi_silmek_6d444c", "Hesab\u0131 Silm\u0259k")}
            </DialogTitle>
            <DialogDescription className="text-start">
              {tr("partnerprivacyscreen_bu_emeliyyat_geri_qaytarila_bi_fdaca8", "Bu \u0259m\u0259liyyat geri qaytar\u0131la bilm\u0259z. B\xFCt\xFCn m\u0259lumatlar\u0131n\u0131z, o c\xFCml\u0259d\u0259n:")}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{tr("partnerprivacyscreen_profil_melumatlari_82c76c", "Profil mÉ™lumatlarÄ±")}</li>
                <li>{tr("untranslated_mesajlar_ak8wzw", "Mesajlar")}</li>
                <li>{tr("partnerprivacyscreen_tapsiriqlar_f5dbad", "TapÅŸÄ±rÄ±qlar")}</li>
                <li>{tr("partnerprivacyscreen_bildirisler_54eb88", "BildiriÅŸlÉ™r")}</li>
              </ul>
              {tr("partnerprivacyscreen_birdefelik_silinecek_d977cc", "bird\u0259f\u0259lik silin\u0259c\u0259k.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="flex-1 rounded-full">
              {tr("partnerprivacyscreen_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              className="flex-1 rounded-full"
              disabled={deleting}>

              {deleting ? 'Silinir...' : tr("partnerprivacyscreen_beli_sil_fd44c5", "B\u0259li, Sil")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default PartnerPrivacyScreen;
