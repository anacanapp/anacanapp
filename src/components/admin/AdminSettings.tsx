import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Save, Key, Sparkles, Settings2, RefreshCw, Moon, Sun, Users, Baby } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AppSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
}

// NOT: `handleSave` əvvəllər `localSettings`-dəki HƏR açarı (yəni
// `app_settings` cədvəlində mövcud olan HƏR sətri, bu ekranın heç bir
// UI elementi olmasa belə) geri yazırdı — nəticədə: (1) başqa admin
// ekranlarının (AdminForceUpdate, AdminCommunity, AdminEpoint,
// AdminFlowContent və s.) bu komponent yükləndikdən SONRA etdiyi
// dəyişikliklər, bu ekranda əlaqəsiz bir "Yadda saxla" kliki ilə köhnə
// keşlənmiş dəyərə sıfırlanırdı; (2) `force_update` (JSONB obyekt) hər
// dəfə ikiqat JSON-encode olunaraq korlanırdı (`AdminForceUpdate.tsx`
// onu sadə string kimi geri oxuyurdu). İndi YALNIZ bu ekranın özünün
// idarə etdiyi açarlar yazılır.
const MANAGED_SETTING_KEYS = [
  'flow_mode_enabled',
  'bump_mode_enabled',
  'mommy_mode_enabled',
  'mommy_hero_variant',
  'dark_mode_enabled',
  'ai_model',
  'app_version',
  'maintenance_mode',
  'max_daily_logs',
] as const;

const aiModels = [
{ id: 'google/gemini-2.5-flash', name: tr("adminsettings_gemini_2_5_flash_tovsiyye_olunan_be1e47", "Gemini 2.5 Flash (Tövsiyyə olunan)") },
{ id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
{ id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
{ id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
{ id: 'openai/gpt-5', name: 'GPT-5' }];


const AdminSettings = () => {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.
      from('app_settings').
      select('*').
      order('key');

      if (error) throw error;

      setSettings(data || []);

      const settingsMap: Record<string, any> = {};
      data?.forEach((setting) => {
        // Parse JSON strings to actual values
        let value = setting.value;
        if (typeof value === 'string') {
          if (value === 'true') value = true;else
          if (value === 'false') value = false;else
          {
            try {
              value = JSON.parse(value);
            } catch {

              // Keep as string
            }}
        }
        settingsMap[setting.key] = value;
      });
      setLocalSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of MANAGED_SETTING_KEYS) {
        if (!(key in localSettings)) continue;
        const value = localSettings[key];
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        // Check if setting exists
        const existingSetting = settings.find((s) => s.key === key);

        if (existingSetting) {
          const { error } = await supabase.
          from('app_settings').
          update({ value: stringValue }).
          eq('key', key);
          if (error) throw error;
        } else {
          const { error } = await supabase.
          from('app_settings').
          insert({ key, value: stringValue });
          if (error) throw error;
        }
      }

      await fetchSettings();
      toast({
        title: tr("adminsettings_ugurlu_7fe64c", "Uğurlu"),
        description: tr("adminsettings_tenzimlemeler_yadda_saxlanildi_90a034", "T\u0259nziml\u0259m\u0259l\u0259r yadda saxlan\u0131ld\u0131")
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: tr("adminsettings_xeta_3cdbb6", "Xəta"),
        description: tr("adminsettings_tenzimlemeler_yadda_saxlanila_bilmedi_f9bdcb", "Tənzimləmələr yadda saxlanıla bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const getSettingValue = (key: string, defaultValue: any = null) => {
    const value = localSettings[key];
    if (value === undefined || value === null) return defaultValue;
    return value;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminsettings_tenzimlemeler_085659", "Tənzimləmələr")}</h1>
          <p className="text-muted-foreground">{tr("adminsettings_tetbiq_konfiqurasiyalarini_idare_edin_d01841", "Tətbiq konfiqurasiyalarını idarə edin")}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Yadda saxla
        </Button>
      </div>

      {loading ?
      <Card className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </Card> :

      <div className="grid gap-6">
          {/* Life Stage Settings */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}>
          
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tr("adminsettings_heyat_merheleleri_c9d7f6", "Həyat Mərhələləri")}</h3>
                  <p className="text-sm text-muted-foreground">{tr("adminsettings_qeydiyyat_zamani_gosterilecek_merheleler_0d58d9", "Qeydiyyat zamanı göstəriləcək mərhələlər")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-flow-light/50 dark:bg-flow-light">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🌸</span>
                    <div>
                      <label className="text-sm font-medium text-foreground">{tr("adminsettings_flow_dovr_izleme_92cd60", "Flow - Dövr İzləmə")}</label>
                      <p className="text-xs text-muted-foreground">
                        {tr("adminsettings_menstruasiya_izleme_rejimi_ee4973", "Menstruasiya izl\u0259m\u0259 rejimi")}
                      </p>
                    </div>
                  </div>
                  <Switch
                  checked={getSettingValue('flow_mode_enabled', true)}
                  onCheckedChange={(checked) => updateSetting('flow_mode_enabled', checked)} />
                
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-bump-light/50 dark:bg-bump-light">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🤰</span>
                    <div>
                      <label className="text-sm font-medium text-foreground">{tr("adminsettings_bump_hamilelik_de436a", "Bump - Hamiləlik")}</label>
                      <p className="text-xs text-muted-foreground">
                        {tr("adminsettings_hamilelik_izleme_rejimi_9a1d2f", "Hamil\u0259lik izl\u0259m\u0259 rejimi")}
                      </p>
                    </div>
                  </div>
                  <Switch
                  checked={getSettingValue('bump_mode_enabled', true)}
                  onCheckedChange={(checked) => updateSetting('bump_mode_enabled', checked)} />
                
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-mommy-light/50 dark:bg-mommy-light">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👶</span>
                    <div>
                      <label className="text-sm font-medium text-foreground">{tr("adminsettings_mommy_analiq_4d3d41", "Mommy - Analıq")}</label>
                      <p className="text-xs text-muted-foreground">
                        {tr("adminsettings_korpe_izleme_rejimi_af82ab", "K\xF6rp\u0259 izl\u0259m\u0259 rejimi")}
                      </p>
                    </div>
                  </div>
                  <Switch
                  checked={getSettingValue('mommy_mode_enabled', true)}
                  onCheckedChange={(checked) => updateSetting('mommy_mode_enabled', checked)} />
                
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Mommy Hero Variant */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}>
          
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-pink-500/10">
                  <Baby className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tr("adminsettings_mommy_hero_dizayni_603f42", "Mommy Hero Dizaynı")}</h3>
                  <p className="text-sm text-muted-foreground">{tr("adminsettings_mommy_panelinin_yuxari_sekilli_kartinin__a903d6", "Mommy panelinin yuxarı şəkilli kartının görünüşü")}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium mb-2 block text-foreground">Aktiv variant</label>
                <Select
                value={getSettingValue('mommy_hero_variant', 'classic')}
                onValueChange={(value) => updateSetting('mommy_hero_variant', value)}>
                
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">{tr("adminsettings_classic_coral_glassmorphism_movcud_8ff4ae", "Classic — Coral glassmorphism (mövcud)")}</SelectItem>
                    <SelectItem value="aurora">{tr("adminsettings_aurora_premium_tund_qizili_halqa_de8559", "Aurora — Premium tünd, qızılı halqa")}</SelectItem>
                    <SelectItem value="storybook">{tr("adminsettings_storybook_pastel_usaq_kitabi_stili_d21718", "Storybook — Pastel uşaq kitabı stili")}</SelectItem>
                    <SelectItem value="polaroid">{tr("adminsettings_polaroid_peanut_terzi_eyilmis_foto_washi_621108", "Polaroid — Peanut tərzi əyilmiş foto + washi")}</SelectItem>
                    <SelectItem value="minimal">{tr("adminsettings_minimal_card_flo_clue_ag_kart_statistika_1b051e", "Minimal Card — Flo/Clue ağ kart + statistika")}</SelectItem>
                    <SelectItem value="mesh">{tr("adminsettings_mesh_apple_vari_mesh_gradient_uzen_foto_081739", "Mesh — Apple-vari mesh gradient + üzən foto")}</SelectItem>
                    <SelectItem value="story">{tr("adminsettings_story_instagram_story_terzi_tam_ekran_5c22a0", "Story — Instagram story tərzi tam ekran")}</SelectItem>
                    <SelectItem value="bento">Bento — Apple bento qrid (foto + statistika)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {tr("adminsettings_deyisiklik_butun_istifadeciler_198453", "D\u0259yi\u015Fiklik b\xFCt\xFCn istifad\u0259\xE7il\u0259r \xFC\xE7\xFCn d\u0259rhal t\u0259tbiq olunur.")}
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Theme Settings */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}>
          
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Moon className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tr("adminsettings_tema_tenzimlemeleri_3033b7", "Tema Tənzimləmələri")}</h3>
                  <p className="text-sm text-muted-foreground">{tr("adminsettings_qaranliq_rejim_ve_gorunus_41b1f9", "Qaranlıq rejim və görünüş")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <Moon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">{tr("adminsettings_qaranliq_rejim_29c427", "Qaranlıq Rejim")}</label>
                      <p className="text-xs text-muted-foreground">
                        {tr("adminsettings_i_stifadeciler_qaranliq_rejimi_3acc5d", "\u0130stifad\u0259\xE7il\u0259r qaranl\u0131q rejimi aktiv ed\u0259 bilsin")}
                      </p>
                    </div>
                  </div>
                  <Switch
                  checked={getSettingValue('dark_mode_enabled', true)}
                  onCheckedChange={(checked) => updateSetting('dark_mode_enabled', checked)} />
                
                </div>
              </div>
            </Card>
          </motion.div>

          {/* AI Settings */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tr("adminsettings_ai_tenzimlemeleri_7d8f40", "AI Tənzimləmələri")}</h3>
                  <p className="text-sm text-muted-foreground">{tr("adminsettings_anacan_ai_modeli_ve_parametrleri_d1304d", "Anacan.AI modeli və parametrləri")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-foreground">AI Model</label>
                  <Select
                  value={getSettingValue('ai_model', 'google/gemini-2.5-flash')}
                  onValueChange={(value) => updateSetting('ai_model', value)}>
                  
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiModels.map((model) =>
                    <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tr("adminsettings_anacan_ai_chat_ucun_istifade_o_ea0c30", "Anacan.AI chat \xFC\xE7\xFCn istifad\u0259 olunan model")}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* App Settings */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}>
          
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Settings2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tr("adminsettings_tetbiq_tenzimlemeleri_75a82e", "Tətbiq Tənzimləmələri")}</h3>
                  <p className="text-sm text-muted-foreground">{tr("adminsettings_umumi_tetbiq_parametrleri_499e36", "Ümumi tətbiq parametrləri")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-foreground">{tr("adminsettings_tetbiq_versiyasi_9f0928", "Tətbiq Versiyası")}</label>
                  <Input
                  value={getSettingValue('app_version', '1.0.0')}
                  onChange={(e) => updateSetting('app_version', e.target.value)} />
                
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground">{tr("adminsettings_temir_rejimi_f48428", "Təmir Rejimi")}</label>
                    <p className="text-xs text-muted-foreground">
                      {tr("adminsettings_aktiv_olduqda_istifadeciler_te_8e0fc6", "Aktiv olduqda istifad\u0259\xE7il\u0259r t\u0259tbiq\u0259 daxil ola bilm\u0259z")}
                    </p>
                  </div>
                  <Switch
                  checked={getSettingValue('maintenance_mode', false)}
                  onCheckedChange={(checked) => updateSetting('maintenance_mode', checked)} />
                
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block text-foreground">{tr("adminsettings_maksimum_gunluk_qeyd_92e635", "Maksimum Günlük Qeyd")}</label>
                  <Input
                  type="number"
                  value={getSettingValue('max_daily_logs', 30)}
                  onChange={(e) => updateSetting('max_daily_logs', parseInt(e.target.value))} />
                
                  <p className="text-xs text-muted-foreground mt-1">
                    {tr("adminsettings_her_istifadeci_ucun_saxlanilac_bb7b78", "H\u0259r istifad\u0259\xE7i \xFC\xE7\xFCn saxlan\u0131lacaq maksimum g\xFCnl\xFCk qeyd say\u0131")}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* API Keys Info */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Key className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tr("adminsettings_api_acarlari_9a04ed", "API Açarları")}</h3>
                  <p className="text-sm text-muted-foreground">{tr("adminsettings_xarici_xidmet_inteqrasiyalari_e295ae", "Xarici xidmət inteqrasiyaları")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Lovable AI Gateway</p>
                      <p className="text-sm text-muted-foreground">{tr("adminsettings_ai_funksionalligi_ucun_d7ee26", "AI funksionallığı üçün")}</p>
                    </div>
                    <span className="text-sm text-green-500 font-medium">✓ Aktiv</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Supabase</p>
                      <p className="text-sm text-muted-foreground">{tr("adminsettings_database_ve_auth_d103d0", "Database və Auth")}</p>
                    </div>
                    <span className="text-sm text-green-500 font-medium">✓ Aktiv</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {tr("adminsettings_api_acarlari_tehlukesizlik_seb_38465b", "API a\xE7arlar\u0131 t\u0259hl\xFCk\u0259sizlik s\u0259b\u0259bind\u0259n burada g\xF6st\u0259rilmir. \n                  Yeni API a\xE7ar\u0131 \u0259lav\u0259 etm\u0259k \xFC\xE7\xFCn Edge Functions istifad\u0259 edin.")}
                
              </p>
              </div>
            </Card>
          </motion.div>
        </div>
      }
    </div>);

};

export default AdminSettings;