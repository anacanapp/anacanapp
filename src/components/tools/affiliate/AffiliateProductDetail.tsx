import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, ExternalLink, Star, Clock,
  Check, X, Play, Share2, Tag, Store, Info, ChevronRight, Sparkles } from
'lucide-react';
import { AffiliateProduct, useIsProductSaved, useSaveProduct, useUnsaveProduct } from '@/hooks/useAffiliateProducts';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { nativeShare } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { ToolPage } from '../anacan/ToolKit';
import { tr } from "@/lib/tr";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi } from
'@/components/ui/carousel';

interface AffiliateProductDetailProps {
  product: AffiliateProduct;
  onBack: () => void;
}

// Platform → anacan palette (soft chips)
const platformColors: Record<string, {bg: string;ink: string;}> = {
  trendyol: { bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)' },
  amazon: { bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
  aliexpress: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' },
  other: { bg: 'var(--a-surface-soft)', ink: 'var(--a-ink-soft)' }
};

const platformLabels: Record<string, string> = {
  trendyol: 'Trendyol',
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  other: tr("affiliateproductdetail_magaza_defaa2", "Ma\u011Faza")
};

const AffiliateProductDetail = ({ product, onBack }: AffiliateProductDetailProps) => {
  useScrollToTop();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const { toast } = useToast();

  const { data: isSaved } = useIsProductSaved(product.id);
  const saveProduct = useSaveProduct();
  const unsaveProduct = useUnsaveProduct();

  // Combine main image with additional images
  const allImages = [product.image_url, ...(product.images || [])].filter(Boolean) as string[];

  const discountPercent = product.original_price && product.price && product.original_price > product.price ?
  Math.round((1 - product.price / product.original_price) * 100) :
  null;

  const platformStyle = platformColors[product.platform] || platformColors.other;

  // Handle carousel scroll
  const onSelect = useCallback(() => {
    if (!carouselApi) return;
    setCurrentImageIndex(carouselApi.selectedScrollSnap());
  }, [carouselApi]);

  // Set up carousel listener
  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi, onSelect]);

  const handleSaveToggle = () => {
    if (isSaved) {
      unsaveProduct.mutate(product.id);
    } else {
      saveProduct.mutate(product.id);
    }
  };

  const handleShare = async () => {
    const success = await nativeShare({
      title: product.name_az || product.name,
      text: `${product.name_az || product.name} - ${product.price ? `${product.price} ${product.currency}` : tr("affiliateproductdetail_qiymeti_yoxla_a4b76d", "Qiym\u0259ti yoxla")}`,
      url: product.affiliate_url
    });

    if (success) {
      toast({ title: tr("affiliateproductdetail_paylasildi_c7d9ef", 'Paylaşıldı!') });
    }
  };

  const handleGoToStore = () => {
    window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
  };

  const scrollToImage = (index: number) => {
    carouselApi?.scrollTo(index);
  };

  return (
    <ToolPage className="pb-44">
      {/* Header */}
      <header className="a-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label="Back">
            <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
          </motion.button>
          <div style={{ minWidth: 0 }}>
            <p className="a-eyebrow">{product.store_name || platformLabels[product.platform] || product.platform}</p>
            <p className="a-wordmark" style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tr("affiliateproductdetail_mehsul_haqqinda_6389a1", "M\u0259hsul haqq\u0131nda")}
            </p>
          </div>
        </div>
        <div className="a-topbar-actions">
          <button className="a-icon-btn" onClick={handleShare} aria-label="Share">
            <Share2 size={16} strokeWidth={2} />
          </button>
          <button
            className="a-icon-btn"
            onClick={handleSaveToggle}
            aria-label="Save"
            style={isSaved ? { color: 'var(--a-pink-2)' } : undefined}>
            
            <Heart size={16} strokeWidth={2} className={isSaved ? 'fill-current' : ''} />
          </button>
        </div>
      </header>

      {/* Image Gallery */}
      <div className="relative a-card overflow-hidden mb-3" style={{ padding: 0 }}>
        {allImages.length > 1 ?
        <Carousel
          setApi={setCarouselApi}
          className="w-full"
          opts={{ loop: true }}>
          
            <CarouselContent className="-ms-0">
              {allImages.map((img, idx) =>
            <CarouselItem key={idx} className="ps-0">
                  <div className="relative aspect-square flex items-center justify-center p-6">
                    <img
                  src={img || '/placeholder.svg'}
                  alt={`${product.name_az || product.name} - ${idx + 1}`}
                  className="max-w-full max-h-full object-contain rounded-2xl" />
                
                  </div>
                </CarouselItem>
            )}
            </CarouselContent>
          </Carousel> :

        <div className="relative aspect-square flex items-center justify-center p-6">
            <img
            src={allImages[0] || '/placeholder.svg'}
            alt={product.name_az || product.name}
            className="max-w-full max-h-full object-contain rounded-2xl" />
          
          </div>
        }

        {/* Discount Badge */}
        {discountPercent &&
        <div className="absolute top-4 start-4">
            <span className="text-sm px-3 py-1 rounded-full font-bold shadow-lg" style={{ background: 'var(--a-pink-2)', color: '#fff' }}>
              -{discountPercent}%
            </span>
          </div>
        }

        {/* Featured Badge */}
        {product.is_featured &&
        <div className="absolute top-4 end-4">
            <span className="px-3 py-1 rounded-full font-bold shadow-lg flex items-center gap-1 text-xs" style={{ background: 'var(--a-yellow-2)', color: '#5a3d00' }}>
              <Sparkles className="w-3 h-3" />
              {tr("affiliateproductdetail_tovsiyye_45368e", "T\xF6vsiyy\u0259")}
            </span>
          </div>
        }
        
        {/* Video Button */}
        {product.video_url &&
        <button
          onClick={() => setShowVideo(true)}
          className="absolute bottom-20 end-4 px-4 py-2.5 rounded-full flex items-center gap-2 shadow-xl z-10"
          style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', cursor: 'pointer' }}>
          
            <Play className="w-4 h-4 fill-current" style={{ color: 'var(--a-peach-2)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--a-ink)' }}>Video</span>
          </button>
        }
        
        {/* Thumbnail Preview */}
        {allImages.length > 1 &&
        <div className="px-4 pb-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
              {allImages.map((img, idx) =>
            <button
              key={idx}
              onClick={() => scrollToImage(idx)}
              className="shrink-0 w-14 h-14 rounded-xl overflow-hidden transition-all"
              style={idx === currentImageIndex ?
              { border: '2px solid var(--a-peach-2)', boxShadow: 'var(--a-card-shadow)', transform: 'scale(1.05)', cursor: 'pointer' } :
              { border: '2px solid var(--a-line)', opacity: 0.7, cursor: 'pointer' }}>
              
                  <img
                src={img || '/placeholder.svg'}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover" />
              
                </button>
            )}
            </div>
          </div>
        }
      </div>

      {/* Product Info */}
      <div className="space-y-3">
        {/* Main Info Card */}
        <div className="a-card">
          {/* Platform & Store */}
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: platformStyle.bg, color: platformStyle.ink }}>
              <Store className="w-3.5 h-3.5" />
              {product.store_name || platformLabels[product.platform] || product.platform}
            </span>
          </div>
          
          {/* Title */}
          <h1 className="text-xl font-bold leading-tight mb-3 a-heading" style={{ margin: '0 0 12px', color: 'var(--a-ink)' }}>{product.name_az || product.name}</h1>
          
          {/* Rating */}
          {product.rating > 0 &&
          <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) =>
              <Star
                key={star}
                className={`w-4 h-4 ${star <= Math.round(product.rating) ? 'fill-current' : ''}`}
                style={{ color: star <= Math.round(product.rating) ? 'var(--a-yellow-2)' : 'var(--a-line-strong)' }} />

              )}
              </div>
              <span className="font-bold text-sm" style={{ color: 'var(--a-ink)' }}>{product.rating.toFixed(1)}</span>
              {product.review_count > 0 &&
            <span className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>({product.review_count} {tr("affiliateproductdetail_rey_f2285f", "r\u0259y)")}</span>
            }
            </div>
          }
          
          {/* Price Section */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--a-peach-1)' }}>
            <div className="flex items-baseline gap-2 flex-wrap">
              {product.price ?
              <>
                  <span className="a-heading" style={{ fontSize: 30, color: 'var(--a-accent-ink)' }}>{product.price}</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--a-accent-ink)' }}>{product.currency}</span>
                  {product.original_price && product.original_price > product.price &&
                <span className="text-base line-through ms-2" style={{ color: 'var(--a-accent-ink)', opacity: 0.55 }}>
                      {product.original_price} {product.currency}
                    </span>
                }
                </> :

              <span className="text-base" style={{ color: 'var(--a-accent-ink)', opacity: 0.8 }}>{tr("affiliateproductdetail_qiymet_ucun_magazaya_kecin_8b6888", "Qiymət üçün mağazaya keçin")}</span>
              }
            </div>
            
            {/* Price Update Info */}
            {product.price_updated_at &&
            <p className="text-xs mt-2 flex items-center gap-1.5" style={{ margin: '8px 0 0', color: 'var(--a-accent-ink)', opacity: 0.7 }}>
                <Clock className="w-3 h-3" />
                {tr("affiliateproductdetail_qiymet_54c4f3", "Qiym\u0259t")} {formatDistanceToNow(new Date(product.price_updated_at), { locale: getCurrentDateLocale(), addSuffix: true })} {tr("affiliateproductdetail_yenilenib_d414bf", "yenil\u0259nib")}
              </p>
            }

            {/* Go to Store Link - Right below price update */}
            <button
              onClick={handleGoToStore}
              className="mt-3 w-full flex items-center justify-between p-3 rounded-xl transition-colors group"
              style={{ background: 'var(--a-chip-overlay)', border: 'none', cursor: 'pointer' }}>
              
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" style={{ color: 'var(--a-accent-ink)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--a-accent-ink)' }}>{tr("affiliateproductdetail_mehsula_get_eff59e", "Məhsula get")}</span>
              </div>
              <ChevronRight className="rtl:rotate-180 w-4 h-4 group-hover:translate-x-1 transition-transform" style={{ color: 'var(--a-accent-ink)' }} />
            </button>
          </div>
          
          {/* Tags */}
          {product.tags && product.tags.length > 0 &&
          <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag, idx) =>
            <span key={idx} className="a-rank-tag" style={{ margin: 0, background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
            )}
            </div>
          }
        </div>

        {/* Description */}
        {(product.description_az || product.description) &&
        <div className="a-card">
            <h2 className="a-card-title a-heading mb-2 flex items-center gap-2" style={{ margin: '0 0 8px' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--a-peach-1)' }}>
                <Info className="w-3.5 h-3.5" style={{ color: 'var(--a-accent-ink)' }} />
              </span>
              {tr("affiliateproductdetail_mehsul_haqqinda_6389a1", "M\u0259hsul haqq\u0131nda")}
            </h2>
            <p className="a-cta-text" style={{ margin: 0 }}>
              {product.description_az || product.description}
            </p>
          </div>
        }

        {/* Pros and Cons */}
        {(product.pros && product.pros.length > 0 || product.cons && product.cons.length > 0) &&
        <div className="grid grid-cols-2 gap-3">
            {product.pros && product.pros.length > 0 &&
          <div className="rounded-2xl p-3" style={{ background: 'var(--a-green-1)' }}>
                <h3 className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ margin: '0 0 8px', color: 'var(--a-green-ink)' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--a-chip-overlay)' }}>
                    <Check className="w-3 h-3" style={{ color: 'var(--a-green-ink)' }} />
                  </span>
                  {tr("affiliateproductdetail_ustunlukleri_06e1a1", "\xDCst\xFCnl\xFCkl\u0259ri")}
                </h3>
                <ul className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {product.pros.map((pro, idx) =>
              <li key={idx} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-green-ink)' }}>
                      <Check className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{pro}</span>
                    </li>
              )}
                </ul>
              </div>
          }
            {product.cons && product.cons.length > 0 &&
          <div className="rounded-2xl p-3" style={{ background: 'var(--a-pink-1)' }}>
                <h3 className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ margin: '0 0 8px', color: 'var(--a-pink-ink)' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--a-chip-overlay)' }}>
                    <X className="w-3 h-3" style={{ color: 'var(--a-pink-ink)' }} />
                  </span>
                  {tr("affiliateproductdetail_catismazliqlari_1c0dce", "\xC7at\u0131\u015Fmazl\u0131qlar\u0131")}
                </h3>
                <ul className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {product.cons.map((con, idx) =>
              <li key={idx} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--a-pink-ink)' }}>
                      <X className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{con}</span>
                    </li>
              )}
                </ul>
              </div>
          }
          </div>
        }

        {/* Specifications */}
        {product.specifications && Object.keys(product.specifications).length > 0 &&
        <div className="a-card">
            <h2 className="a-card-title a-heading mb-3" style={{ margin: '0 0 12px' }}>{tr("affiliateproductdetail_xususiyyetleri_11ea09", "Xüsusiyyətləri")}</h2>
            <div className="space-y-0">
              {Object.entries(product.specifications).map(([key, value], idx, arr) =>
            <div
              key={key}
              className="flex justify-between py-2.5"
              style={{ borderBottom: idx !== arr.length - 1 ? '1px solid var(--a-line)' : 'none' }}>
              
                  <span className="text-sm" style={{ color: 'var(--a-ink-soft)' }}>{key}</span>
                  <span className="text-sm font-semibold text-end max-w-[60%]" style={{ color: 'var(--a-ink)' }}>{value}</span>
                </div>
            )}
            </div>
          </div>
        }

        {/* Review Summary */}
        {(product.review_summary_az || product.review_summary) &&
        <div className="rounded-2xl p-4" style={{ background: 'var(--a-yellow-1)' }}>
            <h2 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ margin: '0 0 8px', color: 'var(--a-warn-ink)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--a-chip-overlay)' }}>
                <Star className="w-3.5 h-3.5 fill-current" style={{ color: 'var(--a-warn-ink)' }} />
              </span>
              {tr("affiliateproductdetail_rey_xulasesi_4d1c8e", "R\u0259y x\xFClas\u0259si")}
            </h2>
            <p className="text-sm italic leading-relaxed" style={{ margin: 0, color: 'var(--a-warn-ink)', opacity: 0.9 }}>
              "{product.review_summary_az || product.review_summary}"
            </p>
          </div>
        }

        {/* Disclaimer */}
        <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)' }}>
          <p className="text-[10px] leading-relaxed" style={{ margin: 0, color: 'var(--a-disclaimer-ink)' }}>
            {tr("affiliateproductdetail_bu_sehifedeki_link_affiliate_l_966c93", "Bu s\u0259hif\u0259d\u0259ki link affiliate linkdir. Al\u0131\u015F-veri\u015F etdikd\u0259 biz ki\xE7ik komissiya qazana bil\u0259rik.\n            Qiym\u0259t d\u0259yi\u015F\u0259 bil\u0259r.")}
          
          </p>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div
        className="fixed start-0 end-0 z-30"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)', background: 'var(--a-nav-bg)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--a-line)' }}>
        
        <div className="flex gap-3 p-4">
          <button
            className="a-btn-soft flex-1"
            style={{ justifyContent: 'center', height: 48 }}
            onClick={handleSaveToggle}>
            
            <Heart size={16} strokeWidth={2.2} className={isSaved ? 'fill-current' : ''} style={isSaved ? { color: 'var(--a-pink-2)' } : undefined} />
            {isSaved ? tr("affiliateproductdetail_saxlanildi_66ffe7", "Saxlanıldı") : tr("affiliateproductdetail_saxla_3c7a2d", "Saxla")}
          </button>
          <button
            className="a-cta-btn flex-[2]"
            style={{ justifyContent: 'center', height: 48 }}
            onClick={handleGoToStore}>
            
            <ExternalLink size={16} strokeWidth={2.2} />
            {tr("affiliateproductdetail_mehsula_kec_4a61a9", "M\u0259hsula ke\xE7")}
          </button>
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {showVideo && product.video_url &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setShowVideo(false)}>
          
            <button
            className="absolute end-4 w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowVideo(false)}>
            
              <X className="w-6 h-6" />
            </button>
            <video
            src={product.video_url}
            controls
            autoPlay
            className="max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()} />
          
          </motion.div>
        }
      </AnimatePresence>
    </ToolPage>);

};

export default AffiliateProductDetail;
