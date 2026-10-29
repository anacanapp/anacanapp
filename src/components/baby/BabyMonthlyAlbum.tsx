import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Loader2, ShoppingBag, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import AlbumOrderScreen from '@/components/shop/AlbumOrderScreen';
import { ToolPage, ToolHeader } from '@/components/tools/anacan/ToolKit';
import { tr } from "@/lib/tr";
import { getOrdinal } from "@/lib/utils";
import { useUserStore } from "@/store/userStore";
import { compressImageForUpload } from '@/lib/image-compress';

interface BabyMonthlyAlbumProps {
  onBack: () => void;
}

interface AlbumPhoto {
  name: string;
  month: number;
  url: string;
}

const getMonthLabels = (language: string) => Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  label: `${getOrdinal(i + 1, language)} ${tr('babymonthlyalbum_month_suffix', 'ay')}`,
  emoji: ['🌱', '🌿', '🌳', '🌻', '🌺', '🌸', '🍀', '🌈', '⭐', '🎈', '🎉', '🎂'][i]
}));

const BabyMonthlyAlbum = ({ onBack }: BabyMonthlyAlbumProps) => {
  const language = useUserStore((s) => s.language);
  const monthLabels = getMonthLabels(language);
  useScrollToTop();
  const { user } = useAuth();
  const { selectedChild, getChildAge } = useChildren();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMonth, setUploadMonth] = useState<number | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const [replacingPhoto, setReplacingPhoto] = useState<AlbumPhoto | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<AlbumPhoto | null>(null);
  const [showActionSheet, setShowActionSheet] = useState<AlbumPhoto | null>(null);

  const babyMonths = selectedChild ? getChildAge(selectedChild).months : 0;
  const canOrderPhysical = babyMonths >= 12;

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['baby-album-photos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.storage.from('baby-album').list(user.id, { sortBy: { column: 'name', order: 'asc' } });
      if (!data) return [];
      const files = data.filter((f) => f.name !== '.emptyFolderPlaceholder');
      const paths = files.map((f) => `${user.id}/${f.name}`);
      
      let signedUrls: any[] = [];
      if (paths.length > 0) {
        const { data: urls, error: signedError } = await supabase.storage.from('baby-album').createSignedUrls(paths, 3600);
        if (!signedError && urls) {
          signedUrls = urls;
        }
      }

      return files.map((f, i) => {
        const monthMatch = f.name.match(/^month-(\d+)/);
        return {
          name: f.name,
          month: monthMatch ? parseInt(monthMatch[1]) : 0,
          url: signedUrls[i]?.signedUrl || ''
        };
      }).filter((p) => p.month > 0);
    },
    enabled: !!user
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !uploadMonth) return;
    setUploading(true);
    try {
      // If replacing, delete old photo first
      if (replacingPhoto) {
        await supabase.storage.from('baby-album').remove([`${user.id}/${replacingPhoto.name}`]);
        setReplacingPhoto(null);
      }
      const upload = await compressImageForUpload(file);
      const ext = upload.name.split('.').pop();
      const path = `${user.id}/month-${uploadMonth}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('baby-album').upload(path, upload);
      if (error) throw error;
      toast({ title: tr("babymonthlyalbum_sekil_yuklendi_0c2f85", 'Şəkil yükləndi!') });
      queryClient.invalidateQueries({ queryKey: ['baby-album-photos'] });
    } catch (err) {
      toast({ title: tr("babymonthlyalbum_xeta_3cdbb6", 'Xəta'), description: tr("babymonthlyalbum_sekil_yuklene_bilmedi_3c275f", 'Şəkil yüklənə bilmədi'), variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadMonth(null);
      setViewingPhoto(null);
    }
  };

  const handleDelete = async (photo: AlbumPhoto) => {
    if (!user) return;
    try {
      const { error } = await supabase.storage.from('baby-album').remove([`${user.id}/${photo.name}`]);
      if (error) throw error;
      toast({ title: tr("babymonthlyalbum_sekil_silindi_efe8e8", 'Şəkil silindi') });
      setViewingPhoto(null);
      queryClient.invalidateQueries({ queryKey: ['baby-album-photos'] });
    } catch (err) {
      toast({ title: tr("babymonthlyalbum_xeta_3cdbb6", 'Xəta'), description: tr("babymonthlyalbum_sekil_siline_bilmedi_e563ea", 'Şəkil silinə bilmədi'), variant: 'destructive' });
    }
  };

  const handleReplace = (photo: AlbumPhoto) => {
    setReplacingPhoto(photo);
    setUploadMonth(photo.month);
    fileInputRef.current?.click();
  };

  if (showOrder) {
    return <AlbumOrderScreen albumType="baby" onBack={() => setShowOrder(false)} />;
  }

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("babymonthlyalbum_her_ay_bir_xatire_4ca0e9", "Hər ay bir xatirə")}
        title={tr("babymonthlyalbum_korpe_albomu_42d4c6", "Körpə Albomu")} />

      <div className="grid grid-cols-3 gap-3">
        {monthLabels.map(({ month, label, emoji }) => {
          const photo = photos.find((p) => p.month === month);
          return (
            <motion.button
              key={month}
              onClick={() => {
                if (photo) {
                  setShowActionSheet(photo);
                } else {
                  setUploadMonth(month);
                  fileInputRef.current?.click();
                }
              }}
              className="relative aspect-square rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1 transition-all"
              style={photo ?
              { border: 'none', background: 'var(--a-surface)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer', padding: 0 } :
              { border: '2px dashed var(--a-line-strong)', background: 'var(--a-surface)', cursor: 'pointer', padding: 0 }}
              whileTap={{ scale: 0.95 }}>
              
              {photo ?
              <img loading="lazy" decoding="async" src={photo.url} alt={label} className="absolute inset-0 w-full h-full object-cover" /> :

              <>
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--a-ink-soft)' }}>{label}</span>
                  <Camera className="w-3.5 h-3.5" style={{ color: 'var(--a-ink-faint)' }} />
                </>
              }
              {photo &&
              <div className="absolute bottom-0 inset-x-0 bg-black/50 py-1 text-center">
                  <span className="text-[10px] font-bold text-white">{label}</span>
                </div>
              }
            </motion.button>);

        })}
      </div>

      {canOrderPhysical ?
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-cta mt-5 mb-4">
        
          <div className="flex items-start gap-3">
            <span className="a-list-icon" style={{ background: 'var(--a-grad-cta)', flexShrink: 0, border: '1px solid var(--a-btn-border)' }}>
              <Sparkles size={17} strokeWidth={2.2} style={{ color: 'var(--a-accent-ink)' }} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="a-card-title a-heading" style={{ margin: '0 0 2px' }}>
                {selectedChild?.name || tr("babymonthlyalbum_korpeniz_da99de", "K\xF6rp\u0259niz")} {tr("babymonthlyalbum_artiq_1_yasindadir_c1c0c4", "art\u0131q 1 ya\u015F\u0131ndad\u0131r! \uD83C\uDF89")}
              </h3>
              <p className="a-cta-text" style={{ margin: '0 0 12px' }}>
                {tr("babymonthlyalbum_i_lk_ilin_xatirelerini_fiziki__f12a94", "\u0130lk ilin xatir\u0259l\u0259rini fiziki albom kimi \u0259linizd\u0259 tutun. H\u0259r ay \xFC\xE7\xFCn ayr\u0131ca s\u0259hif\u0259, premium ka\u011F\u0131z, \xF6m\xFCrl\xFCk xatir\u0259.")}
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl p-2 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("babymonthlyalbum_sehife_fd1fa9", "S\u0259hif\u0259")}</p>
                  <p className="text-[13px] font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>12+</p>
                </div>
                <div className="rounded-xl p-2 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>Format</p>
                  <p className="text-[13px] font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>A4</p>
                </div>
                <div className="rounded-xl p-2 text-center" style={{ background: 'var(--a-surface-soft)' }}>
                  <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("babymonthlyalbum_catdirilma_e955cf", "\xC7atd\u0131r\u0131lma")}</p>
                  <p className="text-[13px] font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{tr("babymonthlyalbum_3_5_gun_5d513c", "3-5 g\xFCn")}</p>
                </div>
              </div>
              <button
              onClick={() => setShowOrder(true)}
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 44 }}>
              
                <ShoppingBag size={15} strokeWidth={2.2} />
                {tr("babymonthlyalbum_fiziki_albom_sifaris_et_26f86e", "Fiziki Albom Sifari\u015F Et")}
              </button>
            </div>
          </div>
        </motion.div> :

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-card mt-5 mb-4">
        
          <div className="flex items-start gap-3">
            <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', flexShrink: 0 }}>
              <ShoppingBag size={17} strokeWidth={2.2} style={{ color: 'var(--a-ink-soft)' }} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="a-list-title mb-0.5" style={{ margin: '0 0 2px' }}>{tr("babymonthlyalbum_fiziki_albom_title", "Fiziki Albom")}</h3>
              <p className="a-list-sub mb-2" style={{ margin: '0 0 8px', whiteSpace: 'normal' }}>
                {selectedChild?.name || tr("babymonthlyalbum_korpeniz_da99de", "Körpəniz")} {tr("babymonthlyalbum_1_yasina_catdiqda_ilk_ilin_but_b845cd", "1 yaşına çatdıqda ilk ilin bütün xatirələrini fiziki albom kimi sifariş edə bilərsiniz.")}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--a-line-strong)' }}>
                  <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, babyMonths / 12 * 100)}%`, background: 'var(--a-grad-peach)' }} />
                
                </div>
                <span className="text-[11px] font-bold" style={{ color: 'var(--a-ink-soft)' }}>{babyMonths}/12 {tr("common_ay", "ay")}</span>
              </div>
            </div>
          </div>
        </motion.div>
      }

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

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
              onClick={() => setViewingPhoto(null)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}>
                <X className="w-6 h-6" />
              </button>
              <p className="font-semibold text-white" style={{ margin: 0 }}>
                {monthLabels.find((m) => m.month === viewingPhoto.month)?.label}
              </p>
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
                onClick={() => {
                  if (confirm(tr("babymonthlyalbum_bu_sekli_silmek_istediyinize_e_b4ecbc", "Bu şəkli silmək istədiyinizə əminsiniz?"))) {
                    handleDelete(viewingPhoto);
                  }
                }}>
                
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <img src={viewingPhoto.url} alt="Baby photo" className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Action Sheet */}
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
            
              <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--a-line)' }}>
                <img src={showActionSheet.url} alt="Preview" className="w-16 h-16 rounded-xl object-cover" />
                <p className="a-list-title" style={{ margin: 0 }}>
                  {monthLabels.find((m) => m.month === showActionSheet.month)?.label}
                </p>
              </div>

              <div className="p-4 grid grid-cols-3 gap-2">
                <button
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{ background: 'var(--a-peach-1)', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  setViewingPhoto(showActionSheet);
                  setShowActionSheet(null);
                }}>
                
                  <Camera className="w-5 h-5" style={{ color: 'var(--a-accent-ink)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--a-accent-ink)' }}>{tr("babymonthlyalbum_bax", "Bax")}</span>
                </button>

                <button
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{ background: 'var(--a-blue-1)', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  handleReplace(showActionSheet);
                  setShowActionSheet(null);
                }}>
                
                  <RefreshCw className="w-5 h-5" style={{ color: 'var(--a-blue-ink)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--a-blue-ink)' }}>{tr("babymonthlyalbum_deyisdir_aca175", "Dəyişdir")}</span>
                </button>

                <button
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{ background: 'var(--a-pink-1)', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  setShowActionSheet(null);
                  if (confirm(tr("babymonthlyalbum_bu_sekli_silmek_istediyinize_e_b4ecbc", "Bu şəkli silmək istədiyinizə əminsiniz?"))) {
                    handleDelete(showActionSheet);
                  }
                }}>
                
                  <Trash2 className="w-5 h-5" style={{ color: 'var(--a-pink-ink)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--a-pink-ink)' }}>{tr("babymonthlyalbum_sil", "Sil")}</span>
                </button>
              </div>

              <div className="px-4 pb-4">
                <button
                className="a-btn-soft w-full"
                style={{ justifyContent: 'center', height: 44 }}
                onClick={() => setShowActionSheet(null)}>
                  {tr("babymonthlyalbum_legv_et", "Ləğv et")}
                </button>
              </div>
              <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {uploading &&
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="rounded-[26px] p-6 text-center" style={{ background: 'var(--a-surface)' }}>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--a-peach-2)' }} />
            <p className="a-list-title" style={{ margin: 0 }}>{tr("babymonthlyalbum_yuklenir_5557de", "Yüklənir...")}</p>
          </div>
        </div>
      }
    </ToolPage>);

};

export default BabyMonthlyAlbum;
