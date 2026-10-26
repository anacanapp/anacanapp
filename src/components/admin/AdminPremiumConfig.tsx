import { useState, useRef, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Crown, Save, X, Check, Minus, Search, Users, Settings2, Shield, Loader2, ChevronDown, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAdminPremiumConfig, PremiumFeature, PremiumPlan } from '@/hooks/usePremiumConfig';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';
import { supabase } from '@/integrations/supabase/client';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import PaywallDesignerTab from './PaywallDesignerTab';
import BillingDesignerTab from './BillingDesignerTab';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

// =========== FREE LIMITS TAB ===========
const FreeLimitsTab = () => {
  const { data: settings = [], isLoading } = useAppSettings();
  const updateSetting = useUpdateAppSetting();
  const { toast } = useToast();

  const freeLimitsSetting = settings.find((s) => s.key === 'free_limits');
  const currentLimits = freeLimitsSetting?.value ?
  typeof freeLimitsSetting.value === 'string' ? JSON.parse(freeLimitsSetting.value) : freeLimitsSetting.value :
  {};

  const [limits, setLimits] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentLimits && Object.keys(currentLimits).length > 0) {
      setLimits(currentLimits);
    }
  }, [JSON.stringify(currentLimits)]);

  const limitFields = [
  { key: 'white_noise_seconds_per_day', label: tr("adminpremiumconfig_ag_ses_saniye_gun_712254", "Ağ Səs (saniyə/gün)"), icon: '🎵', suffix: tr("adminpremiumconfig_saniye_8e81c5", "saniy\u0259"), divider: 60, displaySuffix: tr("adminpremiumconfig_deqiqe_94641a", "d\u0259qiq\u0259") },
  { key: 'baby_photoshoot_count', label: tr("adminpremiumconfig_korpe_fotosessiya_umumi_c50d97", "Körpə Fotosessiya (ümumi)"), icon: '📸', suffix: 'foto' },
  { key: 'fairy_tale_count_per_day', label: tr("adminpremiumconfig_nagil_generatoru_gun_limit_29493d", "Nağıl Generatoru (gün/limit)"), icon: '📖', suffix: tr("adminpremiumconfig_nagil_b2cf26", "na\u011F\u0131l") },
  { key: 'ai_chat_count_per_day', label: tr("adminpremiumconfig_ai_cat_mesajlari_gun_limit_28be66", "AI Çat Mesajları (gün/limit)"), icon: '🤖', suffix: 'mesaj' },
  { key: 'cry_translator_count_per_day', label: tr("adminpremiumconfig_aglama_analizi_gun_limit_5b5f48", "Ağlama analizi (gün/limit)"), icon: '👶', suffix: 'analiz' },
  { key: 'poop_scanner_count_per_day', label: tr("adminpremiumconfig_necis_skaneri_gun_limit_9b3a23", "Nəcis Skaneri (gün/limit)"), icon: '💩', suffix: 'skan' },
  { key: 'horoscope_count_per_day', label: tr("adminpremiumconfig_ulduz_fali_gun_limit_5c95cd", "Ulduz Falı (gün/limit)"), icon: '⭐', suffix: tr("adminpremiumconfig_sorgu_260df7", "sor\u011Fu") }];


  const handleSave = async () => {
    try {
      await updateSetting.mutateAsync({ key: 'free_limits', value: limits });
      toast({ title: tr("adminpremiumconfig_limitler_yenilendi_9766c3", "Limitlər yeniləndi ✓") });
      setHasChanges(false);
    } catch {
      toast({ title: tr("adminpremiumconfig_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          <Settings2 className="w-4 h-4 inline me-1" />
          {tr("adminpremiumconfig_pulsuz_istifadeciler_ucun_gund_2c9784", "Pulsuz istifad\u0259\xE7il\u0259r \xFC\xE7\xFCn g\xFCnd\u0259lik limitl\u0259ri burada t\u0259nziml\u0259yin. D\u0259yi\u015Fiklikl\u0259r d\u0259rhal t\u0259tbiq olunur.")}
        </p>
      </div>

      <div className="grid gap-4">
        {limitFields.map((field) =>
        <div key={field.key} className="flex items-center justify-between p-4 bg-card rounded-xl border">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{field.icon}</span>
              <div>
                <p className="font-medium text-sm">{field.label}</p>
                {field.divider &&
              <p className="text-xs text-muted-foreground">
                    = {Math.round((limits[field.key] || 0) / field.divider)} {field.displaySuffix}
                  </p>
              }
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
              type="number"
              value={limits[field.key] || 0}
              onChange={(e) => {
                setLimits({ ...limits, [field.key]: parseInt(e.target.value) || 0 });
                setHasChanges(true);
              }}
              className="w-24 text-center" />
            
              <span className="text-xs text-muted-foreground w-14">{field.suffix}</span>
            </div>
          </div>
        )}
      </div>

      {hasChanges &&
      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Button onClick={handleSave} className="w-full" disabled={updateSetting.isPending}>
            <Save className="w-4 h-4 me-2" />
            {updateSetting.isPending ? tr("adminpremiumconfig_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : tr("adminpremiumconfig_limitleri_saxla_0ed386", "Limitl\u0259ri Saxla")}
          </Button>
        </motion.div>
      }
    </div>);

};

// =========== USER SUBSCRIPTIONS TAB ===========
interface UserSub {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  name?: string;
  email?: string;
  is_premium?: boolean;
}

const UserSubscriptionsTab = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserSub[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSub | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ plan_type: 'free', status: 'active', is_premium: false });

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      // Search profiles by name or email
      const { data: profiles, error } = await supabase.
      from('profiles').
      select('user_id, name, email, is_premium').
      or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`).
      limit(20);

      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Get subscriptions for found users
      const userIds = profiles.map((p) => p.user_id);
      const { data: subs } = await supabase.
      from('subscriptions').
      select('*').
      in('user_id', userIds);

      const results: UserSub[] = profiles.map((p) => {
        const sub = subs?.find((s) => s.user_id === p.user_id);
        return {
          id: sub?.id || '',
          user_id: p.user_id,
          plan_type: sub?.plan_type || 'free',
          status: sub?.status || 'active',
          started_at: sub?.started_at || '',
          expires_at: sub?.expires_at || null,
          name: p.name || tr("adminpremiumconfig_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
          email: p.email || '',
          is_premium: p.is_premium || false
        };
      });

      setUsers(results);
    } catch (error) {
      console.error('Search error:', error);
      toast({ title: tr("adminpremiumconfig_axtaris_xetasi_cd56b0", "Axtarış xətası"), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: UserSub) => {
    setEditingUser(user);
    setEditForm({
      plan_type: user.plan_type,
      status: user.status,
      is_premium: user.is_premium || false
    });
    setShowEditModal(true);
  };

  // NOT: Bu ekran birbaşa `subscriptions` cədvəlinə yazmır — Duzelis33.sql
  // həmin cədvəldən INSERT/UPDATE-i `authenticated` roluna görə TAMAMILƏ
  // REVOKE edib (fraud-qorunma), admin daxil olmaqla. Real dəyişiklik yalnız
  // `admin-set-subscription` edge function (service-role, admin-only) ilə
  // aparılır — bax orada tam izahat.
  const [savingUser, setSavingUser] = useState(false);

  const applySubscriptionChange = async (targetUserId: string, planType: string, status: string) => {
    const { data, error } = await supabase.functions.invoke('admin-set-subscription', {
      body: { targetUserId, planType, status }
    });
    if (error || (data as any)?.error) {
      throw new Error((data as any)?.error || error?.message || 'Naməlum xəta');
    }
    return data;
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      await applySubscriptionChange(editingUser.user_id, editForm.plan_type, editForm.status);
      toast({ title: tr("adminpremiumconfig_istifadeci_yenilendi_3ecf1e", "İstifadəçi yeniləndi ✓") });
      setShowEditModal(false);
      searchUsers(); // Refresh
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: tr("adminpremiumconfig_xeta_bas_verdi_f22fba", "Xəta baş verdi"), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSavingUser(false);
    }
  };

  const quickTogglePremium = async (user: UserSub) => {
    const newPremium = !user.is_premium;
    const newPlan = newPremium ? 'premium' : 'free';

    try {
      await applySubscriptionChange(user.user_id, newPlan, 'active');
      toast({ title: newPremium ? 'Premium verildi ✓' : tr("adminpremiumconfig_premium_legv_edildi_2448a5", "Premium l\u0259\u011Fv edildi") });
      searchUsers();
    } catch (error) {
      toast({ title: tr("adminpremiumconfig_xeta_3cdbb6", "Xəta"), description: (error as Error).message, variant: 'destructive' });
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'premium':return <Badge className="bg-primary text-primary-foreground text-xs">Premium</Badge>;
      case 'premium_plus':return <Badge className="bg-amber-500 text-white text-xs">Premium+</Badge>;
      default:return <Badge variant="outline" className="text-xs">Pulsuz</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          <Users className="w-4 h-4 inline me-1" />
          {tr("adminpremiumconfig_i_stifadecileri_ad_ve_ya_email_ece99b", "\u0130stifad\u0259\xE7il\u0259ri ad v\u0259 ya email il\u0259 axtar\u0131n, plan tipini d\u0259yi\u015Fdirin v\u0259 ya premium verin.")}
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={tr("adminpremiumconfig_ad_ve_ya_email_ile_axtar_335c5a", "Ad və ya email ilə axtar...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
          className="flex-1" />
        
        <Button onClick={searchUsers} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {users.length > 0 ?
      <div className="grid gap-3">
          {users.map((user) =>
        <motion.div
          key={user.user_id}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 bg-card rounded-xl border">
          
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{user.name}</p>
                  {getPlanBadge(user.plan_type)}
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 ms-2">
                <Switch
              checked={user.is_premium || user.plan_type === 'premium' || user.plan_type === 'premium_plus'}
              onCheckedChange={() => quickTogglePremium(user)} />
            
                <Button variant="ghost" size="icon" onClick={() => openEditModal(user)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
        )}
        </div> :
      searchQuery && !loading ?
      <p className="text-center text-muted-foreground py-8">{tr("adminpremiumconfig_istifadeci_tapilmadi_4e2156", "İstifadəçi tapılmadı")}</p> :
      null}

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tr("adminpremiumconfig_abuneliyi_redakte_et_2b6c42", "Abunəliyi Redaktə Et")}</DialogTitle>
          </DialogHeader>
          {editingUser &&
          <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium">{editingUser.name}</p>
                <p className="text-xs text-muted-foreground">{editingUser.email}</p>
              </div>

              <div>
                <Label>Plan Tipi</Label>
                <Select value={editForm.plan_type} onValueChange={(v) => setEditForm({ ...editForm, plan_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Pulsuz</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="premium_plus">Premium+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="cancelled">{tr("adminpremiumconfig_legv_edilib_24db12", "Ləğv edilib")}</SelectItem>
                    <SelectItem value="expired">{tr("adminpremiumconfig_muddeti_bitib_68fc0e", "Müddəti bitib")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>{tr("adminpremiumconfig_premium_bayragi_profil_5e7b36", "Premium bayrağı (profil)")}</Label>
                <Switch
                checked={editForm.is_premium}
                onCheckedChange={(v) => setEditForm({ ...editForm, is_premium: v })} />
              
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)} disabled={savingUser}>
                  {tr("adminpremiumconfig_legv_et_b5e49c", "L\u0259\u011Fv et")}
                </Button>
                <Button className="flex-1" onClick={handleSaveUser} disabled={savingUser}>
                  {savingUser ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
                  Saxla
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

};

// =========== MAIN COMPONENT ===========
const AdminPremiumConfig = () => {
    const localize = useAdminLocalize();
  const { features, plans, loading, createFeature, updateFeature, deleteFeature, updatePlan } = useAdminPremiumConfig();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('designer');

  // Feature modal state
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<PremiumFeature | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');

  const [featureForm, setFeatureForm] = useState({
    title: '',
    title_az: '',
    description: '',
    description_az: '',
    icon: '✨',
    is_included_free: false,
    is_included_premium: true,
    is_included_premium_plus: true,
    sort_order: 0,
    is_active: true
  });

  // Plan modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PremiumPlan | null>(null);
  const initialPlanFormRef = useRef<string>('');

  const [planForm, setPlanForm] = useState({
    name: '',
    name_az: '',
    description: '',
    description_az: '',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'AZN',
    badge_text: '',
    badge_text_az: '',
    is_popular: false,
    is_active: true
  });

  const hasUnsavedChanges = () => {
    if (showFeatureModal) return JSON.stringify(featureForm) !== initialFormDataRef.current;
    if (showPlanModal) return JSON.stringify(planForm) !== initialPlanFormRef.current;
    return false;
  };

  const handleFeatureModalClose = () => {
    if (hasUnsavedChanges()) {setShowUnsavedDialog(true);} else {closeFeatureModal();}
  };

  const closeFeatureModal = () => {
    setShowFeatureModal(false);
    setEditingFeature(null);
    setFeatureForm({ title: '', title_az: '', description: '', description_az: '', icon: '✨', is_included_free: false, is_included_premium: true, is_included_premium_plus: true, sort_order: 0, is_active: true });
  };

  const openFeatureModal = (feature?: PremiumFeature) => {
    // NOT: mövcud feature `...feature` ilə spread olunur ki, title_en/ru/tr/
    // kk/de/ar və description_en/ru/tr/kk/de/ar dəyərləri admin dili
    // dəyişdirildikdə boş görünməsin (Duzelis40.sql-in özü bu sütunları
    // real məzmunla doldurduğunu təsdiqləyir - bax "Anacan AI"/"Böyümə
    // İzləmə" düzəlişi). Bu boşluq həmin düzəlişin niyə admin UI əvəzinə
    // birbaşa SQL ilə edildiyinin əsas səbəbi idi.
    const data = feature ? {
      ...feature,
      title: feature.title, title_az: feature.title_az || '', description: feature.description || '', description_az: feature.description_az || '', icon: feature.icon, is_included_free: feature.is_included_free, is_included_premium: feature.is_included_premium, is_included_premium_plus: feature.is_included_premium_plus, sort_order: feature.sort_order, is_active: feature.is_active
    } : { title: '', title_az: '', description: '', description_az: '', icon: '✨', is_included_free: false, is_included_premium: true, is_included_premium_plus: true, sort_order: features.length, is_active: true };
    setFeatureForm(data);
    initialFormDataRef.current = JSON.stringify(data);
    setEditingFeature(feature || null);
    setShowFeatureModal(true);
  };

  const handleSaveFeature = async () => {
    if (!featureForm.title.trim()) {toast({ title: tr("adminpremiumconfig_basliq_daxil_edin_edf2fd", "Başlıq daxil edin"), variant: 'destructive' });return;}
    const result = editingFeature ? await updateFeature(editingFeature.id, featureForm) : await createFeature(featureForm);
    if (result.error) {toast({ title: tr("adminpremiumconfig_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });} else {toast({ title: editingFeature ? tr("adminpremiumconfig_yenilendi_d10a01", "Yenil\u0259ndi") : tr("adminpremiumconfig_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi") });closeFeatureModal();}
  };

  const handleDeleteFeature = async (id: string) => {
    if (!confirm(tr("adminpremiumconfig_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    const result = await deleteFeature(id);
    if (result.error) {toast({ title: tr("adminpremiumconfig_xeta_3cdbb6", "Xəta"), variant: 'destructive' });} else {toast({ title: 'Silindi' });}
  };

  const handlePlanModalClose = () => {
    if (hasUnsavedChanges()) {setShowUnsavedDialog(true);} else {closePlanModal();}
  };
  const closePlanModal = () => {setShowPlanModal(false);setEditingPlan(null);};

  const openPlanModal = (plan: PremiumPlan) => {
    // NOT: bax openFeatureModal-dakı eyni qeyd - `...plan` spread olunur ki,
    // name_en/ru/tr/kk/de/ar dəyərləri gizli qalmasın.
    const data = { ...plan, name: plan.name, name_az: plan.name_az || '', description: plan.description || '', description_az: plan.description_az || '', price_monthly: plan.price_monthly, price_yearly: plan.price_yearly, currency: plan.currency, badge_text: plan.badge_text || '', badge_text_az: plan.badge_text_az || '', is_popular: plan.is_popular, is_active: plan.is_active };
    setPlanForm(data);
    initialPlanFormRef.current = JSON.stringify(data);
    setEditingPlan(plan);
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    const result = await updatePlan(editingPlan.id, planForm);
    if (result.error) {toast({ title: tr("adminpremiumconfig_xeta_3cdbb6", "Xəta"), variant: 'destructive' });} else {toast({ title: tr("adminpremiumconfig_yenilendi_d10a01", "Yeniləndi") });closePlanModal();}
  };

  if (loading) return <div className="p-6 text-center">{tr("adminpremiumconfig_yuklenir_5557de", "Yüklənir...")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="w-6 h-6 text-amber-500" />
          {tr("adminpremiumconfig_premium_i_dareetme_a9b0ad", "Premium \u0130dar\u0259etm\u0259")}
        </h2>
        <p className="text-muted-foreground">{tr("adminpremiumconfig_planlar_limitler_funksiyalar_ve_istifade_1a4ca9", "Planlar, limitlər, funksiyalar və istifadəçi abunəlikləri")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="designer" className="text-xs px-3">Paywall</TabsTrigger>
            <TabsTrigger value="billing" className="text-xs px-3">{tr("adminpremiumconfig_abunelik_ce9af7", "Abunəlik")}</TabsTrigger>
            <TabsTrigger value="features" className="text-xs px-3">Funksiyalar</TabsTrigger>
            <TabsTrigger value="plans" className="text-xs px-3">Planlar</TabsTrigger>
            <TabsTrigger value="limits" className="text-xs px-3">{tr("adminpremiumconfig_limitler_caa8fa", "Limitlər")}</TabsTrigger>
            <TabsTrigger value="users" className="text-xs px-3">{tr("adminpremiumconfig_istifadeciler_1dd7b9", "İstifadəçilər")}</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs px-3">{tr("adminpremiumconfig_onizleme_1f8cc7", "Önizləmə")}</TabsTrigger>
          </TabsList>
        </div>

        {/* Paywall Designer Tab */}
        <TabsContent value="designer">
          <PaywallDesignerTab />
        </TabsContent>

        {/* Billing Designer Tab */}
        <TabsContent value="billing">
          <BillingDesignerTab />
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openFeatureModal()}>
              <Plus className="w-4 h-4 me-2" />
              Yeni Funksiya
            </Button>
          </div>
          <div className="grid gap-3">
            {features.map((feature) =>
            <motion.div key={feature.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-4 bg-card rounded-xl border">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{feature.icon}</span>
                  <div>
                    <p className="font-medium">{localize(feature, 'title')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {feature.is_included_free && <Badge variant="outline" className="text-xs">Free</Badge>}
                      {feature.is_included_premium && <Badge className="text-xs bg-primary">Premium</Badge>}
                      {feature.is_included_premium_plus && <Badge className="text-xs bg-amber-500">Premium+</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openFeatureModal(feature)}><Edit2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteFeature(feature.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </motion.div>
            )}
          </div>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) =>
            <motion.div key={plan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`relative p-6 bg-card rounded-xl border-2 ${plan.is_popular ? 'border-primary' : 'border-border'}`}>
                {plan.is_popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">Populyar</Badge>}
                <div className="text-center">
                  <h3 className="text-xl font-bold">{localize(plan, 'name')}</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">{plan.price_monthly}</span>
                    <span className="text-muted-foreground"> {plan.currency}/ay</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.price_yearly} {plan.currency}/il</p>
                  <Button className="mt-4 w-full" variant="outline" onClick={() => openPlanModal(plan)}>
                    <Edit2 className="w-4 h-4 me-2" />
                    {tr("adminpremiumconfig_redakte_et_78eab1", "Redakt\u0259 Et")}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </TabsContent>

        {/* Free Limits Tab */}
        <TabsContent value="limits">
          <FreeLimitsTab />
        </TabsContent>

        {/* User Subscriptions Tab */}
        <TabsContent value="users">
          <UserSubscriptionsTab />
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-center mb-6">{tr("adminpremiumconfig_premium_planlar_onizleme_b0c9a8", "Premium Planlar Önizləmə")}</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-start p-3">Funksiya</th>
                    {plans.map((plan) =>
                    <th key={plan.id} className="text-center p-3">
                        {localize(plan, 'name')}
                        <div className="text-sm font-normal text-muted-foreground">{plan.price_monthly} {plan.currency}/ay</div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) =>
                  <tr key={feature.id} className="border-t">
                      <td className="p-3"><span className="me-2">{feature.icon}</span>{localize(feature, 'title')}</td>
                      <td className="text-center p-3">{feature.is_included_free ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <Minus className="w-5 h-5 text-muted-foreground mx-auto" />}</td>
                      <td className="text-center p-3">{feature.is_included_premium ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <Minus className="w-5 h-5 text-muted-foreground mx-auto" />}</td>
                      <td className="text-center p-3">{feature.is_included_premium_plus ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <Minus className="w-5 h-5 text-muted-foreground mx-auto" />}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Feature Modal */}
      <Dialog open={showFeatureModal} onOpenChange={handleFeatureModalClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingFeature ? tr("adminpremiumconfig_funksiyani_redakte_et_3135be", "Funksiyan\u0131 Redakt\u0259 Et") : 'Yeni Funksiya'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label>{tr("adminpremiumconfig_ikon_6e73fc", "İkon")}</Label>
                <Input value={featureForm.icon} onChange={(e) => setFeatureForm({ ...featureForm, icon: e.target.value })} className="text-center text-xl" />
              </div>
              <div className="col-span-3">
                <Label>{tr("adminpremiumconfig_basliq_en_4ac905", "Başlıq (EN)")}</Label>
                <Input value={featureForm.title} onChange={(e) => setFeatureForm({ ...featureForm, title: e.target.value })} />
              </div>
            </div>
            <div><Label>{tr("adminpremiumconfig_basliq_az_3e294a", "Başlıq (AZ)")}</Label><LocalizedInput formData={featureForm} setFormData={setFeatureForm} field="title" label="Title" /></div>
            <div><Label>{tr("adminpremiumconfig_aciqlama_az_86f364", "Açıqlama (AZ)")}</Label><LocalizedTextarea formData={featureForm} setFormData={setFeatureForm} field="description" label="Description" rows={2} /></div>
            <div className="space-y-3 pt-2">
              <Label>Planlara daxildir:</Label>
              <div className="flex items-center justify-between"><span>Free</span><Switch checked={featureForm.is_included_free} onCheckedChange={(v) => setFeatureForm({ ...featureForm, is_included_free: v })} /></div>
              <div className="flex items-center justify-between"><span>Premium</span><Switch checked={featureForm.is_included_premium} onCheckedChange={(v) => setFeatureForm({ ...featureForm, is_included_premium: v })} /></div>
              <div className="flex items-center justify-between"><span>Premium+</span><Switch checked={featureForm.is_included_premium_plus} onCheckedChange={(v) => setFeatureForm({ ...featureForm, is_included_premium_plus: v })} /></div>
            </div>
            <div className="flex items-center justify-between pt-2"><Label>Aktiv</Label><Switch checked={featureForm.is_active} onCheckedChange={(v) => setFeatureForm({ ...featureForm, is_active: v })} /></div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={handleFeatureModalClose}><X className="w-4 h-4 me-2" />{tr("adminpremiumconfig_legv_et_b5e49c", "Ləğv et")}</Button>
              <Button className="flex-1" onClick={handleSaveFeature}><Save className="w-4 h-4 me-2" />Saxla</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan Modal */}
      <Dialog open={showPlanModal} onOpenChange={handlePlanModalClose}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{tr("adminpremiumconfig_plani_redakte_et_caa626", "Planı Redaktə Et")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Ad (AZ)</Label><LocalizedInput formData={planForm} setFormData={setPlanForm} field="name" label="Name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{tr("adminpremiumconfig_ayliq_qiymet_8bb31c", "Aylıq Qiymət")}</Label><Input type="number" step="0.01" value={planForm.price_monthly} onChange={(e) => setPlanForm({ ...planForm, price_monthly: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>{tr("adminpremiumconfig_illik_qiymet_56917a", "İllik Qiymət")}</Label><Input type="number" step="0.01" value={planForm.price_yearly} onChange={(e) => setPlanForm({ ...planForm, price_yearly: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Valyuta</Label><Input value={planForm.currency} onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })} /></div>
            <div><Label>{tr("adminpremiumconfig_badge_metni_az_e09581", "Badge Mətni (AZ)")}</Label><LocalizedInput formData={planForm} setFormData={setPlanForm} field="badge_text" label="Məs: Ən sərfəli" /></div>
            <div className="flex items-center justify-between"><Label>Populyar</Label><Switch checked={planForm.is_popular} onCheckedChange={(v) => setPlanForm({ ...planForm, is_popular: v })} /></div>
            <div className="flex items-center justify-between"><Label>Aktiv</Label><Switch checked={planForm.is_active} onCheckedChange={(v) => setPlanForm({ ...planForm, is_active: v })} /></div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={handlePlanModalClose}><X className="w-4 h-4 me-2" />{tr("adminpremiumconfig_legv_et_b5e49c", "Ləğv et")}</Button>
              <Button className="flex-1" onClick={handleSavePlan}><Save className="w-4 h-4 me-2" />Saxla</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={() => {if (showFeatureModal) closeFeatureModal();if (showPlanModal) closePlanModal();}} />
      
    </div>);

};

export default AdminPremiumConfig;