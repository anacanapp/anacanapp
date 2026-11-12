import { useEffect, useMemo, useState } from 'react';
import { Baby, Key, Moon, RefreshCw, Save, Settings2, Smartphone, Sparkles, Users } from 'lucide-react';
import { tr } from '@/lib/tr';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminTabs, Btn, Field, Notice, Page, PageHeader, Section, SettingRow, SkeletonRows, StatusPill } from './kit';
import AdminAptekSettings from './AdminAptekSettings';
import { requestTourPreview } from '@/lib/onboardingTour';
import { fromBakuInput, parseRecapConfig, recapOpen, toBakuInput, type RecapConfig } from '@/lib/recap/window';

interface AppSetting { id: string; key: string; value: any; description: string | null }

// NOT: `handleSave` əvvəllər `localSettings`-dəki HƏR açarı (yəni `app_settings` cədvəlində mövcud olan HƏR sətri)
// geri yazırdı — nəticədə başqa admin ekranlarının dəyişiklikləri köhnə keşlənmiş dəyərə sıfırlanırdı və `force_update`
// ikiqat JSON-encode olunurdu. İndi YALNIZ bu ekranın özünün idarə etdiyi açarlar yazılır.
const MANAGED_SETTING_KEYS = [
  'flow_mode_enabled', 'bump_mode_enabled', 'mommy_mode_enabled', 'mommy_hero_variant', 'bottom_nav_style', 'profile_layout', 'inapp_onboarding', 'weaning_tool', 'parenting_tool', 'dashboard_stories', 'recap_2026',
  'dark_mode_enabled', 'ai_model', 'app_version', 'maintenance_mode', 'max_daily_logs',
] as const;

const aiModels = [
  { id: 'google/gemini-2.5-flash', name: tr('adminsettings_gemini_2_5_flash_tovsiyye_olunan_be1e47', 'Gemini 2.5 Flash (Tövsiyyə olunan)') }, { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' }, { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' }, { id: 'openai/gpt-5', name: 'GPT-5' },
];
const HERO_VARIANTS = [
  ['classic', tr('adminsettings_classic_coral_glassmorphism_movcud_8ff4ae', 'Classic — Coral glassmorphism (mövcud)')], ['aurora', tr('adminsettings_aurora_premium_tund_qizili_halqa_de8559', 'Aurora — Premium tünd, qızılı halqa')],
  ['storybook', tr('adminsettings_storybook_pastel_usaq_kitabi_stili_d21718', 'Storybook — Pastel uşaq kitabı stili')], ['polaroid', tr('adminsettings_polaroid_peanut_terzi_eyilmis_foto_washi_621108', 'Polaroid — Peanut tərzi əyilmiş foto + washi')],
  ['minimal', tr('adminsettings_minimal_card_flo_clue_ag_kart_statistika_1b051e', 'Minimal Card — Flo/Clue ağ kart + statistika')], ['mesh', tr('adminsettings_mesh_apple_vari_mesh_gradient_uzen_foto_081739', 'Mesh — Apple-vari mesh gradient + üzən foto')],
  ['story', tr('adminsettings_story_instagram_story_terzi_tam_ekran_5c22a0', 'Story — Instagram story tərzi tam ekran')], ['bento', 'Bento — Apple bento qrid (foto + statistika)'],
];
type Tab = 'app' | 'aptek' | 'system';

const AdminSettings = () => {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({}), [savedSettings, setSavedSettings] = useState<Record<string, any>>({});
  const [tab, setTab] = useState<Tab>('app');
  const { toast } = useToast();

  useEffect(() => { void fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('*').order('key');
      if (error) throw error;
      setSettings(data || []);
      const settingsMap: Record<string, any> = {};
      data?.forEach(setting => {
        // Parse JSON strings to actual values
        let value = setting.value;
        if (typeof value === 'string') {
          if (value === 'true') value = true; else if (value === 'false') value = false;
          else { try { value = JSON.parse(value); } catch { /* Keep as string */ } }
        }
        settingsMap[setting.key] = value;
      });
      setLocalSettings(settingsMap); setSavedSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of MANAGED_SETTING_KEYS) {
        if (!(key in localSettings)) continue;
        const value = localSettings[key];
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        // Check if setting exists
        const existingSetting = settings.find(setting => setting.key === key);
        if (existingSetting) {
          const { error } = await supabase.from('app_settings').update({ value: stringValue }).eq('key', key);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('app_settings').insert({ key, value: stringValue });
          if (error) throw error;
        }
      }
      await fetchSettings();
      toast({ title: tr('adminsettings_ugurlu_7fe64c', 'Uğurlu'), description: tr('adminsettings_tenzimlemeler_yadda_saxlanildi_90a034', 'Tənzimləmələr yadda saxlanıldı') });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: tr('adminsettings_xeta_3cdbb6', 'Xəta'), description: tr('adminsettings_tenzimlemeler_yadda_saxlanila_bilmedi_f9bdcb', 'Tənzimləmələr yadda saxlanıla bilmədi'), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const updateSetting = (key: string, value: any) => setLocalSettings(prev => ({ ...prev, [key]: value }));
  const getSettingValue = (key: string, defaultValue: any = null) => { const value = localSettings[key]; return value === undefined || value === null ? defaultValue : value; };
  const changed = useMemo(() => MANAGED_SETTING_KEYS.filter(key => JSON.stringify(localSettings[key]) !== JSON.stringify(savedSettings[key])), [localSettings, savedSettings]);
  const select = (key: string, fallback: string, options: Array<[string, string]>, label: string) => (
    <select className="ak-select" aria-label={label} style={{ minWidth: 220 }} value={getSettingValue(key, fallback)} onChange={event => updateSetting(key, event.target.value)}>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  );
  const toggle = (key: string, fallback: boolean, label: string) => <Switch checked={getSettingValue(key, fallback)} onCheckedChange={checked => updateSetting(key, checked)} aria-label={label} />;

  const saveButton = <Btn variant="primary" onClick={() => void handleSave()} disabled={saving || loading || !changed.length}>{saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}Yadda saxla{changed.length ? ` (${changed.length})` : ''}</Btn>;

  return (
    <Page testId="admin-settings">
      <PageHeader title={tr('adminsettings_tenzimlemeler_085659', 'Tənzimləmələr')} subtitle={tr('adminsettings_tetbiq_konfiqurasiyalarini_idare_edin_d01841', 'Tətbiq konfiqurasiyalarını idarə edin')}
        meta={changed.length > 0 && <StatusPill tone="warning">Yadda saxlanmayıb</StatusPill>} actions={tab !== 'aptek' && saveButton} />
      <AdminTabs value={tab} onChange={setTab} items={[{ value: 'app', label: 'Tətbiq' }, { value: 'aptek', label: 'Anacan Aptek' }, { value: 'system', label: 'Sistem və AI' }]} />
      {loading ? <Section><SkeletonRows rows={6} columns={2} /></Section> : (
        <>
          {tab === 'aptek' && <AdminAptekSettings />}
          {tab === 'app' && (
            <div className="ak-grid ak-grid-2">
              <Section title={<span className="flex items-center gap-2"><Users size={15} />{tr('adminsettings_heyat_merheleleri_c9d7f6', 'Həyat Mərhələləri')}</span>} description={tr('adminsettings_qeydiyyat_zamani_gosterilecek_merheleler_0d58d9', 'Qeydiyyat zamanı göstəriləcək mərhələlər')}>
                <SettingRow icon="🌸" title={tr('adminsettings_flow_dovr_izleme_92cd60', 'Flow - Dövr İzləmə')} description={tr('adminsettings_menstruasiya_izleme_rejimi_ee4973', 'Menstruasiya izləmə rejimi')} control={toggle('flow_mode_enabled', true, 'Flow')} />
                <SettingRow icon="🤰" title={tr('adminsettings_bump_hamilelik_de436a', 'Bump - Hamiləlik')} description={tr('adminsettings_hamilelik_izleme_rejimi_9a1d2f', 'Hamiləlik izləmə rejimi')} control={toggle('bump_mode_enabled', true, 'Bump')} />
                <SettingRow icon="👶" title={tr('adminsettings_mommy_analiq_4d3d41', 'Mommy - Analıq')} description={tr('adminsettings_korpe_izleme_rejimi_af82ab', 'Körpə izləmə rejimi')} control={toggle('mommy_mode_enabled', true, 'Mommy')} />
              </Section>
              <Section title={<span className="flex items-center gap-2"><Sparkles size={15} />Anacan Recap 2026</span>} description="Tarixlər Bakı vaxtı ilədir. Adminlər də hamı ilə eyni tarixdə görür; adminlər üçün ayrıca tarix yazsanız, adminlər o tarixlə görür.">
                {(() => {
                  const cfg = parseRecapConfig(getSettingValue('recap_2026', {}));
                  const set = (patch: Partial<RecapConfig>) => updateSetting('recap_2026', { ...cfg, ...patch });
                  const date = (key: keyof RecapConfig, label: string, hint?: string) => (
                    <Field label={label} hint={hint}>{id => (
                      <div className="flex gap-2">
                        <input id={id} type="datetime-local" className="ak-input w-full" value={toBakuInput(cfg[key] as string | null)}
                          onChange={event => set({ [key]: fromBakuInput(event.target.value) } as Partial<RecapConfig>)} />
                        {cfg[key] && key.startsWith('admin_') && <Btn size="sm" onClick={() => set({ [key]: null } as Partial<RecapConfig>)}>Sil</Btn>}
                      </div>)}</Field>
                  );
                  return (
                    <div className="grid gap-3">
                      <SettingRow title="Recap aktivdir" description="Söndürülsə, heç kim (adminlər də) görmür." control={<Switch checked={!!cfg.enabled} onCheckedChange={checked => set({ enabled: checked })} aria-label="Recap aktiv" />} />
                      {date('start_at', 'Hamı üçün: başlama')}
                      {date('end_at', 'Hamı üçün: bitmə')}
                      {date('admin_start_at', 'Adminlər üçün: başlama', 'Boş qalsa, adminlər hamı ilə eyni tarixdə görür.')}
                      {date('admin_end_at', 'Adminlər üçün: bitmə', 'Boş qalsa, hamı üçün olan bitmə tarixi işləyir.')}
                      <Notice tone="info">İndi: istifadəçilər üçün {recapOpen(cfg, false) ? 'açıqdır' : 'bağlıdır'}, adminlər üçün {recapOpen(cfg, true) ? 'açıqdır' : 'bağlıdır'}.</Notice>
                    </div>
                  );
                })()}
              </Section>
              <Section title={<span className="flex items-center gap-2"><Smartphone size={15} />Görünüş və təcrübələr</span>} description="Yadda saxlayandan sonra istifadəçilərdə tətbiq yenidən açılanda və ya 5 dəqiqə ərzində dəyişir.">
                <SettingRow icon={<Baby size={16} />} title={tr('adminsettings_mommy_hero_dizayni_603f42', 'Mommy Hero Dizaynı')} description={tr('adminsettings_deyisiklik_butun_istifadeciler_198453', 'Dəyişiklik bütün istifadəçilər üçün dərhal tətbiq olunur.')}
                  control={select('mommy_hero_variant', 'classic', HERO_VARIANTS as Array<[string, string]>, 'Mommy Hero')} />
                <SettingRow title="Alt menyu stili" control={select('bottom_nav_style', 'capsule', [['capsule', 'Üzən kapsul (test)'], ['classic', 'Klassik (əvvəlki)']], 'Alt menyu stili')} />
                <SettingRow title="Profil görünüşü" control={select('profile_layout', 'tabs', [['tabs', 'Tablı: Mən · Ailə · Ayarlar'], ['classic', 'Klassik (əvvəlki uzun səhifə)']], 'Profil görünüşü')} />
                <SettingRow title="Tətbiqdaxili onboarding turu (Glass)" description="Yalnız funksiya əlavə olunandan sonra qeydiyyatdan keçən, hesabı 14 gündən gənc hesablar görür. Hər istifadəçi turu bir dəfə görür."
                  control={select('inapp_onboarding', 'off', [['on', 'Aktiv: yeni istifadəçilərə ilk açılışda'], ['off', 'Söndürülüb']], 'Onboarding turu')} />
                <SettingRow title="Story-lər (ana səhifə)" description="Instagram tipli qısa hekayələr, Azərbaycan dilində. 'Yalnız admin' rejimində yalnız admin hesabları görür; 'Hamıya' seçəndə bütün az dilli istifadəçilərə açılır."
                  control={select('dashboard_stories', 'admin', [['admin', 'Yalnız admin (test)'], ['on', 'Hamıya açıq'], ['off', 'Söndürülüb']], 'Story-lər')} />
                <SettingRow title="Turu sınaqla (yalnız admin)" description="Turu indi bu hesabda açır. Açardan, hesabın yaşından və 'artıq görüb' qeydindən asılı deyil, heç nə yadda saxlanmır. İstədiyiniz qədər təkrarlaya bilərsiniz."
                  control={<div className="flex gap-2">
                    <Btn size="sm" onClick={() => requestTourPreview(false)}>Free kimi</Btn>
                    <Btn size="sm" variant="primary" onClick={() => requestTourPreview(true)}>Premium kimi</Btn>
                  </div>} />
                <SettingRow title="Süddən ayırma aləti" description="Plan yalnız 12+ aylıq uşaq üçün qurulur. Bələdçi və check-in pulsuz, fərdi təqvim və xatırlatmalar Premium-dur."
                  control={select('weaning_tool', 'off', [['on', 'Aktiv: Ana modulunda, 9+ ay'], ['off', 'Söndürülüb']], 'Süddən ayırma')} />
                <SettingRow title="Tərbiyə aləti" description="Elmə əsaslanan pozitiv tərbiyə (0–12 yaş). Yalnız Azərbaycan dilində və Ana modulunda görünür. 2026-11-09-dan tam Premium-dur: yalnız Premium istifadəçilər (və Premium ailənin partnyoru) açır, ana səhifə kartı və xatırlatmalar da yalnız Premium-dadır."
                  control={select('parenting_tool', 'off', [['on', 'Aktiv: Ana modulunda, az dili'], ['off', 'Söndürülüb']], 'Tərbiyə')} />
                <SettingRow icon={<Moon size={16} />} title={tr('adminsettings_qaranliq_rejim_29c427', 'Qaranlıq Rejim')} description={tr('adminsettings_i_stifadeciler_qaranliq_rejimi_3acc5d', 'İstifadəçilər qaranlıq rejimi aktiv edə bilsin')} control={toggle('dark_mode_enabled', true, 'Qaranlıq rejim')} />
              </Section>
            </div>
          )}
          {tab === 'system' && (
            <div className="ak-grid ak-grid-2">
              <Section title={<span className="flex items-center gap-2"><Sparkles size={15} />{tr('adminsettings_ai_tenzimlemeleri_7d8f40', 'AI Tənzimləmələri')}</span>} description={tr('adminsettings_anacan_ai_modeli_ve_parametrleri_d1304d', 'Anacan.AI modeli və parametrləri')}>
                <Field label="AI Model" hint={tr('adminsettings_anacan_ai_chat_ucun_istifade_o_ea0c30', 'Anacan.AI chat üçün istifadə olunan model')}>{id => (
                  <select id={id} className="ak-select w-full" value={getSettingValue('ai_model', 'google/gemini-2.5-flash')} onChange={event => updateSetting('ai_model', event.target.value)}>
                    {aiModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select>)}</Field>
              </Section>
              <Section title={<span className="flex items-center gap-2"><Settings2 size={15} />{tr('adminsettings_tetbiq_tenzimlemeleri_75a82e', 'Tətbiq Tənzimləmələri')}</span>} description={tr('adminsettings_umumi_tetbiq_parametrleri_499e36', 'Ümumi tətbiq parametrləri')}>
                <div className="grid gap-3">
                  <Field label={tr('adminsettings_tetbiq_versiyasi_9f0928', 'Tətbiq Versiyası')}>{id => <input id={id} className="ak-input" value={getSettingValue('app_version', '1.0.0')} onChange={event => updateSetting('app_version', event.target.value)} />}</Field>
                  <SettingRow title={tr('adminsettings_temir_rejimi_f48428', 'Təmir Rejimi')} description={tr('adminsettings_aktiv_olduqda_istifadeciler_te_8e0fc6', 'Aktiv olduqda istifadəçilər tətbiqə daxil ola bilməz')} control={toggle('maintenance_mode', false, 'Təmir rejimi')} />
                  {getSettingValue('maintenance_mode', false) && <Notice tone="warning">Təmir rejimi aktiv olanda istifadəçilər tətbiqə daxil ola bilmir.</Notice>}
                  <Field label={tr('adminsettings_maksimum_gunluk_qeyd_92e635', 'Maksimum Günlük Qeyd')} hint={tr('adminsettings_her_istifadeci_ucun_saxlanilac_bb7b78', 'Hər istifadəçi üçün saxlanılacaq maksimum günlük qeyd sayı')}>{id => (
                    <input id={id} className="ak-input" type="number" value={getSettingValue('max_daily_logs', 30)} onChange={event => updateSetting('max_daily_logs', parseInt(event.target.value))} />)}</Field>
                </div>
              </Section>
              <Section title={<span className="flex items-center gap-2"><Key size={15} />{tr('adminsettings_api_acarlari_9a04ed', 'API Açarları')}</span>} description={tr('adminsettings_xarici_xidmet_inteqrasiyalari_e295ae', 'Xarici xidmət inteqrasiyaları')}>
                <SettingRow title="Lovable AI Gateway" description={tr('adminsettings_ai_funksionalligi_ucun_d7ee26', 'AI funksionallığı üçün')} control={<StatusPill tone="success">Aktiv</StatusPill>} />
                <SettingRow title="Supabase" description={tr('adminsettings_database_ve_auth_d103d0', 'Database və Auth')} control={<StatusPill tone="success">Aktiv</StatusPill>} />
                <p className="ak-hint mt-2">{tr('adminsettings_api_acarlari_tehlukesizlik_seb_38465b', 'API açarları təhlükəsizlik səbəbindən burada göstərilmir. Yeni API açarı əlavə etmək üçün Edge Functions istifadə edin.')}</p>
              </Section>
            </div>
          )}
          {tab !== 'aptek' && changed.length > 0 && <div className="flex justify-end">{saveButton}</div>}
        </>
      )}
    </Page>
  );
};

export default AdminSettings;
