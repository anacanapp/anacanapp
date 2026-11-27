import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { tr } from '@/lib/tr';
import { useAllBanners, useCreateBanner, useUpdateBanner, useDeleteBanner, Banner, BannerPlacement, BannerType, LinkType, LifeStageTarget, BannerPlatform } from '@/hooks/useBanners';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { BarChart3, Edit2, Eye, Globe2, Image, Languages, Layout, MousePointer, Plus, Target, Trash2, X } from 'lucide-react';
import { LocalizedInput } from './ui/LocalizedInput';
import { LocalizedTextarea } from './ui/LocalizedTextarea';
import { useAdminLocalize } from '@/contexts/AdminLanguageContext';
import countriesData from '../../../countries.json';
import { Btn, DataTable, EmptyState, Field, FieldGrid, FilterChips, FormSection, KpiRow, Page, PageHeader, Section, SideDrawer, StatTile, StatusPill, fmtNumber, useAdminConfirm, type Column } from './kit';

const PLATFORMS: { value: BannerPlatform; label: string }[] = [{ value: 'ios', label: 'iOS' }, { value: 'android', label: 'Android' }, { value: 'web', label: 'Veb' }];
const LIFE_STAGES: { value: LifeStageTarget; labelKey: string; fallback: string }[] = [
  { value: 'flow', labelKey: 'lifestage_flow_short', fallback: '🌸 Dövr' }, { value: 'bump', labelKey: 'lifestage_bump_short', fallback: '🤰 Hamiləlik' },
  { value: 'mommy', labelKey: 'lifestage_mommy_short', fallback: '👶 Analıq' }, { value: 'partner', labelKey: 'lifestage_partner_short', fallback: '💑 Partnyor' },
];
const APP_LANGUAGES: { value: string; label: string }[] = [
  { value: 'az', label: 'Azərbaycan' }, { value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }, { value: 'tr', label: 'Türkçe' }, { value: 'kk', label: 'Қазақша' },
  { value: 'uz', label: "O'zbekcha" }, { value: 'ka', label: 'ქართული' }, { value: 'de', label: 'Deutsch' }, { value: 'ar', label: 'العربية' },
];
const PLACEMENTS: { value: BannerPlacement; label: string }[] = [
  { value: 'home_top', label: tr('adminbanners_ana_sehife_ust_67d37b', 'Ana Səhifə - Üst') }, { value: 'home_middle', label: tr('adminbanners_ana_sehife_orta_806a99', 'Ana Səhifə - Orta') },
  { value: 'home_bottom', label: tr('adminbanners_ana_sehife_alt_91e4ed', 'Ana Səhifə - Alt') }, { value: 'tools_top', label: tr('adminbanners_aletler_ust_a0e524', 'Alətlər - Üst') },
  { value: 'tools_bottom', label: tr('adminbanners_aletler_alt_74224f', 'Alətlər - Alt') }, { value: 'profile_top', label: tr('adminbanners_profil_ust_a0a39d', 'Profil - Üst') },
  { value: 'community_top', label: tr('adminbanners_cemiyyet_ust_c6809f', 'Cəmiyyət - Üst') }, { value: 'ai_chat_top', label: tr('adminbanners_ai_chat_ust_72c347', 'AI Chat - Üst') },
];
const BANNER_TYPES: { value: BannerType; label: string }[] = [{ value: 'native', label: 'Native (Dizayn)' }, { value: 'image', label: tr('adminbanners_sekil_43e2e3', 'Şəkil') }];
const LINK_TYPES: { value: LinkType; label: string }[] = [{ value: 'external', label: 'Xarici Link' }, { value: 'internal', label: tr('adminbanners_daxili_sehife_763453', 'Daxili Səhifə') }, { value: 'tool', label: tr('adminbanners_alet_acilisi_c88075', 'Alət Açılışı') }];
const DEFAULT_COLORS = ['#F48155', '#8B5CF6', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#EC4899', '#6366F1'];
const EMPTY: Partial<Banner> = {
  title: '', title_az: '', description: '', description_az: '', image_url: '', link_url: '', link_type: 'external', placement: 'home_top', banner_type: 'native',
  background_color: '#F48155', text_color: '#FFFFFF', button_text: '', button_text_az: '', is_active: true, is_premium_only: false, sort_order: 0,
  target_life_stages: [], target_languages: [], target_countries: [], target_platforms: [], max_impressions_per_user: null, start_date: '', end_date: '',
};
const placementLabel = (placement: string) => PLACEMENTS.find(item => item.value === placement)?.label || placement;
const freeOnly = (banner: Partial<Banner>) => !banner.branded && banner.audience_tiers?.length === 1 && banner.audience_tiers[0] === 'free';

const AdminBanners = () => {
  const localize = useAdminLocalize();
  const confirm = useAdminConfirm();
  const { data: banners, isLoading, isError, refetch } = useAllBanners();
  // Brand-measured banners (ad_brand_creatives, e.g. the "Anacan" PDF book banners) count impressions and clicks in
  // ad_metrics_daily, not in the legacy view_count/click_count; show those real numbers when a banner has them.
  const { data: measured } = useQuery({
    queryKey: ['admin-banner-measured-stats'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types
      const { data, error } = await (supabase as any).rpc('admin_banner_measured_stats_v1');
      if (error) throw error;
      return (data ?? {}) as Record<string, { impressions: number; clicks: number }>;
    },
    staleTime: 60_000,
  });
  const statsOf = (banner: Banner) => {
    const m = measured?.[banner.id];
    return m ? { views: Number(m.impressions) || 0, clicks: Number(m.clicks) || 0, measured: true }
      : { views: banner.view_count || 0, clicks: banner.click_count || 0, measured: false };
  };
  const createBanner = useCreateBanner(), updateBanner = useUpdateBanner(), deleteBanner = useDeleteBanner();
  const [isDialogOpen, setIsDialogOpen] = useState(false), [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all'), [countrySearch, setCountrySearch] = useState('');
  const [formData, setFormData] = useState<Partial<Banner>>(EMPTY), [initial, setInitial] = useState<Partial<Banner>>(EMPTY);

  /** target_life_stages / target_languages / target_countries üçün ortaq toggle */
  const toggleArrayValue = (field: 'target_life_stages' | 'target_languages' | 'target_countries' | 'target_platforms', value: string) => {
    setFormData(prev => { const current = (prev[field] as string[] | null) || []; return { ...prev, [field]: current.includes(value) ? current.filter(item => item !== value) : [...current, value] }; });
  };
  const handleOpenDialog = (banner?: Banner) => {
    // timestamptz -> <input type="date"> üçün "YYYY-MM-DD" formatı
    const next = banner ? { ...banner, start_date: banner.start_date ? banner.start_date.split('T')[0] : '', end_date: banner.end_date ? banner.end_date.split('T')[0] : '' } : EMPTY;
    setEditingBanner(banner ?? null); setFormData(next); setInitial(next); setCountrySearch(''); setIsDialogOpen(true);
  };
  const handleSave = async () => {
    if (!formData.title) { toast({ title: tr('adminbanners_basliq_teleb_olunur_097c6f', 'Başlıq tələb olunur'), variant: 'destructive' }); return; }
    // Boş massivlər NULL kimi göndərilir ("hədəf yoxdur" = hamısına göstər sorğu məntiqi ilə uyğun)
    const payload: Partial<Banner> = {
      ...formData,
      target_life_stages: formData.target_life_stages?.length ? formData.target_life_stages : null, target_languages: formData.target_languages?.length ? formData.target_languages : null,
      target_countries: formData.target_countries?.length ? formData.target_countries : null, target_platforms: formData.target_platforms?.length ? formData.target_platforms : null,
      max_impressions_per_user: formData.max_impressions_per_user || null, start_date: formData.start_date || null, end_date: formData.end_date || null,
    };
    try {
      if (editingBanner) { await updateBanner.mutateAsync({ id: editingBanner.id, ...payload }); toast({ title: tr('adminbanners_banner_yenilendi_6d2ad8', 'Banner yeniləndi') }); }
      else { await createBanner.mutateAsync(payload); toast({ title: tr('adminbanners_banner_yaradildi_8ba9bd', 'Banner yaradıldı') }); }
      setIsDialogOpen(false); setEditingBanner(null); setFormData(EMPTY);
    } catch { toast({ title: tr('adminbanners_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' }); }
  };
  const handleDelete = async (banner: Banner) => {
    if (!(await confirm({ title: tr('adminbanners_bu_banneri_silmek_istediyinize_f822cd', 'Bu banneri silməkdə əminsiniz?'), description: localize(banner, 'title'), confirmLabel: 'Sil', danger: true }))) return;
    try { await deleteBanner.mutateAsync(banner.id); toast({ title: 'Banner silindi' }); } catch { toast({ title: tr('adminbanners_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' }); }
  };
  const handleToggleActive = async (banner: Banner) => {
    try { await updateBanner.mutateAsync({ id: banner.id, is_active: !banner.is_active }); toast({ title: banner.is_active ? 'Banner deaktiv edildi' : 'Banner aktiv edildi' }); }
    catch { toast({ title: tr('adminbanners_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' }); }
  };

  const all = banners ?? [];
  const filteredBanners = all.filter(banner => activeTab === 'all' || banner.placement === activeTab);
  const columns = useMemo<Column<Banner>[]>(() => [
    { key: 'banner', header: 'Banner', mobile: 'title', cell: banner => (
      <span className="ak-cell-user">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ backgroundColor: banner.banner_type === 'native' ? banner.background_color || '#F48155' : 'var(--ad-surface-3)', color: banner.text_color || '#FFFFFF' }}>
          {banner.banner_type === 'image' && banner.image_url ? <img src={banner.image_url} alt="" className="h-full w-full object-cover" /> : <Image size={16} />}</span>
        <span className="min-w-0"><span className="ak-cell-main">{localize(banner, 'title')}</span><span className="ak-cell-sub line-clamp-1">{localize(banner, 'description') || tr('adminbanners_tesvir_yoxdur_12f487', 'Təsvir yoxdur')}</span></span>
      </span>) },
    { key: 'placement', header: 'Yer', sortable: true, sortValue: banner => banner.placement, cell: banner => <span className="ak-cell-sub">{placementLabel(banner.placement)}</span> },
    { key: 'targeting', header: 'Hədəf', mobile: 'hidden', cell: banner => {
      const chips = [
        banner.target_life_stages?.length ? <StatusPill key="ls" tone="violet" dot={false}><Target size={11} />{banner.target_life_stages.map(stage => LIFE_STAGES.find(item => item.value === stage)?.fallback || stage).join(', ')}</StatusPill> : null,
        banner.target_languages?.length ? <StatusPill key="lang" tone="info" dot={false}><Languages size={11} />{banner.target_languages.join(', ').toUpperCase()}</StatusPill> : null,
        banner.target_countries?.length ? <StatusPill key="c" tone="success" dot={false}><Globe2 size={11} />{banner.target_countries.length} ölkə</StatusPill> : null,
        banner.target_platforms?.length ? <StatusPill key="p" dot={false}>{banner.target_platforms.map(platform => PLATFORMS.find(item => item.value === platform)?.label || platform).join(', ')}</StatusPill> : null,
        freeOnly(banner) ? <StatusPill key="f" tone="danger" dot={false}>Yalnız Free</StatusPill> : null,
        banner.max_impressions_per_user ? <StatusPill key="m" tone="warning" dot={false}><Eye size={11} />≤{banner.max_impressions_per_user}</StatusPill> : null,
        banner.is_premium_only ? <StatusPill key="pr" tone="accent" dot={false}>Premium</StatusPill> : null,
      ].filter(Boolean);
      return chips.length ? <span className="flex flex-wrap gap-1">{chips}</span> : <span className="ak-cell-sub">Hamı</span>;
    } },
    { key: 'clicks', header: 'Klik / göstərilmə', align: 'end', sortable: true, sortValue: banner => statsOf(banner).clicks, cell: banner => { const st = statsOf(banner); return (
      <span className="ak-num" title={st.measured ? tr('adminbanners_olculmus_reklam', 'Reklam ölçməsi: real göstərilmə və kliklər') : undefined}><strong>{fmtNumber(st.clicks)}</strong><span className="ak-cell-sub">{fmtNumber(st.views)} {tr('adminbanners_gorunme_qisa', 'göstərilmə')}{st.views ? ` · ${((100 * st.clicks) / st.views).toFixed(1)}%` : ''}</span></span>); } },
    { key: 'active', header: 'Aktiv', align: 'center', cell: banner => <span onClick={event => event.stopPropagation()}><Switch checked={banner.is_active} onCheckedChange={() => void handleToggleActive(banner)} aria-label="Aktiv" /></span> },
  ], [localize, measured]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page testId="admin-banners">
      <PageHeader title={tr('adminbanners_banner_idaresi_bc3a16', 'Banner İdarəsi')} subtitle={tr('adminbanners_tetbiqdeki_bannerleri_idare_edin_a0927c', 'Tətbiqdəki bannerləri idarə edin')}
        actions={<Btn variant="primary" onClick={() => handleOpenDialog()}><Plus size={15} />Yeni Banner</Btn>} />
      <KpiRow columns={4}>
        <StatTile label={tr('adminbanners_umumi_banner_4d2adc', 'Ümumi Banner')} icon={<Layout size={13} />} loading={isLoading} value={fmtNumber(all.length)} />
        <StatTile label="Aktiv" tone="success" icon={<Eye size={13} />} loading={isLoading} value={fmtNumber(all.filter(banner => banner.is_active).length)} />
        <StatTile label={tr('adminbanners_umumi_klik_504648', 'Ümumi Klik')} icon={<MousePointer size={13} />} loading={isLoading} value={fmtNumber(all.reduce((sum, banner) => sum + statsOf(banner).clicks, 0))} />
        <StatTile label={tr('adminbanners_yerlesdirme_6c3e92', 'Yerləşdirmə')} icon={<BarChart3 size={13} />} loading={isLoading} value={fmtNumber(PLACEMENTS.length)} />
      </KpiRow>
      <Section flush>
        <div className="px-4 pb-3">
          <FilterChips label="Yerləşdirmə" value={activeTab} onChange={setActiveTab} options={[{ value: 'all', label: tr('adminbanners_hamisi_c73c4d', 'Hamısı'), count: all.length },
            ...PLACEMENTS.map(placement => ({ value: placement.value as string, label: placement.label, count: all.filter(banner => banner.placement === placement.value).length }))]} />
        </div>
        <DataTable testId="admin-banners-table" columns={columns} rows={isLoading ? undefined : filteredBanners} rowKey={banner => banner.id} loading={isLoading} error={isError ? true : null}
          onRetry={() => void refetch()} pageSize={25} onRowClick={banner => handleOpenDialog(banner)}
          empty={<EmptyState title={tr('adminbanners_bu_bolmede_banner_yoxdur_0fc4ad', 'Bu bölmədə banner yoxdur')} action={<Btn variant="primary" onClick={() => handleOpenDialog()}><Plus size={14} />Yeni Banner</Btn>} />}
          actions={[{ label: 'Redaktə', icon: <Edit2 size={14} />, onSelect: banner => handleOpenDialog(banner) }, { label: 'Sil', icon: <Trash2 size={14} />, danger: true, separatorBefore: true, onSelect: banner => void handleDelete(banner) }]} />
      </Section>

      <SideDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} size="lg" testId="admin-banner-drawer" dirty={JSON.stringify(formData) !== JSON.stringify(initial)}
        title={editingBanner ? tr('adminbanners_banneri_redakte_et_484526', 'Banneri Redaktə Et') : 'Yeni Banner'} onSave={() => void handleSave()}
        saving={createBanner.isPending || updateBanner.isPending} saveLabel={editingBanner ? tr('adminbanners_yenile_570ce2', 'Yenilə') : 'Yarat'}>
        {formData.banner_type === 'native' && (
          <div className="rounded-2xl p-4 flex items-center gap-4" aria-label={tr('adminbanners_onizleme_1f8cc7', 'Önizləmə')}
            style={{ background: `linear-gradient(135deg, ${formData.background_color || '#F48155'} 0%, ${formData.background_color || '#F48155'}cc 100%)`, color: formData.text_color || '#FFFFFF' }}>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"><Layout className="w-6 h-6" /></div>
            <div className="flex-1 min-w-0"><h3 className="font-semibold">{localize(formData, 'title') || tr('adminbanners_banner_basligi_0722c5', 'Banner Başlığı')}</h3><p className="text-sm opacity-90">{localize(formData, 'description') || tr('adminbanners_tesvir_f85651', 'Təsvir')}</p></div>
            <span className="text-sm font-medium">{localize(formData, 'button_text') || tr('adminbanners_daha_cox_7d8a93', 'Daha Çox')}</span>
          </div>
        )}
        <FormSection title="Məzmun">
          <FieldGrid>
            <div><Label>{tr('adminbanners_basliq_en_4ac905', 'Başlıq (EN)')}</Label><Input value={formData.title || ''} onChange={event => setFormData({ ...formData, title: event.target.value })} placeholder="Banner Title" /></div>
            <div><Label>{tr('adminbanners_basliq_az_3e294a', 'Başlıq (AZ)')}</Label><LocalizedInput formData={formData} setFormData={setFormData} field="title" label="Banner Başlığı" /></div>
            <div><Label>{tr('adminbanners_tesvir_en_c64521', 'Təsvir (EN)')}</Label><Textarea value={formData.description || ''} onChange={event => setFormData({ ...formData, description: event.target.value })} placeholder="Description" rows={2} /></div>
            <div><Label>{tr('adminbanners_tesvir_az_2c237a', 'Təsvir (AZ)')}</Label><LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Təsvir" rows={2} /></div>
          </FieldGrid>
        </FormSection>
        <FormSection title="Görünüş və keçid">
          <FieldGrid>
            <div><Label>Banner Tipi</Label><Select value={formData.banner_type} onValueChange={value => setFormData({ ...formData, banner_type: value as BannerType })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BANNER_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>{tr('adminbanners_yerlesdirme_6c3e92', 'Yerləşdirmə')}</Label><Select value={formData.placement} onValueChange={value => setFormData({ ...formData, placement: value as BannerPlacement })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PLACEMENTS.map(placement => <SelectItem key={placement.value} value={placement.value}>{placement.label}</SelectItem>)}</SelectContent></Select></div>
          </FieldGrid>
          {formData.banner_type === 'native' && (
            <>
              <FieldGrid>
                <div><Label>{tr('adminbanners_arxa_fon_rengi_c914c9', 'Arxa Fon Rəngi')}</Label>
                  <div className="flex items-center gap-2 mt-1 flex-wrap"><Input type="color" value={formData.background_color || '#F48155'} onChange={event => setFormData({ ...formData, background_color: event.target.value })} className="w-12 h-10 p-1" />
                    {DEFAULT_COLORS.map(color => <button key={color} type="button" aria-label={color} className="w-6 h-6 rounded-full border-2 border-transparent hover:border-gray-400" style={{ backgroundColor: color }} onClick={() => setFormData({ ...formData, background_color: color })} />)}</div></div>
                <div><Label>{tr('adminbanners_metn_rengi_b3857e', 'Mətn Rəngi')}</Label>
                  <div className="flex items-center gap-2 mt-1"><Input type="color" value={formData.text_color || '#FFFFFF'} onChange={event => setFormData({ ...formData, text_color: event.target.value })} className="w-12 h-10 p-1" />
                    <button type="button" aria-label="Ağ" className="w-6 h-6 rounded-full bg-white border" onClick={() => setFormData({ ...formData, text_color: '#FFFFFF' })} />
                    <button type="button" aria-label="Qara" className="w-6 h-6 rounded-full bg-black border" onClick={() => setFormData({ ...formData, text_color: '#000000' })} /></div></div>
              </FieldGrid>
              <FieldGrid>
                <div><Label>{tr('adminbanners_duyme_metni_en_f2f4bd', 'Düymə Mətni (EN)')}</Label><Input value={formData.button_text || ''} onChange={event => setFormData({ ...formData, button_text: event.target.value })} placeholder="Learn More" /></div>
                <div><Label>{tr('adminbanners_duyme_metni_az_75db00', 'Düymə Mətni (AZ)')}</Label><LocalizedInput formData={formData} setFormData={setFormData} field="button_text" label="Daha Çox" /></div>
              </FieldGrid>
            </>
          )}
          {formData.banner_type === 'image' && <div><Label>{tr('adminbanners_sekil_url_d302df', 'Şəkil URL')}</Label><Input value={formData.image_url || ''} onChange={event => setFormData({ ...formData, image_url: event.target.value })} placeholder="https://example.com/banner.jpg" />
            {formData.image_url && <img src={formData.image_url} alt="" className="mt-2 max-h-28 rounded-lg border object-cover" />}</div>}
          <FieldGrid>
            <div><Label>Link Tipi</Label><Select value={formData.link_type} onValueChange={value => setFormData({ ...formData, link_type: value as LinkType })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LINK_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>{formData.link_type === 'external' ? 'URL' : formData.link_type === 'internal' ? tr('adminbanners_sehife_billing_community_0eddb5', 'Səhifə (/billing, /community)') : tr('adminbanners_alet_id_baby_names_kick_counte_28c887', 'Alət ID (baby-names, kick-counter)')}</Label>
              <Input value={formData.link_url || ''} onChange={event => setFormData({ ...formData, link_url: event.target.value })} placeholder={formData.link_type === 'external' ? 'https://...' : formData.link_type === 'internal' ? '/books, /cakes, /tool/{id}' : 'baby-names'} /></div>
          </FieldGrid>
        </FormSection>
        <FormSection title={tr('adminbanners_hedefleme_basligi', '🎯 Hədəfləmə (Targeting)')} description="Heç nə seçilməzsə, banner hamıya göstərilir.">
          <div><Label>{tr('adminbanners_hedef_merheleler', 'Hədəf mərhələlər')}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">{LIFE_STAGES.map(stage => (
              <label key={stage.value} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-2 cursor-pointer hover:bg-muted/60">
                <Checkbox checked={(formData.target_life_stages || []).includes(stage.value)} onCheckedChange={() => toggleArrayValue('target_life_stages', stage.value)} />{tr(stage.labelKey, stage.fallback)}</label>))}</div></div>
          <div><Label>Platforma</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">{PLATFORMS.map(platform => (
              <label key={platform.value} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-2 cursor-pointer hover:bg-muted/60">
                <Checkbox checked={(formData.target_platforms || []).includes(platform.value)} onCheckedChange={() => toggleArrayValue('target_platforms', platform.value)} />{platform.label}</label>))}</div></div>
          {/* Auditoriya: Premium satış bannerləri yalnız Free istifadəçilərə */}
          <label className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-2 cursor-pointer hover:bg-muted/60">
            <Checkbox checked={freeOnly(formData)} disabled={!!formData.branded} onCheckedChange={value => setFormData({ ...formData, audience_tiers: value ? ['free'] : null })} />
            Yalnız Free istifadəçilər (Premium satış bannerləri üçün)</label>
          <div><Label>{tr('adminbanners_hedef_diller', 'Hədəf dillər')}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">{APP_LANGUAGES.map(language => (
              <label key={language.value} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-2 cursor-pointer hover:bg-muted/60">
                <Checkbox checked={(formData.target_languages || []).includes(language.value)} onCheckedChange={() => toggleArrayValue('target_languages', language.value)} />{language.label}</label>))}</div></div>
          <div><Label>{tr('adminbanners_hedef_olkeler', 'Hədəf ölkələr')}</Label>
            {(formData.target_countries?.length || 0) > 0 && <div className="flex flex-wrap gap-1.5 my-2">{formData.target_countries!.map(code => {
              const country = (countriesData as Array<{ isoAlpha2: string; name: string }>).find(item => item.isoAlpha2 === code);
              return <span key={code} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{country?.name || code}
                <button type="button" aria-label={`${country?.name || code} sil`} onClick={() => toggleArrayValue('target_countries', code)}><X className="w-3 h-3" /></button></span>;
            })}</div>}
            <Input value={countrySearch} onChange={event => setCountrySearch(event.target.value)} placeholder={tr('adminbanners_olke_axtar', 'Ölkə axtar...')} className="my-2" />
            <div className="max-h-[180px] overflow-y-auto border rounded-md p-2 space-y-0.5">
              {(countriesData as Array<{ isoAlpha2: string; name: string }>).filter(country => country.name.toLowerCase().includes(countrySearch.toLowerCase())).map(country => (
                <label key={country.isoAlpha2} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1">
                  <Checkbox checked={(formData.target_countries || []).includes(country.isoAlpha2)} onCheckedChange={() => toggleArrayValue('target_countries', country.isoAlpha2)} />{country.name}</label>))}
            </div></div>
          <FieldGrid cols={3}>
            <Field label={tr('adminbanners_maks_gorunme', 'Maksimum göstərilmə sayı (istifadəçi başına)')}>{id => <Input id={id} type="number" min={1} value={formData.max_impressions_per_user ?? ''}
              onChange={event => setFormData({ ...formData, max_impressions_per_user: event.target.value ? parseInt(event.target.value) : null })} placeholder={tr('adminbanners_maks_gorunme_placeholder', 'Limitsiz')} />}</Field>
            <Field label={tr('adminbanners_baslama_tarixi', 'Başlama tarixi (istəyə bağlı)')}>{id => <Input id={id} type="date" value={(formData.start_date as string) || ''} onChange={event => setFormData({ ...formData, start_date: event.target.value })} />}</Field>
            <Field label={tr('adminbanners_bitme_tarixi', 'Bitmə tarixi (istəyə bağlı)')}>{id => <Input id={id} type="date" value={(formData.end_date as string) || ''} onChange={event => setFormData({ ...formData, end_date: event.target.value })} />}</Field>
          </FieldGrid>
        </FormSection>
        <FormSection title="Status">
          <div className="flex flex-wrap items-end gap-5">
            <Field label={tr('adminbanners_sira_421c5f', 'Sıra')}>{id => <Input id={id} type="number" className="w-24" value={formData.sort_order || 0} onChange={event => setFormData({ ...formData, sort_order: parseInt(event.target.value) || 0 })} />}</Field>
            <label className="flex items-center gap-2 text-sm h-10"><Switch checked={formData.is_active} onCheckedChange={value => setFormData({ ...formData, is_active: value })} />Aktiv</label>
            <label className="flex items-center gap-2 text-sm h-10"><Switch checked={formData.is_premium_only} onCheckedChange={value => setFormData({ ...formData, is_premium_only: value })} />Premium Only</label>
          </div>
        </FormSection>
      </SideDrawer>
    </Page>
  );
};

export default AdminBanners;
