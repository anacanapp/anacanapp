import { useState } from 'react';
import { tr } from '@/lib/tr';
import { useAllBanners, useCreateBanner, useUpdateBanner, useDeleteBanner, Banner, BannerPlacement, BannerType, LinkType, LifeStageTarget } from '@/hooks/useBanners';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Image, Layout, Eye, EyeOff, ExternalLink, MousePointer, BarChart3, Target, X, Globe2, Languages } from 'lucide-react';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";
import countriesData from '../../../countries.json';

const LIFE_STAGES: {value: LifeStageTarget;labelKey: string;fallback: string;}[] = [
{ value: 'flow', labelKey: 'lifestage_flow_short', fallback: '🌸 Dövr' },
{ value: 'bump', labelKey: 'lifestage_bump_short', fallback: '🤰 Hamiləlik' },
{ value: 'mommy', labelKey: 'lifestage_mommy_short', fallback: '👶 Analıq' },
{ value: 'partner', labelKey: 'lifestage_partner_short', fallback: '💑 Partnyor' }];


const APP_LANGUAGES: {value: string;label: string;}[] = [
{ value: 'az', label: 'Azərbaycan' },
{ value: 'en', label: 'English' },
{ value: 'ru', label: 'Русский' },
{ value: 'tr', label: 'Türkçe' },
{ value: 'kk', label: 'Қазақша' },
{ value: 'uz', label: "O'zbekcha" },
{ value: 'ka', label: 'ქართული' },
{ value: 'de', label: 'Deutsch' },
{ value: 'ar', label: 'العربية' }];

const PLACEMENTS: {value: BannerPlacement;label: string;}[] = [
{ value: 'home_top', label: tr("adminbanners_ana_sehife_ust_67d37b", "Ana Səhifə - Üst") },
{ value: 'home_middle', label: tr("adminbanners_ana_sehife_orta_806a99", "Ana Səhifə - Orta") },
{ value: 'home_bottom', label: tr("adminbanners_ana_sehife_alt_91e4ed", "Ana Səhifə - Alt") },
{ value: 'tools_top', label: tr("adminbanners_aletler_ust_a0e524", "Alətlər - Üst") },
{ value: 'tools_bottom', label: tr("adminbanners_aletler_alt_74224f", "Alətlər - Alt") },
{ value: 'profile_top', label: tr("adminbanners_profil_ust_a0a39d", "Profil - Üst") },
{ value: 'community_top', label: tr("adminbanners_cemiyyet_ust_c6809f", "Cəmiyyət - Üst") },
{ value: 'ai_chat_top', label: tr("adminbanners_ai_chat_ust_72c347", "AI Chat - Üst") }];


const BANNER_TYPES: {value: BannerType;label: string;}[] = [
{ value: 'native', label: 'Native (Dizayn)' },
{ value: 'image', label: tr("adminbanners_sekil_43e2e3", "Şəkil") }];


const LINK_TYPES: {value: LinkType;label: string;}[] = [
{ value: 'external', label: 'Xarici Link' },
{ value: 'internal', label: tr("adminbanners_daxili_sehife_763453", "Daxili Səhifə") },
{ value: 'tool', label: tr("adminbanners_alet_acilisi_c88075", "Alət Açılışı") }];


const DEFAULT_COLORS = [
'#F48155', '#8B5CF6', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#EC4899', '#6366F1'];


const AdminBanners = () => {
    const localize = useAdminLocalize();
  const { data: banners, isLoading } = useAllBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [countrySearch, setCountrySearch] = useState('');
  const [formData, setFormData] = useState<Partial<Banner>>({
    title: '',
    title_az: '',
    description: '',
    description_az: '',
    image_url: '',
    link_url: '',
    link_type: 'external',
    placement: 'home_top',
    banner_type: 'native',
    background_color: '#F48155',
    text_color: '#FFFFFF',
    button_text: '',
    button_text_az: '',
    is_active: true,
    is_premium_only: false,
    sort_order: 0,
    target_life_stages: [],
    target_languages: [],
    target_countries: [],
    max_impressions_per_user: null,
    start_date: '',
    end_date: ''
  });

  const resetForm = () => {
    setFormData({
      title: '',
      title_az: '',
      description: '',
      description_az: '',
      image_url: '',
      link_url: '',
      link_type: 'external',
      placement: 'home_top',
      banner_type: 'native',
      background_color: '#F48155',
      text_color: '#FFFFFF',
      button_text: '',
      button_text_az: '',
      is_active: true,
      is_premium_only: false,
      sort_order: 0,
      target_life_stages: [],
      target_languages: [],
      target_countries: [],
      max_impressions_per_user: null,
      start_date: '',
      end_date: ''
    });
    setEditingBanner(null);
    setCountrySearch('');
  };

  /** target_life_stages / target_languages / target_countries üçün ortaq toggle */
  const toggleArrayValue = (field: 'target_life_stages' | 'target_languages' | 'target_countries', value: string) => {
    setFormData((prev) => {
      const current = (prev[field] as string[] | null) || [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  };

  const handleOpenDialog = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        ...banner,
        // timestamptz -> <input type="date"> üçün "YYYY-MM-DD" formatı
        start_date: banner.start_date ? banner.start_date.split('T')[0] : '',
        end_date: banner.end_date ? banner.end_date.split('T')[0] : ''
      });
    } else {
      resetForm();
    }
    setCountrySearch('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title) {
      toast({ title: tr("adminbanners_basliq_teleb_olunur_097c6f", "Başlıq tələb olunur"), variant: 'destructive' });
      return;
    }

    // Boş massivlər NULL kimi göndərilir ("hədəf yoxdur" = hamısına göstər sorğu məntiqi ilə uyğun)
    const payload: Partial<Banner> = {
      ...formData,
      target_life_stages: formData.target_life_stages?.length ? formData.target_life_stages : null,
      target_languages: formData.target_languages?.length ? formData.target_languages : null,
      target_countries: formData.target_countries?.length ? formData.target_countries : null,
      max_impressions_per_user: formData.max_impressions_per_user || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null
    };

    try {
      if (editingBanner) {
        await updateBanner.mutateAsync({ id: editingBanner.id, ...payload });
        toast({ title: tr("adminbanners_banner_yenilendi_6d2ad8", "Banner yeniləndi") });
      } else {
        await createBanner.mutateAsync(payload);
        toast({ title: tr("adminbanners_banner_yaradildi_8ba9bd", "Banner yaradıldı") });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: tr("adminbanners_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("adminbanners_bu_banneri_silmek_istediyinize_f822cd", "Bu banneri silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;

    try {
      await deleteBanner.mutateAsync(id);
      toast({ title: 'Banner silindi' });
    } catch (error) {
      toast({ title: tr("adminbanners_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await updateBanner.mutateAsync({ id: banner.id, is_active: !banner.is_active });
      toast({ title: banner.is_active ? 'Banner deaktiv edildi' : 'Banner aktiv edildi' });
    } catch (error) {
      toast({ title: tr("adminbanners_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  };

  const filteredBanners = banners?.filter((b) =>
  activeTab === 'all' || b.placement === activeTab
  ) || [];

  const getPlacementLabel = (placement: string) => {
    return PLACEMENTS.find((p) => p.value === placement)?.label || placement;
  };

  if (isLoading) {
    return <div className="p-4 text-center">{tr("adminbanners_yuklenir_5557de", "Yüklənir...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{tr("adminbanners_banner_idaresi_bc3a16", "Banner İdarəsi")}</h2>
          <p className="text-muted-foreground">{tr("adminbanners_tetbiqdeki_bannerleri_idare_edin_a0927c", "Tətbiqdəki bannerləri idarə edin")}</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 me-2" />
          Yeni Banner
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Layout className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{banners?.length || 0}</p>
                <p className="text-xs text-muted-foreground">{tr("adminbanners_umumi_banner_4d2adc", "Ümumi Banner")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{banners?.filter((b) => b.is_active).length || 0}</p>
                <p className="text-xs text-muted-foreground">Aktiv</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{banners?.reduce((sum, b) => sum + (b.click_count || 0), 0) || 0}</p>
                <p className="text-xs text-muted-foreground">{tr("adminbanners_umumi_klik_504648", "Ümumi Klik")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{PLACEMENTS.length}</p>
                <p className="text-xs text-muted-foreground">{tr("adminbanners_yerlesdirme_6c3e92", "Yerləşdirmə")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs by placement */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">{tr("adminbanners_hamisi_c73c4d", "Hamısı")}</TabsTrigger>
          {PLACEMENTS.map((p) =>
          <TabsTrigger key={p.value} value={p.value} className="text-xs">
              {p.label}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="grid gap-4">
            {filteredBanners.length === 0 ?
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {tr("adminbanners_bu_bolmede_banner_yoxdur_0fc4ad", "Bu b\xF6lm\u0259d\u0259 banner yoxdur")}
                </CardContent>
              </Card> :

            filteredBanners.map((banner) =>
            <Card key={banner.id} className={!banner.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Preview */}
                      <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: banner.banner_type === 'native' ? banner.background_color || '#F48155' : '#f3f4f6',
                      color: banner.text_color || '#FFFFFF'
                    }}>
                    
                        {banner.banner_type === 'image' && banner.image_url ?
                    <img src={banner.image_url} alt="" className="w-full h-full object-cover rounded-lg" /> :

                    <Image className="w-6 h-6" />
                    }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{localize(banner, 'title')}</h3>
                          {!banner.is_active &&
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Deaktiv</span>
                      }
                          {banner.is_premium_only &&
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Premium</span>
                      }
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {localize(banner, 'description') || tr("adminbanners_tesvir_yoxdur_12f487", "T\u0259svir yoxdur")}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="bg-muted px-2 py-0.5 rounded">{getPlacementLabel(banner.placement)}</span>
                          <span>{banner.banner_type === 'native' ? 'Native' : tr("adminbanners_sekil_43e2e3", "\u015E\u0259kil")}</span>
                          {banner.link_url &&
                      <span className="flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              {banner.link_type}
                            </span>
                      }
                          <span>Klik: {banner.click_count || 0}</span>
                          <span>{banner.view_count || 0} {tr("adminbanners_gorunme_qisa", "göstərilmə")}</span>
                        </div>
                        {/* Hədəfləmə xülasəsi — heç biri yoxdursa "hamısına göstərilir" ipucu görünmür */}
                        {((banner.target_life_stages?.length || 0) > 0 ||
                    (banner.target_languages?.length || 0) > 0 ||
                    (banner.target_countries?.length || 0) > 0 ||
                    banner.max_impressions_per_user) &&
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {(banner.target_life_stages?.length || 0) > 0 &&
                      <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                                <Target className="w-3 h-3" />
                                {banner.target_life_stages!.map((ls) => LIFE_STAGES.find((l) => l.value === ls)?.fallback || ls).join(', ')}
                              </span>
                      }
                            {(banner.target_languages?.length || 0) > 0 &&
                      <span className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                                <Languages className="w-3 h-3" />
                                {banner.target_languages!.join(', ').toUpperCase()}
                              </span>
                      }
                            {(banner.target_countries?.length || 0) > 0 &&
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                <Globe2 className="w-3 h-3" />
                                {banner.target_countries!.length} {tr("adminbanners_hedef_olkeler", "Hədəf ölkələr")}
                              </span>
                      }
                            {banner.max_impressions_per_user &&
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                <Eye className="w-3 h-3" />
                                {tr("adminbanners_maks_gorunme", "Maksimum göstərilmə sayı (istifadəçi başına)")}: {banner.max_impressions_per_user}
                              </span>
                      }
                          </div>
                    }
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => handleToggleActive(banner)} />
                    
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(banner)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(banner.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            )
            }
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? tr("adminbanners_banneri_redakte_et_484526", "Banneri Redakt\u0259 Et") : 'Yeni Banner'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{tr("adminbanners_basliq_en_4ac905", "Başlıq (EN)")}</Label>
                <Input
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Banner Title" />
                
              </div>
              <div>
                <Label>{tr("adminbanners_basliq_az_3e294a", "Başlıq (AZ)")}</Label>
                <LocalizedInput formData={formData} setFormData={setFormData} field="title" label="Banner Başlığı" />
                
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{tr("adminbanners_tesvir_en_c64521", "Təsvir (EN)")}</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description"
                  rows={2} />
                
              </div>
              <div>
                <Label>{tr("adminbanners_tesvir_az_2c237a", "Təsvir (AZ)")}</Label>
                <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Təsvir" rows={2} />
                
              </div>
            </div>

            {/* Type & Placement */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Banner Tipi</Label>
                <Select
                  value={formData.banner_type}
                  onValueChange={(v) => setFormData({ ...formData, banner_type: v as BannerType })}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANNER_TYPES.map((t) =>
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("adminbanners_yerlesdirme_6c3e92", "Yerləşdirmə")}</Label>
                <Select
                  value={formData.placement}
                  onValueChange={(v) => setFormData({ ...formData, placement: v as BannerPlacement })}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) =>
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Native Banner Colors */}
            {formData.banner_type === 'native' &&
            <div className="space-y-3">
                <div>
                  <Label>{tr("adminbanners_arxa_fon_rengi_c914c9", "Arxa Fon Rəngi")}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                    type="color"
                    value={formData.background_color || '#F48155'}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    className="w-12 h-10 p-1" />
                  
                    <div className="flex gap-1">
                      {DEFAULT_COLORS.map((color) =>
                    <button
                      key={color}
                      className="w-6 h-6 rounded-full border-2 border-transparent hover:border-gray-400"
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, background_color: color })} />

                    )}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>{tr("adminbanners_metn_rengi_b3857e", "Mətn Rəngi")}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                    type="color"
                    value={formData.text_color || '#FFFFFF'}
                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                    className="w-12 h-10 p-1" />
                  
                    <button
                    className="w-6 h-6 rounded-full bg-white border"
                    onClick={() => setFormData({ ...formData, text_color: '#FFFFFF' })} />
                  
                    <button
                    className="w-6 h-6 rounded-full bg-black border"
                    onClick={() => setFormData({ ...formData, text_color: '#000000' })} />
                  
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{tr("adminbanners_duyme_metni_en_f2f4bd", "Düymə Mətni (EN)")}</Label>
                    <Input
                    value={formData.button_text || ''}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    placeholder="Learn More" />
                  
                  </div>
                  <div>
                    <Label>{tr("adminbanners_duyme_metni_az_75db00", "Düymə Mətni (AZ)")}</Label>
                    <LocalizedInput formData={formData} setFormData={setFormData} field="button_text" label="Daha Çox" />
                  
                  </div>
                </div>
              </div>
            }

            {/* Image Banner */}
            {formData.banner_type === 'image' &&
            <div>
                <Label>{tr("adminbanners_sekil_url_d302df", "Şəkil URL")}</Label>
                <Input
                value={formData.image_url || ''}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/banner.jpg" />
              
              </div>
            }

            {/* Link */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Link Tipi</Label>
                <Select
                  value={formData.link_type}
                  onValueChange={(v) => setFormData({ ...formData, link_type: v as LinkType })}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_TYPES.map((t) =>
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {formData.link_type === 'external' ? 'URL' :
                  formData.link_type === 'internal' ? tr("adminbanners_sehife_billing_community_0eddb5", "S\u0259hif\u0259 (/billing, /community)") : tr("adminbanners_alet_id_baby_names_kick_counte_28c887", "Al\u0259t ID (baby-names, kick-counter)")
                  }
                </Label>
                <Input
                  value={formData.link_url || ''}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder={formData.link_type === 'external' ? 'https://...' : formData.link_type === 'internal' ? '/billing' : 'baby-names'} />
                
              </div>
            </div>

            {/* 🎯 Hədəfləmə (Targeting) */}
            <div className="rounded-lg border border-dashed p-4 space-y-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm">{tr("adminbanners_hedefleme_basligi", "🎯 Hədəfləmə (Targeting)")}</h4>
              </div>

              {/* Mərhələ (life stage) */}
              <div>
                <Label>{tr("adminbanners_hedef_merheleler", "Hədəf mərhələlər")}</Label>
                <p className="text-xs text-muted-foreground mb-2">{tr("adminbanners_hedef_merheleler_desc", "Heç biri seçilməzsə, bütün mərhələlərə göstərilir")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LIFE_STAGES.map((ls) =>
                  <label key={ls.value} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-2 cursor-pointer hover:bg-muted/60">
                      <Checkbox
                      checked={(formData.target_life_stages || []).includes(ls.value)}
                      onCheckedChange={() => toggleArrayValue('target_life_stages', ls.value)} />
                    
                      {tr(ls.labelKey, ls.fallback)}
                    </label>
                  )}
                </div>
              </div>

              {/* Dillər */}
              <div>
                <Label>{tr("adminbanners_hedef_diller", "Hədəf dillər")}</Label>
                <p className="text-xs text-muted-foreground mb-2">{tr("adminbanners_hedef_diller_desc", "Heç biri seçilməzsə, bütün dillərə göstərilir")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {APP_LANGUAGES.map((l) =>
                  <label key={l.value} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-2 cursor-pointer hover:bg-muted/60">
                      <Checkbox
                      checked={(formData.target_languages || []).includes(l.value)}
                      onCheckedChange={() => toggleArrayValue('target_languages', l.value)} />
                    
                      {l.label}
                    </label>
                  )}
                </div>
              </div>

              {/* Ölkələr */}
              <div>
                <Label>{tr("adminbanners_hedef_olkeler", "Hədəf ölkələr")}</Label>
                <p className="text-xs text-muted-foreground mb-2">{tr("adminbanners_hedef_olkeler_desc", "Heç biri seçilməzsə, bütün ölkələrə göstərilir")}</p>
                {(formData.target_countries?.length || 0) > 0 &&
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.target_countries!.map((code) => {
                    const c = countriesData.find((c: any) => c.isoAlpha2 === code);
                    return (
                      <span key={code} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {c?.name || code}
                          <button type="button" onClick={() => toggleArrayValue('target_countries', code)}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>);

                  })}
                  </div>
                }
                <Input
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder={tr("adminbanners_olke_axtar", "Ölkə axtar...")}
                  className="mb-2" />
                
                <div className="max-h-[180px] overflow-y-auto border rounded-md p-2 space-y-0.5">
                  {countriesData.
                  filter((c: any) => c.name.toLowerCase().includes(countrySearch.toLowerCase())).
                  map((c: any) =>
                  <label key={c.isoAlpha2} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                      <Checkbox
                      checked={(formData.target_countries || []).includes(c.isoAlpha2)}
                      onCheckedChange={() => toggleArrayValue('target_countries', c.isoAlpha2)} />
                    
                      {c.name}
                    </label>
                  )}
                </div>
              </div>

              {/* İmpression limiti + tarix aralığı */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>{tr("adminbanners_maks_gorunme", "Maksimum göstərilmə sayı (istifadəçi başına)")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.max_impressions_per_user ?? ''}
                    onChange={(e) => setFormData({ ...formData, max_impressions_per_user: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder={tr("adminbanners_maks_gorunme_placeholder", "Limitsiz")} />
                  
                </div>
                <div>
                  <Label>{tr("adminbanners_baslama_tarixi", "Başlama tarixi (istəyə bağlı)")}</Label>
                  <Input
                    type="date"
                    value={formData.start_date as string || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                  
                </div>
                <div>
                  <Label>{tr("adminbanners_bitme_tarixi", "Bitmə tarixi (istəyə bağlı)")}</Label>
                  <Input
                    type="date"
                    value={formData.end_date as string || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                  
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{tr("adminbanners_sira_421c5f", "Sıra")}</Label>
                <Input
                  type="number"
                  value={formData.sort_order || 0}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
                
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                
                <Label>Aktiv</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_premium_only}
                  onCheckedChange={(v) => setFormData({ ...formData, is_premium_only: v })} />
                
                <Label>Premium Only</Label>
              </div>
            </div>

            {/* Preview */}
            {formData.banner_type === 'native' &&
            <div>
                <Label>{tr("adminbanners_onizleme_1f8cc7", "Önizləmə")}</Label>
                <div
                className="mt-2 rounded-2xl p-4 flex items-center gap-4"
                style={{
                  background: `linear-gradient(135deg, ${formData.background_color || '#F48155'} 0%, ${formData.background_color || '#F48155'}cc 100%)`,
                  color: formData.text_color || '#FFFFFF'
                }}>
                
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Layout className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{localize(formData, 'title') || tr("adminbanners_banner_basligi_0722c5", "Banner Ba\u015Fl\u0131\u011F\u0131")}</h3>
                    <p className="text-sm opacity-90">{localize(formData, 'description') || tr("adminbanners_tesvir_f85651", "T\u0259svir")}</p>
                  </div>
                  <span className="text-sm font-medium">{localize(formData, 'button_text') || tr("adminbanners_daha_cox_7d8a93", "Daha \xC7ox")}</span>
                </div>
              </div>
            }
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{tr("adminbanners_legv_et_b5e49c", "Ləğv et")}</Button>
            <Button onClick={handleSave} disabled={createBanner.isPending || updateBanner.isPending}>
              {editingBanner ? tr("adminbanners_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminBanners;