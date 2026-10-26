import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Pill, Check, X, Leaf } from 'lucide-react';
import { useVitaminsAdmin, Vitamin } from '@/hooks/useVitamins';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminVitamins = () => {
    const localize = useAdminLocalize();
  const { vitamins, isLoading, createVitamin, updateVitamin, deleteVitamin } = useVitaminsAdmin();
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVitamin, setEditingVitamin] = useState<Vitamin | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    name_az: '',
    description_az: '',
    benefits: '',
    food_sources: '',
    dosage: '',
    week_start: '',
    week_end: '',
    trimesters: [] as number[],
    life_stage: 'bump',
    importance: 'recommended',
    icon_emoji: '💊',
    is_active: true,
    sort_order: 0
  });

  const resetForm = () => {
    setFormData({
      name: '',
      name_az: '',
      description_az: '',
      benefits: '',
      food_sources: '',
      dosage: '',
      week_start: '',
      week_end: '',
      trimesters: [],
      life_stage: 'bump',
      importance: 'recommended',
      icon_emoji: '💊',
      is_active: true,
      sort_order: 0
    });
    setEditingVitamin(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (vitamin: Vitamin) => {
    setEditingVitamin(vitamin);
    setFormData({
      // NOT: bütün sətir spread olunur ki, mövcud name_ru/tr/kk/de/ar və
      // description_ru/tr/kk/de/ar dəyərləri admin dili dəyişdirildikdə boş
      // görünməsin (əvvəllər yalnız name_az/description_az bərpa olunurdu -
      // real tərcümələr gizli qalır, üstünə yazma riski var idi).
      ...vitamin,
      name: vitamin.name,
      name_az: vitamin.name_az || '',
      description_az: vitamin.description_az || '',
      benefits: vitamin.benefits?.join('\n') || '',
      food_sources: vitamin.food_sources?.join('\n') || '',
      dosage: vitamin.dosage || '',
      week_start: vitamin.week_start?.toString() || '',
      week_end: vitamin.week_end?.toString() || '',
      trimesters: vitamin.trimester || [],
      life_stage: vitamin.life_stage || 'bump',
      importance: vitamin.importance || 'recommended',
      icon_emoji: vitamin.icon_emoji || '💊',
      is_active: vitamin.is_active,
      sort_order: vitamin.sort_order || 0
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      // NOT: əvvəllər sabit sahə siyahısı göndərilirdi (yalnız name/name_az/
      // description_az) - LocalizedInput/Textarea admin dili ru/tr/kk/de/ar
      // olanda name_ru/description_kk və s. formData-ya yazırdı, amma bunlar
      // heç vaxt bura göndərilmirdi (sessiz itki). Həm də bare `description`
      // sütunu HƏMİŞƏ Azərbaycan mətni ilə üzərinə yazılırdı (description_az
      // dəyəri description-a da kopyalanırdı) - indi `...formData` spread
      // olunur ki, bütün dil sahələri qorunsun və description toxunulmadan
      // qalsın (yalnız description_az idarə olunur).
      const {
        name, name_az, description_az, benefits, food_sources, dosage,
        week_start, week_end, trimesters, life_stage, importance,
        icon_emoji, is_active, sort_order, ...rest
      } = formData;
      const vitaminData: Record<string, any> = {
        ...rest,
        name,
        name_az: name_az || null,
        description_az: description_az || null,
        benefits: benefits ? benefits.split('\n').filter((b) => b.trim()) : null,
        food_sources: food_sources ? food_sources.split('\n').filter((f) => f.trim()) : null,
        dosage: dosage || null,
        week_start: week_start ? parseInt(week_start) : null,
        week_end: week_end ? parseInt(week_end) : null,
        trimester: trimesters.length > 0 ? trimesters : null,
        life_stage,
        importance,
        icon_emoji,
        is_active,
        sort_order
      };

      if (editingVitamin) {
        await updateVitamin.mutateAsync({ id: editingVitamin.id, ...vitaminData });
        toast.success(tr("adminvitamins_vitamin_yenilendi_f137eb", "Vitamin yenil\u0259ndi"));
      } else {
        await createVitamin.mutateAsync(vitaminData);
        toast.success(tr("adminvitamins_vitamin_elave_edildi_b2e88b", "Vitamin \u0259lav\u0259 edildi"));
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error(tr("adminvitamins_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("adminvitamins_bu_vitamini_silmek_istediyiniz_4bcf37", "Bu vitamini silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    try {
      await deleteVitamin.mutateAsync(id);
      toast.success('Vitamin silindi');
    } catch (error) {
      toast.error(tr("adminvitamins_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const filteredVitamins = vitamins.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.name_az?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = filterStage === 'all' || v.life_stage === filterStage;
    return matchesSearch && matchesStage;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            {tr("adminvitamins_vitaminler_e49129", "Vitaminl\u0259r")}
          </h1>
          <p className="text-sm text-muted-foreground">{tr("adminvitamins_heftelik_vitamin_tovsiyelerini_idare_edi_d31541", "Həftəlik vitamin tövsiyələrini idarə edin")}</p>
        </div>
        <Button onClick={openCreateModal} size="sm">
          <Plus className="w-4 h-4 me-1" />
          {tr("adminvitamins_elave_et_6e1b9b", "\u018Flav\u0259 et")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Axtar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9 h-9" />
          
        </div>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder={tr("adminvitamins_merhele_0e09aa", "Mərhələ")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("adminvitamins_hamisi_c73c4d", "Hamısı")}</SelectItem>
            <SelectItem value="bump">{tr("adminvitamins_hamilelik_e86feb", "Hamiləlik")}</SelectItem>
            <SelectItem value="mommy">Anacan</SelectItem>
            <SelectItem value="flow">{tr("adminvitamins_umumi_1b5521", "Ümumi")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vitamins List */}
      <div className="grid gap-3">
        {filteredVitamins.map((vitamin, index) =>
        <motion.div
          key={vitamin.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className={`bg-card border rounded-xl p-3 ${!vitamin.is_active ? 'opacity-50' : ''}`}>
          
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                {vitamin.icon_emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{localize(vitamin, 'name')}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                vitamin.importance === 'essential' ?
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`
                }>
                    {vitamin.importance === 'essential' ? 'Vacib' : tr("adminvitamins_tovsiye_712d0f", "T\xF6vsiy\u0259")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {localize(vitamin, 'description')}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 bg-muted rounded">
                    {vitamin.life_stage === 'bump' ? tr("adminvitamins_hamilelik_e86feb", "Hamil\u0259lik") : vitamin.life_stage === 'mommy' ? 'Anacan' : tr("adminvitamins_umumi_1b5521", "\xDCmumi")}
                  </span>
                  {vitamin.trimester && vitamin.trimester.length === 3 &&
                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-700 dark:text-purple-400">{tr("adminvitamins_her_uc_trimester_ceff3a", "Hər üç trimester")}</span>
                }
                  {vitamin.trimester && vitamin.trimester.length > 0 && vitamin.trimester.length < 3 &&
                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-700 dark:text-purple-400">
                      Trimester {vitamin.trimester.join(', ')}
                    </span>
                }
                  {vitamin.week_start && vitamin.week_end &&
                <span>{tr("adminvitamins_hefte_3aa886", "H\u0259ft\u0259")} {vitamin.week_start}-{vitamin.week_end}</span>
                }
                  {vitamin.dosage &&
                <span>• {vitamin.dosage}</span>
                }
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditModal(vitamin)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(vitamin.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {filteredVitamins.length === 0 &&
        <div className="text-center py-12 text-muted-foreground">
            <Leaf className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{tr("adminvitamins_vitamin_tapilmadi_f35170", "Vitamin tapılmadı")}</p>
          </div>
        }
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVitamin ? tr("adminvitamins_vitamini_redakte_et_9033aa", "Vitamini Redakt\u0259 Et") : 'Yeni Vitamin'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ad (EN)</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Vitamin D"
                  className="h-9" />
                
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ad (AZ)</label>
                <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="D vitamini" />
                
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_tesvir_az_2c237a", "Təsvir (AZ)")}</label>
              <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Vitaminin faydaları haqqında..." rows={2} />
              
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_faydalari_her_setirde_1_872e37", "Faydaları (hər sətirdə 1)")}</label>
                <Textarea
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  placeholder={tr("adminvitamins_sumuk_saglamligi_10_immun_sistem_desteyi_54fc6a", "Sümük sağlamlığı&#10;İmmun sistem dəstəyi")}
                  rows={3} />
                
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_qida_menbeleri_her_setirde_1_197057", "Qida mənbələri (hər sətirdə 1)")}</label>
                <Textarea
                  value={formData.food_sources}
                  onChange={(e) => setFormData({ ...formData, food_sources: e.target.value })}
                  placeholder={tr("adminvitamins_sud_mehsullari_10_baliq_10_yumurta_e6328b", "Süd məhsulları&#10;Balıq&#10;Yumurta")}
                  rows={3} />
                
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dozaj</label>
                <Input
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  placeholder={tr("adminvitamins_400_iu_gun_74a3aa", "400 IU/gün")}
                  className="h-9" />
                
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Emoji</label>
                <Input
                  value={formData.icon_emoji}
                  onChange={(e) => setFormData({ ...formData, icon_emoji: e.target.value })}
                  placeholder="💊"
                  className="h-9" />
                
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_sira_421c5f", "Sıra")}</label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="h-9" />
                
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_hefte_baslangic_3fb153", "Həftə (başlanğıc)")}</label>
                <Input
                  type="number"
                  value={formData.week_start}
                  onChange={(e) => setFormData({ ...formData, week_start: e.target.value })}
                  placeholder="1"
                  className="h-9" />
                
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_hefte_son_078eb1", "Həftə (son)")}</label>
                <Input
                  type="number"
                  value={formData.week_end}
                  onChange={(e) => setFormData({ ...formData, week_end: e.target.value })}
                  placeholder="40"
                  className="h-9" />
                
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_trimestrler_3800f5", "Trimestrlər")}</label>
                <div className="flex flex-wrap gap-2">
                  {[
                  { value: 1, label: '1-ci' },
                  { value: 2, label: '2-ci' },
                  { value: 3, label: tr("adminvitamins_3_cu_af0141", "3-cü") }].
                  map((t) =>
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      const current = formData.trimesters;
                      const updated = current.includes(t.value) ?
                      current.filter((v) => v !== t.value) :
                      [...current, t.value].sort();
                      setFormData({ ...formData, trimesters: updated });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    formData.trimesters.includes(t.value) ?
                    'bg-primary text-primary-foreground border-primary' :
                    'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`
                    }>
                    
                      {t.label}
                    </button>
                  )}
                </div>
                {formData.trimesters.length === 3 &&
                <p className="text-[10px] text-primary mt-1">{tr("adminvitamins_her_uc_trimester_secildi_3c6bfa", "✓ Hər üç trimester seçildi")}</p>
                }
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_merhele_0e09aa", "Mərhələ")}</label>
                <Select value={formData.life_stage} onValueChange={(v) => setFormData({ ...formData, life_stage: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bump">{tr("adminvitamins_hamilelik_e86feb", "Hamiləlik")}</SelectItem>
                    <SelectItem value="mommy">Anacan</SelectItem>
                    <SelectItem value="flow">{tr("adminvitamins_umumi_1b5521", "Ümumi")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr("adminvitamins_ehemiyyet_bfefa3", "Əhəmiyyət")}</label>
                <Select value={formData.importance} onValueChange={(v) => setFormData({ ...formData, importance: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essential">Vacib</SelectItem>
                    <SelectItem value="recommended">{tr("adminvitamins_tovsiye_712d0f", "Tövsiyə")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                
                <span className="text-sm">Aktiv</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  <X className="w-4 h-4 me-1" />
                  {tr("adminvitamins_legv_et_b5e49c", "L\u0259\u011Fv et")}
                </Button>
                <Button onClick={handleSave} disabled={!formData.name}>
                  <Check className="w-4 h-4 me-1" />
                  Yadda saxla
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminVitamins;