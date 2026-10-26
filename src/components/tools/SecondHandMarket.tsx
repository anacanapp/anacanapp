import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Search, MessageCircle, MapPin,
  X, Check, Loader2, Package, Tag, Clock, Send,
  Sparkles, ImagePlus, Image as ImageIcon } from
'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr } from "@/lib/tr";
interface SecondHandMarketProps {
  onBack: () => void;
}

interface Listing {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  is_free: boolean;
  age_range: string;
  images: string[];
  location_city: string;
  status: string;
  created_at: string;
}

// Categories → anacan palette
const categories = [
{ id: 'clothing', label: 'Geyim', emoji: '👕', grad: 'var(--a-grad-pink)', ink: 'var(--a-alert-ink)' },
{ id: 'toys', label: 'Oyuncaqlar', emoji: '🧸', grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' },
{ id: 'furniture', label: tr("secondhandmarket_mebel_3c7a2d", "Mebel"), emoji: '🛏️', grad: 'var(--a-grad-peach)', ink: 'var(--a-accent-ink)' },
{ id: 'stroller', label: tr("secondhandmarket_araba_3c7a2d", "Araba"), emoji: '👶', grad: 'var(--a-grad-lav)', ink: 'var(--a-lav-ink)' },
{ id: 'feeding', label: tr("secondhandmarket_qidalanma_3c7a2d", "Qidalanma"), emoji: '🍼', grad: 'var(--a-grad-green)', ink: 'var(--a-green-ink)' },
{ id: 'hygiene', label: tr("secondhandmarket_gigiyena_3c7a2d", "Gigiyena"), emoji: '🛁', grad: 'var(--a-grad-blue)', ink: 'var(--a-blue-ink)' },
{ id: 'other', label: tr("secondhandmarket_diger_293b3a", 'Digər'), emoji: '📦', grad: 'linear-gradient(135deg, var(--a-surface-soft), var(--a-line-strong))', ink: 'var(--a-ink-soft)' }];


// Conditions → anacan palette
const conditions = [
{ id: 'new', label: tr("secondhandmarket_yeni", 'Yeni'), dot: 'var(--a-green-2)', ink: 'var(--a-green-ink)', soft: 'var(--a-green-1)' },
{ id: 'like_new', label: tr("secondhandmarket_yeni_kimi", 'Yeni kimi'), dot: '#8fd19e', ink: 'var(--a-green-ink)', soft: 'var(--a-green-1)' },
{ id: 'good', label: tr("secondhandmarket_yaxsi_9d8595", 'Yaxşı'), dot: 'var(--a-blue-2)', ink: 'var(--a-blue-ink)', soft: 'var(--a-blue-1)' },
{ id: 'fair', label: tr("common_normal", "Normal"), dot: 'var(--a-yellow-2)', ink: 'var(--a-warn-ink)', soft: 'var(--a-yellow-1)' }];


const ageRanges = [
tr("secondhandmarket_0_3_ay_3c7a2d", "0-3 ay"), tr("secondhandmarket_3_6_ay_3c7a2d", "3-6 ay"), tr("secondhandmarket_6_12_ay_3c7a2d", "6-12 ay"), tr("secondhandmarket_1_2_yas_aa6324", "1-2 ya\u015F"), tr("secondhandmarket_2_3_yas_d49317", "2-3 ya\u015F"), tr("secondhandmarket_3_yas_dec51d", "3+ ya\u015F")];


const SecondHandMarket = ({ onBack }: SecondHandMarketProps) => {
  useScrollToTop();
  useScreenAnalytics('SecondHandMarket', 'Tools');

  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showMyListings, setShowMyListings] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactListing, setContactListing] = useState<Listing | null>(null);
  const [contactMessage, setContactMessage] = useState('');
  const [contactMessages, setContactMessages] = useState<any[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Image upload state
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'clothing',
    condition: 'good',
    price: 0,
    is_free: true,
    age_range: '',
    location_city: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { profile, user } = useAuth();

  useEffect(() => {
    loadListings();
  }, [selectedCategory, showMyListings]);

  const loadListings = async () => {
    setIsLoading(true);
    try {
      let query = supabase.
      from('marketplace_listings').
      select('*').
      eq('status', 'active').
      order('created_at', { ascending: false });

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      if (showMyListings && profile?.user_id) {
        query = query.eq('user_id', profile.user_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      toast({
        title: tr("secondhandmarket_xeta_3cdbb6", 'Xəta'),
        description: tr("secondhandmarket_elanlar_yuklene_bilmedi_3af806", 'Elanlar yüklənə bilmədi'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploadingImages(true);
    const newImages: string[] = [];

    try {
      for (let i = 0; i < Math.min(files.length, 5 - uploadedImages.length); i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.
        from('community-media').
        upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.
        from('community-media').
        getPublicUrl(fileName);

        newImages.push(publicUrl);
      }

      setUploadedImages((prev) => [...prev, ...newImages]);
      toast({ title: tr("secondhandmarket_sekiller_yuklendi_5f1633", 'Şəkillər yükləndi!') });
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: tr("secondhandmarket_xeta_3cdbb6", 'Xəta'),
        description: tr("secondhandmarket_sekil_yuklene_bilmedi_3c275f", 'Şəkil yüklənə bilmədi'),
        variant: 'destructive'
      });
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateListing = async () => {
    if (!profile?.user_id) {
      toast({
        title: tr("secondhandmarket_xeta_3cdbb6", 'Xəta'),
        description: tr("secondhandmarket_elan_yaratmaq_ucun_daxil_olun_264bf1", 'Elan yaratmaq üçün daxil olun'),
        variant: 'destructive'
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: tr("secondhandmarket_xeta_3cdbb6", 'Xəta'),
        description: tr("secondhandmarket_basliq_daxil_edin_edf2fd", 'Başlıq daxil edin'),
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.
      from('marketplace_listings').
      insert({
        user_id: profile.user_id,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        condition: formData.condition,
        price: formData.is_free ? 0 : formData.price,
        is_free: formData.is_free,
        age_range: formData.age_range,
        location_city: formData.location_city,
        images: uploadedImages,
        status: 'pending'
      });

      if (error) throw error;

      toast({
        title: tr("secondhandmarket_ugurlu_5c0191", 'Uğurlu!'),
        description: tr("secondhandmarket_elan_yaradildi_ve_tesdiq_ucun_gonderildi_2869bb", 'Elan yaradıldı və təsdiq üçün göndərildi')
      });

      setShowCreateModal(false);
      resetForm();
      loadListings();
    } catch (error) {
      toast({
        title: tr("secondhandmarket_xeta_3cdbb6", 'Xəta'),
        description: tr("secondhandmarket_elan_yaradila_bilmedi_9b2414", 'Elan yaradıla bilmədi'),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'clothing',
      condition: 'good',
      price: 0,
      is_free: true,
      age_range: '',
      location_city: ''
    });
    setUploadedImages([]);
  };

  // Load messages for a listing contact
  const loadContactMessages = async (listing: Listing) => {
    if (!profile?.user_id) return;
    const { data } = await supabase.
    from('marketplace_messages').
    select('*').
    eq('listing_id', listing.id).
    or(`sender_id.eq.${profile.user_id},receiver_id.eq.${profile.user_id}`).
    order('created_at', { ascending: true });
    setContactMessages(data || []);
  };

  useEffect(() => {
    if (showContactModal && contactListing) {
      loadContactMessages(contactListing);
    }
  }, [showContactModal, contactListing]);

  const handleSendMessage = async () => {
    if (!contactMessage.trim() || !contactListing || !profile?.user_id) return;
    setSendingMessage(true);
    try {
      const { error } = await supabase.
      from('marketplace_messages').
      insert({
        listing_id: contactListing.id,
        sender_id: profile.user_id,
        receiver_id: contactListing.user_id,
        content: contactMessage.trim()
      });
      if (error) throw error;
      setContactMessage('');
      await loadContactMessages(contactListing);
    } catch (error) {
      toast({
        title: tr("secondhandmarket_xeta_3cdbb6", 'Xəta'),
        description: tr("secondhandmarket_mesaj_gonderile_bilmedi_0cd095", 'Mesaj göndərilə bilmədi'),
        variant: 'destructive'
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const getCategoryInfo = (catId: string) => {
    return categories.find((c) => c.id === catId) || categories[6];
  };

  const getConditionInfo = (condId: string) => {
    return conditions.find((c) => c.id === condId) || conditions[2];
  };

  const filteredListings = listings.filter((listing) =>
  listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  listing.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const freeCount = listings.filter((l) => l.is_free).length;

  const fieldLabel = (text: string) =>
  <label className="text-sm font-bold mb-1.5 block" style={{ color: 'var(--a-ink)' }}>{text}</label>;

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("secondhandmarket_i_lk_elani_siz_yerlesdirin_02683c", "\u0130lk elan\u0131 siz yerl\u0259\u015Fdirin!")}
        title={tr("secondhandmarket_i_kinci_el_bazari_ad9f9f", "\u0130kinci \u018Fl Bazar\u0131")}
        actions={
        <motion.button
          onClick={() => setShowCreateModal(true)}
          className="a-cta-btn"
          style={{ width: 38, height: 38, padding: 0, justifyContent: 'center' }}
          whileTap={{ scale: 0.95 }}>
            <Plus size={16} strokeWidth={2.4} />
          </motion.button>
        } />

      {/* Search */}
      <div className="a-search mb-3">
        <Search size={16} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
        <input
          placeholder={tr("untranslated_axtar_92w4nn", "Axtar...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />
        
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <motion.div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'var(--a-green-1)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          
          <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-green-ink)' }}>{listings.length}</p>
          <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-green-ink)', opacity: 0.8 }}>{tr("untranslated_elan_voiz8p", "Elan")}</p>
        </motion.div>
        <motion.div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'var(--a-yellow-1)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}>
          
          <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-warn-ink)' }}>{freeCount}</p>
          <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.8 }}>{tr("untranslated_pulsuz_27d02z", "Pulsuz")}</p>
        </motion.div>
        <motion.div
          className="rounded-2xl p-3 text-center"
          style={{ background: 'var(--a-lav-1)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          
          <p className="a-heading" style={{ margin: 0, fontSize: 22, color: 'var(--a-lav-ink)' }}>{categories.length}</p>
          <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-lav-ink)', opacity: 0.8 }}>{tr("untranslated_kateqoriya_d7bf4y", "Kateqoriya")}</p>
        </motion.div>
      </div>

      <div className="space-y-3">
        {/* Category Filter */}
        <motion.div
          className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}>
          
          <motion.button
            onClick={() => setSelectedCategory(null)}
            className="shrink-0 px-4 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2"
            style={selectedCategory === null ?
            { background: 'var(--a-grad-cta)', border: '1px solid var(--a-btn-border)', color: 'var(--a-accent-ink)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' } :
            { background: 'var(--a-surface)', border: '1px solid var(--a-line)', color: 'var(--a-ink-soft)', cursor: 'pointer' }}
            whileTap={{ scale: 0.95 }}>
            
            <Sparkles className="w-4 h-4" />
            {tr("secondhandmarket_hamisi_c73c4d", "Ham\u0131s\u0131")}
          </motion.button>
          {categories.map((cat) =>
          <motion.button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className="shrink-0 px-4 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2"
            style={selectedCategory === cat.id ?
            { background: cat.grad, border: '1px solid transparent', color: cat.ink, boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' } :
            { background: 'var(--a-surface)', border: '1px solid var(--a-line)', color: 'var(--a-ink-soft)', cursor: 'pointer' }}
            whileTap={{ scale: 0.95 }}>
            
              <span>{cat.emoji}</span>
              {cat.label}
            </motion.button>
          )}
        </motion.div>

        {/* Toggle My Listings */}
        <div className="a-tabs w-full" style={{ display: 'flex' }}>
          <button
            className={`a-tab flex-1 ${!showMyListings ? 'active' : ''}`}
            onClick={() => setShowMyListings(false)}>
            {tr("secondhandmarket_butun_elanlar_033e6a", "B\xFCt\xFCn elanlar")}
          
          </button>
          <button
            className={`a-tab flex-1 ${showMyListings ? 'active' : ''}`}
            onClick={() => setShowMyListings(true)}>
            {tr("secondhandmarket_menim_elanlarim_cec2c2", "M\u0259nim elanlar\u0131m")}
          
          </button>
        </div>

        {/* Listings */}
        {isLoading ?
        <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) =>
          <div key={i} className="a-card overflow-hidden animate-pulse" style={{ padding: 0 }}>
                <div className="aspect-square" style={{ background: 'var(--a-surface-soft)' }} />
                <div className="p-3">
                  <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--a-surface-soft)' }} />
                  <div className="h-3 rounded w-1/2" style={{ background: 'var(--a-surface-soft)' }} />
                </div>
              </div>
          )}
          </div> :
        filteredListings.length === 0 ?
        <div className="rounded-[26px] p-8 text-center" style={{ background: 'var(--a-surface)', border: '2px dashed var(--a-line-strong)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-grad-green)' }}>
              <Package className="w-8 h-8" style={{ color: 'var(--a-green-ink)' }} />
            </div>
            <h3 className="a-list-title mb-1" style={{ margin: '0 0 4px' }}>{tr("secondhandmarket_hele_elan_yoxdur_89fb8c", "Hələ elan yoxdur")}</h3>
            <p className="a-list-sub mb-4" style={{ margin: '0 0 16px', whiteSpace: 'normal' }}>
              {tr("secondhandmarket_i_lk_elani_siz_yerlesdirin_02683c", "\u0130lk elan\u0131 siz yerl\u0259\u015Fdirin!")}
            </p>
            <button onClick={() => setShowCreateModal(true)} className="a-cta-btn mx-auto">
              <Plus size={15} strokeWidth={2.2} />
              {tr("secondhandmarket_i_lk_elani_yarat_a4e8b2", "\u0130lk elan\u0131 yarat")}
            </button>
          </div> :

        <div className="grid grid-cols-2 gap-3">
            {filteredListings.map((listing, index) => {
            const catInfo = getCategoryInfo(listing.category);
            const condInfo = getConditionInfo(listing.condition);

            return (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedListing(listing);
                  setShowDetailModal(true);
                }}>
                
                  <div
                  className="overflow-hidden cursor-pointer transition-all group rounded-[20px]"
                  style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)' }}>
                    {/* Image */}
                    <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--a-surface-soft)' }}>
                      {listing.images && listing.images.length > 0 ?
                    <img loading="lazy" decoding="async"
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> :


                    <div className="w-full h-full flex items-center justify-center" style={{ background: catInfo.grad }}>
                          <span className="text-5xl">{catInfo.emoji}</span>
                        </div>
                    }
                      
                      {/* Price badge */}
                      <div className="absolute top-2 start-2">
                        {listing.is_free ?
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold shadow-lg" style={{ background: 'var(--a-green-2)', color: '#fff' }}>{tr("untranslated_pulsuz_27d02z", "Pulsuz")}</span> :

                      <span className="px-2 py-0.5 rounded-full text-xs font-bold shadow-lg" style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--a-ink)' }}>
                            {listing.price} ₼
                          </span>
                      }
                      </div>
                      
                      {/* Image count */}
                      {listing.images && listing.images.length > 1 &&
                    <div className="absolute bottom-2 end-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg text-white text-xs flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {listing.images.length}
                        </div>
                    }
                    </div>
                    
                    <div className="p-3">
                      <h3 className="font-bold text-sm line-clamp-1" style={{ color: 'var(--a-ink)' }}>{listing.title}</h3>
                      
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: condInfo.dot }} />
                        <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{condInfo.label}</span>
                        {listing.age_range &&
                      <>
                            <span style={{ color: 'var(--a-ink-faint)' }}>•</span>
                            <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{listing.age_range}</span>
                          </>
                      }
                      </div>
                      
                      {listing.location_city &&
                    <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: 'var(--a-ink-soft)' }}>
                          <MapPin className="w-3 h-3" />
                          {listing.location_city}
                        </div>
                    }
                    </div>
                  </div>
                </motion.div>);

          })}
          </div>
        }
      </div>

      {/* Create Listing Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {if (!open) resetForm();setShowCreateModal(open);}}>
        <DialogContent className="a-scope max-h-[90vh] overflow-y-auto rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--a-grad-green)' }}>
                <Plus className="w-4 h-4" style={{ color: 'var(--a-green-ink)' }} />
              </span>
              {tr("secondhandmarket_yeni_elan_yarat_3c7a2d", "Yeni elan yarat")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Image Upload */}
            <div>
              {fieldLabel(tr("secondhandmarket_sekiller_maks_5_4281f8", "Şəkillər (maks. 5)"))}
              <div className="grid grid-cols-5 gap-2">
                {uploadedImages.map((img, index) =>
                <div key={index} className="aspect-square relative rounded-xl overflow-hidden group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <motion.button
                    onClick={() => removeImage(index)}
                    className="absolute top-1 end-1 w-6 h-6 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--a-pink-2)', border: 'none', cursor: 'pointer' }}
                    whileTap={{ scale: 0.9 }}>
                    
                      <X className="w-3 h-3" />
                    </motion.button>
                  </div>
                )}
                
                {uploadedImages.length < 5 &&
                <motion.button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImages}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                  style={{ border: '2px dashed var(--a-line-strong)', background: 'var(--a-surface-soft)', cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                    {uploadingImages ?
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--a-ink-soft)' }} /> :

                  <>
                        <ImagePlus className="w-5 h-5" style={{ color: 'var(--a-ink-soft)' }} />
                        <span className="text-[10px]" style={{ color: 'var(--a-ink-soft)' }}>{tr("secondhandmarket_elave_et_6e1b9b", "Əlavə et")}</span>
                      </>
                  }
                  </motion.button>
                }
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden" />
              
            </div>
            
            <div>
              {fieldLabel(tr("secondhandmarket_basliq_3dfed8", "Başlıq *"))}
              <input
                className="a-input w-full"
                placeholder={tr("secondhandmarket_meselen_0_3_ay_oglan_geyimleri_55b327", "Məsələn: 0-3 ay oğlan geyimləri")}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              
            </div>
            
            <div>
              {fieldLabel(tr("secondhandmarket_tesvir_f85651", "Təsvir"))}
              <textarea
                className="a-input w-full resize-none"
                style={{ height: 'auto', minHeight: 72, fontFamily: 'inherit' }}
                placeholder={tr("secondhandmarket_esya_haqqinda_melumat_9e2aa1", "Əşya haqqında məlumat...")}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3} />
              
            </div>
            
            <div>
              {fieldLabel(tr("untranslated_kateqoriya_d7bf4y", "Kateqoriya"))}
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) =>
                <motion.button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id })}
                  className="px-3 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5"
                  style={formData.category === cat.id ?
                  { background: cat.grad, color: cat.ink, boxShadow: 'var(--a-card-shadow)', border: 'none', cursor: 'pointer' } :
                  { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', border: 'none', cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                    {cat.emoji} {cat.label}
                  </motion.button>
                )}
              </div>
            </div>
            
            <div>
              {fieldLabel(tr("secondhandmarket_veziyyet_f0e993", "Vəziyyət"))}
              <div className="flex flex-wrap gap-2">
                {conditions.map((cond) =>
                <motion.button
                  key={cond.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, condition: cond.id })}
                  className="px-3 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5"
                  style={formData.condition === cond.id ?
                  { background: cond.soft, color: cond.ink, border: `1px solid ${cond.dot}`, cursor: 'pointer' } :
                  { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', border: '1px solid transparent', cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                    <span className="w-2 h-2 rounded-full" style={{ background: cond.dot }} />
                    {cond.label}
                  </motion.button>
                )}
              </div>
            </div>
            
            <div>
              {fieldLabel(tr("secondhandmarket_yas_araligi_2e277e", "Yaş aralığı"))}
              <div className="flex flex-wrap gap-2">
                {ageRanges.map((age) =>
                <motion.button
                  key={age}
                  type="button"
                  onClick={() => setFormData({ ...formData, age_range: age })}
                  className="px-3 py-2 rounded-full text-sm font-semibold transition-all"
                  style={formData.age_range === age ?
                  { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', border: '1px solid var(--a-peach-2)', cursor: 'pointer' } :
                  { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', border: '1px solid transparent', cursor: 'pointer' }}
                  whileTap={{ scale: 0.95 }}>
                  
                    {age}
                  </motion.button>
                )}
              </div>
            </div>
            
            <div>
              {fieldLabel(tr("secondhandmarket_qiymet_54c4f3", "Qiymət"))}
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  className={formData.is_free ? 'a-cta-btn' : 'a-btn-soft'}
                  style={{ height: 40, padding: '0 18px', ...(formData.is_free ? { background: 'var(--a-green-2)' } : {}) }}
                  onClick={() => setFormData({ ...formData, is_free: true, price: 0 })}>{tr("untranslated_pulsuz_27d02z", "Pulsuz")}</button>
                <button
                  type="button"
                  className={!formData.is_free ? 'a-cta-btn' : 'a-btn-soft'}
                  style={{ height: 40, padding: '0 18px' }}
                  onClick={() => setFormData({ ...formData, is_free: false })}>
                  
                  {tr("secondhandmarket_pullu_3c7a2d", "Pullu")}
                </button>
              </div>
              {!formData.is_free &&
              <div className="flex items-center gap-2">
                  <input
                  className="a-input w-24"
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                
                  <span style={{ color: 'var(--a-ink-soft)' }}>₼</span>
                </div>
              }
            </div>
            
            <div>
              {fieldLabel(tr("secondhandmarket_seher_5f373c", "Şəhər"))}
              <input
                className="a-input w-full"
                placeholder={tr("secondhandmarket_meselen_baki_425cda", "Məsələn: Bakı")}
                value={formData.location_city}
                onChange={(e) => setFormData({ ...formData, location_city: e.target.value })} />
              
            </div>
            
            <button
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 46, background: 'var(--a-green-2)', opacity: isSubmitting ? 0.6 : 1 }}
              onClick={handleCreateListing}
              disabled={isSubmitting}>
              
              {isSubmitting ?
              <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {tr("secondhandmarket_yaradilir_9bb5ed", "Yarad\u0131l\u0131r...")}
                </> :

              <>
                  <Check size={15} strokeWidth={2.2} />
                  Elan yarat
                </>
              }
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Listing Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="a-scope max-h-[90vh] overflow-y-auto p-0 rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          {selectedListing &&
          <>
              {/* Image Gallery */}
              <div className="relative">
                {selectedListing.images && selectedListing.images.length > 0 ?
              <div className="aspect-video" style={{ background: 'var(--a-surface-soft)' }}>
                    <img
                  src={selectedListing.images[0]}
                  alt={selectedListing.title}
                  className="w-full h-full object-cover" />
                
                  </div> :

              <div className="aspect-video flex items-center justify-center" style={{ background: getCategoryInfo(selectedListing.category).grad }}>
                    <span className="text-7xl">{getCategoryInfo(selectedListing.category).emoji}</span>
                  </div>
              }
                
                <motion.button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-3 end-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center"
                style={{ border: 'none', cursor: 'pointer' }}
                whileTap={{ scale: 0.95 }}>
                
                  <X className="w-4 h-4 text-white" />
                </motion.button>

                {/* Image thumbnails */}
                {selectedListing.images && selectedListing.images.length > 1 &&
              <div className="absolute bottom-3 start-3 end-3 flex gap-2 overflow-x-auto">
                    {selectedListing.images.map((img, i) =>
                <div key={i} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 border-white/50">
                        <img loading="lazy" decoding="async" src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                )}
                  </div>
              }
              </div>
              
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-xl font-bold a-heading" style={{ margin: 0, color: 'var(--a-ink)' }}>{selectedListing.title}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                    className="a-rank-tag"
                    style={{ margin: 0, background: getConditionInfo(selectedListing.condition).soft, color: getConditionInfo(selectedListing.condition).ink }}>
                      {getConditionInfo(selectedListing.condition).label}
                    </span>
                    {selectedListing.age_range &&
                  <span className="a-rank-tag" style={{ margin: 0, background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>{selectedListing.age_range}</span>
                  }
                  </div>
                </div>
                
                {/* Price Card */}
                <div
                className="rounded-2xl p-4 flex items-center justify-between"
                style={{ background: selectedListing.is_free ? 'var(--a-green-1)' : 'var(--a-surface-soft)' }}>
                  <div>
                    <p className="text-sm" style={{ margin: 0, color: selectedListing.is_free ? 'var(--a-green-ink)' : 'var(--a-ink-soft)', opacity: 0.8 }}>{tr("secondhandmarket_qiymet_54c4f3", "Qiymət")}</p>
                    <p className="a-heading" style={{ margin: 0, fontSize: 24, color: selectedListing.is_free ? 'var(--a-green-ink)' : 'var(--a-ink)' }}>
                      {selectedListing.is_free ? tr("secondhandmarket_pulsuz", 'Pulsuz') : `${selectedListing.price} ₼`}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: selectedListing.is_free ? 'var(--a-green-2)' : 'var(--a-line-strong)' }}>
                    <Tag className="w-6 h-6" style={{ color: selectedListing.is_free ? '#fff' : 'var(--a-ink-soft)' }} />
                  </div>
                </div>
                
                {selectedListing.description &&
              <div>
                    <h4 className="font-bold mb-2" style={{ color: 'var(--a-ink)' }}>{tr("secondhandmarket_tesvir_f85651", "Təsvir")}</h4>
                    <p style={{ margin: 0, color: 'var(--a-body-text)' }}>{selectedListing.description}</p>
                  </div>
              }
                
                {selectedListing.location_city &&
              <div className="flex items-center gap-2" style={{ color: 'var(--a-ink-soft)' }}>
                    <MapPin className="w-4 h-4" />
                    {selectedListing.location_city}
                  </div>
              }
                
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--a-ink-soft)' }}>
                  <Clock className="w-4 h-4" />
                  {format(new Date(selectedListing.created_at), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
                </div>
                
              <button
                className="a-cta-btn w-full"
                style={{ justifyContent: 'center', height: 48, background: 'var(--a-green-2)', opacity: selectedListing?.user_id === profile?.user_id ? 0.5 : 1 }}
                onClick={() => {
                  setShowDetailModal(false);
                  if (selectedListing) {
                    setContactListing(selectedListing);
                    setShowContactModal(true);
                  }
                }}
                disabled={selectedListing?.user_id === profile?.user_id}>
                
                <MessageCircle size={16} strokeWidth={2.2} />
                {selectedListing?.user_id === profile?.user_id ? tr("secondhandmarket_oz_elaninizdir_4cfb3d", "\xD6z elan\u0131n\u0131zd\u0131r") : tr("secondhandmarket_satici_ile_elaqe_a7f3e8", "Sat\u0131c\u0131 il\u0259 \u0259laq\u0259")}
              </button>
              </div>
            </>
          }
        </DialogContent>
      </Dialog>

      {/* Contact Seller Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="a-scope max-h-[90vh] overflow-y-auto rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <MessageCircle className="w-5 h-5" style={{ color: 'var(--a-green-2)' }} />
              {tr("secondhandmarket_satici_ile_elaqe_a7f3e8", "Sat\u0131c\u0131 il\u0259 \u0259laq\u0259")}
            </DialogTitle>
          </DialogHeader>
          
          {contactListing &&
          <div className="space-y-4 mt-2">
              {/* Listing info */}
              <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--a-surface-soft)' }}>
                {contactListing.images?.[0] ?
              <img src={contactListing.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover" /> :

              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: getCategoryInfo(contactListing.category).grad }}>
                    <span className="text-xl">{getCategoryInfo(contactListing.category).emoji}</span>
                  </div>
              }
                <div className="flex-1 min-w-0">
                  <p className="a-list-title truncate" style={{ margin: 0 }}>{contactListing.title}</p>
                  <p className="a-list-sub" style={{ margin: 0 }}>
                    {contactListing.is_free ? tr("secondhandmarket_pulsuz", 'Pulsuz') : `${contactListing.price} ₼`}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="max-h-60 overflow-y-auto space-y-2 p-2">
                {contactMessages.length === 0 ?
              <div className="text-center py-6">
                    <MessageCircle className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--a-ink-faint)' }} />
                    <p className="a-list-sub" style={{ margin: 0 }}>{tr("secondhandmarket_hele_mesaj_yoxdur_cf0b5e", "Hələ mesaj yoxdur")}</p>
                    <p className="text-xs" style={{ margin: 0, color: 'var(--a-ink-faint)' }}>{tr("secondhandmarket_saticiya_mesaj_gonderin_ad78e2", "Satıcıya mesaj göndərin")}</p>
                  </div> :

              contactMessages.map((msg) =>
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === profile?.user_id ? 'justify-end' : 'justify-start'}`}>
                
                      <div
                  className={`max-w-[75%] px-3 py-2 text-sm ${
                  msg.sender_id === profile?.user_id ? 'rounded-2xl rounded-ee-sm' : 'rounded-2xl rounded-es-sm'}`}
                  style={msg.sender_id === profile?.user_id ?
                  { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' } :
                  { background: 'var(--a-surface-soft)', color: 'var(--a-ink)' }}>
                        <p style={{ margin: 0 }}>{msg.content}</p>
                        <p className="text-[10px] mt-1" style={{ margin: '4px 0 0', opacity: 0.6 }}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </p>
                      </div>
                    </div>
              )
              }
              </div>

              {/* Message input */}
              <div className="flex gap-2">
                <input
                className="a-input flex-1"
                placeholder={tr("secondhandmarket_mesajinizi_yazin_21d48f", "Mesajınızı yazın...")}
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();handleSendMessage();}}} />
              
                <button
                className="a-cta-btn"
                style={{ width: 42, height: 42, padding: 0, justifyContent: 'center', background: 'var(--a-green-2)', opacity: !contactMessage.trim() || sendingMessage ? 0.5 : 1 }}
                onClick={handleSendMessage}
                disabled={!contactMessage.trim() || sendingMessage}>
                
                  {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </ToolPage>);

};

export default SecondHandMarket;
