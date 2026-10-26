import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Star, Heart, ExternalLink, Clock } from 'lucide-react';
import { AffiliateProduct, useIsProductSaved, useSaveProduct, useUnsaveProduct } from '@/hooks/useAffiliateProducts';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';

interface AffiliateProductCardProps {
  product: AffiliateProduct;
  onSelect: (product: AffiliateProduct) => void;
  index?: number;
  variant?: 'grid' | 'featured';
}

// Platform → anacan palette (solid chips)
const platformStyles: Record<string, {bg: string;ink: string;}> = {
  trendyol: { bg: 'var(--a-peach-2)', ink: '#fff' },
  amazon: { bg: 'var(--a-yellow-2)', ink: '#5a3d00' },
  aliexpress: { bg: 'var(--a-pink-2)', ink: '#fff' },
  other: { bg: 'var(--a-line-strong)', ink: 'var(--a-ink)' }
};

const AffiliateProductCard = ({ product, onSelect, index = 0, variant = 'grid' }: AffiliateProductCardProps) => {
  const { data: isSaved } = useIsProductSaved(product.id);
  const saveProduct = useSaveProduct();
  const unsaveProduct = useUnsaveProduct();

  const handleSaveToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved) {
      unsaveProduct.mutate(product.id);
    } else {
      saveProduct.mutate(product.id);
    }
  };

  const discountPercent = product.original_price && product.price && product.original_price > product.price ?
  Math.round((1 - product.price / product.original_price) * 100) :
  null;

  const priceAge = product.price_updated_at ?
  formatDistanceToNow(new Date(product.price_updated_at), { locale: getCurrentDateLocale(), addSuffix: true }) :
  null;

  const platform = platformStyles[product.platform] || platformStyles.other;

  if (variant === 'featured') {
    return (
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        onClick={() => onSelect(product)}
        className="flex-shrink-0 w-64 overflow-hidden text-start transition-shadow rounded-[20px]"
        style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' }}>
        
        <div className="relative h-36" style={{ background: 'var(--a-illus-grad)' }}>
          {product.image_url ?
          <img loading="lazy" decoding="async"
            src={product.image_url}
            alt={product.name_az || product.name}
            className="w-full h-full object-cover" /> :


          <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
          }
          
          {/* Platform Badge */}
          <span
            className="absolute top-2 start-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: platform.bg, color: platform.ink }}>
            {product.store_name || product.platform}
          </span>
          
          {/* Discount Badge */}
          {discountPercent &&
          <span className="absolute top-2 end-10 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--a-pink-2)', color: '#fff' }}>
              -{discountPercent}%
            </span>
          }
          
          {/* Save Button */}
          <button
            onClick={handleSaveToggle}
            className="absolute top-2 end-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={isSaved ?
            { background: 'var(--a-pink-2)', color: '#fff', border: 'none', cursor: 'pointer' } :
            { background: 'rgba(255,255,255,0.92)', color: 'var(--a-ink-faint)', border: 'none', cursor: 'pointer' }}>
            
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
        
        <div className="p-3">
          <h3 className="font-bold text-sm line-clamp-2 mb-1" style={{ color: 'var(--a-ink)' }}>{product.name_az || product.name}</h3>
          
          {product.rating > 0 &&
          <div className="flex items-center gap-1 text-xs mb-2">
              <Star className="w-3 h-3 fill-current" style={{ color: 'var(--a-yellow-2)' }} />
              <span className="font-semibold" style={{ color: 'var(--a-ink)' }}>{product.rating.toFixed(1)}</span>
              {product.review_count > 0 &&
            <span style={{ color: 'var(--a-ink-soft)' }}>({product.review_count})</span>
            }
            </div>
          }
          
          <div className="flex items-end justify-between">
            <div>
              {product.price ?
              <div className="flex items-center gap-2">
                  <span className="font-bold text-lg" style={{ color: 'var(--a-accent-ink)' }}>{product.price} {product.currency}</span>
                  {product.original_price && product.original_price > product.price &&
                <span className="text-xs line-through" style={{ color: 'var(--a-ink-faint)' }}>
                      {product.original_price} {product.currency}
                    </span>
                }
                </div> :

              <span className="text-sm" style={{ color: 'var(--a-ink-soft)' }}>{tr("affiliateproductcard_qiymete_bax_f5159c", "Qiymətə bax →")}</span>
              }
              {priceAge &&
              <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ margin: '2px 0 0', color: 'var(--a-ink-faint)' }}>
                  <Clock className="w-2.5 h-2.5" />
                  {priceAge}
                </p>
              }
            </div>
            <ExternalLink className="w-4 h-4" style={{ color: 'var(--a-ink-faint)' }} />
          </div>
        </div>
      </motion.button>);

  }

  // Grid variant
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => onSelect(product)}
      className="overflow-hidden text-start transition-all rounded-[18px]"
      style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)', cursor: 'pointer' }}>
      
      <div className="relative aspect-square" style={{ background: 'var(--a-illus-grad)' }}>
        {product.image_url ?
        <img loading="lazy" decoding="async"
          src={product.image_url}
          alt={product.name_az || product.name}
          className="w-full h-full object-cover" /> :


        <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
        }
        
        {/* Platform Badge */}
        <span
          className="absolute top-1.5 start-1.5 text-[8px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: platform.bg, color: platform.ink }}>
          {product.store_name || product.platform}
        </span>
        
        {/* Discount Badge */}
        {discountPercent &&
        <span className="absolute bottom-1.5 start-1.5 text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--a-pink-2)', color: '#fff' }}>
            -{discountPercent}%
          </span>
        }
        
        {/* Save Button */}
        <button
          onClick={handleSaveToggle}
          className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
          style={isSaved ?
          { background: 'var(--a-pink-2)', color: '#fff', border: 'none', cursor: 'pointer' } :
          { background: 'rgba(255,255,255,0.92)', color: 'var(--a-ink-faint)', border: 'none', cursor: 'pointer' }}>
          
          <Heart className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>
      
      <div className="p-2.5">
        <h3 className="font-semibold text-xs line-clamp-2 mb-1 min-h-[2rem]" style={{ color: 'var(--a-ink)' }}>{product.name_az || product.name}</h3>
        
        {product.rating > 0 &&
        <div className="flex items-center gap-1 text-[10px] mb-1" style={{ color: 'var(--a-ink)' }}>
            <Star className="w-2.5 h-2.5 fill-current" style={{ color: 'var(--a-yellow-2)' }} />
            <span>{product.rating.toFixed(1)}</span>
          </div>
        }
        
        {product.price ?
        <div className="flex flex-col">
            <span className="font-bold text-sm" style={{ color: 'var(--a-accent-ink)' }}>{product.price} {product.currency}</span>
            {product.original_price && product.original_price > product.price &&
          <span className="text-[10px] line-through" style={{ color: 'var(--a-ink-faint)' }}>
                {product.original_price} {product.currency}
              </span>
          }
          </div> :

        <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--a-accent-ink)' }}>
            {tr("affiliateproductcard_etrafli_b3a8e8", "\u018Ftrafl\u0131")} <ExternalLink className="w-2.5 h-2.5" />
          </span>
        }
      </div>
    </motion.button>);

};

export default AffiliateProductCard;
