import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Minus, Plus, ShoppingCart, Cake as CakeIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type Cake } from '@/hooks/useCakes';
import { useCakeCart } from '@/hooks/useCakeCart';
import { tr } from "@/lib/tr";
import { useIsRtl } from '@/lib/rtl';

interface CakeDetailScreenProps {
  cake: Cake;
  onBack: () => void;
  onOpenCart: () => void;
}

const CakeDetailScreen = ({ cake, onBack, onOpenCart }: CakeDetailScreenProps) => {
  const { toast } = useToast();
  const isRtl = useIsRtl();
  const { addToCart, totalItems } = useCakeCart();
  const [quantity, setQuantity] = useState(1);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Combine image_url and images array
  const allImages = [
  ...(cake.image_url ? [cake.image_url] : []),
  ...(Array.isArray(cake.images) ? cake.images.filter((img) => img && img !== cake.image_url) : [])];

  const hasMultipleImages = allImages.length > 1;

  const fieldLabels: string[] = Array.isArray(cake.custom_field_labels) ?
  cake.custom_field_labels as string[] :
  [];
  const showCustomFields = cake.has_custom_fields && fieldLabels.length > 0;

  const handleAddToCart = () => {
    addToCart(cake, quantity, showCustomFields ? customFields : {});
    toast({ title: tr("cakedetailscreen_sebete_elave_edildi_e0f576", 'Səbətə əlavə edildi! 🎂'), description: `${cake.name} x${quantity}` });
  };

  const goToPrev = useCallback(() => {
    setCurrentImageIndex((i) => i === 0 ? allImages.length - 1 : i - 1);
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setCurrentImageIndex((i) => i === allImages.length - 1 ? 0 : i + 1);
  }, [allImages.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      // RTL: oxu istiqamətinə uyğun güzgülənir (sağa sürüşdürmə = növbəti)
      const swipedForward = isRtl ? diff < 0 : diff > 0;
      if (swipedForward) goToNext();else
      goToPrev();
    }
  };

  return (
    <div className="a-scope min-h-screen pb-44 overflow-y-auto" style={{ background: 'var(--a-bg)' }}>
      {/* Sticky Header */}
      <div
        className="sticky top-0 z-50 flex items-center justify-between px-4 py-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', background: 'var(--a-nav-bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--a-line)' }}>
        
        <button
          onClick={(e) => {e.stopPropagation();onBack();}}
          className="a-icon-btn"
          style={{ pointerEvents: 'auto' }}
          aria-label="Back">
          
          <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
        </button>
        <h2 className="a-wordmark truncate max-w-[50%]" style={{ fontSize: 15 }}>{cake.name}</h2>
        <button
          onClick={(e) => {e.stopPropagation();onOpenCart();}}
          className="a-icon-btn relative"
          style={{ pointerEvents: 'auto' }}
          aria-label="Cart">
          
          <ShoppingCart size={16} strokeWidth={2} />
          {totalItems > 0 &&
          <span
            className="absolute -top-1 -end-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: 'var(--a-peach-2)', color: '#fff' }}>
              {totalItems}
            </span>
          }
        </button>
      </div>

      {/* Image Carousel */}
      <div
        className="relative w-full aspect-square overflow-hidden"
        style={{ background: 'var(--a-surface-soft)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}>
        
        {allImages.length > 0 ?
        <AnimatePresence mode="wait">
            <motion.img
            key={currentImageIndex}
            src={allImages[currentImageIndex]}
            alt={`${cake.name} - ${currentImageIndex + 1}`}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }} />
          
          </AnimatePresence> :

        <div className="w-full h-full flex items-center justify-center">
            <CakeIcon className="w-20 h-20" style={{ color: 'var(--a-peach-1)' }} />
          </div>
        }

        {/* Navigation Arrows */}
        {hasMultipleImages &&
        <>
            <button
            onClick={goToPrev}
            className="absolute start-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center shadow-md"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer' }}>
            
              <ChevronLeft className="rtl:rotate-180 w-5 h-5" style={{ color: 'var(--a-ink)' }} />
            </button>
            <button
            onClick={goToNext}
            className="absolute end-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center shadow-md"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer' }}>
            
              <ChevronRight className="rtl:rotate-180 w-5 h-5" style={{ color: 'var(--a-ink)' }} />
            </button>
          </>
        }

        {/* Dots */}
        {hasMultipleImages &&
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {allImages.map((_, i) =>
          <button
            key={i}
            onClick={() => setCurrentImageIndex(i)}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === currentImageIndex ? 20 : 8,
              background: i === currentImageIndex ? 'var(--a-peach-2)' : 'rgba(255,255,255,0.7)',
              border: 'none', cursor: 'pointer'
            }} />

          )}
          </div>
        }

        {/* Badge */}
        {cake.category === 'month' && cake.month_number &&
        <span className="absolute top-3 start-3 px-3 py-1 rounded-full text-xs font-bold shadow" style={{ background: 'var(--a-peach-2)', color: '#fff' }}>
            {tr(`common_month_label_${cake.month_number}`, `${cake.month_number}-ci ay`)}
          </span>
        }
        {cake.category === 'milestone' && cake.milestone_label &&
        <span className="absolute top-3 start-3 px-3 py-1 rounded-full text-xs font-bold shadow" style={{ background: 'var(--a-yellow-2)', color: '#5a3d00' }}>
            {cake.milestone_label}
          </span>
        }
      </div>

      {/* Content */}
      <div className="a-shell pt-5 space-y-4">
        {/* Title & Price Row */}
        <div>
          <h1 className="text-xl leading-tight a-heading" style={{ margin: 0, color: 'var(--a-ink)' }}>{cake.name}</h1>
          {cake.description &&
          <p className="text-sm mt-2 leading-relaxed" style={{ margin: '8px 0 0', color: 'var(--a-body-text)' }}>{cake.description}</p>
          }
          <div className="mt-3">
            <span className="a-heading" style={{ fontSize: 24, color: 'var(--a-accent-ink)' }}>{cake.price}₼</span>
          </div>
        </div>

        {/* Quantity */}
        <div className="a-card">
          <p className="text-sm font-bold mb-3" style={{ margin: '0 0 12px', color: 'var(--a-ink)' }}>{tr("cakedetailscreen_say_secin_431dab", "Say seçin")}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: 'var(--a-surface-soft)', border: 'none', cursor: 'pointer', color: 'var(--a-ink)' }}>
              
              <Minus className="w-4 h-4" />
            </button>
            <span className="a-heading w-10 text-center" style={{ fontSize: 20, color: 'var(--a-ink)' }}>{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: 'var(--a-peach-1)', border: 'none', cursor: 'pointer', color: 'var(--a-accent-ink)' }}>
              
              <Plus className="w-4 h-4" />
            </button>
            <span className="ms-auto text-lg font-bold" style={{ color: 'var(--a-ink-soft)' }}>
              {(cake.price * quantity).toFixed(2)}₼
            </span>
          </div>
        </div>

        {/* Custom Fields */}
        {showCustomFields &&
        <div className="a-card space-y-3">
            <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{tr("cakedetailscreen_ferdilesdirme_cc39bc", "✨ Fərdiləşdirmə")}</p>
            {fieldLabels.map((label) =>
          <div key={label}>
                <label className="text-xs" style={{ color: 'var(--a-ink-soft)' }}>{label}</label>
                <input
              className="a-input w-full mt-1"
              value={customFields[label] || ''}
              onChange={(e) => setCustomFields({ ...customFields, [label]: e.target.value })}
              placeholder={label} />
            
              </div>
          )}
          </div>
        }

        {/* Thumbnail strip */}
        {hasMultipleImages &&
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {allImages.map((img, i) =>
          <button
            key={i}
            onClick={() => setCurrentImageIndex(i)}
            className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all"
            style={i === currentImageIndex ?
            { border: '2px solid var(--a-peach-2)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' } :
            { border: '2px solid transparent', opacity: 0.6, cursor: 'pointer' }}>
            
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
          )}
          </div>
        }
      </div>

      {/* Fixed Bottom CTA - above BottomNav */}
      <div
        className="fixed start-0 end-0 z-40 px-4 py-3"
        style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', background: 'var(--a-nav-bg)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--a-line)' }}>
        
        <button
          className="a-cta-btn w-full"
          style={{ justifyContent: 'center', height: 52, fontSize: 14 }}
          onClick={handleAddToCart}>
          
          <ShoppingCart size={18} strokeWidth={2.2} />
          {tr("cakedetailscreen_sebete_elave_et_074411", "S\u0259b\u0259t\u0259 \u0259lav\u0259 et \u2014")} {(cake.price * quantity).toFixed(2)}₼
        </button>
      </div>
    </div>);

};

export default CakeDetailScreen;
