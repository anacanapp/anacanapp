import { useState, useRef } from 'react';
import { tr } from '@/lib/tr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Save, X, ExternalLink, Package, Image, Video, Star, Upload, Download, FileSpreadsheet, FileDown } from 'lucide-react';
import { useAppSetting, useUpdateAppSetting } from '@/hooks/useAppSettings';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LocalizedInput } from './ui/LocalizedInput';
import { LocalizedTextarea } from './ui/LocalizedTextarea';
import { useAdminLocalize } from '@/contexts/AdminLanguageContext';
import { exportToCSV } from '@/utils/csvExport';

// CSV Template headers
const CSV_HEADERS = [
'name*', 'name_az*', 'affiliate_url*', 'category', 'platform', 'price', 'original_price',
'currency', 'image_url', 'images', 'video_url', 'store_name', 'store_logo_url',
'description', 'description_az', 'rating', 'review_count', 'review_summary_az',
'life_stages', 'is_featured', 'is_active', 'pros', 'cons', 'tags', 'specifications'];


const CSV_TEMPLATE = `name*,name_az*,affiliate_url*,category,platform,price,original_price,currency,image_url,images,video_url,store_name,store_logo_url,description,description_az,rating,review_count,review_summary_az,life_stages,is_featured,is_active,pros,cons,tags,specifications
Baby Stroller,Uşaq arabası,https://example.com/product1,baby_gear,trendyol,199.99,249.99,AZN,https://example.com/img.jpg,"https://img1.jpg|https://img2.jpg",,Trendyol,,High quality stroller,Yüksək keyfiyyətli araba,4.5,120,Əla məhsuldur,bump|mommy,true,true,"Rahat|Möhkəm","Ağır",körpə|araba,"{""Çəki"":""8kg"",""Rəng"":""Qara""}"`;

const parseCSV = (text: string) => {
  const lines = text.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace('*', ''));
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const product: Record<string, any> = {};
    headers.forEach((header, index) => {
      const value = values[index] || '';
      product[header] = value;
    });
    products.push(product);
  }

  return products;
};

const AdminAffiliateProducts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section enabled toggle
  const sectionEnabled = useAppSetting('affiliate_section_enabled') !== false;
  const updateSetting = useUpdateAppSetting();

  const [formData, setFormData] = useState({
    name: '', name_az: '', name_en: '', name_ru: '', name_tr: '',
    description: '', description_az: '', description_en: '', description_ru: '', description_tr: '',
    category: 'general', category_az: '', price: '', original_price: '',
    currency: 'AZN', affiliate_url: '', platform: 'other',
    image_url: '', images: '', video_url: '',
    store_name: '', store_logo_url: '',
    rating: '', review_count: '', review_summary: '', review_summary_az: '', review_summary_en: '', review_summary_ru: '', review_summary_tr: '',
    life_stages: ['bump'], is_featured: false, is_active: true,
    pros: '', cons: '', tags: '', specifications: ''
  });

  const localize = useAdminLocalize();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-affiliate-products'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('affiliate_products').
      select('*').
      order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & {id?: string;}) => {
      // Parse arrays and JSON
      const imagesArray = data.images ? data.images.split('\n').filter(Boolean) : [];
      const prosArray = data.pros ? data.pros.split('\n').filter(Boolean) : [];
      const consArray = data.cons ? data.cons.split('\n').filter(Boolean) : [];
      const tagsArray = data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

      let specsObj = {};
      if (data.specifications) {
        try {
          specsObj = JSON.parse(data.specifications);
        } catch {
          // Try to parse as key:value lines
          data.specifications.split('\n').forEach((line) => {
            const [key, value] = line.split(':').map((s) => s.trim());
            if (key && value) (specsObj as Record<string, string>)[key] = value;
          });
        }
      }

      // NOT: əvvəllər sabit sahə siyahısı göndərilirdi (yalnız _az) -
      // LocalizedInput/Textarea admin dili ru/tr olanda name_ru/
      // description_tr/review_summary_ru və s. yazırdı, amma bunlar heç vaxt
      // göndərilmirdi (sessiz itki). `affiliate_products`-da YALNIZ
      // _az/_en/_ru/_tr sütunları mövcuddur (kk/de/ar sütunları yoxdur) -
      // ona görə həmin sahələr açıq şəkildə çıxarılır ki, admin təsadüfən
      // kk/de/ar rejiminə keçəndə mövcud olmayan sütuna yazma xətası
      // baş verməsin.
      const { id: _ignoredId, images: _i, pros: _p, cons: _c, tags: _t, specifications: _s, ...localizedFields } = data;
      const filteredLocalizedFields = Object.fromEntries(
        Object.entries(localizedFields).filter(([k]) => !k.endsWith('_kk') && !k.endsWith('_de') && !k.endsWith('_ar'))
      );

      const payload = {
        ...filteredLocalizedFields,
        name: data.name,
        name_az: data.name_az || null,
        description: data.description || null,
        description_az: data.description_az || null,
        category: data.category,
        category_az: data.category_az || null,
        price: data.price ? parseFloat(data.price) : null,
        original_price: data.original_price ? parseFloat(data.original_price) : null,
        currency: data.currency,
        affiliate_url: data.affiliate_url,
        platform: data.platform,
        image_url: data.image_url || null,
        images: imagesArray,
        video_url: data.video_url || null,
        store_name: data.store_name || null,
        store_logo_url: data.store_logo_url || null,
        rating: data.rating ? parseFloat(data.rating) : 0,
        review_count: data.review_count ? parseInt(data.review_count) : 0,
        review_summary_az: data.review_summary_az || null,
        life_stages: data.life_stages,
        is_featured: data.is_featured,
        is_active: data.is_active,
        pros: prosArray.length > 0 ? prosArray : null,
        cons: consArray.length > 0 ? consArray : null,
        tags: tagsArray.length > 0 ? tagsArray : null,
        specifications: Object.keys(specsObj).length > 0 ? specsObj : {},
        price_updated_at: new Date().toISOString()
      };

      if (data.id) {
        const { error } = await supabase.from('affiliate_products').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('affiliate_products').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-products'] });
      resetForm();
      toast({ title: tr("adminaffiliateproducts_yadda_saxlanildi_cf4f4a", "Yadda saxlanıldı") });
    },
    onError: (err) => {
      toast({ title: tr("adminaffiliateproducts_xeta_3cdbb6", "Xəta"), description: String(err), variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('affiliate_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-products'] });
      toast({ title: 'Silindi' });
    },
    onError: (err) => {
      toast({ title: tr("adminaffiliateproducts_xeta_3cdbb6", "Xəta"), description: String(err), variant: 'destructive' });
    }
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (products: Record<string, any>[]) => {
      const errors: string[] = [];
      let successCount = 0;

      for (const product of products) {
        try {
          if (!product.name || !product.affiliate_url) {
            errors.push(`Sətir atlandı: name və ya affiliate_url yoxdur`);
            continue;
          }

          const payload = {
            name: product.name,
            name_az: product.name_az || null,
            description: product.description || null,
            description_az: product.description_az || null,
            category: product.category || 'general',
            category_az: product.category_az || null,
            price: product.price ? parseFloat(product.price) : null,
            original_price: product.original_price ? parseFloat(product.original_price) : null,
            currency: product.currency || 'AZN',
            affiliate_url: product.affiliate_url,
            platform: product.platform || 'other',
            image_url: product.image_url || null,
            images: product.images ? product.images.split('|').filter(Boolean) : [],
            video_url: product.video_url || null,
            store_name: product.store_name || null,
            store_logo_url: product.store_logo_url || null,
            rating: product.rating ? parseFloat(product.rating) : 0,
            review_count: product.review_count ? parseInt(product.review_count) : 0,
            review_summary_az: product.review_summary_az || null,
            life_stages: product.life_stages ? product.life_stages.split('|').filter(Boolean) : ['bump'],
            is_featured: product.is_featured === 'true' || product.is_featured === true,
            is_active: product.is_active !== 'false' && product.is_active !== false,
            pros: product.pros ? product.pros.split('|').filter(Boolean) : null,
            cons: product.cons ? product.cons.split('|').filter(Boolean) : null,
            tags: product.tags ? product.tags.split('|').filter(Boolean) : null,
            specifications: product.specifications ? JSON.parse(product.specifications) : {},
            price_updated_at: new Date().toISOString()
          };

          const { error } = await supabase.from('affiliate_products').insert(payload);
          if (error) throw error;
          successCount++;
        } catch (e: any) {
          errors.push(`"${product.name || 'Unknown'}": ${e.message}`);
        }
      }

      return { successCount, errors };
    },
    onSuccess: ({ successCount, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-products'] });
      setImporting(false);
      if (errors.length > 0) {
        toast({
          title: `${successCount} məhsul əlavə edildi`,
          description: `${errors.length} xəta: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`,
          variant: errors.length > successCount ? 'destructive' : 'default'
        });
      } else {
        toast({ title: `${successCount} məhsul uğurla əlavə edildi` });
      }
    },
    onError: (err) => {
      setImporting(false);
      toast({ title: tr("adminaffiliateproducts_import_xetasi_a3a4fb", "İmport xətası"), description: String(err), variant: 'destructive' });
    }
  });

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const products = parseCSV(text);

      if (products.length === 0) {
        setImporting(false);
        toast({ title: tr("adminaffiliateproducts_csv_bosdur_ve_ya_formati_sehvdir_ece4c1", "CSV boşdur və ya formatı səhvdir"), variant: 'destructive' });
        return;
      }

      bulkImportMutation.mutate(products);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadCSVTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'affiliate_products_template.csv';
    link.click();
  };

  const resetForm = () => {
    setFormData({
      name: '', name_az: '', name_en: '', name_ru: '', name_tr: '',
      description: '', description_az: '', description_en: '', description_ru: '', description_tr: '',
      category: 'general', category_az: '', price: '', original_price: '',
      currency: 'AZN', affiliate_url: '', platform: 'other',
      image_url: '', images: '', video_url: '',
      store_name: '', store_logo_url: '',
      rating: '', review_count: '', review_summary: '', review_summary_az: '', review_summary_en: '', review_summary_ru: '', review_summary_tr: '',
      life_stages: ['bump'], is_featured: false, is_active: true,
      pros: '', cons: '', tags: '', specifications: ''
    });
    setEditingId(null);
    setShowAddForm(false);
    setActiveTab('basic');
  };

  const handleEdit = (product: any) => {
    setFormData({
      name: product.name || '',
      name_az: product.name_az || '',
      name_en: product.name_en || '',
      name_ru: product.name_ru || '',
      name_tr: product.name_tr || '',
      description: product.description || '',
      description_az: product.description_az || '',
      description_en: product.description_en || '',
      description_ru: product.description_ru || '',
      description_tr: product.description_tr || '',
      category: product.category || 'general',
      category_az: product.category_az || '',
      price: product.price?.toString() || '',
      original_price: product.original_price?.toString() || '',
      currency: product.currency || 'AZN',
      affiliate_url: product.affiliate_url || '',
      platform: product.platform || 'other',
      image_url: product.image_url || '',
      images: (product.images || []).join('\n'),
      video_url: product.video_url || '',
      store_name: product.store_name || '',
      store_logo_url: product.store_logo_url || '',
      rating: product.rating?.toString() || '',
      review_count: product.review_count?.toString() || '',
      review_summary: product.review_summary || '',
      review_summary_az: product.review_summary_az || '',
      review_summary_en: product.review_summary_en || '',
      review_summary_ru: product.review_summary_ru || '',
      review_summary_tr: product.review_summary_tr || '',
      life_stages: product.life_stages || ['bump'],
      is_featured: product.is_featured || false,
      is_active: product.is_active !== false,
      pros: (product.pros || []).join('\n'),
      cons: (product.cons || []).join('\n'),
      tags: (product.tags || []).join(', '),
      specifications: product.specifications ? JSON.stringify(product.specifications, null, 2) : ''
    });
    setEditingId(product.id);
    setShowAddForm(true);
  };

  const toggleLifeStage = (stage: string) => {
    setFormData((prev) => ({
      ...prev,
      life_stages: prev.life_stages.includes(stage) ?
      prev.life_stages.filter((s) => s !== stage) :
      [...prev.life_stages, stage]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{tr("adminaffiliateproducts_affiliate_mehsullari_8282c4", "Affiliate Məhsulları")}</h2>
          <p className="text-sm text-muted-foreground">{tr("adminaffiliateproducts_tovsiyye_olunan_mehsullari_tam_idare_edi_5f71b5", "Tövsiyyə olunan məhsulları tam idarə edin")}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm">{tr("adminaffiliateproducts_bolme_aktiv_4321ea", "Bölmə aktiv:")}</span>
            <Switch
              checked={sectionEnabled}
              onCheckedChange={(checked) => updateSetting.mutate({ key: 'affiliate_section_enabled', value: checked })} />
            
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden" />
            
            <Button variant="outline" onClick={downloadCSVTemplate}>
              <Download className="w-4 h-4 me-2" /> {tr("adminaffiliateproducts_csv_sablon_dbbc38", "CSV \u015Eablon")}
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="w-4 h-4 me-2" /> {importing ? tr("adminaffiliateproducts_yuklenir_5557de", "Y\xFCkl\u0259nir...") : 'CSV İmport'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const items = products || [];
                exportToCSV(
                  items,
                  [
                  { key: 'name', header: 'name' },
                  { key: 'name_az', header: 'name_az' },
                  { key: 'affiliate_url', header: 'affiliate_url' },
                  { key: 'category', header: 'category' },
                  { key: 'platform', header: 'platform' },
                  { key: 'price', header: 'price' },
                  { key: 'original_price', header: 'original_price' },
                  { key: 'currency', header: 'currency' },
                  { key: 'image_url', header: 'image_url' },
                  { key: 'images', header: 'images' },
                  { key: 'store_name', header: 'store_name' },
                  { key: 'description_az', header: 'description_az' },
                  { key: 'rating', header: 'rating' },
                  { key: 'review_count', header: 'review_count' },
                  { key: 'life_stages', header: 'life_stages' },
                  { key: 'is_featured', header: 'is_featured' },
                  { key: 'is_active', header: 'is_active' },
                  { key: 'pros', header: 'pros' },
                  { key: 'cons', header: 'cons' },
                  { key: 'tags', header: 'tags' }],

                  'affiliate_products_export.csv'
                );
                toast({ title: `${items.length} məhsul ixrac edildi` });
              }}
              disabled={products.length === 0}>
              
              <FileDown className="w-4 h-4 me-2" /> İxrac
            </Button>
            <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
              <Plus className="w-4 h-4 me-2" /> {tr("adminaffiliateproducts_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </div>
        </div>
      </div>

      {showAddForm &&
      <div className="bg-card border rounded-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{editingId ? tr("adminaffiliateproducts_redakte_et_66cf3b", "Redakt\u0259 et") : tr("adminaffiliateproducts_yeni_mehsul_86f592", "Yeni m\u0259hsul")}</h3>
            <Button variant="ghost" size="icon" onClick={resetForm}><X className="w-4 h-4" /></Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">{tr("adminaffiliateproducts_esas_6d87f7", "Əsas")}</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="details">Detallar</TabsTrigger>
              <TabsTrigger value="reviews">{tr("adminaffiliateproducts_reyler_032ec8", "Rəylər")}</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Ad (EN)" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
                <LocalizedInput formData={formData} setFormData={setFormData} field="name" label="Ad *" />
                <Input placeholder="Affiliate URL *" value={formData.affiliate_url} onChange={(e) => setFormData((p) => ({ ...p, affiliate_url: e.target.value }))} className="col-span-2" />
                
                <select value={formData.platform} onChange={(e) => setFormData((p) => ({ ...p, platform: e.target.value }))} className="h-10 rounded-md border bg-background px-3">
                  <option value="trendyol">Trendyol</option>
                  <option value="amazon">Amazon</option>
                  <option value="aliexpress">AliExpress</option>
                  <option value="other">{tr("adminaffiliateproducts_diger_293b3a", "Digər")}</option>
                </select>
                
                <select value={formData.category} onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))} className="h-10 rounded-md border bg-background px-3">
                  <option value="baby_gear">{tr("adminaffiliateproducts_korpe_esyalari_6e92e1", "Körpə əşyaları")}</option>
                  <option value="maternity">{tr("adminaffiliateproducts_hamilelik_geyimleri_fb1c46", "Hamiləlik geyimləri")}</option>
                  <option value="health">{tr("adminaffiliateproducts_saglamliq_09460a", "Sağlamlıq")}</option>
                  <option value="nutrition">Qidalanma</option>
                  <option value="skincare">{tr("adminaffiliateproducts_deri_qullugu_6c59a3", "Dəri qulluğu")}</option>
                  <option value="general">{tr("adminaffiliateproducts_umumi_1b5521", "Ümumi")}</option>
                </select>

                <Input placeholder={tr("adminaffiliateproducts_magaza_adi_d4e01e", "Mağaza adı")} value={formData.store_name} onChange={(e) => setFormData((p) => ({ ...p, store_name: e.target.value }))} />
                <Input placeholder={tr("adminaffiliateproducts_magaza_logo_url_8308d4", "Mağaza logo URL")} value={formData.store_logo_url} onChange={(e) => setFormData((p) => ({ ...p, store_logo_url: e.target.value }))} />
                
                <Input type="number" placeholder={tr("adminaffiliateproducts_qiymet_54c4f3", "Qiymət")} value={formData.price} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))} />
                <Input type="number" placeholder={tr("adminaffiliateproducts_kohne_qiymet_endirim_7e46fd", "Köhnə qiymət (endirim)")} value={formData.original_price} onChange={(e) => setFormData((p) => ({ ...p, original_price: e.target.value }))} />
                
                <select value={formData.currency} onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))} className="h-10 rounded-md border bg-background px-3">
                  <option value="AZN">AZN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="TRY">TRY</option>
                </select>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm">Life stages:</span>
                  {['flow', 'bump', 'mommy'].map((stage) =>
                <Badge
                  key={stage}
                  variant={formData.life_stages.includes(stage) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleLifeStage(stage)}>
                  
                      {stage}
                    </Badge>
                )}
                </div>
              </div>
              
              <LocalizedTextarea formData={formData} setFormData={setFormData} field="description" label="Təsvir" rows={3} />
            </TabsContent>

            <TabsContent value="media" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr("adminaffiliateproducts_esas_sekil_url_3fdd67", "Əsas şəkil URL")}</label>
                  <Input placeholder="https://..." value={formData.image_url} onChange={(e) => setFormData((p) => ({ ...p, image_url: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr("adminaffiliateproducts_elave_sekiller_her_setirde_bir_url_d60242", "Əlavə şəkillər (hər sətirdə bir URL)")}</label>
                  <Textarea placeholder="https://image1.jpg&#10;https://image2.jpg" value={formData.images} onChange={(e) => setFormData((p) => ({ ...p, images: e.target.value }))} rows={4} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Video URL</label>
                  <Input placeholder="https://video.mp4" value={formData.video_url} onChange={(e) => setFormData((p) => ({ ...p, video_url: e.target.value }))} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr("adminaffiliateproducts_ustunlukleri_her_setirde_bir_54cbce", "Üstünlükləri (hər sətirdə bir)")}</label>
                  <Textarea placeholder={tr("adminaffiliateproducts_keyfiyyetli_material_10_uzunomurlu_215f76", "Keyfiyyətli material&#10;Uzunömürlü")} value={formData.pros} onChange={(e) => setFormData((p) => ({ ...p, pros: e.target.value }))} rows={4} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{tr("adminaffiliateproducts_catismazliqlari_her_setirde_bir_1f2f46", "Çatışmazlıqları (hər sətirdə bir)")}</label>
                  <Textarea placeholder={tr("adminaffiliateproducts_bahalidir_10_catdirilma_uzun_cekir_66741d", "Bahalıdır&#10;Çatdırılma uzun çəkir")} value={formData.cons} onChange={(e) => setFormData((p) => ({ ...p, cons: e.target.value }))} rows={4} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{tr("adminaffiliateproducts_teqler_vergulle_ayirin_cbcd30", "Teqlər (vergüllə ayırın)")}</label>
                <Input placeholder={tr("adminaffiliateproducts_hamilelik_korpe_yeni_edb521", "hamiləlik, körpə, yeni")} value={formData.tags} onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{tr("adminaffiliateproducts_xususiyyetler_json_ve_ya_key_value_f5355a", "Xüsusiyyətlər (JSON və ya key:value)")}</label>
                <Textarea placeholder={tr("adminaffiliateproducts_ceki_500g_reng_ag_25adaf", "{\"\xC7\u0259ki\": \"500g\", \"R\u0259ng\": \"A\u011F\"}")} value={formData.specifications} onChange={(e) => setFormData((p) => ({ ...p, specifications: e.target.value }))} rows={4} />
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" placeholder="Reytinq (0-5)" value={formData.rating} onChange={(e) => setFormData((p) => ({ ...p, rating: e.target.value }))} step="0.1" max="5" min="0" />
                <Input type="number" placeholder={tr("adminaffiliateproducts_rey_sayi_8a7896", "Rəy sayı")} value={formData.review_count} onChange={(e) => setFormData((p) => ({ ...p, review_count: e.target.value }))} />
              </div>
              <LocalizedTextarea formData={formData} setFormData={setFormData} field="review_summary" label="Rəy xülasəsi" rows={3} />
            </TabsContent>
          </Tabs>
          
          <div className="flex gap-4 pt-4 border-t">
            <label className="flex items-center gap-2">
              <Switch checked={formData.is_featured} onCheckedChange={(c) => setFormData((p) => ({ ...p, is_featured: c }))} /> 
              <Star className="w-4 h-4 text-amber-500" />
              {tr("adminaffiliateproducts_tovsiyye_olunan_c3bafa", "T\xF6vsiyy\u0259 olunan")}
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData((p) => ({ ...p, is_active: c }))} /> 
              Aktiv
            </label>
          </div>
          
          <Button
          onClick={() => saveMutation.mutate({ ...formData, id: editingId || undefined })}
          disabled={!formData.name_az || !formData.affiliate_url || saveMutation.isPending}
          className="w-full">
          
            <Save className="w-4 h-4 me-2" /> {saveMutation.isPending ? tr("adminaffiliateproducts_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : 'Yadda saxla'}
          </Button>
        </div>
      }

      <div className="space-y-2">
        {isLoading ?
        <p className="text-muted-foreground">{tr("adminaffiliateproducts_yuklenir_5557de", "Yüklənir...")}</p> :
        products.length === 0 ?
        <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{tr("adminaffiliateproducts_hele_hec_bir_mehsul_yoxdur_1c6e41", "Hələ heç bir məhsul yoxdur")}</p>
          </div> :

        products.map((product: any) =>
        <div key={product.id} className="flex items-center justify-between p-3 bg-card border rounded-lg hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                {product.image_url ?
            <img src={product.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" /> :

            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
            }
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{localize(product, 'name')}</span>
                    {product.is_featured && <Badge className="text-[10px] bg-amber-500/10 text-amber-600">⭐</Badge>}
                    {!product.is_active && <Badge variant="secondary" className="text-[10px]">Deaktiv</Badge>}
                    {(product.images?.length > 0 || product.video_url) &&
                <div className="flex gap-1">
                        {product.images?.length > 0 && <Image className="w-3 h-3 text-muted-foreground" />}
                        {product.video_url && <Video className="w-3 h-3 text-muted-foreground" />}
                      </div>
                }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {product.store_name || product.platform} • {product.price ? `${product.price} ${product.currency}` : tr("adminaffiliateproducts_qiymet_yoxdur_11556d", "Qiym\u0259t yoxdur")}
                    {product.original_price && product.original_price > product.price &&
                <span className="text-red-500 ms-2">(-{Math.round((1 - product.price / product.original_price) * 100)}%)</span>
                }
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => window.open(product.affiliate_url, '_blank')}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleEdit(product)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(product.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
        )
        }
      </div>
    </div>);

};

export default AdminAffiliateProducts;