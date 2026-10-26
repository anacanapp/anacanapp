import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  X, Download, Share2, Trash2, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Loader2 } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative, nativeShare, saveImageToGallery, isIOS } from '@/lib/native';
import { tr } from "@/lib/tr";
import { useIsRtl } from '@/lib/rtl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";

interface Photo {
  id: string;
  url: string;
  theme?: string;
  createdAt?: string;
}

interface PhotoGalleryViewerProps {
  photos: Photo[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (photoId: string) => Promise<void>;
}

const PhotoGalleryViewer = ({
  photos,
  initialIndex,
  isOpen,
  onClose,
  onDelete
}: PhotoGalleryViewerProps) => {
  const isRtl = useIsRtl();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const currentPhoto = photos[currentIndex];
  const hasNext = currentIndex < photos.length - 1;
  const hasPrev = currentIndex > 0;

  const handleHaptic = async () => {
    if (isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {}
    }
  };

  const goToNext = useCallback(() => {
    if (hasNext) {
      handleHaptic();
      setCurrentIndex((prev) => prev + 1);
      setIsZoomed(false);
    }
  }, [hasNext]);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      handleHaptic();
      setCurrentIndex((prev) => prev - 1);
      setIsZoomed(false);
    }
  }, [hasPrev]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    // RTL: oxu istiqamətinə uyğun güzgülənir (sağa sürüşdürmə = növbəti)
    const swipedToStart = isRtl ? info.offset.x < -threshold : info.offset.x > threshold;
    const swipedToEnd = isRtl ? info.offset.x > threshold : info.offset.x < -threshold;
    if (swipedToStart && hasPrev) {
      goToPrev();
    } else if (swipedToEnd && hasNext) {
      goToNext();
    }
  };

  const handleDownload = async () => {
    if (!currentPhoto || isDownloading) return;

    setIsDownloading(true);
    handleHaptic();

    try {
      const fileName = `anacan-baby-photo-${Date.now()}.jpg`;
      const success = await saveImageToGallery(currentPhoto.url, fileName);

      if (success) {
        await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});

        toast({
          title: tr("photogalleryviewer_sekil_endirildi_0b4a05", 'Şəkil endirildi! 📸')
        });
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: tr("photogalleryviewer_xeta_3cdbb6", 'Xəta'),
        description: tr("photogalleryviewer_sekil_yuklenerken_xeta_bas_verdi_16a2d0", 'Şəkil yüklənərkən xəta baş verdi'),
        variant: 'destructive'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!currentPhoto) return;
    handleHaptic();

    const shared = await nativeShare({
      title: tr("photogalleryviewer_korpe_fotosu_770c1a", 'Körpə Fotosu'),
      text: tr("photogalleryviewer_anacan_ile_yaradilmis_korpe_fotosu_cfa1e7", "Anacan ilə yaradılmış körpə fotosu"),
      url: currentPhoto.url
    });

    if (shared) {
      toast({
        title: tr("photogalleryviewer_paylasildi_40c74e", 'Paylaşıldı! 🎉')
      });
    }
  };

  const handleDelete = async () => {
    if (!currentPhoto || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(currentPhoto.id);

      if (photos.length === 1) {
        onClose();
      } else if (currentIndex === photos.length - 1) {
        setCurrentIndex((prev) => prev - 1);
      }

      toast({
        title: tr("untranslated_silindi_u8c6ca", 'Silindi!') + ' 🗑️',
        description: tr("photogalleryviewer_foto_ugurla_silindi_a3226a", 'Foto uğurla silindi')
      });
    } catch (error) {
      toast({
        title: tr("photogalleryviewer_xeta_3cdbb6", 'Xəta'),
        description: tr("photogalleryviewer_foto_silinerken_xeta_bas_verdi_6359b2", 'Foto silinərkən xəta baş verdi'),
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const toggleZoom = () => {
    handleHaptic();
    setIsZoomed(!isZoomed);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Fiziki oxlar həmişə vizual istiqamətə gedir — RTL-də vizual-sol = "növbəti"
      if (e.key === 'ArrowLeft') isRtl ? goToNext() : goToPrev();
      if (e.key === 'ArrowRight') isRtl ? goToPrev() : goToNext();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrev, onClose, isRtl]);

  if (!isOpen || !currentPhoto) return null;

  // PORTAL: community (.a-shell) kimi transform/stacking-context yaradan
  // konteynerlərin içindən açılanda `fixed` overlay pozulur — StoryViewer ilə
  // eyni həll: birbaşa document.body-yə render + yüksək z-index.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-[310] flex flex-col">
        
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="absolute top-0 start-0 end-0 z-10 p-4 safe-top">
          
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/60">
              
              <X className="w-5 h-5" />
            </Button>
            
            {/* Photo counter */}
            <div className="px-4 py-2 rounded-full bg-black/50">
              <span className="text-white text-sm font-medium">
                {currentIndex + 1} / {photos.length}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleZoom}
              className="w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/60">
              
              {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
            </Button>
          </div>
        </motion.div>

        {/* Main image area */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Navigation arrows for desktop */}
          {hasPrev &&
          <button
            onClick={goToPrev}
            className="absolute start-4 z-10 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/60 transition-colors hidden md:flex">
            
              <ChevronLeft className="rtl:rotate-180 w-6 h-6" />
            </button>
          }
          
          {hasNext &&
          <button
            onClick={goToNext}
            className="absolute end-4 z-10 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/60 transition-colors hidden md:flex">
            
              <ChevronRight className="rtl:rotate-180 w-6 h-6" />
            </button>
          }

          {/* Image with swipe support */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPhoto.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              drag={!isZoomed ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="w-full h-full flex items-center justify-center px-4 cursor-grab active:cursor-grabbing">
              
              <motion.img
                src={currentPhoto.url}
                alt="Photo"
                className={`max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-transform duration-300 ${
                isZoomed ? 'scale-150' : 'scale-100'}`
                }
                onClick={toggleZoom} />
              
            </motion.div>
          </AnimatePresence>

          {/* Swipe indicators for mobile */}
          <div className="absolute bottom-32 start-0 end-0 flex justify-center gap-1.5 md:hidden">
            {photos.map((_, index) =>
            <div
              key={index}
              className={`h-1 rounded-full transition-all duration-300 ${
              index === currentIndex ?
              'w-6 bg-white' :
              'w-1 bg-white/40'}`
              } />

            )}
          </div>
        </div>

        {/* Footer actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="p-4 bg-gradient-to-t from-black/80 to-transparent"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 56px)' }}>
          
          <div className="flex justify-center gap-3 max-w-md mx-auto">
            <Button
              onClick={handleShare}
              className="flex-1 h-14 rounded-2xl bg-black/50 border border-white/20 text-white hover:bg-black/60">
              
              <Share2 className="w-5 h-5 me-2" />
              {tr("photogalleryviewer_paylas_b4be3b", "Payla\u015F")}
            </Button>
            
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 h-14 rounded-2xl bg-black/50 border border-white/20 text-white hover:bg-black/60 disabled:opacity-50">
              
              {isDownloading ?
              <Loader2 className="w-5 h-5 me-2 animate-spin" /> :

              <Download className="w-5 h-5 me-2" />
              }
              {isDownloading ? tr("photogalleryviewer_yuklenir_5557de", "Y\xFCkl\u0259nir...") : tr("photogalleryviewer_yukle_2b8e67", "Y\xFCkl\u0259")}
            </Button>
            
            {onDelete &&
            <Button
              onClick={() => setShowDeleteDialog(true)}
              className="h-14 w-14 rounded-2xl bg-black/50 border border-red-500/30 text-red-400 hover:bg-red-500/30">
              
                <Trash2 className="w-5 h-5" />
              </Button>
            }
          </div>
        </motion.div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="rounded-3xl max-w-sm mx-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{tr("photogalleryviewer_sekli_silmek_isteyirsiniz_87c14d", "Şəkli silmək istəyirsiniz?")}</AlertDialogTitle>
              <AlertDialogDescription>
                {tr("photogalleryviewer_bu_emeliyyat_geri_alina_bilmez_cdab6e", "Bu \u0259m\u0259liyyat geri al\u0131na bilm\u0259z. \u015E\u0259kil h\u0259mi\u015F\u0259lik silin\u0259c\u0259k.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-2xl h-12" disabled={isDeleting}>
                {tr("photogalleryviewer_legv_et_b5e49c", "Ləğv et")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-2xl h-12 bg-red-500 hover:bg-red-600">
                
                {isDeleting ? tr("untranslated_silinir_u86cva", "Silinir...") : tr("common_sil", 'Sil')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AnimatePresence>,
    document.body);

};

export default PhotoGalleryViewer;
