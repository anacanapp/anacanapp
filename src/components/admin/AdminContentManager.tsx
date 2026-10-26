import { useState, useEffect, useRef } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, ChefHat, Lightbulb, Shield, Baby, Briefcase, Apple, X, Upload, Image, FileUp, FileDown } from 'lucide-react';
import { exportToCSV } from '@/utils/csvExport';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BulkTipsImport from './BulkTipsImport';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

type ContentType = 'recipes' | 'tips' | 'safety' | 'names' | 'hospital' | 'nutrition';

interface ContentItem {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  content?: string;
  category?: string;
  is_active?: boolean;
  image_url?: string;
  [key: string]: any;
}

const AdminContentManager = () => {
    const localize = useAdminLocalize();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ContentType>('recipes');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showNamesImport, setShowNamesImport] = useState(false);
  const [namesImportData, setNamesImportData] = useState<any[]>([]);
  const [namesImporting, setNamesImporting] = useState(false);
  const [showRecipesImport, setShowRecipesImport] = useState(false);
  const [recipesImportData, setRecipesImportData] = useState<any[]>([]);
  const [recipesImporting, setRecipesImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const namesFileInputRef = useRef<HTMLInputElement>(null);
  const recipesFileInputRef = useRef<HTMLInputElement>(null);
  const initialFormDataRef = useRef<string>('');

  const contentConfig = {
    recipes: {
      table: 'admin_recipes',
      title: tr("admincontentmanager_reseptler_98ed2c", "Reseptlər"),
      icon: ChefHat,
      fields: ['title', 'description', 'category', 'prep_time', 'cook_time', 'servings', 'ingredients', 'instructions', 'image_url', 'is_active'],
      categories: ['pregnancy', 'breastfeeding', 'baby_food', 'healthy'],
      hasImage: true
    },
    tips: {
      table: 'weekly_tips',
      title: tr("admincontentmanager_heftelik_tovsiyeler_8dcd89", "Həftəlik Tövsiyələr"),
      icon: Lightbulb,
      fields: ['week_number', 'life_stage', 'title', 'content', 'is_active'],
      categories: ['pregnancy', 'postpartum', 'baby'],
      hasImage: false
    },
    safety: {
      table: 'safety_items',
      title: tr("admincontentmanager_tehlukesizlik_8bc156", "Təhlükəsizlik"),
      icon: Shield,
      fields: ['name', 'name_az', 'category', 'safety_level', 'description', 'description_az', 'is_active'],
      categories: ['food', 'drink', 'activity', 'beauty', 'medicine'],
      hasImage: false
    },
    names: {
      table: 'baby_names_db',
      title: tr("admincontentmanager_korpe_adlari_357880", "Körpə Adları"),
      icon: Baby,
      fields: ['name', 'gender', 'origin', 'meaning', 'meaning_az', 'popularity', 'is_active'],
      categories: ['boy', 'girl', 'unisex'],
      hasImage: false
    },
    hospital: {
      table: 'hospital_bag_templates',
      title: tr("admincontentmanager_xestexana_cantasi_045078", "Xəstəxana Çantası"),
      icon: Briefcase,
      fields: ['item_name', 'item_name_az', 'category', 'priority', 'notes', 'is_essential', 'sort_order', 'is_active'],
      categories: ['mom', 'baby', 'documents'],
      hasImage: false
    },
    nutrition: {
      table: 'nutrition_tips',
      title: tr("admincontentmanager_qidalanma_tovsiyeleri_f04bf1", "Qidalanma Tövsiyələri"),
      icon: Apple,
      fields: ['title', 'content', 'category', 'trimester', 'calories', 'is_active'],
      categories: ['pregnancy', 'breastfeeding', 'baby'],
      hasImage: false
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `recipe-${Date.now()}.${fileExt}`;
      const filePath = `recipes/${fileName}`;

      const { error: uploadError } = await supabase.storage.
      from('community-media').
      upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.
      from('community-media').
      getPublicUrl(filePath);

      setFormData({ ...formData, image_url: urlData.publicUrl });
      toast({ title: tr("admincontentmanager_sekil_yuklendi_0c2f85", "Şəkil yükləndi!") });
    } catch (error: any) {
      toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    const config = contentConfig[activeTab];

    try {
      // DÜZƏLİŞ: limitsiz idi — cədvəl (məs. baby_names_db) 1000-i keçəndə
      // "Adlar" tab-ı yalnız ilk 1000 sətri göstərir/axtarır/redaktə edirdi.
      const data = await fetchAllRows((from, to) =>
        supabase.from(config.table as any).select('*').order('created_at', { ascending: false }).range(from, to)
      );
      setItems(data as unknown as ContentItem[] || []);
    } catch (error: any) {
      toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  // CSV parsing helper for baby names
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
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

  const handleNamesCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: tr("admincontentmanager_csv_fayli_bosdur_0a908c", "CSV faylı boşdur"), variant: 'destructive' });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const headerMap: Record<string, string> = {
        'Ad': 'name',
        'Cins': 'gender',
        'Mənşə': 'origin',
        'Məna': 'meaning',
        'Məna (AZ)': 'meaning_az',
        'Populyarlıq': 'popularity'
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

            if (dbField === 'gender') {
              // Map Azerbaijani gender names to DB values
              const genderMap: Record<string, string> = {
                'Qız': 'girl',
                'Oğlan': 'boy',
                'Unisex': 'unisex'
              };
              value = genderMap[value] || value.toLowerCase();
            } else if (dbField === 'popularity') {
              // Parse popularity percentage to number
              const numValue = parseInt(value.replace('%', ''));
              row[dbField] = isNaN(numValue) ? 50 : numValue;
              return;
            }

            row[dbField] = value;
          }
        });

        if (row.name) {
          parsedData.push(row);
        }
      }

      if (parsedData.length === 0) {
        toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: tr("admincontentmanager_hec_bir_ad_tapilmadi_980945", "Heç bir ad tapılmadı"), variant: 'destructive' });
        return;
      }

      setNamesImportData(parsedData);
      setShowNamesImport(true);
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNamesImport = async () => {
    if (namesImportData.length === 0) return;

    setNamesImporting(true);
    try {
      // Fetch existing names to filter duplicates
      // DÜZƏLİŞ: limitsiz idi — baby_names_db 1000-i keçəndə (ad bazası
      // adətən mindən çox olur) dublikat yoxlanışı 1000-dən sonrakı adları
      // "yox" hesab edib TƏKRAR idxal edə bilirdi.
      const existingNames = await fetchAllRows<{ name: string; gender: string }>((from, to) =>
        supabase.from('baby_names_db').select('name, gender').range(from, to)
      );

      const existingSet = new Set(
        (existingNames || []).map((n) => `${n.name.toLowerCase()}|${n.gender}`)
      );

      const newNames = namesImportData.filter(
        (n: any) => !existingSet.has(`${n.name.toLowerCase()}|${n.gender}`)
      );

      const duplicateCount = namesImportData.length - newNames.length;

      if (newNames.length === 0) {
        toast({
          title: tr("admincontentmanager_melumat_a1209f", "Məlumat"),
          description: `Bütün ${namesImportData.length} ad artıq mövcuddur`
        });
        setShowNamesImport(false);
        setNamesImportData([]);
        return;
      }

      const { error } = await supabase.
      from('baby_names_db').
      insert(newNames);

      if (error) throw error;

      toast({
        title: tr("admincontentmanager_ugurlu_5c0191", "Uğurlu!"),
        description: `${newNames.length} yeni ad əlavə edildi${duplicateCount > 0 ? `, ${duplicateCount} təkrar ad keçildi` : ''}`
      });
      setShowNamesImport(false);
      setNamesImportData([]);
      fetchItems();
    } catch (error: any) {
      toast({
        title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setNamesImporting(false);
    }
  };

  // Recipes CSV Import Handler
  const handleRecipesCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: tr("admincontentmanager_csv_fayli_bosdur_0a908c", "CSV faylı boşdur"), variant: 'destructive' });
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

            if (dbField === 'prep_time' || dbField === 'cook_time' || dbField === 'servings') {
              const numValue = parseInt(value);
              row[dbField] = isNaN(numValue) ? 0 : numValue;
            } else if (dbField === 'ingredients' || dbField === 'instructions') {
              // Split by semicolon or newline
              const items = value.split(/[;|\n]/).map((s) => s.trim()).filter((s) => s);
              row[dbField] = items;
            } else {
              row[dbField] = value;
            }
          }
        });

        if (row.title) {
          if (!row.category) row.category = 'healthy';
          parsedData.push(row);
        }
      }

      if (parsedData.length === 0) {
        toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: tr("admincontentmanager_hec_bir_resept_tapilmadi_f2f561", "Heç bir resept tapılmadı"), variant: 'destructive' });
        return;
      }

      setRecipesImportData(parsedData);
      setShowRecipesImport(true);
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRecipesImport = async () => {
    if (recipesImportData.length === 0) return;

    setRecipesImporting(true);
    try {
      const { error } = await supabase.
      from('admin_recipes').
      insert(recipesImportData);

      if (error) throw error;

      toast({
        title: tr("admincontentmanager_ugurlu_5c0191", "Uğurlu!"),
        description: `${recipesImportData.length} resept əlavə edildi`
      });
      setShowRecipesImport(false);
      setRecipesImportData([]);
      fetchItems();
    } catch (error: any) {
      toast({
        title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setRecipesImporting(false);
    }
  };

  const downloadRecipesTemplate = () => {
    const template = `Başlıq,Təsvir,Kateqoriya,Hazırlıq (dəq),Bişirmə (dəq),Porsiya,İnqredientlər,Hazırlanma,Şəkil URL
"Limonlu Zəncəfil Çayı","Hamiləlik dövründə ürəkbulanmaya qarşı ideal içki","pregnancy",5,0,2,"Su - 500ml; Təzə zəncəfil - 2sm; Limon - yarım; Bal - 1 çay qaşığı","Zəncəfili doğrayın; Suyu qaynadın; Zəncəfili əlavə edib 5 dəq dəmləyin; Limon və bal əlavə edin",""
"Avokado Tostu","Folat və sağlam yağlarla zəngin səhər yeməyi","pregnancy",10,5,1,"Çörək - 2 dilim; Avokado - 1 ədəd; Yumurta - 1 ədəd; Duz, istiot","Çörəyi qızardın; Avokadonu əzin; Yumurtanı bişirin; Hamısını birləşdirin",""
"Banan Smoothie","Enerji verən və qəbizliyə qarşı içki","breastfeeding",5,0,1,"Banan - 1 ədəd; Süd - 200ml; Bal - 1 çay qaşığı; Yulaf - 2 xörək qaşığı","Bütün inqredientləri blenderə qoyun; 1 dəq qarışdırın; Soyuq serviz edin",""`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reseptler_numune.csv';
    link.click();
  };

  const downloadNamesTemplate = () => {
    const template = `Ad,Cins,Mənşə,Məna,Məna (AZ),Populyarlıq
"Aylin","Qız","Türk","Ayın parıltısı","Ayın ətrafındakı işıq, nur","98%"
"Əli","Oğlan","Ərəb","Yüksək, əzəmətli","Uca, şərəfli","99%"
"Ayan","Unisex","Türk","Bəlli, açıq","Göz qabağında olan, tanınan","90%"`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'usaq_adlari_numune.csv';
    link.click();
  };

  const handleSave = async () => {
    const config = contentConfig[activeTab];

    try {
      if (editingItem?.id) {
        const { error } = await supabase.
        from(config.table as any).
        update(formData).
        eq('id', editingItem.id);

        if (error) throw error;
        toast({ title: tr("admincontentmanager_ugurlu_7fe64c", "Uğurlu"), description: tr("admincontentmanager_melumat_yenilendi_39c064", "Məlumat yeniləndi") });
      } else {
        const { error } = await supabase.
        from(config.table as any).
        insert(formData);

        if (error) throw error;
        toast({ title: tr("admincontentmanager_ugurlu_7fe64c", "Uğurlu"), description: tr("admincontentmanager_yeni_melumat_elave_edildi_0714a8", "Yeni məlumat əlavə edildi") });
      }

      setShowModal(false);
      setEditingItem(null);
      setFormData({});
      fetchItems();
    } catch (error: any) {
      toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("admincontentmanager_silmek_istediyinizden_eminsini_ca19d0", "Silm\u0259k ist\u0259diyinizd\u0259n \u0259minsiniz?"))) return;

    const config = contentConfig[activeTab];

    const { error } = await supabase.
    from(config.table as any).
    delete().
    eq('id', id);

    if (error) {
      toast({ title: tr("admincontentmanager_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: tr("admincontentmanager_ugurlu_7fe64c", "Uğurlu"), description: tr("admincontentmanager_melumat_silindi_3b4db0", "Məlumat silindi") });
      fetchItems();
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    const initialData = { is_active: true };
    setFormData(initialData);
    initialFormDataRef.current = JSON.stringify(initialData);
    setShowModal(true);
  };

  const openEditModal = (item: ContentItem) => {
    setEditingItem(item);
    setFormData(item);
    initialFormDataRef.current = JSON.stringify(item);
    setShowModal(true);
  };

  const hasUnsavedChanges = () => {
    if (!showModal) return false;
    return JSON.stringify(formData) !== initialFormDataRef.current;
  };

  const handleModalClose = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      setShowModal(false);
      setEditingItem(null);
      setFormData({});
    }
  };

  const handleDiscardChanges = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({});
  };

  const filteredItems = items.filter((item) => {
    const searchLower = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(searchLower) ||
      item.name?.toLowerCase().includes(searchLower) ||
      item.item_name?.toLowerCase().includes(searchLower) ||
      item.item_name_az?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.content?.toLowerCase().includes(searchLower));

  });

  const config = contentConfig[activeTab];
  const Icon = config.icon;

  const renderFormField = (field: string) => {
    switch (field) {
      case 'image_url':
        return (
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              className="hidden" />
            
            {formData.image_url ?
            <div className="relative">
                <img
                src={formData.image_url}
                alt="Preview"
                className="w-full h-40 object-cover rounded-xl" />
              
                <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 end-2"
                onClick={() => setFormData({ ...formData, image_url: '' })}>
                
                  <X className="w-4 h-4" />
                </Button>
              </div> :

            <Button
              type="button"
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}>
              
                {uploadingImage ?
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /> :

              <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6" />
                    <span className="text-sm">{tr("admincontentmanager_sekil_yukle_0577d2", "Şəkil yüklə")}</span>
                  </div>
              }
              </Button>
            }
          </div>);

      case 'category':
      case 'life_stage':
      case 'gender':
      case 'safety_level':
        const options = field === 'safety_level' ?
        ['safe', 'warning', 'danger'] :
        field === 'gender' ?
        ['boy', 'girl', 'unisex'] :
        config.categories;
        return (
          <Select value={formData[field] || ''} onValueChange={(v) => setFormData({ ...formData, [field]: v })}>
            <SelectTrigger>
              <SelectValue placeholder={`${field} seçin`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) =>
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              )}
            </SelectContent>
          </Select>);

      case 'priority':
        return (
          <Select value={String(formData[field] || 2)} onValueChange={(v) => setFormData({ ...formData, [field]: parseInt(v) })}>
            <SelectTrigger>
              <SelectValue placeholder={tr("admincontentmanager_prioritet_secin_8e4410", "Prioritet seçin")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{tr("admincontentmanager_yuksek_492584", "Yüksək")}</SelectItem>
              <SelectItem value="2">Orta</SelectItem>
              <SelectItem value="3">{tr("admincontentmanager_asagi_1c27f1", "Aşağı")}</SelectItem>
            </SelectContent>
          </Select>);

      case 'notes':
        return (
          <Textarea
            value={formData[field] || ''}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            placeholder={tr("admincontentmanager_qisa_aciqlama_ve_ya_melumat_d5937b", "Qısa açıqlama və ya məlumat")}
            rows={2} />);


      case 'is_active':
      case 'is_essential':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={formData[field] || false}
              onCheckedChange={(v) => setFormData({ ...formData, [field]: v })} />
            
            <span className="text-sm">{field === 'is_active' ? 'Aktiv' : 'Vacib'}</span>
          </div>);

      case 'description':
      case 'content':
      case 'description_az':
        return (
          <Textarea
            value={formData[field] || ''}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            placeholder={field}
            rows={4} />);


      case 'week_number':
      case 'prep_time':
      case 'cook_time':
      case 'servings':
      case 'trimester':
      case 'calories':
      case 'popularity':
      case 'sort_order':
        return (
          <Input
            type="number"
            value={formData[field] || ''}
            onChange={(e) => setFormData({ ...formData, [field]: parseInt(e.target.value) || 0 })}
            placeholder={field} />);


      case 'ingredients':
      case 'instructions':
        const arrayValue = Array.isArray(formData[field]) ? formData[field] : [];
        return (
          <div className="space-y-2">
            <Textarea
              value={arrayValue.join('\n')}
              onChange={(e) => {
                const lines = e.target.value.split('\n').filter((line) => line.trim());
                setFormData({ ...formData, [field]: lines });
              }}
              placeholder={field === 'ingredients' ? tr("admincontentmanager_her_setirde_bir_inqredient_8976a7", "H\u0259r s\u0259tird\u0259 bir inqredient") : tr("admincontentmanager_her_setirde_bir_addim_b5ed41", "H\u0259r s\u0259tird\u0259 bir add\u0131m")}
              rows={5} />
            
            <p className="text-xs text-muted-foreground">
              {field === 'ingredients' ? tr("admincontentmanager_her_inqrediyenti_yeni_setirde__b7ff98", "H\u0259r inqrediyenti yeni s\u0259tird\u0259 yaz\u0131n") : tr("admincontentmanager_her_addimi_yeni_setirde_yazin_747857", "H\u0259r add\u0131m\u0131 yeni s\u0259tird\u0259 yaz\u0131n")}
            </p>
          </div>);

      default:
        return (
          <Input
            value={formData[field] || ''}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            placeholder={field} />);


    }
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      title: tr("admincontentmanager_basliq_e1f6c5", "Başlıq"),
      name: 'Ad',
      name_az: 'Ad (AZ)',
      description: tr("admincontentmanager_tesvir_f85651", "Təsvir"),
      description_az: tr("admincontentmanager_tesvir_az_2c237a", "T\u0259svir (AZ)"),
      content: tr("admincontentmanager_mezmun_f1d51d", "Məzmun"),
      category: 'Kateqoriya',
      life_stage: tr("admincontentmanager_heyat_merhelesi_c3ab6b", "H\u0259yat M\u0259rh\u0259l\u0259si"),
      week_number: tr("admincontentmanager_hefte_nomresi_a358c3", "H\u0259ft\u0259 N\xF6mr\u0259si"),
      gender: 'Cins',
      origin: tr("admincontentmanager_mense_4c0d88", "M\u0259n\u015F\u0259"),
      meaning: tr("admincontentmanager_mena_c57b0f", "M\u0259na"),
      meaning_az: tr("admincontentmanager_mena_az_389323", "M\u0259na (AZ)"),
      popularity: tr("admincontentmanager_populyarliq_1501b1", "Populyarl\u0131q"),
      safety_level: tr("admincontentmanager_tehlukesizlik_seviyyesi_fb6998", "T\u0259hl\xFCk\u0259sizlik S\u0259viyy\u0259si"),
      item_name: tr("admincontentmanager_element_adi_4cc1d1", "Element Ad\u0131"),
      item_name_az: tr("admincontentmanager_element_adi_az_caaab5", "Element Ad\u0131 (AZ)"),
      is_essential: 'Vacib',
      sort_order: tr("admincontentmanager_siralama_9e1268", "S\u0131ralama"),
      priority: 'Prioritet',
      notes: 'Qeyd',
      prep_time: tr("admincontentmanager_hazirliq_vaxti_deq_3918df", "Haz\u0131rl\u0131q Vaxt\u0131 (d\u0259q)"),
      cook_time: tr("admincontentmanager_bisirme_vaxti_deq_c0c7ee", "Bi\u015Firm\u0259 Vaxt\u0131 (d\u0259q)"),
      servings: 'Porsiya',
      trimester: 'Trimester',
      calories: 'Kalori',
      is_active: 'Aktiv',
      image_url: tr("admincontentmanager_sekil_43e2e3", "\u015E\u0259kil"),
      ingredients: tr("admincontentmanager_i_nqredientler_ac7a19", "\u0130nqredientl\u0259r"),
      instructions: tr("admincontentmanager_hazirlanma_qaydasi_f718e5", "Haz\u0131rlanma Qaydas\u0131")
    };
    return labels[field] || field;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">{tr("admincontentmanager_kontent_idareetmesi_ecbe99", "Kontent İdarəetməsi")}</h1>
        </div>
        <div className="flex gap-2">
          {activeTab === 'recipes' &&
          <>
              <input
              type="file"
              ref={recipesFileInputRef}
              accept=".csv"
              onChange={handleRecipesCSVUpload}
              className="hidden" />
            
              <Button onClick={downloadRecipesTemplate} variant="ghost" size="sm" className="gap-1">
                {tr("admincontentmanager_sablon_365c9d", "\uD83D\uDCE5 \u015Eablon")}
              </Button>
              <Button onClick={() => recipesFileInputRef.current?.click()} variant="outline" className="gap-2">
                <FileUp className="w-4 h-4" />
                CSV İmport
              </Button>
            </>
          }
          {activeTab === 'tips' &&
          <Button onClick={() => setShowBulkImport(true)} variant="outline" className="gap-2">
              <FileUp className="w-4 h-4" />
              Toplu İmport
            </Button>
          }
          {activeTab === 'names' &&
          <>
              <input
              type="file"
              ref={namesFileInputRef}
              accept=".csv"
              onChange={handleNamesCSVUpload}
              className="hidden" />
            
              <Button onClick={downloadNamesTemplate} variant="ghost" size="sm" className="gap-1">
                {tr("admincontentmanager_sablon_365c9d", "\uD83D\uDCE5 \u015Eablon")}
              </Button>
              <Button onClick={() => namesFileInputRef.current?.click()} variant="outline" className="gap-2">
                <FileUp className="w-4 h-4" />
                CSV İmport
              </Button>
              <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                exportToCSV(
                  items,
                  [
                  { key: 'name', header: 'Ad' },
                  { key: 'gender', header: 'Cins' },
                  { key: 'origin', header: tr("admincontentmanager_mense_4c0d88", "Mənşə") },
                  { key: 'meaning', header: tr("admincontentmanager_mena_c57b0f", "Məna") },
                  { key: 'meaning_az', header: tr("admincontentmanager_mena_az_389323", "Məna (AZ)") },
                  { key: 'popularity', header: tr("admincontentmanager_populyarliq_1501b1", "Populyarlıq") },
                  { key: 'is_active', header: 'Aktiv' }],

                  'baby_names_export.csv'
                );
                toast({ title: `${items.length} ad ixrac edildi` });
              }}
              disabled={items.length === 0}>
              
                <FileDown className="w-4 h-4" />
                İxrac
              </Button>
            </>
          }
          <Button onClick={openCreateModal} className="gradient-primary">
            <Plus className="w-4 h-4 me-2" />
            {tr("admincontentmanager_yeni_elave_et_fa6b69", "Yeni \u018Flav\u0259 Et")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentType)}>
        <TabsList className="grid grid-cols-6 w-full mb-6">
          <TabsTrigger value="recipes" className="flex items-center gap-1">
            <ChefHat className="w-4 h-4" />
            <span className="hidden md:inline">{tr("admincontentmanager_reseptler_98ed2c", "Reseptlər")}</span>
          </TabsTrigger>
          <TabsTrigger value="tips" className="flex items-center gap-1">
            <Lightbulb className="w-4 h-4" />
            <span className="hidden md:inline">{tr("admincontentmanager_tovsiyeler_17a8f7", "Tövsiyələr")}</span>
          </TabsTrigger>
          <TabsTrigger value="safety" className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span className="hidden md:inline">{tr("admincontentmanager_tehlukesizlik_8bc156", "Təhlükəsizlik")}</span>
          </TabsTrigger>
          <TabsTrigger value="names" className="flex items-center gap-1">
            <Baby className="w-4 h-4" />
            <span className="hidden md:inline">Adlar</span>
          </TabsTrigger>
          <TabsTrigger value="hospital" className="flex items-center gap-1">
            <Briefcase className="w-4 h-4" />
            <span className="hidden md:inline">{tr("admincontentmanager_canta_95fd63", "Çanta")}</span>
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="flex items-center gap-1">
            <Apple className="w-4 h-4" />
            <span className="hidden md:inline">Qidalanma</span>
          </TabsTrigger>
        </TabsList>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Axtar..."
              className="ps-10" />
            
          </div>
        </div>

        {loading ?
        <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div> :

        <div className="space-y-3">
            {filteredItems.length === 0 ?
          <div className="text-center py-12 text-muted-foreground">
                <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{tr("admincontentmanager_hec_bir_melumat_tapilmadi_54c062", "Heç bir məlumat tapılmadı")}</p>
              </div> :

          filteredItems.map((item) =>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 border border-border flex items-center gap-4">
            
                  {/* Show image if available (for recipes) */}
                  {item.image_url ?
            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                src={item.image_url}
                alt={item.title || tr("admincontentmanager_sekil_43e2e3", "\u015E\u0259kil")}
                className="w-full h-full object-cover" />
              
                    </div> :

            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            item.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'}`
            }>
                      <Icon className="w-5 h-5" />
                    </div>
            }
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.title || item.name || item.item_name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.description || item.content || item.meaning || item.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
              item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`
              }>
                      {item.is_active ? 'Aktiv' : 'Deaktiv'}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </motion.div>
          )
          }
          </div>
        }
      </Tabs>

      {/* Edit/Create Modal */}
      <Dialog open={showModal} onOpenChange={(open) => {
        if (!open) handleModalClose();else
        setShowModal(open);
      }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? tr("admincontentmanager_redakte_et_66cf3b", "Redakt\u0259 et") : tr("admincontentmanager_yeni_elave_et_bcd4a4", "Yeni \u0259lav\u0259 et")} - {config.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {config.fields.map((field) =>
            <div key={field} className="space-y-2">
                <label className="text-sm font-medium">{getFieldLabel(field)}</label>
                {renderFormField(field)}
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={handleModalClose} className="flex-1">
                {tr("admincontentmanager_legv_et_b5e49c", "L\u0259\u011Fv et")}
              </Button>
              <Button onClick={handleSave} className="flex-1 gradient-primary">
                Yadda saxla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Tips Import Modal */}
      <BulkTipsImport
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={fetchItems} />
      

      {/* Baby Names CSV Import Modal */}
      <Dialog open={showNamesImport} onOpenChange={setShowNamesImport}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Baby className="w-5 h-5 text-primary" />
              CSV İmport - {namesImportData.length} {tr("admincontentmanager_ad_tapildi_91d072", "ad tap\u0131ld\u0131")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {namesImportData.slice(0, 20).map((item, idx) =>
            <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className={`text-lg ${item.gender === 'girl' ? 'text-pink-500' : item.gender === 'boy' ? 'text-blue-500' : 'text-purple-500'}`}>
                  {item.gender === 'girl' ? '👧' : item.gender === 'boy' ? '👦' : '👶'}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.origin && `${item.origin} • `}
                    {localize(item, 'meaning')}
                  </p>
                </div>
                <div className="text-end">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {item.popularity}%
                  </span>
                </div>
              </div>
            )}
            {namesImportData.length > 20 &&
            <p className="text-center text-sm text-muted-foreground py-2">
                {tr("admincontentmanager_ve_daha_59ab39", "v\u0259 daha")} {namesImportData.length - 20} ad...
              </p>
            }
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {setShowNamesImport(false);setNamesImportData([]);}}
              className="flex-1"
              disabled={namesImporting}>
              {tr("admincontentmanager_legv_et_b5e49c", "L\u0259\u011Fv et")}
            
            </Button>
            <Button
              onClick={handleNamesImport}
              className="flex-1 gradient-primary"
              disabled={namesImporting}>
              
              {namesImporting ?
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :

              `${namesImportData.length} Ad Əlavə Et`
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipes CSV Import Modal */}
      <Dialog open={showRecipesImport} onOpenChange={setShowRecipesImport}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-primary" />
              CSV İmport - {recipesImportData.length} {tr("admincontentmanager_resept_tapildi_1d8733", "resept tap\u0131ld\u0131")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {recipesImportData.slice(0, 15).map((item, idx) =>
            <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🍽️</span>
                  <div className="flex-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                  <div className="text-end text-xs text-muted-foreground">
                    <p>⏱️ {item.prep_time || 0}+{item.cook_time || 0} {tr("admincontentmanager_deq_780a5c", "d\u0259q")}</p>
                    <p>🍴 {item.servings || 1} porsiya</p>
                  </div>
                </div>
                {item.ingredients && item.ingredients.length > 0 &&
              <p className="text-xs text-muted-foreground mt-2">
                    {item.ingredients.length} inqredient • {item.instructions?.length || 0} {tr("admincontentmanager_addim_74e240", "add\u0131m")}
                  </p>
              }
              </div>
            )}
            {recipesImportData.length > 15 &&
            <p className="text-center text-sm text-muted-foreground py-2">
                {tr("admincontentmanager_ve_daha_59ab39", "v\u0259 daha")} {recipesImportData.length - 15} resept...
              </p>
            }
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {setShowRecipesImport(false);setRecipesImportData([]);}}
              className="flex-1"
              disabled={recipesImporting}>
              {tr("admincontentmanager_legv_et_b5e49c", "L\u0259\u011Fv et")}
            
            </Button>
            <Button
              onClick={handleRecipesImport}
              className="flex-1 gradient-primary"
              disabled={recipesImporting}>
              
              {recipesImporting ?
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :

              `${recipesImportData.length} Resept Əlavə Et`
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardChanges} />
      
    </div>);

};

export default AdminContentManager;