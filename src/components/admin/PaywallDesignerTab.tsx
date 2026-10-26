import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Save, Plus, Trash2, Loader2, Crown, Palette, Type, MousePointer, FileText, Sparkles, icons } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usePaywallConfig, useUpdatePaywallConfig, getDefaultPaywallConfig, PaywallConfig } from '@/hooks/usePaywallConfig';

const PaywallDesignerTab = () => {
  const paywallConfig = usePaywallConfig();
  const { update, isPending } = useUpdatePaywallConfig();
  const { toast } = useToast();
  const [config, setConfig] = useState<PaywallConfig>(getDefaultPaywallConfig());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setConfig(paywallConfig);
  }, [JSON.stringify(paywallConfig)]);

  const updateField = <K extends keyof PaywallConfig,>(key: K, value: PaywallConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updatePill = (index: number, field: 'icon' | 'text', value: string) => {
    const newPills = [...config.pills];
    newPills[index] = { ...newPills[index], [field]: value };
    updateField('pills', newPills);
  };

  const addPill = () => {
    updateField('pills', [...config.pills, { icon: 'Star', text: 'Yeni' }]);
  };

  const removePill = (index: number) => {
    updateField('pills', config.pills.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      await update(config);
      toast({ title: tr("paywalldesignertab_paywall_konfiqurasiyasi_saxlanildi_50b3be", "Paywall konfiqurasiyası saxlanıldı ✓") });
      setHasChanges(false);
    } catch {
      toast({ title: tr("paywalldesignertab_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const handleReset = () => {
    setConfig(getDefaultPaywallConfig());
    setHasChanges(true);
  };

  const Section = ({ title, icon: Icon, children }: {title: string;icon: any;children: React.ReactNode;}) =>
  <div className="bg-card rounded-xl border p-4 space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </h4>
      {children}
    </div>;


  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          <Palette className="w-4 h-4 inline me-1 text-amber-500" />
          {tr("paywalldesignertab_premium_paywall_sehifesindeki__bf1e9e", "Premium Paywall s\u0259hif\u0259sind\u0259ki b\xFCt\xFCn m\u0259tnl\u0259ri, r\u0259ngl\u0259ri v\u0259 elementl\u0259ri buradan idar\u0259 edin.")}
        </p>
      </div>

      {/* Branding */}
      <Section title={tr("paywalldesignertab_basliq_ve_alt_basliq_238cd6", "Başlıq və Alt Başlıq")} icon={Type}>
        <div>
          <Label>{tr("paywalldesignertab_sehife_basligi_1ebf3e", "Səhifə Başlığı")}</Label>
          <Input value={config.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Anacan Premium" />
        </div>
        <div>
          <Label>{tr("paywalldesignertab_alt_basliq_eca856", "Alt Başlıq")}</Label>
          <Input value={config.subtitle} onChange={(e) => updateField('subtitle', e.target.value)} placeholder={tr("paywalldesignertab_tam_tecrube_sinirsiz_imkanlar_ce3376", "Tam təcrübə · Sınırsız imkanlar")} />
        </div>
      </Section>

      {/* Gradient Colors */}
      <Section title={tr("paywalldesignertab_gradient_rengleri_735bb0", "Gradient Rəngləri")} icon={Palette}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_baslangic_e9d2d5", "Başlanğıc")}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.gradient_from} onChange={(e) => updateField('gradient_from', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.gradient_from} onChange={(e) => updateField('gradient_from', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Orta</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.gradient_via} onChange={(e) => updateField('gradient_via', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.gradient_via} onChange={(e) => updateField('gradient_via', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Son</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.gradient_to} onChange={(e) => updateField('gradient_to', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.gradient_to} onChange={(e) => updateField('gradient_to', e.target.value)} className="text-xs" />
            </div>
          </div>
        </div>
        {/* Preview */}
        <div className="h-12 rounded-xl" style={{ background: `linear-gradient(to right, ${config.gradient_from}, ${config.gradient_via}, ${config.gradient_to})` }} />
      </Section>

      {/* Benefit Pills */}
      <Section title={tr("paywalldesignertab_ustunluk_etiketleri_c7e5cd", "Üstünlük Etiketləri")} icon={Sparkles}>
        <div className="space-y-2">
          {config.pills.map((pill, i) =>
          <div key={i} className="flex items-center gap-2">
              <Input value={pill.icon} onChange={(e) => updatePill(i, 'icon', e.target.value)} className="w-24" placeholder={tr("paywalldesignertab_icon_adi_4732b6", "Icon adı")} />
              <Input value={pill.text} onChange={(e) => updatePill(i, 'text', e.target.value)} className="flex-1" placeholder={tr("paywalldesignertab_metn_6e9f0f", "Mətn")} />
              <Button variant="ghost" size="icon" onClick={() => removePill(i)} className="shrink-0">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={addPill}>
            <Plus className="w-3 h-3 me-1" />{tr("paywalldesignertab_etiket_elave_et_4a65ae", "Etiket \u0259lav\u0259 et")}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">{tr("paywalldesignertab_ikon_adlari_zap_shield_sparkles_star_cro_7c0843", "İkon adları: Zap, Shield, Sparkles, Star, Crown, Heart və s. (Lucide icon adları)")}</p>
      </Section>

      {/* CTA Texts */}
      <Section title={tr("paywalldesignertab_duyme_metnleri_147868", "Düymə Mətnləri")} icon={MousePointer}>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_yeni_istifadeci_ucun_cta_57e7ac", "Yeni istifadəçi üçün CTA")}</Label>
            <Input value={config.cta_new_user} onChange={(e) => updateField('cta_new_user', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_yukseltme_cta_cb2fe8", "Yüksəltmə CTA")}</Label>
            <Input value={config.cta_upgrade} onChange={(e) => updateField('cta_upgrade', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_illik_plana_kecid_cta_012ee6", "İllik plana keçid CTA")}</Label>
            <Input value={config.cta_switch_yearly} onChange={(e) => updateField('cta_switch_yearly', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_emal_edilir_metni_dac759", "Emal edilir mətni")}</Label>
            <Input value={config.purchasing_text} onChange={(e) => updateField('purchasing_text', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Plan Labels */}
      <Section title={tr("paywalldesignertab_plan_etiketleri_c2eff6", "Plan Etiketləri")} icon={Crown}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_illik_etiket_03f813", "İllik etiket")}</Label>
            <Input value={config.yearly_label} onChange={(e) => updateField('yearly_label', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_ayliq_etiket_23a3b4", "Aylıq etiket")}</Label>
            <Input value={config.monthly_label} onChange={(e) => updateField('monthly_label', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_qenaet_badge_6dd374", "Qənaət badge")}</Label>
            <Input value={config.savings_badge} onChange={(e) => updateField('savings_badge', e.target.value)} placeholder={tr("paywalldesignertab_percent_qenaet_a627e2", "{percent}% Q\u018FNA\u018FT")} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_illik_suffix_1f7db0", "İllik suffix")}</Label>
            <Input value={config.yearly_suffix} onChange={(e) => updateField('yearly_suffix', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_ayliq_suffix_0f89ec", "Aylıq suffix")}</Label>
            <Input value={config.monthly_suffix} onChange={(e) => updateField('monthly_suffix', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_illik_cem_suffix_194e93", "İllik cəm suffix")}</Label>
            <Input value={config.yearly_total_suffix} onChange={(e) => updateField('yearly_total_suffix', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Footer & Legal */}
      <Section title={tr("paywalldesignertab_alt_hisse_ve_huquqi_681225", "Alt Hissə və Hüquqi")} icon={FileText}>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_funksiya_kilidi_metni_15f89a", "Funksiya kilidi mətni")}</Label>
            <Input value={config.feature_lock_text} onChange={(e) => updateField('feature_lock_text', e.target.value)} placeholder={tr("paywalldesignertab_feature_ucun_premium_lazimdir_4800ff", "{feature} \xFC\xE7\xFCn Premium laz\u0131md\u0131r")} />
            <p className="text-[10px] text-muted-foreground mt-0.5">{'{feature}'} {tr("paywalldesignertab_funksiya_adi_ile_evez_olunur_70a502", "\u2014 funksiya ad\u0131 il\u0259 \u0259v\u0259z olunur")}</p>
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_berpa_duymesi_1eaf2c", "Bərpa düyməsi")}</Label>
            <Input value={config.restore_text} onChange={(e) => updateField('restore_text', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{tr("paywalldesignertab_sertler_etiketi_dd82f1", "Şərtlər etiketi")}</Label>
              <Input value={config.terms_label} onChange={(e) => updateField('terms_label', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{tr("paywalldesignertab_mexfilik_etiketi_f9ae36", "Məxfilik etiketi")}</Label>
              <Input value={config.privacy_label} onChange={(e) => updateField('privacy_label', e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_legv_bildirisi_274b32", "Ləğv bildirişi")}</Label>
            <Input value={config.cancel_notice} onChange={(e) => updateField('cancel_notice', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("paywalldesignertab_app_store_bildirisi_native_olmayan_3b7186", "App Store bildirişi (native olmayan)")}</Label>
            <Input value={config.non_native_notice} onChange={(e) => updateField('non_native_notice', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Action buttons */}
      <div className="flex gap-2 sticky bottom-0 bg-background py-3 border-t">
        <Button variant="outline" className="flex-1" onClick={handleReset}>
          Defolt-a qaytar
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={isPending || !hasChanges}>
          {isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
          {isPending ? tr("paywalldesignertab_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : 'Saxla'}
        </Button>
      </div>
    </div>);

};

export default PaywallDesignerTab;