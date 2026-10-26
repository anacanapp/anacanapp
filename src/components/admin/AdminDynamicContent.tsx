import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Dumbbell, Volume2, Camera, Gift, Baby, Heart, Smile,
  UtensilsCrossed, ShoppingBag, Plus, Pencil, Trash2, Search,
  ChevronDown, ChevronUp } from
'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  useExercisesAdmin,
  useWhiteNoiseSoundsAdmin,
  useSurpriseIdeasAdmin,
  useBabyMilestonesDBAdmin,
  useSymptomsAdmin,
  useCommonFoodsAdmin,
  useShopCategoriesAdmin,
  usePhotoshootThemesAdmin,
  useMoodOptionsAdmin } from
'@/hooks/useDynamicConfig';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

type ContentType = 'exercises' | 'sounds' | 'surprises' | 'milestones' | 'symptoms' | 'foods' | 'categories' | 'themes' | 'moods';

const AdminDynamicContent = () => {
    const localize = useAdminLocalize();
  const [activeTab, setActiveTab] = useState<ContentType>('exercises');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  // Hooks
  const exercises = useExercisesAdmin();
  const sounds = useWhiteNoiseSoundsAdmin();
  const surprises = useSurpriseIdeasAdmin();
  const milestones = useBabyMilestonesDBAdmin();
  const symptoms = useSymptomsAdmin();
  const foods = useCommonFoodsAdmin();
  const categories = useShopCategoriesAdmin();
  const themes = usePhotoshootThemesAdmin();
  const moods = useMoodOptionsAdmin();

  const tabs = [
  { id: 'exercises', label: tr("admindynamiccontent_mesqler_603be9", "Məşqlər"), icon: Dumbbell, count: exercises.data?.length || 0 },
  { id: 'sounds', label: tr("admindynamiccontent_sesler_e66894", "Səslər"), icon: Volume2, count: sounds.data?.length || 0 },
  { id: 'themes', label: tr("admindynamiccontent_foto_movzulari_b28412", "Foto Mövzuları"), icon: Camera, count: themes.data?.length || 0 },
  { id: 'surprises', label: tr("admindynamiccontent_surprizler_422463", "Sürprizlər"), icon: Gift, count: surprises.data?.length || 0 },
  { id: 'milestones', label: tr("admindynamiccontent_merheleler_5eb66e", "Mərhələlər"), icon: Baby, count: milestones.data?.length || 0 },
  { id: 'symptoms', label: 'Simptomlar', icon: Heart, count: symptoms.data?.length || 0 },
  { id: 'moods', label: tr("admindynamiccontent_ehvallar_7eced7", "Əhvallar"), icon: Smile, count: moods.data?.length || 0 },
  { id: 'foods', label: 'Qidalar', icon: UtensilsCrossed, count: foods.data?.length || 0 },
  { id: 'categories', label: 'Kateqoriyalar', icon: ShoppingBag, count: categories.data?.length || 0 }];


  const getCurrentData = () => {
    switch (activeTab) {
      case 'exercises':return exercises.data || [];
      case 'sounds':return sounds.data || [];
      case 'surprises':return surprises.data || [];
      case 'milestones':return milestones.data || [];
      case 'symptoms':return symptoms.data || [];
      case 'foods':return foods.data || [];
      case 'categories':return categories.data || [];
      case 'themes':return themes.data || [];
      case 'moods':return moods.data || [];
      default:return [];
    }
  };

  const getCurrentHook = () => {
    switch (activeTab) {
      case 'exercises':return exercises;
      case 'sounds':return sounds;
      case 'surprises':return surprises;
      case 'milestones':return milestones;
      case 'symptoms':return symptoms;
      case 'foods':return foods;
      case 'categories':return categories;
      case 'themes':return themes;
      case 'moods':return moods;
      default:return exercises;
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(getDefaultFormData());
    setShowModal(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const getDefaultFormData = () => {
    switch (activeTab) {
      case 'exercises':
        return { name: '', name_az: '', duration_minutes: 10, calories: 50, level: 'easy', trimester: [1, 2, 3], icon: '🧘', description: '', steps: [], is_active: true, sort_order: 0, is_postpartum: false, postpartum_week_start: 0, postpartum_week_end: null, postpartum_delivery_types: [] };
      case 'sounds':
        return { name: '', name_az: '', emoji: '🎵', color_gradient: 'from-blue-400 to-cyan-500', audio_url: '', noise_type: 'white', description: '', description_az: '', is_active: true, sort_order: 0 };
      case 'surprises':
        return { title: '', description: '', emoji: '🎁', icon: 'gift', category: 'romantic', difficulty: 'easy', points: 10, is_active: true, sort_order: 0 };
      case 'milestones':
        return { milestone_key: '', week_number: 1, label: '', label_az: '', emoji: '👶', description: '', description_az: '', is_active: true, sort_order: 0 };
      case 'symptoms':
        return { symptom_key: '', label: '', label_az: '', icon: '🤕', life_stages: ['flow', 'bump', 'mommy'], is_active: true, sort_order: 0 };
      case 'foods':
        return { name: '', name_az: '', calories: 100, emoji: '🍽️', category: 'general', meal_types: [] as string[], is_active: true, sort_order: 0 };
      case 'categories':
        return { category_key: '', name: '', name_az: '', emoji: '📦', is_active: true, sort_order: 0 };
      case 'themes':
        return { category: 'background', name: '', name_az: '', emoji: '', prompt_text: '', preview_url: '', is_premium: false, is_active: true, sort_order: 0 };
      case 'moods':
        return { value: 3, label: '', label_az: '', emoji: '😐', color_class: '', is_active: true };
      default:
        return {};
    }
  };

  const handleSave = async () => {
    const hook = getCurrentHook() as any;
    if (editingItem) {
      await hook.update.mutateAsync({ id: editingItem.id, ...formData });
    } else if (hook.create) {
      await hook.create.mutateAsync(formData);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("admindynamiccontent_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    const hook = getCurrentHook() as any;
    if (hook.remove) {
      await hook.remove.mutateAsync(id);
    }
  };

  const filteredData = getCurrentData().filter((item: any) => {
    const searchLower = search.toLowerCase();
    return (
      item.name?.toLowerCase().includes(searchLower) ||
      item.name_az?.toLowerCase().includes(searchLower) ||
      item.title?.toLowerCase().includes(searchLower) ||
      item.label?.toLowerCase().includes(searchLower) ||
      item.label_az?.toLowerCase().includes(searchLower));

  });

  const renderFormFields = () => {
    switch (activeTab) {
      case 'exercises':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Ad (EN)" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Ad" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input type="number" placeholder={tr("admindynamiccontent_deqiqe_582f34", "Dəqiqə")} value={formData.duration_minutes || ''} onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })} />
              <Input type="number" placeholder="Kalori" value={formData.calories || ''} onChange={(e) => setFormData({ ...formData, calories: parseInt(e.target.value) })} />
              <Select value={formData.level || 'easy'} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Asan</SelectItem>
                  <SelectItem value="medium">Orta</SelectItem>
                  <SelectItem value="hard">{tr("admindynamiccontent_cetin_4bf032", "Çətin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={tr("admindynamiccontent_ikon_emoji_39cbd9", "İkon (emoji)")} value={formData.icon || ''} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} />
              <Input type="number" placeholder={tr("admindynamiccontent_sira_421c5f", "Sıra")} value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
            </div>
            <Textarea placeholder={tr("admindynamiccontent_tesvir_f85651", "Təsvir")} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            <Textarea placeholder={tr("admindynamiccontent_addimlar_her_setirde_bir_addim_a2d6ed", "Addımlar (hər sətirdə bir addım)")} value={(formData.steps || []).join('\n')} onChange={(e) => setFormData({ ...formData, steps: e.target.value.split('\n').filter(Boolean) })} />
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <span className="text-sm">Aktiv</span>
            </div>
            <div className="border-t pt-3 mt-1 space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={!!formData.is_postpartum} onCheckedChange={(v) => setFormData({ ...formData, is_postpartum: v })} />
                <span className="text-sm font-medium">{tr('admindynamiccontent_postpartum_toggle', 'Doğuşdan Sonra Sağalma bölməsində göstər (mommy)')}</span>
              </div>
              {formData.is_postpartum &&
              <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">{tr('admindynamiccontent_postpartum_week_start', 'Neçənci həftədən (boş = 0)')}</label>
                      <Input type="number" min={0} value={formData.postpartum_week_start ?? 0} onChange={(e) => setFormData({ ...formData, postpartum_week_start: e.target.value === '' ? null : parseInt(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{tr('admindynamiccontent_postpartum_week_end', 'Neçənci həftəyə qədər (boş = davamlı)')}</label>
                      <Input type="number" min={0} value={formData.postpartum_week_end ?? ''} onChange={(e) => setFormData({ ...formData, postpartum_week_end: e.target.value === '' ? null : parseInt(e.target.value) })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">{tr('admindynamiccontent_postpartum_delivery_types', 'Doğuş növü (heç biri seçilməsə hamısına uyğundur)')}</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                    { id: 'natural', label: tr('admindynamiccontent_delivery_natural', 'Təbii') },
                    { id: 'cesarean', label: tr('admindynamiccontent_delivery_cesarean', 'Qeysəriyyə') },
                    { id: 'assisted', label: tr('admindynamiccontent_delivery_assisted', 'Köməkli') }].
                    map((dt) => {
                        const selected = (formData.postpartum_delivery_types || []).includes(dt.id);
                        return (
                          <button
                          key={dt.id}
                          type="button"
                          onClick={() => {
                            const current: string[] = formData.postpartum_delivery_types || [];
                            const updated = selected ? current.filter((t: string) => t !== dt.id) : [...current, dt.id];
                            setFormData({ ...formData, postpartum_delivery_types: updated });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          selected ?
                          'bg-primary text-primary-foreground border-primary' :
                          'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`
                          }>
                          
                            {dt.label}
                          </button>);

                      })}
                    </div>
                  </div>
                </>
              }
            </div>
          </>);


      case 'sounds':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Ad (EN)" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Ad" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Emoji" value={formData.emoji || ''} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
              <Select value={formData.noise_type || 'white'} onValueChange={(v) => setFormData({ ...formData, noise_type: v })}>
                <SelectTrigger><SelectValue placeholder={tr("admindynamiccontent_kuy_novu_59bd2a", "Küy növü")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">{tr("admindynamiccontent_beyaz_kuy_88a496", "⚪ Bəyaz Küy")}</SelectItem>
                  <SelectItem value="pink">{tr("admindynamiccontent_cehrayi_kuy_c34852", "🌸 Çəhrayı Küy")}</SelectItem>
                  <SelectItem value="brown">{tr("admindynamiccontent_qehveyi_kuy_b199b4", "🟤 Qəhvəyi Küy")}</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Gradient" value={formData.color_gradient || ''} onChange={(e) => setFormData({ ...formData, color_gradient: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LocalizedInput formData={formData} setFormData={setFormData} field="description" label="Təsvir" />
              <Input placeholder={tr("admindynamiccontent_tesvir_en_c64521", "Təsvir (EN)")} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <Input placeholder="Audio URL" value={formData.audio_url || ''} onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder={tr("admindynamiccontent_sira_421c5f", "Sıra")} value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                <span className="text-sm">Aktiv</span>
              </div>
            </div>
          </>);


      case 'surprises':
        return (
          <>
            <Input placeholder={tr("admindynamiccontent_basliq_e1f6c5", "Başlıq")} value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            <Textarea placeholder={tr("admindynamiccontent_tesvir_f85651", "Təsvir")} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Emoji" value={formData.emoji || ''} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
              <Input placeholder={tr("admindynamiccontent_ikon_6e73fc", "İkon")} value={formData.icon || ''} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} />
              <Input type="number" placeholder="Xal" value={formData.points || 10} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={formData.category || 'romantic'} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="romantic">Romantik</SelectItem>
                  <SelectItem value="care">{tr("admindynamiccontent_qaygi_868e7d", "Qayğı")}</SelectItem>
                  <SelectItem value="adventure">{tr("admindynamiccontent_macera_bc3bdc", "Macəra")}</SelectItem>
                  <SelectItem value="gift">{tr("admindynamiccontent_hediyye_8578f3", "Hədiyyə")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={formData.difficulty || 'easy'} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Asan</SelectItem>
                  <SelectItem value="medium">Orta</SelectItem>
                  <SelectItem value="hard">{tr("admindynamiccontent_cetin_4bf032", "Çətin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <span className="text-sm">Aktiv</span>
            </div>
          </>);


      case 'milestones':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={tr("admindynamiccontent_acar_e_g_first_smile_b34cee", "Açar (e.g. first_smile)")} value={formData.milestone_key || ''} onChange={(e) => setFormData({ ...formData, milestone_key: e.target.value })} />
              <Input type="number" placeholder={tr("admindynamiccontent_hefte_3aa886", "Həftə")} value={formData.week_number || 1} onChange={(e) => setFormData({ ...formData, week_number: parseInt(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={tr("admindynamiccontent_basliq_en_4ac905", "Başlıq (EN)")} value={formData.label || ''} onChange={(e) => setFormData({ ...formData, label: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="label" label="Başlıq" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Emoji" value={formData.emoji || ''} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
              <Input type="number" placeholder={tr("admindynamiccontent_sira_421c5f", "Sıra")} value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
            </div>
            <Textarea placeholder={tr("admindynamiccontent_tesvir_en_c64521", "Təsvir (EN)")} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Təsvir" />
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <span className="text-sm">Aktiv</span>
            </div>
          </>);


      case 'symptoms':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={tr("admindynamiccontent_acar_e_g_headache_92c8bb", "Açar (e.g. headache)")} value={formData.symptom_key || ''} onChange={(e) => setFormData({ ...formData, symptom_key: e.target.value })} />
              <Input placeholder={tr("admindynamiccontent_ikon_emoji_39cbd9", "İkon (emoji)")} value={formData.icon || ''} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={tr("admindynamiccontent_basliq_en_4ac905", "Başlıq (EN)")} value={formData.label || ''} onChange={(e) => setFormData({ ...formData, label: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="label" label="Başlıq" />
            </div>
            <Input type="number" placeholder={tr("admindynamiccontent_sira_421c5f", "Sıra")} value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <span className="text-sm">Aktiv</span>
            </div>
          </>);


      case 'foods':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Ad (EN)" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Ad" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input type="number" placeholder="Kalori" value={formData.calories || 100} onChange={(e) => setFormData({ ...formData, calories: parseInt(e.target.value) })} />
              <Input placeholder="Emoji" value={formData.emoji || ''} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
              <Input placeholder="Kateqoriya" value={formData.category || ''} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{tr("admindynamiccontent_yemek_novleri_906750", "Yemək növləri")}</label>
              <div className="flex flex-wrap gap-3">
                {[
                { id: 'breakfast', label: tr("admindynamiccontent_seher_yemeyi_390d79", "🍳 Səhər yeməyi") },
                { id: 'lunch', label: '🍲 Nahar' },
                { id: 'dinner', label: tr("admindynamiccontent_sam_yemeyi_34d8bf", "🍽️ Şam yeməyi") },
                { id: 'snack', label: tr("admindynamiccontent_qelyanalti_9ceae9", "🍎 Qəlyanaltı") }].
                map((mt) => {
                  const selected = (formData.meal_types || []).includes(mt.id);
                  return (
                    <button
                      key={mt.id}
                      type="button"
                      onClick={() => {
                        const current: string[] = formData.meal_types || [];
                        const updated = selected ?
                        current.filter((t: string) => t !== mt.id) :
                        [...current, mt.id];
                        setFormData({ ...formData, meal_types: updated });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      selected ?
                      'bg-primary text-primary-foreground border-primary' :
                      'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`
                      }>
                      
                      {mt.label}
                    </button>);

                })}
              </div>
              <p className="text-xs text-muted-foreground">{tr("admindynamiccontent_hec_biri_secilmese_butun_yemek_novlerind_3d16a4", "Heç biri seçilməsə bütün yemək növlərində göstəriləcək")}</p>
            </div>
            <Input type="number" placeholder={tr("admindynamiccontent_sira_421c5f", "Sıra")} value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <span className="text-sm">Aktiv</span>
            </div>
          </>);


      case 'categories':
        return (
          <>
            <Input placeholder={tr("admindynamiccontent_acar_e_g_vitamins_9b17ec", "Açar (e.g. vitamins)")} value={formData.category_key || ''} onChange={(e) => setFormData({ ...formData, category_key: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Ad (EN)" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Ad" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Emoji" value={formData.emoji || ''} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
              <Input type="number" placeholder={tr("admindynamiccontent_sira_421c5f", "Sıra")} value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <span className="text-sm">Aktiv</span>
            </div>
          </>);


      case 'themes':
        return (
          <>
            <Select value={formData.category || 'background'} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="background">Fon</SelectItem>
                <SelectItem value="outfit">Geyim</SelectItem>
                <SelectItem value="accessory">Aksesuar</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Ad (EN)" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Ad" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Emoji" value={formData.emoji || ''} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
              <Input type="number" placeholder={tr("admindynamiccontent_sira_421c5f", "Sıra")} value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
            </div>
            <Input placeholder={tr("admindynamiccontent_onizleme_url_ad0267", "Önizləmə URL")} value={formData.preview_url || ''} onChange={(e) => setFormData({ ...formData, preview_url: e.target.value })} />
            <Textarea placeholder={tr("admindynamiccontent_prompt_metni_e761e0", "Prompt mətni")} value={formData.prompt_text || ''} onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })} />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_premium} onCheckedChange={(v) => setFormData({ ...formData, is_premium: v })} />
                <span className="text-sm">Premium</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                <span className="text-sm">Aktiv</span>
              </div>
            </div>
          </>);


      case 'moods':
        return (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder={tr("admindynamiccontent_deyer_1_5_24b5f4", "Dəyər (1-5)")} value={formData.value || 3} onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) })} disabled={!!editingItem} />
              <Input placeholder="Emoji" value={formData.emoji || ''} onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={tr("admindynamiccontent_basliq_en_4ac905", "Başlıq (EN)")} value={formData.label || ''} onChange={(e) => setFormData({ ...formData, label: e.target.value })} />
              <LocalizedInput formData={formData} setFormData={setFormData} field="label" label="Başlıq" />
            </div>
            <Input placeholder={tr("admindynamiccontent_reng_sinifi_e_g_bg_red_100_border_red_30_9f81d4", "Rəng sinifi (e.g. bg-red-100 border-red-300)")} value={formData.color_class || ''} onChange={(e) => setFormData({ ...formData, color_class: e.target.value })} />
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <span className="text-sm">Aktiv</span>
            </div>
          </>);


      default:
        return null;
    }
  };

  const renderItemCard = (item: any) => {
    const displayName = localize(item, 'name') || item.title || item.label_az || item.label || tr("admindynamiccontent_adsiz_40b703", "Ads\u0131z");
    const emoji = item.emoji || item.icon || '📦';

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{emoji}</span>
            <div>
              <h4 className="font-medium text-foreground">{displayName}</h4>
              {item.description &&
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
              }
              <div className="flex flex-wrap gap-1.5 mt-1">
                {item.level &&
                <Badge variant="outline" className="text-xs">{item.level}</Badge>
                }
                {item.category && activeTab === 'themes' &&
                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                }
                {item.noise_type && activeTab === 'sounds' &&
                <Badge variant="outline" className="text-xs">
                    {item.noise_type === 'white' ? tr("admindynamiccontent_beyaz_4d9c17", "\u26AA B\u0259yaz") : item.noise_type === 'pink' ? tr("admindynamiccontent_cehrayi_af46ea", "\uD83C\uDF38 \xC7\u0259hray\u0131") : tr("admindynamiccontent_qehveyi_26f688", "\uD83D\uDFE4 Q\u0259hv\u0259yi")}
                  </Badge>
                }
                {activeTab === 'foods' && item.meal_types && item.meal_types.length > 0 &&
                item.meal_types.map((mt: string) =>
                <Badge key={mt} variant="secondary" className="text-xs">
                      {mt === 'breakfast' ? tr("admindynamiccontent_seher_56e72a", "\uD83C\uDF73 S\u0259h\u0259r") : mt === 'lunch' ? '🍲 Nahar' : mt === 'dinner' ? tr("admindynamiccontent_sam_476fca", "\uD83C\uDF7D\uFE0F \u015Eam") : tr("admindynamiccontent_qelyanalti_9ceae9", "\uD83C\uDF4E Q\u0259lyanalt\u0131")}
                    </Badge>
                )
                }
                {activeTab === 'foods' && item.calories &&
                <Badge variant="outline" className="text-xs">{item.calories} kal</Badge>
                }
                {item.is_premium &&
                <Badge className="text-xs bg-amber-500">Premium</Badge>
                }
                {!item.is_active &&
                <Badge variant="destructive" className="text-xs">Deaktiv</Badge>
                }
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(item)}>
              <Pencil className="w-4 h-4" />
            </Button>
            {activeTab !== 'moods' &&
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            }
          </div>
        </div>
      </motion.div>);

  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{tr("admindynamiccontent_dinamik_mezmun_bec232", "Dinamik Məzmun")}</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">{tr("admindynamiccontent_tetbiqdeki_butun_konfiqurasiya_edile_bil_b47cab", "Tətbiqdəki bütün konfiqurasiya edilə bilən məlumatları idarə edin")}</p>
        </div>
        {activeTab !== 'moods' &&
        <Button onClick={openCreateModal} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            {tr("admindynamiccontent_elave_et_6e1b9b", "\u018Flav\u0259 et")}
          </Button>
        }
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) =>
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab(tab.id as ContentType)}
          className="gap-1.5">
          
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            <Badge variant="secondary" className="ms-0.5 text-xs">{tab.count}</Badge>
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Axtar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-10" />
        
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredData.map(renderItemCard)}
      </div>

      {filteredData.length === 0 &&
      <div className="text-center py-12 text-muted-foreground">
          {tr("admindynamiccontent_hec_bir_melumat_tapilmadi_54c062", "He\xE7 bir m\u0259lumat tap\u0131lmad\u0131")}
        </div>
      }

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? tr("admindynamiccontent_redakte_et_66cf3b", "Redakt\u0259 et") : tr("admindynamiccontent_yeni_elave_et_bcd4a4", "Yeni \u0259lav\u0259 et")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {renderFormFields()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>{tr("admindynamiccontent_legv_et_b5e49c", "Ləğv et")}</Button>
            <Button onClick={handleSave}>Saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminDynamicContent;