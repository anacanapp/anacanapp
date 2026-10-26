import { useState, useRef, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit, Trash2, Eye, EyeOff, Star, Search,
  ChevronDown, Save, X, Image as ImageIcon, Tag, Clock, BarChart3, Sparkles, Loader2,
  Upload, Link } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useBlogAdmin, BlogPost, BlogCategory, BlogLifeStage } from '@/hooks/useBlog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import BlogAnalytics from './BlogAnalytics';
import { supabase } from '@/integrations/supabase/client';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import AdminUsageStats from './AdminUsageStats';
import { LocalizedInput } from './ui/LocalizedInput';
import { LocalizedTextarea } from './ui/LocalizedTextarea';
import { useAdminLocalize } from '@/contexts/AdminLanguageContext';
import BlogSeoFields from './BlogSeoFields';

const AdminBlog = () => {
  const { posts, categories, postCategories, loading, createPost, updatePost, deletePost, createCategory, deleteCategory, getPostCategoryIds, setPostCategoriesForPost } = useBlogAdmin();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'posts' | 'categories' | 'analytics'>('posts');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('upload');
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const localize = useAdminLocalize();

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    title_az: '', title_en: '', title_ru: '', title_tr: '',
    excerpt_az: '', excerpt_en: '', excerpt_ru: '', excerpt_tr: '',
    content_az: '', content_en: '', content_ru: '', content_tr: '',
    cover_image_url: '',
    category: tr("adminblog_hamilelik_64e7fe", "hamil\u0259lik"),
    tags: [] as string[],
    author_name: 'Anacan',
    reading_time: 5,
    is_featured: false,
    is_published: false,
    life_stage: 'all' as BlogLifeStage,
    countries_include: [] as string[],
    countries_exclude: [] as string[],
    editorial_metadata: null as unknown
  });

  const lifeStageOptions: {value: BlogLifeStage;label: string;emoji: string;}[] = [
  { value: 'all', label: tr("adminblog_hamisi_ucun_2e4cd9", "Hamısı üçün"), emoji: '🌐' },
  { value: 'flow', label: tr("adminblog_menstruasiya_dovru_a5852d", "Menstruasiya dövrü"), emoji: '🩸' },
  { value: 'bump', label: tr("adminblog_hamilelik_dovru_57af7a", "Hamiləlik dövrü"), emoji: '🤰' },
  { value: 'mommy', label: tr("adminblog_ana_korpe_baximi_6b209a", "Ana (körpə baxımı)"), emoji: '👶' }];


  const [newCategory, setNewCategory] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '📝',
    color: '#f28155'
  });

  const [newTag, setNewTag] = useState('');

  const generateAIContent = async () => {
    const effectiveTitle = (formData.title || formData.title_az || '').trim();
    if (!effectiveTitle) {
      toast({
        title: tr("adminblog_basliq_teleb_olunur_097c6f", "Başlıq tələb olunur"),
        description: tr("adminblog_mezmun_yaratmaq_ucun_evvelce_basliq_daxi_74a245", "Məzmun yaratmaq üçün əvvəlcə başlıq daxil edin"),
        variant: 'destructive'
      });
      return;
    }

    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-blog-content', {
        body: {
          title: effectiveTitle,
          category: formData.category
        }
      });

      if (error) throw error;

      if (data) {
        setFormData((prev) => ({
          ...prev,
          content: data.content || prev.content,
          excerpt: data.excerpt || prev.excerpt,
          tags: data.tags || prev.tags,
          reading_time: data.reading_time || prev.reading_time
        }));

        toast({
          title: tr("adminblog_mezmun_yaradildi_23a0d1", "Məzmun yaradıldı!"),
          description: tr("adminblog_ai_terefinden_meqale_metni_haz_303146", "AI t\u0259r\u0259find\u0259n m\u0259qal\u0259 m\u0259tni haz\u0131rland\u0131")
        });
      }
    } catch (error) {
      console.error('AI content generation error:', error);
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: tr("adminblog_mezmun_yaradila_bilmedi_yeniden_cehd_edi_0c4bf4", "Məzmun yaradıla bilmədi. Yenidən cəhd edin."),
        variant: 'destructive'
      });
    } finally {
      setGeneratingContent(false);
    }
  };

  const generateSlug = (title: string) => {
    return title.
    toLowerCase().
    replace(/ş/g, 's').replace(/ə/g, 'e').replace(/ı/g, 'i').
    replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u').
    replace(/ç/g, 'c').replace(/İ/gi, 'i').
    replace(/[^a-z0-9\s-]/g, '').
    replace(/\s+/g, '-').
    replace(/-+/g, '-').
    trim();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: tr("adminblog_yalniz_sekil_fayllari_yuklene_biler_f67b23", "Yalnız şəkil faylları yüklənə bilər"),
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: tr("adminblog_sekil_5mb_dan_boyuk_olmamalidir_ebe774", "Şəkil 5MB-dan böyük olmamalıdır"),
        variant: 'destructive'
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `blog-${Date.now()}.${fileExt}`;
      const filePath = `blog-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage.
      from('assets').
      upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.
      from('assets').
      getPublicUrl(filePath);

      setFormData({ ...formData, cover_image_url: publicUrl });
      toast({
        title: tr("adminblog_ugurlu_5c0191", "Uğurlu!"),
        description: tr("adminblog_sekil_yuklendi_474bd5", "\u015E\u0259kil y\xFCkl\u0259ndi")
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: tr("adminblog_sekil_yuklene_bilmedi_3c275f", "Şəkil yüklənə bilmədi"),
        variant: 'destructive'
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title)
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag)
    });
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    const postCatIds = getPostCategoryIds(post.id);
    setSelectedCategoryIds(postCatIds);
    const newFormData = {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content,
      title_az: post.title_az || '', title_en: post.title_en || '', title_ru: post.title_ru || '', title_tr: post.title_tr || '',
      excerpt_az: post.excerpt_az || '', excerpt_en: post.excerpt_en || '', excerpt_ru: post.excerpt_ru || '', excerpt_tr: post.excerpt_tr || '',
      content_az: post.content_az || '', content_en: post.content_en || '', content_ru: post.content_ru || '', content_tr: post.content_tr || '',
      cover_image_url: post.cover_image_url || '',
      category: post.category,
      tags: post.tags || [],
      author_name: post.author_name,
      reading_time: post.reading_time,
      is_featured: post.is_featured,
      is_published: post.is_published,
      life_stage: (post.life_stage || 'all') as BlogLifeStage,
      countries_include: ((post as any).countries_include || []) as string[],
      countries_exclude: ((post as any).countries_exclude || []) as string[],
      editorial_metadata: post.editorial_metadata || null
    };
    setFormData(newFormData);
    initialFormDataRef.current = JSON.stringify({ ...newFormData, categoryIds: postCatIds });
    setShowEditor(true);
  };

  const hasUnsavedChanges = () => {
    if (!showEditor) return false;
    return JSON.stringify({ ...formData, categoryIds: selectedCategoryIds }) !== initialFormDataRef.current;
  };

  const handleModalClose = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      resetForm();
    }
  };

  const handleSave = async () => {
    // NOT: Redaktordakı yeganə Başlıq sahəsi <LocalizedInput field="title">
    // komponentidir — `title_az` açarı formData-da mövcud olduğu üçün (admin
    // dili 'az' olanda, defolt) o HƏMİŞƏ `title_az`-a yazır, heç vaxt bare
    // `title`-a yox (bax LocalizedInput.tsx-in `isAzProp` məntiqi — bu,
    // kodbazadakı bütün digər tərcümə edilə bilən ekranlarla eyni, qəsdən
    // seçilmiş davranışdır). Nəticədə `formData.title` yeni yazı üçün HƏMİŞƏ
    // boş qalırdı və bu yoxlama HƏR DƏFƏ, nə yazılırsa yazılsın, yaradılmanı
    // bloklayırdı. `title_az`-a da baxaraq düzəldilir.
    const effectiveTitle = (formData.title || formData.title_az || '').trim();
    if (!effectiveTitle || !formData.content.trim()) {
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: tr("adminblog_basliq_ve_mezmun_teleb_olunur_02f6f5", "Başlıq və məzmun tələb olunur"),
        variant: 'destructive'
      });
      return;
    }

    const postData = {
      ...formData,
      title: effectiveTitle,
      slug: formData.slug || generateSlug(effectiveTitle)
    };

    let result;
    if (editingPost) {
      result = await updatePost(editingPost.id, postData, selectedCategoryIds);
    } else {
      result = await createPost(postData, selectedCategoryIds);
    }

    if (result.error) {
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: tr("adminblog_meqale_saxlanila_bilmedi_a6aa8c", "Məqalə saxlanıla bilmədi"),
        variant: 'destructive'
      });
    } else {
      toast({
        title: tr("adminblog_ugurlu_5c0191", "Uğurlu!"),
        description: editingPost ? tr("adminblog_meqale_yenilendi_4bb3b7", "M\u0259qal\u0259 yenil\u0259ndi") : tr("adminblog_meqale_yaradildi_7c3baf", "M\u0259qal\u0259 yarad\u0131ld\u0131")
      });
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(tr("adminblog_bu_meqaleni_silmek_istediyiniz_170b63", "Bu m\u0259qal\u0259ni silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) {
      const result = await deletePost(id);
      if (!result.error) {
        toast({
          title: 'Silindi',
          description: tr("adminblog_meqale_ugurla_silindi_cb637f", "M\u0259qal\u0259 u\u011Furla silindi")
        });
      }
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    await updatePost(post.id, { is_published: !post.is_published });
    toast({
      title: post.is_published ? tr("adminblog_gizledildi_d0f317", "Gizl\u0259dildi") : tr("adminblog_derc_edildi_660255", "D\u0259rc edildi"),
      description: `Məqalə ${post.is_published ? tr("adminblog_gizledildi_2b23fb", "gizl\u0259dildi") : tr("adminblog_derc_edildi_f9c4a5", "d\u0259rc edildi")}`
    });
  };

  const handleToggleFeatured = async (post: BlogPost) => {
    await updatePost(post.id, { is_featured: !post.is_featured });
  };

  const handleSaveCategory = async () => {
    if (!newCategory.name.trim()) {
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: tr("adminblog_kateqoriya_adi_teleb_olunur_5a978b", "Kateqoriya adı tələb olunur"),
        variant: 'destructive'
      });
      return;
    }

    const result = await createCategory({
      ...newCategory,
      slug: newCategory.slug || generateSlug(newCategory.name),
      sort_order: categories.length,
      is_active: true
    });

    if (!result.error) {
      toast({
        title: tr("adminblog_ugurlu_5c0191", "Uğurlu!"),
        description: tr("adminblog_kateqoriya_yaradildi_9695a4", "Kateqoriya yarad\u0131ld\u0131")
      });
      setNewCategory({ name: '', slug: '', description: '', icon: '📝', color: '#f28155' });
      setShowCategoryModal(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    // Check if category is used
    const usageCount = postCategories.filter((pc) => pc.category_id === id).length;
    if (usageCount > 0) {
      toast({
        title: tr("adminblog_xeta_3cdbb6", "Xəta"),
        description: `Bu kateqoriya ${usageCount} məqalədə istifadə olunur. Əvvəlcə məqalələrdən çıxarın.`,
        variant: 'destructive'
      });
      return;
    }

    if (confirm(tr("adminblog_bu_kateqoriyani_silmek_istediy_fdffac", "Bu kateqoriyan\u0131 silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) {
      const result = await deleteCategory(id);
      if (result.error) {
        toast({
          title: tr("adminblog_xeta_3cdbb6", "Xəta"),
          description: result.error instanceof Error ? result.error.message : tr("adminblog_kateqoriya_siline_bilmedi_b1d596", "Kateqoriya silin\u0259 bilm\u0259di"),
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Silindi',
          description: 'Kateqoriya silindi'
        });
      }
    }
  };

  const resetForm = () => {
    const emptyForm = {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      title_az: '', title_en: '', title_ru: '', title_tr: '',
      excerpt_az: '', excerpt_en: '', excerpt_ru: '', excerpt_tr: '',
      content_az: '', content_en: '', content_ru: '', content_tr: '',
      cover_image_url: '',
      category: tr("adminblog_hamilelik_64e7fe", "hamil\u0259lik"),
      tags: [],
      author_name: 'Anacan',
      reading_time: 5,
      is_featured: false,
      is_published: false,
      life_stage: 'all' as BlogLifeStage,
      countries_include: [] as string[],
      countries_exclude: [] as string[],
      editorial_metadata: null as unknown
    };
    setFormData(emptyForm);
    setSelectedCategoryIds([]);
    initialFormDataRef.current = JSON.stringify({ ...emptyForm, categoryIds: [] });
    setEditingPost(null);
    setShowEditor(false);
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
    prev.includes(categoryId) ?
    prev.filter((id) => id !== categoryId) :
    [...prev, categoryId]
    );
  };

  useEffect(() => {
    if (showEditor && !editingPost) {
      initialFormDataRef.current = JSON.stringify(formData);
    }
  }, [showEditor]);

  const filteredPosts = posts.filter((p) =>
  localize(p, 'title').toLowerCase().includes(searchQuery.toLowerCase()) ||
  p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminblog_bloq_idaresi_c3982a", "Bloq İdarəsi")}</h1>
          <p className="text-muted-foreground">{tr("adminblog_meqaleler_ve_kateqoriyalari_idare_edin_b8bb21", "Məqalələr və kateqoriyaları idarə edin")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
            <Tag className="w-4 h-4 me-2" />
            Kateqoriya
          </Button>
          <Button onClick={() => setShowEditor(true)} className="bg-primary">
            <Plus className="w-4 h-4 me-2" />
            {tr("adminblog_yeni_meqale_ee5489", "Yeni M\u0259qal\u0259")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
          activeTab === 'posts' ?
          'text-primary border-b-2 border-primary' :
          'text-muted-foreground'}`
          }>
          {tr("adminblog_meqaleler_35de58", "M\u0259qal\u0259l\u0259r (")}
          {posts.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
          activeTab === 'categories' ?
          'text-primary border-b-2 border-primary' :
          'text-muted-foreground'}`
          }>
          
          Kateqoriyalar ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
          activeTab === 'analytics' ?
          'text-primary border-b-2 border-primary' :
          'text-muted-foreground'}`
          }>
          
          <BarChart3 className="w-4 h-4" />
          Statistika
        </button>
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' &&
      <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr("adminblog_meqale_axtar_0441c1", "Məqalə axtar...")}
            className="ps-10" />
          
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((post) =>
          <motion.div
            key={post.id}
            layout
            className="bg-card rounded-xl border border-border overflow-hidden">
            
                {post.cover_image_url ?
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-40 object-cover" /> :


            <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  </div>
            }

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={post.is_published ? 'default' : 'secondary'}>
                        {post.is_published ? tr("adminblog_derc_edilib_88064f", "D\u0259rc edilib") : 'Qaralama'}
                      </Badge>
                      {/* Life Stage Badge */}
                      {post.life_stage && post.life_stage !== 'all' &&
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  post.life_stage === 'bump' ? 'bg-pink-100 text-pink-700' :
                  post.life_stage === 'mommy' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'}`
                  }>
                          {lifeStageOptions.find((o) => o.value === post.life_stage)?.emoji}
                        </span>
                  }
                    </div>
                    {post.is_featured &&
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                }
                  </div>

                  <h3 className="font-bold text-foreground line-clamp-2 mb-2">{localize(post, 'title')}</h3>
                  
                  {/* Categories badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {getPostCategoryIds(post.id).map((catId) => {
                  const cat = categories.find((c) => c.id === catId);
                  return cat ?
                  <span
                    key={catId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                    
                          {cat.icon} {cat.name}
                        </span> :
                  null;
                })}
                    {getPostCategoryIds(post.id).length === 0 &&
                <span className="text-xs text-muted-foreground italic">Kateqoriya yoxdur</span>
                }
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span>{post.reading_time} {tr("adminblog_deq_780a5c", "d\u0259q")}</span>
                    <span>•</span>
                    <span>{post.view_count} {tr("adminblog_baxis_d4da3e", "bax\u0131\u015F")}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(post)}>
                      <Edit className="w-3 h-3 me-1" />
                      {tr("adminblog_redakte_d53ba7", "Redakt\u0259")}
                    </Button>
                    <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleTogglePublish(post)}>
                  
                      {post.is_published ?
                  <EyeOff className="w-3 h-3" /> :

                  <Eye className="w-3 h-3" />
                  }
                    </Button>
                    <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleFeatured(post)}>
                  
                      <Star className={`w-3 h-3 ${post.is_featured ? 'text-amber-500 fill-amber-500' : ''}`} />
                    </Button>
                    <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleDelete(post.id)}>
                  
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
          )}
          </div>

          {filteredPosts.length === 0 &&
        <div className="text-center py-12">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-muted-foreground">{tr("adminblog_hele_meqale_yoxdur_b92aa5", "Hələ məqalə yoxdur")}</p>
            </div>
        }
        </>
      }

      {/* Categories Tab */}
      {activeTab === 'categories' &&
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) =>
        <motion.div
          key={category.id}
          className="bg-card rounded-xl border border-border p-4">
          
              <div className="flex items-center gap-3 mb-2">
                <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: `${category.color}20` }}>
              
                  {category.icon}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{category.name}</h3>
                  <p className="text-xs text-muted-foreground">{category.slug}</p>
                </div>
              </div>
              {category.description &&
          <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
          }
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {postCategories.filter((pc) => pc.category_id === category.id).length} {tr("adminblog_meqale_63f1b2", "m\u0259qal\u0259")}
                </span>
                <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => handleDeleteCategory(category.id)}>
              
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
        )}
        </div>
      }

      {/* Analytics Tab */}
      {activeTab === 'analytics' &&
      <BlogAnalytics posts={posts} />
      }

      {/* Post Editor Modal */}
      <AnimatePresence>
        {showEditor &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={handleModalClose}>
          
            <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                <h2 className="text-xl font-bold">
                  {editingPost ? tr("adminblog_meqaleni_redakte_et_e1119a", "M\u0259qal\u0259ni Redakt\u0259 Et") : tr("adminblog_yeni_meqale_ee5489", "Yeni M\u0259qal\u0259")}
                </h2>
                <Button variant="ghost" size="icon" onClick={handleModalClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 space-y-6">
                {/* Title */}
                <LocalizedInput
                  formData={formData}
                  setFormData={setFormData}
                  field="title"
                  label={tr("adminblog_basliq_3dfed8", "Başlıq *")}
                />

                {/* Slug */}
                <div>
                  <label className="text-sm font-medium mb-2 block">URL Slug</label>
                  <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="meqale-url-slug" />
                
                </div>

                {/* Cover Image */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">{tr("adminblog_ortuk_sekli_8db3d9", "Örtük Şəkli")}</label>
                    <div className="flex gap-1 bg-muted rounded-lg p-1">
                      <button
                      type="button"
                      onClick={() => setImageInputMode('upload')}
                      className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${
                      imageInputMode === 'upload' ?
                      'bg-background text-foreground shadow-sm' :
                      'text-muted-foreground hover:text-foreground'}`
                      }>
                      
                        <Upload className="w-3 h-3" />
                        {tr("adminblog_yukle_2b8e67", "Y\xFCkl\u0259")}
                      </button>
                      <button
                      type="button"
                      onClick={() => setImageInputMode('url')}
                      className={`px-3 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${
                      imageInputMode === 'url' ?
                      'bg-background text-foreground shadow-sm' :
                      'text-muted-foreground hover:text-foreground'}`
                      }>
                      
                        <Link className="w-3 h-3" />
                        URL
                      </button>
                    </div>
                  </div>

                  {imageInputMode === 'upload' ?
                <div className="space-y-3">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                        <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage} />
                    
                        {uploadingImage ?
                    <div className="flex flex-col items-center">
                            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-2" />
                            <span className="text-sm text-muted-foreground">{tr("adminblog_yuklenir_5557de", "Yüklənir...")}</span>
                          </div> :

                    <div className="flex flex-col items-center">
                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">{tr("adminblog_sekil_secin_ve_ya_surukleyin_f64ddf", "Şəkil seçin və ya sürükləyin")}</span>
                            <span className="text-xs text-muted-foreground mt-1">PNG, JPG (max 5MB)</span>
                          </div>
                    }
                      </label>
                    </div> :

                <Input
                  value={formData.cover_image_url}
                  onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg" />

                }

                  {formData.cover_image_url &&
                <div className="relative mt-3">
                      <img
                    src={formData.cover_image_url}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg" />
                  
                      <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 end-2 w-8 h-8"
                    onClick={() => setFormData({ ...formData, cover_image_url: '' })}>
                    
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                }
                </div>

                {/* Categories (Multi-select) */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Kateqoriyalar</label>
                  <div className="flex flex-wrap gap-2 p-3 border border-input rounded-lg bg-muted/30 min-h-[60px]">
                    {categories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategorySelection(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        isSelected ?
                        'bg-primary text-primary-foreground' :
                        'bg-card border border-border text-muted-foreground hover:bg-muted'}`
                        }>
                        
                          <span>{cat.icon}</span>
                          <span>{cat.name}</span>
                          {isSelected && <X className="w-3 h-3 ms-1" />}
                        </button>);

                  })}
                  </div>
                  {selectedCategoryIds.length === 0 &&
                <p className="text-xs text-muted-foreground mt-1">{tr("adminblog_en_azi_bir_kateqoriya_secin_fb6100", "Ən azı bir kateqoriya seçin")}</p>
                }
                </div>

                {/* Reading Time */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminblog_oxuma_muddeti_deq_d2ba9d", "Oxuma müddəti (dəq)")}</label>
                  <Input
                  type="number"
                  value={formData.reading_time}
                  onChange={(e) => setFormData({ ...formData, reading_time: parseInt(e.target.value) || 5 })}
                  min={1}
                  className="max-w-[150px]" />
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">{tr("adminblog_mezmun_a0f970", "Məzmun *")}</label>
                    <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateAIContent}
                    disabled={generatingContent || !(formData.title || formData.title_az).trim()}
                    className="gap-2">
                    
                      {generatingContent ?
                    <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {tr("adminblog_yaradilir_9bb5ed", "Yarad\u0131l\u0131r...")}
                        </> :

                    <>
                          <Sparkles className="w-4 h-4" />
                          {tr("adminblog_ai_ile_yarat_c268d6", "AI il\u0259 yarat")}
                        </>
                    }
                    </Button>
                  </div>
                  <RichTextEditor
                  content={formData.content}
                  onChange={(html) => setFormData({ ...formData, content: html })}
                  placeholder={tr("adminblog_meqalenin_tam_mezmunu_ve_ya_ai_ile_yarad_c3e94e", "Məqalənin tam məzmunu... (və ya AI ilə yaradın)")}
                  disabled={generatingContent} />
                
                  {generatingContent &&
                <p className="text-xs text-muted-foreground mt-2">
                      {tr("adminblog_ai_mezmun_yaradir_bir_nece_san_a95b26", "AI m\u0259zmun yarad\u0131r, bir ne\xE7\u0259 saniy\u0259 g\xF6zl\u0259yin...")}
                    </p>
                }
                </div>

                {/* Tags */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminblog_etiketler_62df02", "Etiketlər")}</label>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {formData.tags.map((tag) =>
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                        {tag} <X className="w-3 h-3 ms-1" />
                      </Badge>
                  )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Yeni etiket"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} />
                  
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      {tr("adminblog_elave_et_6e1b9b", "\u018Flav\u0259 et")}
                    </Button>
                  </div>
                </div>

                {/* Author */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminblog_muellif_adi_7c7b8c", "Müəllif adı")}</label>
                  <Input
                  value={formData.author_name}
                  onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                  placeholder="Anacan" />
                
                </div>

                {/* Life Stage Selector */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminblog_hedef_merhelesi_8d7484", "Hədəf Mərhələsi")}</label>
                  <div className="flex flex-wrap gap-2">
                    {lifeStageOptions.map((option) =>
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, life_stage: option.value })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    formData.life_stage === option.value ?
                    'bg-primary text-primary-foreground border-primary' :
                    'bg-card border-border text-muted-foreground hover:bg-muted'}`
                    }>
                    
                        <span>{option.emoji}</span>
                        <span>{option.label}</span>
                      </button>
                  )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {tr("adminblog_bu_meqale_hansi_istifadeci_qru_bd9c91", "Bu m\u0259qal\u0259 hans\u0131 istifad\u0259\xE7i qrupuna aiddir? Dashboard-da h\u0259min qrupa uy\u011Fun g\xF6st\u0259ril\u0259c\u0259k.")}
                  </p>
                </div>

                {/* Ölkə hədəfləməsi (include/exclude) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      🌍 {tr("adminblog_olke_include", "Yalnız bu ölkələrə göstər (include)")}
                    </label>
                    <Input
                      value={formData.countries_include.join(', ')}
                      onChange={(e) => setFormData({
                        ...formData,
                        countries_include: e.target.value.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
                      })}
                      placeholder="AZ, TR" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {tr("adminblog_olke_include_hint", "ISO kodlar, vergüllə (məs. AZ). Boş = bütün ölkələr.")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      🚫 {tr("adminblog_olke_exclude", "Bu ölkələrdə gizlət (exclude)")}
                    </label>
                    <Input
                      value={formData.countries_exclude.join(', ')}
                      onChange={(e) => setFormData({
                        ...formData,
                        countries_exclude: e.target.value.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
                      })}
                      placeholder="RU" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {tr("adminblog_olke_exclude_hint", "Bu ölkə seçən istifadəçilərə görünməyəcək.")}
                    </p>
                  </div>
                </div>

                <BlogSeoFields value={formData.editorial_metadata} onChange={editorial_metadata => setFormData({ ...formData, editorial_metadata })} />

                {/* Toggles */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })} />
                  
                    <span className="text-sm">{tr("adminblog_one_cixan_8d97eb", "Önə çıxan")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })} />
                  
                    <span className="text-sm">{tr("adminblog_derc_et_e745f0", "Dərc et")}</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card">
                <Button variant="outline" onClick={handleModalClose}>
                  {tr("adminblog_legv_et_b5e49c", "L\u0259\u011Fv et")}
                </Button>
                <Button onClick={handleSave} className="bg-primary">
                  <Save className="w-4 h-4 me-2" />
                  {editingPost ? tr("adminblog_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCategoryModal(false)}>
          
            <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold">Yeni Kateqoriya</h2>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Ad *</label>
                  <Input
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value, slug: generateSlug(e.target.value) })}
                  placeholder={tr("adminblog_kateqoriya_adi_d93080", "Kateqoriya adı")} />
                
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminblog_emoji_ikon_8590a0", "Emoji İkon")}</label>
                  <Input
                  value={newCategory.icon}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  placeholder="📝" />
                
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminblog_reng_8c6bc5", "Rəng")}</label>
                  <div className="flex gap-2">
                    <Input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="w-12 h-10 p-1" />
                  
                    <Input
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    placeholder="#f28155" />
                  
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminblog_tesvir_f85651", "Təsvir")}</label>
                  <Textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder={tr("adminblog_kateqoriya_haqqinda_qisa_melumat_6098a9", "Kateqoriya haqqında qısa məlumat")}
                  rows={2} />
                
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCategoryModal(false)}>
                  {tr("adminblog_legv_et_b5e49c", "L\u0259\u011Fv et")}
                </Button>
                <Button onClick={handleSaveCategory} className="bg-primary">
                  Yarat
                </Button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={resetForm} />
      

      <AdminUsageStats
        eventNames={['blog_read', 'blog_liked', 'blog_saved']}
        title={tr("adminblog_bloq_istifade_statistikasi_53968f", "📝 Bloq İstifadə Statistikası")}
        showEventData
        showUsers />
      
    </div>);

};

export default AdminBlog;
