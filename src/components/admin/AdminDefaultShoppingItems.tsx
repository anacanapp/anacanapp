import { useState, useRef } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, ShoppingCart, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAdminDefaultShoppingItems, DefaultShoppingItem } from '@/hooks/useDefaultShoppingItems';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const categories = [
{ value: 'baby_care', label: tr("admindefaultshoppingitems_korpe_baximi_1ba070", "Körpə Baxımı") },
{ value: 'feeding', label: 'Qidalanma' },
{ value: 'clothing', label: 'Geyim' },
{ value: 'bedding', label: 'Yataq' },
{ value: 'health', label: tr("admindefaultshoppingitems_saglamliq_09460a", "Sağlamlıq") },
{ value: 'safety', label: tr("admindefaultshoppingitems_tehlukesizlik_8bc156", "Təhlükəsizlik") },
{ value: 'transport', label: tr("admindefaultshoppingitems_neqliyyat_a179ff", "Nəqliyyat") },
{ value: 'general', label: tr("admindefaultshoppingitems_umumi_1b5521", "Ümumi") }];


const lifeStages = [
{ value: 'all', label: tr("admindefaultshoppingitems_hamisi_c73c4d", "Hamısı") },
{ value: 'bump', label: tr("admindefaultshoppingitems_hamile_0080af", "Hamilə") },
{ value: 'mommy', label: tr("admindefaultshoppingitems_ana_korpe_d5b4be", "Ana (Körpə)") },
{ value: 'flow', label: 'Menstruasiya' }];


const priorities = [
{ value: 'high', label: tr("admindefaultshoppingitems_yuksek_492584", "Yüksək"), color: 'bg-red-500' },
{ value: 'medium', label: 'Orta', color: 'bg-yellow-500' },
{ value: 'low', label: tr("admindefaultshoppingitems_asagi_1c27f1", "Aşağı"), color: 'bg-green-500' }];


const AdminDefaultShoppingItems = () => {
    const localize = useAdminLocalize();
  const { items, loading, createItem, updateItem, deleteItem } = useAdminDefaultShoppingItems();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DefaultShoppingItem | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');

  const [formData, setFormData] = useState({
    name: '',
    name_az: '',
    category: 'general',
    priority: 'medium' as 'low' | 'medium' | 'high',
    life_stage: 'all',
    is_active: true,
    sort_order: 0
  });

  const hasUnsavedChanges = () => {
    if (!showModal) return false;
    return JSON.stringify(formData) !== initialFormDataRef.current;
  };

  const handleModalClose = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      closeModal();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({
      name: '',
      name_az: '',
      category: 'general',
      priority: 'medium',
      life_stage: 'all',
      is_active: true,
      sort_order: 0
    });
  };

  const openCreateModal = () => {
    const initialData = {
      name: '',
      name_az: '',
      category: 'general',
      priority: 'medium' as const,
      life_stage: 'all',
      is_active: true,
      sort_order: items.length
    };
    setFormData(initialData);
    initialFormDataRef.current = JSON.stringify(initialData);
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = (item: DefaultShoppingItem) => {
    // NOT: `...item` spread olunur ki, mövcud name_en/ru/tr/kk/de/ar
    // dəyərləri admin dili dəyişdirildikdə boş görünməsin (DefaultShoppingItem
    // tipi bu sahələri elan etmir, amma sətirdə həqiqətən mövcuddurlar -
    // spread onları runtime-da düzgün daşıyır). Save tərəfi artıq bütün
    // formu göndərir, yalnız Open (bərpa) tərəfi əskik idi.
    const data: typeof formData = {
      ...(item as any),
      name: item.name,
      name_az: item.name_az || '',
      category: item.category,
      priority: item.priority,
      life_stage: item.life_stage,
      is_active: item.is_active,
      sort_order: item.sort_order
    };
    setFormData(data);
    initialFormDataRef.current = JSON.stringify(data);
    setEditingItem(item);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Ad daxil edin', variant: 'destructive' });
      return;
    }

    let result;
    if (editingItem) {
      result = await updateItem(editingItem.id, formData);
    } else {
      result = await createItem(formData);
    }

    if (result.error) {
      toast({ title: tr("admindefaultshoppingitems_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } else {
      toast({ title: editingItem ? tr("admindefaultshoppingitems_yenilendi_d10a01", "Yenil\u0259ndi") : tr("admindefaultshoppingitems_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi") });
      closeModal();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("admindefaultshoppingitems_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;

    const result = await deleteItem(id);
    if (result.error) {
      toast({ title: tr("admindefaultshoppingitems_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } else {
      toast({ title: 'Silindi' });
    }
  };

  if (loading) {
    return <div className="p-6 text-center">{tr("admindefaultshoppingitems_yuklenir_5557de", "Yüklənir...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            {tr("admindefaultshoppingitems_default_alisveris_mehsullari_9f5944", "Default Al\u0131\u015Fveri\u015F M\u0259hsullar\u0131")}
          </h2>
          <p className="text-muted-foreground">
            {tr("admindefaultshoppingitems_platformanin_tovsiye_etdiyi_me_aea892", "Platforman\u0131n t\xF6vsiy\u0259 etdiyi m\u0259hsullar")}
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 me-2" />
          {tr("admindefaultshoppingitems_yeni_mehsul_cd3d1a", "Yeni M\u0259hsul")}
        </Button>
      </div>

      <div className="grid gap-3">
        {items.map((item) =>
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 bg-card rounded-xl border">
          
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${priorities.find((p) => p.value === item.priority)?.color}`} />
              <div>
                <p className="font-medium">{localize(item, 'name')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {categories.find((c) => c.value === item.category)?.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {lifeStages.find((l) => l.value === item.life_stage)?.label}
                  </Badge>
                  {!item.is_active &&
                <Badge variant="secondary" className="text-xs">Deaktiv</Badge>
                }
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEditModal(item)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </motion.div>
        )}

        {items.length === 0 &&
        <div className="text-center py-12 text-muted-foreground">
            {tr("admindefaultshoppingitems_hec_bir_mehsul_yoxdur_8e5ff5", "He\xE7 bir m\u0259hsul yoxdur")}
          </div>
        }
      </div>

      <Dialog open={showModal} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? tr("admindefaultshoppingitems_mehsulu_redakte_et_0a1ac6", "M\u0259hsulu Redakt\u0259 Et") : tr("admindefaultshoppingitems_yeni_mehsul_cd3d1a", "Yeni M\u0259hsul")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Ad (EN)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Baby diapers" />
              
            </div>

            <div>
              <Label>Ad (AZ)</Label>
              <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Körpə bezləri" />
              
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kateqoriya</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) =>
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Prioritet</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v: 'low' | 'medium' | 'high') => setFormData({ ...formData, priority: v })}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) =>
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{tr("admindefaultshoppingitems_heyat_merhelesi_c3ab6b", "Həyat Mərhələsi")}</Label>
              <Select
                value={formData.life_stage}
                onValueChange={(v) => setFormData({ ...formData, life_stage: v })}>
                
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lifeStages.map((l) =>
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{tr("admindefaultshoppingitems_sira_421c5f", "Sıra")}</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
              
            </div>

            <div className="flex items-center justify-between">
              <Label>Aktiv</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={handleModalClose}>
                <X className="w-4 h-4 me-2" />
                {tr("admindefaultshoppingitems_legv_et_b5e49c", "L\u0259\u011Fv et")}
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                <Save className="w-4 h-4 me-2" />
                Saxla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={closeModal} />
      
    </div>);

};

export default AdminDefaultShoppingItems;