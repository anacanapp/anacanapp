import { useState, useRef, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { UtensilsCrossed, Plus, Pencil, Trash2, Search, Clock, Users, FileUp, Download, Upload, X, Image as ImageIcon, Settings2, FileDown } from 'lucide-react';
import AdminUsageStats from './AdminUsageStats';
import { exportToCSV } from '@/utils/csvExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAdminRecipesAdmin, AdminRecipe } from '@/hooks/useAdminRecipes';
import { useRecipeCategoriesAdmin } from '@/hooks/useDynamicTools';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminRecipes = () => {
    const localize = useAdminLocalize();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: recipes = [], isLoading, create, update, remove, refetch } = useAdminRecipesAdmin();
  const { data: dbCategories = [] } = useRecipeCategoriesAdmin();
  const { data: recipeTags = [] } = useQuery({
    queryKey: ['recipe-tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_tags').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data as {id: string;tag_id: string;name: string;name_az: string | null;emoji: string | null;sort_order: number;is_active: boolean;}[];
    }
  });

  // Category management states
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [catForm, setCatForm] = useState({ category_id: '', name: '', name_az: '', emoji: '', sort_order: 0, is_active: true });

  const categories = dbCategories.map((c) => ({ id: c.category_id, label: localize(c, 'name'), emoji: c.emoji }));
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminRecipe | null>(null);
  const [formData, setFormData] = useState<Partial<AdminRecipe>>({});
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');

  // CSV Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Check if form has unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(formData) !== initialFormDataRef.current;
  }, [formData]);

  // Handle modal close with unsaved changes check
  const handleModalClose = useCallback((open: boolean) => {
    if (!open && hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      setShowModal(open);
    }
  }, [hasUnsavedChanges]);

  // Force close modal (discard changes)
  const handleDiscardChanges = useCallback(() => {
    setShowModal(false);
    setShowUnsavedDialog(false);
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    const initialData = {
      title: '',
      description: '',
      category: categories[0]?.id || 'general',
      prep_time: 15,
      cook_time: 30,
      servings: 4,
      calories: null as number | null,
      ingredients: [],
      instructions: [],
      image_url: '',
      is_active: true,
      tags: []
    };
    setFormData(initialData);
    initialFormDataRef.current = JSON.stringify(initialData);
    setShowModal(true);
  };

  const openEditModal = (item: AdminRecipe) => {
    setEditingItem(item);
    setFormData({ ...item });
    initialFormDataRef.current = JSON.stringify({ ...item });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await update.mutateAsync({ id: editingItem.id, ...formData });
      } else {
        await create.mutateAsync(formData);
      }
      setShowModal(false);
    } catch {
      // Xəta artıq useAdminRecipes.ts-in onError-u vasitəsilə toast kimi
      // göstərilib - modal qəsdən açıq qalır ki, admin məlumatı itirmədən
      // yenidən cəhd edə bilsin.
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("adminrecipes_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    try {
      await remove.mutateAsync(id);
    } catch {
      // Xəta artıq onError vasitəsilə göstərilib.
    }
  };

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: tr("adminrecipes_xeta_3cdbb6", "Xəta"), description: tr("adminrecipes_yalniz_sekil_fayllari_yuklene_biler_f67b23", "Yalnız şəkil faylları yüklənə bilər"), variant: 'destructive' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: tr("adminrecipes_xeta_3cdbb6", "Xəta"), description: tr("adminrecipes_sekil_5mb_dan_boyuk_ola_bilmez_3e4e99", "Şəkil 5MB-dan böyük ola bilməz"), variant: 'destructive' });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `recipe-${Date.now()}.${fileExt}`;
      const filePath = `recipes/${fileName}`;

      const { error: uploadError } = await supabase.storage.
      from('assets').
      upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.
      from('assets').
      getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast({ title: tr("adminrecipes_sekil_yuklendi_474bd5", "Şəkil yükləndi") });
    } catch (error: any) {
      toast({ title: tr("adminrecipes_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image_url: '' });
  };

  // Split CSV text into logical rows, respecting quoted fields with newlines
  const splitCSVIntoRows = (text: string): string[] => {
    const rows: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
        current += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++; // skip \r\n
        }
        if (current.trim()) {
          rows.push(current);
        }
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      rows.push(current);
    }
    return rows;
  };

  // CSV parsing helper
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // CSV Upload Handler
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = splitCSVIntoRows(text);

      if (lines.length < 2) {
        toast({ title: tr("adminrecipes_xeta_3cdbb6", "Xəta"), description: tr("adminrecipes_csv_fayli_bosdur_0a908c", "CSV faylı boşdur"), variant: 'destructive' });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const headerMap: Record<string, string> = {
        'Başlıq': 'title',
        'Təsvir': 'description',
        'Kateqoriya': 'category',
        'Hazırlıq (dəq)': 'prep_time',
        'Bişirmə (dəq)': 'cook_time',
        'Porsiya': 'servings',
        'Kalori': 'calories',
        'İnqredientlər': 'ingredients',
        'Hazırlanma': 'instructions',
        'Şəkil URL': 'image_url'
      };

      const parsedData: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 2) continue;

        const row: any = { is_active: true };

        headers.forEach((header, idx) => {
          const dbField = headerMap[header.trim()];
          if (dbField && values[idx]) {
            let value = values[idx].trim().replace(/^"|"$/g, '');

            if (dbField === 'prep_time' || dbField === 'cook_time' || dbField === 'servings' || dbField === 'calories') {
              const numValue = parseInt(value);
              row[dbField] = isNaN(numValue) ? dbField === 'calories' ? null : 0 : numValue;
            } else if (dbField === 'ingredients' || dbField === 'instructions') {
              const items = value.split(/[;|\n]/).map((s) => s.trim()).filter((s) => s);
              row[dbField] = items;
            } else {
              row[dbField] = value;
            }
          }
        });

        if (row.title) {
          if (!row.category) row.category = 'general';
          parsedData.push(row);
        }
      }

      if (parsedData.length === 0) {
        toast({ title: tr("adminrecipes_xeta_3cdbb6", "Xəta"), description: tr("adminrecipes_hec_bir_resept_tapilmadi_f2f561", "Heç bir resept tapılmadı"), variant: 'destructive' });
        return;
      }

      setImportData(parsedData);
      setShowImportModal(true);
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Import recipes to database
  const handleImport = async () => {
    if (importData.length === 0) return;

    setImporting(true);
    try {
      const { error } = await supabase.
      from('admin_recipes').
      insert(importData);

      if (error) throw error;

      toast({
        title: tr("adminrecipes_ugurlu_5c0191", "Uğurlu!"),
        description: `${importData.length} resept əlavə edildi`
      });
      setShowImportModal(false);
      setImportData([]);
      refetch();
    } catch (error: any) {
      toast({
        title: tr("adminrecipes_xeta_3cdbb6", "Xəta"),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    window.open('/templates/reseptler_numune.csv', '_blank');
  };

  // Category CRUD
  const saveCat = async () => {
    try {
      if (editingCat) {
        // NOT: əvvəllər sabit sahə siyahısı göndərilirdi - LocalizedInput
        // admin dili ru/tr/kk/de/ar olanda name_ru/name_kk və s. catForm-a
        // yazırdı, amma bunlar heç vaxt göndərilmirdi (CREATE budağı isə
        // bütün catForm-u spread etdiyi üçün təsirlənmirdi - asimmetrik bug).
        const { id: _catId, ...catUpdates } = catForm as any;
        const { error } = await supabase.from('recipe_categories').update(catUpdates).eq('id', editingCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recipe_categories').insert([catForm]);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['recipe-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-categories'] });
      setShowCatModal(false);
      toast({ title: editingCat ? tr("adminrecipes_kateqoriya_yenilendi_02b12b", "Kateqoriya yenil\u0259ndi") : tr("adminrecipes_kateqoriya_elave_edildi_e28f72", "Kateqoriya \u0259lav\u0259 edildi") });
    } catch (e: any) {
      toast({ title: tr("adminrecipes_xeta_3cdbb6", "Xəta"), description: e.message, variant: 'destructive' });
    }
  };

  const deleteCat = async (id: string) => {
    if (!confirm(tr("adminrecipes_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    const { error } = await supabase.from('recipe_categories').delete().eq('id', id);
    if (error) {toast({ title: tr("adminrecipes_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });return;}
    queryClient.invalidateQueries({ queryKey: ['recipe-categories-admin'] });
    queryClient.invalidateQueries({ queryKey: ['recipe-categories'] });
    toast({ title: 'Kateqoriya silindi' });
  };

  const openCatCreate = () => {
    setEditingCat(null);
    setCatForm({ category_id: '', name: '', name_az: '', emoji: '🍽️', sort_order: dbCategories.length + 1, is_active: true });
    setShowCatModal(true);
  };

  const openCatEdit = (cat: any) => {
    setEditingCat(cat);
    // NOT: `...cat` spread olunur ki, mövcud name_en/ru/tr/kk/de/ar
    // dəyərləri admin dili dəyişdirildikdə boş görünməsin.
    setCatForm({ ...cat, category_id: cat.category_id, name: cat.name, name_az: cat.name_az || '', emoji: cat.emoji || '', sort_order: cat.sort_order || 0, is_active: cat.is_active !== false });
    setShowCatModal(true);
  };

  const filteredRecipes = recipes.filter((r) =>
  r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminrecipes_reseptler_98ed2c", "Reseptlər")}</h1>
          <p className="text-muted-foreground">{tr("adminrecipes_hamilelik_ve_analiq_reseptlerini_idare_e_ff4d53", "Hamiləlik və analıq reseptlərini idarə edin")}</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={csvFileInputRef}
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden" />
          
          <Button onClick={downloadTemplate} variant="ghost" size="sm" className="gap-1">
            <Download className="w-4 h-4" />
            {tr("adminrecipes_sablon_68cce4", "\u015Eablon")}
          </Button>
          <Button onClick={() => csvFileInputRef.current?.click()} variant="outline" className="gap-2">
            <FileUp className="w-4 h-4" />
            CSV İmport
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              exportToCSV(
                recipes,
                [
                { key: 'title', header: tr("adminrecipes_basliq_e1f6c5", "Başlıq") },
                { key: 'description', header: tr("adminrecipes_tesvir_f85651", "Təsvir") },
                { key: 'category', header: 'Kateqoriya' },
                { key: 'prep_time', header: tr("adminrecipes_hazirliq_deq_0e31cf", "Hazırlıq (dəq)") },
                { key: 'cook_time', header: tr("adminrecipes_bisirme_deq_88f48d", "Bişirmə (dəq)") },
                { key: 'servings', header: 'Porsiya' },
                { key: 'calories', header: 'Kalori' },
                { key: 'ingredients', header: tr("adminrecipes_inqredientler_ac7a19", "İnqredientlər") },
                { key: 'instructions', header: tr("adminrecipes_hazirlanma_13bf8d", "Hazırlanma") },
                { key: 'image_url', header: tr("adminrecipes_sekil_url_d302df", "Şəkil URL") },
                { key: 'is_active', header: 'Aktiv' }],

                'recipes_export.csv'
              );
              toast({ title: `${recipes.length} resept ixrac edildi` });
            }}
            disabled={recipes.length === 0}>
            
            <FileDown className="w-4 h-4" />
            İxrac
          </Button>
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="w-4 h-4" />
            Yeni Resept
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recipes.length}</p>
              <p className="text-xs text-muted-foreground">{tr("adminrecipes_umumi_1b5521", "Ümumi")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <UtensilsCrossed className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recipes.filter((r) => r.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Aktiv</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Settings2 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dbCategories.length}</p>
              <p className="text-xs text-muted-foreground">Kateqoriya</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Kateqoriyalar</CardTitle>
          <Button size="sm" onClick={openCatCreate} className="gap-1">
            <Plus className="w-4 h-4" /> Yeni
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {dbCategories.map((cat) =>
            <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border/50">
                <span>{cat.emoji}</span>
                <span className="text-sm font-medium">{localize(cat, 'name')}</span>
                <Badge variant={cat.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                  {cat.is_active ? 'Aktiv' : 'Deaktiv'}
                </Badge>
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => openCatEdit(cat)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => deleteCat(cat.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Modal */}
      <Dialog open={showCatModal} onOpenChange={setShowCatModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? tr("adminrecipes_kateqoriya_redakte_1b0ef3", "Kateqoriya Redakt\u0259") : 'Yeni Kateqoriya'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kateqoriya ID (slug)</Label>
              <Input value={catForm.category_id} onChange={(e) => setCatForm({ ...catForm, category_id: e.target.value })} placeholder="seher_yemeyi" disabled={!!editingCat} />
            </div>
            <div>
              <Label>Ad</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder={tr("adminrecipes_seher_yemeyi_b82929", "Səhər yeməyi")} />
            </div>
            <div>
              <Label>Ad (AZ)</Label>
              <LocalizedInput formData={catForm} setFormData={setCatForm} field="name" label="Səhər yeməyi" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Emoji</Label>
                <Input value={catForm.emoji} onChange={(e) => setCatForm({ ...catForm, emoji: e.target.value })} placeholder="🍳" />
              </div>
              <div>
                <Label>{tr("adminrecipes_sira_421c5f", "Sıra")}</Label>
                <Input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={catForm.is_active} onCheckedChange={(v) => setCatForm({ ...catForm, is_active: v })} />
              <Label>Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatModal(false)}>{tr("adminrecipes_legv_et_b5e49c", "Ləğv et")}</Button>
            <Button onClick={saveCat}>Yadda saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Resept axtar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10" />
          
        </div>
      </Card>

      {/* Recipes List */}
      <Card>
        <CardHeader>
          <CardTitle>{tr("adminrecipes_reseptler_db28d4", "Reseptl\u0259r (")}{filteredRecipes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ?
          <div className="text-center py-8 text-muted-foreground">{tr("adminrecipes_yuklenir_5557de", "Yüklənir...")}</div> :
          filteredRecipes.length === 0 ?
          <div className="text-center py-8 text-muted-foreground">{tr("adminrecipes_resept_tapilmadi_dde89b", "Resept tapılmadı")}</div> :

          <div className="space-y-3">
              {filteredRecipes.map((recipe, index) =>
            <motion.div
              key={recipe.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
              
                  <div className="flex items-center gap-4">
                    {recipe.image_url ?
                <img src={recipe.image_url} alt={recipe.title} className="w-16 h-16 rounded-lg object-cover" /> :

                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <UtensilsCrossed className="w-6 h-6 text-primary" />
                      </div>
                }
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{recipe.title}</p>
                        <Badge variant={recipe.is_active ? 'default' : 'secondary'}>
                          {recipe.is_active ? 'Aktiv' : 'Deaktiv'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{recipe.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(recipe.prep_time || 0) + (recipe.cook_time || 0)} {tr("adminrecipes_deq_780a5c", "d\u0259q")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {recipe.servings} porsiya
                        </span>
                        {recipe.calories &&
                    <span className="text-orange-500 font-medium">{recipe.calories} kcal</span>
                    }
                        <Badge variant="outline">{categories.find((c) => c.id === recipe.category)?.label || recipe.category}</Badge>
                        {(recipe.tags || []).map((t) => {
                      const tagInfo = recipeTags.find((rt) => rt.tag_id === t);
                      return (
                        <Badge key={t} variant="outline" className="text-[10px]">
                              {tagInfo ? `${tagInfo.emoji} ${localize(tagInfo, 'name')}` : t}
                            </Badge>);

                    })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(recipe)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(recipe.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
            )}
            </div>
          }
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingItem ? tr("adminrecipes_resept_redakte_et_ca3682", "Resept Redakt\u0259 Et") : 'Yeni Resept'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pe-4">
            <div className="space-y-4">
              <Input
                placeholder={tr("adminrecipes_basliq_e1f6c5", "Başlıq")}
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              
              <Textarea
                placeholder={tr("adminrecipes_tesvir_f85651", "Təsvir")}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              
              <Select
                value={formData.category || categories[0]?.id || ''}
                onValueChange={(v) => setFormData({ ...formData, category: v })}>
                
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) =>
                  <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <Label>{tr("adminrecipes_alt_kateqoriya_etiketleri_5a3e12", "Alt kateqoriya etiketləri")}</Label>
                <div className="flex flex-wrap gap-2">
                  {recipeTags.map((tag) => {
                    const selected = (formData.tags || []).includes(tag.tag_id);
                    return (
                      <button
                        key={tag.tag_id}
                        type="button"
                        onClick={() => {
                          const current = formData.tags || [];
                          setFormData({
                            ...formData,
                            tags: selected ?
                            current.filter((s) => s !== tag.tag_id) :
                            [...current, tag.tag_id]
                          });
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selected ?
                        'bg-primary text-primary-foreground border-primary' :
                        'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`
                        }>
                        
                        {tag.emoji} {localize(tag, 'name')}
                      </button>);

                  })}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <Input
                  type="number"
                  placeholder={tr("adminrecipes_hazirliq_deq_0e31cf", "Hazırlıq (dəq)")}
                  value={formData.prep_time || ''}
                  onChange={(e) => setFormData({ ...formData, prep_time: parseInt(e.target.value) })} />
                
                <Input
                  type="number"
                  placeholder={tr("adminrecipes_bisirme_deq_88f48d", "Bişirmə (dəq)")}
                  value={formData.cook_time || ''}
                  onChange={(e) => setFormData({ ...formData, cook_time: parseInt(e.target.value) })} />
                
                <Input
                  type="number"
                  placeholder="Porsiya"
                  value={formData.servings || ''}
                  onChange={(e) => setFormData({ ...formData, servings: parseInt(e.target.value) })} />
                
                <Input
                  type="number"
                  placeholder="Kalori (kcal)"
                  value={formData.calories || ''}
                  onChange={(e) => setFormData({ ...formData, calories: e.target.value ? parseInt(e.target.value) : null })} />
                
              </div>
              <div className="space-y-2">
                <Label>{tr("adminrecipes_resept_sekli_881c26", "Resept şəkli")}</Label>
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden" />
                
                
                {formData.image_url ?
                <div className="relative">
                    <img
                    src={formData.image_url}
                    alt={tr("adminrecipes_resept_sekli_881c26", "Resept şəkli")}
                    className="w-full h-48 object-cover rounded-lg border" />
                  
                    <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 end-2 h-8 w-8"
                    onClick={handleRemoveImage}>
                    
                      <X className="w-4 h-4" />
                    </Button>
                  </div> :

                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  
                    {uploadingImage ?
                  <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">{tr("adminrecipes_yuklenir_5557de", "Yüklənir...")}</span>
                      </div> :

                  <>
                        <ImageIcon className="w-10 h-10 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">{tr("adminrecipes_sekil_yuklemek_ucun_klikleyin_91a262", "Şəkil yükləmək üçün klikləyin")}</span>
                        <span className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP (max 5MB)</span>
                      </>
                  }
                  </div>
                }
              </div>
              <Textarea
                placeholder={tr("adminrecipes_inqrediyentler_her_setirde_bir_f98891", "İnqrediyentlər (hər sətirdə bir)")}
                value={(formData.ingredients || []).join('\n')}
                onChange={(e) => setFormData({ ...formData, ingredients: e.target.value.split('\n').filter(Boolean) })}
                rows={5} />
              
              <Textarea
                placeholder={tr("adminrecipes_telimatlar_her_setirde_bir_addim_0c6e13", "Təlimatlar (hər sətirdə bir addım)")}
                value={(formData.instructions || []).join('\n')}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value.split('\n').filter(Boolean) })}
                rows={5} />
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                
                <span className="text-sm">Aktiv</span>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleModalClose(false)}>
              {tr("adminrecipes_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {editingItem ? tr("adminrecipes_yenile_570ce2", "Yenil\u0259") : tr("adminrecipes_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardChanges}
        onSave={async () => {
          await handleSave();
          setShowUnsavedDialog(false);
        }} />
      

      {/* CSV Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              CSV İmport - {importData.length} {tr("adminrecipes_resept_tapildi_1d8733", "resept tap\u0131ld\u0131")}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[50vh]">
            <div className="space-y-2 pe-4">
              {importData.map((recipe, idx) =>
              <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{recipe.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{recipe.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{categories.find((c) => c.id === recipe.category)?.label || recipe.category}</Badge>
                      <span>{recipe.prep_time || 0}+{recipe.cook_time || 0} {tr("adminrecipes_deq_780a5c", "d\u0259q")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              {tr("adminrecipes_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              {importing ?
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> :

              <FileUp className="w-4 h-4" />
              }
              {importing ? tr("adminrecipes_yuklenir_5557de", "Y\xFCkl\u0259nir...") : `${importData.length} Resept İmport Et`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminUsageStats
        eventNames={['recipe_viewed']}
        title={tr("adminrecipes_resept_istifade_statistikasi_d6132d", "🍳 Resept İstifadə Statistikası")}
        showEventData
        showUsers />
      
    </div>);

};

export default AdminRecipes;