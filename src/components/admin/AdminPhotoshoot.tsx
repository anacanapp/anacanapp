import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Camera, Plus, Trash2, Edit2, Save, X,
  Palette, Shirt, Eye, Scissors, Image as ImageIcon,
  Loader2, Sparkles } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  usePhotoshootBackgrounds,
  usePhotoshootEyeColors,
  usePhotoshootHairColors,
  usePhotoshootHairStyles,
  usePhotoshootOutfits,
  usePhotoshootImageStyles } from
'@/hooks/useDynamicTools';
import { useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import AdminUsageStats from './AdminUsageStats';
import AdminPhotoGallery from './AdminPhotoGallery';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface EditingItem {
  id: string;
  type: 'background' | 'outfit' | 'eye_color' | 'hair_color' | 'hair_style' | 'image_style';
  data: Record<string, any>;
}

const AdminPhotoshoot = () => {
    const localize = useAdminLocalize();
  const [activeTab, setActiveTab] = useState('image-styles');
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // NOT: Əvvəllər bu 6 bölmənin heç birində Redaktə (Edit) düyməsi yox idi —
  // `editingItem` state-i mövcud idi və `handleSaveX(item, false)` (update)
  // budaqları tam yazılmışdı, amma HEÇ VAXT çağırıla bilmirdi (dead code).
  // Bir dublikat/typo düzəltmək üçün admin-in yeganə yolu silib yenidən
  // yaratmaq idi (id-ni və istinadları itirərək). `formItem`/`updateFormItem`
  // "Yeni əlavə et" (newItem) və "Redaktə et" (editingItem.data) rejimlərini
  // eyni forma JSX-i ilə paylaşmağa imkan verir.
  const formItem: Record<string, any> = editingItem ? editingItem.data : newItem;
  const updateFormItem = (data: Record<string, any>) => {
    if (editingItem) {
      setEditingItem({ ...editingItem, data });
    } else {
      setNewItem(data);
    }
  };
  const closeForm = () => {
    setIsAdding(false);
    setNewItem({});
    setEditingItem(null);
  };
  const startEdit = (type: EditingItem['type'], item: Record<string, any>) => {
    setIsAdding(false);
    setNewItem({});
    setEditingItem({ id: item.id, type, data: { ...item } });
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: backgrounds = [], isLoading: loadingBg } = usePhotoshootBackgrounds();
  const { data: eyeColors = [], isLoading: loadingEye } = usePhotoshootEyeColors();
  const { data: hairColors = [], isLoading: loadingHairC } = usePhotoshootHairColors();
  const { data: hairStyles = [], isLoading: loadingHairS } = usePhotoshootHairStyles();
  const { data: outfits = [], isLoading: loadingOutfit } = usePhotoshootOutfits();
  const { data: imageStyles = [], isLoading: loadingStyles } = usePhotoshootImageStyles();

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['photoshoot-backgrounds'] });
    queryClient.invalidateQueries({ queryKey: ['photoshoot-eye-colors'] });
    queryClient.invalidateQueries({ queryKey: ['photoshoot-hair-colors'] });
    queryClient.invalidateQueries({ queryKey: ['photoshoot-hair-styles'] });
    queryClient.invalidateQueries({ queryKey: ['photoshoot-outfits'] });
    queryClient.invalidateQueries({ queryKey: ['photoshoot-image-styles'] });
  };

  // CRUD Operations
  const handleSaveBackground = async (item: Record<string, any>, isNew: boolean) => {
    setSaving(true);
    try {
      // NOT: əvvəllər sabit sahə siyahısı göndərilirdi (yalnız _az/bare) —
      // LocalizedInput admin dili ru/tr/kk/de/ar olanda theme_name_ru və s.
      // yazırdı, amma bunlar heç vaxt DB-yə çatmırdı (sessiz itki). İndi
      // bütün item (bütün dil sahələri daxil) spread olunur.
      const { type, id, ...rest } = item;
      if (isNew) {
        const { error } = await supabase.
        from('photoshoot_backgrounds').
        insert({
          category_id: 'custom',
          category_name: 'Custom',
          category_name_az: tr("adminphotoshoot_xususi_1055b8", "X\xFCsusi"),
          theme_emoji: '🎨',
          gender: 'unisex',
          ...rest,
          is_active: true,
          sort_order: backgrounds.length
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.
        from('photoshoot_backgrounds').
        update(rest).
        eq('id', id);
        if (error) throw error;
      }

      refreshData();
      closeForm();
      toast({ title: tr("adminphotoshoot_ugurla_yadda_saxlanildi_4a21f2", "Uğurla yadda saxlanıldı!") });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOutfit = async (item: Record<string, any>, isNew: boolean) => {
    setSaving(true);
    try {
      const { type, id, ...rest } = item;
      if (isNew) {
        const { error } = await supabase.
        from('photoshoot_outfits').
        insert({
          emoji: '👕',
          gender: 'all',
          ...rest,
          is_active: true,
          sort_order: outfits.length
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.
        from('photoshoot_outfits').
        update(rest).
        eq('id', id);
        if (error) throw error;
      }

      refreshData();
      closeForm();
      toast({ title: tr("adminphotoshoot_ugurla_yadda_saxlanildi_4a21f2", "Uğurla yadda saxlanıldı!") });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEyeColor = async (item: Record<string, any>, isNew: boolean) => {
    setSaving(true);
    try {
      const { type, id, ...rest } = item;
      if (isNew) {
        const { error } = await supabase.
        from('photoshoot_eye_colors').
        insert({
          hex_value: 'from-gray-400 to-gray-500',
          ...rest,
          is_active: true,
          sort_order: eyeColors.length
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.
        from('photoshoot_eye_colors').
        update(rest).
        eq('id', id);
        if (error) throw error;
      }

      refreshData();
      closeForm();
      toast({ title: tr("adminphotoshoot_ugurla_yadda_saxlanildi_4a21f2", "Uğurla yadda saxlanıldı!") });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHairColor = async (item: Record<string, any>, isNew: boolean) => {
    setSaving(true);
    try {
      const { type, id, ...rest } = item;
      if (isNew) {
        const { error } = await supabase.
        from('photoshoot_hair_colors').
        insert({
          hex_value: 'from-gray-400 to-gray-500',
          ...rest,
          is_active: true,
          sort_order: hairColors.length
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.
        from('photoshoot_hair_colors').
        update(rest).
        eq('id', id);
        if (error) throw error;
      }

      refreshData();
      closeForm();
      toast({ title: tr("adminphotoshoot_ugurla_yadda_saxlanildi_4a21f2", "Uğurla yadda saxlanıldı!") });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHairStyle = async (item: Record<string, any>, isNew: boolean) => {
    setSaving(true);
    try {
      const { type, id, ...rest } = item;
      if (isNew) {
        const { error } = await supabase.
        from('photoshoot_hair_styles').
        insert({
          emoji: '✨',
          ...rest,
          is_active: true,
          sort_order: hairStyles.length
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.
        from('photoshoot_hair_styles').
        update(rest).
        eq('id', id);
        if (error) throw error;
      }

      refreshData();
      closeForm();
      toast({ title: tr("adminphotoshoot_ugurla_yadda_saxlanildi_4a21f2", "Uğurla yadda saxlanıldı!") });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveImageStyle = async (item: Record<string, any>, isNew: boolean) => {
    setSaving(true);
    try {
      const { type, id, ...rest } = item;
      if (isNew) {
        const { error } = await supabase.
        from('photoshoot_image_styles').
        insert({
          emoji: '🎨',
          ...rest,
          is_active: true,
          sort_order: imageStyles.length
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.
        from('photoshoot_image_styles').
        update(rest).
        eq('id', id);
        if (error) throw error;
      }

      refreshData();
      closeForm();
      toast({ title: tr("adminphotoshoot_ugurla_yadda_saxlanildi_4a21f2", "Uğurla yadda saxlanıldı!") });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table: 'photoshoot_backgrounds' | 'photoshoot_outfits' | 'photoshoot_eye_colors' | 'photoshoot_hair_colors' | 'photoshoot_hair_styles' | 'photoshoot_image_styles', id: string) => {
    if (!confirm(tr("adminphotoshoot_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;

    try {
      const { error } = await supabase.
      from(table).
      delete().
      eq('id', id);

      if (error) throw error;
      refreshData();
      toast({ title: tr("adminphotoshoot_ugurla_silindi_430290", "Uğurla silindi!") });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (table: 'photoshoot_backgrounds' | 'photoshoot_outfits' | 'photoshoot_eye_colors' | 'photoshoot_hair_colors' | 'photoshoot_hair_styles' | 'photoshoot_image_styles', id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.
      from(table).
      update({ is_active: !currentStatus }).
      eq('id', id);

      if (error) throw error;
      refreshData();
      toast({ title: currentStatus ? 'Deaktiv edildi' : 'Aktiv edildi' });
    } catch (error: any) {
      toast({ title: tr("adminphotoshoot_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Camera className="w-7 h-7 text-primary" />
            {tr("adminphotoshoot_fotosessiya_i_dareetme_0619da", "Fotosessiya \u0130dar\u0259etm\u0259")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr("adminphotoshoot_ai_foto_generator_ucun_fonlar__eb0e58", "AI foto generator \xFC\xE7\xFCn fonlar, geyiml\u0259r, sa\xE7 v\u0259 g\xF6z r\u0259ngl\u0259ri")}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-200">
          <CardContent className="p-3 text-center">
            <Sparkles className="w-5 h-5 mx-auto text-violet-500 mb-1" />
            <p className="text-xl font-bold">{imageStyles.length}</p>
            <p className="text-xs text-muted-foreground">{tr("adminphotoshoot_sekil_novu_c47221", "Şəkil Növü")}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-200">
          <CardContent className="p-3 text-center">
            <ImageIcon className="w-5 h-5 mx-auto text-pink-500 mb-1" />
            <p className="text-xl font-bold">{backgrounds.length}</p>
            <p className="text-xs text-muted-foreground">Fon</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-200">
          <CardContent className="p-3 text-center">
            <Shirt className="w-5 h-5 mx-auto text-purple-500 mb-1" />
            <p className="text-xl font-bold">{outfits.length}</p>
            <p className="text-xs text-muted-foreground">Geyim</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-200">
          <CardContent className="p-3 text-center">
            <Eye className="w-5 h-5 mx-auto text-blue-500 mb-1" />
            <p className="text-xl font-bold">{eyeColors.length}</p>
            <p className="text-xs text-muted-foreground">{tr("adminphotoshoot_goz_rengi_8fe8d7", "Göz Rəngi")}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-200">
          <CardContent className="p-3 text-center">
            <Palette className="w-5 h-5 mx-auto text-amber-500 mb-1" />
            <p className="text-xl font-bold">{hairColors.length}</p>
            <p className="text-xs text-muted-foreground">{tr("adminphotoshoot_sac_rengi_68dd12", "Saç Rəngi")}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-200">
          <CardContent className="p-3 text-center">
            <Scissors className="w-5 h-5 mx-auto text-green-500 mb-1" />
            <p className="text-xl font-bold">{hairStyles.length}</p>
            <p className="text-xs text-muted-foreground">{tr("adminphotoshoot_sac_formasi_5d3388", "Saç Forması")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="gallery" className="gap-1 text-xs">
            <Camera className="w-3.5 h-3.5" /> Qalereya
          </TabsTrigger>
          <TabsTrigger value="image-styles" className="gap-1 text-xs">
            <Sparkles className="w-3.5 h-3.5" /> {tr("adminphotoshoot_sekil_novu_c47221", "\u015E\u0259kil N\xF6v\xFC")}
          </TabsTrigger>
          <TabsTrigger value="backgrounds" className="gap-1 text-xs">
            <ImageIcon className="w-3.5 h-3.5" /> Fonlar
          </TabsTrigger>
          <TabsTrigger value="outfits" className="gap-1 text-xs">
            <Shirt className="w-3.5 h-3.5" /> {tr("adminphotoshoot_geyimler_c13678", "Geyiml\u0259r")}
          </TabsTrigger>
          <TabsTrigger value="eye-colors" className="gap-1 text-xs">
            <Eye className="w-3.5 h-3.5" /> {tr("adminphotoshoot_goz_fbc05e", "G\xF6z")}
          </TabsTrigger>
          <TabsTrigger value="hair-colors" className="gap-1 text-xs">
            <Palette className="w-3.5 h-3.5" /> {tr("adminphotoshoot_sac_rengi_68dd12", "Sa\xE7 R\u0259ngi")}
          </TabsTrigger>
          <TabsTrigger value="hair-styles" className="gap-1 text-xs">
            <Scissors className="w-3.5 h-3.5" /> {tr("adminphotoshoot_sac_stili_bc944d", "Sa\xE7 Stili")}
          </TabsTrigger>
        </TabsList>

        {/* Image Styles Tab */}
        <TabsContent value="image-styles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{tr("adminphotoshoot_sekil_novleri_1d0187", "\u015E\u0259kil N\xF6vl\u0259ri (")}{imageStyles.length})</h3>
            <Button onClick={() => {setEditingItem(null);setIsAdding(true);setNewItem({ type: 'image_style' });}}>
              <Plus className="w-4 h-4 me-2" /> Yeni Stil
            </Button>
          </div>

          {((isAdding && newItem.type === 'image_style') || editingItem?.type === 'image_style') &&
          <Card className="border-primary">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                  placeholder="Stil ID (meselen: 3d_disney)"
                  value={formItem.style_id || ''}
                  disabled={!!editingItem}
                  onChange={(e) => updateFormItem({ ...formItem, style_id: e.target.value })} />
                
                  <Input
                  placeholder="Emoji"
                  value={formItem.emoji || ''}
                  onChange={(e) => updateFormItem({ ...formItem, emoji: e.target.value })} />
                
                  <Input
                  placeholder={tr("adminphotoshoot_ingilis_adi_0325b8", "İngilis adı")}
                  value={formItem.style_name || ''}
                  onChange={(e) => updateFormItem({ ...formItem, style_name: e.target.value })} />
                
                  <LocalizedInput formData={formItem} setFormData={updateFormItem} field="style_name" label="Azərbaycan adı" />
                
                </div>
                <Textarea
                placeholder={tr("adminphotoshoot_prompt_modifier_ai_stil_ucun_d0558d", "Prompt Modifier (AI stil üçün)")}
                value={formItem.prompt_modifier || ''}
                onChange={(e) => updateFormItem({ ...formItem, prompt_modifier: e.target.value })}
                rows={3} />
              
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveImageStyle(formItem, !editingItem)} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="ms-2">{editingItem ? tr("adminphotoshoot_yenile_570ce2", "Yenilə") : 'Yadda saxla'}</span>
                  </Button>
                  <Button variant="outline" onClick={closeForm}>
                    <X className="w-4 h-4 me-2" /> {tr("adminphotoshoot_legv_et_b5e49c", "L\u0259\u011Fv et")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          }

          <div className="grid grid-cols-2 gap-3">
            {loadingStyles ?
            <div className="col-span-2 flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div> :

            imageStyles.map((style: any) =>
            <Card key={style.id} className={!style.is_active ? 'opacity-50' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{style.emoji}</span>
                        <div>
                          <p className="font-medium">{localize(style, 'style_name')}</p>
                          <p className="text-xs text-muted-foreground">{style.style_id}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                      variant="outline"
                      size="icon"
                      onClick={() => startEdit('image_style', style)}>
                      
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive('photoshoot_image_styles', style.id, style.is_active)}>
                      
                          {style.is_active ? 'Deaktiv' : 'Aktiv'}
                        </Button>
                        <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete('photoshoot_image_styles', style.id)}>
                      
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {style.prompt_modifier &&
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2 line-clamp-2">
                        {style.prompt_modifier}
                      </p>
                }
                  </CardContent>
                </Card>
            )
            }
          </div>
        </TabsContent>

        {/* Backgrounds Tab */}
        <TabsContent value="backgrounds" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{tr("adminphotoshoot_butun_fonlar_19b064", "B\xFCt\xFCn Fonlar (")}{backgrounds.length})</h3>
            <Button onClick={() => {setEditingItem(null);setIsAdding(true);setNewItem({ type: 'background' });}}>
              <Plus className="w-4 h-4 me-2" /> Yeni Fon
            </Button>
          </div>

          {((isAdding && newItem.type === 'background') || editingItem?.type === 'background') &&
          <Card className="border-primary">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                  placeholder="Theme ID (meselen: garden_party)"
                  value={formItem.theme_id || ''}
                  disabled={!!editingItem}
                  onChange={(e) => updateFormItem({ ...formItem, theme_id: e.target.value })} />
                
                  <Input
                  placeholder="Emoji"
                  value={formItem.theme_emoji || ''}
                  onChange={(e) => updateFormItem({ ...formItem, theme_emoji: e.target.value })} />
                
                  <Input
                  placeholder={tr("adminphotoshoot_ingilis_adi_0325b8", "İngilis adı")}
                  value={formItem.theme_name || ''}
                  onChange={(e) => updateFormItem({ ...formItem, theme_name: e.target.value })} />
                
                  <LocalizedInput formData={formItem} setFormData={updateFormItem} field="theme_name" label="Azərbaycan adı" />
                
                  <Input
                  placeholder={tr("adminphotoshoot_kateqoriya_ingilis_a39e44", "Kateqoriya (İngilis)")}
                  value={formItem.category_name || ''}
                  onChange={(e) => updateFormItem({ ...formItem, category_name: e.target.value })} />
                
                  <LocalizedInput formData={formItem} setFormData={updateFormItem} field="category_name" label="Kateqoriya" />
                
                </div>
                <Textarea
                placeholder={tr("adminphotoshoot_prompt_template_ai_ucun_39b0ad", "Prompt Template (AI üçün)")}
                value={formItem.prompt_template || ''}
                onChange={(e) => updateFormItem({ ...formItem, prompt_template: e.target.value })}
                rows={3} />
              
                <Select
                value={formItem.gender || 'unisex'}
                onValueChange={(v) => updateFormItem({ ...formItem, gender: v })}>
                
                  <SelectTrigger>
                    <SelectValue placeholder={tr("adminphotoshoot_cinsiyyet_1526fb", "Cinsiyyət")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unisex">{tr("adminphotoshoot_hami_ucun_97455b", "Hamı üçün")}</SelectItem>
                    <SelectItem value="boy">{tr("adminphotoshoot_oglan_e9715e", "Oğlan")}</SelectItem>
                    <SelectItem value="girl">{tr("adminphotoshoot_qiz_79bf6b", "Qız")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveBackground(formItem, !editingItem)} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="ms-2">{editingItem ? tr("adminphotoshoot_yenile_570ce2", "Yenilə") : 'Yadda saxla'}</span>
                  </Button>
                  <Button variant="outline" onClick={closeForm}>
                    <X className="w-4 h-4 me-2" /> {tr("adminphotoshoot_legv_et_b5e49c", "L\u0259\u011Fv et")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          }

          <div className="grid gap-3">
            {loadingBg ?
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div> :

            (backgrounds as any[]).map((bg) =>
            <Card key={bg.id} className={!bg.is_active ? 'opacity-50' : ''}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{bg.theme_emoji}</span>
                      <div>
                        <p className="font-medium">{localize(bg, 'theme_name')}</p>
                        <p className="text-sm text-muted-foreground">
                          {localize(bg, 'category_name')} • {bg.gender === 'boy' ? tr("adminphotoshoot_oglan_c41cd8", "\uD83D\uDC66 O\u011Flan") : bg.gender === 'girl' ? tr("adminphotoshoot_qiz_cc9008", "\uD83D\uDC67 Q\u0131z") : tr("adminphotoshoot_hami_77353a", "\uD83D\uDC76 Ham\u0131")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit('background', bg)}>
                    
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive('photoshoot_backgrounds', bg.id, bg.is_active)}>
                    
                        {bg.is_active ? 'Deaktiv' : 'Aktiv'}
                      </Button>
                      <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete('photoshoot_backgrounds', bg.id)}>
                    
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
            )
            }
          </div>
        </TabsContent>

        {/* Outfits Tab */}
        <TabsContent value="outfits" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{tr("adminphotoshoot_butun_geyimler_45a2c6", "B\xFCt\xFCn Geyiml\u0259r (")}{outfits.length})</h3>
            <Button onClick={() => {setEditingItem(null);setIsAdding(true);setNewItem({ type: 'outfit' });}}>
              <Plus className="w-4 h-4 me-2" /> Yeni Geyim
            </Button>
          </div>

          {((isAdding && newItem.type === 'outfit') || editingItem?.type === 'outfit') &&
          <Card className="border-primary">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                  placeholder="Outfit ID (meselen: princess_dress)"
                  value={formItem.outfit_id || ''}
                  disabled={!!editingItem}
                  onChange={(e) => updateFormItem({ ...formItem, outfit_id: e.target.value })} />
                
                  <Input
                  placeholder="Emoji"
                  value={formItem.emoji || ''}
                  onChange={(e) => updateFormItem({ ...formItem, emoji: e.target.value })} />
                
                  <Input
                  placeholder={tr("adminphotoshoot_ingilis_adi_0325b8", "İngilis adı")}
                  value={formItem.outfit_name || ''}
                  onChange={(e) => updateFormItem({ ...formItem, outfit_name: e.target.value })} />
                
                  <LocalizedInput formData={formItem} setFormData={updateFormItem} field="outfit_name" label="Azərbaycan adı" />
                
                </div>
                <Select
                value={formItem.gender || 'all'}
                onValueChange={(v) => updateFormItem({ ...formItem, gender: v })}>
                
                  <SelectTrigger>
                    <SelectValue placeholder={tr("adminphotoshoot_cinsiyyet_1526fb", "Cinsiyyət")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr("adminphotoshoot_hami_ucun_97455b", "Hamı üçün")}</SelectItem>
                    <SelectItem value="boy">{tr("adminphotoshoot_oglan_e9715e", "Oğlan")}</SelectItem>
                    <SelectItem value="girl">{tr("adminphotoshoot_qiz_79bf6b", "Qız")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveOutfit(formItem, !editingItem)} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="ms-2">{editingItem ? tr("adminphotoshoot_yenile_570ce2", "Yenilə") : 'Yadda saxla'}</span>
                  </Button>
                  <Button variant="outline" onClick={closeForm}>
                    <X className="w-4 h-4 me-2" /> {tr("adminphotoshoot_legv_et_b5e49c", "L\u0259\u011Fv et")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          }

          <div className="grid gap-3">
            {loadingOutfit ?
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div> :

            outfits.map((outfit: any) =>
            <Card key={outfit.id} className={!outfit.is_active ? 'opacity-50' : ''}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{outfit.emoji}</span>
                      <div>
                        <p className="font-medium">{localize(outfit, 'outfit_name')}</p>
                        <p className="text-sm text-muted-foreground">
                          {outfit.gender === 'boy' ? tr("adminphotoshoot_oglan_c41cd8", "\uD83D\uDC66 O\u011Flan") : outfit.gender === 'girl' ? tr("adminphotoshoot_qiz_cc9008", "\uD83D\uDC67 Q\u0131z") : tr("adminphotoshoot_hami_ucun_c75ad9", "\uD83D\uDC76 Ham\u0131 \xFC\xE7\xFCn")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit('outfit', outfit)}>
                    
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive('photoshoot_outfits', outfit.id, outfit.is_active)}>
                    
                        {outfit.is_active ? 'Deaktiv' : 'Aktiv'}
                      </Button>
                      <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete('photoshoot_outfits', outfit.id)}>
                    
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
            )
            }
          </div>
        </TabsContent>

        {/* Eye Colors Tab */}
        <TabsContent value="eye-colors" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{tr("adminphotoshoot_butun_goz_rengleri_f4f265", "B\xFCt\xFCn G\xF6z R\u0259ngl\u0259ri (")}{eyeColors.length})</h3>
            <Button onClick={() => {setEditingItem(null);setIsAdding(true);setNewItem({ type: 'eye_color' });}}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminphotoshoot_yeni_goz_rengi_b3befd", "Yeni G\xF6z R\u0259ngi")}
            </Button>
          </div>

          {((isAdding && newItem.type === 'eye_color') || editingItem?.type === 'eye_color') &&
          <Card className="border-primary">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                  placeholder="Color ID (meselen: hazel)"
                  value={formItem.color_id || ''}
                  disabled={!!editingItem}
                  onChange={(e) => updateFormItem({ ...formItem, color_id: e.target.value })} />
                
                  <Input
                  placeholder="Gradient (from-blue-400 to-blue-600)"
                  value={formItem.hex_value || ''}
                  onChange={(e) => updateFormItem({ ...formItem, hex_value: e.target.value })} />
                
                  <Input
                  placeholder={tr("adminphotoshoot_ingilis_adi_0325b8", "İngilis adı")}
                  value={formItem.color_name || ''}
                  onChange={(e) => updateFormItem({ ...formItem, color_name: e.target.value })} />
                
                  <LocalizedInput formData={formItem} setFormData={updateFormItem} field="color_name" label="Azərbaycan adı" />
                
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveEyeColor(formItem, !editingItem)} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="ms-2">{editingItem ? tr("adminphotoshoot_yenile_570ce2", "Yenilə") : 'Yadda saxla'}</span>
                  </Button>
                  <Button variant="outline" onClick={closeForm}>
                    <X className="w-4 h-4 me-2" /> {tr("adminphotoshoot_legv_et_b5e49c", "L\u0259\u011Fv et")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          }

          <div className="grid grid-cols-2 gap-3">
            {loadingEye ?
            <div className="col-span-2 flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div> :

            eyeColors.map((color: any) =>
            <Card key={color.id} className={!color.is_active ? 'opacity-50' : ''}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${color.hex_value}`} />
                      <div>
                        <p className="font-medium">{localize(color, 'color_name')}</p>
                        <p className="text-xs text-muted-foreground">{color.color_id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit('eye_color', color)}>
                    
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive('photoshoot_eye_colors', color.id, color.is_active)}>
                    
                        {color.is_active ? 'Deaktiv' : 'Aktiv'}
                      </Button>
                      <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete('photoshoot_eye_colors', color.id)}>
                    
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
            )
            }
          </div>
        </TabsContent>

        {/* Hair Colors Tab */}
        <TabsContent value="hair-colors" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{tr("adminphotoshoot_butun_sac_rengleri_7ef7b8", "B\xFCt\xFCn Sa\xE7 R\u0259ngl\u0259ri (")}{hairColors.length})</h3>
            <Button onClick={() => {setEditingItem(null);setIsAdding(true);setNewItem({ type: 'hair_color' });}}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminphotoshoot_yeni_sac_rengi_961241", "Yeni Sa\xE7 R\u0259ngi")}
            </Button>
          </div>

          {((isAdding && newItem.type === 'hair_color') || editingItem?.type === 'hair_color') &&
          <Card className="border-primary">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                  placeholder="Color ID (meselen: auburn)"
                  value={formItem.color_id || ''}
                  disabled={!!editingItem}
                  onChange={(e) => updateFormItem({ ...formItem, color_id: e.target.value })} />
                
                  <Input
                  placeholder="Gradient (from-amber-600 to-amber-800)"
                  value={formItem.hex_value || ''}
                  onChange={(e) => updateFormItem({ ...formItem, hex_value: e.target.value })} />
                
                  <Input
                  placeholder={tr("adminphotoshoot_ingilis_adi_0325b8", "İngilis adı")}
                  value={formItem.color_name || ''}
                  onChange={(e) => updateFormItem({ ...formItem, color_name: e.target.value })} />
                
                  <LocalizedInput formData={formItem} setFormData={updateFormItem} field="color_name" label="Azərbaycan adı" />
                
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveHairColor(formItem, !editingItem)} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="ms-2">{editingItem ? tr("adminphotoshoot_yenile_570ce2", "Yenilə") : 'Yadda saxla'}</span>
                  </Button>
                  <Button variant="outline" onClick={closeForm}>
                    <X className="w-4 h-4 me-2" /> {tr("adminphotoshoot_legv_et_b5e49c", "L\u0259\u011Fv et")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          }

          <div className="grid grid-cols-2 gap-3">
            {loadingHairC ?
            <div className="col-span-2 flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div> :

            hairColors.map((color: any) =>
            <Card key={color.id} className={!color.is_active ? 'opacity-50' : ''}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${color.hex_value}`} />
                      <div>
                        <p className="font-medium">{localize(color, 'color_name')}</p>
                        <p className="text-xs text-muted-foreground">{color.color_id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit('hair_color', color)}>
                    
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive('photoshoot_hair_colors', color.id, color.is_active)}>
                    
                        {color.is_active ? 'Deaktiv' : 'Aktiv'}
                      </Button>
                      <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete('photoshoot_hair_colors', color.id)}>
                    
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
            )
            }
          </div>
        </TabsContent>

        {/* Hair Styles Tab */}
        <TabsContent value="hair-styles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{tr("adminphotoshoot_butun_sac_formalari_e89a19", "B\xFCt\xFCn Sa\xE7 Formalar\u0131 (")}{hairStyles.length})</h3>
            <Button onClick={() => {setEditingItem(null);setIsAdding(true);setNewItem({ type: 'hair_style' });}}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminphotoshoot_yeni_sac_formasi_3063a3", "Yeni Sa\xE7 Formas\u0131")}
            </Button>
          </div>

          {((isAdding && newItem.type === 'hair_style') || editingItem?.type === 'hair_style') &&
          <Card className="border-primary">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                  placeholder="Style ID (meselen: ponytail)"
                  value={formItem.style_id || ''}
                  disabled={!!editingItem}
                  onChange={(e) => updateFormItem({ ...formItem, style_id: e.target.value })} />
                
                  <Input
                  placeholder="Emoji"
                  value={formItem.emoji || ''}
                  onChange={(e) => updateFormItem({ ...formItem, emoji: e.target.value })} />
                
                  <Input
                  placeholder={tr("adminphotoshoot_ingilis_adi_0325b8", "İngilis adı")}
                  value={formItem.style_name || ''}
                  onChange={(e) => updateFormItem({ ...formItem, style_name: e.target.value })} />
                
                  <LocalizedInput formData={formItem} setFormData={updateFormItem} field="style_name" label="Azərbaycan adı" />
                
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveHairStyle(formItem, !editingItem)} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="ms-2">{editingItem ? tr("adminphotoshoot_yenile_570ce2", "Yenilə") : 'Yadda saxla'}</span>
                  </Button>
                  <Button variant="outline" onClick={closeForm}>
                    <X className="w-4 h-4 me-2" /> {tr("adminphotoshoot_legv_et_b5e49c", "L\u0259\u011Fv et")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          }

          <div className="grid grid-cols-2 gap-3">
            {loadingHairS ?
            <div className="col-span-2 flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div> :

            hairStyles.map((style: any) =>
            <Card key={style.id} className={!style.is_active ? 'opacity-50' : ''}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{style.emoji}</span>
                      <div>
                        <p className="font-medium">{localize(style, 'style_name')}</p>
                        <p className="text-xs text-muted-foreground">{style.style_id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit('hair_style', style)}>
                    
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive('photoshoot_hair_styles', style.id, style.is_active)}>
                    
                        {style.is_active ? 'Deaktiv' : 'Aktiv'}
                      </Button>
                      <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete('photoshoot_hair_styles', style.id)}>
                    
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
            )
            }
          </div>
        </TabsContent>
        <TabsContent value="gallery">
          <AdminPhotoGallery />
        </TabsContent>
      </Tabs>

      <AdminUsageStats
        eventNames={['baby_photo_generated', 'tool_opened']}
        title={tr("adminphotoshoot_foto_generator_istifade_statistikasi_a9e4ef", "📸 Foto Generator İstifadə Statistikası")}
        showEventData
        showUsers />
      
    </div>);

};

export default AdminPhotoshoot;