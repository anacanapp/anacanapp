import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImagePlus, Camera, Trash2, RefreshCw,
  X, Edit, Save, Heart, ShoppingBag } from
'lucide-react';
import AlbumOrderScreen from '@/components/shop/AlbumOrderScreen';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr } from "@/lib/tr";

interface PregnancyAlbumProps {
  onBack: () => void;
}

interface AlbumPhoto {
  id: string;
  user_id: string;
  week_number: number;
  month_number: number;
  photo_url: string;
  caption: string | null;
  photo_date: string;
  created_at: string;
}

// Month labels in Azerbaijani
const monthLabels = [
{ month: 1, weeks: '1-4', label: tr("pregnancyalbum_label_1", '1-ci ay'), emoji: '🌱' },
{ month: 2, weeks: '5-8', label: tr("pregnancyalbum_label_2", '2-ci ay'), emoji: '🌿' },
{ month: 3, weeks: '9-13', label: tr("pregnancyalbum_3_cu_ay_cd62b6", '3-cü ay'), emoji: '🌳' },
{ month: 4, weeks: '14-17', label: tr("pregnancyalbum_4_cu_ay_e2b0d2", '4-cü ay'), emoji: '🍋' },
{ month: 5, weeks: '18-21', label: tr("pregnancyalbum_label_5", '5-ci ay'), emoji: '🥭' },
{ month: 6, weeks: '22-26', label: tr("pregnancyalbum_6_ci_ay_c17c71", '6-cı ay'), emoji: '🥥' },
{ month: 7, weeks: '27-30', label: tr("pregnancyalbum_label_7", '7-ci ay'), emoji: '🍉' },
{ month: 8, weeks: '31-35', label: tr("pregnancyalbum_label_8", '8-ci ay'), emoji: '🎃' },
{ month: 9, weeks: '36-40', label: tr("pregnancyalbum_label_9", '9-cu ay'), emoji: '👶' }];


const getMonthFromWeek = (week: number): number => {
  if (week <= 4) return 1;
  if (week <= 8) return 2;
  if (week <= 13) return 3;
  if (week <= 17) return 4;
  if (week <= 21) return 5;
  if (week <= 26) return 6;
  if (week <= 30) return 7;
  if (week <= 35) return 8;
  return 9;
};

const PregnancyAlbum = ({ onBack }: PregnancyAlbumProps) => {
  useScrollToTop();
  useScreenAnalytics('PregnancyAlbum', 'Tools');

  const { user } = useAuth();
  const getPregnancyData = useUserStore((s) => s.getPregnancyData);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<AlbumPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption] = useState('');
  const [showOrder, setShowOrder] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState<AlbumPhoto | null>(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);

  const pregData = getPregnancyData();
  const currentWeek = pregData?.currentWeek || 1;
  const currentMonth = getMonthFromWeek(currentWeek);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['pregnancy-album-photos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.
      from('pregnancy_album_photos').
      select('*').
      eq('user_id', user.id).
      order('month_number', { ascending: true });
      if (error) throw error;
      
      const paths = data.map(p => {
        const urlParts = p.photo_url.split('/pregnancy-album/');
        return urlParts.length > 1 ? decodeURIComponent(urlParts[1]) : p.photo_url;
      });
      
      if (paths.length > 0) {
        const { data: signedUrls } = await supabase.storage.from('pregnancy-album').createSignedUrls(paths, 3600);
        if (signedUrls) {
          data.forEach((p, i) => {
            if (signedUrls[i]?.signedUrl) {
              p.photo_url = signedUrls[i].signedUrl;
            }
          });
        }
      }
      
      return data as AlbumPhoto[];
    },
    enabled: !!user?.id
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, replacePhoto }: {file: File;replacePhoto?: AlbumPhoto | null;}) => {
      if (!user?.id) throw new Error(tr("pregnancyalbum_i_stifadeci_tapilmadi_4e2156", "\u0130stifad\u0259\xE7i tap\u0131lmad\u0131"));

      const monthToUpload = selectedMonth || currentMonth;

      // If replacing, delete old photo first
      if (replacePhoto) {
        const oldPath = replacePhoto.photo_url.split('/pregnancy-album/')[1];
        if (oldPath) {
          await supabase.storage.from('pregnancy-album').remove([decodeURIComponent(oldPath)]);
        }
        await supabase.from('pregnancy_album_photos').delete().eq('id', replacePhoto.id);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${monthToUpload}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.
      from('pregnancy-album').
      upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.
      from('pregnancy-album').
      getPublicUrl(fileName);

      const weekForMonth = monthLabels.find((m) => m.month === monthToUpload);
      const weekNumber = parseInt(weekForMonth?.weeks.split('-')[0] || '1');

      const { error: dbError } = await supabase.
      from('pregnancy_album_photos').
      insert({
        user_id: user.id,
        week_number: weekNumber,
        month_number: monthToUpload,
        photo_url: publicUrl,
        caption: caption || null
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy-album-photos'] });
      setSelectedMonth(null);
      setCaption('');
      setReplacingPhotoId(null);
      setViewingPhoto(null);
      toast({ title: tr("pregnancyalbum_sekil_elave_edildi_a2085a", 'Şəkil əlavə edildi'), description: tr("pregnancyalbum_hamilelik_albomuna_sekil_elave_edildi_bf00fa", 'Hamiləlik albomuna şəkil əlavə edildi') });
    },
    onError: (error) => {
      console.error('Upload error:', error);
      setReplacingPhotoId(null);
      toast({ title: tr("pregnancyalbum_xeta_3cdbb6", 'Xəta'), description: tr("pregnancyalbum_sekil_yuklene_bilmedi_3c275f", 'Şəkil yüklənə bilmədi'), variant: 'destructive' });
    },
    onSettled: () => {
      setUploading(false);
    }
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photo: AlbumPhoto) => {
      const path = photo.photo_url.split('/pregnancy-album/')[1];
      if (path) {
        await supabase.storage.from('pregnancy-album').remove([decodeURIComponent(path)]);
      }
      const { error } = await supabase.
      from('pregnancy_album_photos').
      delete().
      eq('id', photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy-album-photos'] });
      setViewingPhoto(null);
      setShowActionSheet(null);
      toast({ title: 'Silindi', description: tr("pregnancyalbum_sekil_albomdan_silindi_0f180a", 'Şəkil albomdan silindi') });
    }
  });

  const updateCaptionMutation = useMutation({
    mutationFn: async ({ id, newCaption }: {id: string;newCaption: string;}) => {
      const { error } = await supabase.
      from('pregnancy_album_photos').
      update({ caption: newCaption || null }).
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pregnancy-album-photos'] });
      setEditingCaption(false);
      toast({ title: tr("pregnancyalbum_yenilendi_d10a01", 'Yeniləndi') });
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    e.target.value = '';

    setUploading(true);

    // Find the photo being replaced
    const replacePhoto = replacingPhotoId ?
    photos.find((p) => p.id === replacingPhotoId) || null :
    null;

    uploadPhotoMutation.mutate({ file, replacePhoto });
  };

  const getPhotoForMonth = (month: number) => {
    return photos.find((p) => p.month_number === month);
  };

  // Handle replace: set state then open file picker (in same user gesture)
  const handleReplace = (photo: AlbumPhoto) => {
    setReplacingPhotoId(photo.id);
    setSelectedMonth(photo.month_number);
    setShowActionSheet(null);
    setViewingPhoto(null);
    // Must click in the same tick as user gesture for mobile
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  // Handle delete with confirmation
  const handleDelete = (photo: AlbumPhoto) => {
    setShowActionSheet(null);
    if (confirm(tr("pregnancyalbum_bu_sekli_silmek_istediyinize_e_b4ecbc", "Bu \u015F\u0259kli silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) {
      deletePhotoMutation.mutate(photo);
    }
  };

  if (showOrder) {
    return <AlbumOrderScreen albumType="pregnancy" onBack={() => setShowOrder(false)} />;
  }

  return (
    <ToolPage>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden" />
      

      <ToolHeader
        onBack={onBack}
        eyebrow={tr("pregnancyalbum_her_ay_xatire_c5bdee", "Hər ay xatirə")}
        title={tr("pregnancyalbum_hamilelik_albomu_6f1559", "Hamiləlik Albomu")} />

      {/* Current Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-card mb-4"
        style={{ background: 'var(--a-grad-pink)', border: 'none' }}>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-alert-ink)', opacity: 0.75 }}>{tr("pregnancyalbum_hal_hazirda_b78349", "Hal-hazırda")}</p>
            <p className="a-heading" style={{ margin: 0, fontSize: 20, color: 'var(--a-alert-ink)' }}>{monthLabels[currentMonth - 1]?.label || `${currentMonth}-ci ay`}</p>
            <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-alert-ink)', opacity: 0.75 }}>{currentWeek}{tr("pregnancyalbum_hefte_459cfe", ". h\u0259ft\u0259")}</p>
          </div>
          <div className="text-4xl">{monthLabels[currentMonth - 1]?.emoji}</div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.45)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#fff' }}
              initial={{ width: 0 }}
              animate={{ width: `${currentMonth / 9 * 100}%` }} />
            
          </div>
          <span className="text-xs font-bold" style={{ color: 'var(--a-alert-ink)' }}>{Math.round(currentMonth / 9 * 100)}%</span>
        </div>
      </motion.div>

      {/* Album Grid */}
      <div className="a-section-head">
        <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>{tr("pregnancyalbum_xatireleriniz_3e880f", "Xatirələriniz")}</h2>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {monthLabels.map((month, index) => {
          const photo = getPhotoForMonth(month.month);
          const isPast = month.month < currentMonth;
          const isCurrent = month.month === currentMonth;
          const isFuture = month.month > currentMonth;

          return (
            <motion.button
              key={month.month}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => {
                if (photo) {
                  setShowActionSheet(photo);
                } else if (!isFuture) {
                  setSelectedMonth(month.month);
                  setReplacingPhotoId(null);
                  fileInputRef.current?.click();
                }
              }}
              disabled={isFuture && !photo}
              className={`aspect-square rounded-2xl overflow-hidden relative ${
              isFuture && !photo ? 'opacity-40' : ''}`
              }
              style={{ cursor: isFuture && !photo ? 'default' : 'pointer', background: 'none', border: 'none', padding: 0 }}>
              
              {photo ?
              <>
                  <img
                  src={photo.photo_url}
                  alt={month.label}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover" />
                
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-2 start-2 end-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold inline-block" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                      {month.label}
                    </span>
                  </div>
                </> :

              <div
                className="w-full h-full flex flex-col items-center justify-center"
                style={isCurrent ?
                { background: 'var(--a-peach-1)', border: '2px dashed var(--a-peach-2)', borderRadius: 16 } :
                { background: 'var(--a-surface)', border: '2px dashed var(--a-line-strong)', borderRadius: 16 }}>
                  <span className="text-2xl mb-1">{month.emoji}</span>
                  {isCurrent ?
                <>
                      <ImagePlus className="w-5 h-5 mb-1" style={{ color: 'var(--a-accent-ink)' }} />
                      <span className="text-[10px] font-bold" style={{ color: 'var(--a-accent-ink)' }}>{tr("pregnancyalbum_elave_et_6e1b9b", "Əlavə et")}</span>
                    </> :
                isPast ?
                <>
                      <ImagePlus className="w-4 h-4 mb-1" style={{ color: 'var(--a-ink-soft)' }} />
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--a-ink-soft)' }}>{month.label}</span>
                    </> :

                <span className="text-[10px] font-semibold" style={{ color: 'var(--a-ink-soft)' }}>{month.label}</span>
                }
                </div>
              }
              
              {isCurrent && !photo &&
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ border: '2px solid var(--a-peach-2)' }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: 2 }} />

              }
            </motion.button>);

        })}
      </div>

      {/* Tips */}
      <div className="a-card mt-4">
        <div className="flex items-start gap-3">
          <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)', flexShrink: 0 }}>
            <Heart size={17} strokeWidth={2.2} style={{ color: 'var(--a-alert-ink)' }} />
          </span>
          <div>
            <h3 className="a-list-title mb-1" style={{ margin: '0 0 4px' }}>{tr("pregnancyalbum_meslehet_9a0892", "Məsləhət")}</h3>
            <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
              {tr("pregnancyalbum_her_ay_eyni_bucaqdan_ve_eyni_p_4d07a0", "H\u0259r ay eyni bucaqdan v\u0259 eyni paltarla \u015F\u0259kil \xE7\u0259km\u0259k daha g\xF6z\u0259l albom yarad\u0131r. \n                Bel\u0259c\u0259 hamil\u0259lik boyunca d\u0259yi\u015Fiklikl\u0259ri a\xE7\u0131q \u015F\u0259kild\u0259 g\xF6r\u0259 bil\u0259rsiniz.")}
            
            </p>
          </div>
        </div>
      </div>

      {/* Fiziki Albom CTA */}
      {currentMonth >= 6 ?
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-cta mt-4 mb-4">
        
          <div className="flex items-start gap-3">
            <span className="a-list-icon" style={{ background: 'var(--a-grad-cta)', flexShrink: 0, border: '1px solid var(--a-btn-border)' }}>
              <Heart size={17} strokeWidth={2.2} style={{ color: 'var(--a-accent-ink)' }} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="a-card-title a-heading" style={{ margin: '0 0 2px' }}>{tr("pregnancyalbum_hamilelik_xatirelerini_elinizd_76d584", "Hamil\u0259lik xatir\u0259l\u0259rini \u0259linizd\u0259 tutun")}</h3>
              <p className="a-cta-text" style={{ margin: '0 0 12px' }}>
                {tr("pregnancyalbum_9_ayin_her_anini_fiziki_albom__729db3", "9 ay\u0131n h\u0259r an\u0131n\u0131 fiziki albom kimi sifari\u015F edin. Premium ka\u011F\u0131z, h\u0259r ay \xFC\xE7\xFCn ayr\u0131ca s\u0259hif\u0259, \xF6m\xFCrl\xFCk xatir\u0259.")}
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl p-2 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("pregnancyalbum_sehife_fd1fa9", "S\u0259hif\u0259")}</p>
                  <p className="text-[13px] font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>9+</p>
                </div>
                <div className="rounded-xl p-2 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>Format</p>
                  <p className="text-[13px] font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>A4</p>
                </div>
                <div className="rounded-xl p-2 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("pregnancyalbum_catdirilma_e955cf", "\xC7atd\u0131r\u0131lma")}</p>
                  <p className="text-[13px] font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{tr("pregnancyalbum_3_5_gun_5d513c", "3-5 g\xFCn")}</p>
                </div>
              </div>
              <button
              onClick={() => setShowOrder(true)}
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 44 }}>
              
                <ShoppingBag size={15} strokeWidth={2.2} />
                {tr("pregnancyalbum_fiziki_albom_sifaris_et_26f86e", "Fiziki Albom Sifari\u015F Et")}
              </button>
            </div>
          </div>
        </motion.div> :

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-card mt-4 mb-4">
        
          <div className="flex items-start gap-3">
            <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', flexShrink: 0 }}>
              <ShoppingBag size={17} strokeWidth={2.2} style={{ color: 'var(--a-ink-soft)' }} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="a-list-title mb-0.5" style={{ margin: '0 0 2px' }}>{tr("untranslated_fiziki_albom_3i3l4j", "Fiziki Albom")}</h3>
              <p className="a-list-sub mb-2" style={{ margin: '0 0 8px', whiteSpace: 'normal' }}>
                {tr("pregnancyalbum_6_ci_ayi_tamamladiqdan_sonra_h_8a778c", "6-c\u0131 ay\u0131 tamamlad\u0131qdan sonra hamil\u0259lik albomunuzu fiziki kitab kimi sifari\u015F ed\u0259 bil\u0259rsiniz.")}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--a-line-strong)' }}>
                  <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, currentMonth / 6 * 100)}%`, background: 'var(--a-grad-peach)' }} />
                
                </div>
                <span className="text-[11px] font-bold" style={{ color: 'var(--a-ink-soft)' }}>{currentMonth}/6 {tr("pregnancyalbum_ay_suffix_3c7a2d", "ay")}</span>
              </div>
            </div>
          </div>
        </motion.div>
      }


      {/* Action Sheet - appears when tapping a photo */}
      <AnimatePresence>
        {showActionSheet &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
          onClick={() => setShowActionSheet(null)}>
          
            <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-t-[26px] overflow-hidden"
            style={{ background: 'var(--a-surface)' }}
            onClick={(e) => e.stopPropagation()}>
            
              {/* Photo preview */}
              <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--a-line)' }}>
                <img
                src={showActionSheet.photo_url}
                alt="Preview"
                className="w-16 h-16 rounded-xl object-cover" />
              
                <div>
                  <p className="a-list-title" style={{ margin: 0 }}>
                    {monthLabels[showActionSheet.month_number - 1]?.label}
                  </p>
                  <p className="a-list-sub" style={{ margin: 0 }}>
                    {format(new Date(showActionSheet.photo_date), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
                  </p>
                  {showActionSheet.caption &&
                <p className="a-list-sub mt-0.5" style={{ margin: '2px 0 0' }}>{showActionSheet.caption}</p>
                }
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 grid grid-cols-3 gap-2">
                <button
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{ background: 'var(--a-peach-1)', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  setViewingPhoto(showActionSheet);
                  setShowActionSheet(null);
                }}>
                
                  <Camera className="w-5 h-5" style={{ color: 'var(--a-accent-ink)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--a-accent-ink)' }}>{tr("untranslated_bax_1yplss", "Bax")}</span>
                </button>
                
                <button
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{ background: 'var(--a-blue-1)', border: 'none', cursor: 'pointer' }}
                onClick={() => handleReplace(showActionSheet)}>
                
                  <RefreshCw className="w-5 h-5" style={{ color: 'var(--a-blue-ink)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--a-blue-ink)' }}>{tr("pregnancyalbum_deyisdir_aca175", "Dəyişdir")}</span>
                </button>
                
                <button
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{ background: 'var(--a-pink-1)', border: 'none', cursor: 'pointer' }}
                onClick={() => handleDelete(showActionSheet)}>
                
                  <Trash2 className="w-5 h-5" style={{ color: 'var(--a-pink-ink)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--a-pink-ink)' }}>{tr("untranslated_sil_zwa7lz", "Sil")}</span>
                </button>
              </div>

              {/* Cancel */}
              <div className="px-4 pb-4">
                <button
                className="a-btn-soft w-full"
                style={{ justifyContent: 'center', height: 44 }}
                onClick={() => setShowActionSheet(null)}>
                  {tr("pregnancyalbum_legv_et_b5e49c", "L\u0259\u011Fv et")}
                
              </button>
              </div>
              
              <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Photo Viewer Modal */}
      <AnimatePresence>
        {viewingPhoto &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex flex-col">

            <div className="flex items-center justify-between px-4 py-3 safe-area-top">
              <button
              onClick={() => {
                setViewingPhoto(null);
                setEditingCaption(false);
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
              
                <X className="w-6 h-6" />
              </button>
              <div className="text-center text-white">
                <p className="font-semibold" style={{ margin: 0 }}>{monthLabels[viewingPhoto.month_number - 1]?.label}</p>
                <p className="text-xs opacity-70" style={{ margin: 0 }}>
                  {format(new Date(viewingPhoto.photo_date), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}
                onClick={() => handleReplace(viewingPhoto)}>
                
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: 'var(--a-pink-2)' }}
                onClick={() => handleDelete(viewingPhoto)}>
                
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4">
              <img
              src={viewingPhoto.photo_url}
              alt="Pregnancy photo"
              className="max-w-full max-h-full object-contain rounded-lg" />
            
            </div>

            <div className="p-4">
              {editingCaption ?
            <div className="flex gap-2">
                  <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={tr("pregnancyalbum_basliq_elave_edin_082901", "Başlıq əlavə edin...")}
                className="flex-1 h-10 px-3 rounded-lg bg-white/10 text-white placeholder:text-white/50 outline-none"
                autoFocus />
              
                  <button
                className="a-cta-btn"
                style={{ width: 42, height: 42, padding: 0, justifyContent: 'center' }}
                onClick={() => updateCaptionMutation.mutate({ id: viewingPhoto.id, newCaption: caption })}>
                
                    <Save className="w-4 h-4" />
                  </button>
                </div> :

            <button
              onClick={() => {
                setCaption(viewingPhoto.caption || '');
                setEditingCaption(true);
              }}
              className="flex items-center gap-2 text-white/70 hover:text-white"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              
                  {viewingPhoto.caption ?
              <p className="text-sm" style={{ margin: 0 }}>{viewingPhoto.caption}</p> :

              <>
                      <Edit className="w-4 h-4" />
                      <span className="text-sm">{tr("pregnancyalbum_basliq_elave_et_ac912f", "Başlıq əlavə et")}</span>
                    </>
              }
                </button>
            }
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Uploading Overlay */}
      {uploading &&
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="rounded-[26px] p-6 text-center" style={{ background: 'var(--a-surface)' }}>
            <div className="w-12 h-12 rounded-full animate-spin mx-auto mb-3" style={{ border: '4px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
            <p className="a-list-title" style={{ margin: 0 }}>{tr("pregnancyalbum_sekil_yuklenir_babf92", "Şəkil yüklənir...")}</p>
          </div>
        </div>
      }
    </ToolPage>);

};

export default PregnancyAlbum;
