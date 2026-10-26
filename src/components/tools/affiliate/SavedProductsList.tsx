import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Heart } from 'lucide-react';
import { useSavedProducts, AffiliateProduct } from '@/hooks/useAffiliateProducts';
import AffiliateProductCard from './AffiliateProductCard';
import { ToolPage, ToolHeader } from '../anacan/ToolKit';

interface SavedProductsListProps {
  onSelectProduct: (product: AffiliateProduct) => void;
  onBack: () => void;
}

const SavedProductsList = ({ onSelectProduct, onBack }: SavedProductsListProps) => {
  const { data: savedProducts = [], isLoading } = useSavedProducts();

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={`${savedProducts.length} ${tr("savedproductslist_mehsul_2d6a33", "m\u0259hsul")}`}
        title={tr("savedproductslist_saxlanilmis_mehsullar_28bd17", "Saxlanılmış məhsullar")} />

      {isLoading ?
      <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) =>
        <div key={i} className="a-card overflow-hidden animate-pulse" style={{ padding: 0 }}>
              <div className="aspect-square w-full" style={{ background: 'var(--a-surface-soft)' }} />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded" style={{ background: 'var(--a-surface-soft)' }} />
                <div className="h-3 w-1/2 rounded" style={{ background: 'var(--a-surface-soft)' }} />
              </div>
            </div>
        )}
        </div> :
      savedProducts.length === 0 ?
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-card text-center"
        style={{ padding: '40px 18px' }}>
        
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--a-pink-1)' }}>
            <Heart className="w-10 h-10" style={{ color: 'var(--a-pink-2)' }} />
          </div>
          <h2 className="a-list-title mb-2" style={{ margin: '0 0 8px', fontSize: 16 }}>{tr("savedproductslist_hele_hec_ne_saxlanmayib_70769c", "Hələ heç nə saxlanmayıb")}</h2>
          <p className="a-list-sub max-w-xs mx-auto" style={{ margin: '0 auto', whiteSpace: 'normal' }}>
            {tr("savedproductslist_beyendiyiniz_mehsullari_ile_sa_7ecb02", "B\u0259y\u0259ndiyiniz m\u0259hsullar\u0131 \u2764\uFE0F il\u0259 saxlay\u0131n, sonra buradan asanl\u0131qla tap\u0131n")}
          </p>
        </motion.div> :

      <div className="grid grid-cols-2 gap-3">
          {savedProducts.map((product, index) =>
        <AffiliateProductCard
          key={product.id}
          product={product as AffiliateProduct}
          onSelect={onSelectProduct}
          index={index} />

        )}
        </div>
      }
    </ToolPage>);

};

export default SavedProductsList;
