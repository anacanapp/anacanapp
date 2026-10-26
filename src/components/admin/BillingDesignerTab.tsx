import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Save, Plus, Trash2, Loader2, Crown, Palette, Type, MousePointer, FileText, Sparkles, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useBillingConfig, useUpdateBillingConfig, getDefaultBillingConfig, BillingConfig } from '@/hooks/usePaywallConfig';

const BillingDesignerTab = () => {
  const billingConfig = useBillingConfig();
  const { update, isPending } = useUpdateBillingConfig();
  const { toast } = useToast();
  const [config, setConfig] = useState<BillingConfig>(getDefaultBillingConfig());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setConfig(billingConfig);
  }, [JSON.stringify(billingConfig)]);

  const updateField = <K extends keyof BillingConfig,>(key: K, value: BillingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateFeature = (index: number, field: 'icon' | 'text', value: string) => {
    const newFeatures = [...config.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    updateField('features', newFeatures);
  };

  const addFeature = () => {
    updateField('features', [...config.features, { icon: 'Star', text: 'Yeni' }]);
  };

  const removeFeature = (index: number) => {
    updateField('features', config.features.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      await update(config);
      toast({ title: tr("billingdesignertab_abunelik_sehifesi_konfiqurasiyasi_saxlan_dfa67c", "Abunəlik səhifəsi konfiqurasiyası saxlanıldı ✓") });
      setHasChanges(false);
    } catch {
      toast({ title: tr("billingdesignertab_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const handleReset = () => {
    setConfig(getDefaultBillingConfig());
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
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          <CreditCard className="w-4 h-4 inline me-1 text-primary" />
          {tr("billingdesignertab_abuneliyim_sehifesindeki_butun_c8757d", "Abun\u0259liyim s\u0259hif\u0259sind\u0259ki b\xFCt\xFCn m\u0259tnl\u0259ri, r\u0259ngl\u0259ri v\u0259 elementl\u0259ri buradan idar\u0259 edin.")}
        </p>
      </div>

      {/* Header */}
      <Section title={tr("billingdesignertab_basliq_ve_plan_adlari_fb450b", "Başlıq və Plan Adları")} icon={Type}>
        <div>
          <Label>{tr("billingdesignertab_sehife_basligi_1ebf3e", "Səhifə Başlığı")}</Label>
          <Input value={config.page_title} onChange={(e) => updateField('page_title', e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">{tr("billingdesignertab_pulsuz_plan_adi_00a719", "Pulsuz plan adı")}</Label>
            <Input value={config.free_plan_name} onChange={(e) => updateField('free_plan_name', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_ayliq_plan_adi_74afd4", "Aylıq plan adı")}</Label>
            <Input value={config.premium_monthly_name} onChange={(e) => updateField('premium_monthly_name', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_illik_plan_adi_0fae97", "İllik plan adı")}</Label>
            <Input value={config.premium_yearly_name} onChange={(e) => updateField('premium_yearly_name', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Status Badges */}
      <Section title={tr("billingdesignertab_status_etiketleri_8906da", "Status Etiketləri")} icon={Crown}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Aktiv badge</Label>
            <Input value={config.active_badge} onChange={(e) => updateField('active_badge', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_legv_badge_e31165", "Ləğv badge")}</Label>
            <Input value={config.cancelled_badge} onChange={(e) => updateField('cancelled_badge', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Date Labels */}
      <Section title={tr("billingdesignertab_tarix_etiketleri_ce8135", "Tarix Etiketləri")} icon={FileText}>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">{tr("billingdesignertab_baslama_9f32b6", "Başlama")}</Label>
            <Input value={config.start_date_label} onChange={(e) => updateField('start_date_label', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_yenilenme_8e3032", "Yenilənmə")}</Label>
            <Input value={config.renewal_label} onChange={(e) => updateField('renewal_label', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_bitme_f6de2a", "Bitmə")}</Label>
            <Input value={config.expiry_label} onChange={(e) => updateField('expiry_label', e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">{tr("billingdesignertab_legv_bildirisi_274b32", "Ləğv bildirişi")}</Label>
          <Input value={config.cancelled_notice} onChange={(e) => updateField('cancelled_notice', e.target.value)} />
          <p className="text-[10px] text-muted-foreground mt-0.5">{'{date}'} {tr("billingdesignertab_tarix_ile_evez_olunur_91289b", "\u2014 tarix il\u0259 \u0259v\u0259z olunur")}</p>
        </div>
      </Section>

      {/* Features */}
      <Section title={tr("billingdesignertab_ustunlukler_6e0ad9", "Üstünlüklər")} icon={Sparkles}>
        <div>
          <Label className="text-xs">{tr("billingdesignertab_bolme_basligi_a972ec", "Bölmə başlığı")}</Label>
          <Input value={config.features_title} onChange={(e) => updateField('features_title', e.target.value)} />
        </div>
        <div className="space-y-2">
          {config.features.map((feat, i) =>
          <div key={i} className="flex items-center gap-2">
              <Input value={feat.icon} onChange={(e) => updateFeature(i, 'icon', e.target.value)} className="w-24" placeholder="Icon" />
              <Input value={feat.text} onChange={(e) => updateFeature(i, 'text', e.target.value)} className="flex-1" placeholder={tr("billingdesignertab_metn_6e9f0f", "Mətn")} />
              <Button variant="ghost" size="icon" onClick={() => removeFeature(i)} className="shrink-0">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={addFeature}>
            <Plus className="w-3 h-3 me-1" />{tr("billingdesignertab_elave_et_6e1b9b", "\u018Flav\u0259 et")}
          </Button>
        </div>
      </Section>

      {/* CTA Buttons */}
      <Section title={tr("billingdesignertab_duyme_metnleri_147868", "Düymə Mətnləri")} icon={MousePointer}>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{tr("billingdesignertab_yukseltme_cta_cb2fe8", "Yüksəltmə CTA")}</Label>
              <Input value={config.upgrade_cta} onChange={(e) => updateField('upgrade_cta', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{tr("billingdesignertab_qenaet_metni_17412a", "Qənaət mətni")}</Label>
              <Input value={config.upgrade_savings} onChange={(e) => updateField('upgrade_savings', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{tr("billingdesignertab_berpa_cta_7a62cb", "Bərpa CTA")}</Label>
              <Input value={config.restore_cta} onChange={(e) => updateField('restore_cta', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{tr("billingdesignertab_legv_cta_d2b58c", "Ləğv CTA")}</Label>
              <Input value={config.cancel_cta} onChange={(e) => updateField('cancel_cta', e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_premium_a_kec_cta_482f4d", "Premium-a keç CTA")}</Label>
            <Input value={config.get_premium_cta} onChange={(e) => updateField('get_premium_cta', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Payment & Support */}
      <Section title={tr("billingdesignertab_odenis_ve_destek_9e9d73", "Ödəniş və Dəstək")} icon={CreditCard}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr("billingdesignertab_odenis_basligi_a9eb1c", "Ödəniş başlığı")}</Label>
            <Input value={config.payment_title} onChange={(e) => updateField('payment_title', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_odenildi_metni_b47c40", "Ödənildi mətni")}</Label>
            <Input value={config.paid_label} onChange={(e) => updateField('paid_label', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{tr("billingdesignertab_destek_metni_2cc9d9", "Dəstək mətni")}</Label>
            <Input value={config.support_text} onChange={(e) => updateField('support_text', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{tr("billingdesignertab_destek_email_207ed0", "Dəstək email")}</Label>
            <Input value={config.support_email} onChange={(e) => updateField('support_email', e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Gradient Colors */}
      <Section title={tr("billingdesignertab_header_rengleri_66cc09", "Header Rəngləri")} icon={Palette}>
        <p className="text-xs text-muted-foreground mb-2">{tr("billingdesignertab_premium_istifadeci_ucun_ac15a0", "Premium istifadəçi üçün")}</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{tr("billingdesignertab_baslangic_e9d2d5", "Başlanğıc")}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.header_gradient_from} onChange={(e) => updateField('header_gradient_from', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.header_gradient_from} onChange={(e) => updateField('header_gradient_from', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Orta</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.header_gradient_via} onChange={(e) => updateField('header_gradient_via', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.header_gradient_via} onChange={(e) => updateField('header_gradient_via', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Son</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.header_gradient_to} onChange={(e) => updateField('header_gradient_to', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.header_gradient_to} onChange={(e) => updateField('header_gradient_to', e.target.value)} className="text-xs" />
            </div>
          </div>
        </div>
        <div className="h-10 rounded-xl" style={{ background: `linear-gradient(to right, ${config.header_gradient_from}, ${config.header_gradient_via}, ${config.header_gradient_to})` }} />

        <p className="text-xs text-muted-foreground mb-2 mt-3">{tr("billingdesignertab_pulsuz_istifadeci_ucun_80ea44", "Pulsuz istifadəçi üçün")}</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{tr("billingdesignertab_baslangic_e9d2d5", "Başlanğıc")}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.header_free_from} onChange={(e) => updateField('header_free_from', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.header_free_from} onChange={(e) => updateField('header_free_from', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Orta</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.header_free_via} onChange={(e) => updateField('header_free_via', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.header_free_via} onChange={(e) => updateField('header_free_via', e.target.value)} className="text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Son</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.header_free_to} onChange={(e) => updateField('header_free_to', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={config.header_free_to} onChange={(e) => updateField('header_free_to', e.target.value)} className="text-xs" />
            </div>
          </div>
        </div>
        <div className="h-10 rounded-xl" style={{ background: `linear-gradient(to right, ${config.header_free_from}, ${config.header_free_via}, ${config.header_free_to})` }} />
      </Section>

      {/* Action buttons */}
      <div className="flex gap-2 sticky bottom-0 bg-background py-3 border-t">
        <Button variant="outline" className="flex-1" onClick={handleReset}>
          Defolt-a qaytar
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={isPending || !hasChanges}>
          {isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
          {isPending ? tr("billingdesignertab_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : 'Saxla'}
        </Button>
      </div>
    </div>);

};

export default BillingDesignerTab;